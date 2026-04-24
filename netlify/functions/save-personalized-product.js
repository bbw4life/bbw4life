const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const {
      firstname = "",
      lastname  = "",
      email     = "",
      phone     = "",
      product_title = "",
      product_desc  = "",
      image1_base64 = "",
      image2_base64 = ""
    } = body;

    if (!firstname || !lastname || !email || !product_title) {
      throw new Error("Données manquantes (firstname, lastname, email, product_title requis)");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.PRODUCT_PERSONALIZED_GOOGLE_SHEET_ID;

    function formatDate() {
      const d = new Date();
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
    }

    function formatTime() {
      const d = new Date();
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    }

    const row = [[
      formatDate(),               // A - Date
      formatTime(),               // B - Time
      firstname.trim(),           // C - First Name
      lastname.trim(),            // D - Last Name
      email.trim().toLowerCase(), // E - Email
      phone.trim(),               // F - Phone
      product_title.trim(),       // G - Product Title
      product_desc.trim(),        // H - Product Description
      image1_base64 || "",        // I - Image 1 (base64)
      image2_base64 || "",        // J - Image 2 (base64)
      "New"                       // K - Status
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "CustoremersProductPersonalized!A:K",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: row }
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error("PERSONALIZED PRODUCT ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};