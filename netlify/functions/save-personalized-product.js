// netlify/functions/save-personalized-product.js
process.removeAllListeners('warning');
const { google } = require('googleapis');
const { notifyTelegram } = require('./notify-telegram');
const { notifyCustomProduct } = require('./notify-email');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_PLAN_REQUEST;
    const SHEET_NAME = "bbw4life-product-personalized";

    function getAuth() {
      return new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });
    }

    function formatDate() {
      const d = new Date();
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
    }

    function formatTime() {
      const d = new Date();
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    }

    // ════════════════════════════════════════
    // ACTION : get_votes
    // ════════════════════════════════════════
    if (body.action === 'get_votes') {
      const sheets  = google.sheets({ version: "v4", auth: getAuth() });
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A:Q`
      });

      const rows   = readRes.data.values || [];
      const result = {};

      // Les votes sont dans col N=action, O=group, P=vote value
      rows.forEach(row => {
        if (row[13] === 'vote' && row[14] && row[15]) {
          const group = row[14];
          const val   = row[15];
          if (!result[group]) result[group] = {};
          result[group][val] = (result[group][val] || 0) + 1;
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, votes: result })
      };
    }

    // ════════════════════════════════════════
    // ACTION : vote
    // ════════════════════════════════════════
    if (body.action === 'vote') {
      const { group = "", val: voteVal = "" } = body;
      if (!group || !voteVal) throw new Error("group et val requis");

      const sheets = google.sheets({ version: "v4", auth: getAuth() });

      // Ajouter une ligne avec colonnes A-M vides, N=vote, O=group, P=value, Q=timestamp
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A:Q`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [[
            formatDate(), // A
            formatTime(), // B
            "",           // C - First Name
            "",           // D - Last Name
            "",           // E - Email
            "",           // F - Phone
            "",           // G - Size 
            "",           // H - Color
            "",           // I - Product Title
            "",           // J - Product Description
            "",           // K - Image 1
            "",           // L - Image 2
            "",           // M - Status
            "vote",       // N - Action
            group,        // O - Group
            voteVal,      // P - Vote Value
            new Date().toISOString() // Q - Timestamp
          ]]
        }
      });

      // Relire et compter
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A:Q`
      });

      const rows   = readRes.data.values || [];
      const counts = {};

      rows.forEach(row => {
        if (row[13] === 'vote' && row[14] === group && row[15]) {
          counts[row[15]] = (counts[row[15]] || 0) + 1;
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, counts })
      };
    }

    // ════════════════════════════════════════
    // ACTION : waitlist
    // ════════════════════════════════════════
    if (body.action === 'waitlist') {
      const waitlistEmail = (body.email || "").trim().toLowerCase();
      if (!waitlistEmail || !waitlistEmail.includes('@')) {
        throw new Error("Email invalide");
      }

      const sheets = google.sheets({ version: "v4", auth: getAuth() });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A:Q`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [[
            formatDate(), // A
            formatTime(), // B
            "",           // C
            "",           // D
            waitlistEmail,// E - Email
            "",           // F
            "",           // G
            "",           // H
            "",           // I
            "",           // J
            "",           // K
            "",           // L
            "",           // M
            "waitlist",   // N - Action
            "",           // O
            "",           // P
            new Date().toISOString() // Q
          ]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }


    if (body.action === 'suggestion') {
  const suggestStyle = (body.suggest_style || '').trim();
  const suggestColor = (body.suggest_color || '').trim();
  const suggestNote  = (body.suggest_note  || '').trim();

  if (!suggestStyle && !suggestColor) {
    throw new Error("Au moins un champ requis");
  }

  const sheets = google.sheets({ version: "v4", auth: getAuth() });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:Q`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [[
        formatDate(),
        formatTime(),
        "",
        "",
        "",
        "",
        "",
        "",
        suggestStyle,
        suggestNote,
        "",
        "",
        "",
        "suggestion",
        suggestStyle,
        suggestColor,
        new Date().toISOString()
      ]]
    }
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

    // ════════════════════════════════════════
    // ACTION : Dream Product (défaut)
    // ════════════════════════════════════════
    const {
      firstname     = "",
      lastname      = "",
      email         = "",
      phone         = "",
      size          = "",
      color         = "",
      product_title = "",
      product_desc  = "",
      image1_base64 = "",
      image2_base64 = ""
    } = body;

    if (!firstname || !lastname || !email || !product_title) {
      throw new Error("Données manquantes (firstname, lastname, email, product_title requis)");
    }

    const sheets = google.sheets({ version: "v4", auth: getAuth() });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [[
          formatDate(),               // A - Date
          formatTime(),               // B - Time
          firstname.trim(),           // C - First Name
          lastname.trim(),            // D - Last Name
          email.trim().toLowerCase(), // E - Email
          phone.trim(),               // F - Phone
          size.trim(),                // G - Size
          color.trim(),               // H - Color
          product_title.trim(),       // I - Product Title
          product_desc.trim(),        // J - Product Description
          image1_base64 || "",        // K - Image 1
          image2_base64 || "",        // L - Image 2
          "New",                      // M - Status
          "dream_product",            // N - Action
          "",                         // O
          "",                         // P
          new Date().toISOString()    // Q - Timestamp
        ]]
      }
    });

    await notifyTelegram(
      `🎨 <b>Pdg Francenel, un client vient de demander un produit personnalisé!</b>\n\n` +
      `👤 <b>Nom:</b> ${firstname} ${lastname}\n` +
      `📧 <b>Email:</b> ${email}\n` +
      `👗 <b>Produit demandé:</b> ${product_title}`
    );

    notifyCustomProduct({ email: email.trim().toLowerCase(), firstName: firstname.trim(), firstname: firstname.trim(), productTitle: product_title.trim(), productDesc: product_desc.trim() }).catch(() => {});

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error("PERSONALIZED PRODUCT ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};