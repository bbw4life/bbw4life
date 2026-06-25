process.removeAllListeners('warning');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const {
  getAndDeleteTempOrder,
  isOrderAlreadyProcessed,
  markOrderAsProcessed
} = require('./temp-orders-store');

exports.handler = async (event) => {
  console.log("=== VERIFY PAYMENT STARTED ===");
  try {
    if (!event.body) throw new Error("No data received");
    const { provider, sessionId, orderID } = JSON.parse(event.body);
    console.log(`Provider: ${provider} | OrderID: ${orderID || 'N/A'}`);
    const paymentId = sessionId || orderID;
    if (!paymentId) throw new Error("Missing payment ID");

    // ── ANTI-DOUBLON : vérification ET marquage immédiat avant tout traitement ──
    const alreadyProcessed = await isOrderAlreadyProcessed(paymentId);
    if (alreadyProcessed) {
      console.log(`🚫 DUPLICATE DETECTED (${paymentId}) → SKIP`);
      return response(200, { success: true, message: "Duplicate - already processed" });
    }

    const marked = await markOrderAsProcessed(paymentId);
    if (!marked) {
      console.error(`[ANTI-DUPLICATE] Impossible de marquer ${paymentId} — abandon par sécurité`);
      throw new Error("Could not secure payment processing lock");
    }

    let cart = [];
    let shipping = {};
    let paymentVerified = false;
    let session;
    let purchaseUnit;
    const BASE_URL = process.env.BASE_URL || process.env.URL || `https://${event.headers.host}`;
    console.log(`🔗 BASE_URL utilisée : ${BASE_URL}`);

    // ====================== STRIPE ======================
    if (provider === "stripe") {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") throw new Error("Stripe not paid");

      const tempOrder = await getAndDeleteTempOrder(sessionId);
      if (!tempOrder) throw new Error("Stripe order data not found in temp store");

      cart = (tempOrder.cart || []).map(item => ({
        title:         item.title,
        price:         parseFloat(item.price) || 0,
        quantity:      parseInt(item.quantity) || 1,
        variantsid:    item.cj_variant_id || item.variantsid || null,
        image:         item.image || '',
        image_variant: item.image || '',
        color:         item.color || '',
        size:          item.size  || ''
      }));
      shipping = tempOrder.shipping || {};
      paymentVerified = true;

    // ====================== PAYPAL ======================
    } else if (provider === "paypal") {
      const PAYPAL_BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      const { access_token } = await tokenRes.json();

      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      const orderData = await orderRes.json();

      if (orderData.status === "APPROVED") {
        await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" } });
      }

      const finalOrderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, { headers: { Authorization: `Bearer ${access_token}` } });
      const finalOrderData = await finalOrderRes.json();
      if (finalOrderData.status !== "COMPLETED") throw new Error("PayPal payment not completed");

      purchaseUnit = finalOrderData.purchase_units?.[0] || {};
      const storedVariants = purchaseUnit.custom_id ? purchaseUnit.custom_id.split('|') : [];
      const itemsArray = purchaseUnit.items || [];

      cart = itemsArray.map((item, i) => {
        const descParts = (item.description || '').split('|');
        return {
          title: item.name,
          price: parseFloat(item.unit_amount.value),
          quantity: parseInt(item.quantity),
          variantsid: item.sku || storedVariants[i] || null,
          image: descParts[1] || item.description || '',
          color: descParts[0] && descParts[0] !== 'N/A' ? descParts[0] : ''
        };
      });

      if (cart.length === 0 && storedVariants.length > 0) {
        cart = storedVariants.map((str, i) => {
          return { title: `Product ${i+1}`, price: 0, quantity: 1, variantsid: str || null, image: '' };
        });
      }

      const payer = finalOrderData.payer || {};
      const ship = purchaseUnit.shipping || {};
      const refParts = purchaseUnit.reference_id ? purchaseUnit.reference_id.split('|') : [];

      let countryCode = refParts[3] || ship.address?.country_code || "US";
      let countryName = "United States";
      try {
        const countriesRes = await fetch(`${BASE_URL}/countries.json`);
        const countriesData = await countriesRes.json();
        const found = countriesData.find(c => c.cca2 === countryCode);
        if (found) countryName = found.name.common;
      } catch (err) {
        console.log("[PAYPAL] Country lookup failed, using fallback");
      }

      let email = refParts[2] || payer.email_address || '';
      let firstName = payer.name?.given_name || '';
      let lastName = payer.name?.surname || '';
      if (firstName.toLowerCase() === 'john' && lastName.toLowerCase() === 'doe') {
        const nameParts = (refParts[0] || '').split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      shipping = {
        firstName, lastName,
        email,
        phone: payer.phone?.phone_number ? `+${payer.phone.phone_number.country_code || ''}${payer.phone.phone_number.national_number || ''}` : refParts[1] || '',
        address: ship.address?.address_line_1 || "",
        city: ship.address?.admin_area_2 || "",
        state: ship.address?.admin_area_1 || "",
        postalCode: ship.address?.postal_code || "",
        country: countryName,
        countryCode: countryCode,
        shipping_method: refParts[4] || "Standard Shipping"
      };
      console.log("[PAYPAL] Final shipping pulled:", JSON.stringify(shipping));
      paymentVerified = true;

    // ====================== NOWPAYMENTS ======================
    } else if (provider === "nowpayments") {
      const parsed = JSON.parse(event.body);
      cart     = parsed.cart     || [];
      shipping = parsed.shipping || {};
      if (cart.length === 0) throw new Error("Cart empty from NOWPayments webhook");
      paymentVerified = true;
    }

    if (!paymentVerified || cart.length === 0) throw new Error("Payment verification failed or cart empty");

    let totalAmount = 0;
    if (provider === "stripe") {
      totalAmount = session.amount_total / 100;
    } else if (provider === "paypal") {
      totalAmount = parseFloat(purchaseUnit.amount.value);
    } else if (provider === "nowpayments") {
      const parsed = JSON.parse(event.body);
      totalAmount = parseFloat(parsed.totalAmount) || 0;
    }
    const totalQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);

    const orderItems = cart.map(item => ({
      title:         item.title,
      variant_color: item.color         || '',
      color:         item.color         || '',
      size:          item.size          || '',
      image_variant: item.image_variant || item.image || '',
      price:         item.price,
      quantity:      item.quantity,
      lineTotal:     item.price * item.quantity,
      variantsid:    item.variantsid    || ''
    }));

    if (shipping.email) {
      await fetch(`${BASE_URL}/.netlify/functions/save-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'record-order',
          email: shipping.email,
          totalAmount,
          totalQuantity,
          orderItems
        })
      });
    }

    // ── Email Order Confirmation ──
    if (shipping.email) {
      fetch(`${BASE_URL}/.netlify/functions/send-email-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger:    'order_confirm',
          email:      shipping.email,
          firstName:  shipping.firstName || '',
          lastName:   shipping.lastName  || '',
          orderId:    paymentId,
          items:      orderItems,
          total:      totalAmount,
          shippingAddress: [
            shipping.address,
            shipping.city,
            shipping.state,
            shipping.country
          ].filter(Boolean).join(', ')
        })
      }).catch(e => console.warn('[Email] order_confirm failed:', e.message));
    }

    // ── Analytics : enregistrer la commande dans le sheet ──
    fetch(`${BASE_URL}/.netlify/functions/save-analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp:    new Date().toISOString(),
        sessionId:    paymentId,
        pageUrl:      `${BASE_URL}/checkout.html`,
        pageTitle:    'Checkout — Order Confirmed',
        timeOnPage:   0,
        clicks:       0,
        menuClicks:   0,
        scrollDepth:  0,
        referrer:     provider,
        device:       '',
        browser:      '',
        screenWidth:  0,
        actionsCount: 0,
        orderId:      paymentId,
        orderTotal:   totalAmount.toFixed(2),
        currency:     'USD',
        itemsCount:   totalQuantity,
        orderCountry: shipping.country || ''
      })
    }).catch(e => console.warn('[Analytics] save-analytics failed:', e.message));

    const affRef = (provider === 'paypal' ? (purchaseUnit?.reference_id || '').split('|')[5] : shipping.affRef) || null;

    if (affRef) {
      try {
        await fetch(`${BASE_URL}/.netlify/functions/save-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action:      "aff-record-order",
            username:    affRef,
            orderAmount: totalAmount
          })
        });
        console.log(`[AFFILIATION] Commission enregistrée pour @${affRef} — commande $${totalAmount}`);
      } catch(e) {
        console.warn("[AFFILIATION] Erreur commission:", e.message);
      }
    }

    console.log("=== DÉBUT FULFILLMENT SÉQUENTIEL ===");
    const cartMap = {};
    cart.forEach(item => {
      const vid = item.variantsid || null;
      if (vid) {
        if (!cartMap[vid]) cartMap[vid] = { title: item.title, price: item.price, quantity: 0, variantsid: vid };
        cartMap[vid].quantity += item.quantity;
      }
    });
    const groupedCart = Object.values(cartMap);
    const readyForEprolo = groupedCart.filter(item => item.variantsid);
    const notReady = cart.filter(item => !item.variantsid);

    // ── Récupérer fulfillment_method depuis shipping (envoyé par checkout.js) ──
    const fulfillment_method = (shipping.fulfillment_method || 'eprolo').toLowerCase().trim();
    console.log(`[VERIFY PAYMENT] Fulfillment method détecté: ${fulfillment_method}`);

    for (const item of notReady) {
      await saveAsPending(item, shipping, BASE_URL, provider, paymentId, "pending_stock", fulfillment_method);
    }
    for (const item of readyForEprolo) {
      await saveAsPending(item, shipping, BASE_URL, provider, paymentId, "pending", fulfillment_method);
    }

    console.log("🎯 Fulfillment terminé");
    return response(200, { success: true, fulfillmentStatus: "processing" });
  } catch (error) {
    console.error("=== VERIFY PAYMENT ERROR ===", error.message);
    return response(500, { success: false, error: error.message });
  }
};

async function saveAsPending(item, shipping, BASE_URL, provider, paymentId, status = "pending_stock", fulfillment_method = "eprolo") {
  try {
    await fetch(`${BASE_URL}/.netlify/functions/save-pending-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipping,
        item,
        payment_provider:   provider,
        payment_id:         paymentId || "auto",
        status,
        fulfillment_method  // ← NOUVEAU
      })
    });
  } catch (e) {
    console.error("saveAsPending failed:", e.message);
  }
}

function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}