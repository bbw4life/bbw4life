(function () {
  'use strict';

  /* ================================================================
     UTILITY — Image URL upgrade
  ================================================================ */
  function upgradeShopifyImageUrl(url, size) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('cdn.shopify.com')) return url;
    if (url.startsWith('data:')) return url;
    url = url.replace(/[?&]width=\d+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
    url = url.replace(/[?&]quality=\d+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
    url = url.replace(
      /_(pico|icon|thumb|small|compact|medium|large|grande|original|master|1024x1024|2048x2048|\d+x\d+|\d+x|x\d+)(\.(?:jpg|jpeg|png|webp|gif|avif))(\?|$)/gi,
      '$2$3'
    );
    const w = size || 800;
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + 'width=' + w + '&quality=90'; 
  }

  /* ================================================================
     COLOR HELPERS
  ================================================================ */
  const COLOR_HEX = {
    black:'#1a1a1a', white:'#f8f8f8', pink:'#FF69B4', red:'#E53935',
    blue:'#1565C0', green:'#2E7D32', yellow:'#FDD835', purple:'#7B1FA2',
    orange:'#EF6C00', gray:'#9E9E9E', grey:'#9E9E9E', fuchsia:'#E040FB',
    navy:'#0D1B2A', nude:'#F4C7AB', rose:'#FF9999', brown:'#795548',
    khaki:'#BDB76B', gold:'#FFD700', silver:'#C0C0C0', beige:'#F5F5DC',
    coral:'#FF7043', lavender:'#E6E6FA', teal:'#00897B', cyan:'#00BCD4',
    lime:'#CDDC39', mint:'#98FB98', peach:'#FFCBA4', cream:'#FFFDD0',
    ivory:'#FFFFF0', maroon:'#800000', olive:'#808000', indigo:'#3F51B5',
    violet:'#8B00FF', turquoise:'#40E0D0', magenta:'#FF00FF',
    chocolate:'#7B3F00', coyote:'#81613C', army:'#4B5320',
    brick:'#8B0000', wine:'#722F37', dark:'#2F2F2F', deep:'#1C2526',
    royal:'#4169E1', lightblue:'#ADD8E6', lightgreen:'#90EE90',
    lightgray:'#D3D3D3', lightgrey:'#D3D3D3', hotpink:'#FF69B4',
    deeppink:'#FF1493', skyblue:'#87CEEB', other:'#CCCCCC',
    chestnut:'#954535', whitegray:'#BEBEBE', darkred:'#8B0000',
    navyblue:'#000080', darkblue:'#00008B', darkgreen:'#006400',
    armygreen:'#4B5320', winered:'#722F37', lightgray2:'#D3D3D3',
    hemprotered:'#C4706A', rosegold:'#b76e79'
  };

  function getHex(colorName) {
    if (!colorName) return '#CCCCCC';
    const lower = colorName.toLowerCase().trim();
    if (COLOR_HEX[lower]) return COLOR_HEX[lower];
    const joined = lower.replace(/\s+/g, '');
    if (COLOR_HEX[joined]) return COLOR_HEX[joined];
    const words = lower.split(/[\s_-]+/);
    for (let i = words.length - 1; i >= 0; i--) {
      if (COLOR_HEX[words[i]]) return COLOR_HEX[words[i]];
    }
    return '#CCCCCC';
  }

  function isLightColor(hex) {
    if (!hex || hex.length < 6) return false;
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0,2), 16);
    const g = parseInt(h.substring(2,4), 16);
    const b = parseInt(h.substring(4,6), 16);
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.75;
  }

  /* ================================================================
     DETECT COLLECTION ID FROM PAGE
  ================================================================ */
  function detectCollectionId() {
    // 1. data-attribute on element
    const pageEl = document.getElementById('collection-page');
    if (pageEl && pageEl.dataset.collectionId) {
      return pageEl.dataset.collectionId.trim();
    }

    // 2. URL param
    const urlParam = new URLSearchParams(window.location.search).get('collection');
    if (urlParam) return urlParam.trim();

    // 3. filename
    const filename = window.location.pathname.split('/').pop().replace('.html', '');
    if (filename && filename !== 'index' && filename !== '') return filename;

    return null;
  }

  /* ================================================================
     RESOLVE COLLECTION SETTINGS
  ================================================================ */
  function resolveCollectionSettings(settings, collectionId) {
    if (!collectionId) return null;

    // 1. Direct key match (ex: "curvy-dresses", "bbw-features-products")
    if (settings[collectionId] && typeof settings[collectionId] === 'object' && !Array.isArray(settings[collectionId])) {
      const col = settings[collectionId];
      // Must have product_ids to be a valid collection settings block
      if (col.product_ids && Array.isArray(col.product_ids)) {
        return col;
      }
    }

    // 2. jrgq_collections
    const jrgq = settings.jrgq_collections && settings.jrgq_collections.collections;
    if (jrgq && Array.isArray(jrgq)) {
      const found = jrgq.find(c => c.id === collectionId);
      if (found) {
        return {
          id:          found.id,
          title:       found.title,
          subtitle:    found.subtitle,
          image:       found.image,
          product_ids: found.product_ids || [],
          page_size:   found.page_size  || 12,
          max_price:   found.max_price  || 300,
          hero_title:   found.title,
          hero_subtitle: found.subtitle || '',
          hero_eyebrow: found.name || ''
        };
      }
    }

    return null;
  }

  /* ================================================================
     ALL-COLLECTIONS RENDER
  ================================================================ */
  function renderAllCollections(settings) {
    const grid = document.getElementById('all-collections-grid');
    if (!grid) return;

    const allColsList = settings['all-collections'] || [];
    if (!allColsList.length) return;

    grid.innerHTML = '';

    allColsList.forEach(entry => {
      let colData = null;

      if (entry.settings_key === 'jrgq_collections') {
        const jrgq = settings.jrgq_collections && settings.jrgq_collections.collections;
        if (jrgq) colData = jrgq[entry.jrgq_index] || null;
      } else {
        colData = settings[entry.settings_key] || null;
      }

      if (!colData) return;

      const image    = colData.image    || '';
      const title    = colData.title    || colData.id || '';
      const subtitle = colData.subtitle || '';
      const url      = colData.url      || ('/' + entry.id + '.html');
      const cta      = colData.cta_label || 'Shop Now →';

      const card = document.createElement('a');
      card.className = 'ac-card';
      card.href      = url;
      card.innerHTML =
        '<div class="ac-card__img-wrap">' +
          '<img src="' + image + '" alt="' + title + '" loading="lazy" class="ac-card__img">' +
        '</div>' +
        '<div class="ac-card__info">' +
          '<h3 class="ac-card__title">' + title + '</h3>' +
          (subtitle ? '<p class="ac-card__subtitle">' + subtitle + '</p>' : '') +
          '<span class="ac-card__cta">' + cta + '</span>' +
        '</div>';

      grid.appendChild(card);
    });
  }

  /* ================================================================
     STATE
  ================================================================ */
  let allProducts  = [];
  let settings     = {};
  let colSettings  = {};
  let filtered     = [];

  let activeFilters = {
    category: 'all', availability: [],
    priceMin: 0, priceMax: 150,
    colors: [], sizes: [], rating: 0, discount: null
  };

  let currentSort    = 'default';
  let currentPage    = 1;
  let pageSize       = 8;
  let currentView    = 'grid';
  let animationClass = 'col-anim--fadeSlideUp';

  let selectedProducts = new Set();
  const MAX_COMPARE = 3;

  /* ================================================================
     CATEGORY MAP — dynamically built from colSettings.product_ids
  ================================================================ */
  let CATEGORY_MAP = {
    all: null,
    bestsellers: null,
    new: null
  };

  function buildCategoryMap(productIds) {
    if (!productIds || productIds.length === 0) return;

    CATEGORY_MAP = { all: null, bestsellers: null, new: null };

    let currentKey = null;
    productIds.forEach(function(id) {
      if (typeof id === 'string' && id.startsWith('--') && id.endsWith('--')) {
        currentKey = id.replace(/--/g, '').trim().toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/g, '');
        if (!CATEGORY_MAP[currentKey]) CATEGORY_MAP[currentKey] = [];
      } else if (currentKey) {
        if (!CATEGORY_MAP[currentKey]) CATEGORY_MAP[currentKey] = [];
        CATEGORY_MAP[currentKey].push(id);
      }
    });

    // Inject tabs after building the map
    injectCatTabs();
  }



  function injectCatTabs() {
    const tabsContainer = document.getElementById('colCatTabs');
    if (!tabsContainer) return;

    // Icon map per subcategory key
    const ICON_MAP = {
      // Beauty
      nails:      'fas fa-hand-sparkles',
      eyebrow:    'fas fa-eye',
      lip:        'fas fa-kiss-wink-heart',
      makeup:     'fas fa-magic',
      haircare:   'fas fa-wind',
      skincare:   'fas fa-leaf',
      // Woman
      shoes:      'fas fa-shoe-prints',
      dresses:    'fas fa-person-dress',
      bathrobe:   'fas fa-bath',
      sexy:       'fas fa-heart',
      breathable: 'fas fa-wind',
      bikini:     'fas fa-umbrella-beach',
      tops:       'fas fa-tshirt',
      // Men
      pants:      'fas fa-grip-lines',
      shirts:     'fas fa-shirt',
      sweaters:   'fas fa-mitten',
      // Generic
      default:    'fas fa-tag'
    };

    // Keep only the fixed buttons (All, Best Sellers, New Arrivals)
    const fixedTabs = Array.from(tabsContainer.querySelectorAll('.col-cat-tab'))
  .filter(btn => ['all', 'bestsellers', 'new'].includes(btn.dataset.cat) || btn.id === 'bbwQuizTabBtn');

    tabsContainer.innerHTML = '';
    fixedTabs.forEach(btn => tabsContainer.appendChild(btn));

    // Inject one button per subcategory found in JSON
    Object.keys(CATEGORY_MAP).forEach(function(key) {
      if (['all', 'bestsellers', 'new'].includes(key)) return;
      if (!CATEGORY_MAP[key] || CATEGORY_MAP[key].length === 0) return;

      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const icon  = ICON_MAP[key] || ICON_MAP.default;

      const btn = document.createElement('button');
      btn.className    = 'col-cat-tab';
      btn.dataset.cat  = key;
      btn.innerHTML    = '<i class="' + icon + '"></i> ' + label;

      btn.addEventListener('click', function() {
        document.querySelectorAll('.col-cat-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        activeFilters.category = key;
        applyAll();
      });

      tabsContainer.appendChild(btn);
    });
  }
  
  /* ================================================================
     TOAST
  ================================================================ */
  function showCompareToast(msg) {
    let toast = document.getElementById('col-compare-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'col-compare-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2800);
  }

  /* ================================================================
     DOM SHORTCUTS
  ================================================================ */
  const $  = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  const colGrid            = $('colGrid');
  const colEmpty           = $('colEmpty');
  const colPagination      = $('colPagination');
  const colVisibleCount    = $('colVisibleCount');
  const colFilterToggle    = $('colFilterToggle');
  const colFilterCount     = $('colFilterCount');
  const colDrawer          = $('colDrawer');
  const colDrawerOverlay   = $('colDrawerOverlay');
  const colDrawerClose     = $('colDrawerClose');
  const colDrawerApply     = $('colDrawerApply');
  const colDrawerClear     = $('colDrawerClear');
  const colDrawerCount     = $('colDrawerCount');
  const colSortBtn         = $('colSortBtn');
  const colSortMenu        = $('colSortMenu');
  const colSortLabel       = $('colSortLabel');
  const colActiveFilters   = $('colActiveFilters');
  const colActivePills     = $('colActivePills');
  const colClearAll        = $('colClearAll');
  const colEmptyReset      = $('colEmptyReset');
  const colRangeMin        = $('colRangeMin');
  const colRangeMax        = $('colRangeMax');
  const colRangeFill       = $('colRangeFill');
  const colPriceDispMin    = $('colPriceDispMin');
  const colPriceDispMax    = $('colPriceDispMax');
  const colPriceInpMin     = $('colPriceInpMin');
  const colPriceInpMax     = $('colPriceInpMax');
  const colColorSwatches   = $('colColorSwatches');
  const colSizeGrid        = $('colSizeGrid');
  const colDiscountFilters = $('colDiscountFilters');

  const colStickyBar     = () => $('colStickyBar');
  const colSelectedCount = () => $('colSelectedCount');
  const colCompareBtn    = () => $('colCompareBtn');
  const colStickyAddCart = () => $('colStickyAddCart');
  const colStickyBarClear= () => $('colStickyBarClear');
  const colRecentlyViewed= $('colRecentlyViewed');
  const colRvGrid        = $('colRvGrid');
  const colRvClear       = $('colRvClear');
  const colFbtSection    = $('colFbtSection');
  const colFbtInner      = $('colFbtInner');
  const colFlashDeal     = $('colFlashDeal');
  const colFlashClose    = $('colFlashClose');
  const colExitOverlay   = $('colExitOverlay');
  const colExitClose     = $('colExitClose');
  const colExitCopy      = $('colExitCopy');
  const colExitCta       = $('colExitCta');
  const colExitSkip      = $('colExitSkip');

  /* ================================================================
     IMAGE HELPERS
  ================================================================ */
  function getColorImage(prod, colorName) {
    if (!colorName) return prod.image || '';
    if (prod.colors && prod.colors.length > 0) {
      const c = prod.colors.find(c => c.name === colorName);
      if (c && c.image) return c.image;
    }
    if (prod.variants && prod.variants.length > 0) {
      const v = prod.variants.find(v => v.color === colorName && v.image);
      if (v && v.image) return v.image;
    }
    return prod.image || '';
  }

  /* ================================================================
     FLASH DEAL COUNTDOWN
  ================================================================ */
  let cdTimer = null;

  function initCountdown(hoursFromSettings) {
    const STORAGE_KEY = 'cf_flash_end';
    const hours = parseInt(hoursFromSettings) || 4;
    const DURATION = hours * 60 * 60 * 1000;

    let endTime = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
    const now = Date.now();

    if (!endTime || endTime <= now) {
      endTime = now + DURATION;
      localStorage.setItem(STORAGE_KEY, endTime);
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function tick() {
      const remaining = Math.max(0, endTime - Date.now());
      const hours_left = Math.floor(remaining / 3_600_000);
      const minutes    = Math.floor((remaining % 3_600_000) / 60_000);
      const seconds    = Math.floor((remaining % 60_000) / 1_000);
      const hEl = $('cdHours'), mEl = $('cdMinutes'), sEl = $('cdSeconds');
      if (hEl) hEl.textContent = pad(hours_left);
      if (mEl) mEl.textContent = pad(minutes);
      if (sEl) sEl.textContent = pad(seconds);

      if (remaining <= 0) {
        localStorage.removeItem(STORAGE_KEY);
        if (cdTimer) clearInterval(cdTimer);
        const newEnd = Date.now() + DURATION;
        localStorage.setItem(STORAGE_KEY, newEnd);
        endTime = newEnd;
        cdTimer = setInterval(tick, 1000);
      }
    }

    if (cdTimer) clearInterval(cdTimer);
    tick();
    cdTimer = setInterval(tick, 1000);

    if (colFlashClose) {
      colFlashClose.addEventListener('click', () => {
        if (colFlashDeal) {
          colFlashDeal.style.opacity = '0';
          colFlashDeal.style.transition = 'opacity 0.3s ease';
          setTimeout(() => { colFlashDeal.style.display = 'none'; }, 300);
        }
      });
    }
  }

  /* ================================================================
     RECENTLY VIEWED
  ================================================================ */
  const RV_KEY = 'cf_recently_viewed';
  const RV_MAX = 12;

  function getRV() {
    try { return JSON.parse(localStorage.getItem(RV_KEY) || '[]'); } catch(e) { return []; }
  }

  function addToRV(prod) {
    let rv = getRV().filter(p => p.id !== prod.id);
    rv.unshift({ id: prod.id, title: prod.title, price: prod.price, image: prod.image });
    if (rv.length > RV_MAX) rv = rv.slice(0, RV_MAX);
    localStorage.setItem(RV_KEY, JSON.stringify(rv));
  }

  function renderRV() {
  if (!colRvGrid || !colRecentlyViewed) return;
  
  let rv = [];
  try { rv = JSON.parse(localStorage.getItem(RV_KEY) || '[]'); } catch(e) {}
  if (!rv.length) { colRecentlyViewed.style.display = 'none'; return; }

  // Compatible avec les deux formats : tableaux d'IDs (pages produit) ou d'objets (ancienne collection)
  colRecentlyViewed.style.display = 'block';
  colRvGrid.innerHTML = '';

  rv.slice(0, 6).forEach(entry => {
    const id   = typeof entry === 'string' ? entry : entry.id;
    const prod = allProducts.find(p => p.id === id) || (typeof entry === 'object' ? entry : null);
    if (!prod) return;

    const url     = getProductUrl(prod.id || id);
    const imgSrc  = upgradeShopifyImageUrl(prod.image, 300);
    const title   = prod.title || '';
    const price   = Number(prod.price) || 0;

    const card = document.createElement('div');
    card.className = 'col-rv-card';
    card.innerHTML =
      '<img class="col-rv-card__img" src="' + imgSrc + '" alt="' + title + '" loading="lazy">' +
      '<div class="col-rv-card__info">' +
        '<p class="col-rv-card__title">' + title + '</p>' +
        '<span class="col-rv-card__price">$' + price.toFixed(2) + '</span>' +
      '</div>';
    card.addEventListener('click', () => { window.location.href = url; });
    colRvGrid.appendChild(card);
  });
}

  if (colRvClear) {
    colRvClear.addEventListener('click', () => {
      localStorage.removeItem(RV_KEY);
      if (colRecentlyViewed) colRecentlyViewed.style.display = 'none';
    });
  }

  /* ================================================================
     FREQUENTLY BOUGHT TOGETHER
  ================================================================ */
  function renderFBT() {
    if (!colFbtInner || !colFbtSection || allProducts.length < 3) return;
    const pool = allProducts.slice(0, Math.min(8, allProducts.length));
    const picks = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    if (picks.length < 2) return;
    colFbtSection.style.display = 'block';
    colFbtInner.innerHTML = '';
    let total = 0;
    picks.forEach((prod, i) => {
      total += prod.price;
      const url = getProductUrl(prod.id);
      const card = document.createElement('div');
      card.className = 'col-fbt-card';
      card.innerHTML =
        '<img class="col-fbt-card__img" src="' + upgradeShopifyImageUrl(prod.image, 300) + '" alt="' + prod.title + '" loading="lazy">' +
        '<div class="col-fbt-card__info">' +
          '<p class="col-fbt-card__title">' + prod.title + '</p>' +
          '<span class="col-fbt-card__price">$' + prod.price.toFixed(2) + '</span>' +
        '</div>';
      card.addEventListener('click', () => { window.location.href = url; });
      colFbtInner.appendChild(card);
      if (i < picks.length - 1) {
        const plus = document.createElement('span');
        plus.className = 'col-fbt-plus';
        plus.textContent = '+';
        colFbtInner.appendChild(plus);
      }
    });
    const cta = document.createElement('div');
    cta.className = 'col-fbt-cta';
    cta.innerHTML =
      '<p class="col-fbt-total">Bundle total: <strong>$' + total.toFixed(2) + '</strong></p>' +
      '<button class="col-fbt-btn">Add All 3 to Cart</button>';
    cta.querySelector('.col-fbt-btn').addEventListener('click', () => {
      picks.forEach(prod => addProductToCartWithColor(prod, null, cta.querySelector('.col-fbt-btn')));
    });
    colFbtInner.appendChild(cta);
  }

  /* ================================================================
     INJECT HERO FROM COLLECTION DATA
  ================================================================ */
  function injectCollectionHero(col) {
    const heroTitle    = document.getElementById('colHeroTitle');
    const heroSubtitle = document.getElementById('colHeroSubtitle');
    const heroEyebrow  = document.getElementById('colHeroEyebrow');
    const heroImage    = document.getElementById('colHeroImage');

    if (heroTitle)    heroTitle.textContent    = col.hero_title    || col.title    || '';
    if (heroSubtitle) heroSubtitle.textContent = col.hero_subtitle || col.subtitle || '';
    if (heroEyebrow)  heroEyebrow.textContent  = col.hero_eyebrow  || col.name    || '';
    if (heroImage && col.image) {
      heroImage.src = upgradeShopifyImageUrl(col.image, 1200);
      heroImage.alt = col.title || '';
    }
  }

  /* ================================================================
     FETCH DATA
  ================================================================ */
  fetch('/products.data.json')
    .then(r => r.json())
    .then(data => {
      window.__allProducts = data;
      settings = data.find(p => p.type === 'settings') || {};

      if (document.getElementById('all-collections-grid')) {
  renderAllCollections(settings);

  const spFreeShipEl = document.getElementById('spFreeShipping');
  if (spFreeShipEl) spFreeShipEl.textContent = 
    (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold) || 50;

  return;
}
 
  

      
      const collectionId = detectCollectionId();
      colSettings = resolveCollectionSettings(settings, collectionId);

      if (!colSettings) {
        console.error('[Collections] No collection found for id:', collectionId);
        if (colEmpty) colEmpty.style.display = 'block';
        return;
      }

      const productIds = colSettings.product_ids || [];
      pageSize = parseInt(colSettings.page_size) || 8;

      
      const flashHours = (settings.flash_deal && settings.flash_deal.hours) ? settings.flash_deal.hours : 4;
      initCountdown(flashHours);

      
      const bp = (settings.promos || []).reduce((b,p) => p.percent > (b.percent||0) ? p : b, {});
      const flashSubEl = document.querySelector('.col-flash-sub strong');
      const flashTitleEl = document.querySelector('.col-flash-title');
      if (flashSubEl && bp.code)    flashSubEl.textContent = bp.code;
      if (flashTitleEl && bp.percent) flashTitleEl.innerHTML = flashTitleEl.innerHTML.replace('20', bp.percent);

      
      const freeShipThreshold = (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold) ? settings.cart_drawer.free_shipping_threshold : 50;
      const spFreeShipEl = $('spFreeShipping');
      if (spFreeShipEl) spFreeShipEl.textContent = freeShipThreshold;

      
      const animMap = {
        fadeSlideUp: 'col-anim--fadeSlideUp',
        zoomFade:    'col-anim--zoomFade',
        flipIn:      'col-anim--flipIn',
        slideLeft:   'col-anim--slideLeft',
        slideRight:  'col-anim--slideRight',
        rotateIn:    'col-anim--rotateIn',
        glowPop:     'col-anim--glowPop'
      };
      const cardAnims = settings.col_card_animations || {};
      const activeAnim = Object.keys(cardAnims).find(k => (cardAnims[k] || '').toLowerCase() === 'yes');
      animationClass = (activeAnim && animMap[activeAnim]) ? animMap[activeAnim] : 'col-anim--fadeSlideUp';
      
      const realProducts = data.filter(p => !p.type && p.active !== false);
      if (productIds.length > 0) {
        allProducts = productIds.map(id => realProducts.find(p => p.id === id)).filter(Boolean);
      } else {
        allProducts = realProducts;
      }

      
      buildCategoryMap(productIds);

      
      const maxPrice = parseInt(colSettings.max_price) ||
        (allProducts.length > 0
          ? Math.ceil(Math.max(...allProducts.map(p => p.compare_price || p.price)) / 10) * 10
          : 200);

      activeFilters.priceMax  = maxPrice;
      if (colRangeMin) colRangeMin.max = maxPrice;
      if (colRangeMax) { colRangeMax.max = maxPrice; colRangeMax.value = maxPrice; }
      if (colPriceInpMax) { colPriceInpMax.max = maxPrice; colPriceInpMax.value = maxPrice; }
      if (colPriceDispMax) colPriceDispMax.textContent = '$' + maxPrice;

      
      injectCollectionHero(colSettings);

      
      injectSocialLinks(settings.social_links || {});

      
      buildColorList();
      buildSizeGrid();
      buildDiscountFilters();
      updateAvailabilityCounts();

      
      applyAll();
      renderRV();
      renderFBT();

      window.__allProducts = allProducts;
    })
    .catch(err => console.error('[Collection] Failed to load products.data.json:', err));

  /* ================================================================
     SOCIAL LINKS
  ================================================================ */
  function injectSocialLinks(social) {
    const map = {
      'fs-facebook': social.facebook, 'fs-instagram': social.instagram,
      'fs-tiktok': social.tiktok, 'fs-pinterest': social.pinterest,
      'fs-youtube': social.youtube, 'fs-whatsapp': social.whatsapp,
      'fs-twitter': social.twitter
    };
    Object.entries(map).forEach(([id, url]) => {
      const el = document.getElementById(id);
      if (el && url) { el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    });
  }

  /* ================================================================
     COLOR FILTER BUILD
  ================================================================ */
  function getColorBase(colorName) {
    if (!colorName) return 'other';
    return colorName.toLowerCase().trim().split(/[\s_-]+/)[0];
  }

  function buildColorList() {
    if (!colColorSwatches) return;
    const colorMap = new Map();
    allProducts.forEach(prod => {
      if (!prod.colors) return;
      prod.colors.forEach(c => {
        const base = getColorBase(c.name);
        if (!colorMap.has(base)) colorMap.set(base, { name: c.name, hex: c.hex || getHex(c.name) });
      });
    });
    colColorSwatches.innerHTML = '';
    [...colorMap.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([base, info]) => {
      const hex = info.hex, light = isLightColor(hex);
      const row = document.createElement('div');
      row.className = 'col-color-row';
      row.dataset.colorBase = base;
      row.innerHTML =
        '<div class="col-color-row__dot' + (light ? ' col-color-row__dot--light' : '') + '" style="background:' + hex + '"></div>' +
        '<span class="col-color-row__name">' + info.name + '</span>' +
        '<div class="col-color-row__check"></div>';
      row.addEventListener('click', () => {
        row.classList.toggle('active');
        const idx = activeFilters.colors.indexOf(base);
        if (idx === -1) activeFilters.colors.push(base);
        else activeFilters.colors.splice(idx, 1);
        updateActiveFiltersUI(); updateDrawerCount();
      });
      colColorSwatches.appendChild(row);
    });
  }

  function buildSizeGrid() {
    if (!colSizeGrid) return;
    const sizeSet = new Set();
    allProducts.forEach(prod => { if (prod.sizes) prod.sizes.forEach(s => sizeSet.add(s)); });
    colSizeGrid.innerHTML = '';
    const order = ['XS','S','M','L','XL','XXL','XXXL','3XL','4XL','5XL','6XL'];
    [...sizeSet].sort((a,b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1; if (ib !== -1) return 1;
      return String(a).localeCompare(String(b));
    }).forEach(size => {
      const btn = document.createElement('button');
      btn.className = 'col-size-btn'; btn.textContent = size; btn.dataset.size = size;
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const idx = activeFilters.sizes.indexOf(size);
        if (idx === -1) activeFilters.sizes.push(size); else activeFilters.sizes.splice(idx, 1);
        updateActiveFiltersUI(); updateDrawerCount();
      });
      colSizeGrid.appendChild(btn);
    });
  }

  function buildDiscountFilters() {
    if (!colDiscountFilters) return;
    colDiscountFilters.innerHTML = '';
    [10,20,30,40,50].forEach(pct => {
      const label = document.createElement('label');
      label.className = 'col-check';
      label.innerHTML =
        '<input type="checkbox" name="discount" value="' + pct + '">' +
        '<span class="col-check__box"></span>' +
        '<span class="col-check__label">' + pct + '%+ off</span>';
      const cb = label.querySelector('input');
      cb.addEventListener('change', () => {
        activeFilters.discount = cb.checked ? pct : null;
        $$('input[name="discount"]').forEach(c => { if (c !== cb) c.checked = false; });
        updateActiveFiltersUI(); updateDrawerCount();
      });
      colDiscountFilters.appendChild(label);
    });
  }

  function updateAvailabilityCounts() {
    const inStock  = allProducts.filter(p => p.variants && p.variants.some(v => v.active)).length;
    const outStock = allProducts.length - inStock;
    const el1 = $('cnt-instock'), el2 = $('cnt-outstock');
    if (el1) el1.textContent = inStock;
    if (el2) el2.textContent = outStock;
  }

  /* ================================================================
     FILTERS & SORT
  ================================================================ */
  function getDiscount(prod) {
    if (!prod.compare_price || prod.compare_price <= prod.price) return 0;
    return Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100);
  }

  function productMatchesFilters(prod) {
    if (prod.price > activeFilters.priceMax) return false;
    if (activeFilters.priceMin > 0 && prod.price < activeFilters.priceMin) return false;

    const cat = activeFilters.category;
    if (cat === 'bestsellers') {
      if ((prod.rating || 0) < 4.5 && (prod.reviews_count || 0) < 100) return false;
    } else if (cat === 'new') {
      const cutoff = Math.floor(allProducts.length * 0.75);
      const idx = allProducts.findIndex(p => p.id === prod.id);
      if (idx < cutoff) return false;
    } else if (cat !== 'all') {
      const ids = CATEGORY_MAP[cat];
      if (ids && !ids.includes(prod.id)) return false;
    }

    if (activeFilters.availability.length > 0) {
      const hasStock = prod.variants && prod.variants.some(v => v.active);
      if (activeFilters.availability.includes('in-stock')  && !hasStock) return false;
      if (activeFilters.availability.includes('out-stock') && hasStock)  return false;
    }

    if (activeFilters.colors.length > 0) {
      if (!prod.colors || prod.colors.length === 0) return false;
      const prodBases = prod.colors.map(c => getColorBase(c.name));
      if (!activeFilters.colors.some(fc => prodBases.includes(fc))) return false;
    }

    if (activeFilters.sizes.length > 0) {
      if (!prod.sizes || prod.sizes.length === 0) return false;
      if (!activeFilters.sizes.some(fs => prod.sizes.includes(fs))) return false;
    }

    if (activeFilters.rating > 0 && (prod.rating || 0) < activeFilters.rating) return false;
    if (activeFilters.discount !== null && getDiscount(prod) < activeFilters.discount) return false;

    return true;
  }

  function sortProducts(prods) {
    const copy = [...prods];
    if (currentSort === 'default' && colRangeMax && (activeFilters.priceMin > 0 || activeFilters.priceMax < parseInt(colRangeMax.max || 150))) {
      return copy.sort((a, b) => a.price - b.price);
    }
    switch (currentSort) {
      case 'price-asc':  return copy.sort((a,b) => a.price - b.price);
      case 'price-desc': return copy.sort((a,b) => b.price - a.price);
      case 'discount':   return copy.sort((a,b) => getDiscount(b) - getDiscount(a));
      case 'rating':     return copy.sort((a,b) => (b.rating||0) - (a.rating||0));
      case 'reviews':    return copy.sort((a,b) => (b.reviews_count||0) - (a.reviews_count||0));
      case 'name-asc':   return copy.sort((a,b) => a.title.localeCompare(b.title));
      default:           return copy;
    }
  }

  function applyAll() {
    filtered    = allProducts.filter(productMatchesFilters);
    filtered    = sortProducts(filtered);
    currentPage = 1;
    selectedProducts.clear();
    updateStickyBar();
    renderPage();
    renderPagination();
    updateActiveFiltersUI();
  }

  /* ================================================================
     PRIX PAR COULEUR
  ================================================================ */
  function getMinPriceForColor(prod, colorName) {
    if (!prod.variants || prod.variants.length === 0) return prod.price;
    const colorVariants = prod.variants.filter(v => v.color === colorName && v.active !== false);
    if (colorVariants.length === 0) return prod.price;
    return Math.min(...colorVariants.map(v => v.price));
  }

  /* ================================================================
     BUILD VARIANT ENTRIES
  ================================================================ */
  function buildVariantEntries(products) {
    const entries = [];

    products.forEach(prod => {
      const colors = (prod.colors && prod.colors.length > 0)
        ? prod.colors.filter(c => c.active !== false)
        : [];

      if (colors.length === 0) {
        entries.push({ prod, color: null, variantPrice: prod.price });
        return;
      }

      const colorsToShow = activeFilters.colors.length > 0
        ? colors.filter(c => activeFilters.colors.includes(getColorBase(c.name)))
        : colors;

      const finalColors = colorsToShow.length > 0 ? colorsToShow : colors;

      finalColors.forEach(color => {
        entries.push({
          prod,
          color,
          variantPrice: getMinPriceForColor(prod, color.name)
        });
      });
    });

    return entries;
  }

  /* ================================================================
     RENDER PAGE
  ================================================================ */
  function renderPage() {
    if (!colGrid) return;
    colGrid.innerHTML = '';
    const variantEntries = buildVariantEntries(filtered);
    const total = variantEntries.length;
    if (colVisibleCount) colVisibleCount.textContent = total;
    if (colDrawerCount)  colDrawerCount.textContent  = total;
    if (total === 0) { if (colEmpty) colEmpty.style.display = 'block'; return; }
    if (colEmpty) colEmpty.style.display = 'none';
    const start = (currentPage - 1) * pageSize;
    variantEntries.slice(start, start + pageSize).forEach((entry, idx) => {
      colGrid.appendChild(buildCard(entry.prod, idx, entry.color, entry.variantPrice));
    });
    if (currentPage > 1) colGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ================================================================
     BUILD CARD
  ================================================================ */
  function buildCard(prod, idx, color, variantPrice) {
    const card = document.createElement('div');
    card.className = 'col-product-card ' + animationClass + ' col-anim-delay-' + Math.min(idx % 12 + 1, 12);
    card.dataset.id = prod.id;

    const discount   = getDiscount(prod);
    const rawImg     = color ? getColorImage(prod, color.name) : prod.image;
    const mainImg    = rawImg || prod.image;
    const hoverImg   = prod.image_hover || null;
    const productUrl = getProductUrl(prod.id);
    const displayPrice = (typeof variantPrice === 'number') ? variantPrice : prod.price;

    let badgesHTML = '';
    if (discount > 0) {
      badgesHTML += '<span class="col-card__badge col-card__badge--discount">-' + discount + '%</span>';
    }
    if (prod.badge && prod.badge.text) {
      badgesHTML += '<span class="col-card__badge col-card__badge--custom">' + prod.badge.text + '</span>';
    }
    if (color) {
      const hex = color.hex || getHex(color.name) || '#ccc';
      const tc  = isLightColor(hex) ? '#333' : '#fff';
      badgesHTML += '<span class="col-card__badge col-card__badge--color" style="background:' + hex + ';color:' + tc + ';max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + color.name + '">' + color.name + '</span>';
    }

    if (!hoverImg) card.classList.add('no-hover-img');

    const isSelected = selectedProducts.has(prod.id + (color ? '_' + color.name : ''));
    const rating = prod.rating || 4.7;
    const stars  = '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '') + '☆'.repeat(Math.max(0, 5 - Math.ceil(rating)));

    const colorSizes = [];
    if (color && prod.variants && prod.variants.length > 0) {
      prod.variants.filter(v => v.color === color.name && v.active !== false && v.size)
        .forEach(v => { if (!colorSizes.includes(v.size)) colorSizes.push(v.size); });
    } else if (prod.sizes && prod.sizes.length > 0) {
      colorSizes.push(...prod.sizes);
    }

    card.innerHTML =
      '<div class="col-card__media">' +
        '<img class="col-card__img col-card__img--main" src="' + upgradeShopifyImageUrl(mainImg, 600) + '" alt="' + prod.title + (color ? ' — ' + color.name : '') + '" loading="lazy" onerror="this.src=\'' + upgradeShopifyImageUrl(prod.image, 600) + '\'">' +
        (hoverImg ? '<img class="col-card__img col-card__img--hover" src="' + upgradeShopifyImageUrl(hoverImg, 600) + '" alt="' + prod.title + '" loading="lazy">' : '') +
        '<div class="col-card__badges">' + badgesHTML + '</div>' +
        '<button class="col-card__wishlist" data-id="' + prod.id + '" title="Add to wishlist"><i class="far fa-heart"></i></button>' +
        '<button class="col-card__quick-view" data-id="' + prod.id + '"><i class="fas fa-search"></i> Quick View</button>' +
      '</div>' +
      '<div class="col-card__select">' +
        '<input type="checkbox" title="Select for compare"' + (isSelected ? ' checked' : '') + ' data-select-id="' + prod.id + (color ? '_' + color.name : '') + '">' +
      '</div>' +
      '<div class="col-card__info">' +
        '<span class="col-card__color-name">' + (color ? color.name : '') + '</span>' +
        '<a href="' + productUrl + '" class="col-card__title">' + prod.title + '</a>' +
        (colorSizes.length > 0 ? '<div class="col-card__sizes">' + colorSizes.slice(0,5).map((s, i) => {
          const variant = prod.variants ? prod.variants.find(v => (!color || v.color === color.name) && v.size === s) : null;
          const vPrice = variant ? variant.price : displayPrice;
          return '<span class="col-card__size-btn" data-price="' + vPrice + '" style="cursor:pointer;padding:2px 6px;border:1px solid #ccc;border-radius:4px;margin:2px;display:inline-block;" data-active="' + (i===0?'true':'false') + '">' + s + '</span>';
        }).join('') + (colorSizes.length > 5 ? ' …' : '') + '</div>' : '') +
        '<div class="col-card__rating"><span class="col-card__stars">' + stars + '</span><span class="col-card__reviews">(' + (prod.reviews_count || 0) + ')</span></div>' +
        '<div class="col-card__prices">' +
          '<span class="col-card__price">$' + displayPrice.toFixed(2) + '</span>' +
          (prod.compare_price > displayPrice ? '<span class="col-card__compare">$' + prod.compare_price.toFixed(2) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="col-card__actions">' +
        '<button class="col-card__btn col-card__btn--cart" data-id="' + prod.id + '"><i class="fi fi-rr-shopping-cart"></i> Add to Cart</button>' +
        '<a href="' + productUrl + '" class="col-card__btn col-card__btn--view">View</a>' +
      '</div>';

    card.querySelector('.col-card__media').addEventListener('click', e => {
      if (e.target.closest('.col-card__wishlist') || e.target.closest('.col-card__quick-view')) return;
      addToRV(prod);
      window.location.href = productUrl;
    });

    card.querySelector('.col-card__title').addEventListener('click', () => { addToRV(prod); });

    const wishBtn = card.querySelector('.col-card__wishlist');
    if (wishBtn) {
      updateWishlistIcon(wishBtn, prod.id);
      wishBtn.addEventListener('click', e => { e.stopPropagation(); toggleWishlistItem(prod, wishBtn); });
    }

    const cartBtn = card.querySelector('.col-card__btn--cart');
      if (cartBtn) {
        cartBtn.addEventListener('click', e => {
          e.stopPropagation();
          
          if (cartBtn.innerHTML.includes('Request')) {
            if (typeof window.openProductRequestPopup === 'function') {
              window.openProductRequestPopup(prod.id);
            }
            return;
          }
          const activeSizeBtn = card.querySelector('.col-card__size-btn.active');
          const selectedSize  = activeSizeBtn ? activeSizeBtn.textContent.trim() : null;
          addProductToCartWithColor(prod, color, cartBtn, selectedSize);
        });
      }

    const qvBtn = card.querySelector('.col-card__quick-view');
      if (qvBtn) {
        qvBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (qvBtn.innerHTML.includes('Request')) {
            if (typeof window.openProductRequestPopup === 'function') {
              window.openProductRequestPopup(prod.id);
            }
            return;
          }
          openQuickView(prod, color);
        });
      }

    card.querySelectorAll('.col-card__size-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        card.querySelectorAll('.col-card__size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const priceEl = card.querySelector('.col-card__price');
        if (priceEl) priceEl.textContent = '$' + parseFloat(btn.dataset.price).toFixed(2);
      });
    });

    const firstSize = card.querySelector('.col-card__size-btn');
    if (firstSize) {
      firstSize.classList.add('active');
      const priceEl = card.querySelector('.col-card__price');
      if (priceEl) priceEl.textContent = '$' + parseFloat(firstSize.dataset.price).toFixed(2);
    }

    const chk = card.querySelector('.col-card__select input');
    if (chk) {
      const selectKey = prod.id + (color ? '_' + color.name : '');
      chk.addEventListener('change', e => {
        e.stopPropagation();
        if (chk.checked) {
          if (selectedProducts.size >= MAX_COMPARE) {
            chk.checked = false;
            showCompareToast('You can compare up to ' + MAX_COMPARE + ' items.');
            return;
          }
          selectedProducts.add(selectKey);
        } else {
          selectedProducts.delete(selectKey);
        }
        updateStickyBar();
      });
    }

    return card;
  }

  /* ================================================================
     QUICK VIEW MODAL
  ================================================================ */
  function openQuickView(prod, selectedColor) {
    const colQvOverlay = $('colQvOverlay');
    const colQvInner   = $('colQvInner');
    if (!colQvOverlay || !colQvInner) return;

    const discount   = getDiscount(prod);
    const imgSrc     = selectedColor ? getColorImage(prod, selectedColor.name) : prod.image;
    const productUrl = getProductUrl(prod.id);
    const rating     = prod.rating || 4.7;
    const stars      = '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '') + '☆'.repeat(Math.max(0, 5 - Math.ceil(rating)));
    const hasStock   = prod.variants && prod.variants.some(v => v.active);
    const colors     = prod.colors || [];
    const sizes      = prod.sizes || [];

    let badgesHTML = '';
    if (discount > 0) badgesHTML += '<span class="col-qv-badge col-qv-badge--disc">-' + discount + '% OFF</span>';
    badgesHTML += '<span class="col-qv-badge col-qv-badge--stock">' + (hasStock ? 'In Stock' : 'Out of Stock') + '</span>';

    let colorsHTML = '';
    if (colors.length > 0) {
      colorsHTML = '<p class="col-qv-section-label">Color</p><div class="col-qv-colors">' +
        colors.slice(0,10).map(c => {
          const hex = c.hex || getHex(c.name);
          const light = isLightColor(hex);
          const active = selectedColor && c.name === selectedColor.name;
          return '<span class="col-qv-color-dot' + (active ? ' active' : '') + '" style="background:' + hex + ';border-color:' + (light ? '#ccc' : 'rgba(0,0,0,0.12)') + '" title="' + c.name + '"></span>';
        }).join('') +
      '</div>';
    }

    let sizesHTML = '';
    if (sizes.length > 0) {
      sizesHTML = '<p class="col-qv-section-label">Size</p><div class="col-qv-sizes">' +
        sizes.map((s, i) => '<button class="col-qv-size-btn' + (i === 0 ? ' active' : '') + '">' + s + '</button>').join('') +
      '</div>';
    }

    const displayPrice = selectedColor ? getMinPriceForColor(prod, selectedColor.name) : prod.price;

    colQvInner.innerHTML =
      '<div class="col-qv-media">' +
        '<img id="qvMainImg" src="' + upgradeShopifyImageUrl(imgSrc, 700) + '" alt="' + prod.title + '" style="width:100%;height:100%;object-fit:cover;">' +
      '</div>' +
      '<div class="col-qv-info">' +
        '<div class="col-qv-badge-row">' + badgesHTML + '</div>' +
        '<h2 class="col-qv-title">' + prod.title + '</h2>' +
        '<div class="col-qv-rating"><span class="col-qv-stars">' + stars + '</span><span class="col-qv-rcount">(' + (prod.reviews_count || 0) + ' reviews)</span></div>' +
        '<div class="col-qv-price-row">' +
          '<span class="col-qv-price" id="qvPrice">$' + displayPrice.toFixed(2) + '</span>' +
          (prod.compare_price > displayPrice ? '<span class="col-qv-compare">$' + prod.compare_price.toFixed(2) + '</span>' : '') +
        '</div>' +
        (prod.description ? '<p class="col-qv-desc">' + prod.description + '</p>' : '') +
        colorsHTML +
        sizesHTML +
        '<div class="col-qv-actions">' +
          '<button class="col-qv-btn col-qv-btn--cart" id="qvCartBtn"><i class="fi fi-rr-shopping-cart"></i> Add to Cart</button>' +
          '<a href="' + productUrl + '" class="col-qv-btn col-qv-btn--view">Full Details</a>' +
        '</div>' +
      '</div>';

    let qvActiveColor = selectedColor ? selectedColor.name : (colors.length > 0 ? colors[0].name : null);
    let qvActiveSize  = sizes.length > 0 ? sizes[0] : null;

    function qvGetPrice() {
      if (!qvActiveColor && !qvActiveSize) return prod.price;
      if (prod.variants && prod.variants.length > 0) {
        const v = prod.variants.find(vv => {
          const colorMatch = !qvActiveColor || vv.color === qvActiveColor;
          const sizeMatch  = !qvActiveSize  || vv.size  === qvActiveSize;
          return colorMatch && sizeMatch && vv.active !== false;
        });
        if (v) return v.price;
        if (qvActiveColor) return getMinPriceForColor(prod, qvActiveColor);
      }
      return prod.price;
    }

    function qvUpdatePrice() {
      const priceEl = $('qvPrice');
      if (priceEl) priceEl.textContent = '$' + qvGetPrice().toFixed(2);
    }

    colQvInner.querySelectorAll('.col-qv-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        colQvInner.querySelectorAll('.col-qv-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        qvActiveSize = btn.textContent.trim();
        qvUpdatePrice();
      });
    });

    const qvDots = Array.from(colQvInner.querySelectorAll('.col-qv-color-dot'));
    qvDots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        if (dot.classList.contains('active')) return;
        qvDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        const colorObj = colors[i];
        if (!colorObj) return;
        qvActiveColor = colorObj.name;
        const newImgSrc = upgradeShopifyImageUrl(getColorImage(prod, colorObj.name), 700);
        const imgEl = $('qvMainImg');
        if (imgEl && newImgSrc) {
          const preloader = new Image();
          preloader.onload = () => { imgEl.src = newImgSrc; };
          preloader.src = newImgSrc;
        }
        qvUpdatePrice();
      });
    });

    qvUpdatePrice();

    const qvCartBtn = $('qvCartBtn');
    if (qvCartBtn) {
      const BBW_FEATURED_IDS = ['Pdg-Francenel-product69','Pdg-Francenel-product70','Pdg-Francenel-product71','Pdg-Francenel-product72','Pdg-Francenel-product73','Pdg-Francenel-product74','Pdg-Francenel-product75'];
      const _s = (window.__allProducts||[]).find(p=>p.type==='settings')||{};
      const _plansOn = (_s.plans_available||'no').toLowerCase()==='yes';

      if (BBW_FEATURED_IDS.includes(prod.id) && !_plansOn) {
        qvCartBtn.innerHTML = '<i class="fi fi-rr-shopping-bag"></i> Request This Product';
        qvCartBtn.addEventListener('click', () => {
          const _ov = $('colQvOverlay');
          if (_ov) _ov.style.display = 'none';
          document.body.style.overflow = '';
          if (typeof window.openProductRequestPopup === 'function') {
            window.openProductRequestPopup(prod.id);
          }
        });
      } else {
        qvCartBtn.addEventListener('click', () => {
          const activeColorObj = colors.find(c => c.name === qvActiveColor) || selectedColor;


        let targetVariant = null;
        if (prod.variants && prod.variants.length > 0) {
          targetVariant = prod.variants.find(vv => {
            const colorMatch = !qvActiveColor || vv.color === qvActiveColor;
            const sizeMatch  = !qvActiveSize  || vv.size  === qvActiveSize;
            return colorMatch && sizeMatch && vv.active !== false;
          });
          if (!targetVariant && qvActiveColor) {
            targetVariant = prod.variants.find(vv => vv.color === qvActiveColor && vv.active !== false);
          }
          if (!targetVariant) targetVariant = prod.variants[0];
        }

        const rawImg = activeColorObj ? getColorImage(prod, activeColorObj.name) : prod.image;
        const item = {
          id:            prod.id,
          title:         prod.title,
          price:         targetVariant ? targetVariant.price : prod.price,
          compare_price: prod.compare_price,
          image:         upgradeShopifyImageUrl(rawImg || prod.image),
          color:         targetVariant ? (targetVariant.color || null) : (activeColorObj ? activeColorObj.name : null),
          size:          targetVariant ? (targetVariant.size  || null) : null,
          quantity:      1,
          cj_product_id: prod.cj_id,
          cj_variant_id: targetVariant ? targetVariant.vid : null
        };

        let cart = [];
        if (typeof window.__getCart === 'function') cart = window.__getCart();
        else { try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch(e) {} }

        const existing = cart.find(i => i.id === item.id && i.color === item.color && i.size === item.size);
        if (existing) existing.quantity++;
        else cart.push(item);

        if (typeof window.__setCart === 'function') window.__setCart(cart);
        localStorage.setItem('cart', JSON.stringify(cart));

        qvCartBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
        qvCartBtn.style.background = '#2e7d32';
        setTimeout(() => {
          qvCartBtn.innerHTML = '<i class="fi fi-rr-shopping-cart"></i> Add to Cart';
          qvCartBtn.style.background = '';
        }, 1800);

        if (typeof window.renderCart === 'function')     window.renderCart();
        if (typeof window.updateBadges === 'function')   window.updateBadges();
        if (typeof window.openCartDrawer === 'function') window.openCartDrawer();
      });
      }
    }

    colQvOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeQuickView() {
    const colQvOverlay = $('colQvOverlay');
    if (colQvOverlay) colQvOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ================================================================
     STICKY BAR
  ================================================================ */
  function updateStickyBar() {
    const bar = document.getElementById('colStickyBar');
    const countEl = document.getElementById('colSelectedCount');
    if (!bar) return;
    const count = selectedProducts.size;
    if (countEl) countEl.textContent = count;

    
    const _stickyCartBtn = document.getElementById('colStickyAddCart');
    if (_stickyCartBtn) {
      const _isFeaturedPage  = detectCollectionId() === 'bbw-features-products';
      const _plansAvailable  = (settings.plans_available || 'no').toLowerCase().trim() === 'yes';
      if (_isFeaturedPage && !_plansAvailable) {
        _stickyCartBtn.innerHTML = '<i class="fi fi-rr-shopping-bag"></i> Request Product';
      } else {
        _stickyCartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Add All to Cart';
      }
    }

    if (count > 0) { 
      bar.style.display = 'block';
      requestAnimationFrame(() => { requestAnimationFrame(() => { bar.classList.add('visible'); }); });
    } else {
      bar.classList.remove('visible');
      setTimeout(() => { if (selectedProducts.size === 0) bar.style.display = 'none'; }, 310);
    }
  }

  document.addEventListener('click', function(e) {
    if (e.target.closest('#colStickyAddCart')) {
      
      const _isFeaturedPage = detectCollectionId() === 'bbw-features-products';
      const _plansAvailable = (settings.plans_available || 'no').toLowerCase().trim() === 'yes';

      if (_isFeaturedPage && !_plansAvailable) {
        
        const firstKey = [...selectedProducts][0];
        if (firstKey) {
          const _underIdx = firstKey.indexOf('_');
          const _prodId   = _underIdx !== -1 ? firstKey.substring(0, _underIdx) : firstKey;
          if (typeof window.openProductRequestPopup === 'function') {
            window.openProductRequestPopup(_prodId);
          }
        }
        selectedProducts.clear();
        updateStickyBar();
        $$('.col-card__select input').forEach(chk => { chk.checked = false; });
        return;
      }

      selectedProducts.forEach(key => {
        const underscoreIdx = key.indexOf('_');
        let prodId, colorName;
        if (underscoreIdx !== -1) { prodId = key.substring(0, underscoreIdx); colorName = key.substring(underscoreIdx + 1); }
        else { prodId = key; colorName = null; }
        const prod = allProducts.find(p => p.id === prodId);
        if (!prod) return;
        const color = colorName ? (prod.colors || []).find(c => c.name === colorName) : null;
        addProductToCartWithColor(prod, color, null);
      });
      selectedProducts.clear();
      updateStickyBar();
      $$('.col-card__select input').forEach(chk => { chk.checked = false; });
    }

    if (e.target.closest('#colStickyBarClear')) {
      selectedProducts.clear();
      updateStickyBar();
      $$('.col-card__select input').forEach(chk => { chk.checked = false; });
    }

    if (e.target.closest('#colCompareBtn')) {
      openCompareModal();
    }
  });

  /* ================================================================
     COMPARE MODAL
  ================================================================ */
  function openCompareModal() {
    const colCompareOverlay = $('colCompareOverlay');
    const colCompareBody    = $('colCompareBody');
    if (!colCompareOverlay || !colCompareBody) return;

    const prodMap = new Map();
    selectedProducts.forEach(key => {
      const underscoreIdx = key.indexOf('_');
      const prodId = underscoreIdx !== -1 ? key.substring(0, underscoreIdx) : key;
      if (!prodMap.has(prodId)) {
        const prod = allProducts.find(p => p.id === prodId);
        if (prod) prodMap.set(prodId, prod);
      }
    });

    const prods = [...prodMap.values()];
    if (prods.length < 2) { showCompareToast('Please select at least 2 products to compare.'); return; }

    const fields = [
      { key: 'image',    label: 'Photo',    render: p => '<img class="col-compare-img" src="' + upgradeShopifyImageUrl(p.image, 200) + '" alt="' + p.title + '">' },
      { key: 'title',    label: 'Name',     render: p => '<strong>' + p.title + '</strong>' },
      { key: 'price',    label: 'Price',    render: p => '<span style="font-family:var(--font-display);font-size:16px;color:var(--col-accent)">$' + p.price.toFixed(2) + '</span>' },
      { key: 'rating',   label: 'Rating',   render: p => (p.rating || 'N/A') + (p.rating ? ' <i class="fas fa-star" style="color:#c4973a"></i>' : '') + ' (' + (p.reviews_count || 0) + ')' },
      { key: 'discount', label: 'Discount', render: p => { const d = getDiscount(p); return d > 0 ? d + '% off' : '—'; } },
      { key: 'sizes',    label: 'Sizes',    render: p => (p.sizes || []).join(', ') || '—' },
      { key: 'colors',   label: 'Colors',   render: p => (p.colors || []).slice(0,5).map(c => c.name).join(', ') || '—' },
      { key: 'cart',     label: 'Action',   render: p => '<button class="col-compare-add" data-id="' + p.id + '">Add to Cart</button>' }
    ];

    let html = '<table class="col-compare-table"><thead><tr><th>Feature</th>' + prods.map(p => '<th>' + p.title.slice(0,20) + (p.title.length > 20 ? '…' : '') + '</th>').join('') + '</tr></thead><tbody>';
    fields.forEach(field => {
      html += '<tr><th>' + field.label + '</th>' + prods.map(p => '<td>' + field.render(p) + '</td>').join('') + '</tr>';
    });
    html += '</tbody></table>';

    colCompareBody.innerHTML = html;
    colCompareBody.querySelectorAll('.col-compare-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const prod = allProducts.find(p => p.id === btn.dataset.id);
        if (prod) addProductToCartWithColor(prod, null, btn);
      });
    });

    colCompareOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeCompareModal() {
    const colCompareOverlay = $('colCompareOverlay');
    if (colCompareOverlay) colCompareOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ================================================================
     EVENT DELEGATION — Quick View & Compare close
  ================================================================ */
  document.addEventListener('click', function(e) {
    if (e.target.id === 'colQvClose' || e.target.closest('#colQvClose'))       { closeQuickView();    return; }
    if (e.target.id === 'colQvOverlay')                                         { closeQuickView();    return; }
    if (e.target.id === 'colCompareClose' || e.target.closest('#colCompareClose')) { closeCompareModal(); return; }
    if (e.target.id === 'colCompareOverlay')                                    { closeCompareModal(); return; }
  });

  
  /* ================================================================
     EXIT INTENT POPUP
  ================================================================ */
  (function initExitIntent() {
    const SHOWN_KEY = 'cf_exit_shown';
    if (localStorage.getItem(SHOWN_KEY)) return;
    let triggered = false;

    function showExitPopup() {
      if (triggered) return;
      triggered = true;
      localStorage.setItem(SHOWN_KEY, '1');

      const promos = (settings.promos || []);
      if (promos.length) {
        const best = promos.reduce((b, p) => p.percent > (b.percent || 0) ? p : b, {});
        const codeEl   = document.getElementById('colExitCodeSpan');
        const codeBold = document.getElementById('colExitPromoCode');
        const pctEl    = document.getElementById('colExitPromoPct');
        const ctaPct   = document.getElementById('colExitCtaPct');
        if (codeEl)   codeEl.textContent   = best.code;
        if (codeBold) codeBold.textContent = best.code;
        if (pctEl)    pctEl.textContent    = best.percent;
        if (ctaPct)   ctaPct.textContent   = best.percent;
      }

      if (colExitOverlay) colExitOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeExitPopup() {
      if (colExitOverlay) colExitOverlay.style.display = 'none';
      document.body.style.overflow = '';
    }

    document.addEventListener('mouseleave', e => { if (e.clientY <= 0) showExitPopup(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) showExitPopup(); });

    if (colExitClose) colExitClose.addEventListener('click', closeExitPopup);
    if (colExitSkip)  colExitSkip.addEventListener('click', closeExitPopup);
    if (colExitOverlay) colExitOverlay.addEventListener('click', e => { if (e.target === colExitOverlay) closeExitPopup(); });

    if (colExitCopy) {
      colExitCopy.addEventListener('click', () => {
        const codeEl = document.getElementById('colExitCodeSpan');
        navigator.clipboard.writeText(codeEl ? codeEl.textContent : '').catch(() => {});
        colExitCopy.textContent = 'Copied!';
        setTimeout(() => { colExitCopy.textContent = 'Copy'; }, 2000);
      });
    }

    if (colExitCta) {
      colExitCta.addEventListener('click', () => { closeExitPopup(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
  })();

  /* ================================================================
     GET PRODUCT URL
  ================================================================ */
 function getProductUrl(id) {
  const pool = window.__allProducts || [];
  const idx = pool.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return '#';
  return '/products/product' + (idx + 1) + '.html';
}

  /* ================================================================
     PAGINATION
  ================================================================ */
  function renderPagination() {
    if (!colPagination) return;
    colPagination.innerHTML = '';
    const totalEntries = buildVariantEntries(filtered).length;
    const totalPages   = Math.ceil(totalEntries / pageSize);
    if (totalPages <= 1) return;

    const maxVisible = window.innerWidth <= 768 ? 5 : 7;

    const prev = makePagBtn('←', currentPage === 1);
    prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); renderPagination(); } });
    colPagination.appendChild(prev);

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end   = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      const b = makePagBtn('1'); b.addEventListener('click', () => goPage(1)); colPagination.appendChild(b);
      if (start > 2) { const e = document.createElement('span'); e.className = 'col-page-ellipsis'; e.textContent = '…'; colPagination.appendChild(e); }
    }

    for (let i = start; i <= end; i++) {
      const btn = makePagBtn(String(i));
      if (i === currentPage) btn.classList.add('active');
      btn.addEventListener('click', (pg => () => goPage(pg))(i));
      colPagination.appendChild(btn);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) { const e = document.createElement('span'); e.className = 'col-page-ellipsis'; e.textContent = '…'; colPagination.appendChild(e); }
      const b = makePagBtn(String(totalPages)); b.addEventListener('click', () => goPage(totalPages)); colPagination.appendChild(b);
    }

    const next = makePagBtn('→', currentPage === totalPages);
    next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderPage(); renderPagination(); } });
    colPagination.appendChild(next);
  }

  function makePagBtn(label, disabled) {
    const btn = document.createElement('button');
    btn.className = 'col-page-btn'; btn.textContent = label;
    if (disabled) btn.disabled = true;
    return btn;
  }

  function goPage(page) { currentPage = page; renderPage(); renderPagination(); }

  /* ================================================================
     ACTIVE FILTERS UI
  ================================================================ */
  function updateActiveFiltersUI() {
    if (!colActivePills) return;
    colActivePills.innerHTML = '';
    let count = 0;

    if (activeFilters.category !== 'all') {
      addPill(activeFilters.category, 'Category', () => {
        activeFilters.category = 'all';
        $$('.col-cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
        applyAll();
      }); count++;
    }

    if (colRangeMax && (activeFilters.priceMin > 0 || activeFilters.priceMax < parseInt(colRangeMax.max))) {
      addPill('$' + activeFilters.priceMin + ' – $' + activeFilters.priceMax, 'Price', () => {
        const max = parseInt(colRangeMax.max);
        activeFilters.priceMin = 0; activeFilters.priceMax = max;
        colRangeMin.value = 0; colRangeMax.value = max;
        colPriceInpMin.value = 0; colPriceInpMax.value = max;
        updateRangeFill(); applyAll();
      }); count++;
    }

    activeFilters.colors.forEach(base => {
      let displayLabel = base.charAt(0).toUpperCase() + base.slice(1);
      allProducts.some(prod => {
        if (!prod.colors) return false;
        return prod.colors.some(c => { if (getColorBase(c.name) === base) { displayLabel = c.name; return true; } return false; });
      });
      addPill(displayLabel, 'Color', () => {
        activeFilters.colors = activeFilters.colors.filter(x => x !== base);
        $$('.col-color-row').forEach(row => { if (row.dataset.colorBase === base) row.classList.remove('active'); });
        applyAll();
      }); count++;
    });

    activeFilters.sizes.forEach(s => {
      addPill(s, 'Size', () => {
        activeFilters.sizes = activeFilters.sizes.filter(x => x !== s);
        $$('.col-size-btn').forEach(btn => { if (btn.dataset.size === s) btn.classList.remove('active'); });
        applyAll();
      }); count++;
    });

    if (activeFilters.availability.length > 0) {
      addPill(activeFilters.availability.join(', '), 'Stock', () => {
        activeFilters.availability = []; $$('input[name="availability"]').forEach(cb => cb.checked = false); applyAll();
      }); count++;
    }

    if (activeFilters.rating > 0) {
      addPill(activeFilters.rating + '★+', 'Rating', () => {
        activeFilters.rating = 0; $$('.col-rating-opt').forEach(b => b.classList.toggle('active', b.dataset.rating === '0')); applyAll();
      }); count++;
    }

    if (activeFilters.discount !== null) {
      addPill(activeFilters.discount + '%+ off', 'Discount', () => {
        activeFilters.discount = null; $$('input[name="discount"]').forEach(cb => cb.checked = false); applyAll();
      }); count++;
    }

    if (colActiveFilters) colActiveFilters.style.display = count > 0 ? 'flex' : 'none';
    if (colFilterCount) { colFilterCount.textContent = count; colFilterCount.style.display = count > 0 ? 'inline-flex' : 'none'; }
  }

  function addPill(label, type, removeFn) {
    const pill = document.createElement('div');
    pill.className = 'col-pill';
    pill.innerHTML = '<span>' + type + ': ' + label + '</span><span class="col-pill__remove"><i class="fas fa-times"></i></span>';
    pill.querySelector('.col-pill__remove').addEventListener('click', removeFn);
    colActivePills.appendChild(pill);
  }

  /* ================================================================
     DRAWER
  ================================================================ */
  function openDrawer() {
    if (colDrawer) colDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    updateDrawerCount();
  }

  function closeDrawer() {
    if (colDrawer) colDrawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function updateDrawerCount() {
    const preview = buildVariantEntries(allProducts.filter(productMatchesFilters)).length;
    if (colDrawerCount) colDrawerCount.textContent = preview;
  }

  if (colFilterToggle)  colFilterToggle.addEventListener('click', openDrawer);
  if (colDrawerClose)   colDrawerClose.addEventListener('click', closeDrawer);
  if (colDrawerOverlay) colDrawerOverlay.addEventListener('click', closeDrawer);
  if (colDrawerApply)   colDrawerApply.addEventListener('click', () => { applyAll(); closeDrawer(); });
  if (colDrawerClear)   colDrawerClear.addEventListener('click', resetAllFilters);
  if (colClearAll)      colClearAll.addEventListener('click', resetAllFilters);
  if (colEmptyReset)    colEmptyReset.addEventListener('click', resetAllFilters);

  (function initSwipeClose() {
    const panel = document.querySelector('.col-drawer__panel');
    if (!panel) return;
    let startX = 0;
    panel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    panel.addEventListener('touchend', e => { if (e.changedTouches[0].clientX - startX < -60) closeDrawer(); }, { passive: true });
  })();

  function resetAllFilters() {
    const max = colRangeMax ? (parseInt(colRangeMax.max) || 150) : 150;
    activeFilters = { category: 'all', availability: [], priceMin: 0, priceMax: max, colors: [], sizes: [], rating: 0, discount: null };
    currentSort = 'default';
    if (colRangeMin) colRangeMin.value = 0;
    if (colRangeMax) colRangeMax.value = max;
    if (colPriceInpMin) colPriceInpMin.value = 0;
    if (colPriceInpMax) colPriceInpMax.value = max;
    updateRangeFill();
    $$('.col-cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
    $$('.col-color-row').forEach(row => row.classList.remove('active'));
    $$('.col-size-btn').forEach(btn => btn.classList.remove('active'));
    $$('.col-rating-opt').forEach(b => b.classList.toggle('active', b.dataset.rating === '0'));
    $$('input[name="availability"]').forEach(cb => cb.checked = false);
    $$('input[name="discount"]').forEach(cb => cb.checked = false);
    $$('.col-sort-item').forEach(s => s.classList.toggle('active', s.dataset.sort === 'default'));
    if (colSortLabel) colSortLabel.textContent = 'Sort by';
    if (colSortBtn)  colSortBtn.classList.remove('open');
    if (colSortMenu) colSortMenu.classList.remove('open');
    applyAll();
  }

  $$('.col-filter-block__head').forEach(head => {
    head.addEventListener('click', () => { head.closest('.col-filter-block').classList.toggle('collapsed'); });
  });

  $$('input[name="availability"]').forEach(cb => {
    cb.addEventListener('change', () => {
      activeFilters.availability = Array.from($$('input[name="availability"]:checked')).map(i => i.value);
      updateDrawerCount();
    });
  });

  $$('.col-rating-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.col-rating-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilters.rating = parseFloat(btn.dataset.rating);
      updateDrawerCount();
    });
  });

  /* ================================================================
     PRICE RANGE
  ================================================================ */
  function updateRangeFill() {
    if (!colRangeMin || !colRangeMax || !colRangeFill) return;
    const max = parseInt(colRangeMax.max) || 150;
    const minVal = parseInt(colRangeMin.value), maxVal = parseInt(colRangeMax.value);
    colRangeFill.style.left  = (minVal / max * 100) + '%';
    colRangeFill.style.right = ((1 - maxVal / max) * 100) + '%';
    if (colPriceDispMin) colPriceDispMin.textContent = '$' + minVal;
    if (colPriceDispMax) colPriceDispMax.textContent = '$' + maxVal;
  }

  if (colRangeMin) colRangeMin.addEventListener('input', () => {
    let val = parseInt(colRangeMin.value);
    if (val > parseInt(colRangeMax.value)) { colRangeMin.value = colRangeMax.value; val = parseInt(colRangeMax.value); }
    activeFilters.priceMin = val; if (colPriceInpMin) colPriceInpMin.value = val; updateRangeFill(); updateDrawerCount();
  });

  if (colRangeMax) colRangeMax.addEventListener('input', () => {
    let val = parseInt(colRangeMax.value);
    if (val < parseInt(colRangeMin.value)) { colRangeMax.value = colRangeMin.value; val = parseInt(colRangeMin.value); }
    activeFilters.priceMax = val; if (colPriceInpMax) colPriceInpMax.value = val; updateRangeFill(); updateDrawerCount();
  });

  if (colPriceInpMin) colPriceInpMin.addEventListener('input', () => {
    let val = parseInt(colPriceInpMin.value) || 0;
    val = Math.max(0, Math.min(val, parseInt(colRangeMax.value) || 150));
    colPriceInpMin.value = val; colRangeMin.value = val; activeFilters.priceMin = val; updateRangeFill(); updateDrawerCount();
  });

  if (colPriceInpMax) colPriceInpMax.addEventListener('input', () => {
    const maxTotal = parseInt(colRangeMax.max) || 150;
    let val = Math.min(maxTotal, Math.max(parseInt(colPriceInpMax.value) || maxTotal, parseInt(colRangeMin.value) || 0));
    colPriceInpMax.value = val; colRangeMax.value = val; activeFilters.priceMax = val; updateRangeFill(); updateDrawerCount();
  });

  /* ================================================================
     CATEGORY TABS
  ================================================================ */
  $$('.col-cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.col-cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilters.category = tab.dataset.cat;
      applyAll();
    });
  });

  /* ================================================================
     SORT
  ================================================================ */
  if (colSortBtn) colSortBtn.addEventListener('click', e => {
    e.stopPropagation(); colSortBtn.classList.toggle('open'); if (colSortMenu) colSortMenu.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    if (colSortBtn)  colSortBtn.classList.remove('open');
    if (colSortMenu) colSortMenu.classList.remove('open');
  });

  $$('.col-sort-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      $$('.col-sort-item').forEach(s => s.classList.remove('active'));
      item.classList.add('active'); currentSort = item.dataset.sort;
      const labels = { default:'Sort by', 'price-asc':'Price ↑', 'price-desc':'Price ↓', discount:'Discount', rating:'Top Rated', reviews:'Most Reviewed', 'name-asc':'A → Z' };
      if (colSortLabel) colSortLabel.textContent = labels[currentSort] || 'Sort by';
      if (colSortBtn)   colSortBtn.classList.remove('open');
      if (colSortMenu)  colSortMenu.classList.remove('open');
      applyAll();
    });
  });

  /* ================================================================
     VIEW TOGGLE
  ================================================================ */
  $$('.col-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.col-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); currentView = btn.dataset.view;
      if (colGrid) {
        colGrid.classList.toggle('grid-view', currentView === 'grid');
        colGrid.classList.toggle('list-view', currentView === 'list');
      }
    });
  });

  /* ================================================================
     WISHLIST HELPERS
  ================================================================ */
  function getWishlist() {
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); } catch(e) { return []; }
  }

  function updateWishlistIcon(btn, id) {
    const active = getWishlist().includes(id);
    btn.classList.toggle('active', active);
    btn.innerHTML = active ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
  }

  /* ================================================================
     ADD TO CART
  ================================================================ */
  function addProductToCartWithColor(prod, color, btn, forcedSize) {
    let cart = [];
    if (typeof window.__getCart === 'function') cart = window.__getCart();
    else { try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch(e) {} }

    let firstVariant = null;
    if (prod.variants && prod.variants.length > 0) {
      const colorName = color ? color.name : null;
      const sizeName  = forcedSize || null;
      firstVariant = prod.variants.find(v => {
        const colorMatch = !colorName || v.color === colorName;
        const sizeMatch  = !sizeName  || v.size  === sizeName;
        return colorMatch && sizeMatch && v.active !== false;
      });
      if (!firstVariant && colorName) firstVariant = prod.variants.find(v => v.color === colorName && v.active !== false);
      if (!firstVariant) firstVariant = prod.variants[0];
    }

    const rawImg = color ? getColorImage(prod, color.name) : prod.image;
    const item = {
      id:            prod.id,
      title:         prod.title,
      price:         firstVariant ? firstVariant.price : prod.price,
      compare_price: prod.compare_price,
      image:         upgradeShopifyImageUrl(rawImg || prod.image),
      color:         color ? color.name : (firstVariant ? firstVariant.color || null : null),
      size:          firstVariant ? (firstVariant.size || null) : null,
      quantity:      1,
      cj_product_id: prod.cj_id,
      cj_variant_id: firstVariant ? firstVariant.vid : null
    };

    const existing = cart.find(i => i.id === item.id && i.color === item.color && i.size === item.size);
    if (existing) existing.quantity++;
    else cart.push(item);

    if (typeof window.__setCart === 'function') window.__setCart(cart);
    localStorage.setItem('cart', JSON.stringify(cart));

    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Added!';
      btn.style.background = '#2e7d32';
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1800);
    }

    if (typeof window.renderCart === 'function')     window.renderCart();
    if (typeof window.updateBadges === 'function')   window.updateBadges();
    if (typeof window.openCartDrawer === 'function') window.openCartDrawer();
  }

  /* ================================================================
     WISHLIST TOGGLE
  ================================================================ */
  function toggleWishlistItem(prod, btn) {
    let wl = [];
    if (typeof window.__getWishlist === 'function') wl = window.__getWishlist();
    else wl = getWishlist();

    if (wl.includes(prod.id)) wl = wl.filter(x => x !== prod.id);
    else wl.push(prod.id);

    if (typeof window.__setWishlist === 'function') window.__setWishlist(wl);
    localStorage.setItem('wishlist', JSON.stringify(wl));

    document.querySelectorAll('.col-card__wishlist[data-id="' + prod.id + '"]').forEach(b => {
      updateWishlistIcon(b, prod.id);
    });

    if (typeof window.updateBadges === 'function')        window.updateBadges();
    if (typeof window.updateWishlistIcons === 'function') window.updateWishlistIcons();
    if (typeof window.renderWishlist === 'function')      window.renderWishlist();
  }

  window.__allProducts = allProducts;
  document.dispatchEvent(new CustomEvent('products:ready'));
  window.upgradeShopifyImageUrl = upgradeShopifyImageUrl;

})();


(function initVoteSection() {

  const STORAGE_KEY = 'bbw4life_votes';

  const DEFAULT_VOTES = {
    style: { 'Bodycon Dress': 42, 'Wide-Leg Pants': 31, 'Wrap Blouse': 58, 'Maxi Skirt': 29 },
    color: { 'Deep Burgundy': 55, 'Champagne Gold': 47, 'Blush Rose': 38, 'Midnight Black': 60 }
  };

  function loadUserVotes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_user') || '{}'); }
    catch (e) { return {}; }
  }

  function saveUserVote(group, val) {
    try {
      const uv = loadUserVotes();
      uv[group] = val;
      localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(uv));
    } catch (e) {}
  }

  function calcPercentages(groupVotes) {
    const total = Object.values(groupVotes).reduce((a, b) => a + b, 0);
    if (total === 0) return Object.fromEntries(Object.keys(groupVotes).map(k => [k, 0]));
    return Object.fromEntries(Object.entries(groupVotes).map(([k, v]) => [k, Math.round((v / total) * 100)]));
  }

  function renderGroup(groupName, votes, userVotes) {
    const opts      = document.querySelectorAll(`.bbw-vote__opt[data-group="${groupName}"]`);
    const groupData = votes[groupName] || {};

    opts.forEach(opt => {
      const val = opt.dataset.val;
      if (groupData[val] === undefined) groupData[val] = 0;
    });

    const pcts = calcPercentages(groupData);

    opts.forEach(opt => {
      const val   = opt.dataset.val;
      const pct   = pcts[val] || 0;
      const fill  = opt.querySelector('.bbw-vote__opt-fill');
      const pctEl = opt.querySelector('.bbw-vote__opt-pct');

      if (fill)  fill.style.width  = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';

      opt.classList.toggle('voted', userVotes[groupName] === val);
      opt.disabled = !!userVotes[groupName];

      if (userVotes[groupName]) {
        opt.style.cursor  = userVotes[groupName] === val ? 'default' : 'not-allowed';
        opt.style.opacity = userVotes[groupName] === val ? '1' : '0.55';
      }
    });
  }

  async function fetchVotesFromSheet() {
    try {
      const res  = await fetch('/.netlify/functions/save-personalized-product', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'get_votes' })
      });
      const data = await res.json();
      return data.success ? data.votes : null;
    } catch (e) { return null; }
  }

  function initVotes() {
    const voteSection = document.getElementById('bbwVoteSection');
    if (!voteSection) return;

    const userVotes = loadUserVotes();

    fetchVotesFromSheet().then(serverVotes => {
      const votes = (serverVotes && (Object.keys(serverVotes.style || {}).length || Object.keys(serverVotes.color || {}).length))
        ? serverVotes
        : DEFAULT_VOTES;

      renderGroup('style', votes, userVotes);
      renderGroup('color', votes, userVotes);

      voteSection.addEventListener('click', async function(e) {
        const opt = e.target.closest('.bbw-vote__opt');
        if (!opt || opt.disabled) return;

        const group   = opt.dataset.group;
        const val     = opt.dataset.val;
        const current = loadUserVotes();

        if (current[group]) return;

        document.querySelectorAll(`.bbw-vote__opt[data-group="${group}"]`).forEach(o => {
          o.disabled      = true;
          o.style.cursor  = 'not-allowed';
          o.style.opacity = '0.55';
        });
        opt.style.opacity = '1';
        opt.classList.add('voted');
        opt.style.transform = 'scale(0.97)';
        setTimeout(() => { opt.style.transform = ''; }, 180);

        saveUserVote(group, val);

        try {
          const res  = await fetch('/.netlify/functions/save-personalized-product', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'vote', group, val })
          });
          const data = await res.json();

          if (data.success && data.counts) {
            const updated       = { ...votes };
            updated[group]      = data.counts;
            renderGroup(group, updated, loadUserVotes());
          }
        } catch (err) {
          const updated  = { ...votes };
          if (!updated[group]) updated[group] = {};
          updated[group][val] = (updated[group][val] || 0) + 1;
          renderGroup(group, updated, loadUserVotes());
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVotes);
  } else {
    initVotes();
  }

})();


(function initComingSoon() {

  const CD_KEY      = 'bbw4life_cs_countdown_end';
  const DURATION_MS = 48 * 60 * 60 * 1000;

  function getOrCreateEndTime() {
    let end = parseInt(localStorage.getItem(CD_KEY) || '0');
    const now = Date.now();
    if (!end || end <= now) {
      end = now + DURATION_MS;
      localStorage.setItem(CD_KEY, String(end));
    }
    return end;
  }

  function updateCountdown() {
    const end  = getOrCreateEndTime();
    const diff = Math.max(0, end - Date.now());

    if (diff === 0) {
      localStorage.removeItem(CD_KEY);
    }

    const pad = n => String(n).padStart(2, '0');

    const daysEl    = document.getElementById('bbwCsDays');
    const hoursEl   = document.getElementById('bbwCsHours');
    const minutesEl = document.getElementById('bbwCsMinutes');
    const secondsEl = document.getElementById('bbwCsSeconds');

    if (!daysEl) return;

    daysEl.textContent    = pad(Math.floor(diff / (1000 * 60 * 60 * 24)));
    hoursEl.textContent   = pad(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    minutesEl.textContent = pad(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
    secondsEl.textContent = pad(Math.floor((diff % (1000 * 60)) / 1000));
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();

  function showWaitlistMsg(text, type) {
    const msgEl = document.getElementById('bbwWaitlistMsg');
    if (!msgEl) return;
    msgEl.textContent      = text;
    msgEl.style.display    = 'block';
    msgEl.style.color      = type === 'success' ? '#e8bc6a' : '#ff6b8a';
    msgEl.style.fontFamily = 'var(--font-body)';
    msgEl.style.fontSize   = '13px';
    msgEl.style.marginBottom = '8px';
  }

  function initWaitlist() {
    const form = document.getElementById('bbwWaitlistForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const emailInput = document.getElementById('bbwWaitlistEmail');
      const email      = emailInput ? emailInput.value.trim() : '';
      const btn        = form.querySelector('.bbw-cs__form-btn');

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showWaitlistMsg('Please enter a valid email address.', 'error');
        return;
      }

      if (btn) {
        btn.disabled  = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Subscribing…</span>';
      }

      try {
        const res  = await fetch('/.netlify/functions/save-personalized-product', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'waitlist', email })
        });
        const data = await res.json();

        if (data.success) {
          showWaitlistMsg("🎉 You're on the list! We'll notify you first.", 'success');
          form.reset();
        } else {
          throw new Error('Server error');
        }
      } catch (err) {
        showWaitlistMsg("🎉 You're on the list! We'll notify you first.", 'success');
        form.reset();
      } finally {
        if (btn) {
          btn.disabled  = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Notify Me</span>';
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaitlist);
  } else {
    initWaitlist();
  }

})();


(function initSuggestForm() {

  function initSuggest() {
    const form = document.getElementById('bbwSuggestForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const style = (document.getElementById('bbwSuggestStyle')?.value || '').trim();
      const color = (document.getElementById('bbwSuggestColor')?.value || '').trim();
      const note  = (document.getElementById('bbwSuggestNote')?.value  || '').trim();
      const btn   = document.getElementById('bbwSuggestBtn');
      const msg   = document.getElementById('bbwSuggestMsg');

      if (!style && !color) {
        if (msg) {
          msg.textContent   = 'Please fill in at least one field.';
          msg.style.display = 'block';
          msg.style.color   = '#ff6b8a';
        }
        return;
      }

      if (btn) {
        btn.disabled     = true;
        btn.innerHTML    = '<i class="fas fa-spinner fa-spin"></i> <span>Sending…</span>';
      }

      try {
        const res  = await fetch('/.netlify/functions/save-personalized-product', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            action:        'suggestion',
            suggest_style: style,
            suggest_color: color,
            suggest_note:  note
          })
        });
        const data = await res.json();

        if (data.success) {
          if (msg) {
            msg.textContent   = '💖 Thank you! Your suggestion has been received.';
            msg.style.display = 'block';
            msg.style.color   = '#e8bc6a';
          }
          form.reset();
        } else {
          throw new Error('error');
        }
      } catch (err) {
        if (msg) {
          msg.textContent   = '💖 Thank you! Your suggestion has been received.';
          msg.style.display = 'block';
          msg.style.color   = '#e8bc6a';
        }
        form.reset();
      } finally {
        if (btn) {
          btn.disabled  = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Send My Suggestion</span>';
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSuggest);
  } else {
    initSuggest();
  }

})();






(function () {
  var btn = document.getElementById('colMorphoBtn');
  if (!btn) return;

  btn.addEventListener('click', function (e) {
    e.preventDefault();

    // Si openStyleQuiz est déjà chargé, on l'appelle directement
    if (typeof window.openStyleQuiz === 'function') {
      window.openStyleQuiz();
      return;
    }

    // Sinon on attend qu'il soit disponible (bbw-quiz.js charge en async)
    var tries = 0;
    var poll = setInterval(function () {
      if (typeof window.openStyleQuiz === 'function') {
        clearInterval(poll);
        window.openStyleQuiz();
      } else if (++tries > 50) {
        clearInterval(poll);
      }
    }, 100);
  });
})();








(function initCartPage() {
  'use strict';

  
  if (!document.getElementById('cart-page-main')) return;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function waitReady(fn) {
    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      if (typeof window.__getCart === 'function' && window.__allProducts && window.__allProducts.length > 0) {
        clearInterval(poll);
        fn();
      } else if (tries > 120) {
        clearInterval(poll);
        fn();
      }
    }, 100);
  }

  /* ════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════ */
  function getCart() {
    if (typeof window.__getCart === 'function') return window.__getCart();
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { return []; }
  }

  function setCart(c) {
    if (typeof window.__setCart === 'function') window.__setCart(c);
    localStorage.setItem('cart', JSON.stringify(c));
  }

  function saveCartAndSync() {
    if (typeof window.saveCart === 'function') window.saveCart();
    else localStorage.setItem('cart', JSON.stringify(getCart()));
    if (typeof window.updateCartQuantityInSheet === 'function') window.updateCartQuantityInSheet();
    if (typeof window.updateBadges === 'function') window.updateBadges();
  }

  function showToast(msg) {
    const toast = document.getElementById('cp-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 3500);
  }

  function normalizeVal(v) {
    if (v === undefined || v === '' || v === 'null' || v === 'undefined') return null;
    return v;
  }

  function getProductUrl(id) {
    if (typeof window.getProductUrl === 'function') return window.getProductUrl(id);
    const prods = window.__allProducts || [];
    const idx = prods.findIndex(function (p) { return String(p.id) === String(id); });
    if (idx === -1) return '/collections/bbw4life-all-product.html';
    return '/products/product' + (idx + 1) + '.html';
  }

  function upgradeImg(url, size) {
    if (typeof upgradeShopifyImageUrl === 'function') return upgradeShopifyImageUrl(url, size || 200);
    return url;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ════════════════════════════════════════════════════
     RENDER ITEMS
  ════════════════════════════════════════════════════ */
  function renderPageCart() {
    const cart = getCart();
    const container = document.getElementById('cp-cart-items-container');
    const layout    = document.getElementById('cp-layout');
    const emptyEl   = document.getElementById('cp-empty');

    if (!container) return;

    
    const skeleton = document.getElementById('cp-skeleton-1');
    if (skeleton) skeleton.remove();

    container.innerHTML = '';

    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const plansOn  = (settings.plans_available || 'no').toLowerCase().trim() === 'yes';

    const BBW_FEATURED_IDS = [
      'Pdg-Francenel-product69','Pdg-Francenel-product70','Pdg-Francenel-product71',
      'Pdg-Francenel-product72','Pdg-Francenel-product73','Pdg-Francenel-product74',
      'Pdg-Francenel-product75'
    ];

    if (cart.length === 0) {
      if (layout)  layout.style.display  = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      hideDynamicSections();
      updateSummary();
      updateHeader();
      return;
    }

    if (layout)  layout.style.display  = '';
    if (emptyEl) emptyEl.style.display = 'none';
    showDynamicSections();

    
    const cpUpsellEl    = document.getElementById('cp-upsell-section');
    const upsellCfgCheck = settings.cart_page_upsell || {};
    const hasUpsellConfig = Array.isArray(upsellCfgCheck.items) && upsellCfgCheck.items.length > 0;
    if (cpUpsellEl) cpUpsellEl.style.display = hasUpsellConfig ? '' : 'none';

    cart.forEach(function (item) {
      const cartItem = document.createElement('div');
      cartItem.className   = 'cp-cart-item';
      cartItem.dataset.id  = item.id;
      if (item.size  != null) cartItem.dataset.size  = item.size;
      if (item.color != null) cartItem.dataset.color = item.color;

      const isFeaturedWarning = BBW_FEATURED_IDS.includes(item.id) && !plansOn;
      const lineTotal = (parseFloat(item.price) * item.quantity).toFixed(2);

      const freeTag = item.isFreePromo
        ? '<span class="free-badge"><i class="fas fa-gift"></i> Free $0.00</span>'
        : '';

      const warningDot = isFeaturedWarning
        ? '<div class="cart-item-warning-dot"><span class="cart-item-warning-tooltip"><i class="fas fa-exclamation-triangle"></i> Product not yet validated. Please submit a request.</span></div>'
        : '';

      const requestBtn = isFeaturedWarning
        ? '<button class="cart-item-request-btn" data-product-id="' + item.id + '"><i class="fi fi-rr-shopping-bag"></i> Request this product</button>'
        : '';

      cartItem.innerHTML = [
        '<div class="cp-item-img-wrap">',
        '  <img src="' + item.image + '" alt="' + item.title + '" loading="lazy">',
        '  ' + warningDot,
        '</div>',
        '<div class="cp-item-meta">',
        '  <h4>' + item.title + ' ' + freeTag + '</h4>',
        item.size  ? '<p class="item-variant"><i class="fi fi-rr-layers"></i> Size: '  + item.size  + '</p>' : '',
        item.color ? '<p class="item-variant"><i class="fi fi-rr-palette"></i> Color: ' + item.color + '</p>' : '',
        requestBtn,
        '  <div class="cp-qty-row">',
        '    <div class="cp-qty-ctrl">',
        '      <button class="cp-qty-minus">&#8722;</button>',
        '      <span>' + item.quantity + '</span>',
        '      <button class="cp-qty-plus">+</button>',
        '    </div>',
        '    <button class="cp-remove-item"><i class="fi fi-sr-trash"></i></button>',
        '  </div>',
        '</div>',
        '<div class="cp-item-price-col">$' + parseFloat(item.price).toFixed(2) + '</div>',
        '<div class="cp-item-line-total">$' + lineTotal + '</div>'
      ].join('');

      
      const img   = cartItem.querySelector('img');
      const title = cartItem.querySelector('h4');
      const url   = getProductUrl(item.id);
      if (img)   { img.style.cursor = 'pointer';   img.addEventListener('click', function () { window.location.href = url; }); }
      if (title) { title.style.cursor = 'pointer'; title.addEventListener('click', function () { window.location.href = url; }); }

      
      const rBtn = cartItem.querySelector('.cart-item-request-btn');
      if (rBtn) {
        rBtn.addEventListener('click', function () {
          const pid = rBtn.dataset.productId;
          if (typeof window.openProductRequestPopup === 'function') window.openProductRequestPopup(pid);
          else if (typeof window.openPlanPopup === 'function') window.openPlanPopup(pid);
        });
      }

      container.appendChild(cartItem);
    });

    
    container.querySelectorAll('.cp-qty-plus, .cp-qty-minus').forEach(function (btn) {
      btn.addEventListener('click', handleQty);
    });
    container.querySelectorAll('.cp-remove-item').forEach(function (btn) {
      btn.addEventListener('click', handleRemove);
    });

   updateSummary();
    updateHeader();
    updateProgressBar();
    updatePromoMessage();

    if (typeof window.convertPricesForCountry === 'function') {
      var _activeCountry = localStorage.getItem('bbw_country');
      if (_activeCountry) window.convertPricesForCountry(_activeCountry);
    }
  }

  
  function handleQty(e) {
    const btn  = e.target.closest('.cp-qty-plus, .cp-qty-minus');
    const item = btn ? btn.closest('.cp-cart-item') : null;
    if (!item) return;

    const id    = item.dataset.id;
    const size  = normalizeVal(item.dataset.size);
    const color = normalizeVal(item.dataset.color);
    let cart = getCart();
    const entry = cart.find(function (i) {
      return i.id === id && normalizeVal(i.size) === size && normalizeVal(i.color) === color;
    });
    if (!entry) return;

    if (btn.classList.contains('cp-qty-plus')) {
      entry.quantity++;
    } else if (btn.classList.contains('cp-qty-minus')) {
      entry.quantity--;
      if (entry.quantity <= 0) {
        cart = cart.filter(function (i) {
          return !(i.id === id && normalizeVal(i.size) === size && normalizeVal(i.color) === color);
        });
      }
    }

    setCart(cart);
    saveCartAndSync();
    renderPageCart();
  }

  
  function handleRemove(e) {
    const item  = e.target.closest('.cp-cart-item');
    if (!item) return;
    const id    = item.dataset.id;
    const size  = normalizeVal(item.dataset.size);
    const color = normalizeVal(item.dataset.color);
    let cart = getCart();
    cart = cart.filter(function (i) {
      return !(i.id === id && normalizeVal(i.size) === size && normalizeVal(i.color) === color);
    });
    setCart(cart);
    saveCartAndSync();
    renderPageCart();
  }

  /* ════════════════════════════════════════════════════
     ORDER SUMMARY
  ════════════════════════════════════════════════════ */
  function updateSummary() {
    const cart     = getCart();
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const threshold = parseFloat(cd.free_shipping_threshold) || 350;

    const subtotal = cart.reduce(function (sum, i) {
      return sum + parseFloat(i.price) * i.quantity;
    }, 0);
    const totalQty = cart.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    const savings  = cart.reduce(function (sum, i) {
      if (i.compare_price && parseFloat(i.compare_price) > parseFloat(i.price)) {
        return sum + (parseFloat(i.compare_price) - parseFloat(i.price)) * i.quantity;
      }
      return sum;
    }, 0);
    const points = Math.floor(subtotal);
    const shippingFree = subtotal >= threshold;

    const shippingEl = document.getElementById('cp-shipping-val');
    if (shippingEl) {
      shippingEl.textContent = shippingFree ? 'FREE' : 'Calculated at checkout';
      shippingEl.className   = shippingFree ? 'cp-free-tag' : '';
    }

    setText('cp-subtotal-val', '$' + subtotal.toFixed(2));
    setText('cp-tax-val',      '$0.00');
    setText('cp-total-val',    '$' + subtotal.toFixed(2));
    setText('cp-qty-label',    totalQty + (totalQty === 1 ? ' item' : ' items'));
    setText('cp-loyalty-points', points.toLocaleString());

    const savingsLine = document.getElementById('cp-savings-line');
    const savingsVal  = document.getElementById('cp-savings-val');
    if (savingsLine) {
      savingsLine.style.display = savings > 0 ? '' : 'none';
      if (savingsVal && savings > 0) savingsVal.textContent = '-$' + savings.toFixed(2);
    }

    setText('cp-sticky-qty',   totalQty + (totalQty === 1 ? ' item' : ' items'));
    setText('cp-sticky-total', '$' + subtotal.toFixed(2));
  }

  function updateHeader() {
    const cart = getCart();
    const qty  = cart.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    setText('cp-item-count', qty + (qty === 1 ? ' item' : ' items'));
  }

  /* ════════════════════════════════════════════════════
     PROGRESS BAR
  ════════════════════════════════════════════════════ */
  function updateProgressBar() {
    const products  = window.__allProducts || [];
    const settings  = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd        = settings.cart_drawer || {};
    const threshold = parseFloat(cd.free_shipping_threshold) || 350;
    const showBar   = (cd.show_free_shipping_bar || 'Yes').toLowerCase() === 'yes';
    const bar       = document.getElementById('cp-progress-container');
    if (!bar) return;

    const cart = getCart();
    if (!showBar || cart.length === 0) { bar.style.display = 'none'; return; }

    const subtotal  = cart.reduce(function (sum, i) { return sum + parseFloat(i.price) * i.quantity; }, 0);
    const remaining = Math.max(0, threshold - subtotal);
    const pct       = Math.min(100, (subtotal / threshold) * 100);

    const msgEl   = document.getElementById('cp-progress-message');
    const fillEl  = document.getElementById('cp-progress-fill');
    const truckEl = document.getElementById('cp-progress-truck');

    if (subtotal >= threshold) {
      if (msgEl)  { msgEl.textContent = cd.progress_success_message || 'You have free shipping!'; msgEl.style.color = '#22a06b'; }
      if (fillEl) fillEl.style.width = '100%';
    } else {
      const rawMsg = cd.progress_message || 'Add ${remaining} more for FREE shipping!';
      const msg = rawMsg.replace('${remaining}', '$' + remaining.toFixed(2));
      if (msgEl)  { msgEl.textContent = msg; msgEl.style.color = ''; }
      if (fillEl) fillEl.style.width = pct + '%';
    }

    if (truckEl && fillEl) {
      const trackEl = fillEl.parentElement;
      if (trackEl) {
        const trackW = trackEl.offsetWidth;
        const truckW = truckEl.offsetWidth || 26;
        const pos    = Math.max(0, Math.min((pct / 100) * trackW - truckW / 2, trackW - truckW));
        truckEl.style.left  = pos + 'px';
        truckEl.style.right = 'auto';
      }
    }

    bar.style.display = '';
  }

  /* ════════════════════════════════════════════════════
     PROMO MESSAGE
  ════════════════════════════════════════════════════ */
  function updatePromoMessage() {
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const showPromo = (cd.show_promo_message || 'Yes').toLowerCase() === 'yes';
    const wrap      = document.getElementById('cp-promo-message-wrap');
    const span      = document.getElementById('cp-promo-text-span');
    if (!wrap || !span) return;

    const cart = getCart();
    if (!showPromo || cart.length === 0) { wrap.style.display = 'none'; return; }

    const buyQty = parseInt(cd.promo_buy_quantity) || 3;
    const getQty = parseInt(cd.promo_get_quantity) || 1;
    const count  = cart.reduce(function (s, i) { return s + i.quantity; }, 0);

    let msg = '', cls = '';
    if (count >= buyQty) {
      msg = (cd.promo_complete_message || 'You get {get} FREE item(s)!').replace('{get}', '<strong class="promo-number">' + getQty + '</strong>');
      cls = 'complete';
    } else if (count > 0) {
      const rem = buyQty - count;
      msg = (cd.promo_progress_message || 'Add {remaining} more, get {get} FREE!')
        .replace('{remaining}', '<strong class="promo-number">' + rem + '</strong>')
        .replace('{get}', '<strong class="promo-number">' + getQty + '</strong>');
      cls = 'progress';
    } else {
      msg = (cd.promo_initial_message || 'Buy {buy} items, get {get} FREE!')
        .replace('{buy}', '<strong class="promo-number">' + buyQty + '</strong>')
        .replace('{get}', '<strong class="promo-number">' + getQty + '</strong>');
      cls = 'initial';
    }

    span.innerHTML  = msg;
    span.className  = 'promo-text ' + cls;
    wrap.style.display = '';
  }

  /* ════════════════════════════════════════════════════
     COUNTDOWN
  ════════════════════════════════════════════════════ */
  function initCountdown() {
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const el       = document.getElementById('cp-countdown');
    if (!el) return;

    const textEl = document.getElementById('cp-countdown-text');
    const timeEl = document.getElementById('cp-countdown-time');
    if (textEl) textEl.textContent = cd.countdown_text || 'Offer expires in:';

    const totalSeconds = (parseInt(cd.countdown_minutes) || 10) * 60;
    const suffix       = cd.countdown_suffix || '';
    const STORAGE_KEY  = 'drawerCountdownEnd';

    const cart = getCart();
    if (cart.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'flex';

    const savedEnd = localStorage.getItem(STORAGE_KEY);
    const now      = Date.now();
    let endTime;
    if (savedEnd && parseInt(savedEnd) > now) {
      endTime = parseInt(savedEnd);
    } else {
      endTime = now + totalSeconds * 1000;
      localStorage.setItem(STORAGE_KEY, endTime);
    }

    setInterval(function () {
      const rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      if (rem === 0) {
        endTime = Date.now() + totalSeconds * 1000;
        localStorage.setItem(STORAGE_KEY, endTime);
      }
      if (timeEl) {
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s + (suffix ? ' ' + suffix : '');
      }
    }, 1000);
  }

  /* ════════════════════════════════════════════════════
     PAUL BANNER
  ════════════════════════════════════════════════════ */
  function initPageBanner() {
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const slides   = cd.banner_slides || [];
    const duration = cd.banner_slide_duration_ms || 5000;
    const videoUrl = cd.banner_video_url || '';
    const banner   = document.getElementById('cp-paul-banner');
    if (!banner) return;

    if (!videoUrl && !slides.length) return;

    // ── MODE VIDÉO ──
    if (videoUrl) {
      banner.classList.add('paul-banner--video-mode');

      const video = document.createElement('video');
      video.autoplay    = true;
      video.muted       = true;
      video.loop        = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.className   = 'paul-banner-video';
      if (slides.length) video.poster = slides[0].image;

      const source = document.createElement('source');
      source.src  = videoUrl;
      source.type = 'video/mp4';
      video.appendChild(source);
      banner.appendChild(video);

      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(function () {
          document.addEventListener('click', function tryPlay() {
            video.play().catch(function () {});
            document.removeEventListener('click', tryPlay);
          }, { once: true });
        });
      }

      // ── Textes rotatifs + dots par-dessus ──
      if (slides.length) {
        const textsHTML = slides.map(function (s, i) {
          return '<div class="paul-banner-video-text' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' + s.text + '</div>';
        }).join('');

        const dotsHTML = slides.map(function (s, i) {
          return '<span class="paul-banner-indicator' + (i === 0 ? ' active' : '') + '" data-slide="' + i + '"></span>';
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'paul-banner-video-overlay';
        overlay.innerHTML =
          '<div class="paul-banner-video-texts">' + textsHTML + '</div>' +
          '<div class="paul-banner-indicators dots">' + dotsHTML + '</div>';
        banner.appendChild(overlay);

        let current = 0;
        function goTo(idx) {
          overlay.querySelectorAll('.paul-banner-video-text').forEach(function (t, i) { t.classList.toggle('active', i === idx); });
          overlay.querySelectorAll('.paul-banner-indicator').forEach(function (d, i) { d.classList.toggle('active', i === idx); });
          current = idx;
        }

        overlay.querySelectorAll('.paul-banner-indicator').forEach(function (dot) {
          dot.addEventListener('click', function () { goTo(parseInt(dot.dataset.slide)); });
        });

        setInterval(function () {
          goTo((current + 1) % slides.length);
        }, duration);
      }

      return;
    }

    // ── MODE IMAGES ──
    const slidesHTML = slides.map(function (s, i) {
      return '<div class="paul-banner-slide' + (i === 0 ? ' active' : '') + '">' +
        '<img src="' + (typeof upgradeShopifyImageUrl === 'function' ? upgradeShopifyImageUrl(s.image) : s.image) + '" alt="' + s.text + '" class="paul-banner-image" loading="lazy">' +
        '<h2 class="paul-banner-title">' + s.text + '</h2>' +
        '</div>';
    }).join('');

    const dotsHTML = slides.map(function (s, i) {
      return '<span class="paul-banner-indicator' + (i === 0 ? ' active' : '') + '" data-slide="' + i + '"></span>';
    }).join('');

    banner.innerHTML =
      '<div class="paul-banner-slider-container">' + slidesHTML + '</div>' +
      '<div class="paul-banner-indicators dots">' + dotsHTML + '</div>';

    let timer;
    function goTo(idx) {
      banner.querySelectorAll('.paul-banner-slide').forEach(function (s, i) { s.classList.toggle('active', i === idx); });
      banner.querySelectorAll('.paul-banner-indicator').forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    }

    banner.querySelectorAll('.paul-banner-indicator').forEach(function (dot) {
      dot.addEventListener('click', function () {
        clearInterval(timer);
        goTo(parseInt(dot.dataset.slide));
        timer = setInterval(function () {
          const active = Array.from(banner.querySelectorAll('.paul-banner-slide')).findIndex(function (s) { return s.classList.contains('active'); });
          goTo((active + 1) % slides.length);
        }, duration);
      });
    });

    timer = setInterval(function () {
      const active = Array.from(banner.querySelectorAll('.paul-banner-slide')).findIndex(function (s) { return s.classList.contains('active'); });
      goTo((active + 1) % slides.length);
    }, duration);
  }

  /* ════════════════════════════════════════════════════
     UPSELL
     ── Lit settings.cart_page_upsell (nouveau setting dédié)
     ── Visible uniquement si cart non vide ET config présente
  ════════════════════════════════════════════════════ */
  function initPageUpsell() {
    const container  = document.getElementById('cp-upsell-items-container');
    const addBtn     = document.getElementById('cp-upsell-add-btn');
    const totalEl    = document.getElementById('cp-upsell-total-display');
    const badgeEl    = document.getElementById('cp-upsell-badge');
    const cpUpsell   = document.getElementById('cp-upsell-section');
    if (!container || !addBtn) return;

    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(function (p) { return p.type === 'settings'; }) || {};

    
    const upsellCfg   = settings.cart_page_upsell || {};
    const discountPct = parseFloat(upsellCfg.discount_percent) || 0;
    const itemsCfg    = upsellCfg.items || [];

    
    if (!itemsCfg.length) {
      if (cpUpsell) cpUpsell.style.display = 'none';
      return;
    }

    
    const cart = getCart();
    if (cart.length === 0) {
      if (cpUpsell) cpUpsell.style.display = 'none';
      return;
    }

    
    if (cpUpsell) cpUpsell.style.display = '';

    if (badgeEl && discountPct > 0) badgeEl.textContent = 'Save ' + discountPct + '%';
    container.innerHTML = '';
    const upsellProducts = itemsCfg
      .map(function (cfg) { return allProducts.find(function (p) { return p.id === cfg.product_id; }); })
      .filter(Boolean);

    if (!upsellProducts.length) {
      if (cpUpsell) cpUpsell.style.display = 'none';
      return;
    }

    upsellProducts.forEach(function (prod) {
      const firstVariant    = prod.variants && prod.variants.length ? prod.variants[0] : null;
      const originalPrice   = firstVariant ? parseFloat(firstVariant.price) : parseFloat(prod.price);
      const comparePrice    = parseFloat(prod.compare_price) || originalPrice;
      const discountedPrice = parseFloat((originalPrice * (1 - discountPct / 100)).toFixed(2));

      const item = document.createElement('div');
      item.className          = 'p2-upsell-item';
      item.dataset.id         = prod.id;
      item.dataset.original   = originalPrice;
      item.dataset.discounted = discountedPrice;
      item.dataset.compare    = comparePrice;

      item.innerHTML =
        '<div class="p2-upsell-check-wrap">' +
          '<input type="checkbox" id="cp-check-upsell-' + prod.id + '" class="p2-upsell-check" data-id="' + prod.id + '">' +
          '<label for="cp-check-upsell-' + prod.id + '" class="p2-upsell-check-label"></label>' +
        '</div>' +
        '<div class="p2-upsell-img-wrap">' +
          '<img src="' + upgradeImg(prod.image, 120) + '" alt="' + prod.title + '" loading="lazy">' +
        '</div>' +
        '<div class="p2-upsell-info">' +
          '<strong>' + prod.title + '</strong>' +
          '<span>' + (prod.description ? prod.description.substring(0, 55) + '...' : '') + '</span>' +
        '</div>' +
        '<div class="p2-upsell-price-col">' +
          '<span class="p2-upsell-old">$' + comparePrice.toFixed(2) + '</span>' +
          '<span class="p2-upsell-new">+$' + discountedPrice.toFixed(2) + '</span>' +
        '</div>';

      container.appendChild(item);
      item.querySelector('.p2-upsell-check').addEventListener('change', updateUpsellTotal);
    });

    function updateUpsellTotal() {
      let total = 0, anyChecked = false;
      container.querySelectorAll('.p2-upsell-check').forEach(function (cb) {
        if (cb.checked) {
          anyChecked = true;
          const itemEl = cb.closest('.p2-upsell-item');
          total += parseFloat(itemEl.dataset.discounted || 0);
        }
      });
      if (totalEl) totalEl.textContent = anyChecked ? '+ $' + total.toFixed(2) : '+ $0.00';
      addBtn.disabled = !anyChecked;
    }

    addBtn.addEventListener('click', function () {
      let added = 0;
      container.querySelectorAll('.p2-upsell-check').forEach(function (cb) {
        if (!cb.checked) return;
        const prodId = cb.dataset.id;
        const prod   = allProducts.find(function (p) { return p.id === prodId; });
        if (!prod) return;

        const firstVariant = prod.variants && prod.variants.length ? prod.variants[0] : null;
        const itemEl       = cb.closest('.p2-upsell-item');
        const price        = parseFloat(itemEl.dataset.discounted || prod.price);
        const comparePrice = parseFloat(itemEl.dataset.compare   || prod.compare_price);
        const color        = firstVariant ? (firstVariant.color || null) : null;
        const size         = firstVariant ? (firstVariant.size  || null) : null;
        const cjVariantId  = firstVariant ? firstVariant.vid : null;
        const colorObj     = (color && prod.colors) ? prod.colors.find(function (c) { return c.name === color; }) : null;
        const image        = upgradeImg(colorObj ? (colorObj.image || prod.image) : prod.image);

        let cart = getCart();
        const existing = cart.find(function (i) { return i.id === prodId && i.color === color && i.size === size; });
        if (existing) { existing.quantity += 1; }
        else {
          cart.push({
            id:            prodId,
            title:         prod.title,
            price:         price,
            compare_price: comparePrice,
            image:         image,
            size:          size  || null,
            color:         color || null,
            quantity:      1,
            fromUpsell:    true,
            upsellDiscount: discountPct,
            cj_product_id: prod.cj_id,
            cj_variant_id: cjVariantId
          });
        }
        setCart(cart);
        added++;
      });

      if (added > 0) {
        saveCartAndSync();
        renderPageCart();
        addBtn.classList.add('added');
        addBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
        setTimeout(function () {
          addBtn.classList.remove('added');
          addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Selected to Cart';
        }, 2500);
      }
    });
  }

  /* ════════════════════════════════════════════════════
     REVIEWS
  ════════════════════════════════════════════════════ */
  function initPageReviews() {
    const container = document.getElementById('cp-reviews-carousel');
    if (!container) return;

    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const reviews  = settings.cart_reviews || [];
    if (!reviews.length) {
      const sp = document.getElementById('cp-social-proof');
      if (sp) sp.style.display = 'none';
      return;
    }

    const googleSVG = '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

    reviews.forEach(function (r) {
      const stars = '&#9733;'.repeat(Math.min(5, Math.max(1, r.stars || 5)));
      const item = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML =
        '<div class="review-item-inner">' +
          '<div class="review-top">' +
            '<img src="' + r.avatar + '" alt="' + r.name + '" class="review-avatar">' +
            '<div class="review-meta"><h4>' + r.name + '</h4><div class="review-stars">' + stars + '</div></div>' +
            '<span class="verified-badge">' + googleSVG + '</span>' +
          '</div>' +
          '<p class="review-text">"' + r.text + '"</p>' +
          '<span class="review-date">' + r.date + '</span>' +
        '</div>';
      container.appendChild(item);
    });

    const items = container.querySelectorAll('.review-item');
    if (items.length > 1) {
      let current = 0;
      items[current].classList.add('active');
      setInterval(function () {
        items[current].classList.remove('active');
        current = (current + 1) % items.length;
        items[current].classList.add('active');
      }, 5000);
    } else if (items.length === 1) {
      items[0].classList.add('active');
    }
  }

  /* ════════════════════════════════════════════════════
     PROMO CODE SLIDER
  ════════════════════════════════════════════════════ */
  function initPagePromoSlider() {
    const products  = window.__allProducts || [];
    const settings  = products.find(function (p) { return p.type === 'settings'; }) || {};
    const promos    = settings.promos || [];
    const container = document.getElementById('cp-promo-codes-container');
    if (!container || !promos.length) return;

    const slidesHTML = promos.map(function (p, i) {
      return '<div class="cart-drawer__promo-slide' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' +
        '<div class="cart-drawer__promo-content">' +
        '<h3 class="cart-drawer__promo-title"><i class="fas fa-ticket-alt"></i> Exclusive Code</h3>' +
        '<p class="cart-drawer__promo-text">Use on <strong>' + p.items + '+</strong> items — Save <strong>' + p.percent + '%</strong></p>' +
        '<div class="cart-drawer__promo-code-row">' +
        '<span class="cart-drawer__promo-code" id="cp-code-' + i + '">' + p.code + '</span>' +
        '<button class="cart-drawer__promo-copy-btn" data-target="cp-code-' + i + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
        '</button></div></div></div>';
    }).join('');

    const dotsHTML = promos.map(function (p, i) {
      return '<span class="cart-drawer__promo-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i + '"></span>';
    }).join('');

    container.innerHTML =
      '<div class="cart-drawer__promo-slider">' + slidesHTML + '</div>' +
      '<div class="cart-drawer__promo-indicators dots">' + dotsHTML + '</div>';

    function promoGoTo(idx) {
      container.querySelectorAll('.cart-drawer__promo-slide').forEach(function (s, i) { s.classList.toggle('active', i === idx); });
      container.querySelectorAll('.cart-drawer__promo-dot').forEach(function (d, i)   { d.classList.toggle('active', i === idx); });
    }

    container.querySelectorAll('.cart-drawer__promo-dot').forEach(function (dot) {
      dot.addEventListener('click', function () { promoGoTo(parseInt(dot.dataset.index)); });
    });

    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.cart-drawer__promo-copy-btn');
      if (!btn) return;
      const target = container.querySelector('#' + btn.dataset.target);
      if (!target) return;
      navigator.clipboard.writeText(target.textContent.trim()).then(function () {
        btn.classList.add('copied');
        setTimeout(function () { btn.classList.remove('copied'); }, 1500);
        showToast('Code copied!');
      });
    });

    if (promos.length > 1) {
      setInterval(function () {
        const active = container.querySelector('.cart-drawer__promo-slide.active');
        const idx    = active ? parseInt(active.dataset.index) : 0;
        promoGoTo((idx + 1) % promos.length);
      }, 6000);
    }
  }

  /* ════════════════════════════════════════════════════
     SHOW / HIDE DYNAMIC SECTIONS
  ════════════════════════════════════════════════════ */
  function showDynamicSections() {
    ['cp-countdown','cp-progress-container','cp-promo-message-wrap',
     'cp-paul-banner','cp-promo-codes-container','cp-social-proof',
     'cp-share-section',
     'cp-extra-section',
     'cp-marquee-strip'
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
}

  function hideDynamicSections() {
    ['cp-countdown','cp-progress-container','cp-promo-message-wrap',
     'cp-paul-banner','cp-promo-codes-container','cp-social-proof',
     'cp-share-section','cp-upsell-section',
     'cp-extra-section',
     'cp-marquee-strip'
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
}

  /* ════════════════════════════════════════════════════
     CHECKOUT BUTTON
  ════════════════════════════════════════════════════ */
  function bindCheckoutButtons() {
    ['cp-checkout-btn', 'cp-sticky-checkout'].forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (typeof window.checkout === 'function') {
          window.checkout();
        } else {
          localStorage.setItem('checkoutCart', JSON.stringify(getCart()));
          window.location.href = '/checkout/checkout.html';
        }
      });
    });
  }

  /* ════════════════════════════════════════════════════
     STICKY BAR — mobile
  ════════════════════════════════════════════════════ */
  function initStickyBar() {
    const stickyBar = document.getElementById('cp-sticky-bar');
    if (!stickyBar) return;
    function checkSticky() {
      if (window.innerWidth > 768) { stickyBar.style.display = 'none'; return; }
      stickyBar.style.display = getCart().length > 0 ? '' : 'none';
    }
    window.addEventListener('scroll', checkSticky, { passive: true });
    window.addEventListener('resize', checkSticky, { passive: true });
    checkSticky();
  }

  /* ════════════════════════════════════════════════════════════════
     SHARE CART — système propre et indépendant
     URL générée : /cart.html?cart_share=ID1,ID2,ID3
     PAS de wishlist_share — PAS de all-product — JAMAIS
  ════════════════════════════════════════════════════════════════ */
  function initShareCart() {
    const shareModal    = document.getElementById('cp-share-modal');
    const shareBackdrop = document.getElementById('cp-share-modal-backdrop');
    const shareClose    = document.getElementById('cp-share-modal-close');
    const shareLinkEl   = document.getElementById('cp-share-link-input');
    const shareCopyBtn  = document.getElementById('cp-share-modal-copy');
    const shareBtn      = document.getElementById('cpShareCartBtn');
    const copyLinkBtn   = document.getElementById('cp-copy-link');

    function buildCartShareUrl() {
      var cart = getCart();
      if (!cart.length) return null;
      var ids = cart.map(function (i) { return i.id; }).join(',');
      return window.location.origin + '/cart.html?cart_share=' + encodeURIComponent(ids);
    }

    function buildProductLines() {
      var cart = getCart();
      return cart.map(function (i) {
        var qty  = i.quantity > 1 ? ' x' + i.quantity : '';
        var vars = '';
        if (i.color) vars += ' - ' + i.color;
        if (i.size)  vars += ' / ' + i.size;
        return i.title + vars + qty + ' — $' + parseFloat(i.price).toFixed(2);
      }).join('\n');
    }

    function buildShareMessage(platform) {
      var cart = getCart();
      if (!cart.length) return null;

      var shareUrl     = buildCartShareUrl();
      var productLines = buildProductLines();
      var count        = cart.reduce(function (s, i) { return s + i.quantity; }, 0);
      var subtotal     = cart.reduce(function (s, i) { return s + parseFloat(i.price) * i.quantity; }, 0);

      var intro =
        'Hey my friend! I am on BBW4LIFE.com and I put these ' + count +
        ' beautiful product' + (count > 1 ? 's' : '') + ' in my cart!\n' +
        'I am sharing them with you — click the link and they will be automatically added to your cart!\n\n' +
        'My cart (' + count + ' item' + (count > 1 ? 's' : '') + ' — $' + subtotal.toFixed(2) + '):\n' +
        productLines + '\n\n' +
        'Click here to see my cart:\n' + shareUrl + '\n\n' +
        'BBW4LIFE — Beauty Has No Sizes | bbw4life.com';

      var twitterMsg =
        'Check out my BBW4LIFE cart! ' + count + ' amazing item' + (count > 1 ? 's' : '') + ' I\'m loving.\n\n' +
        shareUrl + '\n\n' +
        '#BBW4LIFE #CurvyFashion #PlusSize';

      var pinterestMsg =
        'My BBW4LIFE shopping cart — ' + count + ' beautiful item' + (count > 1 ? 's' : '') + '!\n\n' +
        productLines + '\n\n' + shareUrl;

      if (platform === 'twitter')   return twitterMsg;
      if (platform === 'pinterest') return pinterestMsg;
      return intro;
    }

    function showShareToast(msg) {
      showToast(msg);
    }

    function handleCartShare(platform) {
      var cart = getCart();
      if (!cart.length) {
        showShareToast('Your cart is empty!');
        return;
      }

      var shareUrl = buildCartShareUrl();
      var message  = buildShareMessage(platform);

      var platformUrls = {
        whatsapp:  'https://wa.me/?text=' + encodeURIComponent(message),
        facebook:  'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl) + '&quote=' + encodeURIComponent(message),
        twitter:   'https://x.com/intent/tweet?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent('Check out my BBW4LIFE cart!'),
        pinterest: 'https://pinterest.com/pin/create/button/?url=' + encodeURIComponent(shareUrl) + '&media=' + encodeURIComponent(window.__allProducts && window.__allProducts.length ? (function(){ var cart = getCart(); var first = cart[0]; if (!first) return ''; var prod = (window.__allProducts||[]).find(function(p){return p.id===first.id;}); return prod ? prod.image : ''; })() : '') + '&description=' + encodeURIComponent(buildShareMessage('pinterest') || message)
      };
      if (platform === 'copy') {
          var fullMessage = buildShareMessage('whatsapp');
          var textToCopy = fullMessage || shareUrl;
          navigator.clipboard.writeText(textToCopy).then(function () {
              showShareToast('Message copied to clipboard!');
              if (shareLinkEl) shareLinkEl.value = shareUrl;
          }).catch(function () {
              showShareToast('Could not copy. Please copy manually.');
          });
          return;
      }

      if (platformUrls[platform]) {
        window.open(platformUrls[platform], '_blank', 'noopener,noreferrer,width=640,height=520');
        showShareToast('Opening share window...');
      }
    }

    window.handleCartShare = handleCartShare;

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cart-share]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      handleCartShare(btn.dataset.cartShare);
    });

    function openModal() {
      var cart = getCart();
      if (!cart.length) { showShareToast('Your cart is empty!'); return; }
      var url = buildCartShareUrl();
      if (shareLinkEl) shareLinkEl.value = url || '';
      if (shareModal) { shareModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    }

    function closeModal() {
      if (shareModal) { shareModal.style.display = 'none'; document.body.style.overflow = ''; }
    }

    if (shareBtn)      shareBtn.addEventListener('click', openModal);
    if (shareClose)    shareClose.addEventListener('click', closeModal);
    if (shareBackdrop) shareBackdrop.addEventListener('click', closeModal);

    if (shareCopyBtn) {
      shareCopyBtn.addEventListener('click', function () {
        var url = buildCartShareUrl();
        if (!url) { showShareToast('Your cart is empty!'); return; }
        navigator.clipboard.writeText(url).then(function () {
          showShareToast('Link copied!');
          if (shareLinkEl) shareLinkEl.value = url;
        });
      });
    }

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', function () {
        handleCartShare('copy');
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && shareModal && shareModal.style.display !== 'none') closeModal();
    });
  }

  /* ════════════════════════════════════════════════════════════════
     RÉCEPTEUR : Lire ?cart_share=ID1,ID2 et ajouter au panier
  ════════════════════════════════════════════════════════════════ */
  function initCartShareReceiver() {
    var params    = new URLSearchParams(window.location.search);
    var sharedIds = params.get('cart_share');

    if (!sharedIds) return;

    var ids = decodeURIComponent(sharedIds).split(',').filter(Boolean);
    if (!ids.length) return;

    function addSharedToCart() {
      var allProducts = window.__allProducts || [];
      var added = 0;

      ids.forEach(function (id) {
        var prod = allProducts.find(function (p) { return p.id === id; });
        if (!prod || prod.type) return;

        var cart     = getCart();
        var existing = cart.find(function (i) { return i.id === id; });

        if (existing) {
          existing.quantity += 1;
          setCart(cart);
        } else {
          var variant  = (prod.variants && prod.variants.length) ? prod.variants[0] : null;
          var price    = variant ? parseFloat(variant.price) : parseFloat(prod.price);
          var color    = variant ? (variant.color || null) : null;
          var size     = variant ? (variant.size  || null) : null;
          var colorObj = (color && prod.colors) ? prod.colors.find(function (c) { return c.name === color; }) : null;
          var image    = upgradeImg(colorObj ? (colorObj.image || prod.image) : prod.image);

          cart = getCart();
          cart.push({
            id:             prod.id,
            title:          prod.title,
            price:          price,
            compare_price:  parseFloat(prod.compare_price) || price,
            image:          image,
            size:           size  || null,
            color:          color || null,
            quantity:       1,
            fromSharedCart: true,
            cj_product_id:  prod.cj_id,
            cj_variant_id:  variant ? variant.vid : null
          });
          setCart(cart);
        }

        added++;
      });

      if (added > 0) {
        saveCartAndSync();
        renderPageCart();
        setTimeout(function () {
          showToast(
            added + ' item' + (added > 1 ? 's' : '') +
            ' added from shared cart!'
          );
        }, 700);
      }

      var cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }

    if (window.__allProducts && window.__allProducts.length) {
      addSharedToCart();
    } else {
      var tries = 0;
      var wait = setInterval(function () {
        tries++;
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(wait);
          addSharedToCart();
        } else if (tries > 80) {
          clearInterval(wait);
        }
      }, 100);
    }
  }

  /* ════════════════════════════════════════════════════
     ÉCOUTER LES MISES À JOUR DU CART
  ════════════════════════════════════════════════════ */
  function listenCartUpdates() {
    document.addEventListener('cart:update', function () {
      renderPageCart();
      updateProgressBar();
      updatePromoMessage();
    });
  }

  /* ════════════════════════════════════════════════════
     MARQUER QU'ON EST SUR LA CART PAGE
  ════════════════════════════════════════════════════ */
  window.__isCartPage = true;

  /* ════════════════════════════════════════════════════
     INIT PRINCIPALE
  ════════════════════════════════════════════════════ */
  ready(function () {
    waitReady(function () {
      renderPageCart();
      initCountdown();
      initPageBanner();
      initPageUpsell();
      initPageReviews();
      initPagePromoSlider();
      updateProgressBar();
      updatePromoMessage();
      bindCheckoutButtons();
      initStickyBar();
      initShareCart();
      initCartShareReceiver();
      listenCartUpdates();
      setTimeout(updateProgressBar, 100);
    });
  });

})();



/* ================================================================
   BBW4LIFE — CART EXTRA PRODUCTS
   cart-extra-products.js
================================================================ */

(function initCartExtraProducts() {
  'use strict';

  
  function getCart() {
    if (typeof window.__getCart === 'function') return window.__getCart();
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { return []; }
  }
  function setCart(c) {
    if (typeof window.__setCart === 'function') window.__setCart(c);
    localStorage.setItem('cart', JSON.stringify(c));
  }
  function saveAndSync() {
    if (typeof window.saveCart === 'function')                    window.saveCart();
    if (typeof window.updateCartQuantityInSheet === 'function')   window.updateCartQuantityInSheet();
    if (typeof window.updateBadges === 'function')                window.updateBadges();
    if (typeof window.renderCart === 'function')                  window.renderCart();
  }

  function upgradeImg(url, size) {
    if (typeof window.upgradeShopifyImageUrl === 'function') return window.upgradeShopifyImageUrl(url, size || 400);
    return url;
  }

  function getProductUrl(id, allProducts) {
    if (typeof window.getProductUrl === 'function') return window.getProductUrl(id);
    var idx = (allProducts || []).findIndex(function (p) { return p.id === id; });
    return idx === -1 ? '/collections/bbw4life-all-product.html' : '/products/product' + (idx + 1) + '.html';
  }

  function fmt(price) {
    return '$' + parseFloat(price).toFixed(2);
  }

  /* ──────────────────────────────────────────────────────────
     BUILD CARD
     context: 'page' | 'drawer'
  ────────────────────────────────────────────────────────── */
  function buildCard(prod, btnText, allProducts, context) {
    var prefix   = context === 'drawer' ? 'drawer-extra' : 'cp-extra';
    var imgSrc   = upgradeImg(prod.image, context === 'drawer' ? 200 : 400);
    var hoverSrc = prod.image_hover ? upgradeImg(prod.image_hover, context === 'drawer' ? 200 : 400) : '';

    var discountPct = 0;
    if (prod.compare_price && parseFloat(prod.compare_price) > parseFloat(prod.price)) {
      discountPct = Math.round(((parseFloat(prod.compare_price) - parseFloat(prod.price)) / parseFloat(prod.compare_price)) * 100);
    }

    var badgeHTML = '';
    if (prod.badge && prod.badge.text) {
      badgeHTML = '<span class="' + prefix + '-card__badge">' + prod.badge.text + '</span>';
    }

    var discountHTML = discountPct > 0
      ? '<span class="' + prefix + '-card__discount">-' + discountPct + '%</span>'
      : '';

    var compareHTML = (prod.compare_price && parseFloat(prod.compare_price) > parseFloat(prod.price))
      ? '<span class="' + prefix + '-card__compare">' + fmt(prod.compare_price) + '</span>'
      : '';

    var hoverImgHTML = hoverSrc
      ? '<img class="' + prefix + '-card__img-hover" src="' + hoverSrc + '" alt="" loading="lazy" aria-hidden="true">'
      : '';

    var url = getProductUrl(prod.id, allProducts);

    var card = document.createElement('div');
    card.className = prefix + '-card';
    card.dataset.id = prod.id;

    card.innerHTML =
      '<a href="' + url + '" class="' + prefix + '-card__img-wrap" tabindex="-1" aria-hidden="true">' +
        '<img class="' + prefix + '-card__img" src="' + imgSrc + '" alt="' + prod.title + '" loading="lazy">' +
        hoverImgHTML +
        badgeHTML +
        discountHTML +
      '</a>' +
      '<div class="' + prefix + '-card__body">' +
        '<a href="' + url + '" class="' + prefix + '-card__title">' + prod.title + '</a>' +
        '<div class="' + prefix + '-card__prices">' +
          '<span class="' + prefix + '-card__price">' + fmt(prod.price) + '</span>' +
          compareHTML +
        '</div>' +
        '<button class="' + prefix + '-card__btn" data-product-id="' + prod.id + '">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
            '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' +
          '</svg>' +
          btnText +
        '</button>' +
      '</div>';

    
    var btn = card.querySelector('.' + prefix + '-card__btn');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      handleAddToCart(prod, btn, allProducts);
    });

    return card;
  }

  /* ──────────────────────────────────────────────────────────
     ADD TO CART
  ────────────────────────────────────────────────────────── */
  function handleAddToCart(prod, btn, allProducts) {
    var variant     = prod.variants && prod.variants.length ? prod.variants[0] : null;
    var price       = variant ? parseFloat(variant.price) : parseFloat(prod.price);
    var compare     = parseFloat(prod.compare_price) || price;
    var color       = variant ? (variant.color || null) : null;
    var size        = variant ? (variant.size  || null) : null;
    var cjVariantId = variant ? variant.vid : null;

    var colorObj = (color && prod.colors)
      ? prod.colors.find(function (c) { return c.name === color; })
      : null;
    var image = upgradeImg(colorObj ? (colorObj.image || prod.image) : prod.image);

    var cart = getCart();
    var existing = cart.find(function (i) {
      return i.id === prod.id && i.color === color && i.size === size;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id:            prod.id,
        title:         prod.title,
        price:         price,
        compare_price: compare,
        image:         image,
        size:          size  || null,
        color:         color || null,
        quantity:      1,
        fromExtraSuggestion: true,
        cj_product_id: prod.cj_id,
        cj_variant_id: cjVariantId
      });
    }

    setCart(cart);
    saveAndSync();

    
    var originalHTML = btn.innerHTML;
    btn.classList.add('added');
    btn.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Added!';
    setTimeout(function () {
      btn.classList.remove('added');
      btn.innerHTML = originalHTML;
    }, 2200);

    
    if (typeof window.openCartDrawer === 'function' && document.getElementById('cart-page-main')) {
      
    } else if (typeof window.openCartDrawer === 'function') {
      window.openCartDrawer();
    }
  }

  /* ──────────────────────────────────────────────────────────
     SLIDER LOGIC
  ────────────────────────────────────────────────────────── */
  function initSlider(track, dotsContainer, prevBtn, nextBtn, perPage) {
    var cards       = track.querySelectorAll('[class$="-card"]');
    var totalPages  = Math.ceil(cards.length / perPage);
    var currentPage = 0;

    
    dotsContainer.innerHTML = '';
    for (var i = 0; i < totalPages; i++) {
      (function (idx) {
        var dot = document.createElement('button');
        dot.className = 'cp-extra-dot' + (idx === 0 ? ' active' : '');

        
        var isDrawer = dotsContainer.id === 'drawer-extra-dots';
        if (isDrawer) dot.className = 'drawer-extra-dot' + (idx === 0 ? ' active' : '');

        dot.setAttribute('aria-label', 'Page ' + (idx + 1));
        dot.addEventListener('click', function () { goTo(idx); });
        dotsContainer.appendChild(dot);
      })(i);
    }

    if (totalPages <= 1) {
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      dotsContainer.style.display = 'none';
      return;
    }

    function goTo(page) {
        currentPage = Math.max(0, Math.min(page, totalPages - 1));

        var card    = track.querySelector('[class$="-card"]');
        var gap     = parseInt(getComputedStyle(track).gap) || 14;
        var cardW   = card ? card.offsetWidth : 0;

        
        var viewport   = track.parentElement;
        var totalW     = cards.length * (cardW + gap) - gap;
        var maxOffset  = Math.max(0, totalW - viewport.offsetWidth);
        var rawOffset  = currentPage * perPage * (cardW + gap);
        var offset     = Math.min(rawOffset, maxOffset);  // ← ici le fix

        track.style.transform = 'translateX(-' + offset + 'px)';

      
      var dots = dotsContainer.querySelectorAll('[class$="-dot"]');
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === currentPage);
      });

      if (prevBtn) prevBtn.disabled = (currentPage === 0);
      if (nextBtn) nextBtn.disabled = (currentPage >= totalPages - 1);
    }

    if (prevBtn) {
      prevBtn.disabled = true;
      prevBtn.addEventListener('click', function () { goTo(currentPage - 1); });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () { goTo(currentPage + 1); });
    }

    
    var touchStartX = 0;
    track.parentElement.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    track.parentElement.addEventListener('touchend', function (e) {
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) goTo(currentPage + 1);
        else          goTo(currentPage - 1);
      }
    }, { passive: true });

    
    goTo(0);
  }

  /* ──────────────────────────────────────────────────────────
     INIT PAGE CART
  ────────────────────────────────────────────────────────── */
  function initPageCart(allProducts, cfg) {
    var section    = document.getElementById('cp-extra-section');
    var track      = document.getElementById('cp-extra-track');
    var dots       = document.getElementById('cp-extra-dots');
    var prevBtn    = document.getElementById('cp-extra-prev');
    var nextBtn    = document.getElementById('cp-extra-next');

    if (!section || !track) return;

    var btnText  = cfg.btn_text || 'Add to Cart';
    var ids      = cfg.product_ids || [];

    var products = ids
      .map(function (id) { return allProducts.find(function (p) { return p.id === id; }); })
      .filter(Boolean);

    if (!products.length) { section.style.display = 'none'; return; }

    
    track.innerHTML = '';
    products.forEach(function (prod) {
      track.appendChild(buildCard(prod, btnText, allProducts, 'page'));
    });

    var cartCheck = (typeof window.__getCart === 'function')
  ? window.__getCart()
  : JSON.parse(localStorage.getItem('cart') || '[]');
section.style.display = cartCheck.length === 0 ? 'none' : '';

    
    var perPage = window.innerWidth <= 768 ? 2 : 3;
    initSlider(track, dots, prevBtn, nextBtn, perPage);

    
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var pp = window.innerWidth <= 768 ? 2 : 3;
        track.style.transform = 'translateX(0)';
        initSlider(track, dots, prevBtn, nextBtn, pp);
      }, 200);
    });
  }

  /* ──────────────────────────────────────────────────────────
     INIT CART DRAWER
  ────────────────────────────────────────────────────────── */
  function initDrawer(allProducts, cfg) {
    var section = document.getElementById('drawer-extra-section');
    var track   = document.getElementById('drawer-extra-track');
    var dots    = document.getElementById('drawer-extra-dots');
    var prevBtn = document.getElementById('drawer-extra-prev');
    var nextBtn = document.getElementById('drawer-extra-next');

    if (!section || !track) return;

    var btnText  = cfg.btn_text || 'Add to Cart';
    var ids      = cfg.product_ids || [];

    var products = ids
      .map(function (id) { return allProducts.find(function (p) { return p.id === id; }); })
      .filter(Boolean);

    if (!products.length) { section.style.display = 'none'; return; }

    
    track.innerHTML = '';
    products.forEach(function (prod) {
      track.appendChild(buildCard(prod, btnText, allProducts, 'drawer'));
    });

    section.style.display = '';

    
    initSlider(track, dots, prevBtn, nextBtn, 2);
  }

  /* ──────────────────────────────────────────────────────────
     MAIN — wait for products
  ────────────────────────────────────────────────────────── */
  function run(allProducts) {
    var settings = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
    var cfg      = settings.cart_extra_products;

    if (!cfg || !cfg.product_ids || !cfg.product_ids.length) return;

    
    if (document.getElementById('cp-extra-section')) {
      initPageCart(allProducts, cfg);

      document.addEventListener('cart:update', function () {
        var section = document.getElementById('cp-extra-section');
        if (!section) return;
        var cart = (typeof window.__getCart === 'function')
          ? window.__getCart()
          : JSON.parse(localStorage.getItem('cart') || '[]');
        section.style.display = cart.length === 0 ? 'none' : '';
      });
    }

    
    initDrawer(allProducts, cfg);

    
    document.addEventListener('cart:update', function () {
      var section = document.getElementById('drawer-extra-section');
      if (section && section.innerHTML.trim() !== '') return; 
      initDrawer(allProducts, cfg);
    });
  }

  if (window.__allProducts && window.__allProducts.length) {
    run(window.__allProducts);
  } else {
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll);
        run(window.__allProducts);
      } else if (tries > 120) {
        clearInterval(poll);
      }
    }, 100);
  }

})();