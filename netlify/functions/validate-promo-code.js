/* ================================================================
   BBW4LIFE — VALIDATE PROMO CODE (Affiliate Reward Balance)
   Netlify Function : /.netlify/functions/validate-promo-code

   Le solde utilisable par le code affilié EST son solde d'affilié réel
   (bbw4life-accounts colonne U, "Earnings" — accumulé par les clics
   payés + le % de commission sur les commandes de ses filleuls, même
   valeur que celle affichée sur son dashboard et utilisée pour le
   retrait PayPal). Ce n'est PAS un solde séparé/forfaitaire :
   - Commande ≤ solde restant → la commande est payée par le solde,
     le reste du solde survit pour une prochaine commande.
   - Commande > solde restant → tout le solde restant est déduit de la
     commande, le client paie la différence ; le solde retombe à 0 et
     le code ne redonne plus rien tant qu'aucun nouveau clic/commande
     ne l'a réalimenté.
   Le solde n'est déduit qu'APRÈS confirmation réelle du paiement
   (action "consume", appelée par verify-payment.js) — jamais au simple
   clic "Apply" au checkout (action "validate", purement en lecture),
   pour ne jamais brûler le solde d'un client sur un paiement abandonné
   ou échoué.

   La feuille "PromoCodes" ne sert plus qu'à retrouver le USERNAME
   associé à un code (code → username), pas à stocker un solde — le
   solde vient toujours de bbw4life-accounts!U pour ce username. ──
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
      range: 'PromoCodes!A1:B1',
      valueInputOption: 'RAW',
      resource: {
        values: [['code', 'username']]
      }
    });
  }
}

async function findCodeRow(sheets, spreadsheetId, code) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'PromoCodes!A:B'
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].trim().toUpperCase() === code.trim().toUpperCase()) {
      return { rowIndex: i + 1, row: rows[i] };
    }
  }
  return null;
}

// ── Enregistre le lien code → username (une seule fois) — n'écrit
//    jamais de solde ici, il n'y en a plus dans cette feuille. ──
async function registerCode(sheets, spreadsheetId, code, username) {
  await getOrCreatePromoSheet(sheets, spreadsheetId);

  const existing = await findCodeRow(sheets, spreadsheetId, code);
  if (existing) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'PromoCodes!A:B',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[ code.toUpperCase(), username || '' ]]
    }
  });
}

// ── Retrouve le solde réel de l'affilié (bbw4life-accounts!U, Earnings)
//    à partir de son username — même colonne que aff-get-stats/
//    aff-withdraw-request dans save-account.js (ne pas diverger). ──
async function getAccountBalanceForUsername(sheets, accountsSpreadsheetId, username) {
  if (!username) return { balance: 0, rowNum: -1 };
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: accountsSpreadsheetId,
    range: 'bbw4life-accounts!A:Y'
  });
  const rows = res.data.values || [];
  const target = username.trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    const rowUsername = (rows[i][18] || '').trim().toLowerCase(); // S=Username(18)
    if (rowUsername === target) {
      return { balance: parseFloat(rows[i][20] || 0) || 0, rowNum: i + 1 }; // U=Earnings(20)
    }
  }
  return { balance: 0, rowNum: -1 };
}

// ── Lecture seule : le code est-il utilisable, et avec quel solde ?
//    Ne modifie RIEN dans le sheet — appelé au clic "Apply" au checkout,
//    avant tout paiement. Le solde vient de bbw4life-accounts!U. ──
async function validateCode(sheets, promoSpreadsheetId, accountsSpreadsheetId, code) {
  await getOrCreatePromoSheet(sheets, promoSpreadsheetId);

  const found = await findCodeRow(sheets, promoSpreadsheetId, code);
  if (!found) {
    return { valid: false, reason: 'CODE_NOT_FOUND' };
  }

  const username = found.row[1] || '';
  const { balance } = await getAccountBalanceForUsername(sheets, accountsSpreadsheetId, username);

  if (balance <= 0) {
    return { valid: false, reason: 'CODE_EXHAUSTED', balance: 0, username };
  }

  return { valid: true, balance, username };
}

// ── Déduit réellement le solde utilisé sur CETTE commande — appelé une
//    seule fois, uniquement après confirmation du paiement
//    (verify-payment.js). amountUsed = min(sous-total commande, solde
//    au moment de l'appel), déjà calculé côté serveur par _lib/pricing.js
//    (source unique de vérité des prix). Écrit dans bbw4life-accounts!U,
//    la même colonne que le retrait PayPal / aff-get-stats. ──
async function consumeCode(sheets, promoSpreadsheetId, accountsSpreadsheetId, code, amountUsed) {
  await getOrCreatePromoSheet(sheets, promoSpreadsheetId);

  const found = await findCodeRow(sheets, promoSpreadsheetId, code);
  if (!found) return { success: false, reason: 'CODE_NOT_FOUND' };

  const username = found.row[1] || '';
  const { balance, rowNum } = await getAccountBalanceForUsername(sheets, accountsSpreadsheetId, username);

  if (rowNum === -1 || balance <= 0) {
    return { success: false, reason: 'CODE_EXHAUSTED' };
  }

  const used         = Math.min(parseFloat(amountUsed) || 0, balance);
  const newBalance   = parseFloat((balance - used).toFixed(2));
  const nowExhausted = newBalance <= 0;

  await sheets.spreadsheets.values.update({
    spreadsheetId: accountsSpreadsheetId,
    range: `bbw4life-accounts!U${rowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [[newBalance]] }
  });

  return { success: true, newBalance, exhausted: nowExhausted };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'No body' }) };
    }

    const { action, code, username, amountUsed } = JSON.parse(event.body);
    // PromoCodes (code → username) et bbw4life-accounts (le vrai solde,
    // colonne U) vivent dans le même classeur Google Sheets.
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;
    const sheets = await getSheets();

    if (action === 'register') {
      if (!code || !username) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing code or username' }) };
      }
      await registerCode(sheets, spreadsheetId, code, username);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'validate') {
      if (!code) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing code' }) };
      }
      const result = await validateCode(sheets, spreadsheetId, spreadsheetId, code);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result }) };
    }

    if (action === 'consume') {
      if (!code || amountUsed === undefined) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing code or amountUsed' }) };
      }
      const result = await consumeCode(sheets, spreadsheetId, spreadsheetId, code, amountUsed);
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
