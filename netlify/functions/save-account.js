// netlify/functions/save-account.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action = 'signup', lastName, firstName, email, phone = "", password, newsletter = "No",
            line1, line2, city, state, zip, newPassword,
            totalAmount = 0, totalQuantity = 0, orderItems = [],
            currentCartQuantity = null } = body;

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

    function formatDate() {
      const d = new Date();
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
    }

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Feuille 1!A:Z" });
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
        spreadsheetId, range: "Feuille 1!A:Z", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", resource: { values }
      });
      // Trigger email de bienvenue (fire-and-forget, ne bloque pas la réponse)
      fetch(`${process.env.URL}/.netlify/functions/send-email-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'welcome', email, firstName, lastName, newsletter }),
      }).catch(e => console.warn('[Email] welcome trigger failed:', e.message));

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE PROFILE PHOTO ====================
    if (action === 'update-profile-photo') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      const { photoBase64 } = body;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Feuille 1!R${rowNum}`,
        valueInputOption: "RAW",
        resource: { values: [[photoBase64 || ""]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE ADDRESS ====================
    if (action === 'update-address') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `Feuille 1!J${rowNum}:N${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[line1 || "", line2 || "", city || "", state || "", zip || ""]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE PASSWORD ====================
    if (action === 'update-password') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `Feuille 1!E${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[normalize(newPassword)]] }
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ==================== UPDATE CART QUANTITY ====================
    if (action === 'update-cart-quantity') {
      if (rowIndex === -1) throw new Error("Utilisateur non trouvé");
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `Feuille 1!O${rowNum}`, valueInputOption: "RAW",
        resource: { values: [[currentCartQuantity]] }
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
            { range: `Feuille 1!G${rowNum}`, values: [[newOrders]] },
            { range: `Feuille 1!H${rowNum}`, values: [[newSpent]] },
            { range: `Feuille 1!Q${rowNum}`, values: [[JSON.stringify(history)]] }
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
          orders: parseInt(currentRow[6] || 0),
          totalSpent: parseFloat(currentRow[7] || 0),
          quantityInCart: parseInt(currentRow[14] || 0),
          history: history,
          memberSince: currentRow[15] || "January 2026",
          points: parseInt(currentRow[6] || 0) * 10,
          reviewsCount: parseInt(currentRow[8] || 0),
          profilePhoto: currentRow[17] || ""
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
        // Mise à jour seulement Newsletter = Yes (colonne F)
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Feuille 1!F${rowNum}`,
            valueInputOption: "RAW",
            resource: { values: [["Yes"]] }
        });
    } else {
        // Nouvel abonné (email bien en colonne C, téléphone vide en D)
        const rowData = [
            "", "", normalizedEmail, "", "", "Yes",   // A B C D E F
            0, 0, 0, "", "", "", "", "", 0,           // G à O
            formatDate(), "[]"                        // P Q
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: "Feuille 1!A:Z",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            resource: { values: [rowData] }   // ← IMPORTANT : tableau 2D
        });
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("SAVE ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};