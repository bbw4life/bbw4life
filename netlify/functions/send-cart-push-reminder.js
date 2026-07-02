process.removeAllListeners('warning');
const { google } = require('googleapis');
const webpush = require('web-push');

const REMINDER_THRESHOLD_MINUTES = 20;
const RENOTIFY_COOLDOWN_HOURS    = 24;

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
const RANGE = `${TAB}!A:H`;
const BASE_URL = process.env.BASE_URL || 'https://bbw4life.com';

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

async function getTabSheetId(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tab = meta.data.sheets.find(s => s.properties.title === TAB);
  return tab ? tab.properties.sheetId : null;
}

async function deleteRow(sheets, sheetId, rowIndex) {
  // rowIndex is 0-based sheet row (row 0 = header). We pass the actual sheet row number (0-based).
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
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

    // On traite de bas en haut pour que la suppression de lignes ne décale pas les index restants à traiter
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const [deviceId, endpoint, p256dh, auth, cartJson, lastUpdatedStr, lastNotifiedStr] = row;

      if (!endpoint || !cartJson) continue;

      let cart = [];
      try { cart = JSON.parse(cartJson); } catch {}
      if (!cart.length) continue;

      const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;
      if (!lastUpdated) continue;
      const minutesSinceUpdate = (now - lastUpdated) / (1000 * 60);
      if (minutesSinceUpdate < REMINDER_THRESHOLD_MINUTES) continue;

      if (lastNotifiedStr) {
        const hoursSinceNotified = (now - new Date(lastNotifiedStr)) / (1000 * 60 * 60);
        if (hoursSinceNotified < RENOTIFY_COOLDOWN_HOURS) continue;
      }

      const promo = pickRandomPromo(settings);
      const itemCount = cart.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0);

      const body = promo
        ? `You left ${itemCount} item(s) in your cart. Use code ${promo.code} for ${promo.percent}% off!`
        : `You left ${itemCount} item(s) in your cart. Come back and grab them before they're gone!`;

      const payload = JSON.stringify({
        title: 'BBW4LIFE',
        body,
        icon:  `${BASE_URL}/vrlogo-bbw4life.png`,
        badge: `${BASE_URL}/vrlogo-bbw4life.png`,
        url:   `${BASE_URL}/checkout/checkout.html`
      });

      const subscription = { endpoint, keys: { p256dh, auth } };

      try {
        await webpush.sendNotification(subscription, payload);
        processed++;

        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${TAB}!G${i + 1}:H${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[now.toISOString(), promo ? promo.code : '']] }
        });
      } catch (err) {
        const statusCode = err.statusCode || (err.body && err.body.statusCode) || null;

        if (statusCode === 404 || statusCode === 410) {
          // Abonnement mort → on supprime la ligne définitivement
          console.warn(`[send-cart-push-reminder] Subscription gone (${statusCode}) for ${deviceId} — deleting row.`);
          try {
            const sheetId = await getTabSheetId(sheets);
            if (sheetId !== null) await deleteRow(sheets, sheetId, i);
          } catch (delErr) {
            console.warn(`[send-cart-push-reminder] Could not delete row for ${deviceId}:`, delErr.message);
          }
        } else {
          // Autre erreur → on marque quand même Last Notified pour éviter de re-spammer toutes les 15 min
          console.warn(`[send-cart-push-reminder] Failed for ${deviceId} (status ${statusCode || 'unknown'}):`, err.message);
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${TAB}!G${i + 1}:G${i + 1}`,
              valueInputOption: 'RAW',
              resource: { values: [[now.toISOString()]] }
            });
          } catch (updErr) {
            console.warn(`[send-cart-push-reminder] Could not update Last Notified for ${deviceId}:`, updErr.message);
          }
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