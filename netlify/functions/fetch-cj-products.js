// fetch-cj-products.js — RÉCUPÉRATION DES VARIANTS CJ DROPSHIPPING
process.removeAllListeners('warning');

// ══════════════════════════════════════════════════════════════
//  Liste des Product IDs CJ à interroger.
//  Ajoute ici tes "pid" CJ (visibles dans l'URL produit CJ, ou
//  renvoyés par leur API de recherche produit).
//  "label" est juste pour l'affichage dans le log/HTML (optionnel).
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

// ── Extraction couleur / taille à partir du nom du variant ─────
// CJ colle souvent "Titre du produit + Couleur + Taille" dans un seul
// champ (variantNameEn). On calcule le préfixe commun à tous les
// variants d'un même produit, puis on isole le reste en "couleur" + "taille".
function commonPrefixWords(strings) {
  const clean = strings.filter(Boolean).map(s => s.trim().split(/\s+/));
  if (!clean.length) return [];
  const minLen = Math.min(...clean.map(w => w.length));
  const prefix = [];
  for (let i = 0; i < minLen; i++) {
    const word = clean[0][i];
    if (clean.every(w => w[i] === word)) prefix.push(word);
    else break;
  }
  return prefix;
}

const SIZE_PATTERN = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d+[A-Za-z]{0,3}|[0-9]+)$/i;

function splitColorSize(remainder) {
  const words = remainder.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { color: 'N/A', size: '' };
  const last = words[words.length - 1];
  if (SIZE_PATTERN.test(last)) {
    const colorWords = words.slice(0, -1);
    return { color: colorWords.length ? colorWords.join(' ') : 'N/A', size: last };
  }
  return { color: remainder.trim(), size: '' };
}

function enrichVariants(variants) {
  const names  = variants.map(v => v.variantNameEn || v.variantName || '');
  const prefix = commonPrefixWords(names);

  return variants.map((v) => {
    const name      = v.variantNameEn || v.variantName || '';
    const words     = name.trim().split(/\s+/).filter(Boolean);
    const remainder = words.slice(prefix.length).join(' ');
    const { color, size } = splitColorSize(remainder);

    return {
      ...v,
      vid:    v.vid || v.variantId || 'N/A',
      sku:    v.variantSku || v.sku || 'N/A',
      price:  v.variantSellPrice ?? v.variantStandardPrice ?? v.variantPrice ?? 'N/A',
      weight: v.variantWeight ?? 'N/A',
      stock:  v.variantStock ?? v.stock ?? v.inventory ?? v.remainNum ?? v.inventoryNum ?? v.variantSellNum ?? 'N/A',
      image:  v.variantImage || '',
      color:  color || 'N/A',
      size:   size || '',
    };
  });
}

// ── Stock par variant ────────────────────────────────────────────
// L'endpoint variant/query ne renvoie pas le stock : CJ a un endpoint
// séparé par vid pour l'inventaire (entrepôts).
async function fetchVariantStock(vid, token) {
  try {
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`;
    const res  = await fetch(url, { method: "GET", headers: { "CJ-Access-Token": token } });
    const text = await res.text();

    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (data.result === true && Array.isArray(data.data)) {
      const total = data.data.reduce((sum, w) => sum + (parseInt(w.storageNum ?? w.stock ?? w.num ?? 0) || 0), 0);
      return total;
    }
    return 'N/A';
  } catch {
    return 'N/A';
  }
}

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
          const variants = enrichVariants(data.data);

          // Récupération du stock par variant (endpoint séparé chez CJ)
          for (const v of variants) {
            if (v.stock === 'N/A') {
              v.stock = await fetchVariantStock(v.vid, token);
              await sleep(350); // respecter le rate-limit CJ
            }
          }

          allProducts.push({ pid, label, variants });
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

      // Regroupement par couleur, comme pour Eprolo
      const colorGroups = {};
      product.variants.forEach((v) => {
        const color = v.color || 'N/A';
        if (!colorGroups[color]) colorGroups[color] = [];
        colorGroups[color].push(v);
      });

      Object.entries(colorGroups).forEach(([color, vars]) => {
        log(`        🎨  ${color}  (${vars.length} taille(s))`);
        vars.forEach((v) => {
          const sizeStr = v.size ? `SIZE: ${v.size.padEnd(6)}` : `SIZE: ${'—'.padEnd(6)}`;
          log(`              ID: ${v.vid}  |  ${sizeStr}  |  SKU: ${v.sku}  |  PRIX: $${v.price}  |  POIDS: ${v.weight}g  |  STOCK: ${v.stock}`);
        });
        log("");
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