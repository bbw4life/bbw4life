// netlify/functions/save-account.js
process.removeAllListeners('warning');
const { google } = require('googleapis');
const { verifyAccountToken } = require('./account-token');
const { notifyWelcome, notifyNewsletter1 } = require('./notify-email');

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
      'aff-withdraw-request'
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
      const passNormalized = normalize(password);
      const memberSince = formatDate();
      const values = [[normalize(lastName), normalize(firstName), normalize(email), normalize(phone), passNormalized, newsletter,
                       0, 0, 0, "", "", "", "", "", 0, memberSince, "[]"]];
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: "bbw4life-accounts!A:Z", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", resource: { values }
      });

      notifyWelcome({ email, firstName, lastName }).catch(() => {});

      // ── Email Newsletter #1 ──
      if ((newsletter || '').toLowerCase() === 'yes') {
        notifyNewsletter1({ email, firstName }).catch(() => {});
      }

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


    // ==================== RESET PASSWORD (Forgot Password) ====================
    if (action === 'reset-password') {
      const { newPassword } = body;
      if (!email || !newPassword) throw new Error("Email and new password are required");

      const normalizedEmail = normalize(email).toLowerCase();
      const rowIdx = rows.findIndex(row => normalize(row[2] || "").toLowerCase() === normalizedEmail);

      if (rowIdx === -1) {
        return {
          statusCode: 200,
          body: JSON.stringify({ success: false, error: 'EMAIL_NOT_FOUND' })
        };
      }

      const targetRow = rowIdx + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `bbw4life-accounts!E${targetRow}`,
        valueInputOption: "RAW",
        resource: { values: [[normalize(newPassword).toLowerCase()]] }
      });

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE PASSWORD ====================
    if (action === 'update-password') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `bbw4life-accounts!E${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[normalize(newPassword)]] }
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
          savedCart:      currentRow[28] || "[]"
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


    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};