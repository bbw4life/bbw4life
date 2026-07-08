// fetch-cj-products.js — RÉCUPÉRATION DES VARIANTS CJ DROPSHIPPING
process.removeAllListeners('warning');

// ══════════════════════════════════════════════════════════════
//  Liste des Product IDs CJ à interroger.
// ══════════════════════════════════════════════════════════════
const PRODUCT_IDS = [
  { pid: "2604220334371632700" },
  { pid: "1357502084664135680" },
  { pid: "1357502084664135680" },
];

const SEP  = "═".repeat(80);
const SEP2 = "─".repeat(80);

// ── Auth : Access Token CJ (même logique que create-cj-order.js) ──
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.handler = async (event) => {
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  log(SEP);
  log("  CJ DROPSHIPPING — RÉCUPÉRATION DES VARIANTS");
  log(`  Liste : ${PRODUCT_IDS.length} produit(s)`);
  log(SEP);

  if (!process.env.CJ_API_KEY) {
    log("  ❌  CJ_API_KEY manquant dans les variables d'environnement Netlify");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: "CJ_API_KEY missing in env", logs })
    };
  }

  if (!PRODUCT_IDS.length) {
    log("  ⚠️  Aucun product id CJ configuré (tableau PRODUCT_IDS vide).");
    log("  →  Ajoute tes pid dans PRODUCT_IDS en haut du fichier, puis relance.");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, total: 0, logs, products: [] })
    };
  }

  try {
    // ── 1) Auth ────────────────────────────────────────────────
    const token = await getCJAccessToken();
    log("  🔑  Access token CJ obtenu");
    log(SEP2);

    // ── 2) Boucle SÉQUENTIELLE (CJ impose un rate-limit strict) ──
    const allProducts = [];

    for (const entry of PRODUCT_IDS) {
      const pid   = entry.pid;
      const label = entry.label || pid;

      try {
        const url = `https://developers.cjdropshipping.com/api2.0/v1/product/variant/query?pid=${encodeURIComponent(pid)}`;

        const response     = await fetch(url, {
          method: "GET",
          headers: { "CJ-Access-Token": token }
        });
        const responseText = await response.text();

        let data = {};
        try { data = JSON.parse(responseText); } catch {}

        if (data.result === true && Array.isArray(data.data)) {
          log(`  ✅  ${pid}  →  OK  (${data.data.length} variant(s))  [${label}]`);
          allProducts.push({ pid, label, variants: data.data });
        } else {
          const errMsg = data.message || responseText.slice(0, 200) || 'réponse invalide';
          log(`  ⚠️  ${pid}  →  ERREUR : ${errMsg}  [${label}]`);
        }

      } catch (err) {
        log(`  ❌  ${pid}  →  EXCEPTION : ${err.message}  [${label}]`);
      }

      // Pause entre chaque appel pour respecter le rate-limit CJ (~1 req/s)
      await sleep(400);
    }

    log(SEP);
    log(`  TOTAL RÉCUPÉRÉS : ${allProducts.length} / ${PRODUCT_IDS.length}`);
    log(SEP);

    allProducts.forEach((product, index) => {
      const varCount = product.variants.length;

      log("");
      log(SEP);
      log(`  [${String(index + 1).padStart(2, '0')}]  ${product.label}`);
      log(`        PID : ${product.pid}    |    Variants : ${varCount}`);
      log(SEP2);

      if (!varCount) {
        log("        Aucun variant.");
        return;
      }

      product.variants.forEach((v) => {
        // NB: les noms de champs ci-dessous couvrent les variantes les
        // plus courantes de la réponse CJ. Si ton compte renvoie des
        // clés différentes, regarde le "log brut" côté HTML (JSON complet
        // dispo dans la réponse) pour ajuster les noms si besoin.
        const vid    = v.vid || v.variantId || 'N/A';
        const sku    = v.variantSku || v.sku || 'N/A';
        const name   = v.variantNameEn || v.variantName || '';
        const price  = v.variantSellPrice ?? v.variantStandardPrice ?? v.variantPrice ?? 'N/A';
        const weight = v.variantWeight ?? 'N/A';
        const image  = v.variantImage || '';

        log(`        ID: ${vid}  |  SKU: ${sku}  |  PRIX: $${price}  |  POIDS: ${weight}g  |  ${name}`);
        if (image) log(`              IMG: ${image}`);
      });
    });

    log(SEP);
    log("  ✅  FIN DU LOG");
    log(SEP);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success:  true,
        total:    allProducts.length,
        logs:     logs,
        products: allProducts
      })
    };

  } catch (error) {
    console.error("[CJ ERROR]", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message, logs })
    };
  }
};