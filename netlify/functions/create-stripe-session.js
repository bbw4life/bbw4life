process.removeAllListeners('warning');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { saveTempOrder } = require('./temp-orders-store');
const { getAllProductsData, computeServerTotal } = require('./_lib/pricing');

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error("No data received");

    const { cart: rawCart, shipping, promoCode, clientTotal } = JSON.parse(event.body);

    if (!Array.isArray(rawCart) || rawCart.length === 0) throw new Error("Invalid cart data");

    // ── Recalcul du prix EXCLUSIVEMENT côté serveur (jamais les prix bruts du client) ──
    const allProducts = await getAllProductsData();
    const settings     = allProducts.find(p => p.type === 'settings') || {};
    const shippingMethod = shipping?.shipping_method || 'Standard Shipping';

    const { shippingCost, taxAmount, discountAmount, total, sanitizedCart } = computeServerTotal(
      rawCart,
      settings,
      allProducts,
      shippingMethod,
      promoCode || null
    );

    // ── Garde-fou : si un total client est fourni, il doit correspondre au total serveur ──
    if (clientTotal !== undefined) {
      const clientTotalRounded = parseFloat(parseFloat(clientTotal).toFixed(2));
      const diff = Math.abs(clientTotalRounded - total);
      if (diff > 0.10) {
        console.warn(`[STRIPE SECURITY] Price mismatch — client: $${clientTotal} | server: $${total}`);
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: false, error: 'Price mismatch detected. Please refresh and try again.' })
        };
      }
    }

    const cart = sanitizedCart;

    // ── Build Stripe line items ──
    const lineItems = cart.map(item => {
      const price = parseFloat(item.price);
      const qty   = parseInt(item.quantity);
      if (price < 0 || !qty) throw new Error("Invalid item");

      // Free promo items: Stripe requires unit_amount >= 0
      // Use $0.01 minimum only if Stripe rejects 0 — here we pass 0 for free items
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name:   item.isFreePromo ? `🎁 FREE: ${item.title}` : item.title,
            images: item.image ? [item.image] : []
          },
          unit_amount: Math.round(price * 100) // 0 for free promo items
        },
        quantity: qty
      };
    });

    // Shipping line item (only if > 0)
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(shippingCost * 100)
        },
        quantity: 1
      });
    }

    // Tax line item (only if > 0)
    if (taxAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Taxes' },
          unit_amount: Math.round(taxAmount * 100)
        },
        quantity: 1
      });
    }

    // ── Réduction via coupon Stripe (les line items négatifs sont rejetés par l'API) ──
    let discounts = [];
    if (discountAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discountAmount * 100),
        currency: 'usd',
        duration: 'once',
        name: `Promo ${promoCode}`
      });
      discounts.push({ coupon: coupon.id });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      ...(discounts.length ? { discounts } : {}),
      success_url: `${process.env.BASE_URL}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.BASE_URL}/checkout.html`,
    });

    // ── Stocker cart + shipping complets dans le Sheet temporaire (clé = session.id) ──
    await saveTempOrder(session.id, cart, shipping);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, sessionId: session.id })
    };

  } catch (error) {
    console.error("[STRIPE SESSION ERROR]", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};