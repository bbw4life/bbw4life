// create-cj-order.js
process.removeAllListeners('warning');
const fetch = require('node-fetch');

// ── Obtenir Access Token depuis API Key ──────────────────────────
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

// ── NOUVEAU : récupérer le logisticName via freightCalculate ──────
// CJ exige ce champ dans createOrderV2. On demande les options
// disponibles pour ces produits/cette destination, et on prend
// l'option la moins chère.
async function getCJLogisticName(token, fromCountryCode, destCountryCode, products) {
  const url = 'https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate';
  const body = {
    startCountryCode: fromCountryCode,
    endCountryCode:   destCountryCode,
    products: products.map(p => ({ vid: p.vid, quantity: p.quantity }))
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': token },
    body:    JSON.stringify(body)
  });

  const responseText = await res.text();
  console.log('[CJ ORDER] freightCalculate response:', responseText);

  let data = {};
  try { data = JSON.parse(responseText); } catch {}

  if (data.result === true && Array.isArray(data.data) && data.data.length > 0) {
    // On prend l'option la moins chère
    const cheapest = data.data.reduce((min, o) =>
      (Number(o.logisticPrice) ?? Infinity) < (Number(min.logisticPrice) ?? Infinity) ? o : min
    , data.data[0]);
    return cheapest.logisticName || null;
  }

  return null;
}

exports.handler = async (event) => {
  console.log('[CJ ORDER] Function invoked');
  try {
    if (!event.body) throw new Error('No data received');

    const { cart, shipping } = JSON.parse(event.body);
    if (!Array.isArray(cart) || cart.length === 0) throw new Error('Invalid cart data');

    if (!process.env.CJ_API_KEY) {
      throw new Error('CJ_API_KEY missing in env');
    }

    // ── Auth ──────────────────────────────────────────────────────
    const token = await getCJAccessToken();

    // ── Normalisation adresse ──────────────────────────────────────
    const normalize = (str) =>
      str ? str.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : '';

    const fullName   = normalize(
      shipping.fullName ||
      `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim()
    );
    const address1   = normalize(shipping.address    || '');
    const city       = normalize(shipping.city       || '');
    const province   = normalize(shipping.state      || '');
    const postalCode = normalize(shipping.postalCode || '');
    const country    = normalize(shipping.country    || '');
    const countryCode = (shipping.countryCode || 'US').toUpperCase();
    const phone      = normalize(shipping.phone      || '0000000000');
    const email      = normalize(shipping.email      || '');

    // ── Pays d'origine (entrepôt CJ) requis par createOrderV2 ──────
    const fromCountryCode = (shipping.fromCountryCode || 'CN').toUpperCase();

    // ── Construire les produits ────────────────────────────────────
    // Chaque item doit avoir : cj_product_id, cj_variant_id, quantity
    const products = cart.map(item => {
      const pid = item.cj_product_id || item.cj_id;
      const vid = item.cj_variant_id || item.variantsid;

      if (!pid) throw new Error(`Missing cj_product_id for item: ${item.title || vid}`);
      if (!vid) throw new Error(`Missing cj_variant_id for item: ${item.title || pid}`);

      return {
        vid:      String(vid),
        pid:      String(pid),
        quantity: parseInt(item.quantity) || 1
      };
    });

    // ── NOUVEAU : récupérer logisticName (obligatoire pour CJ) ─────
    const logisticName = await getCJLogisticName(token, fromCountryCode, countryCode, products);
    if (!logisticName) {
      throw new Error(
        `Aucune option logistique CJ trouvée pour ${fromCountryCode} → ${countryCode}. ` +
        `Vérifie que le produit est livrable vers cette destination.`
      );
    }
    console.log('[CJ ORDER] logisticName sélectionné:', logisticName);

    const uniqueOrderId = `BBW-CJ-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // ── Body de la commande CJ ────────────────────────────────────
    const orderBody = {
      orderNumber:          uniqueOrderId,
      fromCountryCode:      fromCountryCode,
      logisticName:         logisticName,      // ← NOUVEAU (corrige l'erreur 1600300 bis)
      shippingZip:          postalCode,
      shippingCountryCode:  countryCode,
      shippingCountry:      country,
      shippingProvince:     province,
      shippingCity:         city,
      shippingAddress:      address1,
      shippingAddress2:     normalize(shipping.address2 || ''),
      shippingCustomerName: fullName,
      shippingPhone:        phone,
      shippingEmail:        email,
      remark:               'BBW4LIFE website order',
      products
    };

    console.log('[CJ ORDER] Sending to CJ:', JSON.stringify(orderBody, null, 2));

    // ── Appel API CJ ──────────────────────────────────────────────
    const cjRes = await fetch(
      'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2',
      {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'CJ-Access-Token': token
        },
        body: JSON.stringify(orderBody)
      }
    );

    const responseText = await cjRes.text();
    console.log('[CJ ORDER] HTTP Status:', cjRes.status);
    console.log('[CJ ORDER] Raw response:', responseText);

    let data = {};
    try { data = JSON.parse(responseText); } catch {}

    if (data.result === true) {
      console.log('[CJ ORDER] ✅ Order created successfully:', data.data?.orderId);
      return res(200, {
        success: true,
        orderId: data.data?.orderId,
        message: data.message || 'CJ order created successfully'
      });
    } else {
      const errMsg = data.message || responseText.trim() || 'CJ order creation failed';
      console.error('[CJ ORDER] ❌ Failed:', errMsg, '| Code:', data.code);
      return res(500, { success: false, error: errMsg, code: data.code });
    }

  } catch (error) {
    console.error('[CJ ORDER ERROR]', error.message);
    return res(500, { success: false, error: error.message });
  }
};

function res(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}