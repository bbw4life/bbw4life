// netlify/functions/notify-email.js

const BASE_URL = process.env.BASE_URL || 'https://bbw4life.com';
const ENDPOINT = `${BASE_URL}/.netlify/functions/send-email-auto`;

async function notifyEmail(trigger, payload = {}) {
  if (!trigger) {
    console.warn('[notify-email] Missing trigger');
    return { success: false, error: 'Missing trigger' };
  }
  if (!payload.email || !payload.email.includes('@')) {
    console.warn(`[notify-email] Invalid email for trigger "${trigger}":`, payload.email);
    return { success: false, error: 'Invalid email' };
  }

  try {
    const res  = await fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ trigger, ...payload })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      console.warn(`[notify-email] ✗ "${trigger}" failed for ${payload.email}:`, JSON.stringify(data));
      return { success: false, error: data.error || `HTTP ${res.status}`, raw: data };
    }

    console.log(`[notify-email] ✓ "${trigger}" sent for ${payload.email}`);
    return { success: true, raw: data };

  } catch (e) {
    console.error(`[notify-email] ✗ "${trigger}" network error for ${payload.email}:`, e.message);
    return { success: false, error: e.message };
  }
}

// 2 — Account created
function notifyWelcome({ email, firstName }) {
  return notifyEmail('welcome', { email, firstName });
}

// 1 (part 1) — Order confirmed
function notifyOrderConfirm({ email, firstName, lastName, orderId, items, total, shippingAddress }) {
  return notifyEmail('order_confirm', { email, firstName, lastName, orderId, items, total, shippingAddress });
}

// 1 (part 2) — Tracking number available
function notifyOrderTracking({ email, firstName, lastName, orderId, trackingNumber, carrier }) {
  return notifyEmail('order_tracking', { email, firstName, lastName, orderId, trackingNumber, carrier });
}

// 3 — Newsletter sequence J+0
function notifyNewsletter1({ email, firstName }) {
  return notifyEmail('newsletter_1', { email, firstName });
}

// 3 — Newsletter sequence J+3
function notifyNewsletter2({ email, firstName }) {
  return notifyEmail('newsletter_2', { email, firstName });
}

// 3 — Newsletter sequence J+5
function notifyNewsletter3({ email, firstName }) {
  return notifyEmail('newsletter_3', { email, firstName });
}

// 3 — Newsletter sequence J+10 (already ordered)
function notifyNewsletter4Buyer({ email, firstName }) {
  return notifyEmail('newsletter_4_buyer', { email, firstName });
}

// 3 — Newsletter sequence J+10 (never ordered)
function notifyNewsletter4New({ email, firstName }) {
  return notifyEmail('newsletter_4_new', { email, firstName });
}

// 4 — Contact form received
function notifyContactReply({ email, firstName, lastName, subject, category }) {
  return notifyEmail('contact_reply', { email, firstName, lastName, subject, category });
}

// 5 — Product request received
function notifyPlanRequest({ email, firstName, lastName, program, productId, size, color }) {
  return notifyEmail('plan_request', { email, firstName, lastName, program, productId, size, color });
}

// 6 — Custom design request received
function notifyCustomProduct({ email, firstName, productTitle, productDesc }) {
  return notifyEmail('custom_product', { email, firstname: firstName, lastname: '', product_title: productTitle, product_desc: productDesc });
}

// 7 — Story submission confirmation
function notifyStoryReceived({ email, firstName }) {
  return notifyEmail('story_received', { email, firstName });
}

// 8 — Review response
function notifyReviewResponse({ email, firstName, title, text, productId }) {
  return notifyEmail('review_response', { email, firstName, title, text, productId });
}

// Abandoned cart recovery
function notifyCartAbandoned({ email, orderId, firstName, items, promoCode, promoPercent, restartLink }) {
  return notifyEmail('cart_abandoned', { email, orderId, firstName, items, promoCode, promoPercent, restartLink });
}

// Confirmation d'email après signup
function notifyConfirmEmail({ email, firstName, confirmToken }) {
  const confirmUrl = `${BASE_URL}/account.html?confirm_token=${encodeURIComponent(confirmToken)}&email=${encodeURIComponent(email)}`;
  return notifyEmail('confirm_account', { email, firstName, confirmUrl });
}

module.exports = {
  notifyEmail,
  notifyWelcome,
  notifyOrderConfirm,
  notifyOrderTracking,
  notifyNewsletter1,
  notifyNewsletter2,
  notifyNewsletter3,
  notifyNewsletter4Buyer,
  notifyNewsletter4New,
  notifyContactReply,
  notifyPlanRequest,
  notifyCustomProduct,
  notifyCartAbandoned,
  notifyStoryReceived,
  notifyReviewResponse,
  notifyConfirmEmail
};