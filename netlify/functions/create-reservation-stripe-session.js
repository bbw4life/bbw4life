// netlify/functions/create-reservation-stripe-session.js
// action=create  → crée la session Stripe
// action=verify  → vérifie le paiement ET sauvegarde dans le sheet

const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { google } = require('googleapis');

async function saveToSheet(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets        = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.PENDING_PLAN_PROGRAM_SHEET_ID;

  function formatDate() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:            'MembersPeding-Plan!A:I',
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
        'Stripe - Paid'
      ]]
    },
  });
}

exports.handler = async (event) => {
  try {
    if (!event.body) throw new Error('No data received');

    const body   = JSON.parse(event.body);
    const action = body.action || 'create';

    // ════════════════════════════════
    // ACTION : create — crée la session
    // ════════════════════════════════
    if (action === 'create') {
      const { amount, program, customer } = body;

      const stripePriceId = process.env.RESERVATION_STRIPE_PRICE_ID || '';
      if (!stripePriceId) throw new Error('RESERVATION_STRIPE_PRICE_ID not configured.');

      const BASE_URL = process.env.BASE_URL || '';

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode:                 'payment',
        line_items: [{ price: stripePriceId, quantity: 1 }],
        customer_email: customer.email || undefined,
        metadata: {
          firstName: customer.firstName || '',
          lastName:  customer.lastName  || '',
          email:     customer.email     || '',
          phone:     customer.phone     || '',
          program:   program            || '',
          amount:    String(amount),
        },
        success_url: `${BASE_URL}/programs.html?res_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${BASE_URL}/programs.html`,
      });

      return response(200, { success: true, sessionId: session.id });
    }

    // ════════════════════════════════
    // ACTION : verify — vérifie + sauvegarde
    // ════════════════════════════════
    if (action === 'verify') {
      const { sessionId } = body;
      if (!sessionId) throw new Error('Missing sessionId');

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return response(200, { success: false, error: `Payment status: ${session.payment_status}` });
      }

      const m = session.metadata || {};
      await saveToSheet({
        firstName: m.firstName,
        lastName:  m.lastName,
        email:     m.email,
        phone:     m.phone,
        program:   m.program,
        amount:    m.amount,
      });

      return response(200, { success: true });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (err) {
    console.error('[create-reservation-stripe-session]', err.message);
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