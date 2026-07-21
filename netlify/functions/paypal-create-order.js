process.removeAllListeners('warning');
const fetch = require('node-fetch');
const { saveTempOrder } = require('./temp-orders-store');
const { getAllProductsData, computeServerTotal } = require('./_lib/pricing');

exports.handler = async (event) => {
  try {
    if (!event.body) return response(400, { success: false, error: "No data" });

    const { cart: rawCart, shipping, promoCode, clientTotal } = JSON.parse(event.body);

    if (!Array.isArray(rawCart) || rawCart.length === 0) {
      return response(400, { success: false, error: "Cart empty" });
    }

    // ── Recalcul du prix EXCLUSIVEMENT côté serveur (jamais les prix/shipping/tax bruts du client) ──
    const allProducts = await getAllProductsData();
    const settings     = allProducts.find(p => p.type === 'settings') || {};
    const shippingMethod = shipping?.shipping_method || 'Standard Shipping';

    const { subtotal, shippingCost, taxAmount, discountAmount, total, sanitizedCart } = computeServerTotal(
      rawCart,
      settings,
      allProducts,
      shippingMethod,
      promoCode || null
    );

    if (clientTotal !== undefined) {
      const clientTotalRounded = parseFloat(parseFloat(clientTotal).toFixed(2));
      const diff = Math.abs(clientTotalRounded - total);
      if (diff > 0.10) {
        console.warn(`[PAYPAL SECURITY] Price mismatch — client: $${clientTotal} | server: $${total}`);
        return response(400, { success: false, error: 'Price mismatch detected. Please refresh and try again.' });
      }
    }

    const cart = sanitizedCart;

    const PAYPAL_BASE = process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    if (!tokenRes.ok) throw new Error("Failed to get PayPal token");
    const { access_token } = await tokenRes.json();

    const items = cart.map(item => {
      const price = parseFloat(item.price);
      const qty = parseInt(item.quantity);
      if (price < 0 || !qty || qty <= 0) throw new Error("Invalid item");
      return {
        name: item.isFreePromo ? `🎁 FREE: ${item.title}` : item.title,
        unit_amount: { currency_code: "USD", value: price.toFixed(2) },
        quantity: qty.toString(),
        sku: item.cj_variant_id || '',
        description: `${item.color || 'N/A'}|${item.image || ''}`
      };
    });

    const finalTotal = Math.max(0, total).toFixed(2);
    const custom_id = cart.map(item => item.cj_variant_id || '').join('|');

    const fullName = `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim();
    const orderBody = {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: `${fullName}|${shipping.phone || ''}|${shipping.email || ''}|${shipping.countryCode || 'US'}|${shipping.shipping_method || 'Standard Shipping'}|${shipping.affRef || ''}|${shipping.fulfillment_method || 'eprolo'}`,
        amount: {
          currency_code: "USD",
          value: finalTotal,
          breakdown: {
            item_total: { currency_code: "USD", value: subtotal.toFixed(2) },
            shipping:   { currency_code: "USD", value: shippingCost.toFixed(2) },
            tax_total:  { currency_code: "USD", value: taxAmount.toFixed(2) },
            discount:   { currency_code: "USD", value: discountAmount.toFixed(2) }
          }
        },
        items: items,
        shipping: {
          name: { full_name: fullName },
          address: {
            address_line_1: shipping.address || '',
            address_line_2: '',
            admin_area_2: shipping.city || "",
            admin_area_1: shipping.state || "",
            postal_code: shipping.postalCode || "",
            country_code: shipping.countryCode || "US"
          }
        },
        custom_id: custom_id
      }],
      application_context: {
        return_url: `${process.env.BASE_URL}/thankyou.html`,
        cancel_url: `${process.env.BASE_URL}/checkout.html`,
        shipping_preference: "SET_PROVIDED_ADDRESS" 
      }
    };

    let payer = {};
    if (shipping.email) payer.email_address = shipping.email;
    if (shipping.firstName || shipping.lastName) {
      payer.name = { given_name: shipping.firstName || '', surname: shipping.lastName || '' };
    }
    if (shipping.phone && shipping.countryCode) {
      try {
        const countriesRes = await fetch(`${process.env.BASE_URL}/countries.json`);
        const countriesData = await countriesRes.json();
        const found = countriesData.find(c => c.cca2 === shipping.countryCode);
        if (found) {
          const countryCode = (found.idd?.root || '').replace('+', '');

          const suffixes = found.idd?.suffixes || [];
          const fullDialCode = suffixes.length === 1
            ? countryCode + suffixes[0]
            : countryCode;

          let nationalNumber = shipping.phone.replace(/\D/g, '');
          if (nationalNumber.startsWith(fullDialCode)) {
            nationalNumber = nationalNumber.slice(fullDialCode.length);
          } else if (nationalNumber.startsWith(countryCode)) {
            nationalNumber = nationalNumber.slice(countryCode.length);
          }

          payer.phone = {
            phone_type: "MOBILE",
            phone_number: {
              country_code: countryCode,
              national_number: nationalNumber
            }
          };
        }
      } catch (err) {}
    }
    orderBody.payer = payer;

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(orderBody)
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      throw new Error(errText || "PayPal order creation failed");
    }
    const orderData = await orderRes.json();

    // ── Sauvegarde temporaire pour la détection de panier abandonné ──
    try {
      await saveTempOrder(orderData.id, cart, shipping);
    } catch (e) {
      console.warn("[PAYPAL] saveTempOrder failed:", e.message);
    }

    return response(200, {
      success: true,
      orderID: orderData.id,
      paypalDomain: PAYPAL_BASE.includes("sandbox") ? "https://www.sandbox.paypal.com" : "https://www.paypal.com"
    });

  } catch (error) {
    console.error("[PAYPAL] Global error:", error.message);
    return response(500, { success: false, error: "PayPal order creation failed" });
  }
};

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}