process.removeAllListeners('warning');
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { cj_id } = event.queryStringParameters || {};

  if (!cj_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing cj_id parameter' })
    };
  }

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