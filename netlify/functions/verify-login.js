process.removeAllListeners('warning');
const { google } = require("googleapis");
const { generateAccountToken } = require('./account-token');
const { hashPassword, verifyPassword, isHashedPassword } = require('./_lib/password');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      throw new Error("Email et mot de passe requis");
    }

    const normalize = (str) =>
      str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim() : "";

    const userEmail = normalize(email).toLowerCase();
    const userPassword = normalize(password).toLowerCase();

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "bbw4life-accounts!A:AF"
    });
    const rows = res.data.values || [];

    if (!rows || rows.length === 0) throw new Error("Impossible de lire le Google Sheet");

    const rowIndex = rows.findIndex((row) => (row[2] || "").toLowerCase() === userEmail);
    const userRow  = rowIndex !== -1 ? rows[rowIndex] : null;

    let passwordMatches = false;
    if (userRow) {
      const storedPassword = (userRow[4] || "").trim();

      if (isHashedPassword(storedPassword)) {
        // ── Compte déjà migré : vérification via scrypt ──
        passwordMatches = verifyPassword(userPassword, storedPassword);
      } else {
        // ── Ancien compte en clair : comparaison directe (comportement historique) ──
        passwordMatches = storedPassword.toLowerCase() === userPassword;

        // Migration progressive et transparente : on hash immédiatement si le mot de
        // passe en clair est correct, sans jamais casser le compte existant.
        if (passwordMatches) {
          try {
            const newHash = hashPassword(userPassword);
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `bbw4life-accounts!E${rowIndex + 1}`,
              valueInputOption: "RAW",
              resource: { values: [[newHash]] }
            });
          } catch (e) {
            console.warn("[verify-login] Password migration to hash failed:", e.message);
          }
        }
      }
    }

    if (!userRow || !passwordMatches) {
      console.log("❌ No user found with this email/password");
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, error: "Incorrect email or password" })
      };
    }
    // ── Block if account is not confirmed (column AF) ──
    const emailConfirmed = (userRow[31] || '').toLowerCase().trim();
    if (emailConfirmed !== 'yes') {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: "EMAIL_NOT_CONFIRMED" })
      };
    }
    const user = {
      lastName:     userRow[0]  || "",
      firstName:    userRow[1]  || "",
      email:        userRow[2]  || "",
      phone:        userRow[3]  || "",
      addressLine1: userRow[9]  || "",
      line2:        userRow[10] || "",
      city:         userRow[11] || "",
      state:        userRow[12] || "",
      zip:          userRow[13] || ""
    };

    // ── Génère un token lié à cet email pour sécuriser les futures requêtes ──
    const token = generateAccountToken(user.email);

    return { statusCode: 200, body: JSON.stringify({ success: true, user, token }) };

  } catch (error) {
    console.error("VERIFY LOGIN ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};