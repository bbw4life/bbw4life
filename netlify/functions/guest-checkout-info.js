// netlify/functions/guest-checkout-info.js
// Sauvegarde/restauration des infos de checkout pour un client NON connecté
// ("Save this information for next time" côté invité). Identifié uniquement
// par un guestId généré côté client (localStorage) — sans compte, sans mot
// de passe. Si le client vide son cache, le guestId disparaît et sa ligne
// devient définitivement inatteignable : à la demande, on la supprime alors
// du sheet dès qu'on détecte cet état (action 'clear').
process.removeAllListeners('warning');
const { google } = require("googleapis");

const SHEET_NAME = "Guest_Saved_Info";
const SHEET_RANGE = `${SHEET_NAME}!A:C`;

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

const SPREADSHEET_ID = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;

async function ensureSheetExists(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets || []).some(s => s.properties.title === SHEET_NAME);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:C1`,
    valueInputOption: 'RAW',
    resource: { values: [['guest_id', 'info_json', 'updated_at']] }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action, guestId, info } = body;
    if (!guestId) throw new Error("guestId required");

    const sheets = getSheetsClient();
    await ensureSheetExists(sheets);

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SHEET_RANGE });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => (row[0] || '') === guestId);
    const rowNum = rowIndex + 1;

    // ==================== SAVE ====================
    if (action === 'save') {
      if (!info) throw new Error("info required");
      const nowIso = new Date().toISOString();

      if (rowIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!B${rowNum}:C${rowNum}`,
          valueInputOption: 'RAW',
          resource: { values: [[JSON.stringify(info), nowIso]] }
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_RANGE,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [[guestId, JSON.stringify(info), nowIso]] }
        });
      }
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== GET ====================
    if (action === 'get') {
      if (rowIndex === -1) {
        return { statusCode: 200, body: JSON.stringify({ success: true, info: null }) };
      }
      let info = null;
      try { info = JSON.parse(rows[rowIndex][1] || 'null'); } catch (e) {}
      return { statusCode: 200, body: JSON.stringify({ success: true, info }) };
    }

    // ==================== CLEAR ====================
    // Appelé quand le client revient sans guestId retrouvé en localStorage
    // (cache vidé) — supprime toute ligne orpheline correspondant à l'ancien
    // guestId qu'il nous redonne une dernière fois avant de le regénérer.
    if (action === 'clear') {
      if (rowIndex === -1) {
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      }
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties' }))
                  .data.sheets.find(s => s.properties.title === SHEET_NAME).properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }]
        }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("GUEST CHECKOUT INFO ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
