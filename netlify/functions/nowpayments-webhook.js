process.removeAllListeners('warning');
const crypto = require('crypto');
const fetch  = require('node-fetch');
const { getAndDeleteTempOrder } = require('./temp-orders-store');

const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return res(405, { error: 'Method not allowed' });
    }

    const body = JSON.parse(event.body || '{}');

    // ── Vérification signature IPN ──
    const signature = event.headers['x-nowpayments-sig'];
    if (signature && IPN_SECRET) {
      const sortedBody = JSON.stringify(sortObject(body));
      const hmac = crypto
        .createHmac('sha512', IPN_SECRET)
        .update(sortedBody)
        .digest('hex');

      if (hmac !== signature) {
        console.error('[NOWPAYMENTS WEBHOOK] Invalid signature');
        return res(401, { error: 'Invalid signature' });
      }
    }

    console.log('[NOWPAYMENTS WEBHOOK] Payment status:', body.payment_status, '| Order:', body.order_id);

    // ── Seulement traiter les paiements confirmés ──
    const confirmedStatuses = ['finished', 'confirmed', 'complete'];
    if (!confirmedStatuses.includes(body.payment_status)) {
      console.log(`[NOWPAYMENTS WEBHOOK] Status ${body.payment_status} — skipping`);
      return res(200, { received: true });
    }

    const BASE_SITE = process.env.BASE_URL || 'https://bbw4lifee.netlify.app';
    const orderId   = body.order_id;

    // ── Récupérer cart + shipping depuis le Sheet temporaire ──
    let cart     = [];
    let shipping = {};
    try {
      const tempOrder = await getAndDeleteTempOrder(orderId);
      if (!tempOrder) {
        console.error('[NOWPAYMENTS WEBHOOK] No temp order found for orderId:', orderId);
        return res(404, { error: 'Order data not found' });
      }
      cart     = tempOrder.cart     || [];
      shipping = tempOrder.shipping || {};
      console.log('[NOWPAYMENTS WEBHOOK] Cart + shipping récupérés | items:', cart.length);
    } catch (e) {
      console.error('[NOWPAYMENTS WEBHOOK] Failed to retrieve temp order:', e.message);
      return res(500, { error: 'Could not retrieve order data' });
    }

    // ── Appeler verify-payment avec cart + shipping ──
    // Fix: verify-payment.js lit `orderID` (pas `paymentId`) pour NOWPayments
    try {
      await fetch(`${BASE_SITE}/.netlify/functions/verify-payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          provider:    'nowpayments',
          orderID:     orderId,
          cart,
          shipping,
          totalAmount: body.price_amount
        })
      });
      console.log('[NOWPAYMENTS WEBHOOK] verify-payment appelé avec succès');
    } catch (e) {
      console.error('[NOWPAYMENTS WEBHOOK] verify-payment failed:', e.message);
    }

    // ── Notifier Telegram ──
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'HTML',
          text: `💎 <b>Pdg Francenel,Un Paiement avec Crypto Confirmé!</b>\n\n` +
                `🔢 <b>Order:</b> ${orderId}\n` +
                `💰 <b>Montant:</b> $${body.price_amount} USD\n` +
                `🪙 <b>Crypto:</b> ${body.pay_amount} ${body.pay_currency?.toUpperCase()}\n` +
                `✅ <b>Status:</b> ${body.payment_status}\n\n` +
                `👑 <i>BBW4LIFE — Beauty Has No Sizes</i>`
        })
      });
    } catch (e) {
      console.warn('[NOWPAYMENTS WEBHOOK] Telegram notify failed:', e.message);
    }

    return res(200, { received: true });

  } catch (err) {
    console.error('[NOWPAYMENTS WEBHOOK] Fatal:', err.message);
    return res(500, { error: 'Internal server error' });
  }
};

function sortObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = sortObject(obj[key]);
    return sorted;
  }, {});
}

function res(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}