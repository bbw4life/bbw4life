process.removeAllListeners('warning');
const { google } = require('googleapis');

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

async function ensureTabExists(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === TAB);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests: [{ addSheet: { properties: { title: TAB } } }] }
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[
        'Device ID', 'Endpoint', 'P256dh', 'Auth',
        'Cart JSON', 'Last Updated', 'Last Notified', 'Promo Sent'
      ]]
    }
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const body = JSON.parse(event.body);
    const { deviceId, subscription, cart } = body;

    if (!deviceId || !subscription || !subscription.endpoint) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing deviceId or subscription' }) };
    }

    const sheets = getSheetsClient();
    await ensureTabExists(sheets);

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const rows = res.data.values || [];

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === deviceId) { rowIndex = i; break; }
    }

    const rowValues = [
      deviceId,
      subscription.endpoint,
      subscription.keys ? subscription.keys.p256dh : '',
      subscription.keys ? subscription.keys.auth   : '',
      JSON.stringify(cart || []),
      new Date().toISOString(),
      rowIndex !== -1 ? (rows[rowIndex][6] || '') : '',
      rowIndex !== -1 ? (rows[rowIndex][7] || '') : ''
    ];

    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [rowValues] }
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${TAB}!A${rowIndex + 1}:H${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [rowValues] }
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error('[save-push-subscription] Error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};