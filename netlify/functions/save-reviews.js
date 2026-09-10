// netlify/functions/save-review.js
process.removeAllListeners('warning');
const { google } = require('googleapis');
const { notifyReviewResponse } = require('./notify-email');
const { verifyAccountToken } = require('./account-token');


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

    const reviewsSpreadsheetId  = process.env.SHEET_ID_BBW4LIFE_CUSTOMERS_REVIEWS;
    const accountsSpreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;

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

      const images = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
      const imagesCell = images.filter(Boolean).join(' | ');

      const values = [[fullName.trim(), email.trim(), title.trim(), rating, text.trim(), date, productId, imagesCell]];
      await sheets.spreadsheets.values.append({
        spreadsheetId: reviewsSpreadsheetId,
        range: "bbw4life-customers-reviews!A:H",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values }
      });

      const accountsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: accountsSpreadsheetId,
        range: "bbw4life-accounts!A:Z"
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
          range: `bbw4life-accounts!I${accountRowNum}`,
          valueInputOption: "RAW",
          resource: { values: [[newReviewsCount]] }
        });

        console.log(`✅ Reviews Written mis à jour pour ${email} → ${newReviewsCount}`);
      } else {
        console.log(`ℹ️ Email ${email} non trouvé dans les comptes`);
      }

      await notifyReviewResponse({
        email,
        firstName: fullName.trim().split(' ')[0],
        title,
        text,
        productId
      }).catch(e => console.warn('[ReviewEmail] Failed:', e.message));

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (action === 'get-reviews') {
      if (!productId) throw new Error("Product ID manquant");
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: reviewsSpreadsheetId,
        range: "bbw4life-customers-reviews!A:Z"
      });
      const rows = res.data.values || [];

      const reviews = rows.slice(1)
        // row[0] (fullName) est obligatoire pour un vrai avis (voir action
        // 'save-review' ci-dessus) — exclut la ligne "compteur de likes"
        // dédiée par produit (action 'like-vote' plus bas), qui elle n'a
        // que G (productId) + I/J/K remplis, sans fullName.
        .filter(row => row[6] === productId && row[0])
        .map(row => ({
          fullName: row[0] || "",
          email:    row[1] || "",
          title:    row[2] || "",
          rating:   parseInt(row[3]) || 5,
          text:     row[4] || "",
          date:     row[5] || "",
          images:   row[7] ? row[7].split(' | ').filter(Boolean) : []
        }));

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, reviews })
      };
    }

    // ── LIKE / DISLIKE PRODUIT ─────────────────────────────────────
    // Même feuille que les avis (bbw4life-customers-reviews) — une ligne
    // dédiée par produit (identifiée par G=productId, A=fullName vide)
    // porte le compteur cumulatif : I=likes, J=dislikes, K=voters (JSON
    // stringifié { "email_ou_anonId": "like"|"dislike" }), pour permettre
    // à un votant de changer d'avis sans compter deux fois.
    if (action === 'like-vote' || action === 'get-likes') {
      const { voteType, anonId } = body;
      const token = body.token;
      if (!productId) throw new Error("Product ID manquant");

      // Identité du votant : compte connecté (token HMAC vérifié) sinon
      // anonId généré/persisté côté client (localStorage) — jamais un
      // simple email non vérifié, contrairement à 'save-review' plus haut.
      let voterKey = null;
      if (email && token) {
        if (!verifyAccountToken(email, token)) {
          return { statusCode: 401, body: JSON.stringify({ success: false, error: "Unauthorized" }) };
        }
        voterKey = normalize(email);
      } else if (anonId) {
        voterKey = String(anonId).trim();
      }
      if (!voterKey) throw new Error("Identité du votant manquante");

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: reviewsSpreadsheetId,
        range: "bbw4life-customers-reviews!A:K"
      });
      const rows = res.data.values || [];

      // La ligne "compteur likes" du produit : G=productId ET A vide.
      const likeRowIndex = rows.findIndex((row, i) => i > 0 && row[6] === productId && !row[0]);

      let likes = 0, dislikes = 0, voters = {};
      if (likeRowIndex !== -1) {
        const row = rows[likeRowIndex];
        likes    = parseInt(row[8]  || 0) || 0;
        dislikes = parseInt(row[9]  || 0) || 0;
        try { voters = row[10] ? JSON.parse(row[10]) : {}; } catch (e) { voters = {}; }
      }

      if (action === 'get-likes') {
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, likes, dislikes, myVote: voters[voterKey] || null })
        };
      }

      // action === 'like-vote'
      if (voteType !== 'like' && voteType !== 'dislike') throw new Error("Type de vote invalide");

      const previousVote = voters[voterKey] || null;
      if (previousVote === voteType) {
        // Déjà voté pareil — pas de double comptage, renvoie l'état actuel.
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, likes, dislikes, myVote: voteType })
        };
      }
      if (previousVote === 'like') likes = Math.max(0, likes - 1);
      if (previousVote === 'dislike') dislikes = Math.max(0, dislikes - 1);
      if (voteType === 'like') likes += 1;
      if (voteType === 'dislike') dislikes += 1;
      voters[voterKey] = voteType;

      if (likeRowIndex !== -1) {
        const rowNum = likeRowIndex + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: reviewsSpreadsheetId,
          range: `bbw4life-customers-reviews!I${rowNum}:K${rowNum}`,
          valueInputOption: "RAW",
          resource: { values: [[likes, dislikes, JSON.stringify(voters)]] }
        });
      } else {
        // Première interaction sur ce produit : crée la ligne compteur.
        // A-F et H vides (ce n'est pas un avis), G=productId, I/J/K remplis.
        await sheets.spreadsheets.values.append({
          spreadsheetId: reviewsSpreadsheetId,
          range: "bbw4life-customers-reviews!A:K",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values: [["", "", "", "", "", "", productId, "", likes, dislikes, JSON.stringify(voters)]] }
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, likes, dislikes, myVote: voteType })
      };
    }

    throw new Error("Action inconnue");
  } catch (error) {
    console.error("REVIEWS ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};