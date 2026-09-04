// fetch-cj-products.js — RÉCUPÉRATION DES VARIANTS CJ DROPSHIPPING (par lots)
process.removeAllListeners('warning');

// ══════════════════════════════════════════════════════════════
//  Liste des Product IDs CJ à interroger.
// ══════════════════════════════════════════════════════════════
const PRODUCT_IDS = [
  { pid: "2608260240401633500" },
  { pid: "2408060950231624400" },
  { pid: "2602060608011624000" },
  { pid: "1794195871538622464" },
  { pid: "2603010902011604600" },
];

const SEP  = "═".repeat(80);
const SEP2 = "─".repeat(80);

// ── Délai entre chaque appel CJ pour respecter le rate-limit (~1 req/s) ──
const CJ_REQUEST_DELAY_MS = 1100;


const BATCH_SIZE = 6;

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

// ── Titre produit — /product/query renvoie productNameEn, absent de
//    /product/variant/query (qui ne liste que les variants). ──
async function getCJProductTitle(token, pid) {
  const url = `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(pid)}`;
  const res = await fetch(url, { method: 'GET', headers: { 'CJ-Access-Token': token } });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (data.result === true && data.data) {
    return data.data.productNameEn || data.data.productName || null;
  }
  return null;
}

// ── Shipping cost estimatif — même endpoint logistic/freightCalculate
//    que create-cj-order.js (source de vérité pour le vrai checkout),
//    calculé ici vers une destination de référence fixe (CN → US),
//    faute de destination client réelle à ce stade (simple aperçu
//    inventaire, pas une commande). Retourne l'option la moins chère,
//    comme au moment du vrai paiement. ──
const CJ_SHIPPING_FROM = 'CN';
const CJ_SHIPPING_TO   = 'US';
async function getCJShippingCost(token, vid) {
  const url = 'https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': token },
    body: JSON.stringify({
      startCountryCode: CJ_SHIPPING_FROM,
      endCountryCode:   CJ_SHIPPING_TO,
      products: [{ vid, quantity: 1 }]
    })
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (data.result === true && Array.isArray(data.data) && data.data.length > 0) {
    const cheapest = data.data.reduce((min, o) =>
      (Number(o.logisticPrice) || Infinity) < (Number(min.logisticPrice) || Infinity) ? o : min
    , data.data[0]);
    return {
      price:        cheapest.logisticPrice != null ? Number(cheapest.logisticPrice) : null,
      logisticName: cheapest.logisticName || null
    };
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reconnaît un token de type "taille" (XS, S, M, L, XL, 2XL... ou numérique)
const CJ_SIZE_PATTERN = /^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|ONE\s*SIZE|OS|\d+(\.\d+)?(CM|IN|MM)?)$/i;
function isCJSizeToken(str) {
  return CJ_SIZE_PATTERN.test(String(str).trim());
}

function extractVariantInfo(v) {
  let color = null;
  let size  = null;

  if (Array.isArray(v.variantProperty) && v.variantProperty.length) {
    v.variantProperty.forEach((prop) => {
      const key = String(prop.pidName || prop.pidKey || prop.pid || '').toLowerCase();
      const val = String(prop.vidName || prop.vidKey || '').trim();
      if (!val) return;
      if (key.includes('color') || key.includes('colour')) { color = val; return; }
      if (key.includes('size')) { size = val; return; }
      if (isCJSizeToken(val) && size === null) size = val;
      else if (color === null) color = val;
    });
  }

  if ((color === null || size === null) && v.variantKey) {
    const parts = String(v.variantKey).split(/[-_,]/).map((s) => s.trim()).filter(Boolean);

    if (parts.length >= 2) {
      const sizeParts  = parts.filter(isCJSizeToken);
      const colorParts = parts.filter((p) => !isCJSizeToken(p));
      if (size === null)  size  = sizeParts.length  ? sizeParts.join(' ')  : parts[parts.length - 1];
      if (color === null) color = colorParts.length ? colorParts.join('-') : parts.slice(0, -1).join('-');
    } else if (parts.length === 1) {
      const token = parts[0];
      if (isCJSizeToken(token)) { if (size === null) size = token; }
      else { if (color === null) color = token; }
    }
  }

  if (color === null) color = 'N/A';
  if (size === null)  size  = 'N/A';

  return { color, size };
}

exports.handler = async (event) => {
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  const params = event.queryStringParameters || {};
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  const limit  = Math.max(1, parseInt(params.limit, 10) || BATCH_SIZE);

  const batch     = PRODUCT_IDS.slice(offset, offset + limit);
  const hasMore   = offset + limit < PRODUCT_IDS.length;
  const nextOffset = offset + limit;

  log(SEP);
  log(`  CJ DROPSHIPPING — LOT ${PRODUCT_IDS.length ? offset + 1 : 0}-${offset + batch.length} / ${PRODUCT_IDS.length}`);
  log(`  Délai entre appels : ${CJ_REQUEST_DELAY_MS}ms  |  Taille du lot : ${limit}`);
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
      body: JSON.stringify({ success: true, total: 0, offset, limit, hasMore: false, nextOffset, logs, products: [] })
    };
  }

  if (!batch.length) {
    // offset dépasse la liste : tout a déjà été traité par les lots précédents
    log("  ✅  Tous les produits ont déjà été traités.");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, total: PRODUCT_IDS.length, offset, limit, hasMore: false, nextOffset, logs, products: [] })
    };
  }

  try {
    // ── 1) Auth ────────────────────────────────────────────────
    const token = await getCJAccessToken();
    log("  🔑  Access token CJ obtenu");
    log(SEP2);

    // ── 2) Boucle SÉQUENTIELLE sur le lot uniquement ──
    const allProducts = [];

    for (const entry of batch) {
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

          // ── Titre produit (appel séparé, product/query n'existe pas
          //    dans variant/query) ── respecte le rate-limit ~1 req/s.
          await sleep(CJ_REQUEST_DELAY_MS);
          let title = null;
          try {
            title = await getCJProductTitle(token, pid);
            log(title ? `        📦  Titre : ${title}` : `        ⚠️  Titre introuvable pour ${pid}`);
          } catch (titleErr) {
            log(`        ⚠️  Titre : EXCEPTION : ${titleErr.message}`);
          }

          // ── Shipping cost estimatif (CN → US) sur le 1er variant
          //    disponible, comme aperçu — le vrai calcul au checkout se
          //    fait par commande réelle (create-cj-order.js). ──
          let shipping = null;
          const firstVid = data.data[0]?.vid;
          if (firstVid) {
            await sleep(CJ_REQUEST_DELAY_MS);
            try {
              shipping = await getCJShippingCost(token, firstVid);
              log(shipping
                ? `        🚚  Shipping (${CJ_SHIPPING_FROM}→${CJ_SHIPPING_TO}) : $${shipping.price} via ${shipping.logisticName}`
                : `        ⚠️  Shipping introuvable pour ${pid}`);
            } catch (shipErr) {
              log(`        ⚠️  Shipping : EXCEPTION : ${shipErr.message}`);
            }
          }

          allProducts.push({ pid, label, title, shipping, variants: data.data });
        } else {
          const errMsg = data.message || responseText.slice(0, 200) || 'réponse invalide';
          log(`  ⚠️  ${pid}  →  ERREUR : ${errMsg}  [${label}]`);
        }

      } catch (err) {
        log(`  ❌  ${pid}  →  EXCEPTION : ${err.message}  [${label}]`);
      }

      // Pause entre chaque appel pour respecter le rate-limit CJ (~1 req/s)
      await sleep(CJ_REQUEST_DELAY_MS);
    }

    log(SEP);
    log(`  LOT TERMINÉ : ${allProducts.length} / ${batch.length}  (global : ${offset + batch.length} / ${PRODUCT_IDS.length})`);
    log(SEP);

    allProducts.forEach((product, index) => {
      const varCount = product.variants.length;

      log("");
      log(SEP);
      log(`  [${String(offset + index + 1).padStart(2, '0')}]  ${product.title || product.label}`);
      log(`        PID : ${product.pid}    |    Variants : ${varCount}`);
      log(`        SHIPPING (${CJ_SHIPPING_FROM}→${CJ_SHIPPING_TO}) : ${product.shipping ? `$${product.shipping.price} via ${product.shipping.logisticName}` : 'N/A'}`);
      log(SEP2);

      if (!varCount) {
        log("        Aucun variant.");
        return;
      }

      const colorGroups = {};
      product.variants.forEach((v) => {
        const { color, size } = extractVariantInfo(v);
        if (!colorGroups[color]) colorGroups[color] = [];
        colorGroups[color].push({ v, size });
      });

      Object.entries(colorGroups).forEach(([color, entries]) => {
        log(`        ● ${color}  (${entries.length} taille(s))`);
        entries.forEach(({ v, size }) => {
          const vid    = v.vid || v.variantId || 'N/A';
          const sku    = v.variantSku || v.sku || 'N/A';
          const name   = v.variantNameEn || v.variantName || '';
          const price  = v.variantSellPrice ?? v.variantStandardPrice ?? v.variantPrice ?? 'N/A';
          const weight = v.variantWeight ?? 'N/A';
          const image  = v.variantImage || '';

          log(`              ID: ${vid}  |  SKU: ${sku}  |  SIZE: ${size}  |  PRIX: $${price}  |  POIDS: ${weight}g  |  STOCK: voir dashboard  |  ${name}`);
          if (image) log(`                    IMG: ${image}`);
        });
      });
    });

    log(SEP);
    log(hasMore ? "  ➡️  LOT SUIVANT À VENIR..." : "  ✅  FIN DU LOG (dernier lot)");
    log(SEP);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success:    true,
        total:      PRODUCT_IDS.length,
        offset,
        limit,
        hasMore,
        nextOffset,
        logs:       logs,
        products:   allProducts
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