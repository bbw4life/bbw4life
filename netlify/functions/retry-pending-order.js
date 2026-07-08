// retry-pending-order.js - VERSION AMÉLIORÉE (traite un par un sans se bloquer)
process.removeAllListeners('warning');
const { google } = require("googleapis");
const fetch = require("node-fetch");

// ── Délai entre deux appels CJ pour respecter le rate-limit (~1 req/s) ──
const CJ_REQUEST_DELAY_MS = 1100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ── Auth CJ ─────────────────────────────────────────────────────
async function getCJAccessToken() {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
  });
  const data = await res.json();
  if (!data.result || !data.data?.accessToken) {
    throw new Error('CJ auth failed: ' + (data.message || JSON.stringify(data)));
  }
  return data.data.accessToken;
}

// ── Interroge CJ pour obtenir le vrai fromCountryCode (entrepôt) ──
// Basé sur le vid, via l'entrepôt qui a le plus de stock disponible.
async function getCJFromCountryCode(vid, token) {
  try {
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "CJ-Access-Token": token }
    });
    const responseText = await response.text();

    let data = {};
    try { data = JSON.parse(responseText); } catch {}

    if (data.result === true && Array.isArray(data.data) && data.data.length > 0) {
      const best = data.data.reduce((max, w) =>
        (Number(w.totalInventoryNum) || 0) > (Number(max.totalInventoryNum) || 0) ? w : max
      , data.data[0]);

      const code = best.countryCode || best.areaEn || '';
      if (code) return String(code).toUpperCase();
    }

    console.log(`   ⚠️ Aucun countryCode trouvé pour vid ${vid} | Réponse: ${responseText.slice(0, 200)}`);
  } catch (err) {
    console.error(`   ❌ Erreur getCJFromCountryCode (vid ${vid}):`, err.message);
  }
  return null;
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

    // ── Lire jusqu'à la colonne U (fromCountryCode) ──
    const rangesToTry = ["bbw4life-pending-orders!A:U"];
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

      // ── Résolution countryCode (destination) ──
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

        if (fulfillmentMethod === 'cj') {
          // ── Vérifier colonne L (pid) et colonne M (vid) ──
          const pid = firstRow[11] || '';
          const vid = firstRow[12] || '';
          console.log(`   🔎 Vérification produit CJ → pid (col L): ${pid || '(vide)'} | vid (col M): ${vid || '(vide)'}`);

          if (!pid) throw new Error(`Colonne L (cj_product_id) vide pour paymentId ${paymentId}`);
          if (!vid) throw new Error(`Colonne M (variant_id) vide pour paymentId ${paymentId}`);

          // ── Interroger l'API CJ pour obtenir le vrai fromCountryCode ──
          let resolvedFromCountryCode = (firstRow[20] || '').toUpperCase().trim();
          try {
            const cjToken = await getCJAccessToken();
            const apiCountryCode = await getCJFromCountryCode(vid, cjToken);

            if (apiCountryCode) {
              resolvedFromCountryCode = apiCountryCode;
              console.log(`   ✅ fromCountryCode résolu via API CJ: ${resolvedFromCountryCode} (vid: ${vid})`);

              // Écrire la vraie valeur dans la colonne U pour toutes les lignes du groupe
              for (const { lineNumber } of group) {
                await sheets.spreadsheets.values.update({
                  spreadsheetId,
                  range: `bbw4life-pending-orders!U${lineNumber}`,
                  valueInputOption: "RAW",
                  resource: { values: [[resolvedFromCountryCode]] }
                });
              }
            } else {
              console.log(`   ⚠️ API CJ n'a renvoyé aucun countryCode, on garde la valeur existante: ${resolvedFromCountryCode || '(vide)'}`);
            }
          } catch (err) {
            console.error(`   ❌ Erreur résolution fromCountryCode via API: ${err.message}`);
          }

          shipping.fromCountryCode = resolvedFromCountryCode;

          // ── Pause avant d'envoyer la commande à CJ, pour ne pas enchaîner
          //    trop vite après l'appel stock/queryByVid (rate-limit CJ ~1 req/s) ──
          console.log(`   ⏳ Pause ${CJ_REQUEST_DELAY_MS}ms avant l'envoi de la commande à CJ...`);
          await sleep(CJ_REQUEST_DELAY_MS);

          // ── CJ : besoin de cj_product_id (colonne L) + variant_id ──
          endpoint = `${process.env.BASE_URL}/.netlify/functions/create-cj-order`;
          cartPayload = group.map(({ row }) => ({
            cj_product_id: row[11] || "",   // colonne L
            cj_variant_id: row[12] || "",   // colonne M
            variantsid:    row[12] || "",   // alias pour compatibilité
            quantity:      parseInt(row[13]) || 1
          }));
          console.log(` → Envoi à create-cj-order`);

        } else {
          // ── Eprolo (défaut) : seulement variant_id ──
          endpoint = `${process.env.BASE_URL}/.netlify/functions/create-eprolo-order`;
          cartPayload = Object.keys(cartMap).map(v => ({
            variantsid: v,
            quantity:   cartMap[v]
          }));
          console.log(` → Envoi à create-eprolo-order`);
        }

        const createRes = await fetch(endpoint, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ cart: cartPayload, shipping })
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
          // ── NOUVEAU : sauvegarder le cj_order_id en colonne V (pour le tracking CJ) ──
          if (fulfillmentMethod === 'cj' && createData.orderId) {
            for (const { lineNumber } of group) {
              await sheets.spreadsheets.values.update({
                spreadsheetId,
                range:            `bbw4life-pending-orders!V${lineNumber}`,
                valueInputOption: "RAW",
                resource: { values: [[createData.orderId]] }
              });
            }
            console.log(` 🆔 cj_order_id sauvegardé : ${createData.orderId}`);
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