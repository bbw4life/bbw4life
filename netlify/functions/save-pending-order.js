// save-pending-order.js
process.removeAllListeners('warning');
const { google } = require('googleapis');
const { notifyTelegram } = require('./notify-telegram');

exports.handler = async (event) => {
  console.log('[SAVE PENDING] Function invoked');
  try {
    if (!event.body) return response(400, { success: false, error: 'No data received' });

    const body = JSON.parse(event.body);
   let {
      shipping,
      item,
      payment_provider,
      payment_id,
      status             = 'pending',
      fulfillment_method = 'eprolo',  // 'eprolo' ou 'cj'
      orderTotal          = 0 
    } = body;

    if (!payment_id) throw new Error('Missing payment_id');

    const normalize = (str) =>
      str ? str.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : '';

    const fullName = shipping.fullName ||
      `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim();

    shipping.fullName   = normalize(fullName);
    shipping.email      = normalize(shipping.email);
    shipping.phone      = normalize(shipping.phone);
    shipping.country    = normalize(shipping.country    || 'United States');
    shipping.state      = normalize(shipping.state);
    shipping.city       = normalize(shipping.city);
    shipping.postalCode = normalize(shipping.postalCode);
    shipping.address    = normalize(shipping.address);

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets        = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;
    const now           = new Date().toISOString();
    const internalOrderId = `PENDING_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // ── Colonne U (fromCountryCode)
    const values = [[
      internalOrderId,                                        // A
      payment_provider || '',                                 // B
      payment_id       || '',                                 // C
      shipping.fullName   || '',                              // D
      shipping.email      || '',                              // E
      shipping.phone      || '',                              // F
      shipping.country    || 'United States',                 // G
      shipping.state      || '',                              // H
      shipping.city       || '',                              // I
      shipping.postalCode || '',                              // J
      shipping.address    || '',                              // K
      item.cj_product_id  || item.eprolo_id || '',               // L ← cj_product_id
      item.variantsid     || item.cj_variant_id || '',        // M ← variant_id
      item.quantity       || 1,                               // N
      status,                                                 // O
      'paid',                                                 // P
      now,                                                    // Q
      shipping.shipping_method || 'Standard Shipping',        // R
      '',                                                     // S ← réservé
      fulfillment_method,                                     // T ← 'eprolo' ou 'cj'
      '',                                                      // U ← rempli plus tard par retry-pending-order
      '',                                                      // V ← réservé
      parseFloat(orderTotal) || 0                              // W ← montant total vérifié côté serveur
    ]];

    const rangesToTry = ['bbw4life-pending-orders!A:W'];

    let success = false;
    for (const range of rangesToTry) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values }
        });
        console.log(`[SAVE PENDING] ✅ SAUVEGARDE OK dans ${range}`);
        success = true;
        break;
      } catch (err) {
        console.log(`[SAVE PENDING] Échec avec ${range}:`, err.message);
      }
    }

    if (!success) throw new Error("Aucun onglet n'a fonctionné");

    // ── Notification Telegram ──────────────────────────────────────
    await notifyTelegram(
      `🛍️ <b>Pdg Francenel, une nouvelle commande vient de passer!</b>\n\n` +
      `🆔 <b>Order ID:</b> ${internalOrderId}\n` +
      `👤 <b>Client:</b> ${shipping.fullName}\n` +
      `📧 <b>Email:</b> ${shipping.email}\n` +
      `💳 <b>Paiement:</b> ${payment_provider}\n` +
      `💰 <b>Montant vérifié:</b> $${(parseFloat(orderTotal) || 0).toFixed(2)}\n` +
      `📦 <b>Quantité:</b> ${item.quantity || 1}\n` +
      `🌍 <b>Pays:</b> ${shipping.country}\n` +
      `🚚 <b>Fulfillment:</b> ${fulfillment_method.toUpperCase()}`
    );

    return response(200, { success: true });

  } catch (error) {
    console.error('[SAVE PENDING ERROR]', error.message);
    return response(500, { success: false, error: error.message });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}