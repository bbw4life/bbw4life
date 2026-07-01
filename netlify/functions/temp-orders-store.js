// temp-orders-store.js
process.removeAllListeners('warning');
const { google } = require('googleapis');

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;
const SHEET_TAB       = "Temp_Orders";
const SHEET_RANGE     = `${SHEET_TAB}!A:D`;

// ── Onglet dédié au marquage anti-doublon (même spreadsheet) ──
const PROCESSED_TAB   = "Processed_Orders";
const PROCESSED_RANGE = `${PROCESSED_TAB}!A:B`;

// ── Crée l'onglet Processed_Orders s'il n'existe pas encore ──
async function ensureProcessedTabExists(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === PROCESSED_TAB);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        addSheet: { properties: { title: PROCESSED_TAB } }
      }]
    }
  });
  console.log(`[TEMP ORDERS] Onglet "${PROCESSED_TAB}" créé`);
}

// ── Écrit cart + shipping dans le sheet temporaire, identifié par orderId ──
async function saveTempOrder(orderId, cart, shipping) {
  const sheets = getSheetsClient();
  const now = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [[
        orderId,
        JSON.stringify(cart),
        JSON.stringify(shipping),
        now
      ]]
    }
  });
}

// ── Récupère cart + shipping par orderId, puis supprime immédiatement la ligne ──
async function getAndDeleteTempOrder(orderId) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_RANGE
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === orderId);

  if (rowIndex === -1) return null;

  const [, cartJson, shippingJson] = rows[rowIndex];
  const cart     = JSON.parse(cartJson     || "[]");
  const shipping = JSON.parse(shippingJson || "{}");

  // ── Nettoyage immédiat : suppression de la ligne ──
  try {
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetObj  = sheetMeta.data.sheets.find(s => s.properties.title === SHEET_TAB);
    const sheetId   = sheetObj ? sheetObj.properties.sheetId : 0;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }]
      }
    });
  } catch (e) {
    console.error("[TEMP ORDERS] Échec suppression ligne:", e.message);
  }

  return { cart, shipping };
}


// ── Supprime la ligne Temp_Orders correspondant à un orderId, sans la retourner ──
async function deleteTempOrderByPaymentId(orderId) {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_RANGE
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === orderId);
  if (rowIndex === -1) return false;

  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetObj  = sheetMeta.data.sheets.find(s => s.properties.title === SHEET_TAB);
  const sheetId   = sheetObj ? sheetObj.properties.sheetId : 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });
  return true;
}


// ── Vérifie si paymentId a déjà été traité (lecture fiable, onglet dédié) ──
async function isOrderAlreadyProcessed(paymentId) {
  const sheets = getSheetsClient();
  try {
    await ensureProcessedTabExists(sheets);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: PROCESSED_RANGE
    });
    const rows = res.data.values || [];
    return rows.some(row => row[0] === paymentId);
  } catch (e) {
    console.error("[TEMP ORDERS] Erreur vérification doublon:", e.message);
    // En cas d'erreur de lecture, on ne bloque pas le paiement légitime,
    // mais on log clairement pour investigation.
    return false;
  }
}

// ── Marque paymentId comme traité (écriture fiable, onglet dédié) ──
async function markOrderAsProcessed(paymentId) {
  const sheets = getSheetsClient();
  try {
    await ensureProcessedTabExists(sheets);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: PROCESSED_RANGE,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [[paymentId, new Date().toISOString()]]
      }
    });
    return true;
  } catch (e) {
    console.error("[TEMP ORDERS] Échec marquage doublon:", e.message);
    return false;
  }
}

module.exports = {
  saveTempOrder,
  getAndDeleteTempOrder,
  deleteTempOrderByPaymentId,
  isOrderAlreadyProcessed,
  markOrderAsProcessed
};