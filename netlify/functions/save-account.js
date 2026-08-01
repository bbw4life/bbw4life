// netlify/functions/save-account.js
process.removeAllListeners('warning');
const crypto = require('crypto');
const { google } = require('googleapis');
const { verifyAccountToken, generateConfirmToken, verifyConfirmToken } = require('./account-token');
const { notifyWelcome, notifyNewsletter1, notifyConfirmEmail, notifyPasswordReset } = require('./notify-email');
const { hashPassword, verifyPassword, isHashedPassword } = require('./_lib/password');

// ── Rate limiting pour request-password-reset — par email (fallback IP si
// email absent) plutôt que par IP seule : derrière un même NAT/proxy (ou
// quand x-forwarded-for est absent, cas fréquent en test local), toutes
// les requêtes retombaient sur la même clé 'unknown' et se bloquaient
// mutuellement après 5 tentatives en 60s, empêchant même un premier essai
// légitime d'atteindre notifyPasswordReset. ──
const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5;

function getClientIp(event) {
  return (
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['client-ip'] ||
    'unknown'
  );
}

function isRateLimited(key) {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(key) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT_MAP.set(key, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  RATE_LIMIT_MAP.set(key, entry);
  return false;
}

const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PASSWORD_RESET_SHEET = 'Password_Reset_Tokens';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// ── Garantit l'existence de l'onglet Password_Reset_Tokens (créé au besoin) ──
async function ensureResetTokensSheet(sheets, spreadsheetId) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const exists = (meta.data.sheets || []).some(s => s.properties.title === PASSWORD_RESET_SHEET);
    if (!exists) {
      console.log(`[password-reset] Sheet "${PASSWORD_RESET_SHEET}" not found — creating it now...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title: PASSWORD_RESET_SHEET } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${PASSWORD_RESET_SHEET}!A1:E1`,
        valueInputOption: 'RAW',
        resource: { values: [['email', 'token_hash', 'created_at', 'expires_at', 'used_at']] }
      });
      console.log(`[password-reset] Sheet "${PASSWORD_RESET_SHEET}" created with headers.`);
    } else {
      console.log(`[password-reset] Sheet "${PASSWORD_RESET_SHEET}" already exists.`);
    }
  } catch (e) {
    // IMPORTANT : cette erreur est avalée pour ne pas casser le flux, mais si elle se produit,
    // TOUT le reste de request-password-reset (écriture du token, envoi de l'email) échouera
    // silencieusement plus loin (le sheet cible n'existe pas). Elle est donc loguée en "error".
    console.error('[password-reset] ensureResetTokensSheet FAILED (this may explain a missing reset email):', e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action = 'signup', lastName, firstName, email, phone = "", password, newsletter = "No", birthday = "",
            line1, line2, city, state, zip, newPassword,
            totalAmount = 0, totalQuantity = 0, orderItems = [],
            currentCartQuantity = null, token } = body;

    // ── Actions sensibles : nécessitent un token valide lié à l'email ──
    const PROTECTED_ACTIONS = [
      'get-stats',
      'update-address',
      'update-profile-photo',
      'update-password',
      'aff-get-stats',
      'aff-create',
      'aff-withdraw-request',
      'get-abandoned-carts'
    ];

    if (PROTECTED_ACTIONS.includes(action)) {
      if (!verifyAccountToken(email, token)) {
        return {
          statusCode: 401,
          body: JSON.stringify({ success: false, error: 'Unauthorized' })
        };
      }
    }

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;

    function formatDate() {
      const d = new Date();
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
    }

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "bbw4life-accounts!A:AF" });
    let rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => normalize(row[2] || "") === normalize(email));
    const rowNum = rowIndex + 1;

    // ==================== SIGNUP ====================
    if (action === 'signup') {
      if (!lastName || !firstName || !email || !password) throw new Error("Données manquantes");

      if (rowIndex !== -1) {
        return {
          statusCode: 200,
          body: JSON.stringify({ success: false, error: 'EMAIL_ALREADY_EXISTS' })
        };
      }
      const passNormalized = normalize(password);
      const passHashed = hashPassword(passNormalized);
      const memberSince = formatDate();
      const values = [[normalize(lastName), normalize(firstName), normalize(email), normalize(phone), passHashed, newsletter,
                       0, 0, 0, "", "", "", "", "", 0, memberSince, "[]"]];
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: "bbw4life-accounts!A:Z", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", resource: { values }
      });

     const newRowNum = rows.length + 1;
      const isSubscribed = (newsletter || '').toLowerCase() === 'yes';
      const welcomeScheduledAt    = new Date(Date.now() + 60 * 1000).toISOString();      // +1 min
      const newsletterScheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();  // +2 min

  
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `bbw4life-accounts!AF${newRowNum}:AJ${newRowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[
          "no",
          welcomeScheduledAt,
          "no",
          isSubscribed ? newsletterScheduledAt : "",
          isSubscribed ? "no" : "skip"
        ]] }
      });

      // ── Email de confirmation — ENVOI IMMÉDIAT (attendu avant de répondre) ──
      const confirmToken = generateConfirmToken(email);
      await notifyConfirmEmail({ email, firstName, confirmToken }).catch((e) => {
        console.warn('[signup] notifyConfirmEmail failed:', e.message);
      });

      return { statusCode: 200, body: JSON.stringify({ success: true, requireConfirmation: true }) };
    }


    // ==================== CONFIRM ACCOUNT (email verification) ====================
    if (action === 'confirm-account') {
      const { confirmToken } = body;
      if (!email || !confirmToken) throw new Error("Missing confirmation data");

      if (!verifyConfirmToken(email, confirmToken)) {
        return { statusCode: 401, body: JSON.stringify({ success: false, error: 'INVALID_TOKEN' }) };
      }

      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `bbw4life-accounts!AF${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [["yes"]] }
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE PROFILE PHOTO ====================
    if (action === 'update-profile-photo') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const { photoBase64 } = body;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `bbw4life-accounts!R${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[photoBase64 || ""]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE ADDRESS ====================
    if (action === 'update-address') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `bbw4life-accounts!J${rowNum}:N${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[line1 || "", line2 || "", city || "", state || "", zip || ""]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }


    // ==================== REQUEST PASSWORD RESET (Forgot Password — étape 1) ====================
    // Génère un token à usage unique et l'envoie par email.
    // NOTE SÉCURITÉ : sur demande explicite de l'utilisateur (risque d'énumération de comptes
    // accepté en connaissance de cause), cette action révèle désormais si l'email existe via
    // le champ `found` de la réponse.
    if (action === 'request-password-reset') {
      const rateLimitKey = normalize(email) || getClientIp(event);
      if (isRateLimited(rateLimitKey)) {
        return { statusCode: 429, body: JSON.stringify({ success: false, error: 'Too many requests. Please wait a moment.' }) };
      }

      if (!email) {
        return { statusCode: 200, body: JSON.stringify({ success: true, found: false }) };
      }

      let found = false;
      try {
        const normalizedEmail = normalize(email).toLowerCase();
        const rowIdx = rows.findIndex(row => normalize(row[2] || "").toLowerCase() === normalizedEmail);
        console.log(`[request-password-reset] Lookup for "${normalizedEmail}" → rowIdx=${rowIdx}`);

        if (rowIdx !== -1) {
          found = true;
          console.log('[request-password-reset] Account found. Ensuring Password_Reset_Tokens sheet exists...');
          await ensureResetTokensSheet(sheets, spreadsheetId);
          console.log('[request-password-reset] ensureResetTokensSheet step complete.');

          const resetToken = crypto.randomBytes(32).toString('hex');
          const tokenHash  = sha256Hex(resetToken);
          const nowIso     = new Date().toISOString();
          const expiresIso = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();

          // ── Invalide tout token existant non utilisé pour cet email (un seul token actif à la fois) ──
          try {
            const tokensRes = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: `${PASSWORD_RESET_SHEET}!A:E`
            });
            const tokenRows = tokensRes.data.values || [];
            const invalidations = [];
            for (let i = 1; i < tokenRows.length; i++) {
              const r = tokenRows[i] || [];
              const rEmail  = normalize(r[0] || "").toLowerCase();
              const usedAt  = (r[4] || '').trim();
              if (rEmail === normalizedEmail && !usedAt) {
                invalidations.push({
                  range: `${PASSWORD_RESET_SHEET}!E${i + 1}`,
                  values: [['invalidated']]
                });
              }
            }
            if (invalidations.length) {
              await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                resource: { valueInputOption: 'RAW', data: invalidations }
              });
            }
            console.log(`[request-password-reset] Invalidated ${invalidations.length} previous token(s).`);
          } catch (e) {
            console.warn('[request-password-reset] Could not invalidate previous tokens:', e.message);
          }

          // ── Écrit le nouveau token (seul le hash est stocké) ──
          // Isolé dans son propre try/catch : si l'écriture Sheets échoue (permissions,
          // quota, etc.), on veut quand même tenter d'envoyer l'email plutôt que de
          // bloquer silencieusement tout le flux (c'était le bug précédent : une
          // exception ici empêchait `notifyPasswordReset` d'être atteint).
          console.log('[request-password-reset] Writing new token row to sheet...');
          try {
            await sheets.spreadsheets.values.append({
              spreadsheetId,
              range: `${PASSWORD_RESET_SHEET}!A:E`,
              valueInputOption: 'RAW',
              insertDataOption: 'INSERT_ROWS',
              resource: { values: [[normalizedEmail, tokenHash, nowIso, expiresIso, ""]] }
            });
            console.log('[request-password-reset] New token row written successfully.');
          } catch (e) {
            console.error('[request-password-reset] Token write FAILED — email will still be sent, but the link may not verify:', e.message, e.stack);
          }

          const userRow   = rows[rowIdx] || [];
          const firstNameForEmail = userRow[1] || '';

          console.log(`[request-password-reset] Calling notifyPasswordReset for "${userRow[2] || email}"...`);
          const notifyResult = await notifyPasswordReset({ email: userRow[2] || email, firstName: firstNameForEmail, resetToken }).catch((e) => {
            console.error('[request-password-reset] notifyPasswordReset threw:', e.message, e.stack);
            return { success: false, error: e.message };
          });
          console.log('[request-password-reset] notifyPasswordReset result:', JSON.stringify(notifyResult));
        } else {
          console.log('[request-password-reset] No account found for this email — no token/email sent (by design).');
        }
      } catch (e) {
        console.error('[request-password-reset] Unexpected error (reset email was NOT sent):', e.message, e.stack);
      }

      return { statusCode: 200, body: JSON.stringify({ success: true, found }) };
    }

    // ==================== RESET PASSWORD (Forgot Password — étape 2, avec token) ====================
    if (action === 'reset-password') {
      const { newPassword, resetToken } = body;
      if (!email || !newPassword || !resetToken) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: "Email, new password and reset token are required" }) };
      }

      const normalizedEmail = normalize(email).toLowerCase();

      let tokenValid = false;
      let tokenRowNum = -1;
      try {
        const tokensRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${PASSWORD_RESET_SHEET}!A:E`
        });
        const tokenRows = tokensRes.data.values || [];
        const providedHash = sha256Hex(resetToken);
        const now = Date.now();

        for (let i = 1; i < tokenRows.length; i++) {
          const r = tokenRows[i] || [];
          const rEmail    = normalize(r[0] || "").toLowerCase();
          const rTokenHash = (r[1] || '').trim();
          const rExpiresAt = (r[3] || '').trim();
          const rUsedAt    = (r[4] || '').trim();

          if (rEmail !== normalizedEmail || rUsedAt) continue;

          const expectedBuf = Buffer.from(rTokenHash, 'hex');
          const providedBuf = Buffer.from(providedHash, 'hex');
          const hashMatches = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);
          if (!hashMatches) continue;

          const expiresAtMs = rExpiresAt ? new Date(rExpiresAt).getTime() : 0;
          if (!expiresAtMs || expiresAtMs < now) continue;

          tokenValid = true;
          tokenRowNum = i + 1;
          break;
        }
      } catch (e) {
        console.warn('[reset-password] Token lookup failed:', e.message);
      }

      if (!tokenValid) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'INVALID_OR_EXPIRED_TOKEN' }) };
      }

      const rowIdx = rows.findIndex(row => normalize(row[2] || "").toLowerCase() === normalizedEmail);
      if (rowIdx === -1) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'INVALID_OR_EXPIRED_TOKEN' }) };
      }

      const targetRow = rowIdx + 1;
      const newHash = hashPassword(normalize(newPassword));

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `bbw4life-accounts!E${targetRow}`,
        valueInputOption: "RAW",
        resource: { values: [[newHash]] }
      });

      // ── Usage unique : invalide immédiatement le token utilisé ──
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${PASSWORD_RESET_SHEET}!E${tokenRowNum}`,
          valueInputOption: 'RAW',
          resource: { values: [[new Date().toISOString()]] }
        });
      } catch (e) {
        console.warn('[reset-password] Could not mark token as used:', e.message);
      }

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE PASSWORD ====================
    if (action === 'update-password') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `bbw4life-accounts!E${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[hashPassword(normalize(newPassword))]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE CART QUANTITY + CONTENT ====================
    if (action === 'update-cart-quantity') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const { cartContent = null } = body;

      const updateData = [
        { range: `bbw4life-accounts!O${rowNum}`, values: [[currentCartQuantity]] }
      ];

      if (cartContent !== null) {
        updateData.push({
          range: `bbw4life-accounts!AC${rowNum}`,
          values: [[JSON.stringify(cartContent)]]
        });
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: { valueInputOption: "RAW", data: updateData }
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== RECORD ORDER ====================
    if (action === 'record-order') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const currentRow = rows[rowIndex] || [];
      const newOrders = parseInt(currentRow[6] || 0) + 1;
      const newSpent = parseFloat(currentRow[7] || 0) + parseFloat(totalAmount);
      let history = [];
      try { history = JSON.parse(currentRow[16] || "[]"); } catch(e) {}
      history.push({ date: formatDate(), total: parseFloat(totalAmount).toFixed(2), totalQuantity: parseInt(totalQuantity), items: orderItems });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: "RAW",
          data: [
            { range: `bbw4life-accounts!G${rowNum}`, values: [[newOrders]] },
            { range: `bbw4life-accounts!H${rowNum}`, values: [[newSpent]] },
            { range: `bbw4life-accounts!Q${rowNum}`, values: [[JSON.stringify(history)]] }
          ]
        }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== GET STATS ====================
    if (action === 'get-stats') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const currentRow = rows[rowIndex] || [];
      let history = [];
      try { history = JSON.parse(currentRow[16] || "[]"); } catch(e) {}

      return {
        statusCode: 200,
        body: JSON.stringify({
          orders:         parseInt(currentRow[6]  || 0),
          totalSpent:     parseFloat(currentRow[7] || 0),
          quantityInCart: parseInt(currentRow[14] || 0),
          history:        history,
          memberSince:    currentRow[15] || "January 2026",
          points:         parseInt(currentRow[6]  || 0) * 10,
          reviewsCount:   parseInt(currentRow[8]  || 0),
          profilePhoto:   currentRow[17] || "",
          addressLine1:   currentRow[9]  || "",
          line2:          currentRow[10] || "",
          city:           currentRow[11] || "",
          state:          currentRow[12] || "",
          zip:            currentRow[13] || "",
          savedCart:      currentRow[28] || "[]",
           birthday:       currentRow[27] || ""
        })
      };
    }

    // ==================== NEWSLETTER SUBSCRIBE ====================
    if (action === 'newsletter-subscribe') {
      if (!email) throw new Error("Email required");

      const normalizedEmail = normalize(email);
      const rowIndex = rows.findIndex(row => normalize(row[2] || "") === normalizedEmail);
      const rowNum = rowIndex + 1;

      if (rowIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `bbw4life-accounts!F${rowNum}`,
          valueInputOption: "RAW",
          resource: { values: [["Yes"]] }
        });
        // Ajouter firstName, lastName en colonnes A et B
        if (firstName || lastName) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `bbw4life-accounts!A${rowNum}:B${rowNum}`,
            valueInputOption: "RAW",
            resource: { values: [[normalize(lastName) || "", normalize(firstName) || ""]] }
          });
        }
        // Birthday en colonne AB (index 27)
        if (birthday) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `bbw4life-accounts!AB${rowNum}`,
            valueInputOption: "RAW",
            resource: { values: [[birthday]] }
          });
        } 
      } else {
        const rowData = [
          normalize(lastName) || "",
          normalize(firstName) || "",
          normalizedEmail, "", "", "Yes",
          0, 0, 0, "", "", "", "", "", 0,
          formatDate(), "[]", "", "", "", "", "", "", "", "", "", "", "", birthday || ""
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "bbw4life-accounts!A:Z",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values: [rowData] }
        });
      }

      // ── Email Newsletter #1 ──
      await fetch('https://bbw4life.com/.netlify/functions/send-email-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'newsletter_1', email, firstName: firstName || '' })
      }).catch(() => {});

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }



  if (action === 'aff-create') {
  if (!email) throw new Error("Email required");
  const { allAffiliates } = body;
  if (rowIndex === -1) throw new Error("User not found");

  const newAff = allAffiliates && allAffiliates[allAffiliates.length - 1];
  if (!newAff) throw new Error("No affiliate data");

  // Vérifier si username déjà présent (colonne S)
  const existingUsername = (rows[rowIndex][18] || '').toLowerCase().trim();
  if (existingUsername && existingUsername === newAff.username.toLowerCase().trim()) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // S=Username, T=Clicks, U=Earnings, V=Orders, W=OrderValue, X=WithdrawStatus, Y=CreatedAt
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `bbw4life-accounts!S${rowNum}:Y${rowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [[
      newAff.username,
      newAff.clicks || 0,
      newAff.totalMoney || 0,
      newAff.totalOrders || 0,
      newAff.totalOrderValue || 0,
      newAff.withdrawStatus || 'none',
      newAff.createdAt || formatDate()
    ]] }
  });
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

if (action === 'aff-get-stats') {
  if (!email) throw new Error("Email required");
  if (rowIndex === -1) return { statusCode: 200, body: JSON.stringify({ success: true, affiliates: [] }) };

  const currentRow = rows[rowIndex] || [];

  // S=Username(18), T=Clicks(19), U=Earnings(20), V=Orders(21), W=OrderValue(22), X=WithdrawStatus(23), Y=CreatedAt(24)
  const username        = currentRow[18] || '';
  const clicks          = parseInt(currentRow[19]  || 0);
  const totalMoney      = parseFloat(currentRow[20] || 0);
  const totalOrders     = parseInt(currentRow[21]  || 0);
  const totalOrderValue = parseFloat(currentRow[22] || 0);
  const withdrawStatus  = currentRow[23] || 'none';
  const createdAt       = currentRow[24] || '';

  if (!username) {
    return { statusCode: 200, body: JSON.stringify({ success: true, affiliates: [] }) };
  }

  const affiliates = [{
    username,
    clicks,
    totalMoney,
    totalOrders,
    totalOrderValue,
    withdrawStatus,
    createdAt
  }];

  const clickRewardEarned    = parseFloat(currentRow[30] || 0);  // AE
  const clicksPerRewardStored = parseInt(currentRow[29] || 0);   // AD

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      affiliates: affiliates.map(function(a) {
        return Object.assign({}, a, {
          clickRewardEarned:    clickRewardEarned,
          clicksPerRewardStored: clicksPerRewardStored
        });
      }),
      withdrawStatus
    })
  };
}

if (action === 'aff-track-click') {
  const { username } = body;
  if (!username) throw new Error("Username required");

  for (let i = 1; i < rows.length; i++) {
    const rowUsername = (rows[i][18] || '').toLowerCase().trim();
    if (rowUsername !== username.toLowerCase().trim()) continue;

    // T = Clicks (index 19)
    const currentClicks = parseInt(rows[i][19] || 0);
    const newClicks = currentClicks + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `bbw4life-accounts!T${i + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [[newClicks]] }
    });
    return { statusCode: 200, body: JSON.stringify({ success: true, clicks: newClicks }) };
  }
  return { statusCode: 200, body: JSON.stringify({ success: false, error: 'Username not found' }) };
}

if (action === 'aff-record-order') {
  const { username, orderAmount } = body;
  if (!username || !orderAmount) throw new Error("Missing data");
  const commissionPct = parseFloat(body.commissionPercent) || 5;
  const commission = parseFloat(orderAmount) * (commissionPct / 100);

  for (let i = 1; i < rows.length; i++) {
    const rowUsername = (rows[i][18] || '').toLowerCase().trim();
    if (rowUsername !== username.toLowerCase().trim()) continue;

    // U=Earnings(20), V=Orders(21), W=OrderValue(22)
    const newMoney    = parseFloat((parseFloat(rows[i][20] || 0) + commission)).toFixed(2);
    const newOrders   = parseInt(rows[i][21] || 0) + 1;
    const newOrderVal = parseFloat((parseFloat(rows[i][22] || 0) + parseFloat(orderAmount))).toFixed(2);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `bbw4life-accounts!U${i + 1}:W${i + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [[newMoney, newOrders, newOrderVal]] }
    });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }
  return { statusCode: 200, body: JSON.stringify({ success: false, error: 'Username not found' }) };
}

if (action === 'aff-withdraw-request') {
  const { paypalName, paypalEmail } = body;
  if (!email || !paypalName || !paypalEmail) throw new Error("Missing data");
  if (rowIndex === -1) throw new Error("User not found");

  // X=WithdrawStatus(23), Z=PaypalName(25), AA=PaypalEmail(26)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `bbw4life-accounts!X${rowNum}:AA${rowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [['pending', '', paypalName, paypalEmail]] }
  });
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

if (action === 'aff-approve-withdraw') {
  const { targetEmail } = body;
  if (!targetEmail) throw new Error("targetEmail required");

  const normalize2 = (s) => s ? s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";
  const targetIdx = rows.findIndex(r => normalize2(r[2] || '') === normalize2(targetEmail));
  if (targetIdx === -1) throw new Error("User not found");

  const targetRowNum = targetIdx + 1;

  // X=WithdrawStatus(23)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `bbw4life-accounts!X${targetRowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [['approved']] }
  });
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}


if (action === 'aff-mark-promo-used') {
  if (!email) throw new Error("Email required");
  if (rowIndex === -1) throw new Error("User not found");
  // Colonne AB (index 27) — PromoCodeUsed
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `bbw4life-accounts!AB${rowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [['yes']] }
  });
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

if (action === 'aff-check-promo-used') {
  if (!email) throw new Error("Email required");
  if (rowIndex === -1) return { statusCode: 200, body: JSON.stringify({ success: true, used: false }) };
  const currentRow = rows[rowIndex] || [];
  const usedVal = (currentRow[27] || '').toLowerCase().trim();
  return { statusCode: 200, body: JSON.stringify({ success: true, used: usedVal === 'yes' }) };
}



    // ==================== GET TODAY BIRTHDAYS ====================
    if (action === 'get-today-birthdays') {

      const today = new Date();
      const todayDay   = body.clientDay   || today.getDate();
      const todayMonth = body.clientMonth || (today.getMonth() + 1);

      function parseBirthdaySheet(raw) {
        if (!raw || typeof raw !== 'string') return null;
        raw = raw.trim();

        // ISO yyyy-mm-dd
        const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
          return {
            month: parseInt(isoMatch[2], 10),
            day:   parseInt(isoMatch[3], 10)
          };
        }

        // dd/mm/yy ou dd/mm/yyyy (le plus courant pour les Européens/Caraïbes)
        const parts = raw.split('/');
        if (parts.length >= 2) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (!isNaN(d) && !isNaN(m) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return { day: d, month: m };
          }
        }

        // mm/dd/yyyy (US)
        const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (usMatch) {
          const m2 = parseInt(usMatch[1], 10);
          const d2 = parseInt(usMatch[2], 10);
          if (m2 <= 12 && d2 <= 31) {
            return { day: d2, month: m2 };
          }
        }

        return null;
      }

      const customers = [];

      // rows[0] = headers → on commence à l'index 1
      for (let i = 1; i < rows.length; i++) {
        const row      = rows[i] || [];
        const birthday = row[27] || '';   // colonne AB (index 27)
        if (!birthday) continue;

        const parsed = parseBirthdaySheet(birthday);
        if (!parsed) continue;

        if (parsed.day === todayDay && parsed.month === todayMonth) {
          customers.push({
            firstName: row[1] || '',   // colonne B
            lastName:  row[0] || '',   // colonne A
            email:     row[2] || '',   // colonne C
          });
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success:   true,
          customers: customers,
          count:     customers.length
        })
      };
    }




    // ==================== CHECK BIRTHDAY PROMO ELIGIBILITY ====================
if (action === 'check-birthday-promo-eligibility') {
  if (!email) {
    return { statusCode: 200, body: JSON.stringify({ success: false, reason: 'NOT_LOGGED_IN' }) };
  }

  const normalizedEmail = normalize(email);
  const userRowIndex    = rows.findIndex(row => normalize(row[2] || '') === normalizedEmail);

  if (userRowIndex === -1) {
    return { statusCode: 200, body: JSON.stringify({ success: false, reason: 'USER_NOT_FOUND' }) };
  }

  const userRow       = rows[userRowIndex] || [];
  const isSubscribed  = (userRow[5] || '').toLowerCase().trim() === 'yes';   // col F = newsletter
  const birthdayRaw   = (userRow[27] || '').trim();                           // col AB = birthday

  if (!isSubscribed) {
    return { statusCode: 200, body: JSON.stringify({ success: false, reason: 'NOT_SUBSCRIBED' }) };
  }

  if (!birthdayRaw) {
    return { statusCode: 200, body: JSON.stringify({ success: false, reason: 'NO_BIRTHDAY' }) };
  }

  // Parse birthday
  function parseBirthdayLocal(raw) {
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return { month: parseInt(isoMatch[2], 10), day: parseInt(isoMatch[3], 10) };
    const parts = raw.split('/');
    if (parts.length >= 2) {
      const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
      if (!isNaN(d) && !isNaN(m) && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { day: d, month: m };
    }
    const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
      const m2 = parseInt(usMatch[1], 10), d2 = parseInt(usMatch[2], 10);
      if (m2 <= 12 && d2 <= 31) return { day: d2, month: m2 };
    }
    return null;
  }

  const parsed  = parseBirthdayLocal(birthdayRaw);
  const today   = new Date();
  const isBday  = parsed && parsed.day === today.getDate() && parsed.month === (today.getMonth() + 1);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success:      true,
      isSubscribed: true,
      hasBirthday:  !!parsed,
      isBirthdayToday: isBday || false
    })
  };
}


// ==================== AFF UPDATE CLICK REWARD ====================
if (action === 'aff-update-click-reward') {
  if (!email) throw new Error("Email required");
  if (rowIndex === -1) throw new Error("User not found");

  const { clickRewardEarned = 0, clicksPerReward = 1000 } = body;

  // AD (index 29) = ClickRewardThreshold, AE (index 30) = ClickRewardEarned
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `bbw4life-accounts!AD${rowNum}:AE${rowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [[clicksPerReward, clickRewardEarned]] }
  });

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}





// ==================== GET ABANDONED CARTS (pour l'icône) ====================
    if (action === 'get-abandoned-carts') {
      if (!email) throw new Error("Email required");

      const abandonedSpreadsheetId = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;
      const abandonedRes = await sheets.spreadsheets.values.get({
        spreadsheetId: abandonedSpreadsheetId,
        range: "Abandoned_Carts!A:J"
      });
      const abandonedRows = abandonedRes.data.values || [];
      const normalizedEmail = normalize(email);

      const carts = [];
      for (let i = 1; i < abandonedRows.length; i++) { // skip header
        const row = abandonedRows[i];
        const [orderId, rowEmail, , , cartJson, , , createdAt, status] = row;
        if (!orderId || normalize(rowEmail || '') !== normalizedEmail) continue;
        if ((status || '').toLowerCase() !== 'abandoned') continue;

        let itemCount = 0;
        try {
          const cart = JSON.parse(cartJson || "[]");
          itemCount = cart.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0);
        } catch (e) {}

        carts.push({ orderId, createdAt: createdAt || '', itemCount });
      }

      carts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, carts, count: carts.length })
      };
    }






    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};