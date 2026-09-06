// get-eprolo-margin-all.js
// Fonction dédiée au 3e bouton de eprolo-viewer.html — indépendante de
// fetch-eprolo-products.js (ne la modifie ni ne dépend d'elle). Récupère,
// pour CHAQUE produit du catalogue Eprolo, les données brutes nécessaires
// pour calculer Cost/Shipping/Price suggéré/Marge côté client. Fonctionne
// par lots (comme fetch-cj-products.js) pour éviter un timeout en appelant
// les 90+ produits en une seule fois.
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

const ALL_IDS = [];
CATEGORIES.forEach(cat => cat.subcategories.forEach(sub => sub.ids.forEach(id => ALL_IDS.push(id))));

const BATCH_SIZE = 12;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const params = event.queryStringParameters || {};
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  const limit  = Math.max(1, parseInt(params.limit, 10) || BATCH_SIZE);
  const batch  = ALL_IDS.slice(offset, offset + limit);
  const hasMore = offset + limit < ALL_IDS.length;

  try {
    const apiKey    = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error('EPROLO API credentials not configured');

    const results = await Promise.all(batch.map(async (productId) => {
      try {
        const timestamp = Date.now();
        const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');
        const url  = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${productId}`;
        const response     = await fetch(url, { method: 'GET', headers: { apiKey } });
        const responseText = await response.text();
        let data = {};
        try { data = JSON.parse(responseText); } catch {}
        if ((data.code === 0 || data.code === '0') && data.data) {
          return { id: data.data.id, title: data.data.title, variantlist: data.data.variantlist || [] };
        }
        return null;
      } catch {
        return null;
      }
    }));

    const products = results.filter(Boolean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: ALL_IDS.length,
        offset,
        limit,
        hasMore,
        nextOffset: offset + limit,
        products,
      })
    };
  } catch (error) {
    console.error('[EPROLO MARGIN ALL ERROR]', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
