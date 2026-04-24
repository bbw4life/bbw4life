const crypto = require('crypto');

const INTERNAL_TO_CJ = {
  'Pdg-Francenel-product1':  '31246341',
  'Pdg-Francenel-product2':  '31246339',
  'Pdg-Francenel-product3':  '31246387',
  'Pdg-Francenel-product4':  '31246342',
  'Pdg-Francenel-product5':  '31246386',
  'Pdg-Francenel-product6':  '31350659',
  'Pdg-Francenel-product7':  '31246232',
  'Pdg-Francenel-product8':  '31246385',
  'Pdg-Francenel-product9':  '31246336',
  'Pdg-Francenel-product10': '31246377',
  'Pdg-Francenel-product11': '31246323',
  'Pdg-Francenel-product12': '31246335',
  'Pdg-Francenel-product13': '31246346',
  'Pdg-Francenel-product14': '31246417',
  'Pdg-Francenel-product15': '31246429',
  'Pdg-Francenel-product16': '31246437',
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { cj_id: rawParam } = event.queryStringParameters || {};

  if (!rawParam) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing cj_id parameter' })
    };
  }

  const cj_id = INTERNAL_TO_CJ[rawParam] || rawParam;

  try {
    const apiKey    = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;

    if (!apiKey || !apiSecret) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'EPROLO API credentials not configured' })
      };
    }

    const timestamp = Date.now();
    const sign = crypto
      .createHash('md5')
      .update(apiKey + timestamp + apiSecret)
      .digest('hex');

    const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${cj_id}`;

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
        headers,
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
        headers,
        body: JSON.stringify({
          success:      true,
          cj_id:        cj_id,
          internal_id:  rawParam,
          totalStock:   totalStock,
          variantCount: variants.length
        })
      };
    }

    const errMsg = data.msg || 'Product not found';
    console.warn(`[get-product-stock] EPROLO error for cj_id=${cj_id}: ${errMsg}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:    false,
        cj_id:      cj_id,
        internal_id: rawParam,
        totalStock: null,
        error:      errMsg
      })
    };

  } catch (error) {
    console.error('[get-product-stock] Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};