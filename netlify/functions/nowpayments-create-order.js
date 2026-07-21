process.removeAllListeners('warning');
const https = require('https');
const { saveTempOrder } = require('./temp-orders-store');
const { getAllProductsData, computeServerTotal } = require('./_lib/pricing');

// ── Mode LIVE ──
const BASE_URL_NOW = 'api.nowpayments.io';
const API_KEY      = process.env.NOWPAYMENTS_API_KEY;

// ── HTTPS POST helper ──
function httpsPost(hostname, path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };
    const req = https.request(options, (response) => {
      let raw = '';
      response.on('data', chunk => raw += chunk);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: response.statusCode, data: {} }); }
      });
    });
    req.on('error', (err) => {
      console.error('[NOWPAYMENTS] HTTPS error:', err.message);
      reject(err);
    });
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('NOWPayments request timeout'));
    });
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  try {
    if (!event.body) return res(400, { success: false, error: 'No data received' });

    const { cart: rawCart, shipping, promoCode, clientTotal } = JSON.parse(event.body);

    if (!Array.isArray(rawCart) || rawCart.length === 0) {
      return res(400, { success: false, error: 'Cart empty' });
    }

    if (!API_KEY) {
      console.error('[NOWPAYMENTS] Missing API key');
      return res(500, { success: false, error: 'NOWPayments not configured' });
    }

    console.log(`[NOWPAYMENTS] Mode: LIVE | Host: ${BASE_URL_NOW}`);

    // ── Recalcul du prix EXCLUSIVEMENT côté serveur (jamais les prix/shipping/tax bruts du client) ──
    const allProducts    = await getAllProductsData();
    const settings       = allProducts.find(p => p.type === 'settings') || {};
    const shippingMethod = shipping?.shipping_method || 'Standard Shipping';

    const { total, sanitizedCart } = computeServerTotal(
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
        console.warn(`[NOWPAYMENTS SECURITY] Price mismatch — client: $${clientTotal} | server: $${total}`);
        return res(400, { success: false, error: 'Price mismatch detected. Please refresh and try again.' });
      }
    }

    const cart = sanitizedCart;
    const totalAmount = total;

    const BASE_SITE  = process.env.BASE_URL || 'https://bbw4lifee.netlify.app';
    const orderId    = `BBW-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const orderTitle = cart.length === 1
      ? cart[0].title.substring(0, 100)
      : `BBW4LIFE — ${cart.length} articles`;

    // ── Stocker cart + shipping dans le Sheet temporaire (clé = orderId) ──
    await saveTempOrder(orderId, cart, shipping);
    console.log('[NOWPAYMENTS] Temp order saved | orderId:', orderId);

    const invoiceBody = {
      price_amount:        totalAmount,
      price_currency:      'usd',
      order_id:            orderId,
      order_description:   orderTitle,
      ipn_callback_url:    `${BASE_SITE}/.netlify/functions/nowpayments-webhook`,
      success_url:         `${BASE_SITE}/thankyou.html?provider=nowpayments&orderId=${orderId}`,
      cancel_url:          `${BASE_SITE}/checkout.html`,
      is_fixed_rate:       false,
      is_fee_paid_by_user: false,
    };

    console.log('[NOWPAYMENTS] Creating invoice:', orderId, '| Amount:', totalAmount, 'USD');

    const result = await httpsPost(
      BASE_URL_NOW,
      '/v1/invoice',
      invoiceBody,
      { 'x-api-key': API_KEY }
    );

    console.log('[NOWPAYMENTS] Response status:', result.status);

    if (result.status !== 200 || !result.data.invoice_url) {
      console.error('[NOWPAYMENTS] Error response:', JSON.stringify(result.data));
      return res(500, {
        success: false,
        error: result.data?.message || result.data?.error || 'NOWPayments invoice creation failed'
      });
    }

    console.log('[NOWPAYMENTS] Invoice created:', result.data.id);

    return res(200, {
      success:    true,
      invoiceUrl: result.data.invoice_url,
      orderId,
      paymentId:  result.data.id,
    });

  } catch (err) {
    console.error('[NOWPAYMENTS] Fatal:', err.message);
    return res(500, { success: false, error: err.message || 'Internal server error' });
  }
};

function res(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}