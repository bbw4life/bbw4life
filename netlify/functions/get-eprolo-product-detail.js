// get-eprolo-product-detail.js
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log("[EPROLO PRODUCT DETAIL] Function invoked");
  try {
    let productId;
    if (event.body) {
      const body = JSON.parse(event.body);
      productId = body.productid || body.productId || body.id;
    } else if (event.queryStringParameters) {
      productId = event.queryStringParameters.productid || 
                  event.queryStringParameters.productId || 
                  event.queryStringParameters.id;
    }

    if (!productId) throw new Error("Missing id in body or ?id=xxx");

    const apiKey = process.env.EPROLO_API_KEY;
    const apiSecret = process.env.EPROLO_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("EPROLO keys missing");

    const timestamp = Date.now();
    const sign = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');

    // 🔥 FIX : on utilise "id=" comme Eprolo l'attend
    const url = `https://openapi.eprolo.com/getproduct.html?sign=${sign}&timestamp=${timestamp}&id=${productId}`;

    console.log(`[EPROLO] Fetching product id: ${productId}`);
    console.log(`[EPROLO] URL: ${url}`);

    const res = await fetch(url, {
      method: "GET",
      headers: { "apiKey": apiKey }
    });

    const text = await res.text();
    let data;
    try { 
      data = JSON.parse(text); 
    } catch { 
      throw new Error("Invalid JSON from Eprolo"); 
    }

    console.log(`[EPROLO] Status: ${res.status}`);
    console.log(`[EPROLO] Response (first 300 chars): ${text.substring(0, 300)}...`);

    if (data.code !== "0") {
      throw new Error(data.msg || "Eprolo error");
    }

    const product = data.data;
    console.log(`\n=== PRODUIT TROUVÉ : ${product.title} (ID: ${product.id}) ===`);
    console.log("✅ VARIANTSID À UTILISER (copie-colle ces numéros dans products.data.json) :");

    product.variantlist.forEach(v => {
      console.log(`   → variantsid: ${v.id} | ${v.title} | Cost: $${v.cost} | Stock: ${v.inventory_quantity}`);
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        productId: product.id,
        title: product.title,
        variantsCount: product.variantlist.length,
        message: "Check logs for correct variantsid"
      })
    };

  } catch (error) {
    console.error("[EPROLO PRODUCT DETAIL ERROR]", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};