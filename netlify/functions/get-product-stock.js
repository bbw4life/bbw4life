process.removeAllListeners('warning');
const crypto = require('crypto');

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// ── EPROLO — comportement original intact, ne pas toucher ──
async function handleEprolo(eprolo_id) {
  const apiKey    = process.env.EPROLO_API_KEY;
  const apiSecret = process.env.EPROLO_API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'EPROLO API credentials not configured' })
    };
  }

  const timestamp = Date.now();
  const sign = crypto
    .createHash('md5')
    .update(apiKey + timestamp + apiSecret)
    .digest('hex');

  const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${eprolo_id}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'apiKey': apiKey }
  });

  const responseText = await response.text();

  let data = {};
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('[get-product-stock] JSON parse error:', responseText.slice(0, 200));
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Invalid JSON from EPROLO API' })
    };
  }

  if ((data.code === 0 || data.code === '0') && data.data) {
    const product  = data.data;
    const variants = product.variantlist || [];

    const totalStock = variants.reduce((sum, v) => {
      return sum + (parseInt(v.inventory_quantity) || 0);
    }, 0);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success:      true,
        eprolo_id:        eprolo_id,
        totalStock:   totalStock,
        variantCount: variants.length
      })
    };
  }

  const errMsg = data.msg || 'Product not found';
  console.warn(`[get-product-stock] EPROLO error for eprolo_id=${eprolo_id}: ${errMsg}`);
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:    false,
      eprolo_id:      eprolo_id,
      totalStock: null,
      error:      errMsg
    })
  };
}

// ── CJ DROPSHIPPING — même rate-limit strict que fetch-cj-stock.js
//    (~1 req/s), donc on ne fait qu'UN SEUL vid par appel (le premier de
//    la liste passée par le front) au lieu de boucler sur tous les
//    variants — le front doit déjà mettre le résultat en cache côté
//    client pour ne pas re-taper l'API à chaque visite de page. ──
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

async function handleCJ(cjVids) {
  if (!process.env.CJ_API_KEY) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'CJ_API_KEY missing in env' })
    };
  }

  try {
    const token = await getCJAccessToken();

    let totalStock = 0;
    let anyOk = false;

    for (const vid of cjVids) {
      const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'CJ-Access-Token': token }
      });
      const responseText = await response.text();

      let data = {};
      try { data = JSON.parse(responseText); } catch {}

      if (data.result === true && Array.isArray(data.data)) {
        totalStock += data.data.reduce((sum, w) => sum + (Number(w.totalInventoryNum) || 0), 0);
        anyOk = true;
      }
    }

    if (!anyOk) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, totalStock: null, error: 'CJ stock not found' })
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, totalStock, variantCount: cjVids.length })
    };

  } catch (error) {
    console.error('[get-product-stock] CJ error:', error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  const { eprolo_id, cj_vids } = event.queryStringParameters || {};

  try {
    if (cj_vids) {
      const vids = cj_vids.split(',').map(v => v.trim()).filter(Boolean);
      if (!vids.length) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Missing cj_vids parameter' })
        };
      }
      return await handleCJ(vids);
    }

    if (eprolo_id) {
      return await handleEprolo(eprolo_id);
    }

    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Missing eprolo_id or cj_vids parameter' })
    };

  } catch (error) {
    console.error('[get-product-stock] Error:', error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
