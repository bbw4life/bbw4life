process.removeAllListeners('warning');
const { google } = require('googleapis');
const webpush = require('web-push');

const REMINDER_THRESHOLD_MINUTES = 10;
const REMINDER_SCHEDULE_HOURS = [0, 1, 6, 24, 48, 72];
const MARKETING_INTERVAL_HOURS = 72;

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const SPREADSHEET_ID = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;
const TAB   = 'Push_Subscriptions';
const RANGE = `${TAB}!A:I`;
const BASE_URL = process.env.BASE_URL || 'https://bbw4life.com';
const LOGO_URL = `${BASE_URL}/public/bbw4life%20favicon.png`;
const CART_URL = `${BASE_URL}/?openCart=true`;

async function getSettings() {
  try {
    const res = await fetch(`${BASE_URL}/products.data.json`);
    const data = await res.json();
    return (Array.isArray(data) ? data : []).find(p => p.type === 'settings') || {};
  } catch (e) { return {}; }
}

function pickRandomPromo(settings) {
  const promos = settings.promos || [];
  if (!promos.length) return null;
  return promos[Math.floor(Math.random() * promos.length)];
}

// ── Messages marketing pour les abonnés sans panier ──
function pickMarketingMessage(settings) {
  const pool = settings.marketing_push_messages || [
    { body: "New arrivals just dropped 👑 Come see what's new!", url: '/collections/bbw4life-all-product.html' },
    { body: "Flash sale — up to 40% off today only! 🔥", url: '/collections/bbw4life-all-product.html' },
    { body: "Beauty Has No Sizes 💕 Your next favorite piece is waiting.", url: '/collections/bbw4life-all-product.html' }
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function getTabSheetId(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tab = meta.data.sheets.find(s => s.properties.title === TAB);
  return tab ? tab.properties.sheetId : null;
}

async function deleteRow(sheets, sheetId, rowIndex) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
        }
      }]
    }
  });
}

exports.handler = async () => {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const rows = res.data.values || [];

    if (rows.length <= 1) {
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    const settings = await getSettings();
    const now = new Date();
    let processed = 0;

    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const [deviceId, endpoint, p256dh, auth, cartJson, lastUpdatedStr, lastNotifiedStr, promoSent, notifyCountStr] = row;

      if (!endpoint) continue;

      let cart = [];
      try { cart = JSON.parse(cartJson || '[]'); } catch {}

      const notifyCount = parseInt(notifyCountStr) || 0;
      let payload = null;
      let promoCodeToStore = '';

      // ══════════════════════════════════
      //  CAS 1 — Panier avec produits
      // ══════════════════════════════════
      if (cart.length > 0) {
        const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;
        if (!lastUpdated) continue;

        const scheduleIdx = Math.min(notifyCount, REMINDER_SCHEDULE_HOURS.length - 1);
        const requiredGapHours = REMINDER_SCHEDULE_HOURS[scheduleIdx];

        if (notifyCount === 0) {
          const minutesSinceUpdate = (now - lastUpdated) / (1000 * 60);
          if (minutesSinceUpdate < REMINDER_THRESHOLD_MINUTES) continue;
        } else {
          if (!lastNotifiedStr) continue;
          const hoursSinceNotified = (now - new Date(lastNotifiedStr)) / (1000 * 60 * 60);
          if (hoursSinceNotified < requiredGapHours) continue;
        }

        const promo = pickRandomPromo(settings);
        promoCodeToStore = promo ? promo.code : '';
        const itemCount = cart.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0);

        const body = promo
          ? `You left ${itemCount} item(s) in your cart. Use code ${promo.code} for ${promo.percent}% off!`
          : `You left ${itemCount} item(s) in your cart. Come back and grab them before they're gone!`;

        payload = JSON.stringify({
          title: 'BBW4LIFE',
          body,
          icon:  LOGO_URL,
          badge: LOGO_URL,
          url:   CART_URL
        });

      // ══════════════════════════════════
      //  CAS 2 — Panier vide → marketing
      // ══════════════════════════════════
      } else {
        if (lastNotifiedStr) {
          const hoursSince = (now - new Date(lastNotifiedStr)) / (1000 * 60 * 60);
          if (hoursSince < MARKETING_INTERVAL_HOURS) continue;
        }

        const msg = pickMarketingMessage(settings);
        payload = JSON.stringify({
          title: 'BBW4LIFE',
          body:  msg.body,
          icon:  LOGO_URL,
          badge: LOGO_URL,
          url:   `${BASE_URL}${msg.url}`
        });
      }

      if (!payload) continue;

      const subscription = { endpoint, keys: { p256dh, auth } };

      try {
        await webpush.sendNotification(subscription, payload);
        processed++;

        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${TAB}!G${i + 1}:I${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[now.toISOString(), promoCodeToStore, notifyCount + 1]] }
        });
      } catch (err) {
        const statusCode = err.statusCode || (err.body && err.body.statusCode) || null;

        if (statusCode === 404 || statusCode === 410) {
          console.warn(`[send-cart-push-reminder] Subscription gone (${statusCode}) for ${deviceId} — deleting row.`);
          try {
            const sheetId = await getTabSheetId(sheets);
            if (sheetId !== null) await deleteRow(sheets, sheetId, i);
          } catch (delErr) {
            console.warn(`[send-cart-push-reminder] Could not delete row for ${deviceId}:`, delErr.message);
          }
        } else {
          console.warn(`[send-cart-push-reminder] Failed for ${deviceId} (status ${statusCode || 'unknown'}):`, err.message);
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${TAB}!G${i + 1}:G${i + 1}`,
              valueInputOption: 'RAW',
              resource: { values: [[now.toISOString()]] }
            });
          } catch (updErr) {}
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, processed }) };

  } catch (error) {
    console.error('[send-cart-push-reminder] ERROR:', error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};