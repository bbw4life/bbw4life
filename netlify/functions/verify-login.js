const { google } = require("googleapis");

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
    const userPassword = normalize(password).toLowerCase();   // ← CORRECTION : toLowerCase + trim

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

    const rangesToTry = [
      "Feuille 1!A:N", "Feuille 1!A1", "Feuille 1", "Feuille 1!A:Z",
      "CurvaAccount!A:N", "CurvaAccount!A1", "CurvaAccount", "CurvaAccount!A:Z"
    ];

    let rows = null;
    for (const range of rangesToTry) {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        if (res.data.values && res.data.values.length > 0) {
          rows = res.data.values;
          console.log(`✅ LECTURE OK dans : ${range}`);
          break;
        }
      } catch (err) {}
    }

    if (!rows) throw new Error("Impossible de lire le Google Sheet");

    const userRow = rows.find((row) => {
      const sheetEmail = (row[2] || "").toLowerCase();
      const sheetPassword = (row[4] || "").trim().toLowerCase();   // ← CORRECTION ici aussi
      return sheetEmail === userEmail && sheetPassword === userPassword;
    });

    if (!userRow) {
      console.log("❌ Aucun utilisateur trouvé avec cet email/mot de passe");
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, error: "Email ou mot de passe incorrect" })
      };
    }

    const user = {
      lastName: userRow[0] || "",
      firstName: userRow[1] || "",
      email: userRow[2] || "",
      phone: userRow[3] || "",
      addressLine1: userRow[9] || "",
      line2: userRow[10] || "",
      city: userRow[11] || "",
      state: userRow[12] || "",
      zip: userRow[13] || ""
    };

    return { statusCode: 200, body: JSON.stringify({ success: true, user }) };

  } catch (error) {
    console.error("VERIFY LOGIN ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};