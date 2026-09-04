process.removeAllListeners('warning');
const fetch = require('node-fetch');
const path  = require('path');
const fs    = require('fs');
const { notifyTelegram } = require('./notify-telegram');
const { generateChatId, appendLiveChatRow } = require('./_lib/live-chat-sheet');


async function loadProductsData() {
  const localPaths = [
    path.join(process.cwd(), 'products.data.json'),
    path.join(process.cwd(), 'public', 'products.data.json'),
    path.join(process.cwd(), 'dist', 'products.data.json'),
    path.join(__dirname, '..', '..', 'products.data.json'),
    path.join(__dirname, '..', '..', 'public', 'products.data.json'),
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {  }
  }
  const siteUrl = process.env.SITE_URL || process.env.URL || 'https://bbw4life.com';
  const res = await fetch(`${siteUrl}/products.data.json`);
  if (!res.ok) throw new Error(`Cannot load products.data.json: ${res.status}`);
  return res.json();
}

async function loadSearchData() {
  const localPaths = [
    path.join(process.cwd(), 'search.data.json'),
    path.join(process.cwd(), 'public', 'search.data.json'),
    path.join(__dirname, '..', '..', 'search.data.json'),
    path.join(__dirname, '..', '..', 'public', 'search.data.json'),
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {  }
  }
  try {
    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://bbw4life.com';
    const res = await fetch(`${siteUrl}/search.data.json`);
    if (res.ok) return res.json();
  } catch (e) {  }
  return null;
}

async function loadBlogArticles() {
  const localPaths = [
    path.join(process.cwd(), 'blog', 'blog-articles.json'),
    path.join(process.cwd(), 'public', 'blog', 'blog-articles.json'),
    path.join(__dirname, '..', '..', 'blog', 'blog-articles.json'),
    path.join(__dirname, '..', '..', 'public', 'blog', 'blog-articles.json'),
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {  }
  }
  try {
    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://bbw4life.com';
    const res = await fetch(`${siteUrl}/blog/blog-articles.json`);
    if (res.ok) return res.json();
  } catch (e) {  }
  return null;
}


function buildProductIndex(rawData) {
  const allActive = rawData.filter(p => p.type !== 'settings' && p.id && p.active);
  const settings  = rawData.find(p => p.type === 'settings') || {};

  const products = allActive.map((item, index) => {
    const colorsWithImages = (item.colors || [])
      .filter(c => c.active !== false)
      .map(c => ({ name: c.name, hex: c.hex || '', image: c.image || item.image || '' }));

    const variantPrices = (item.variants || []).map(v => v.price).filter(Boolean);
    const minPrice = variantPrices.length ? Math.min(...variantPrices) : item.price;

    return {
      id:            item.id,
      productNumber: index + 1,
      title:         item.title,
      description:   item.description,
      price:         minPrice,
      maxPrice:      item.price,
      compare_price: item.compare_price,
      image:         item.image,
      colors:        colorsWithImages,
      sizes:         item.sizes || [],
      variants:      (item.variants || []).map(v => ({
        vid:   v.vid,
        color: v.color || null,
        size:  v.size  || null,
        price: v.price || item.price,
        image: v.image || colorsWithImages.find(c => c.name === v.color)?.image || item.image || ''
      })),
      discounts: {
        single: item.single_discount || 0,
        duo:    item.duo_discount    || 0,
        trio:   item.trio_discount   || 0
      },
      startDate:    item.start_date || '',
      endDate:      item.end_date   || '',
      rating:       item.rating        || null,
      reviewsCount: item.reviews_count || null,
      badge:        item.badge ? (item.badge.text || '') : '',
      url:          `/products/product${index + 1}.html`,
      eprolo_id:        item.eprolo_id
    };
  });

  return { products, settings };
}

/* ══════════════════════════════════════════════════════
   GENDER IDs — LIRE DEPUIS SETTINGS (jrgq_collections)
══════════════════════════════════════════════════════ */
function buildGenderIds(settings) {
  const jrgqCols = (settings.jrgq_collections && settings.jrgq_collections.collections) || [];

  const menCol = jrgqCols.find(c => c.id === 'men-plus-size');
  const MALE_PRODUCT_IDS = menCol
    ? menCol.product_ids.filter(id => typeof id === 'string' && !id.startsWith('--'))
    : [];

  const womanCol = jrgqCols.find(c => c.id === 'curvy-woman');
  const FEMALE_ONLY_IDS = womanCol
    ? womanCol.product_ids.filter(id => typeof id === 'string' && !id.startsWith('--'))
    : [];

  const beautyCol = jrgqCols.find(c => c.id === 'curvy-beauty');
  const BEAUTY_PRODUCT_IDS = beautyCol
    ? beautyCol.product_ids.filter(id => typeof id === 'string' && !id.startsWith('--'))
    : [];

  return { MALE_PRODUCT_IDS, FEMALE_ONLY_IDS, BEAUTY_PRODUCT_IDS };
}

/* ══════════════════════════════════════════════════════
   BADGE DETECTION
══════════════════════════════════════════════════════ */
function buildBadgeMap(products) {
  const map = new Map();
  for (const p of products) {
    const b = (p.badge || '').trim();
    if (b) map.set(b.toLowerCase(), b);
  }
  return map;
}

function detectBadgeQuery(message, badgeMap) {
  if (!badgeMap.size) return null;
  const q = message.toLowerCase().trim();
  const sorted = [...badgeMap.keys()].sort((a, b) => b.length - a.length);
  for (const badgeLower of sorted) {
    if (q.includes(badgeLower)) return badgeLower;
  }
  return null;
}

/* ══════════════════════════════════════════════════════
   LANGUAGE DETECTION
══════════════════════════════════════════════════════ */
function detectLanguage(message, allowedLanguages) {
  const text = message.toLowerCase().trim();
  const words = text.split(/\s+/).map(w => w.replace(/[^a-záàâçèêëéíîïóôùûüñúkouwòèe]/gi, ''));

  let scores = { en: 0, fr: 0, es: 0, ar: 0, zh: 0, hi: 0, pt: 0, ru: 0, de: 0, ja: 0, ht: 0 };

  if (/[\u0600-\u06FF]/.test(text)) scores.ar += 10;
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) scores.zh += 10;
  if (/[\u0900-\u097F]/.test(text)) scores.hi += 10;
  if (/[\u0400-\u04FF]/.test(text)) scores.ru += 10;
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) scores.ja += 10;

  if (/\b(bonjou|bonswa|mesi|kijan|koman|ki|sa|ou|mwen|nou|yo|ak|nan|pou|sou|gen|pa|fe|di|ale|vini|achte|pri|livrezon|koulè|gwosè|disponib|konbyen|kote|ki lè|ki sa|pwodwi|bèl|chèk|kado|rabi|promo|kòd|réduksyon|kite|rete|deja|toujou|ansanm|zanmi|fanmi|ede|sipò|ekip|kontak|whatsapp|telegram|wap|map|pap|tap)\b/.test(text)) scores.ht += 5;
  if (/\b(m pa|m vle|m bezwen|m renmen|m ap|ou a|li a|nou yo|yo pa|sa a|kisa|poukisa|eske|wi|non|oui|mersi|tanpri|plis|mwens|gwo|piti|bèl|cho|fre)\b/.test(text)) scores.ht += 3;
  ['bonjou','bonswa','mesi','kijan','mwen','nou','ak','nan','pou','sou','gen','pa','fe','di','ale','vini','wi','non'].forEach(w => { if (words.includes(w)) scores.ht += 2; });

  if (/\b(bonjour|bonsoir|salut|merci|comment|c'est|je|vous|nous|les|des|une|pour|avec|dans|sur|mais|très|aussi|peut|plus|produit|livraison|taille|couleur|disponible|combien|où|quand|prix|acheter|réduction)\b/.test(text)) scores.fr += 3;
  if (/[àâçèêëîïôùûü]/.test(text)) scores.fr += 3;
  ['je','tu','il','elle','nous','vous','ils','elles','le','la','les','un','une','des','du','et','est','sont','avec','dans','pour','sur','pas','plus','très','bien','aussi','mais','ou','donc','car','que','qui','quoi','comment','quand','où','pourquoi','quel','quelle','bonjour','merci','oui','non'].forEach(w => { if (words.includes(w)) scores.fr += 2; });

  if (/\b(hola|buenas|buenos|cómo|como|puedo|quiero|necesito|tienes|tengo|gracias|ayuda|precio|envío|producto|comprar|descuento|talla|disponible|cuánto|dónde|también)\b/.test(text)) scores.es += 3;
  if (/[áéíóúüñ¿¡]/.test(text)) scores.es += 3;
  ['yo','él','ella','nosotros','ellos','ellas','los','las','del','al','con','por','para','sobre','más','muy','también','pero','porque','quien','cuando','donde','hola','gracias','sí','tener','ser','estar','hacer','poder','querer'].forEach(w => { if (words.includes(w)) scores.es += 2; });

  if (/\b(olá|oi|obrigado|obrigada|como|você|produto|preço|comprar|ajuda|envio|disponível|desconto)\b/.test(text)) scores.pt += 3;
  if (/[ãõâêôáéíóúàü]/.test(text)) scores.pt += 2;
  ['você','nós','eles','elas','uma','por','para','com','mas','também','não','sim','obrigado','como','onde','quando','porque','produto','preço'].forEach(w => { if (words.includes(w)) scores.pt += 2; });

  if (/\b(hallo|guten|danke|bitte|wie|was|wo|wann|warum|ich|sie|wir|der|die|das|und|für|mit|auf|ist|sind|haben|kaufen|produkt|preis|versand|verfügbar|rabatt)\b/.test(text)) scores.de += 3;
  if (/[äöüß]/.test(text)) scores.de += 3;
  ['ich','du','er','sie','es','wir','ihr','der','die','das','und','ist','sind','mit','auf','für','von','zu','an','ein','eine','nicht','auch','aber','oder','wie','was','wo','wann'].forEach(w => { if (words.includes(w)) scores.de += 2; });

  if (/\b(hello|hi|hey|what|how|can|could|would|should|where|when|why|which|who|the|and|for|with|this|that|have|your|you|want|need|does|do|is|are|was|were|help|price|shipping|color|size|available|discount|product|buy|order)\b/.test(text)) scores.en += 3;
  ['i','you','he','she','it','we','they','the','a','an','is','are','was','were','have','has','had','do','does','did','will','would','can','could','should','may','might','and','or','but','for','with','at','by','from','to','in','on','of','that','this','what','how','when','where','why','who','which'].forEach(w => { if (words.includes(w)) scores.en += 1; });

  let detected = 'en';
  let best = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > best) { best = score; detected = lang; }
  }
  if (best === 0) detected = 'en';

  if (allowedLanguages && allowedLanguages.length > 0) {
    if (allowedLanguages.includes(detected)) return detected;
    if (allowedLanguages.includes('en')) return 'en';
    return allowedLanguages[0];
  }

  return detected;
}

function getLangName(code) {
  const names = {
    en: 'ENGLISH', fr: 'FRENCH', es: 'SPANISH', ar: 'ARABIC',
    zh: 'CHINESE', hi: 'HINDI', pt: 'PORTUGUESE', ru: 'RUSSIAN',
    de: 'GERMAN', ja: 'JAPANESE', ht: 'HAITIAN CREOLE'
  };
  return names[code] || 'ENGLISH';
}

/* ══════════════════════════════════════════════════════
   SMART INTENT DETECTION
══════════════════════════════════════════════════════ */
function detectIntent(message) {
  const q = message.toLowerCase();

  const generalPatterns = [
    /fondateur|founder|qui.+(fond|cre[aé]t)|francenel|administrateur|admin/,
    /objectif|mission|but de bbw|about bbw|à propos/,
    /\bequipe\b|\bteam\b|\bstaff\b/,
    /c.est quoi bbw|what is bbw|what.s bbw4life/,
    /histoire|story|origin|origine/,
    /pourquoi.+(cre|fond|lanc)|why.+(creat|found|launch)/,
    /mouvement|movement|communauté|community|famille|family/,
    /beauté|beauty|courbes|curves|plus.?size|taille.+plus/,
    /conseils?|advice|astuce|tips?/,
    /confiance|confidence|acceptation|acceptance|estime de soi|self.esteem/,
    /stress|anxiet|depress|mental|moral/,
    /contact|joindre|reach|parler.+(humain|person|quelqu)|message|whatsapp|telegram/,
    /support|aide.+(équipe|team)/,
    /blog|article|post|read|lire/,
    /\bcompte\b|\baccount\b|\bcuenta\b/,
    /mon profil|my profile|mi perfil/,
    /mes commandes|my orders|mis pedidos/,
    /historique.+(commande|order|pedido)/,
    /mode.+paiement|payment method|método.+pago/,
    /changer.+(mot de passe|password|contraseña)/,
    /wishlist|liste.+(souhaits|envie)|saved items/,
    /suivre.+(commande|colis)|track.+(order|package)|rastrear/,
    /collection|catalogue|catalog|tous les produits|all products|todas las colecciones/,
    /frais.+(port|livraison)|shipping cost|costo.+envío/,
    /livraison|shipping.+info|delivery.+time|délai/,
    /taxes|impôts|impuestos/,
    /stripe|paypal|apple pay|google pay|carte.+crédit|credit card|tarjeta/,
    /privacy|confidentialit|privacidad|données.+person|personal.+data/,
    /remboursement|refund|reembolso|retour|return|devolution/,
    /conditions.+(utilisation|service|vente)|terms.+(service|conditions|use)|términos/,
    /disclaimer|avertissement|advertencia/,
    /politique|policy|politica/,
    /cookies|tracking|pistage/,
    /votre propre marque|votre propre collection|vous avez.+(marque|brand|collection propre)|est.ce que bbw.+(une marque|son propre)|avez.vous.+(marque|design)/i,
    /your own brand|your own collection|do you have.+(brand|own collection|your own)|is bbw.+(a brand|own brand)/i,
    /tienen.+(su propia marca|colección propia)|es bbw.+(una marca|marca propia)|tienen marca propia/i,
    /bbw.+(sa propre|son propre|leur propre).+(marque|collection|design)/i,
    /marque propre|propre marque|brand propre|own brand|marca propia/i,
    /curvafit|curva.?fit/i,
    /^(bonjour|bonsoir|salut|hello|hi|hey|hola|buenas|buenos|allo|yow|yo|wesh|cc|bonjou|bonswa)\b/,
    /^(merci|thank|thanks|gracias|ok|okay|d.accord|super|parfait|génial|great|bien|bueno|mesi|wi|non|oke|dakò)\b/,
    /^(ok|okay|k|ok|oke|ugh|ah|oh|wow|nice|cool|perfect|parfait|super|bien|good|great|noted|got it|compris|noté|alright|sure|yep|yup|nope|nah|true|exactly|right|correct|absolutely|definitely|of course|bien sûr|exactement|précisément|merci|thanks|thx|ty|np|no problem|no worries|pas de problème|d'accord|c'est bon|ça marche|ça va|bien reçu|reçu|👍|🙏|❤️|😊|🥰)[\s!.,]*$/i,
  ];

  for (const pattern of generalPatterns) {
    if (pattern.test(q)) return 'general';
  }

  const productPatterns = [
    /acheter|buy|commander|order|comprar|pedir|ordenar/,
    /produit|product|article|producto|artículo/,
    /recommande.+(produit|article)|recommend.+(product|item)|recomienda.+(producto)/,
    /quel.+(produit|article)|which.+(product|item)|qué.+(producto)/,
    /montre.+(produit)|show.+(product|me)|muestra.+(producto)/,
    /robe|dress|vestido|chaussure|shoe|zapato|sandale|sandal|sandalia/,
    /soutien.gorge|bra|sujetador|bikini|maillot|swimsuit|traje.+baño/,
    /jean|pantalon|pant|trouser|short|shorts|veste|jacket|manteau/,
    /haut|top|chemise|shirt|blouse|pull|sweat|sweater|robe.+nuit|nightdress/,
    /lingerie|ensemble|set|peignoir|robe.+chambre|bathrobe/,
    /vernis|nail|ongle|mascara|eye|sourcil|eyebrow|brow|rouge.+lèvre|lipstick|lipgloss/,
    /soin|serum|crème|cream|masque|mask|huile|oil|nettoyant|cleanser/,
    /cheveux|hair|coiffure|shampooing|shampoo/,
    /beauty|beauté|maquillage|makeup/,
    /taille.+(disponible|dispo)|available.+(color|size)|qué.+(color|talla)/,
    /existe.+(couleur|taille)|come in.+(color|size)|viene.+(color|talla)/,
    /\$\d+|under \$|moins de \$|budget.+(produit|product)|menos de \$/,
    /combien.+(coûte|cost).+(ce|this|le|la)|cuánto.+(cuesta|vale)/,
    /best.?seller|meilleure?.+vente|más.+vendido|top.+vente/,
    /en promotion|in promotion|on sale|en promo/,
    /new.?arrival|nouvel?.+arriv|nueva?.+llegad/,
    /top.+deal|meilleure?.+offre|mejor.+oferta/,
  ];

  for (const pattern of productPatterns) {
    if (pattern.test(q)) return 'product';
  }

  return 'general';
}

/* ══════════════════════════════════════════════════════
   TOP STARTER REQUEST
══════════════════════════════════════════════════════ */
function isTopStarterRequest(message) {
  const q = message.toLowerCase();
  const patterns = [
    /produits?.+(pour commencer|pour débuter|pour démarrer)/,
    /pour.+(commencer|débuter|démarrer).+(mon style|ma garde.robe|ma beauté|ma transform)/,
    /par où commencer/,
    /que me recommandes.+pour commencer/,
    /quels? produits?.+commencer/,
    /pour bien commencer/,
    /je (suis |)nouveau.+(ici|cliente?)/,
    /kit.+(départ|débutant|starter)/,
    /pack.+(débutant|commencer|démarrer)/,
    /products?.+to (get started|start my journey|begin my journey)/,
    /where (do i |should i |can i |)(start|begin)/,
    /what.*recommend.*to start/,
    /best products?.+for (absolute )?beginners?/,
    /starter.+products?/,
    /i('m| am) new (here|to bbw4life)/,
    /to start my (journey|transformation|style journey)/,
    /get started (with|on) bbw4life/,
    /productos?.+(para empezar|para comenzar|para iniciar)/,
    /por dónde empezar/,
    /qué me recomiendas para empezar/,
    /soy nueva.+(aquí|cliente)/,
  ];
  return patterns.some(p => p.test(q));
}

/* ══════════════════════════════════════════════════════
   GREETING DETECTION
══════════════════════════════════════════════════════ */
function isGreeting(message) {
  const q = message.toLowerCase().trim();
  return /^(bonjour|bonsoir|salut|hello|hi|hey|hola|buenas|buenos|allo|yow|yo|wesh|cc|good morning|good evening|good afternoon|buenos días|buenas noches|buenas tardes|bonjou|bonswa)[\s!.,]*$/.test(q);
}

/* ══════════════════════════════════════════════════════
   SHORT ACK DETECTION
══════════════════════════════════════════════════════ */
function isShortAck(message) {
  const q = message.toLowerCase().trim();
  const wordCount = q.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount > 5) return false;
  return /^(ok|okay|k|oui|non|wi|non|merci|mesi|thanks|thx|ty|super|parfait|génial|great|bien|bueno|nice|cool|perfect|noted|got it|compris|alright|sure|yep|yup|nope|d'accord|ça marche|ça va|bien reçu|reçu|👍|🙏|❤️|😊|🥰|ah|oh|wow|true|right|correct|exactly|absolutely|definitely|of course|bien sûr|exactement|np|no problem|no worries|pas de problème|c'est bon)[\s!.,🙏❤️😊🥰]*$/.test(q);
}

/* ══════════════════════════════════════════════════════
   GENDER DETECTION
══════════════════════════════════════════════════════ */
function detectGender(message) {
  const q = message.toLowerCase();

  const malePatterns = [
    /\b(homme|hommes|masculin|masculins|pour homme|pour les hommes|men|man|male|hombre|hombres|para hombre|masculino|garçon|garçons|boy|boys|chico|chicos|monsieur|messieurs|mec|mecs|gars)\b/,
    /\b(men'?s|menswear|pour lui|for him|para él|pour un homme|for a man)\b/,
    /\b(taille homme|size men|vêtement homme|clothing men|mode homme|fashion men|chaussure homme|men.?s shoe|zapatos hombre)\b/,
  ];

  const femalePatterns = [
    /\b(femme|femmes|féminin|pour femme|pour les femmes|women|woman|female|mujer|mujeres|para mujer|femenino|dame|dames|lady|ladies|señora|señoras)\b/,
    /\b(women'?s|womenswear|pour elle|for her|para ella|pour une femme|for a woman)\b/,
    /\b(taille femme|size women|vêtement femme|clothing women|mode femme|fashion women|chaussure femme|women.?s shoe|zapatos mujer)\b/,
  ];

  const beautyPatterns = [
    /\b(beauty|beauté|maquillage|makeup|soin|skincare|nail|ongle|mascara|eyebrow|sourcil|lip|lèvre|cheveux|hair|serum|crème|cream|huile|oil|vernis|gloss|mascara|brow|nails)\b/,
  ];

  const hasMale   = malePatterns.some(p   => p.test(q));
  const hasFemale = femalePatterns.some(p => p.test(q));
  const hasBeauty = beautyPatterns.some(p => p.test(q));

  if (hasBeauty && !hasMale && !hasFemale) return 'beauty';
  if (hasMale && !hasFemale) return 'male';
  if (hasFemale && !hasMale) return 'female';
  return null;
}

/* ══════════════════════════════════════════════════════
   BRAND QUERY DETECTION
══════════════════════════════════════════════════════ */
function isBrandQuery(message) {
  const q = message.toLowerCase();
  return /votre propre marque|votre propre collection|vous avez.+(marque|brand|collection propre)|est.ce que bbw.+(une marque|son propre)|avez.vous.+(marque|design)|your own brand|your own collection|do you have.+(brand|own collection|your own)|is bbw.+(a brand|own brand)|tienen.+(su propia marca|colección propia)|es bbw.+(una marca|marca propia)|tienen marca propia|bbw.+(sa propre|son propre|leur propre).+(marque|collection|design)|marque propre|propre marque|brand propre|own brand|marca propia/.test(q);
}

/* ══════════════════════════════════════════════════════
   PRODUCT SEARCH
══════════════════════════════════════════════════════ */
function searchProducts(query, products, genderFilter, MALE_PRODUCT_IDS, FEMALE_ONLY_IDS, BEAUTY_PRODUCT_IDS) {
  if (!query) return { results: [], isVague: false };
  const q        = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(k => k.length >= 2);

  
  let baseProducts = products;
  if (genderFilter === 'male') {
    baseProducts = products.filter(p => MALE_PRODUCT_IDS.includes(p.id));
    if (baseProducts.length === 0) {
      console.warn('[Chat] Gender filter male returned 0 products — check MALE_PRODUCT_IDS in settings');
    }
  } else if (genderFilter === 'female') {
    baseProducts = products.filter(p => FEMALE_ONLY_IDS.includes(p.id));
    if (baseProducts.length === 0) {
      console.warn('[Chat] Gender filter female returned 0 products — check FEMALE_ONLY_IDS in settings');
    }
  } else if (genderFilter === 'beauty') {
    baseProducts = BEAUTY_PRODUCT_IDS.length
      ? products.filter(p => BEAUTY_PRODUCT_IDS.includes(p.id))
      : products;
    if (baseProducts.length === 0) {
      console.warn('[Chat] Gender filter beauty returned 0 products — check BEAUTY_PRODUCT_IDS in settings');
    }
  }

  const scored = baseProducts.map(p => {
    let score = 0;
    const searchText = `${p.title} ${p.description}`.toLowerCase();
    keywords.forEach(kw => {
      if (searchText.includes(kw)) score += 3;
      if (p.title.toLowerCase().includes(kw)) score += 2;
      p.colors.forEach(c => { if (c.name.toLowerCase().includes(kw)) score += 2; });
      p.sizes.forEach(s  => { if (String(s).toLowerCase().includes(kw)) score += 1; });
    });

    if (/meilleur|best|top|plus vendu|most sold|más vendido|popular|populaire/.test(q)) {
      if (p.rating && p.rating >= 4.5) score += 8;
      if (p.reviewsCount && p.reviewsCount >= 50) score += 5;
    }

    const badgeLower = (p.badge || '').toLowerCase();
    if ((q.includes('best seller') || q.includes('meilleure vente') || q.includes('meilleur vente') || q.includes('top vente') || q.includes('más vendido')) && badgeLower.includes('best seller')) score += 15;
    if ((q.includes('promotion') || q.includes('promo') || q.includes('on sale') || q.includes('en promo') || q.includes('in promotion')) && badgeLower.includes('promotion')) score += 15;
    if ((q.includes('new arrival') || q.includes('new arriv') || q.includes('nouvel') || q.includes('nouveau') || q.includes('nueva llegada')) && badgeLower.includes('new')) score += 15;
    if ((q.includes('top sale') || q.includes('top deal') || q.includes('meilleure offre') || q.includes('mejor oferta')) && (badgeLower.includes('top sale') || badgeLower.includes('best deal'))) score += 15;

    const themes = [
      { words: ['glam','heel','stiletto','cross strap','sandale'],      id: 'Pdg-Francenel-product1',  boost: 12 },
      { words: ['retrorun','sneaker','chunky','street','retro'],        id: 'Pdg-Francenel-product2',  boost: 12 },
      { words: ['boho','flip','sandal','summer','embroid'],             id: 'Pdg-Francenel-product3',  boost: 12 },
      { words: ['powerheels','stiletto pump','12cm','queen'],           id: 'Pdg-Francenel-product4',  boost: 12 },
      { words: ['winterboost','boot','ankle boot','court'],             id: 'Pdg-Francenel-product5',  boost: 12 },
      { words: ['colorstilett','stiletto flip flop','vibrant'],        id: 'Pdg-Francenel-product6',  boost: 12 },
      { words: ['nightchic','mock neck','long sleeve','dress'],         id: 'Pdg-Francenel-product7',  boost: 12 },
      { words: ['slitlux','cutout','slit','round neck'],                id: 'Pdg-Francenel-product8',  boost: 12 },
      { words: ['plaid','overall','dungaree','wide strap'],             id: 'Pdg-Francenel-product9',  boost: 12 },
      { words: ['floral','flounce','surplice','printed'],               id: 'Pdg-Francenel-product10', boost: 12 },
      { words: ['vintage','square neck','short sleeve','imprim'],       id: 'Pdg-Francenel-product11', boost: 12 },
      { words: ['paisley','belt','orange','belted'],                    id: 'Pdg-Francenel-product12', boost: 12 },
      { words: ['mesh duo','perspective','two piece','sheer'],          id: 'Pdg-Francenel-product13', boost: 12 },
      { words: ['meshglam','solid','stitching','maxi'],                 id: 'Pdg-Francenel-product14', boost: 12 },
      { words: ['linen','breeze','cotton','button.down'],               id: 'Pdg-Francenel-product15', boost: 12 },
      { words: ['striped','mini','v.neck','vneck'],                     id: 'Pdg-Francenel-product16', boost: 12 },
      { words: ['loungerobe','bathrobe','sleepwear','peignoir'],        id: 'Pdg-Francenel-product17', boost: 12 },
      { words: ['lacenight','nightdress','strap','night dress'],        id: 'Pdg-Francenel-product18', boost: 12 },
      { words: ['lacethong','lingerie','sheer skirt','set lingerie'],   id: 'Pdg-Francenel-product19', boost: 12 },
      { words: ['solid','bikini','high waist','swimsuit'],              id: 'Pdg-Francenel-product20', boost: 12 },
      { words: ['curvebikini','curve','swimwear','solid color'],        id: 'Pdg-Francenel-product21', boost: 12 },
      { words: ['leopard','mesh','pajama','pyjama'],                    id: 'Pdg-Francenel-product22', boost: 12 },
      { words: ['supportbra','bra','breathable','large cup'],           id: 'Pdg-Francenel-product23', boost: 12 },
      { words: ['laceromper','romper','jumpsuit','lace'],               id: 'Pdg-Francenel-product24', boost: 12 },
      { words: ['striped','print','stripes','swimwear'],                id: 'Pdg-Francenel-product25', boost: 12 },
      { words: ['tube','tube top','swimsuit','swimming'],               id: 'Pdg-Francenel-product26', boost: 12 },
      { words: ['ruffle','ruffle','one piece','v.neck swim'],           id: 'Pdg-Francenel-product27', boost: 12 },
      { words: ['bandage','bandage bikini','swimsuit'],                 id: 'Pdg-Francenel-product28', boost: 12 },
      { words: ['contrast','contrasting','one.piece','swim'],          id: 'Pdg-Francenel-product29', boost: 12 },
      { words: ['premium','plus size','swimsuit collection'],           id: 'Pdg-Francenel-product30', boost: 12 },
      { words: ['irregular','top','loose','round neck'],                id: 'Pdg-Francenel-product31', boost: 12 },
      { words: ['christmas','sweat','sweatshirt','casual'],             id: 'Pdg-Francenel-product32', boost: 12 },
      { words: ['dalmatian','dalmation','shorts','high waist'],         id: 'Pdg-Francenel-product33', boost: 12 },
      { words: ['leopard','shirt','irregular collar','blouse'],         id: 'Pdg-Francenel-product34', boost: 12 },
      { words: ['drawstring','pants','pockets','casual'],               id: 'Pdg-Francenel-product35', boost: 12 },
      { words: ['crop','slim','cropped','drawstring pants'],            id: 'Pdg-Francenel-product36', boost: 12 },
      { words: ['harem','printed','trouser','cuffed'],                  id: 'Pdg-Francenel-product37', boost: 12 },
      { words: ['loose','jeans','relaxed','denim'],                     id: 'Pdg-Francenel-product38', boost: 12 },
      { words: ['british','loafer','formal','tassel'],                  id: 'Pdg-Francenel-product39', boost: 12 },
      { words: ['airmesh','runner','sport','sneaker','mesh shoe'],      id: 'Pdg-Francenel-product40', boost: 12 },
      { words: ['leather','casual','flat','breathable'],                id: 'Pdg-Francenel-product41', boost: 12 },
      { words: ['business','formal','wedding','dress shoe'],            id: 'Pdg-Francenel-product42', boost: 12 },
      { words: ['hollow','mesh','big size','fashion shoe'],             id: 'Pdg-Francenel-product43', boost: 12 },
      { words: ['trendtrainer','outdoor','sport shoe','trainer'],       id: 'Pdg-Francenel-product44', boost: 12 },
      { words: ['patent','loafer','luxury','party shoe'],               id: 'Pdg-Francenel-product45', boost: 12 },
      { words: ['collar','shirt','button.down','chemise'],              id: 'Pdg-Francenel-product46', boost: 12 },
      { words: ['geo','polo','geometric','print polo'],                 id: 'Pdg-Francenel-product47', boost: 12 },
      { words: ['striped collar','sweater','knit','collar sweater'],   id: 'Pdg-Francenel-product48', boost: 12 },
      { words: ['turtleneck','lux','long sleeve','pull'],               id: 'Pdg-Francenel-product49', boost: 12 },
      { words: ['hike','jacket','waterproof','outdoor'],                id: 'Pdg-Francenel-product50', boost: 12 },
      { words: ['roundneck','sweatshirt','pullover','mens'],            id: 'Pdg-Francenel-product51', boost: 12 },
      { words: ['nail','glue','uv','adhesive'],                         id: 'Pdg-Francenel-product52', boost: 12 },
      { words: ['bow','nail','fake nail','almond'],                     id: 'Pdg-Francenel-product53', boost: 12 },
      { words: ['nail','repair','lotion','nourish'],                    id: 'Pdg-Francenel-product54', boost: 12 },
      { words: ['brow','eyebrow','pencil','waterproof'],                id: 'Pdg-Francenel-product55', boost: 12 },
      { words: ['mascara','volumizing','4d','lash'],                    id: 'Pdg-Francenel-product56', boost: 12 },
      { words: ['browkit','eyebrow kit','stencil','cream'],             id: 'Pdg-Francenel-product57', boost: 12 },
      { words: ['obsidian','lip','balm','moisture'],                    id: 'Pdg-Francenel-product58', boost: 12 },
      { words: ['lip gloss','tearoff','peel.off','long.lasting'],       id: 'Pdg-Francenel-product59', boost: 12 },
      { words: ['ginger','lemon','makeup remover','clean pad'],         id: 'Pdg-Francenel-product60', boost: 12 },
      { words: ['hair mask','repair','moisturize','smooth'],            id: 'Pdg-Francenel-product61', boost: 12 },
      { words: ['batana','oil','hair oil','glow'],                      id: 'Pdg-Francenel-product62', boost: 12 },
      { words: ['batanaboost','conditioner','hair growth','120ml'],     id: 'Pdg-Francenel-product63', boost: 12 },
      { words: ['poreclean','exfoliant','anti-acne','pore'],            id: 'Pdg-Francenel-product64', boost: 12 },
      { words: ['knuckle','white','serum','brightener'],                id: 'Pdg-Francenel-product65', boost: 12 },
      { words: ['propolis','glow','essence','brightening'],             id: 'Pdg-Francenel-product66', boost: 12 },
      { words: ['menglow','men','concealing','lazy cream'],             id: 'Pdg-Francenel-product67', boost: 12 },
      { words: ['ice','grid','silicone','cooling','facial'],            id: 'Pdg-Francenel-product68', boost: 12 },
    ];

    themes.forEach(t => {
      if (p.id === t.id && t.words.some(w => q.includes(w))) score += t.boost;
    });

    if ((q.includes('cheap') || q.includes('budget') || q.includes('pas cher') || q.includes('barato') || q.includes('économico')) && p.price < 20) score += 5;
    return { ...p, score };
  });

  const filtered = scored.filter(p => p.score > 0).sort((a, b) => b.score - a.score);
  if (filtered.length === 0) return { results: [], isVague: false };

  const topScore    = filtered[0].score;
  const secondScore = filtered[1]?.score || 0;
  const gap         = topScore - secondScore;

  if (topScore >= 14 && gap >= 6) return { results: filtered.slice(0, 1), isVague: false };
  if (filtered.length >= 3 && gap <= 4) return { results: filtered.slice(0, 4), isVague: true };
  return { results: filtered.slice(0, 2), isVague: false };
}


function formatDelivery(startDate, endDate) {
  if (!startDate || !endDate) return null;
  try {
    const opts = { day: '2-digit', month: '2-digit', year: '2-digit' };
    const s = new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', opts);
    const e = new Date(endDate   + 'T00:00:00').toLocaleDateString('en-GB', opts);
    return `${s} – ${e}`;
  } catch (_) { return null; }
}

function buildSearchDataContext(searchData) {
  if (!searchData || !Array.isArray(searchData)) return '';
  const pages    = searchData.filter(i => i.type === 'page');
  const policies = searchData.filter(i => i.type === 'policy');
  const blogs    = searchData.filter(i => i.type === 'blog');
  let text = '';
  if (pages.length)    { text += '\nSITE PAGES:\n';    pages.forEach(p    => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (policies.length) { text += '\nPOLICIES:\n';      policies.forEach(p => { text += `  • ${p.title} → ${p.url}\n`; }); }
  if (blogs.length)    { text += '\nBLOG ARTICLES:\n'; blogs.forEach(p    => { text += `  • ${p.title} → ${p.url}\n`; }); }
  return text;
}

function buildBlogContext(blogData) {
  if (!blogData) return '';
  let articles = [];
  if (Array.isArray(blogData)) { articles = blogData; }
  else if (blogData.articles && Array.isArray(blogData.articles)) { articles = blogData.articles; }
  else if (typeof blogData === 'object') {
    for (const key of Object.keys(blogData)) { if (Array.isArray(blogData[key])) { articles = blogData[key]; break; } }
  }
  if (!articles.length) return '';
  let text = '\nBLOG ARTICLES:\n';
  articles.forEach(a => {
    const title   = a.title    || a.name    || 'Untitled';
    const url     = a.url      || a.slug    || a.link    || '/blog/blog.html';
    const summary = a.summary  || a.excerpt || a.description || '';
    const cat     = a.category || a.tag     || '';
    const date    = a.date     || a.published_at || '';
    text += `  • "${title}"`;
    if (cat)  text += ` [${cat}]`;
    if (date) text += ` (${date})`;
    text += ` → ${url}`;
    if (summary) text += `\n    Summary: ${summary.substring(0, 150)}${summary.length > 150 ? '...' : ''}`;
    text += '\n';
  });
  return text;
}

/* ══════════════════════════════════════════════════════
   PAGE_MAP — toutes les pages connues du site
══════════════════════════════════════════════════════ */
const PAGE_MAP = {
  '/index.html':                               { label: 'Home',               icon: '🏠' },
  '/collections/bbw4life-all-product.html':    { label: 'Shop All',           icon: '🛍️' },
  '/collections/bbw4life-all-collections.html':{ label: 'Collections',        icon: '🗂️' },
  '/collections/curvy-woman.html':             { label: 'Curvy Woman',        icon: '💃' },
  '/collections/curvy-dresses.html':           { label: 'Curvy Dresses',      icon: '👗' },
  '/collections/curvy-beauty.html':            { label: 'Curvy Beauty',       icon: '💄' },
  '/collections/men-plus-size.html':           { label: 'Men Plus Size',      icon: '👔' },
  '/collections/main-plus-size.html':          { label: 'Men Plus Size',      icon: '👔' },
  '/collections/bbw4life-pants-skirts.html':   { label: 'Pants & Shorts',     icon: '👖' },
  '/collections/most-popular.html':            { label: 'Most Popular',       icon: '🔥' },
  '/collections/bbw-features-products.html':   { label: 'BBW Featured',       icon: '✨' },
  '/collections/shoes-sandals.html':           { label: 'Shoes & Sandals',    icon: '👟' },
  '/cart.html':                                { label: 'My Cart',            icon: '🛒' },
  '/blog/blog.html':                           { label: 'Blog',               icon: '📝' },
  '/page/our-story.html':                      { label: 'Our Story',          icon: '💖' },
  '/page/about.html':                          { label: 'About Us',           icon: 'ℹ️' },
  '/page/contact.html':                        { label: 'Contact',            icon: '📩' },
  '/account.html':                             { label: 'My Account',         icon: '👤' },
  '/page/order-tracking.html':                 { label: 'Order Tracking',     icon: '📦' },
  '/page/faq.html':                            { label: 'FAQ',                icon: '❓' },
  '/policies/privacy.html':                    { label: 'Privacy Policy',     icon: '🔒' },
  '/policies/refund.html':                     { label: 'Refund Policy',      icon: '↩️' },
  '/policies/shipping.html':                   { label: 'Shipping Info',      icon: '🚚' },
  '/policies/terms.html':                      { label: 'Terms & Conditions', icon: '📄' },
  '/page/disclaimer.html':                     { label: 'Disclaimer',         icon: '📋' },
  '/page/products-care.html':                  { label: 'Product Care Guide', icon: '✨' },
};

/* ══════════════════════════════════════════════════════
   BUILD SYSTEM PROMPT
══════════════════════════════════════════════════════ */
function buildSystemPrompt(products, settings, contactInfo, searchData, blogData, badgeMap, allowedLanguages) {
  
const founder = settings.founder || {};
const founderName        = founder.full_name    || 'Paul Francenel';
const founderAge         = founder.age          || 26;
const founderTitle       = founder.title        || 'CEO & Founder';
const founderPhoto       = founder.photo        || '';
const founderFounded     = founder.founded      || 'June 18, 2025';
const founderNationality = founder.nationality  || 'Haitian';
const founderBio         = founder.bio          || '';
const founderMission     = founder.mission      || '';
const founderPersonality = founder.personality  || '';
const founderQuote       = founder.quote        || '';
const founderValues      = (founder.values      || []).map(v => `  • ${v}`).join('\n');
const founderFunFacts    = (founder.fun_facts   || []).map(f => `  • ${f}`).join('\n');
const founderPhotoLine   = founderPhoto
  ? `\n**Founder photo:** ![${founderName}](${founderPhoto})`
  : '';
  
  const contactEmails  = settings.contact_emails || {};
  const emailsText     = Object.entries(contactEmails).map(([k, v]) => `• ${k}: ${v}`).join('\n') || '• No emails configured';
  const affiliation    = settings.affiliation || {};
  const promos         = settings.promos      || [];
  const shipping       = settings.cart_drawer || {};
  const taxRate        = settings.tax_rate      || 0.5;
  const shippingCost   = settings.shipping_cost || 40.0;
  const taxPercent     = Math.round(taxRate * 100);
  const freeShipThresh = shipping.free_shipping_threshold || 140;

  const promosText = promos.length
    ? promos.map(p => `• Code **[[${p.code}]]** → **${p.percent}% off** on ${p.items}+ items`).join('\n')
    : '• No active promo codes at this time';

  const jrgqCols      = (settings.jrgq_collections && settings.jrgq_collections.collections) || [];
  const featuredCol   = jrgqCols.find(c => c.id === 'bbw-features-products');
  const featuredIds   = (featuredCol && featuredCol.product_ids) || [];
  const EXCLUDED_IDS  = featuredIds;

  const visibleProducts = products.filter(p => !EXCLUDED_IDS.includes(p.id));

  const featuredTitles = EXCLUDED_IDS
    .map(id => products.find(p => p.id === id))
    .filter(Boolean)
    .map(p => `**${p.title}**`)
    .join(', ') || 'exclusive original designs';

  const catalogText = visibleProducts.map((p, i) => {
    const colorsList = p.colors.map(c => c.name).join(', ');
    const sizesList  = p.sizes.length ? p.sizes.join(', ') : 'No size needed';
    const discounts  = [
      p.discounts.single ? `1 item: -${p.discounts.single}%` : '',
      p.discounts.duo    ? `2 items: -${p.discounts.duo}%`   : '',
      p.discounts.trio   ? `3 items: -${p.discounts.trio}%`  : '',
    ].filter(Boolean).join(' | ') || 'No discount';
    const delivery  = formatDelivery(p.startDate, p.endDate) || 'Contact us';
    const rating    = p.rating ? `${p.rating}/5 (${p.reviewsCount || 0} reviews)` : 'N/A';
    const badgeLine = p.badge ? `\n  Badge: ${p.badge}` : '';
    return `
PRODUCT ${i + 1}:
  Title: ${p.title}
  Description: ${p.description}
  Price: $${p.price}${p.maxPrice !== p.price ? ` to $${p.maxPrice}` : ''} (was $${p.compare_price})
  Rating: ${rating}${badgeLine}
  Colors: ${colorsList || 'N/A'}
  Sizes: ${sizesList}
  Discounts: ${discounts}
  Delivery: ${delivery}
  Page: ${p.url}`;
  }).join('\n');

  const realBadgeList = [...badgeMap.values()].join(', ') || 'none';

  const topStarter      = settings.top_starter_products || {};
  const topStarterIds   = topStarter.product_ids || [];
  const topStarterLabel = topStarter.label || 'Best products to discover BBW4LIFE';
  const topStarterList  = topStarterIds
    .filter(id => !EXCLUDED_IDS.includes(id))
    .map(id => {
      const prod = visibleProducts.find(p => p.id === id);
      return prod ? `  • ${prod.title} → ${prod.url}` : null;
    }).filter(Boolean).join('\n');

  const contactChannels = [];
  if (contactInfo.hasWhatsapp) contactChannels.push('WhatsApp');
  if (contactInfo.hasTelegram) contactChannels.push('Telegram');
  contactChannels.push('Contact page');

  const searchContext = buildSearchDataContext(searchData);
  const blogContext   = buildBlogContext(blogData);

  const shippingOptions = [
    settings.shipping_standard_delay ? `• Standard (free over $${freeShipThresh}, ${settings.shipping_standard_delay})` : null,
    settings.shipping_dhl_delay      ? `• Express DHL (${settings.shipping_dhl_delay})`                                  : null,
    settings.shipping_priority_delay ? `• Priority (${settings.shipping_priority_delay})`                                : null,
    settings.shipping_economy_delay  ? `• Economy (${settings.shipping_economy_delay})`                                  : null,
    settings.shipping_express_delay  ? `• Express (${settings.shipping_express_delay})`                                  : null,
  ].filter(Boolean).join('\n');

  const menCol    = jrgqCols.find(c => c.id === 'men-plus-size');
  const womanCol  = jrgqCols.find(c => c.id === 'curvy-woman');
  const beautyCol = jrgqCols.find(c => c.id === 'curvy-beauty');
  const menCount    = menCol    ? menCol.stat_value    : 'several styles';
  const womanCount  = womanCol  ? womanCol.stat_value  : 'several styles';
  const beautyCount = beautyCol ? beautyCol.stat_value : 'several styles';

  const collectionsContext = `
COLLECTIONS THAT EXIST ON BBW4LIFE:
  • Curvy Woman (${womanCount}: shoes, dresses, bathrobe, sexy, breathable, bikini, tops) → use 🔗[PAGE:/collections/curvy-woman.html]
  • Men Plus Size (${menCount}: pants, jeans, shirts, sweaters, men shoes) → use 🔗[PAGE:/collections/men-plus-size.html]
  • Curvy Beauty (${beautyCount}: nails, eyebrow, lip, makeup, haircare, skincare) → use 🔗[PAGE:/collections/curvy-beauty.html]
  • Curvy Dresses (dresses, bathrobe, sexy, breathable) → use 🔗[PAGE:/collections/curvy-dresses.html]
  • Pants & Shorts (5 styles) → use 🔗[PAGE:/collections/bbw4life-pants-skirts.html]
  • Most Popular (community favorites) → use 🔗[PAGE:/collections/most-popular.html]
  • All Products (68+ styles, everything) → use 🔗[PAGE:/collections/bbw4life-all-product.html]
  • Shoes & Sandals (women heels, sandals, sneakers, boots + men formal, casual, sport shoes) → use 🔗[PAGE:/collections/shoes-sandals.html]
  • BBW Featured (exclusive original designs, request available) → use 🔗[PAGE:/collections/bbw-features-products.html]
  • My Cart → use 🔗[PAGE:/cart.html]

PAGES THAT EXIST ON BBW4LIFE:
  Home, Shop All, Collections, Curvy Woman, Curvy Dresses, Curvy Beauty, Men Plus Size,
  Pants & Shorts, Most Popular, BBW Featured, Shoes & Sandals, Blog, Our Story,
  About Us, Contact, My Account, Order Tracking, FAQ, Privacy Policy, Refund Policy,
  Shipping Info, Terms & Conditions, Disclaimer, Product Care Guide, My Cart.

PAGES / COLLECTIONS THAT DO NOT EXIST:
  If a user asks for a page, section, or collection that is NOT in the list above →
  Reply clearly and honestly: "This page/collection doesn't exist on BBW4LIFE."
  NEVER invent a fake URL. NEVER redirect to a wrong page. NEVER guess.
  If you have zero information about something → say clearly: "I don't have information about that."
`;

  const plansAvailable = (settings.plans_available || 'no').toLowerCase().trim() === 'yes';

  const brandSection = plansAvailable ? `
═══════════════════════════════════════
🏷️ BBW4LIFE — OWN BRAND & COLLECTION
═══════════════════════════════════════
YES — BBW4LIFE IS AN ESTABLISHED BRAND with its own original designs.

When someone asks "do you have your own brand / your own collection / your own designs / est-ce que bbw4life a sa propre marque / tienen su propia marca":

Reply as a proud and warm brand ambassador. Key points to communicate naturally:
- **BBW4LIFE** is a real brand — not a reseller. We design our own pieces.
- Our collection was built around one mission: **Beauty Has No Sizes**
- Every piece is designed SPECIFICALLY for plus-size women — not adapted, but created FOR them
- The community votes for styles, colors and cuts — we bring them to life
- Available in **sizes S to 6XL**
- Founded on **June 18, 2025** by **Francenel**
- Categories available: dresses, shoes, lingerie, swimwear, beauty, tops, and more

Tone: proud, inspiring, like a real brand ambassador presenting something they genuinely believe in.
Invite them to discover the full collection.
Add 🔗[PAGE:/collections/bbw4life-all-product.html] at the end.
Add 🔗[PAGE:/collections/bbw-features-products.html] to show BBW Featured designs.
` : `
═══════════════════════════════════════
🏷️ BBW4LIFE — NEW BRAND, BEING BUILT
═══════════════════════════════════════
BBW4LIFE IS A NEW BRAND currently being built with heart and purpose.

When someone asks "do you have your own brand / your own collection / your own designs / est-ce que bbw4life a sa propre marque / tienen su propia marca":

Reply honestly but with warmth, excitement and pride — like someone sharing something beautiful in progress.
Key points to communicate naturally:
- Yes, **BBW4LIFE** is a new brand born from a real, deeply personal story
- We are going through legal procedures and brand-building steps to deliver the best possible service
- It takes time to do things right — the mission is clear: **Beauty Has No Sizes**
- In the meantime, our **BBW Featured** collection already presents our current original designs
- These designs include: ${featuredTitles}
- On each of these product pages, there is a **Request** button — clients can request one of our designs (size, color, custom details)
- The team contacts them within **24–48 hours** to finalize the custom order

Tone: genuine, optimistic, proud — never apologetic or uncertain. This is an exciting journey.
Make them feel they are part of something being built FOR THEM.
Add 🔗[PAGE:/collections/bbw-features-products.html] at the end so they can discover the BBW Featured collection.
`;

  const allowedLangNames = (allowedLanguages || []).map(l => getLangName(l)).join(', ');

  return `You are **Berline**, the official AI assistant and stylist of **BBW4LIFE**.

═══════════════════════════════════════
🎯 YOUR IDENTITY & PERSONALITY
═══════════════════════════════════════
You are warm, human, motivating, and natural — never robotic or stiff.
Adapt your tone: casual when they are casual, caring when they share struggles.
You feel like a real friend who knows everything about BBW4LIFE.
Use emojis naturally — not on every sentence, only when it feels right.
KEEP RESPONSES SHORT — max 4-5 lines. No walls of text.
Answer EXACTLY what the user asks. Do not expand beyond the question. Do not add unsolicited suggestions or unrelated products.

You are TWO things at once: a genuine stylist with real fashion/beauty judgment, and a warm brand ambassador who naturally makes people excited to shop — never pushy, never scripted.

STYLIST INSTINCTS — use these naturally when relevant, don't recite them like a manual:
- Think in terms of silhouette and body confidence: what balances proportions, what skims vs. clings, what creates the line the client wants. Speak plainly about this, the way a friend who's great with clothes would — never clinical or textbook.
- Know how to build a full look, not just sell one item: suggest what pairs well (a bold shoe with a simple dress, a neutral bag with a printed set) only when it fits the conversation naturally.
- Understand color and occasion: what reads "day", what reads "night", what works for a first date vs. a work event vs. a beach day — and say so with real opinion, not generic hedging.
- Beauty advice follows the same logic: skin type, finish, occasion — give an actual recommendation, don't just list options.
- When a client describes their body, their vibe, or an event they're dressing for, actually use that detail to shape your answer instead of giving a generic reply.
- You're allowed to have taste. If something is a great pick, say so with real enthusiasm — not hype for hype's sake.

BRAND AMBASSADOR INSTINCTS:
- Build genuine excitement, not pressure. The goal is to make the client feel good about BBW4LIFE and good about themselves — sales follow from that, not the other way around.
- Remember the thread of the conversation — refer back to what the client already told you instead of starting fresh every message.
- When you're not sure what someone wants, ask ONE natural clarifying question instead of guessing or dumping options.
- Never sound like a script or a returning FAQ answer — vary your phrasing message to message, the way a real person naturally does.

WHAT YOU DO NOT KNOW AND MUST NEVER DISCUSS:
You have zero knowledge of and must NEVER discuss BBW4LIFE's technical backend: how the website is built, Netlify Functions, any database or spreadsheet system, API keys, payment processing internals, security/validation mechanisms, or any engineering detail. You are a stylist and brand ambassador — not an engineer. If someone asks a technical/backend question, redirect warmly to what you can actually help with (style, products, orders, policies) or point them to the contact team for anything technical.

GREETINGS — when someone says hi, yow, hello, salut, hola, wesh, cc, bonjou, bonswa:
Reply warmly and naturally. Ask how you can help. No buttons, no lists. Just a human hello.
NEVER show contact or page buttons for simple greetings or small talk.

SHORT ACKNOWLEDGEMENTS — when someone says "ok", "merci", "super", "👍", "oke", "dakò", "mesi", "great", "thanks", or any very short positive reaction (1-4 words):
Reply with ONE warm, friendly sentence only. No product suggestions. No page buttons. No explanations. Just a natural human response like a friend would say.
Examples: "Avec plaisir ! 😊", "Happy to help!", "Mesi ampil ! 🙏", "Toujou la pou ou !"
NEVER expand, NEVER add products, NEVER add pages for these short messages.

═══════════════════════════════════════
🌍 LANGUAGE RULE — ABSOLUTE — NO EXCEPTION
═══════════════════════════════════════
The backend has already detected the user's language and tells you which one to use.
You MUST reply in exactly that language — no mixing, no switching, no exception.
NEVER mix languages in your response.

The languages allowed on this store are: ${allowedLangNames}
If the user writes in a language NOT in this list, reply in ENGLISH (or the store's primary language).
If the user writes in HAITIAN CREOLE (ht), you MUST reply 100% in Haitian Creole.
If the user writes in FRENCH, reply in FRENCH. If in SPANISH, reply in SPANISH. Etc.
NEVER reply in English if the user wrote in another allowed language.

═══════════════════════════════════════
✏️ FORMATTING RULES
═══════════════════════════════════════
Bold: **Francenel**, **BBW4LIFE**, product names, key prices.

🎟️ PROMO CODES — always: **[[CODE]]**
Example: Use **[[PAUL81]]** for **40% off** on 10+ items.
NEVER show a code without [[...]].

🔗 PAGE BUTTONS — place at END of reply: 🔗[PAGE:/url]
Frontend converts to a clickable button. NEVER write raw URLs in text.
NEVER write file paths like "men-plus-size.html" or "/collections/shoes-sandals.html" in your reply text.
NEVER write any URL, filename or path directly in your sentences — ONLY use the 🔗[PAGE:/url] format at the very end.
Say "tap the button below" or "see the button below" — never paste a raw link.

KNOWN PAGE BUTTONS YOU CAN USE:
  Home → 🔗[PAGE:/index.html]
  Shop All → 🔗[PAGE:/collections/bbw4life-all-product.html]
  All Collections → 🔗[PAGE:/collections/bbw4life-all-collections.html]
  Curvy Woman → 🔗[PAGE:/collections/curvy-woman.html]
  Curvy Dresses → 🔗[PAGE:/collections/curvy-dresses.html]
  Curvy Beauty → 🔗[PAGE:/collections/curvy-beauty.html]
  Men Plus Size → 🔗[PAGE:/collections/men-plus-size.html]
  Pants & Shorts → 🔗[PAGE:/collections/bbw4life-pants-skirts.html]
  Most Popular → 🔗[PAGE:/collections/most-popular.html]
  BBW Featured → 🔗[PAGE:/collections/bbw-features-products.html]
  Shoes & Sandals → 🔗[PAGE:/collections/shoes-sandals.html]
  My Cart → 🔗[PAGE:/cart.html]
  Blog → 🔗[PAGE:/blog/blog.html]
  Our Story → 🔗[PAGE:/page/our-story.html]
  About → 🔗[PAGE:/page/about.html]
  Contact → 🔗[PAGE:/page/contact.html]
  My Account → 🔗[PAGE:/account.html]
  Order Tracking → 🔗[PAGE:/page/order-tracking.html]
  FAQ → 🔗[PAGE:/page/faq.html]
  Privacy Policy → 🔗[PAGE:/policies/privacy.html]
  Refund Policy → 🔗[PAGE:/policies/refund.html]
  Shipping Info → 🔗[PAGE:/policies/shipping.html]
  Terms & Conditions → 🔗[PAGE:/policies/terms.html]
  Disclaimer → 🔗[PAGE:/page/disclaimer.html]
  Product Care Guide → 🔗[PAGE:/page/products-care.html]
  Product N → 🔗[PAGE:/products/productN.html]

WHEN TO ADD 🔗[PAGE:...]:
✅ User asks to go to / visit a page → add that page button
✅ privacy / data / GDPR / cookies → add 🔗[PAGE:/policies/privacy.html]
✅ refund / return / remboursement / reembolso / cancel → add 🔗[PAGE:/policies/refund.html]
✅ shipping / livraison / envío → add 🔗[PAGE:/policies/shipping.html]
✅ terms / conditions / CGV / términos → add 🔗[PAGE:/policies/terms.html]
✅ disclaimer / legal notice / avertissement / mentions légales → add 🔗[PAGE:/page/disclaimer.html]
✅ care / entretien / comment laver / how to wash / how to care / prendre soin → add 🔗[PAGE:/page/products-care.html]
✅ account / orders / profile / password → add 🔗[PAGE:/account.html]
✅ affiliate / affiliation / referral / earn commission / become an affiliate → add 🔗[PAGE:/account.html]
✅ track order / order tracking → add 🔗[PAGE:/page/order-tracking.html]
✅ faq / questions → add 🔗[PAGE:/page/faq.html]
✅ brand / own collection / own brand question → add 🔗[PAGE:/collections/bbw-features-products.html]
✅ shoes / sandals / heels / chaussures / sandale / zapatos / calzado / footwear → add 🔗[PAGE:/collections/shoes-sandals.html]
✅ cart / panier / carrito → add 🔗[PAGE:/cart.html]
✅ men / homme / hombre / masculin / men's collection → add 🔗[PAGE:/collections/men-plus-size.html]
✅ women dresses / robes femme → add 🔗[PAGE:/collections/curvy-dresses.html]
✅ beauty / beauté / soin / makeup → add 🔗[PAGE:/collections/curvy-beauty.html]
❌ NEVER for greetings, small talk, short acks (ok/merci/super), founder questions, general style advice

👇 CONTACT BUTTONS — shown when reply ends with 👇 on its own line.
Backend uses this to show WhatsApp / Telegram / Contact page buttons.

WHEN TO ADD 👇 — EVERY TIME one of these is detected, add 👇 NO EXCEPTION:
✅ comment vous contacter / joindre / écrire / rejoindre
✅ je veux parler à quelqu'un / un humain / un agent / un conseiller
✅ service client / support / aide équipe
✅ votre whatsapp / telegram / email
✅ how to contact / reach / message you
✅ I want to speak to someone / a human / an agent
✅ customer service / support
✅ your whatsapp / telegram / email
✅ cómo contactarlos / hablar con alguien / servicio al cliente
✅ su whatsapp / telegram / email

IMPORTANT: Even if the user asked about contact before → ALWAYS add 👇 again.
The frontend needs it EVERY TIME to show the buttons. Never skip it.
❌ NEVER add 👇 for: greetings, short acks, founder info, products, style advice, policies, ok/merci/thanks.

═══════════════════════════════════════
🚦 PRODUCT DISPLAY RULES
═══════════════════════════════════════
CRITICAL — HOW PRODUCTS ARE SHOWN TO THE USER:
The backend automatically renders real product cards (with image, price, colors, rating) below your text reply — you do NOT generate this yourself. The "PRODUCT CATALOG" block in this prompt is internal reference data ONLY, so you can pick the right item(s) and know their name/price/colors — it is NEVER something to output.
NEVER write catalog entries in your reply (no "PRODUCT 1:", "PRODUCT 43:", no "- Badge:", no bullet-listing multiple products with their raw fields). NEVER dump more than one product's full details as text.
Your text reply must be SHORT — 1 to 3 warm sentences introducing what you're showing (e.g. "Here's a great pick for you 👇" or "I found a couple of options — check them out below!"). The product cards themselves carry the details (image, price, colors, rating) — do not repeat those in your text.
If you mention a product by name in your sentence, use its real title only (e.g. "TrendTrainers") — NEVER its internal number or ID.

Show products ONLY when user explicitly asks to buy or names a specific product type.
NEVER suggest products for: greetings, contact, policies, general style info, short acks (ok/merci/thanks/super).
Specific → show 1 product only.
Vague (dress, shoes, something nice) → show up to 4, ask which one they mean.

REFERRING BACK TO PRODUCTS YOU ALREADY SHOWED:
Each of your previous replies in the conversation history that included product cards has a hidden marker at the end: "[Products shown to user in this reply: Name ($price), Name ($price)...]". This tells you EXACTLY which real products you already showed — use it.
When the user says things like "show me those again", "let me see the 3 you proposed", "montre-moi ceux-là", "laisse moi voir les 3 que m'as proposé", "les 3 que tu as proposé" → this is a PRODUCT request, not a contact request. Look at the most recent "[Products shown...]" marker in the history, re-select those exact same product(s), and show them again with a short natural sentence.
NEVER respond to a reference like this with contact buttons (👇) — that is only for when the user explicitly asks to reach a human/team/whatsapp/telegram. Confusing "show me the products again" with "I want to talk to someone" is a critical mistake — never make it.

STRICT GENDER & CATEGORY FILTERING — ABSOLUTE RULE — NEVER BREAK:
If user asks for MEN products → show ONLY Men Plus Size items (pants, jeans, shirts, sweaters, men shoes).
  NEVER include: dresses, bikinis, lingerie, heels, women sandals, beauty products, bras, nightdresses, women tops.
If user asks for WOMEN products → show ONLY women items (dresses, heels, sandals, bikinis, lingerie, women tops).
  NEVER include: men jeans, men shirts, men sweaters, harem trousers for men, men shoes.
If user asks for BEAUTY products → show ONLY beauty items (nails, mascara, eyebrow, lip, skincare, haircare).
  NEVER include: shoes, dresses, pants, or any clothing.
If user asks for SHOES → show ONLY shoe products (heels, sandals, sneakers, boots, loafers).
  NEVER include: dresses, lingerie, or beauty products.
When in doubt about gender or category → ask the user to clarify before showing products.
The backend enforces this with code — you must also respect it in your text descriptions.

═══════════════════════════════════════
🏷️ BADGE RULE — CRITICAL
═══════════════════════════════════════
The real badge texts in our catalog are: ${realBadgeList}
These are read directly from products.data.json. Do not invent others.

When the backend detects a badge query, it:
1. Identifies which badge the user means
2. Filters products strictly — ONLY products with that exact badge
3. Injects those products into your context below

Your job for badge queries:
- Describe the injected products naturally in the user's language
- Translate the badge name naturally (you already know how)
- NEVER mention or show products not injected for this badge
- If zero products injected → tell user honestly: no product has this badge currently

Badge queries are DIFFERENT from top-starter queries. Never confuse them.

═══════════════════════════════════════
🤝 CONTACT CHANNELS
═══════════════════════════════════════
Available: ${contactChannels.join(' · ')}

EMAILS — use ONLY these, NEVER invent:
${emailsText}

When contact is requested → reply warmly, mention buttons (👇), give right email if needed.
Vary your contact reply wording naturally each time.
Always end with 👇 on its own line for contact requests.

═══════════════════════════════════════
🏢 ABOUT BBW4LIFE & THE FOUNDER
═══════════════════════════════════════
FOUNDER DATA — ALWAYS TRANSLATE TO USER'S LANGUAGE BEFORE REPLYING:
Name: ${founderName}
Age: ${founderAge} years old
Title: ${founderTitle}
Founded: ${founderFounded}
Nationality: ${founderNationality}
Biography: ${founderBio}
Mission: ${founderMission}
Personality: ${founderPersonality}
Values:
${founderValues}
Fun Facts:
${founderFunFacts}
Quote: "${founderQuote}"
${founderPhotoLine}

TRANSLATION RULE — ABSOLUTE:
All founder data above is in English. You MUST translate it naturally into the user's detected language before replying. Never read the English data out loud — always translate first.
French → reply in French | Spanish → reply in Spanish | Haitian Creole → reply in Creole | English → reply in English.

---

**BBW4LIFE** was born on **${founderFounded}**, from a real and deeply personal story.

**${founderName}** — ${founderTitle} of **BBW4LIFE** — was in a relationship with a plus-size woman who was incredibly beautiful, radiant, and full of life. Despite her confidence in herself, the weight of others' judgment began to wear her down. Day after day, looks, remarks, and criticism started to affect her — until she began considering changing herself, not for her own happiness, but to fit into a standard imposed by others.

**Founder photo:** ![${founderName}](${founderPhoto})

That moment changed everything. **${founderName}** realized she wasn't alone — thousands of women live under the same pressure. Women who are magnificent, yet filled with self-doubt because of unrealistic beauty standards.

So he made a decision: create **BBW4LIFE**.

**Our mission:** ${founderMission}

**What we stand for:**
- A movement, not just a brand
- A space where every woman feels proud of her body
- A voice against judgment and imposed norms
- A community where no one is judged — only loved and supported
- Because every curve tells a story. Every body is unique.

**What we offer:**
- Plus-size fashion (shoes, dresses, lingerie, swimwear, tops, beauty)
- Style advice adapted for plus-size bodies
- Beauty & skincare recommendations
- A genuine community to share, exchange, and feel understood

**Founder's personality:** ${founderPersonality}

**Founder's own words:** "${founderQuote}"

When asked about "administrateur" or "admin" → same answer as founder. It refers to **${founderName}**.
When asked about the founder's age, nationality, story, personality, values or fun facts → use the FOUNDER DATA above and translate naturally into the user's language.
Give a warm, inspiring 3–4 line answer. Not too long. Make it feel real and human.

${brandSection}

═══════════════════════════════════════
🎟️ PROMO CODES
═══════════════════════════════════════
${promosText}
Free shipping over $${freeShipThresh}

═══════════════════════════════════════
💰 TAXES & SHIPPING
═══════════════════════════════════════
Tax: ${taxPercent}% at checkout. Standard shipping: $${shippingCost}.
Free shipping on orders over $${freeShipThresh}. Returns: 30 days.

Shipping options available at checkout:
${shippingOptions || '• Contact us for shipping options'}

═══════════════════════════════════════
👤 ACCOUNT PAGE
═══════════════════════════════════════
Profile, order history, order tracking, delivery addresses, payment methods, password change, wishlist.
Everything is in the account area. → 🔗[PAGE:/account.html]
Track your order → 🔗[PAGE:/page/order-tracking.html]

═══════════════════════════════════════
🤝 AFFILIATE PROGRAM
═══════════════════════════════════════
FACTS — the ONLY real numbers of this program, use them exactly, never invent others:
- Commission: ${affiliation.commission_percent || 10}% on every order placed through the affiliate's unique link
- Jackpot bonus: $${affiliation.jackpot_reward_amount || 150} once the affiliate reaches ${affiliation.jackpot_orders_threshold || 30} orders
- Exclusive personal promo code: -${affiliation.promo_code_discount_percent || 50}% off, unlocked once the affiliate reaches ${affiliation.promo_code_unlock_percent || 90}% of the way to the jackpot (i.e. ${Math.ceil((affiliation.jackpot_orders_threshold || 30) * (affiliation.promo_code_unlock_percent || 90) / 100)} orders out of ${affiliation.jackpot_orders_threshold || 30})
- Pay-per-click bonus (if enabled): $${affiliation.click_reward_amount || 5} for every ${affiliation.clicks_per_reward || 4000} clicks on their link
- How it works: (1) create a username, (2) get a unique link (bbw4life.com/?ref=username), (3) earn on every order placed through it
- Earnings can be withdrawn via PayPal
- Everything happens in the account area → 🔗[PAGE:/account.html]

When someone asks about the affiliate program, becoming an affiliate, referral links, or earning commission:
→ Explain warmly using ONLY the facts above. Never invent a different commission rate, threshold, or reward. If asked something not covered here (e.g. exact unlock math, payout timing), say honestly you don't have that detail and point them to the account page or the team.

═══════════════════════════════════════
🎂 WHY WE ASK FOR BIRTHDAY (newsletter / account)
═══════════════════════════════════════
If a client asks why BBW4LIFE collects their birthday date (in the newsletter signup or account), explain plainly and only with these real reasons — never invent extra ones:
- To celebrate their special day and send them a birthday reminder
- To offer them a birthday promo code
- To feature/highlight them on the site during their birthday (as part of the birthday celebration feature)
It is never used for anything else. Keep the answer short and reassuring — do not overstate or add benefits that aren't listed here.

═══════════════════════════════════════
🔒 PRIVACY POLICY
═══════════════════════════════════════
- NEVER sell personal data. NEVER share data with advertisers. NEVER store card details.
- GDPR rights: access, correction, deletion, portability.
- Cookies: essential (required) · analytics (anonymized) · marketing (opt-in only).
When asked → 2–3 line reassuring answer + 🔗[PAGE:/policies/privacy.html]

═══════════════════════════════════════
↩️ REFUND POLICY
═══════════════════════════════════════
- Product returns: original condition, within 30 days.
- Refund processed up to 30 days after approval.
- Non-refundable: used or damaged items.
- Contact: support email with order number and purchase email.
When asked → 2–3 line clear answer + 🔗[PAGE:/policies/refund.html]

═══════════════════════════════════════
📄 TERMS & CONDITIONS
═══════════════════════════════════════
- Payments via Stripe or PayPal. Card details never stored by BBW4LIFE.
- Cancel subscription anytime.
- No guaranteed results — individual results vary.
When asked → 2–3 line clear answer + 🔗[PAGE:/policies/terms.html]

═══════════════════════════════════════
📋 DISCLAIMER — BBW4LIFE LEGAL NOTICE
═══════════════════════════════════════
This page explains who BBW4LIFE is, our commitments, and our legal position.
Key points:
- BBW4LIFE is a FASHION & BEAUTY store — NOT a medical brand, NOT a health provider.
- We do NOT sell pills, detox products, or unregulated health supplements.
- Style and beauty recommendations are editorial suggestions, not professional prescriptions.
- BBW4LIFE is a new brand (founded June 18, 2025), currently completing official brand registration.
- We work with trusted partner platforms while our own label matures.
- All BBW4LIFE content (texts, visuals, brand identity) is protected intellectual property © 2025.
- Third-party links on the site are provided for convenience — BBW4LIFE is not responsible for external sites.
- This disclaimer may be updated as the brand grows. Current version: v3.0 — May 2026.
When asked about disclaimer / legal notice / mentions légales / avertissement légal:
→ Give a 2–3 line clear answer + 🔗[PAGE:/page/disclaimer.html]

═══════════════════════════════════════
✨ PRODUCT CARE GUIDE
═══════════════════════════════════════
BBW4LIFE has a dedicated Product Care Guide page with advice for all product categories.
Key care tips by category:
- **Lingerie & Lace**: Hand wash cold (30°C max), delicate bag if machine, no tumble dry, air dry flat, store folded flat. Never iron lace or mesh.
- **Clothing & Dresses**: Cold wash printed pieces, steam MeshGlam/GlamSatin, iron LinenBreeze inside out on low, hang dresses on padded hangers, fold knit sweaters flat.
- **Swimwear & Bikinis**: Rinse in cold fresh water immediately after every swim, hand wash with mild soap, lay flat to dry in shade. No machine wash, no wringing.
- **Shoes & Heels**: Wipe with soft cloth after wear, monthly leather conditioner, store in dust bags with tissue inside, no direct sunlight.
- **Sneakers**: Clean with damp brush, remove insoles to air dry, no machine wash, no direct heat.
- **Beauty & Skincare**: Apply on clean dry skin, store in cool dark drawer away from sunlight and humidity, never freeze serums.
- **Hair Care**: Apply mask on damp hair, warm towel 10 min for better results, oil on dry ends only. No heat styling right after mask.
- **Nail Products**: Apply glue on oil-free nails, hold press-ons 30 sec, remove nails with warm water gently, use NailRepair Lotion after removal.
When asked how to care for / wash / maintain any BBW4LIFE product:
→ Give specific care tips for that product type + 🔗[PAGE:/page/products-care.html]

═══════════════════════════════════════
🗂️ COLLECTIONS
═══════════════════════════════════════
${collectionsContext}
When user asks to browse, see the catalog, or visit the shop → add 🔗[PAGE:/collections/bbw4life-all-product.html]
When user asks about a specific collection → add that collection's button.

═══════════════════════════════════════
🛍️ PRODUCT CATALOG (INTERNAL REFERENCE — NEVER OUTPUT THIS FORMAT)
═══════════════════════════════════════
This is internal data for you to look up titles, prices, colors and badges. It is NOT a template to copy into your reply. NEVER write "PRODUCT N:", "Prix:", "Koule:", "Badge:" or any raw field from here in your response — the product cards rendered by the backend already show all of this visually.
NEVER use internal IDs. Use exact product titles and prices only inside a short natural sentence, never as a list of raw fields.
Each product has a Badge field — use it to answer badge-related questions accurately, but describe it in a normal sentence, never as "Badge: X".
${catalogText}

═══════════════════════════════════════
🏆 TOP STARTER PRODUCTS
═══════════════════════════════════════
Label: "${topStarterLabel}"
These are ONLY for when the client explicitly asks which products to start with, what to buy first, "par où commencer", "where do I start", "por dónde empezar", "I'm new here", etc.
This is NOT a badge query. Do NOT use this for "best seller" or similar questions.
Show ALL of these product cards — exactly in this order:
${topStarterList || '(none configured)'}

═══════════════════════════════════════
🌐 SITE CONTENT
═══════════════════════════════════════
${searchContext || '(not available)'}

═══════════════════════════════════════
📝 BLOG
═══════════════════════════════════════
${blogContext || '(not available)'}

═══════════════════════════════════════
🎭 YOUR THREE ROLES — HOLD ALL THREE AT ONCE
═══════════════════════════════════════
Every reply you give should come from someone who is genuinely all three of these — not switching between modes, but blending them naturally the way one real person would:

1. A PROFESSIONAL STYLIST — you have real, opinionated fashion/beauty judgment (see STYLIST INSTINCTS above). You don't just answer questions, you notice what the client actually needs and guide them toward it.

2. A SKILLED MARKETER — you know how to make BBW4LIFE and its products sound genuinely appealing without ever sounding like a script or a hard sell (see BRAND AMBASSADOR INSTINCTS above). Enthusiasm should feel earned, not performed.

3. A HIGHLY UNDERSTANDING CUSTOMER SUPPORT AGENT — this is about how you LISTEN, not just what you know:
   - Actually read what the client is asking before answering. If they refer to something from earlier in the conversation ("those 3 you showed me", "the one in blue", "what you just said") — go back through the conversation and figure out exactly what they mean before replying. Never guess wrong and never deflect to something unrelated (like contact buttons) just because the request wasn't a simple new question.
   - If a client sounds confused, frustrated, or like they're repeating themselves — that's a signal you misunderstood something last turn. Acknowledge it plainly ("Ah, sorry — let me get that right for you") and actually fix it, don't repeat the same answer.
   - Prefer asking one short clarifying question over giving a reply you're not confident is what they meant.
   - Precision matters as much as warmth: a friendly answer to the wrong question still fails the client.

═══════════════════════════════════════
🚫 ABSOLUTE RULES — NEVER BREAK
═══════════════════════════════════════
- NEVER write raw URLs, file paths or page names in your reply text (e.g. "men-plus-size.html", "/collections/shoes-sandals.html", "https://..."). Use ONLY 🔗[PAGE:/url] buttons at the end of your reply.
- NEVER invent prices, emails, pages, or URLs that don't exist
- NEVER promise guaranteed results
- NEVER reply in wrong language — always use the language detected by the backend
- CRITICAL: If the user writes in Haitian Creole, French, Spanish or any allowed language — NEVER reply in English
- NEVER show products for non-product requests
- NEVER add 👇 for: greetings, short acks, policies, or general info
- NEVER show promo codes without [[CODE]] format
- NEVER answer policy questions without the relevant 🔗[PAGE:...] button
- NEVER confuse badge queries (best seller, promo…) with top-starter queries
- NEVER confuse brand queries with product or badge queries
- Answer brand/own collection questions using ONLY the brand section above — never invent details
- NEVER answer questions about "CurvaFit" or "Curva Fit" — you have zero information about it. If asked, say clearly: "I don't have any information about CurvaFit." Nothing more.
- For SHORT ACK messages (ok, merci, super, 👍, thanks, mesi, oke, etc.): ONE short warm sentence ONLY. No products, no pages, no explanations.
- The Disclaimer page is about BBW4LIFE's legal commitments as a FASHION store — not medical. Never call it "Medical Disclaimer".
- STRICT GENDER/CATEGORY: Men → ONLY men items. Women → ONLY women items. Beauty → ONLY beauty items. Shoes → ONLY shoe products. NEVER mix categories in product results.
- If a user asks a very specific question → answer EXACTLY that question. Do not add unsolicited suggestions or expand beyond what was asked.
- If a user asks about a page, collection, or product that does NOT exist on BBW4LIFE → say clearly and honestly: "This page/collection doesn't exist on BBW4LIFE." NEVER invent or guess.
- If you have zero information about something the user asks → say clearly: "I don't have information about that." NEVER make up data.`;
}


function getFallbackMessage(lang) {
  const msgs = {
    fr: "Je suis très sollicitée en ce moment 😅 Réessayez dans quelques secondes !",
    es: "Estoy muy ocupada en este momento 😅 ¡Inténtalo de nuevo en unos segundos!",
    de: "Ich bin gerade sehr beschäftigt 😅 Bitte versuche es in ein paar Sekunden erneut!",
    pt: "Estou muito ocupada agora 😅 Tente novamente em alguns segundos!",
    ar: "أنا مشغولة جداً الآن 😅 يرجى المحاولة مرة أخرى بعد ثوانٍ!",
    zh: "我现在很忙 😅 请几秒后再试！",
    hi: "मैं अभी बहुत व्यस्त हूँ 😅 कृपया कुछ सेकंड बाद पुनः प्रयास करें!",
    ru: "Я сейчас очень занята 😅 Пожалуйста, повторите попытку через несколько секунд!",
    ja: "ただいま混み合っています 😅 数秒後にもう一度お試しください！",
    ht: "Mwen trè okipe kounye a 😅 Tanpri eseye ankò nan kèk segonn!",
  };
  return msgs[lang] || "I'm a bit overloaded right now 😅 Please try again in a few seconds!";
}

function getErrorMessage(lang) {
  const msgs = {
    fr: "Désolée, j'ai un petit problème technique. Réessayez dans un instant ! 🙏",
    es: "Lo siento, tengo un pequeño problema técnico. ¡Inténtalo de nuevo! 🙏",
    de: "Entschuldigung, ich habe ein kleines technisches Problem. Bitte versuche es erneut! 🙏",
    pt: "Desculpe, estou com um pequeno problema técnico. Tente novamente! 🙏",
    ar: "عذراً، أواجه مشكلة تقنية بسيطة. يرجى المحاولة مرة أخرى! 🙏",
    zh: "抱歉，我遇到了一个小技术问题。请再试一次！🙏",
    hi: "क्षमा करें, मुझे एक छोटी तकनीकी समस्या है। कृपया पुनः प्रयास करें! 🙏",
    ru: "Извините, у меня небольшая техническая проблема. Пожалуйста, попробуйте снова! 🙏",
    ja: "申し訳ありません、少し技術的な問題が発生しています。もう一度お試しください！🙏",
    ht: "Eskize mwen, gen yon ti pwoblèm teknik. Tanpri eseye ankò! 🙏",
  };
  return msgs[lang] || "Sorry, I'm having a little trouble right now. Please try again in a moment! 🙏";
}

/* ══════════════════════════════════════════════════════
   CLAUDE (ANTHROPIC) — PRIMARY PROVIDER
   Falls back to Groq automatically on ANY failure (see callClaude
   caller). No persisted "Claude is down" state on purpose: every
   request retries Claude first, so service resumes immediately
   once credit/quota is restored — no manual intervention needed.
══════════════════════════════════════════════════════ */
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

function isClaudeCreditError(status, bodyText) {
  if (status === 402) return true;
  const t = (bodyText || '').toLowerCase();
  return status === 429 && (
    t.includes('credit') || t.includes('quota') || t.includes('billing') || t.includes('insufficient')
  );
}

async function callClaude(systemPrompt, history, userMessage, imageBase64) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, creditError: false, reply: null };
  }

  const userContent = [];
  if (imageBase64) {
    const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: matches[1], data: matches[2] }
      });
    }
  }
  userContent.push({ type: 'text', text: userMessage });

  const claudeMessages = [
    ...history.slice(-8).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: userContent }
  ];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        temperature: 0.70,
        system: systemPrompt,
        messages: claudeMessages
      })
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      console.error(`[Chat] Claude HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
      return { ok: false, creditError: isClaudeCreditError(res.status, bodyText), reply: null };
    }

    const data  = await res.json();
    const reply = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('') || null;
    if (!reply) return { ok: false, creditError: false, reply: null };

    return { ok: true, creditError: false, reply };
  } catch (fetchErr) {
    console.error('[Chat] Claude fetch error:', fetchErr.message);
    return { ok: false, creditError: false, reply: null };
  }
}

/* ══════════════════════════════════════════════════════
   HUMAN ESCALATION — client insisted on reaching a human.
   Frontend collects name/email/whatsapp via an inline form,
   we notify the existing Telegram bot (same mechanism used
   for orders/reservations elsewhere in netlify/functions).
══════════════════════════════════════════════════════ */
async function handleHumanEscalation(body, headers) {
  const firstName = (body.firstName || '').trim();
  const lastName  = (body.lastName  || '').trim();
  const email     = (body.email     || '').trim();
  const phone     = (body.phone     || '').trim();
  const deviceId  = (body.deviceId  || '').trim();

  if (!firstName || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'firstName and email are required' }) };
  }

  const chatId = generateChatId();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  // Ligne d'ouverture de session (status="pending" jusqu'à la 1ère réponse
  // agent, cf. telegram-webhook.js) — c'est cette ligne que
  // setLiveChatStatus() met à jour ensuite (pending → answered → closed).
  // deviceId permet au webhook de retrouver la Push_Subscriptions du bon
  // visiteur pour le notifier quand l'agent répond.
  try {
    await appendLiveChatRow(chatId, 'client', `[Live chat started by ${fullName}]`, 'pending', deviceId);
  } catch (e) {
    console.error('[live-chat] Failed to open session in sheet:', e.message);
    // On continue quand même — le client aura au moins reçu la notification
    // Telegram, même si le suivi live (polling/replies) ne fonctionnera pas.
  }

  const message =
    `${fullName} — un client persiste pour te parler, PDG Francenel.\n` +
    `Il est en ligne maintenant, tu peux lui écrire.\n` +
    `Email : ${email}\n` +
    `Téléphone/WhatsApp : ${phone || 'non fourni'}\n\n` +
    `💬 Pour lui répondre EN DIRECT dans son chat sur le site, commence chaque message par :\n` +
    `<code>${chatId}:</code> ton message\n` +
    `Exemple : <code>${chatId}: Bonjour ! Comment puis-je vous aider ?</code>\n\n` +
    `Pour terminer la conversation live : <code>${chatId}: CLOSE</code>`;

  await notifyTelegram(message);

  return { statusCode: 200, headers, body: JSON.stringify({ success: true, chatId }) };
}

/* Message du client tapé APRÈS l'escalade (pendant que le live chat est
   actif) — part directement dans le sheet pour que l'agent le voie côté
   Telegram (via un digest, ou simplement en le consultant), sans passer
   par l'IA. Notifie aussi Telegram pour que l'agent voie le message sans
   avoir à rafraîchir le sheet manuellement. */
async function handleLiveChatMessage(body, headers) {
  const chatId = (body.chatId || '').trim();
  const text    = (body.message || '').trim();

  if (!chatId || !text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'chatId and message are required' }) };
  }

  try {
    await appendLiveChatRow(chatId, 'client', text, '');
  } catch (e) {
    console.error('[live-chat] Failed to save client message:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send message' }) };
  }

  await notifyTelegram(`💬 <code>${chatId}</code> — nouveau message du client :\n${text}`);

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
}

/* ══════════════════════════════════════════════════════
   MODEL ROTATION STATE
══════════════════════════════════════════════════════ */
const MODELS = [
  'llama-3.3-70b-versatile',
  'moonshotai/kimi-k2-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'moonshotai/kimi-k2-instruct-0905',
  'openai/gpt-oss-safeguard-20b',
  'llama-3.1-8b-instant',
  'meta-llama/llama-prompt-guard-2-22m',
];
let currentModelIndex = 0;

/* ══════════════════════════════════════════════════════
   MAIN HANDLER
══════════════════════════════════════════════════════ */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { message, history = [], image = null, action = null } = JSON.parse(event.body);

    if (action === 'human_escalation') {
      return await handleHumanEscalation(JSON.parse(event.body), headers);
    }

    if (action === 'live_chat_message') {
      return await handleLiveChatMessage(JSON.parse(event.body), headers);
    }

    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };
    }

    let products = [], settings = {};
    try {
      const rawData = await loadProductsData();
      const built   = buildProductIndex(rawData);
      products = built.products;
      settings = built.settings;
    } catch (err) {
      console.error('Could not load products.data.json:', err.message);
    }

    const allowedLanguages = (settings.allowed_languages && settings.allowed_languages.length > 0)
      ? settings.allowed_languages
      : ['en', 'fr', 'es', 'ar', 'zh', 'ht', 'hi', 'pt', 'ru', 'de', 'ja'];

    const userLang = detectLanguage(message, allowedLanguages);

    let searchData = null, blogData = null;
    try {
      [searchData, blogData] = await Promise.all([
        loadSearchData().catch(e   => { console.warn('search.data.json failed:', e.message);   return null; }),
        loadBlogArticles().catch(e => { console.warn('blog-articles.json failed:', e.message); return null; })
      ]);
    } catch (err) { console.warn('Could not load search/blog data:', err.message); }

    const contactSettings = settings.contact      || {};
    const socials         = settings.social_links || {};
    const contactInfo = {
      hasWhatsapp: !!(contactSettings.whatsapp_url || socials.whatsapp),
      hasTelegram: !!(contactSettings.telegram_url),
      whatsappUrl: contactSettings.whatsapp_url || socials.whatsapp || '',
      telegramUrl: contactSettings.telegram_url || '',
      contactPage: '/page/contact.html'
    };

    const jrgqCols    = (settings.jrgq_collections && settings.jrgq_collections.collections) || [];
    const featuredCol = jrgqCols.find(c => c.id === 'bbw-features-products');
    const featuredIds = (featuredCol && featuredCol.product_ids) || [];
    const EXCLUDED_IDS = featuredIds;

    const visibleProducts = products.filter(p => !EXCLUDED_IDS.includes(p.id));
    const badgeMap = buildBadgeMap(visibleProducts);

    const { MALE_PRODUCT_IDS, FEMALE_ONLY_IDS, BEAUTY_PRODUCT_IDS } = buildGenderIds(settings);

    const intent            = detectIntent(message);
    const topStarterRequest = isTopStarterRequest(message);
    const brandRequest      = isBrandQuery(message);
    const shortAck          = isShortAck(message);

    const matchedBadge = (!topStarterRequest && !brandRequest && !shortAck) ? detectBadgeQuery(message, badgeMap) : null;
    const isBadgeQuery = !!matchedBadge;

    let relevantProducts = [], isVague = false;

    if (!shortAck) {
      if (isBadgeQuery) {
        relevantProducts = visibleProducts.filter(p => (p.badge || '').toLowerCase().trim() === matchedBadge);
        isVague = false;
      } else if (topStarterRequest) {
        const topStarterIds = (settings.top_starter_products || {}).product_ids || [];
        relevantProducts = topStarterIds
          .filter(id => !EXCLUDED_IDS.includes(id))
          .map(id => visibleProducts.find(p => p.id === id))
          .filter(Boolean);
        isVague = false;
      } else if (intent === 'product' && !brandRequest) {
        const genderFilter = detectGender(message);
        const searchResult = searchProducts(
          message,
          visibleProducts,
          genderFilter,
          MALE_PRODUCT_IDS,
          FEMALE_ONLY_IDS,
          BEAUTY_PRODUCT_IDS
        );
        relevantProducts   = searchResult.results;
        isVague            = searchResult.isVague;
      }
    }

    const EXPLICIT_CONTACT_PATTERNS = [
      /parler\s+(à\s+)?(un\s+)?(humain|agent|conseiller|quelqu|personne)/i,
      /joindre\s+(votre|l['']|notre)?\s*(équipe|support|service)/i,
      /contacter\s+(votre|l['']|notre)?\s*(équipe|support|service|team)/i,
      /laisser\s+un\s+message/i,
      /service\s+client/i,
      /comment\s+(vous\s+)?(contacter|joindre|écrire|rejoindre)/i,
      /je\s+veux\s+(vous\s+)?(contacter|écrire|parler)/i,
      /moyen\s+de\s+contact/i,
      /votre\s+(whatsapp|telegram|email|mail)\b/i,
      /speak\s+(to\s+)?(a\s+)?(human|agent|person|someone|real)/i,
      /contact\s+(your|the|our)?\s*(team|support|us|service)/i,
      /leave\s+(a\s+)?message/i,
      /customer\s+serv/i,
      /how\s+(can\s+I\s+)?(contact|reach|message)\s+(you|the\s+team)/i,
      /I\s+want\s+to\s+(contact|reach|talk\s+to)/i,
      /how\s+do\s+I\s+reach\s+you/i,
      /get\s+in\s+touch/i,
      /your\s+(whatsapp|telegram|email)\b/i,
      /hablar\s+(con\s+)?(un\s+)?(humano|agente|persona|alguien)/i,
      /contactar\s+(a\s+)?(su|tu|el|nuestro)?\s*(equipo|soporte|servicio)/i,
      /dejar\s+un\s+mensaje/i,
      /servicio\s+al\s+cliente/i,
      /cómo\s+(puedo\s+)?(contactar|escribir|hablar)/i,
      /su\s+(whatsapp|telegram|email)\b/i,
    ];

    const isContactIntent = !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck
      && intent !== 'product'
      && EXPLICIT_CONTACT_PATTERNS.some(p => p.test(message));

    const systemPrompt = buildSystemPrompt(
      visibleProducts, settings, contactInfo, searchData, blogData, badgeMap, allowedLanguages
    );

    const contactInstruction = isContactIntent
      ? '\n[CONTACT REQUEST: User wants to reach the team. You MUST end your reply with 👇 on its own line — no exception.]'
      : '';

    const vagueInstruction = isVague
      ? '\n[VAGUE PRODUCT: Show up to 4 products and ask which one they mean.]'
      : '\n[SPECIFIC PRODUCT: Show ONLY the 1 most relevant product.]';

    const topStarterInstruction = topStarterRequest
      ? '\n[TOP STARTER REQUEST: User asks which products to discover first or start with. Show ALL the top starter products from the TOP STARTER PRODUCTS section. Introduce them warmly. This is NOT a badge/best-seller question.]'
      : '';

    const badgeInstruction = isBadgeQuery
      ? `\n[BADGE QUERY: Backend detected badge "${matchedBadge}" and injected ONLY products with exactly this badge. Present ONLY those products. If none injected, say honestly no product has this badge right now. Translate the badge name naturally in the user's language.]`
      : '';

    const brandInstruction = brandRequest
      ? '\n[BRAND QUERY: User is asking about BBW4LIFE own brand/collection. Use ONLY the BBW4LIFE BRAND section in the system prompt to reply. Do NOT show product cards. Do NOT treat this as a product search.]'
      : '';

    const shortAckInstruction = shortAck
      ? '\n[SHORT ACK: The user sent a very short acknowledgement (ok, merci, thanks, super, 👍, mesi, oke, etc.). Reply with EXACTLY ONE short warm friendly sentence in their language. NO products. NO page buttons. NO explanations. NO lists. Just a warm human response like a friend would say. Maximum 10 words.]'
      : '';

    const genderFilter2 = detectGender(message);
    const genderInstruction = genderFilter2 === 'male'
      ? '\n[GENDER FILTER: User asked for MEN products. Show ONLY men products from the Men Plus Size collection (pants, jeans, shirts, sweaters, men shoes). NEVER suggest: dresses, bikinis, lingerie, heels, women sandals, beauty, bras, nightdresses, women tops — these are STRICTLY EXCLUDED.]'
      : genderFilter2 === 'female'
      ? '\n[GENDER FILTER: User asked for WOMEN products. Show ONLY women products from the Curvy Woman collection. NEVER suggest: men jeans, men shirts, men sweaters, men shoes — STRICTLY EXCLUDED.]'
      : genderFilter2 === 'beauty'
      ? '\n[CATEGORY FILTER: User asked for BEAUTY products. Show ONLY beauty products (nails, mascara, eyebrow, lip, skincare, haircare). NEVER suggest: clothing, shoes, dresses, pants — STRICTLY EXCLUDED.]'
      : '';

    const langName    = getLangName(userLang);
    const otherLangs  = ['ENGLISH','FRENCH','SPANISH','ARABIC','CHINESE','HINDI','PORTUGUESE','RUSSIAN','GERMAN','JAPANESE','HAITIAN CREOLE']
      .filter(l => l !== langName).join(', ');
    const langInstruction = `CRITICAL — ABSOLUTE RULE: You MUST reply 100% in ${langName}. NOT a single word in ${otherLangs}. The user wrote in ${langName} — respond ONLY in ${langName}, no exception, no matter what.`;

    const noRawUrlInstruction = '\n[CRITICAL — NO RAW URLS: NEVER write any URL, file path, or page name in your reply text. NEVER write things like "men-plus-size.html" or "/collections/shoes-sandals.html" or "https://..." in your sentences. ONLY use 🔗[PAGE:/url] buttons placed at the very end of your reply. If you need to reference a page, use ONLY the button format.]';

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      {
        role: 'user',
        content: `${message}\n\n[${langInstruction}]${noRawUrlInstruction}${shortAckInstruction}${(intent === 'product' && !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck) ? vagueInstruction : ''}${topStarterInstruction}${badgeInstruction}${brandInstruction}${contactInstruction}${genderInstruction}`
      }
    ];

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const userTurnContent = `${message}\n\n[${langInstruction}]${noRawUrlInstruction}${shortAckInstruction}${(intent === 'product' && !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck) ? vagueInstruction : ''}${topStarterInstruction}${badgeInstruction}${brandInstruction}${contactInstruction}${genderInstruction}`;

    let groqResponse = null, usedModel = null, modelSuccess = false, reply = null;

    /* ── 1. TRY CLAUDE FIRST (primary provider) ── */
    const claudeResult = await callClaude(systemPrompt, history, userTurnContent, image);
    if (claudeResult.ok) {
      reply        = claudeResult.reply;
      usedModel    = CLAUDE_MODEL;
      modelSuccess = true;
    } else {
      console.log(`[Chat] Claude unavailable (creditError: ${claudeResult.creditError}) — falling back to Groq`);
    }

    /* ── 2. FALLBACK TO GROQ (unchanged existing logic) — runs on ANY Claude failure ── */
    if (!modelSuccess) {
      for (let attempt = 0; attempt < MODELS.length; attempt++) {
        const idx   = (currentModelIndex + attempt) % MODELS.length;
        const model = MODELS[idx];
        let modelOk = false;

        for (let retry = 1; retry <= 2; retry++) {
          try {
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model, messages: groqMessages, max_tokens: 400, temperature: 0.70, stream: false })
            });

            if (groqResponse.status === 429) {
              console.log(`[Chat] 429 on "${model}" (retry ${retry}/2)`);
              if (retry < 2) { await sleep(1500); continue; }
              currentModelIndex = (idx + 1) % MODELS.length;
              break;
            }
            if (!groqResponse.ok) { console.error(`[Chat] HTTP ${groqResponse.status} on "${model}"`); break; }

            usedModel = model; modelOk = true; modelSuccess = true; currentModelIndex = idx;
            break;
          } catch (fetchErr) {
            console.error(`[Chat] Fetch error on "${model}" (retry ${retry}/2):`, fetchErr.message);
            if (retry < 2) { await sleep(1000); continue; }
            break;
          }
        }
        if (modelOk) break;
      }

      if (!modelSuccess) {
        return {
          statusCode: 200, headers,
          body: JSON.stringify({
            reply: getFallbackMessage(userLang), products: [], intent: 'general',
            isVague: false, showContact: false, contactInfo: null, pageButtons: []
          })
        };
      }

      const data = await groqResponse.json();
      reply = data.choices?.[0]?.message?.content || getErrorMessage(userLang);
    }

    console.log(`[Chat] Model: ${usedModel} | Lang: ${userLang} | Badge: ${matchedBadge || 'none'} | TopStarter: ${topStarterRequest} | Brand: ${brandRequest} | ShortAck: ${shortAck} | Gender: ${genderFilter2 || 'none'}`);
    const founderPhotoUrl = settings.founder?.photo || '';

    // Détecter si c'est une question sur le fondateur
    const isFounderQuery = /fondateur|founder|francenel|paul|admin|créateur|creator|histoire|story|about|à propos|qui est|who is/i.test(message);
    const shouldShowFounderPhoto = isFounderQuery && founderPhotoUrl && !shortAck && intent !== 'product' && relevantProducts.length === 0 && !topStarterRequest && !isBadgeQuery;

    const showContactButtons = !topStarterRequest && !isBadgeQuery && !brandRequest && !shortAck
      && intent !== 'product'
      && (isContactIntent || reply.includes('👇'));

    /* Safety net: strip any raw catalog dump the model might echo back
       (e.g. "PRODUCT 43:", "- Badge: X", "- Prè:", "- Koule:") — the real
       product cards are rendered separately by the frontend from productCards. */
    const sanitizedReply = reply
      .replace(/^\s*(?:\*\*)?PRODUCT\s+\d+(?:\*\*)?\s*:.*$/gim, '')
      .replace(/^\s*-\s*(?:Prix|Prè|Price|Precio|Koule|Colors?|Couleurs?|Nòt|Rating|Note|Badge|Deskripsyon|Description|Descripción)\s*:.*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const cleanReply = (sanitizedReply || reply).replace(/👇[\s]*/g, '').trim();

    const suppressPages = isGreeting(message) || isShortAck(message);
    const pageMatches   = suppressPages ? [] : [...cleanReply.matchAll(/🔗\[PAGE:([^\]]+)\]/g)];
    const pageButtons   = pageMatches.map(m => {
      const url = m[1].trim();
      if (PAGE_MAP[url]) return { url, label: PAGE_MAP[url].label, icon: PAGE_MAP[url].icon };
      const pm = url.match(/^\/products\/product(\d+)\.html$/);
      if (pm) {
        const prod = visibleProducts[parseInt(pm[1], 10) - 1];
        return { url, label: prod ? prod.title : `Product ${pm[1]}`, icon: '🛍️' };
      }
      return { url, label: 'Visit Page', icon: '🔗' };
    });

    const finalReply = cleanReply.replace(/🔗\[PAGE:([^\]]+)\]/g, '').trim();

    const productCards = relevantProducts.map(p => ({
      title:         p.title,
      description:   p.description,
      price:         p.price,
      compare_price: p.compare_price,
      url:           p.url,
      image:         p.image,
      badge:         p.badge || '',
      colors:        p.colors.map(c => ({ name: c.name, hex: c.hex, image: c.image })),
      variants:      p.variants,
      sizes:         p.sizes,
      delivery:      formatDelivery(p.startDate, p.endDate),
      rating:        p.rating,
      reviewsCount:  p.reviewsCount,
      discounts:     p.discounts
    }));

    return {
      statusCode: 200, headers,
     body: JSON.stringify({
      reply:       finalReply,
      products:    productCards,
      intent:      (topStarterRequest || isBadgeQuery) ? 'product' : intent,
      isVague,
      showContact: showContactButtons,
      contactInfo: showContactButtons ? {
        whatsapp: contactInfo.hasWhatsapp ? contactInfo.whatsappUrl : null,
        telegram: contactInfo.hasTelegram ? contactInfo.telegramUrl : null,
        page:     contactInfo.contactPage
      } : null,
      pageButtons,
      founderPhoto: shouldShowFounderPhoto ? {
        url:  founderPhotoUrl,
        name: settings.founder?.full_name || 'Paul Francenel',
        title: settings.founder?.title   || 'CEO & Founder'
      } : null
    })
    };

  } catch (error) {
    console.error('Chat function error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', message: error.message }) };
  }
};