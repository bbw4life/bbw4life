// retry-pending-order.js - VERSION AMÉLIORÉE (traite un par un sans se bloquer)
const { google } = require("googleapis");
const fetch = require("node-fetch");

exports.handler = async () => {
  console.log('[RETRY PENDING] 🚀 Démarrage - ' + new Date().toISOString());
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;

    const rangesToTry = ["bbw4life-pending-orders!A:R"];
    let rows = [];
    let activeTab = "";
    for (const range of rangesToTry) {
      try {
        const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        rows = getRes.data.values || [];
        if (rows.length > 1) {
          activeTab = range.split('!')[0];
          console.log(`[RETRY PENDING] ✅ Onglet détecté : ${activeTab} (${rows.length} lignes)`);
          break;
        }
      } catch (e) {}
    }

    if (rows.length <= 1) {
      console.log('[RETRY PENDING] Aucune commande en attente');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    const dataRows = rows.slice(1);
    const groups = {};
    dataRows.forEach((row, index) => {
      const paymentId = row[2] || "";
      const status = (row[14] || "").toLowerCase();
      if (status === "pending" || status === "failed") {
        if (!groups[paymentId]) groups[paymentId] = [];
        groups[paymentId].push({ row, lineNumber: index + 2 });
      }
    });

    const paymentIds = Object.keys(groups);
    if (paymentIds.length === 0) {
      console.log('[RETRY PENDING] Aucune commande à traiter');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    console.log(`[RETRY PENDING] ${paymentIds.length} commande(s) à traiter (une par une)`);

    let processed = 0;
    let successCount = 0;

    for (const paymentId of paymentIds) {
      const group = groups[paymentId];
      processed++;

      const firstRow = group[0].row;
      const shipping = {
        fullName: firstRow[3] || "",
        email: firstRow[4] || "",
        phone: firstRow[5] || "",
        country: firstRow[6] || "Canada",
        state: firstRow[7] || "",
        city: firstRow[8] || "",
        postalCode: firstRow[9] || "",
        address: firstRow[10] || "",
        shipping_method: firstRow[17] || "Standard Shipping",
      };
      let countryCode = 'CA';
      try {
        const countryRes = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(shipping.country)}?fullText=true&fields=cca2`);
        if (countryRes.ok) countryCode = (await countryRes.json())[0]?.cca2 || 'CA';
      } catch {}
      shipping.countryCode = countryCode;
      shipping.provinceCode = shipping.state.substring(0, 2).toUpperCase() || '';

      const cartMap = {};
      group.forEach(({ row }) => {
        const variantsid = row[12] || "";
        const quantity = parseInt(row[13]) || 1;
        if (variantsid) cartMap[variantsid] = (cartMap[variantsid] || 0) + quantity;
      });
      const cart = Object.keys(cartMap).map(v => ({ variantsid: v, quantity: cartMap[v] }));

      try {
        const createRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/create-eprolo-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping })
        });
        const createData = await createRes.json();

        if (createData.success) {
          for (const { lineNumber } of group) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `bbw4life-pending-orders!O${lineNumber}`,
              valueInputOption: "RAW",
              resource: { values: [["successful"]] }
            });
          }
          successCount++;
          console.log(` ✅ SUCCÈS pour ${paymentId}`);
        } else {
          throw new Error(createData.error || "Échec Eprolo");
        }
      } catch (err) {
        console.error(` ❌ ÉCHEC pour ${paymentId}: ${err.message}`);
        for (const { lineNumber } of group) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `bbw4life-pending-orders!O${lineNumber}`,
            valueInputOption: "RAW",
            resource: { values: [["failed"]] }
          });
        }
      }

      await new Promise(r => setTimeout(r, 1200));
    }

    console.log(`[RETRY PENDING] ✅ FIN - Traités: ${processed} | Réussis: ${successCount}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed, fulfilled: successCount }) };
  } catch (error) {
    console.error("RETRY ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};