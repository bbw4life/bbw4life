const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch  = require('node-fetch');

// ── Fetch settings from products.data.json ──────────────────────────
async function getSettings() {
  try {
    const BASE_URL = process.env.BASE_URL || '';
    const res = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) throw new Error('Failed to fetch products.data.json');
    const data = await res.json();
    const settings = data.find(p => p.type === 'settings') || {};
    return settings;
  } catch (err) {
    console.warn('[STRIPE] Could not load products.data.json, using defaults:', err.message);
    return {};
  }
}

// ── Compute effective shipping & tax based on settings ───────────────
function computeTotals(cart, settings, shippingMethod) {
  const cd = settings.cart_drawer || {};
  const SHIPPING_COST = parseFloat(settings.shipping_cost) || 10.00;
  const TAX_RATE      = parseFloat(settings.tax_rate)      || 0.10;
  const freeShippingThreshold = parseFloat(cd.free_shipping_threshold) || 0;

  const subtotal = cart.reduce((sum, item) => {
    return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
  }, 0);

  // Gratuit si méthode Standard ou Economy
  const isFreeMethod = ['Standard Shipping', 'Economy Shipping'].includes(shippingMethod);
  // Gratuit si subtotal >= threshold
  const isFreeByThreshold = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;

  const isFree = isFreeMethod || isFreeByThreshold;

  return {
    subtotal:     subtotal,
    shippingCost: isFree ? 0 : SHIPPING_COST,
    taxAmount:    isFree ? 0 : subtotal * TAX_RATE,
  };
}

// ── Enforce free promo items (price = 0) from settings ───────────────
function sanitizeCart(cart, settings) {
  const cd = settings.cart_drawer || {};
  const buyQty = parseInt(cd.promo_buy_quantity) || 0;
  const getQty = parseInt(cd.promo_get_quantity)  || 0;

  if (!buyQty || !getQty) return cart;

  const paidItems = cart.filter(i => !i.isFreePromo);
  const paidQty   = paidItems.reduce((sum, i) => sum + (parseInt(i.quantity) || 0), 0);

  return cart.map(item => {
    if (item.isFreePromo) {
      if (paidQty >= buyQty) {
        return { ...item, price: 0 };
      } else {
        return { ...item, isFreePromo: false };
      }
    }
    return item;
  });
}

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error("No data received");

    const { cart: rawCart, shipping } = JSON.parse(event.body);

    if (!Array.isArray(rawCart) || rawCart.length === 0) throw new Error("Invalid cart data");

    // ── Load settings server-side ──
    const settings = await getSettings();
    const cart     = sanitizeCart(rawCart, settings);
    const shippingMethod = shipping?.shipping_method || 'Standard Shipping';
    const { subtotal, shippingCost, taxAmount } = computeTotals(cart, settings, shippingMethod);

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

    // ── Metadata for fulfillment ──
    const eproloData    = cart.map(item => ({ variantsid: item.cj_variant_id || '' }));
    const imagesData    = cart.map(item => item.image  || '');
    const colorsData    = cart.map(item => item.color  || '');
    const sizesData     = cart.map(item => item.size   || '');
    const imagesVariant = cart.map(item => item.image  || '');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.BASE_URL}/thankyou.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.BASE_URL}/checkout.html`,
      metadata: {
        eprolo_data:    JSON.stringify(eproloData),
        shipping:       JSON.stringify(shipping),
        images:         JSON.stringify(imagesData),
        colors:         JSON.stringify(colorsData),
        sizes:          JSON.stringify(sizesData),
        images_variant: JSON.stringify(imagesVariant)
      }
    });

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