/* ================================================================
   BBW4LIFE — VALIDATE PROMO CODE (Affiliate Reward Balance)
   Netlify Function : /.netlify/functions/validate-promo-code

   Le code affilié n'est plus "à usage unique avec % fixe" — c'est un
   SOLDE en dollars (ex: $100) qui se dépense commande après commande :
   - Commande ≤ solde restant → la commande est payée par le solde,
     le reste du solde survit pour une prochaine commande.
   - Commande > solde restant → tout le solde restant est déduit de la
     commande, le client paie la différence, le code devient épuisé
     (status "used") et ne peut plus être appliqué.
   Le solde n'est déduit qu'APRÈS confirmation réelle du paiement
   (action "consume", appelée par verify-payment.js) — jamais au simple
   clic "Apply" au checkout (action "validate", purement en lecture),
   pour ne jamais brûler le solde d'un client sur un paiement abandonné
   ou échoué.
================================================================ */
process.removeAllListeners('warning');
const { google } = require('googleapis');

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

async function getOrCreatePromoSheet(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets.find(
    s => s.properties.title === 'PromoCodes'
  );

  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addSheet: { properties: { title: 'PromoCodes' } }
        }]
      }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'PromoCodes!A1:F1',
      valueInputOption: 'RAW',
      resource: {
        values: [['code', 'username', 'balance_usd', 'status', 'created_at', 'used_at']]
      }
    });
  }
}

async function findCodeRow(sheets, spreadsheetId, code) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'PromoCodes!A:F'
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].trim().toUpperCase() === code.trim().toUpperCase()) {
      return { rowIndex: i + 1, row: rows[i] };
    }
  }
  return null;
}

// ── Enregistre un nouveau code avec son solde initial (ex: $100) — ne
//    touche pas un code déjà existant (le solde ne doit jamais être
//    réinitialisé par une ré-inscription accidentelle). ──
async function registerCode(sheets, spreadsheetId, code, username, balance) {
  await getOrCreatePromoSheet(sheets, spreadsheetId);

  const existing = await findCodeRow(sheets, spreadsheetId, code);
  if (existing) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'PromoCodes!A:F',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[
        code.toUpperCase(),
        username || '',
        parseFloat(balance) || 0,
        'active',
        new Date().toISOString(),
        ''
      ]]
    }
  });
}

// ── Lecture seule : le code est-il utilisable, et avec quel solde ?
//    Ne modifie RIEN dans le sheet — appelé au clic "Apply" au checkout,
//    avant tout paiement. ──
async function validateCode(sheets, spreadsheetId, code) {
  await getOrCreatePromoSheet(sheets, spreadsheetId);

  const found = await findCodeRow(sheets, spreadsheetId, code);
  if (!found) {
    return { valid: false, reason: 'CODE_NOT_FOUND' };
  }

  const { row } = found;
  const status  = (row[3] || '').trim().toLowerCase();
  const balance = parseFloat(row[2]) || 0;
  const username = row[1] || '';

  if (status === 'used' || balance <= 0) {
    return { valid: false, reason: 'CODE_EXHAUSTED', balance: 0, username };
  }

  if (status !== 'active') {
    return { valid: false, reason: 'CODE_INACTIVE', balance, username };
  }

  return { valid: true, balance, username };
}

// ── Déduit réellement le solde utilisé sur CETTE commande — appelé une
//    seule fois, uniquement après confirmation du paiement
//    (verify-payment.js). amountUsed = min(sous-total commande, solde
//    au moment de l'appel), déjà calculé côté serveur par _lib/pricing.js
//    (source unique de vérité des prix). ──
async function consumeCode(sheets, spreadsheetId, code, amountUsed) {
  await getOrCreatePromoSheet(sheets, spreadsheetId);

  const found = await findCodeRow(sheets, spreadsheetId, code);
  if (!found) return { success: false, reason: 'CODE_NOT_FOUND' };

  const { rowIndex, row } = found;
  const status  = (row[3] || '').trim().toLowerCase();
  const balance = parseFloat(row[2]) || 0;

  if (status === 'used' || balance <= 0) {
    return { success: false, reason: 'CODE_EXHAUSTED' };
  }

  const used         = Math.min(parseFloat(amountUsed) || 0, balance);
  const newBalance   = parseFloat((balance - used).toFixed(2));
  const nowExhausted = newBalance <= 0;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `PromoCodes!C${rowIndex}:F${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[
        newBalance,
        nowExhausted ? 'used' : 'active',
        row[4] || '',
        new Date().toLocaleString('fr-FR', { timeZone: 'America/New_York' })
      ]]
    }
  });

  return { success: true, newBalance, exhausted: nowExhausted };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'No body' }) };
    }

    const { action, code, username, balance, amountUsed } = JSON.parse(event.body);
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;
    const sheets = await getSheets();

    if (action === 'register') {
      if (!code || !username) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing code or username' }) };
      }
      await registerCode(sheets, spreadsheetId, code, username, balance || 0);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'validate') {
      if (!code) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing code' }) };
      }
      const result = await validateCode(sheets, spreadsheetId, code);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result }) };
    }

    if (action === 'consume') {
      if (!code || amountUsed === undefined) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing code or amountUsed' }) };
      }
      const result = await consumeCode(sheets, spreadsheetId, code, amountUsed);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Unknown action' }) };

  } catch (err) {
    console.error('[validate-promo-code]', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
