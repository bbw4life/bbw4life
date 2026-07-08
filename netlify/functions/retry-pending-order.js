// retry-pending-order.js - 
process.removeAllListeners('warning');
const { google } = require("googleapis");
const fetch = require("node-fetch");

// ── Lit le switch global Yes/No depuis l'onglet Settings ──
async function getAutoFulfillMode(sheets, spreadsheetId) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Settings!A1"
    });
    const value = (res.data.values?.[0]?.[0] || "yes").trim().toLowerCase();
    return value === "no" ? "no" : "yes";
  } catch (e) {
    console.log('[RETRY PENDING] Onglet Settings introuvable, mode par défaut: yes');
    return "yes";
  }
}

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

    // ── Lire jusqu'à la colonne T ──
    const rangesToTry = ["bbw4life-pending-orders!A:T"];
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

    const autoMode = await getAutoFulfillMode(sheets, spreadsheetId);
    console.log(`[RETRY PENDING] Mode auto-fulfill : ${autoMode.toUpperCase()}`);

    const dataRows = rows.slice(1);
    const groups = {};
    dataRows.forEach((row, index) => {
      const paymentId = row[2] || "";
      const status = (row[14] || "").toLowerCase();

      const shouldProcess = autoMode === "yes"
        ? (status === "pending" || status === "failed")
        : (status === "approved");

      if (shouldProcess) {
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

      // ── Shipping (colonnes A→R inchangées) ──
      const shipping = {
        fullName:        firstRow[3]  || "",
        email:           firstRow[4]  || "",
        phone:           firstRow[5]  || "",
        country:         firstRow[6]  || "Canada",
        state:           firstRow[7]  || "",
        city:            firstRow[8]  || "",
        postalCode:      firstRow[9]  || "",
        address:         firstRow[10] || "",
        shipping_method: firstRow[17] || "Standard Shipping",
      };

      // ── Résolution countryCode ──
      let countryCode = 'CA';
      try {
        const countryRes = await fetch(
          `https://restcountries.com/v3.1/name/${encodeURIComponent(shipping.country)}?fullText=true&fields=cca2`
        );
        if (countryRes.ok) countryCode = (await countryRes.json())[0]?.cca2 || 'CA';
      } catch {}
      shipping.countryCode  = countryCode;
      shipping.provinceCode = shipping.state.substring(0, 2).toUpperCase() || '';

      // ── Lire fulfillment_method depuis colonne T (index 19) ──
      const fulfillmentMethod = (firstRow[19] || 'eprolo').toLowerCase().trim();
      console.log(` 🚚 Fulfillment: ${fulfillmentMethod.toUpperCase()} | PaymentID: ${paymentId}`);

      // ── Construire cartMap depuis colonne M (index 12 = variant_id) ──
      const cartMap = {};
      group.forEach(({ row }) => {
        const variantsid = row[12] || "";
        const quantity   = parseInt(row[13]) || 1;
        if (variantsid) cartMap[variantsid] = (cartMap[variantsid] || 0) + quantity;
      });

      try {
        let endpoint;
        let cartPayload;
        let fromCountryCode = null;

        if (fulfillmentMethod === 'cj') {
          // ── CJ : besoin de cj_product_id (colonne L, index 11) + variant_id ──
          endpoint = `${process.env.BASE_URL}/.netlify/functions/create-cj-order`;
          cartPayload = group.map(({ row }) => ({
            cj_product_id: row[11] || "",   // colonne L
            cj_variant_id: row[12] || "",   // colonne M
            variantsid:    row[12] || "",   // alias pour compatibilité
            quantity:      parseInt(row[13]) || 1
          }));

          // ── NOUVEAU : récupérer le fromCountryCode via fetch-cj-stock.js ──
          const vids = [...new Set(group.map(({ row }) => row[12]).filter(Boolean))];
          const originsByVid = {};

          try {
            const stockRes = await fetch(`${process.env.BASE_URL}/.netlify/functions/fetch-cj-stock`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vids })
            });
            const stockData = await stockRes.json();
            if (stockData.success && stockData.origins) {
              Object.assign(originsByVid, stockData.origins);
              console.log(` 🌍 Origines CJ récupérées :`, originsByVid);
            } else {
              console.log(` ⚠️ Impossible de récupérer les origines CJ :`, stockData.error || 'réponse invalide');
            }
          } catch (stockErr) {
            console.log(` ⚠️ Erreur appel fetch-cj-stock :`, stockErr.message);
          }

          // ── Écrire fromCountryCode en colonne U pour CHAQUE ligne de la commande ──
          for (const { row, lineNumber } of group) {
            const vid = row[12] || "";
            const originCode = originsByVid[vid] || 'CN';
            try {
              await sheets.spreadsheets.values.update({
                spreadsheetId,
                range:            `bbw4life-pending-orders!U${lineNumber}`,
                valueInputOption: "RAW",
                resource: { values: [[originCode]] }
              });
            } catch (writeErr) {
              console.log(` ⚠️ Échec écriture colonne U ligne ${lineNumber} :`, writeErr.message);
            }
          }

          // ── fromCountryCode global de la commande = celui du 1er variant ──
          const firstVid = group[0].row[12] || "";
          fromCountryCode = originsByVid[firstVid] || 'CN';

          console.log(` → Envoi à create-cj-order (fromCountryCode: ${fromCountryCode})`);

        } else {
          // ── Eprolo (défaut) : seulement variant_id ──
          endpoint = `${process.env.BASE_URL}/.netlify/functions/create-eprolo-order`;
          cartPayload = Object.keys(cartMap).map(v => ({
            variantsid: v,
            quantity:   cartMap[v]
          }));
          console.log(` → Envoi à create-eprolo-order`);
        }

        const requestBody = { cart: cartPayload, shipping };
        if (fulfillmentMethod === 'cj') requestBody.fromCountryCode = fromCountryCode;

        const createRes = await fetch(endpoint, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(requestBody)
        });
        const createData = await createRes.json();

        if (createData.success) {
          for (const { lineNumber } of group) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range:            `bbw4life-pending-orders!O${lineNumber}`,
              valueInputOption: "RAW",
              resource: { values: [["successful"]] }
            });
          }
          successCount++;
          console.log(` ✅ SUCCÈS pour ${paymentId}`);
        } else {
          throw new Error(createData.error || `Échec ${fulfillmentMethod}`);
        }

      } catch (err) {
        console.error(` ❌ ÉCHEC pour ${paymentId}: ${err.message}`);
        for (const { lineNumber } of group) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range:            `bbw4life-pending-orders!O${lineNumber}`,
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