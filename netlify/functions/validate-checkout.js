// validate-checkout.js
process.removeAllListeners('warning');
const fetch  = require('node-fetch');
const crypto = require('crypto');

const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function getClientIp(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT_MAP.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  RATE_LIMIT_MAP.set(ip, entry);
  return false;
}

async function getAllProductsData() {
  try {
    const BASE_URL = process.env.BASE_URL || '';
    const res = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) throw new Error('Failed to fetch products.data.json');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validateShipping(shipping) {
  const errors = [];
  if (!shipping.firstName?.trim())  errors.push('First name required');
  if (!shipping.lastName?.trim())   errors.push('Last name required');
  if (!shipping.email?.trim())      errors.push('Email required');
  if (!validateEmail(shipping.email)) errors.push('Invalid email format');
  if (!shipping.address?.trim())    errors.push('Address required');
  if (!shipping.city?.trim())       errors.push('City required');
  if (!shipping.countryCode?.trim()) errors.push('Country required');
  return errors;
}

function validateCart(cart) {
  const errors = [];
  if (!Array.isArray(cart) || cart.length === 0) {
    errors.push('Cart is empty');
    return errors;
  }
  cart.forEach((item, i) => {
    const price = parseFloat(item.price);
    const qty   = parseInt(item.quantity);
    if (!item.title?.trim())       errors.push(`Item ${i+1}: missing title`);
    if (isNaN(price) || price < 0) errors.push(`Item ${i+1}: invalid price`);
    if (isNaN(qty)   || qty < 1)   errors.push(`Item ${i+1}: invalid quantity`);
    if (qty > 99)                  errors.push(`Item ${i+1}: quantity too high`);
  });
  return errors;
}

function computeServerTotal(cart, settings, allProducts, shippingMethod, promoCode) {
  const cd = settings.cart_drawer || {};
  const SHIPPING_COST = parseFloat(settings.shipping_cost) || 10.00;
  const TAX_RATE      = parseFloat(settings.tax_rate)      || 0.00;
  const freeThreshold = parseFloat(cd.free_shipping_threshold) || 0;

  const buyQty = parseInt(cd.promo_buy_quantity) || 0;
  const getQty = parseInt(cd.promo_get_quantity)  || 0;

  // Produits réels uniquement (exclut le nœud settings)
  const realProducts = allProducts.filter(p => !p.type);

  const paidQty = cart
    .filter(i => !i.isFreePromo)
    .reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);

  const sanitized = cart.map(item => {

    // ── Item gratuit promo ──
    if (item.isFreePromo && buyQty && getQty && paidQty >= buyQty) {
      return { ...item, price: 0 };
    }
    if (item.isFreePromo && (!buyQty || paidQty < buyQty)) {
      return { ...item, isFreePromo: false };
    }

    // ── Bundle : prix calculé CÔTÉ SERVEUR depuis les settings ──
      if (item.fromBundle) {
        const prod = realProducts.find(p => p.id === item.id);
        if (prod) {
          const variant = prod.variants?.find(v => String(v.vid) === String(item.cj_variant_id));
          const catalogPrice = variant ? parseFloat(variant.price) : parseFloat(prod.price);

          const maxBundleDiscount = Math.max(
            parseFloat(prod.trio_discount  || 0),
            parseFloat(prod.duo_discount   || 0),
            parseFloat(prod.single_discount|| 0)
          );
          const minAllowedPrice = parseFloat((catalogPrice * (1 - maxBundleDiscount / 100)).toFixed(2));
          const serverBundlePrice = Math.max(minAllowedPrice, catalogPrice * 0.50); // plancher à -50% même si discount > 50%

          return { ...item, price: parseFloat(serverBundlePrice.toFixed(2)) };
        }
        return item;
      }

      // ── Upsell : prix calculé CÔTÉ SERVEUR depuis les settings ──
      if (item.fromUpsell) {
        const prod = realProducts.find(p => p.id === item.id);
        if (prod) {
          const variant = prod.variants?.find(v => String(v.vid) === String(item.cj_variant_id));
          const catalogPrice = variant ? parseFloat(variant.price) : parseFloat(prod.price);

          // Lire le discount upsell depuis settings.product_upsell
          const upsellCfg = settings.product_upsell || {};
          let upsellDiscountPct = 0;
          // Chercher dans toutes les configs upsell le discount max applicable à ce produit
          for (const key of Object.keys(upsellCfg)) {
            const entry = upsellCfg[key];
            if (!entry || !Array.isArray(entry.items)) continue;
            const found = entry.items.find(i => i.product_id === prod.id);
            if (found) {
              const pct = parseFloat(entry.discount_percent || 0);
              if (pct > upsellDiscountPct) upsellDiscountPct = pct;
            }
          }
          const serverUpsellPrice = parseFloat(
            (catalogPrice * (1 - upsellDiscountPct / 100)).toFixed(2)
          );

          return { ...item, price: parseFloat(serverUpsellPrice.toFixed(2)) };
        }
        return item;
      }

    // ── Prix normal : relit depuis le catalogue ──
    const prod = realProducts.find(p => p.id === item.id);
    if (prod) {
      const variant = prod.variants?.find(v => String(v.vid) === String(item.cj_variant_id));
      const trustedPrice = variant ? parseFloat(variant.price) : parseFloat(prod.price);
      return { ...item, price: isNaN(trustedPrice) ? parseFloat(item.price) : trustedPrice };
    }

    // ── Produit non trouvé dans le catalogue → garde le prix client ──
    return item;
  });

  const subtotal = sanitized.reduce((s, i) => {
    return s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 0);
  }, 0);

  const freeByThreshold = freeThreshold > 0 && subtotal >= freeThreshold;
  const freeByMethod = ['Standard Shipping', 'Economy Shipping'].includes(shippingMethod);
  const isFree = freeByThreshold || freeByMethod;

  const shipping = isFree ? 0 : SHIPPING_COST;
  const tax = isFree ? 0 : parseFloat((subtotal * TAX_RATE).toFixed(2));

  // ── Promo code (depuis settings.promos + birthday_gift) ──
  let discountAmount = 0;
  if (promoCode) {
    const promos          = settings.promos || [];
    const birthdayCfg     = settings.birthday_gift || {};
    const birthdayCode    = (birthdayCfg.promo_code || '').toUpperCase().trim();
    const birthdayDiscount = parseFloat(
      (birthdayCfg.promo_discount || '0').toString().replace('%', '').trim()
    ) || 0;

    const paidQtyForPromo = sanitized
      .filter(i => !i.isFreePromo)
      .reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);

    const inputCode = (promoCode || '').toUpperCase().trim();

    if (birthdayCode && inputCode === birthdayCode) {
      // Code birthday : appliqué sur le subtotal des articles non-gratuits
      if (birthdayDiscount > 0) {
        const birthdaySubtotal = sanitized
          .filter(i => !i.isFreePromo)
          .reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 0), 0);
        discountAmount = parseFloat((birthdaySubtotal * (birthdayDiscount / 100)).toFixed(2));
      }
    } else {
      // Codes promos classiques (basés sur la quantité)
      const promo = promos.find(
        p => p.code && p.code.toUpperCase() === inputCode && p.items === paidQtyForPromo
      );
      if (promo && promo.percent > 0) {
        discountAmount = parseFloat((subtotal * (promo.percent / 100)).toFixed(2));
      }
    }
  }


  // ── Sécurité : pas de promo code sur bundle ou upsell ──
if (promoCode && discountAmount > 0) {
  const hasBundleOrUpsell = sanitized.some(i => i.fromBundle || i.fromUpsell);
  if (hasBundleOrUpsell) {
    discountAmount = 0;
  }
}

  const total = parseFloat((subtotal + shipping + tax - discountAmount).toFixed(2));

  return {
    subtotal:      parseFloat(subtotal.toFixed(2)),
    shippingCost:  parseFloat(shipping.toFixed(2)),
    taxAmount:     parseFloat(tax.toFixed(2)),
    discountAmount: discountAmount,
    total:         total,
    sanitizedCart: sanitized
  };
}

function generateCartToken(cart, total, secret) {
  const payload = cart.map(i => `${i.id}:${i.price}:${i.quantity}`).join('|') + ':' + total;
  return crypto.createHmac('sha256', secret || process.env.CHECKOUT_SECRET || 'bbw4life-secret').update(payload).digest('hex');
}

function verifyCartToken(cart, total, token, secret) {
  const expected = generateCartToken(cart, total, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return res(405, { success: false, error: 'Method not allowed' });
  }

  const ip = getClientIp(event);
  if (isRateLimited(ip)) {
    return res(429, { success: false, error: 'Too many requests. Please wait a moment.' });
  }

  try {
    if (!event.body) return res(400, { success: false, error: 'No data received' });

    const { action, cart, shipping, shippingMethod, clientTotal, cartToken, promoCode } = JSON.parse(event.body);

    if (action === 'validate') {
      const shippingErrors = validateShipping(shipping || {});
      const cartErrors     = validateCart(cart || []);
      const allErrors      = [...shippingErrors, ...cartErrors];

      if (allErrors.length > 0) {
        return res(400, { success: false, errors: allErrors });
      }

      const allProducts = await getAllProductsData();
      const settings    = allProducts.find(p => p.type === 'settings') || {};

      const { subtotal, shippingCost, taxAmount, discountAmount, total, sanitizedCart } = computeServerTotal(
        cart,
        settings,
        allProducts,
        shippingMethod || 'Standard Shipping',
        promoCode || null
      );

      if (clientTotal !== undefined) {
        const clientTotalRounded = parseFloat(parseFloat(clientTotal).toFixed(2));
        const diff = Math.abs(clientTotalRounded - total);
        if (diff > 0.10) {
          console.warn(`[CHECKOUT SECURITY] Price mismatch — client: $${clientTotal} | server: $${total} | IP: ${ip}`);
          return res(400, {
            success: false,
            error: 'Price mismatch detected. Please refresh and try again.',
            serverTotal: total
          });
        }
      }

      const token = generateCartToken(sanitizedCart, total, process.env.CHECKOUT_SECRET);

      return res(200, {
        success: true,
        subtotal,
        shippingCost,
        taxAmount,
        discountAmount,
        total,
        cartToken: token,
        sanitizedCart
      });
    }

    if (action === 'verify-token') {
      if (!cart || !cartToken || clientTotal === undefined) {
        return res(400, { success: false, error: 'Missing data for token verification' });
      }

      const allProducts = await getAllProductsData();
      const settings    = allProducts.find(p => p.type === 'settings') || {};

      const { total, sanitizedCart } = computeServerTotal(cart, settings, allProducts, shippingMethod || 'Standard Shipping', promoCode || null);

      let valid = false;
      try {
        valid = verifyCartToken(sanitizedCart, total, cartToken, process.env.CHECKOUT_SECRET);
      } catch {
        valid = false;
      }

      if (!valid) {
        console.warn(`[CHECKOUT SECURITY] Invalid cart token — IP: ${ip}`);
        return res(400, { success: false, error: 'Cart integrity check failed. Please refresh and try again.' });
      }

      return res(200, { success: true, total, sanitizedCart });
    }

    return res(400, { success: false, error: 'Unknown action' });

  } catch (err) {
    console.error('[VALIDATE-CHECKOUT ERROR]', err.message);
    return res(500, { success: false, error: 'Internal server error' });
  }
};

function res(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}