// _lib/pricing.js
// Module partagé de calcul du prix serveur (source unique de vérité).
// Extrait tel quel de validate-checkout.js — ne pas changer le comportement
// sans mettre à jour validate-checkout.js ET tous les appelants.
process.removeAllListeners('warning');
const fetch  = require('node-fetch');
const crypto = require('crypto');
const { google } = require('googleapis');

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

// ── Codes affiliés à usage unique (Sheet "PromoCodes") — source unique de
//    vérité côté serveur pour leur %, indépendante de settings.promos[] ──
async function getAffiliatePromoDiscount(code) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'PromoCodes!A:D'
    });
    const rows = res.data.values || [];
    const target = (code || '').trim().toUpperCase();

    for (let i = 1; i < rows.length; i++) {
      const rowCode = (rows[i][0] || '').trim().toUpperCase();
      if (rowCode === target) {
        const status = (rows[i][3] || '').trim().toLowerCase();
        if (status !== 'active' && status !== 'used') return 0;
        return parseFloat(rows[i][2]) || 0;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

async function computeServerTotal(cart, settings, allProducts, shippingMethod, promoCode) {
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
        return { ...item, _unknownProduct: true };
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
        return { ...item, _unknownProduct: true };
      }

    // ── Prix normal : relit depuis le catalogue ──
    const prod = realProducts.find(p => p.id === item.id);
    if (prod) {
      const variant = prod.variants?.find(v => String(v.vid) === String(item.cj_variant_id));
      const trustedPrice = variant ? parseFloat(variant.price) : parseFloat(prod.price);
      return { ...item, price: isNaN(trustedPrice) ? parseFloat(item.price) : trustedPrice };
    }

    // ── Produit non trouvé dans le catalogue → jamais confiance au client,
    //    l'item est retiré du panier serveur (voir .filter ci-dessous) ──
    return { ...item, _unknownProduct: true };
  }).filter(item => !item._unknownProduct);

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
      if (birthdayDiscount > 0) {
        const birthdayAllowCombine = (birthdayCfg.allow_combine || 'no').toLowerCase().trim() === 'yes';

        // Si allow_combine = yes → on applique sur tous les articles sauf les gratuits promo
        // Si allow_combine = no  → même logique mais les gardes bundle/upsell/freePromo
        //   sont déjà bloquées côté client ; côté serveur on calcule proprement dans les 2 cas
        const birthdaySubtotal = sanitized
          .filter(i => !i.isFreePromo)
          .reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 0), 0);

        // allow_combine = no → bloquer si bundle ou upsell présents
        if (!birthdayAllowCombine) {
          const hasBundleOrUpsell = sanitized.some(i => i.fromBundle || i.fromUpsell);
          if (hasBundleOrUpsell) {
            discountAmount = 0;
          } else {
            discountAmount = parseFloat((birthdaySubtotal * (birthdayDiscount / 100)).toFixed(2));
          }
        } else {
          // allow_combine = yes → s'applique sur tous les articles payants (bundle + upsell inclus)
          discountAmount = parseFloat((birthdaySubtotal * (birthdayDiscount / 100)).toFixed(2));
        }
      }
    } else {
      // Codes promos classiques (basés sur la quantité)
      const promo = promos.find(
        p => p.code && p.code.toUpperCase() === inputCode && p.items === paidQtyForPromo
      );
      if (promo && promo.percent > 0) {
        discountAmount = parseFloat((subtotal * (promo.percent / 100)).toFixed(2));
      } else {
        // ── Code affilié à usage unique (préfixe settings.affiliation) ──
        const affPrefix = ((settings.affiliation || {}).promo_code_prefix || '').toUpperCase().trim();
        if (affPrefix && (inputCode === affPrefix || inputCode.startsWith(affPrefix + '-'))) {
          const affDiscountPct = await getAffiliatePromoDiscount(inputCode);
          if (affDiscountPct > 0) {
            discountAmount = parseFloat((subtotal * (affDiscountPct / 100)).toFixed(2));
          }
        }
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

// ── Sécurité : pas de code promo cumulable avec la livraison gratuite
//    par seuil (source unique de vérité, indépendante du client) ──
if (freeByThreshold && discountAmount > 0) {
  discountAmount = 0;
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

module.exports = {
  getAllProductsData,
  getAffiliatePromoDiscount,
  computeServerTotal,
  generateCartToken,
  verifyCartToken
};
