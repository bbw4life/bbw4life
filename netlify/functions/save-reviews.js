// netlify/functions/save-review.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action, fullName, email, title, rating, text, productId } = body;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });

    const reviewsSpreadsheetId = process.env.GOOGLE_SHEET_ID_REVIEWS;
    const accountsSpreadsheetId = process.env.GOOGLE_SHEET_ID_ACCOUNTS;

    function formatReviewDate() {
      const d = new Date();
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${d.getFullYear()}-${monthNames[d.getMonth()]}-${d.getDate().toString().padStart(2, '0')}`;
    }

    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

    if (action === 'save-review') {
      if (!fullName || !email || !title || !rating || !text || !productId) throw new Error("Toutes les données sont obligatoires");
      if (!email.includes('@')) throw new Error("Email invalide");

      const date = formatReviewDate();

      // Récupérer les images base64 (max 3), jointes par " | "
      const images = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
      const imagesCell = images.filter(Boolean).join(' | ');

      // Sauvegarder avec colonne H = images
      const values = [[fullName.trim(), email.trim(), title.trim(), rating, text.trim(), date, productId, imagesCell]];
      await sheets.spreadsheets.values.append({
        spreadsheetId: reviewsSpreadsheetId,
        range: "CustomersReviews!A:H",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values }
      });

      // Vérification compte + incrémentation Reviews Written (colonne I)
      const accountsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: accountsSpreadsheetId,
        range: "Feuille 1!A:Z"
      });
      const accountsRows = accountsRes.data.values || [];

      const accountRowIndex = accountsRows.findIndex(row => normalize(row[2] || "") === normalize(email));

      if (accountRowIndex !== -1) {
        const accountRowNum = accountRowIndex + 1;
        const currentRow = accountsRows[accountRowIndex] || [];
        let currentReviewsCount = parseInt(currentRow[8] || 0);
        const newReviewsCount = currentReviewsCount + 1;

        await sheets.spreadsheets.values.update({
          spreadsheetId: accountsSpreadsheetId,
          range: `Feuille 1!I${accountRowNum}`,
          valueInputOption: "RAW",
          resource: { values: [[newReviewsCount]] }
        });

        console.log(`✅ Reviews Written mis à jour pour ${email} → ${newReviewsCount}`);
      } else {
        console.log(`ℹ️ Email ${email} non trouvé dans les comptes`);
      }

      // Trigger email de remerciement
      fetch(`${process.env.URL}/.netlify/functions/send-email-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'review_thanks', email, firstName: fullName.trim().split(' ')[0] }),
      }).catch(e => console.warn('[Email] review_thanks trigger failed:', e.message));

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (action === 'get-reviews') {
      if (!productId) throw new Error("Product ID manquant");
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: reviewsSpreadsheetId,
        range: "CustomersReviews!A:Z"
      });
      const rows = res.data.values || [];

      const reviews = rows.slice(1)
        .filter(row => row[6] === productId)
        .map(row => ({
          fullName: row[0] || "",
          email: row[1] || "",
          title: row[2] || "",
          rating: parseInt(row[3]) || 5,
          text: row[4] || "",
          date: row[5] || "",
          images: row[7] ? row[7].split(' | ').filter(Boolean) : []
        }));

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, reviews })
      };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("REVIEWS ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};