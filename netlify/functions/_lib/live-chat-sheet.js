/* ══════════════════════════════════════════════════════
   LIVE CHAT — accès partagé à la feuille Google Sheets
   "bbw4life-live-chat". Utilisé par chat.js (création de
   session), telegram-webhook.js (réponses de l'agent) et
   get-live-chat-messages.js (polling frontend).

   Colonnes : chat_id | sender | message | timestamp | status | device_id
   - sender : "client" ou "agent"
   - status : posé sur la ligne "client" d'ouverture de session
     uniquement — "pending" tant qu'aucune réponse agent n'est
     arrivée, "answered" dès la première réponse, "closed" une
     fois la session clôturée (CHAT-xxx: CLOSE dans Telegram).
   - device_id : posé sur la ligne d'ouverture uniquement, permet
     au webhook Telegram de retrouver la Push_Subscriptions du
     bon visiteur pour le notifier (cf. telegram-webhook.js).
══════════════════════════════════════════════════════ */
const { google } = require('googleapis');

const SHEET_NAME = 'bbw4life-live-chat';
const HEADERS = ['chat_id', 'sender', 'message', 'timestamp', 'status', 'device_id'];

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

function getSpreadsheetId() {
  return process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;
}

// ── Cache : une fois l'onglet confirmé existant sur ce process, on ne
//    refait plus jamais l'appel sheets.spreadsheets.get() qui suit. Avant ce
//    cache, CHAQUE message client (appendLiveChatRow) ET CHAQUE poll
//    automatique du frontend (toutes les 4s tant qu'un chat est ouvert, via
//    getAllLiveChatRows/setLiveChatStatus) déclenchait un appel Google
//    Sheets rien que pour vérifier l'existence de l'onglet — alors qu'il
//    n'est créé qu'une seule fois dans la vie du projet. Avec plusieurs
//    sessions de chat actives en parallèle, ça consomme vite le quota
//    "Read requests per minute" de Google Sheets API et peut faire échouer
//    silencieusement certains messages/mises à jour de statut. ──
let _sheetConfirmedExisting = false;

async function ensureLiveChatSheet(sheets, spreadsheetId) {
  if (_sheetConfirmedExisting) return;
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const exists = (meta.data.sheets || []).some(s => s.properties.title === SHEET_NAME);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:F1`,
        valueInputOption: 'RAW',
        resource: { values: [HEADERS] }
      });
    }
    _sheetConfirmedExisting = true;
  } catch (e) {
    console.error('[live-chat] ensureLiveChatSheet FAILED:', e.message);
    throw e;
  }
}

function generateChatId() {
  return 'CHAT-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Ajoute une ligne à la feuille live chat.
 * @param {'client'|'agent'} sender
 * @param {string|null} status — posé uniquement sur les lignes pertinentes
 *   (ex: la ligne d'ouverture côté client) ; laisser vide sinon.
 * @param {string|null} deviceId — posé uniquement sur la ligne d'ouverture.
 */
async function appendLiveChatRow(chatId, sender, message, status = '', deviceId = '') {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureLiveChatSheet(sheets, spreadsheetId);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:F`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [[chatId, sender, message, new Date().toISOString(), status, deviceId]] }
  });
}

/** Renvoie toutes les lignes (hors header) de la feuille live chat. */
async function getAllLiveChatRows() {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureLiveChatSheet(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A2:F` });
  return res.data.values || [];
}

/** Renvoie toutes les lignes pour un chat_id donné, dans l'ordre chronologique. */
async function getLiveChatRowsFor(chatId) {
  const rows = await getAllLiveChatRows();
  return rows.filter(r => r[0] === chatId);
}

/**
 * Marque le statut de la session (posé sur la ligne d'ouverture, celle
 * qui a chat_id + sender="client" + un status non vide dans la colonne E).
 * Réécrit uniquement la colonne E de cette ligne précise.
 *
 * ⚠️ FILET DE SÉCURITÉ : si la ligne d'ouverture est introuvable (parce que
 * son écriture initiale — appendLiveChatRow(..., 'pending', ...) dans
 * chat.js — a échoué silencieusement, ex: quota Google Sheets momentanément
 * dépassé), on n'échoue plus silencieusement : on recrée cette ligne
 * manquante avec le statut demandé. Sans ça, toute la session reste bloquée
 * pour toujours (le client ne voit jamais "answered"/"closed", CLOSE ne
 * fonctionne jamais), alors que les messages agent/client individuels,
 * eux, continuent d'être écrits normalement.
 */
async function setLiveChatStatus(chatId, status) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureLiveChatSheet(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A2:F` });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === chatId && (r[4] || '').length > 0);

  if (rowIndex === -1) {
    console.warn(`[live-chat] setLiveChatStatus: ligne d'ouverture introuvable pour ${chatId} — recréation avec status="${status}"`);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [[chatId, 'client', '[Session recovered]', new Date().toISOString(), status, '']] }
    });
    return true;
  }

  const rowNum = rowIndex + 2; // +2 : offset header + index 0-based → 1-based
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!E${rowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [[status]] }
  });
  return true;
}

/** Renvoie le statut actuel de la session (pending/answered/closed), ou null si inconnue. */
async function findOpenStatusFor(chatId) {
  const rows = await getAllLiveChatRows();
  const statusRows = rows.filter(r => r[0] === chatId && (r[4] || '').length > 0);
  if (!statusRows.length) return null;
  return statusRows[statusRows.length - 1][4];
}

/** Renvoie le device_id posé sur la ligne d'ouverture de session, ou null. */
async function getDeviceIdFor(chatId) {
  const rows = await getAllLiveChatRows();
  const openingRow = rows.find(r => r[0] === chatId && (r[4] || '').length > 0);
  return openingRow && openingRow[5] ? openingRow[5] : null;
}

module.exports = {
  SHEET_NAME,
  getSheetsClient,
  getSpreadsheetId,
  ensureLiveChatSheet,
  generateChatId,
  appendLiveChatRow,
  getAllLiveChatRows,
  getLiveChatRowsFor,
  setLiveChatStatus,
  findOpenStatusFor,
  getDeviceIdFor
};
