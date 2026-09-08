// _lib/order-number.js
// Numéro de commande propre et séquentiel (BBW-100001, BBW-100002, ...)
// envoyé au CLIENT (email, Telegram) — distinct du payment_id Stripe/PayPal
// (cs_test_..., 6KA5632...) qui reste inchangé en colonne C du sheet, pour
// la traçabilité interne. Même principe de compteur persistant déjà utilisé
// ailleurs dans le code (rotation Telegram "New Arrivals",
// _lib/telegram-broadcast.js), appliqué ici à la feuille des commandes.
process.removeAllListeners('warning');
const { google } = require('googleapis');

const COUNTER_SHEET  = 'bbw4life-order-counter';
const COUNTER_HEADERS = ['key', 'value'];
const START_AT = 100000; // premier numéro généré : BBW-100001

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

async function ensureCounterSheet(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets || []).some(s => s.properties.title === COUNTER_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: [{ addSheet: { properties: { title: COUNTER_SHEET } } }] }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${COUNTER_SHEET}!A1:B1`,
      valueInputOption: 'RAW',
      resource: { values: [COUNTER_HEADERS] }
    });
  }
}

/** Lit le compteur actuel, l'incrémente de 1, sauvegarde, renvoie "BBW-100001".
 *  Pas d'incrémentation atomique garantie (lire-puis-écrire, même limite que
 *  le curseur Telegram existant) — acceptable au volume de commandes actuel. */
async function getNextOrderNumber() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;
  await ensureCounterSheet(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${COUNTER_SHEET}!A2:B` });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === 'order_number');
  const current = rowIndex !== -1 ? (parseInt(rows[rowIndex][1], 10) || START_AT) : START_AT;
  const next = current + 1;

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${COUNTER_SHEET}!A:B`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [['order_number', String(next)]] }
    });
  } else {
    const rowNum = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${COUNTER_SHEET}!B${rowNum}`,
      valueInputOption: 'RAW',
      resource: { values: [[String(next)]] }
    });
  }

  return `BBW-${next}`;
}

module.exports = { getNextOrderNumber };
