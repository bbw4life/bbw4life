// netlify/functions/create-reservation-paypal.js
// action=create  → crée l'ordre PayPal
// action=capture → capture le paiement ET sauvegarde dans le sheet

const fetch      = require('node-fetch');
const { google } = require('googleapis');

async function getPaypalToken(PAYPAL_BASE) {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString('base64');

  const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) throw new Error('Failed to get PayPal token');
  const { access_token } = await tokenRes.json();
  return access_token;
}

async function saveToSheet(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets        = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_PENDING_PLAN;

  function formatDate() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:            'bbw4life-pending-plan!A:I',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[
        formatDate(),
        data.firstName || '',
        data.lastName  || '',
        data.email     || '',
        data.phone     || '',
        data.program   || '',
        'Yes',
        data.amount    || '',
        'PayPal - Paid'
      ]]
    },
  });
}

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error('No data received');

    const body   = JSON.parse(event.body);
    const action = body.action || 'create';

    const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // ════════════════════════════════
    // ACTION : create — crée l'ordre
    // ════════════════════════════════
    if (action === 'create') {
      const { amount, program, customer } = body;

      const BASE_URL     = process.env.BASE_URL || '';
      const access_token = await getPaypalToken(PAYPAL_BASE);

      const orderBody = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: parseFloat(amount).toFixed(2),
          },
          description: `CurvaFit Reservation — ${program || 'Program'}`,
          custom_id:   `${customer.email || ''}|${customer.firstName || ''}|${customer.lastName || ''}|${customer.phone || ''}|${program || ''}|${amount}`,
        }],
        application_context: {
          return_url: `${BASE_URL}/programs.html?res_paypal=1`,
          cancel_url: `${BASE_URL}/programs.html`,
          brand_name: 'CurvaFit',
          user_action: 'PAY_NOW',
        },
      };

      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderBody),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(errText || 'PayPal order creation failed');
      }

      const orderData    = await orderRes.json();
      const approvalLink = orderData.links.find(l => l.rel === 'approve');
      if (!approvalLink) throw new Error('No PayPal approval URL found');

      return response(200, { success: true, approvalUrl: approvalLink.href });
    }

    // ════════════════════════════════
    // ACTION : capture — capture + sauvegarde
    // ════════════════════════════════
    if (action === 'capture') {
      const { orderID, clientData, program, amount } = body;
      if (!orderID) throw new Error('Missing orderID');

      const access_token = await getPaypalToken(PAYPAL_BASE);

      // Capturer le paiement
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const captureData = await captureRes.json();

      if (captureData.status !== 'COMPLETED') {
        throw new Error(`PayPal capture failed: ${captureData.status}`);
      }

      // Récupérer les données depuis custom_id si clientData absent
      let firstName = clientData?.firstName || '';
      let lastName  = clientData?.lastName  || '';
      let email     = clientData?.email     || '';
      let phone     = clientData?.phone     || '';
      let prog      = program               || '';
      let amt       = amount                || '';

      // Fallback depuis custom_id PayPal
      if (!email) {
        const unit      = captureData.purchase_units?.[0] || {};
        const customId  = unit.custom_id || '';
        const parts     = customId.split('|');
        email     = parts[0] || '';
        firstName = parts[1] || '';
        lastName  = parts[2] || '';
        phone     = parts[3] || '';
        prog      = parts[4] || '';
        amt       = parts[5] || '';
      }

      // Sauvegarder dans le sheet
      await saveToSheet({ firstName, lastName, email, phone, program: prog, amount: amt });

      return response(200, { success: true });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (err) {
    console.error('[create-reservation-paypal]', err.message);
    return response(500, { success: false, error: err.message });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}