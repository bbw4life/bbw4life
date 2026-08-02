// validate-checkout.js
process.removeAllListeners('warning');
const { getAllProductsData, computeServerTotal, generateCartToken, verifyCartToken } = require('./_lib/pricing');

const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function getClientIp(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT_MAP.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  RATE_LIMIT_MAP.set(ip, entry);
  return false;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validateShipping(shipping) {
  const errors = [];
  if (!shipping.firstName?.trim())  errors.push('First name required');
  if (!shipping.lastName?.trim())   errors.push('Last name required');
  if (!shipping.email?.trim())      errors.push('Email required');
  if (!validateEmail(shipping.email)) errors.push('Invalid email format');
  if (!shipping.address?.trim())    errors.push('Address required');
  if (!shipping.city?.trim())       errors.push('City required');
  if (!shipping.countryCode?.trim()) errors.push('Country required');
  return errors;
}

function validateCart(cart) {
  const errors = [];
  if (!Array.isArray(cart) || cart.length === 0) {
    errors.push('Cart is empty');
    return errors;
  }
  cart.forEach((item, i) => {
    const price = parseFloat(item.price);
    const qty   = parseInt(item.quantity);
    if (!item.title?.trim())       errors.push(`Item ${i+1}: missing title`);
    if (isNaN(price) || price < 0) errors.push(`Item ${i+1}: invalid price`);
    if (isNaN(qty)   || qty < 1)   errors.push(`Item ${i+1}: invalid quantity`);
    if (qty > 99)                  errors.push(`Item ${i+1}: quantity too high`);
  });
  return errors;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return res(405, { success: false, error: 'Method not allowed' });
  }

  const ip = getClientIp(event);
  if (isRateLimited(ip)) {
    return res(429, { success: false, error: 'Too many requests. Please wait a moment.' });
  }

  try {
    if (!event.body) return res(400, { success: false, error: 'No data received' });

    const { action, cart, shipping, shippingMethod, clientTotal, cartToken, promoCode } = JSON.parse(event.body);

    if (action === 'validate') {
      const shippingErrors = validateShipping(shipping || {});
      const cartErrors     = validateCart(cart || []);
      const allErrors      = [...shippingErrors, ...cartErrors];

      if (allErrors.length > 0) {
        return res(400, { success: false, errors: allErrors });
      }

      const allProducts = await getAllProductsData();
      const settings    = allProducts.find(p => p.type === 'settings') || {};

      const { subtotal, shippingCost, taxAmount, discountAmount, total, sanitizedCart } = await computeServerTotal(
        cart,
        settings,
        allProducts,
        shippingMethod || 'Standard Shipping',
        promoCode || null
      );

      if (clientTotal !== undefined) {
        const clientTotalRounded = parseFloat(parseFloat(clientTotal).toFixed(2));
        const diff = Math.abs(clientTotalRounded - total);
        if (diff > 0.10) {
          console.warn(`[CHECKOUT SECURITY] Price mismatch — client: $${clientTotal} | server: $${total} | IP: ${ip}`);
          console.warn(`[CHECKOUT SECURITY DEBUG] promoCode="${promoCode}" shippingMethod="${shippingMethod}" subtotal=${subtotal} shippingCost=${shippingCost} taxAmount=${taxAmount} discountAmount=${discountAmount}`);
          console.warn(`[CHECKOUT SECURITY DEBUG] cart=${JSON.stringify(cart)}`);
          return res(400, {
            success: false,
            error: 'Price mismatch detected. Please refresh and try again.',
            serverTotal: total
          });
        }
      }

      const token = generateCartToken(sanitizedCart, total, process.env.CHECKOUT_SECRET);

      return res(200, {
        success: true,
        subtotal,
        shippingCost,
        taxAmount,
        discountAmount,
        total,
        cartToken: token,
        sanitizedCart
      });
    }

    if (action === 'verify-token') {
      if (!cart || !cartToken || clientTotal === undefined) {
        return res(400, { success: false, error: 'Missing data for token verification' });
      }

      const allProducts = await getAllProductsData();
      const settings    = allProducts.find(p => p.type === 'settings') || {};

      const { total, sanitizedCart } = await computeServerTotal(cart, settings, allProducts, shippingMethod || 'Standard Shipping', promoCode || null);

      let valid = false;
      try {
        valid = verifyCartToken(sanitizedCart, total, cartToken, process.env.CHECKOUT_SECRET);
      } catch {
        valid = false;
      }

      if (!valid) {
        console.warn(`[CHECKOUT SECURITY] Invalid cart token — IP: ${ip}`);
        return res(400, { success: false, error: 'Cart integrity check failed. Please refresh and try again.' });
      }

      return res(200, { success: true, total, sanitizedCart });
    }

    return res(400, { success: false, error: 'Unknown action' });

  } catch (err) {
    console.error('[VALIDATE-CHECKOUT ERROR]', err.message);
    return res(500, { success: false, error: 'Internal server error' });
  }
};

function res(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}