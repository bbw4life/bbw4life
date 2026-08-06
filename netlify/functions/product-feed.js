// netlify/functions/product-feed.js
// Flux produit RSS 2.0 (namespace Google Shopping "g:") généré à la demande
// depuis products.data.json — compatible Google Merchant Center, Meta
// Commerce Manager, Pinterest et TikTok Shop (même format XML de base).
// Un item par couleur active (pas par taille) : Google/Meta recommandent de
// grouper les tailles sous un même item quand prix/image sont partagés.
process.removeAllListeners('warning');
const { getAllProductsData } = require('./_lib/pricing');

const BRAND = 'BBW4LIFE';

function xmlEscape(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Catégorie Google Shopping — mapping simple par mots-clés déjà présents
//    dans le titre/description, faute d'un champ catégorie dédié dans le
//    catalogue. Fallback générique si rien ne matche. ──
const CATEGORY_RULES = [
  { pattern: /\b(heels?|sandals?|sneakers?|boots?|flats?|pumps?|shoes?)\b/i, category: 'Apparel & Accessories > Shoes' },
  { pattern: /\b(dress|gown|maxi)\b/i, category: 'Apparel & Accessories > Clothing > Dresses' },
  { pattern: /\b(bikini|swimsuit|swimwear)\b/i, category: 'Apparel & Accessories > Clothing > Swimwear' },
  { pattern: /\b(bag|purse|handbag|clutch)\b/i, category: 'Apparel & Accessories > Handbags, Wallets & Cases' },
  { pattern: /\b(bra|lingerie|panties|thong|bodysuit)\b/i, category: 'Apparel & Accessories > Clothing > Underwear & Socks > Lingerie' },
  { pattern: /\b(earrings?|necklace|bracelet|ring|jewelry)\b/i, category: 'Apparel & Accessories > Jewelry' },
  { pattern: /\b(pants?|trousers?|leggings?|jeans?)\b/i, category: 'Apparel & Accessories > Clothing > Pants' },
  { pattern: /\b(top|blouse|shirt|tee|tank)\b/i, category: 'Apparel & Accessories > Clothing > Tops' },
  { pattern: /\b(skirt)\b/i, category: 'Apparel & Accessories > Clothing > Skirts' },
  { pattern: /\b(coat|jacket|cardigan|sweater)\b/i, category: 'Apparel & Accessories > Clothing > Outerwear' }
];
const DEFAULT_CATEGORY = 'Apparel & Accessories > Clothing';

function resolveCategory(prod) {
  const haystack = `${prod.title || ''} ${prod.description || ''}`;
  const hit = CATEGORY_RULES.find(r => r.pattern.test(haystack));
  return hit ? hit.category : DEFAULT_CATEGORY;
}

// ── Genre — la collection "Men Plus Size" couvre product35 à product51
//    (cf. collections/men-plus-size.html), pas tous explicitement "Men's"
//    dans leur titre ; complété par un pattern texte en secours pour tout
//    futur produit homme ajouté hors de cette plage. ──
const MEN_ID_RANGE = { min: 35, max: 51 };
const MEN_KEYWORD = /\bmen'?s?\b/i;

function resolveGender(prod) {
  const match = String(prod.id || '').match(/product(\d+)$/);
  const idx = match ? parseInt(match[1], 10) : null;
  if (idx !== null && idx >= MEN_ID_RANGE.min && idx <= MEN_ID_RANGE.max) return 'male';
  if (MEN_KEYWORD.test(prod.title || '') || MEN_KEYWORD.test(prod.description || '')) return 'male';
  return 'female';
}

function colorAvailability(prod, colorName) {
  if (!Array.isArray(prod.variants) || !prod.variants.length) return 'in stock';
  const colorVariants = prod.variants.filter(v => v.color === colorName);
  if (!colorVariants.length) return 'in stock'; // pas de variantes déclarées pour cette couleur -> pas d'info de stock à exclure
  return colorVariants.some(v => v.active) ? 'in stock' : 'out of stock';
}

function colorPrice(prod, colorName) {
  if (!Array.isArray(prod.variants) || !prod.variants.length) return prod.price;
  const active = prod.variants.filter(v => v.color === colorName && v.active);
  const pool = active.length ? active : prod.variants.filter(v => v.color === colorName);
  if (!pool.length) return prod.price;
  const min = Math.min(...pool.map(v => parseFloat(v.price)).filter(n => !isNaN(n)));
  return isNaN(min) ? prod.price : min;
}

function buildItemsForProduct(prod, baseUrl) {
  const link = `${baseUrl}${prod.url}`;
  const category = resolveCategory(prod);
  const gender = resolveGender(prod);
  const activeColors = Array.isArray(prod.colors) ? prod.colors.filter(c => c.active !== false) : [];

  // Pas de couleurs déclarées : un seul item pour le produit entier.
  if (!activeColors.length) {
    return [buildItem({
      id: prod.id,
      title: prod.title,
      description: prod.description,
      link,
      image: prod.image,
      additionalImages: (prod.media || []).filter(m => m !== prod.image),
      price: prod.price,
      comparePrice: prod.compare_price,
      availability: (Array.isArray(prod.variants) && prod.variants.length)
        ? (prod.variants.some(v => v.active) ? 'in stock' : 'out of stock')
        : 'in stock',
      category,
      gender,
      itemGroupId: null,
      color: null,
      sizes: prod.sizes
    })];
  }

  return activeColors.map(color => {
    const price = colorPrice(prod, color.name);
    return buildItem({
      id: `${prod.id}-${slugify(color.name)}`,
      title: `${prod.title} — ${color.name}`,
      description: prod.description,
      link,
      image: color.image || prod.image,
      additionalImages: (prod.media || []).filter(m => m !== (color.image || prod.image)),
      price,
      comparePrice: (price === prod.price) ? prod.compare_price : null,
      availability: colorAvailability(prod, color.name),
      category,
      gender,
      itemGroupId: prod.id,
      color: color.name,
      sizes: prod.sizes
    });
  });
}

function slugify(str) {
  return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildItem(f) {
  const currency = 'USD';
  const hasSale = f.comparePrice && parseFloat(f.comparePrice) > parseFloat(f.price);

  const additionalImagesXml = (f.additionalImages || [])
    .slice(0, 10)
    .map(img => `    <g:additional_image_link>${xmlEscape(img)}</g:additional_image_link>`)
    .join('\n');

  return `  <item>
    <g:id>${xmlEscape(f.id)}</g:id>
    <title>${xmlEscape(f.title)}</title>
    <description>${xmlEscape(f.description || f.title)}</description>
    <link>${xmlEscape(f.link)}</link>
    <g:image_link>${xmlEscape(f.image)}</g:image_link>
${additionalImagesXml}
    <g:price>${parseFloat(hasSale ? f.comparePrice : f.price).toFixed(2)} ${currency}</g:price>
${hasSale ? `    <g:sale_price>${parseFloat(f.price).toFixed(2)} ${currency}</g:sale_price>\n` : ''}    <g:availability>${f.availability}</g:availability>
    <g:brand>${xmlEscape(BRAND)}</g:brand>
    <g:condition>new</g:condition>
    <g:google_product_category>${xmlEscape(f.category)}</g:google_product_category>
    <g:product_type>${xmlEscape(f.category)}</g:product_type>
    <g:gender>${f.gender}</g:gender>
    <g:age_group>adult</g:age_group>
${f.itemGroupId ? `    <g:item_group_id>${xmlEscape(f.itemGroupId)}</g:item_group_id>\n` : ''}${f.color ? `    <g:color>${xmlEscape(f.color)}</g:color>\n` : ''}${f.sizes && f.sizes.length ? `    <g:size>${xmlEscape(f.sizes[0])}</g:size>\n` : ''}  </item>`;
}

exports.handler = async (event) => {
  try {
    const BASE_URL = process.env.BASE_URL || 'https://bbw4life.com';
    const allProducts = await getAllProductsData();
    const realProducts = allProducts.filter(p => !p.type && p.active === true);

    const items = realProducts
      .flatMap(prod => {
        try {
          return buildItemsForProduct(prod, BASE_URL);
        } catch (e) {
          console.warn(`[product-feed] Skipped ${prod.id}:`, e.message);
          return [];
        }
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${xmlEscape(BRAND)} Product Feed</title>
  <link>${xmlEscape(BASE_URL)}</link>
  <description>${xmlEscape(BRAND)} — Plus Size Fashion &amp; Beauty</description>
${items}
</channel>
</rss>
`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // 1h — le flux reflète products.data.json à chaque appel, un court cache CDN évite juste de le recalculer à chaque crawl
      },
      body: xml
    };
  } catch (err) {
    console.error('[product-feed] Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Error</title><description>${xmlEscape(err.message)}</description></channel></rss>`
    };
  }
};
