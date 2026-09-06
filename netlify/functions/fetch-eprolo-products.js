// fetch-eprolo-products.js — VERSION PARALLÈLE + CATÉGORIES
process.removeAllListeners('warning');
const crypto = require('crypto');

const CATEGORIES = [
  {
    category: "Beauty",
    subcategories: [
      { name: "Nails",     ids: ["31507085","31507084","31507050"] },
      { name: "Eyebrow",   ids: ["31507083","31507079","31507077"] },
      { name: "Lips",      ids: ["31507080","31507082"] },
      { name: "Makeup",    ids: ["31507075"] },
      { name: "Haircare",  ids: ["31507069","31507068","31507066"] },
      { name: "Skincare",  ids: ["31507047","31507042","31507040","31507037","31507030"] },
    ]
  },
  {
    category: "Main Plus Size",
    subcategories: [
      { name: "Pants",   ids: ["31507010","31506972","31506964","31506942"] },
      { name: "Shoes",   ids: ["31507005","31506999","31506996","31506987","31506961","31506959","31506957"] },
      { name: "Shirt",   ids: ["31506986","31506956","31506938"] },
      { name: "Sweater", ids: ["31506970","31506983","31506831"] },
    ]
  },
  {
    category: "Plus Size Woman",
    subcategories: [
      { name: "Shoes",         ids: ["31506995","31507001","31506993","31506990","31506877","31506874","32048267","32048149","32048075"] },
      { name: "Dresses",       ids: ["31506899","31506898","31506897","31506895","31506885","31506863","31506856","31506842","31506840","31506894","32048080","32048087","32048089","32048102","32048106","32048127"] },
      { name: "Bathrobe",      ids: ["31506891","31506893"] },
      { name: "Sexy",          ids: ["31506890","31506872","31506846","31506841"] },
      { name: "Breathable",    ids: ["31506880","31506879"] },
      { name: "Bikini",        ids: ["31506871","31506851","31506845","31506839","31506830","31506822"] },
      { name: "Plus Size Top", ids: ["31506857","31506854","31506868","31506889"] },
      { name: "Skirt",         ids: ["32048084"] },
      { name: "Summer",        ids: ["32048099"] },
    ]
  },
  {
    category: "Bags",
    subcategories: [
      { name: "Bag Hand Woman", ids: ["32048189","32048193","32048246","32048245","32048241","32048231","32048228","32048209","32048207","32048204","32048202"] },
    ]
  },
];

// Flat list of all IDs with their category/subcategory info
const ALL_PRODUCT_ENTRIES = [];
CATEGORIES.forEach(cat => {
  cat.subcategories.forEach(sub => {
    sub.ids.forEach(id => {
      ALL_PRODUCT_ENTRIES.push({ id, category: cat.category, subcategory: sub.name });
    });
  });
});

const SEP  = "═".repeat(80);
const SEP2 = "─".repeat(80);

// ── Shipping cost — Eprolo "Shipping Rate Inquiry API"
//    (get_product_shiping_fees.html). Isolé dans sa propre fonction et
//    son propre try/catch dans l'appelant : une erreur ici ne doit
//    jamais faire échouer la récupération du produit lui-même, qui
//    fonctionne déjà et ne doit pas être touchée.
//    Destination de référence fixe (US), même logique que côté CJ —
//    simple aperçu inventaire, pas un vrai calcul de commande.
const EPROLO_SHIPPING_COUNTRY = 'US';
async function getEproloShippingCost(apiKey, apiSecret, productId, variantId) {
  const timestamp = Date.now();
  const sign = crypto
    .createHash('md5')
    .update(apiKey + timestamp + apiSecret)
    .digest('hex');

  const url = `https://openapi.eprolo.com/get_product_shiping_fees.html?sign=${sign}&timestamp=${timestamp}&productid=${productId}&variantId=${variantId}&countrycode=${EPROLO_SHIPPING_COUNTRY}`;

  const response     = await fetch(url, { method: "GET", headers: { "apiKey": apiKey } });
  const responseText = await response.text();

  let data = {};
  try { data = JSON.parse(responseText); } catch {}

  if (!((data.code === 0 || data.code === "0") && data.data)) return null;

  const variant = Array.isArray(data.data.variantlist) ? data.data.variantlist[0] : null;
  const costList = variant?.logistics_cost_list?.[0]?.cost_list;
  if (!Array.isArray(costList) || !costList.length) return null;

  const cheapest = costList.reduce((min, o) =>
    (Number(o.cost) || Infinity) < (Number(min.cost) || Infinity) ? o : min
  , costList[0]);

  return {
    price:      cheapest.cost != null ? Number(cheapest.cost) : null,
    method:     cheapest.ship_method || null,
    shiptime:   cheapest.shiptime || null,
    country:    cheapest.country || null
  };
}

exports.handler = async (event) => {
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  log(SEP);
  log("  EPROLO — RÉCUPÉRATION DES PRODUITS");
  log(`  Liste : ${ALL_PRODUCT_ENTRIES.length} produits`);
  log(SEP);

  try {
    const apiKey    = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    // Fetch all products in parallel
    const results = await Promise.all(
      ALL_PRODUCT_ENTRIES.map(async (entry) => {
        const { id: productId, category, subcategory } = entry;
        try {
          const timestamp = Date.now();
          const sign = crypto
            .createHash('md5')
            .update(apiKey + timestamp + apiSecret)
            .digest('hex');

          const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${productId}`;

          const response     = await fetch(url, { method: "GET", headers: { "apiKey": apiKey } });
          const responseText = await response.text();

          let data = {};
          try { data = JSON.parse(responseText); } catch {}

          if ((data.code === 0 || data.code === "0") && data.data) {
            log(`  ✅  ${productId}  →  OK  [${category} > ${subcategory}]`);

            // ── Shipping cost (appel séparé, best-effort) — ne doit
            //    jamais faire échouer le produit si ça rate. ──
            let shipping = null;
            const firstVariantId = data.data.variantlist?.[0]?.id;
            if (firstVariantId) {
              try {
                shipping = await getEproloShippingCost(apiKey, apiSecret, productId, firstVariantId);
                log(shipping
                  ? `        🚚  Shipping (→${EPROLO_SHIPPING_COUNTRY}) : $${shipping.price} via ${shipping.method}`
                  : `        ⚠️  Shipping introuvable pour ${productId}`);
              } catch (shipErr) {
                log(`        ⚠️  Shipping : EXCEPTION : ${shipErr.message}`);
              }
            }

            return { ...data.data, category, subcategory, shipping };
          } else {
            const errMsg = data.msg || 'réponse invalide';
            log(`  ⚠️  ${productId}  →  ERREUR : ${errMsg}  [${category} > ${subcategory}]`);
            return null;
          }

        } catch (err) {
          log(`  ❌  ${productId}  →  EXCEPTION : ${err.message}  [${category} > ${subcategory}]`);
          return null;
        }
      })
    );

    const allProducts = results.filter(Boolean);

    log(SEP);
    log(`  TOTAL RÉCUPÉRÉS : ${allProducts.length} / ${ALL_PRODUCT_ENTRIES.length}`);
    log(SEP);

    allProducts.forEach((product, index) => {
      const varCount = product.variantlist ? product.variantlist.length : 0;

      log("");
      log(SEP);
      log(`  [${String(index + 1).padStart(2, '0')}]  ${product.title}`);
      log(`        ID : ${product.id}    |    Variants : ${varCount}    |    Cat: ${product.category} > ${product.subcategory}`);
      log(`        SHIPPING (→${EPROLO_SHIPPING_COUNTRY}) : ${product.shipping ? `$${product.shipping.price} via ${product.shipping.method}` : 'N/A'}`);
      log(SEP2);

      if (varCount === 0) {
        log("        Aucun variant.");
        return;
      }

      const colorGroups = {};

      product.variantlist.forEach((variant) => {
        let color = (variant.option1 || 'N/A').replace(/ one$/i, '').trim();
        color = color.charAt(0).toUpperCase() + color.slice(1);

        const size    = (variant.option2 || '').trim();
        const option3 = (variant.option3 || '').trim();

        if (!colorGroups[color]) colorGroups[color] = [];
        colorGroups[color].push({
          size,
          option3,
          id:     variant.id,
          sku:    variant.sku                || 'N/A',
          price:  variant.cost               || 'N/A',
          weight: variant.weight             || 'N/A',
          stock:  variant.inventory_quantity || 'N/A'
        });
      });

      Object.entries(colorGroups).forEach(([color, variants]) => {
        log(`        🎨  ${color}  (${variants.length} taille(s))`);
        variants.forEach((v) => {
          const sizeStr = v.size    ? `SIZE: ${v.size.padEnd(6)}` : `SIZE: ${'—'.padEnd(6)}`;
          const opt3Str = v.option3 ? `  |  OPT3: ${v.option3}` : '';
          log(`              ID: ${v.id}  |  ${sizeStr}  |  SKU: ${v.sku}  |  PRIX: $${v.price}  |  POIDS: ${v.weight}g  |  STOCK: ${v.stock}${opt3Str}`);
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
        success:     true,
        total:       allProducts.length,
        logs:        logs,
        products:    allProducts,
        categories:  CATEGORIES.map(cat => cat.category),
      })
    };

  } catch (error) {
    console.error("[EPROLO ERROR]", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message, logs })
    };
  }
};