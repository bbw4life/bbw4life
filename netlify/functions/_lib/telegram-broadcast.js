/* ══════════════════════════════════════════════════════
   TELEGRAM BROADCAST — helpers partagés pour les notifications
   automatiques envoyées aux clients ayant lié leur compte
   BBW4LIFE à Telegram (colonne AK de bbw4life-accounts).

   - getTelegramSubscribers() : liste { firstName, chatId } pour
     chaque compte avec un TelegramChatId non vide.
   - getNewArrivalsCursor() / advanceNewArrivalsCursor() : position
     du cycle de rotation des nouveautés (3 produits tous les
     3 jours, boucle une fois la collection épuisée), stockée
     dans un onglet dédié "bbw4life-telegram-cursor".
   - sendTelegramPhoto() : envoie une photo distante (URL) avec
     légende — Telegram télécharge l'image lui-même, pas besoin
     de la rapatrier côté serveur.
   - getSettings() : recharge products.data.json (settings + liste
     de produits) pour construire les cartes produit.
══════════════════════════════════════════════════════ */
const { google } = require('googleapis');

const BASE_URL = process.env.BASE_URL || 'https://bbw4life.com';
const CURSOR_SHEET = 'bbw4life-telegram-cursor';
const CURSOR_HEADERS = ['key', 'value'];

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

function getAccountsSpreadsheetId() {
  return process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;
}

async function getSettings() {
  try {
    const res = await fetch(`${BASE_URL}/products.data.json`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    const settings = list.find(p => p.type === 'settings') || {};
    const products = list.filter(p => p.id && p.active !== false);
    return { settings, products };
  } catch (e) {
    console.warn('[telegram-broadcast] getSettings failed:', e.message);
    return { settings: {}, products: [] };
  }
}

/** Comptes avec un TelegramChatId rempli (colonne AK). */
async function getTelegramSubscribers() {
  const sheets = getSheetsClient();
  const spreadsheetId = getAccountsSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'bbw4life-accounts!B:AK' // B=firstName ... AK=telegram_chat_id
  });
  const rows = res.data.values || [];
  const subs = [];
  for (const row of rows) {
    const firstName = (row[0] || '').trim();  // B
    const chatId = (row[35] || '').trim();    // AK - B = index 35
    if (chatId) subs.push({ firstName: firstName || 'there', chatId });
  }
  return subs;
}

async function ensureCursorSheet(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets || []).some(s => s.properties.title === CURSOR_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: [{ addSheet: { properties: { title: CURSOR_SHEET } } }] }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${CURSOR_SHEET}!A1:B1`,
      valueInputOption: 'RAW',
      resource: { values: [CURSOR_HEADERS] }
    });
  }
}

async function getCursorValue(key, defaultValue = 0) {
  const sheets = getSheetsClient();
  const spreadsheetId = getAccountsSpreadsheetId();
  await ensureCursorSheet(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${CURSOR_SHEET}!A2:B` });
  const rows = res.data.values || [];
  const row = rows.find(r => r[0] === key);
  return row ? parseInt(row[1], 10) || defaultValue : defaultValue;
}

async function setCursorValue(key, value) {
  const sheets = getSheetsClient();
  const spreadsheetId = getAccountsSpreadsheetId();
  await ensureCursorSheet(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${CURSOR_SHEET}!A2:B` });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === key);

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${CURSOR_SHEET}!A:B`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [[key, String(value)]] }
    });
  } else {
    const rowNum = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${CURSOR_SHEET}!B${rowNum}`,
      valueInputOption: 'RAW',
      resource: { values: [[String(value)]] }
    });
  }
}

/** Renvoie les 3 prochains produits du cycle "New Arrivals" et avance le curseur. */
async function getNextNewArrivalsBatch(productIds, batchSize = 3) {
  if (!productIds.length) return [];
  const cursor = await getCursorValue('new_arrivals_cursor', 0);
  const start = cursor % productIds.length;

  const batch = [];
  for (let i = 0; i < batchSize && i < productIds.length; i++) {
    batch.push(productIds[(start + i) % productIds.length]);
  }

  const nextCursor = (start + batchSize) % productIds.length;
  await setCursorValue('new_arrivals_cursor', nextCursor);

  return batch;
}

async function sendTelegramPhoto(chatId, photoUrl, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' })
    });
    if (!res.ok) {
      console.warn('[telegram-broadcast] sendPhoto failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[telegram-broadcast] sendPhoto error:', e.message);
  }
}

async function sendTelegramMessage(chatId, text, replyMarkup) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn('[telegram-broadcast] sendMessage failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[telegram-broadcast] sendMessage error:', e.message);
  }
}

module.exports = {
  BASE_URL,
  getSettings,
  getTelegramSubscribers,
  getNextNewArrivalsBatch,
  getCursorValue,
  setCursorValue,
  sendTelegramPhoto,
  sendTelegramMessage
};
