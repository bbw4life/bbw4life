// save-pending-order.js
process.removeAllListeners('warning');
const { google } = require('googleapis');
const fetch = require('node-fetch');
const { notifyTelegram } = require('./notify-telegram');

// ── Obtenir Access Token CJ (identique à create-cj-order.js) ──────
async function getCJAccessToken() {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
  });

  const data = await res.json();
  if (!data.result || !data.data?.accessToken) {
    throw new Error('CJ auth failed: ' + (data.message || JSON.stringify(data)));
  }
  return data.data.accessToken;
}

// ── Résoudre fromCountryCode via le vid (entrepôt avec le plus de stock) ──
async function getCJFromCountryCode(vid, token) {
  try {
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'CJ-Access-Token': token }
    });
    const responseText = await response.text();

    let data = {};
    try { data = JSON.parse(responseText); } catch {}

    if (data.result === true && Array.isArray(data.data) && data.data.length > 0) {
      // On choisit l'entrepôt qui a le plus de stock disponible
      const best = data.data.reduce((max, w) =>
        (Number(w.totalInventoryNum) || 0) > (Number(max.totalInventoryNum) || 0) ? w : max
      , data.data[0]);

      const code = best.countryCode || best.areaEn || '';
      if (code) return String(code).toUpperCase();
    }

    console.log('[SAVE PENDING] ⚠️ Aucun countryCode trouvé pour vid:', vid, '| Réponse:', responseText.slice(0, 200));
  } catch (err) {
    console.error('[SAVE PENDING] ❌ Erreur getCJFromCountryCode:', err.message);
  }
  return ''; // laissé vide si échec, create-cj-order appliquera son propre fallback
}

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
      fulfillment_method = 'eprolo'   // 'eprolo' ou 'cj'
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

    // ── NOUVEAU : résolution fromCountryCode uniquement pour CJ ──────
    let fromCountryCode = '';
    if (fulfillment_method === 'cj') {
      const cjVid = item.variantsid || item.cj_variant_id || '';
      if (cjVid && process.env.CJ_API_KEY) {
        try {
          const cjToken = await getCJAccessToken();
          fromCountryCode = await getCJFromCountryCode(cjVid, cjToken);
          console.log(`[SAVE PENDING] fromCountryCode CJ résolu: "${fromCountryCode}" (vid: ${cjVid})`);
        } catch (err) {
          console.error('[SAVE PENDING] ❌ Impossible de résoudre fromCountryCode:', err.message);
        }
      } else {
        console.log('[SAVE PENDING] ⚠️ vid ou CJ_API_KEY manquant, fromCountryCode laissé vide');
      }
    }

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
      item.cj_product_id  || item.cj_id || '',               // L ← cj_product_id
      item.variantsid     || item.cj_variant_id || '',        // M ← variant_id
      item.quantity       || 1,                               // N
      status,                                                 // O
      'paid',                                                 // P
      now,                                                    // Q
      shipping.shipping_method || 'Standard Shipping',        // R
      '',                                                     // S ← réservé
      fulfillment_method,                                     // T ← 'eprolo' ou 'cj'
      fromCountryCode                                          // U ← NOUVEAU : pays d'origine CJ
    ]];

    const rangesToTry = ['bbw4life-pending-orders!A:U'];

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