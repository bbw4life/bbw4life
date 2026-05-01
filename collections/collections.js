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
          page_size:   12,
          max_price:   200,
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
    const quarter = Math.floor(productIds.length / 4);
    CATEGORY_MAP = {
      all:        null,
      slimming:   productIds.slice(0, quarter),
      apparel:    productIds.slice(quarter, quarter * 2),
      wellness:   productIds.slice(quarter * 2, quarter * 3),
      essentials: productIds.slice(quarter * 3),
      bestsellers: null,
      new:         null
    };
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

  const colStickyBar     = $('colStickyBar');
  const colSelectedCount = $('colSelectedCount');
  const colCompareBtn    = $('colCompareBtn');
  const colStickyAddCart = $('colStickyAddCart');
  const colStickyBarClear= $('colStickyBarClear');
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
    const rv = getRV();
    if (rv.length === 0) { colRecentlyViewed.style.display = 'none'; return; }
    colRecentlyViewed.style.display = 'block';
    colRvGrid.innerHTML = '';
    rv.slice(0, 6).forEach(item => {
      const prod = allProducts.find(p => p.id === item.id) || item;
      const url  = getProductUrl(prod.id);
      const card = document.createElement('div');
      card.className = 'col-rv-card';
      card.innerHTML =
        '<img class="col-rv-card__img" src="' + upgradeShopifyImageUrl(item.image, 300) + '" alt="' + item.title + '" loading="lazy">' +
        '<div class="col-rv-card__info">' +
          '<p class="col-rv-card__title">' + item.title + '</p>' +
          '<span class="col-rv-card__price">$' + (Number(item.price) || 0).toFixed(2) + '</span>' +
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
      settings = data.find(p => p.type === 'settings') || {};

      if (document.getElementById('all-collections-grid')) {
  renderAllCollections(settings);

  const spFreeShipEl = document.getElementById('spFreeShipping');
  if (spFreeShipEl) spFreeShipEl.textContent = 
    (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold) || 50;

  return;
}
 
  

      /* ── Detect which collection this page is for ── */
      const collectionId = detectCollectionId();
      colSettings = resolveCollectionSettings(settings, collectionId);

      if (!colSettings) {
        console.error('[Collections] No collection found for id:', collectionId);
        if (colEmpty) colEmpty.style.display = 'block';
        return;
      }

      const productIds = colSettings.product_ids || [];
      pageSize = parseInt(colSettings.page_size) || 8;

      /* ── Flash deal ── */
      const flashHours = (settings.flash_deal && settings.flash_deal.hours) ? settings.flash_deal.hours : 4;
      initCountdown(flashHours);

      /* ── Best promo code in flash banner ── */
      const bp = (settings.promos || []).reduce((b,p) => p.percent > (b.percent||0) ? p : b, {});
      const flashSubEl = document.querySelector('.col-flash-sub strong');
      const flashTitleEl = document.querySelector('.col-flash-title');
      if (flashSubEl && bp.code)    flashSubEl.textContent = bp.code;
      if (flashTitleEl && bp.percent) flashTitleEl.innerHTML = flashTitleEl.innerHTML.replace('20', bp.percent);

      /* ── Free shipping threshold ── */
      const freeShipThreshold = (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold) ? settings.cart_drawer.free_shipping_threshold : 50;
      const spFreeShipEl = $('spFreeShipping');
      if (spFreeShipEl) spFreeShipEl.textContent = freeShipThreshold;

      /* ── Card animation ── */
      const animMap = {
        fadeSlideUp: 'col-anim--fadeSlideUp',
        zoomFade:    'col-anim--zoomFade',
        flipIn:      'col-anim--flipIn',
        slideLeft:   'col-anim--slideLeft',
        slideRight:  'col-anim--slideRight',
        rotateIn:    'col-anim--rotateIn',
        glowPop:     'col-anim--glowPop'
      };
      const cardAnims = colSettings.col_card_animations || {};
      const activeAnim = Object.keys(cardAnims).find(k => (cardAnims[k] || '').toLowerCase() === 'yes');
      animationClass = (activeAnim && animMap[activeAnim]) ? animMap[activeAnim] : 'col-anim--fadeSlideUp';

      /* ── Build products list for THIS collection only ── */
      const realProducts = data.filter(p => !p.type && p.active !== false);
      if (productIds.length > 0) {
        allProducts = productIds.map(id => realProducts.find(p => p.id === id)).filter(Boolean);
      } else {
        allProducts = realProducts;
      }

      /* ── Build category tabs from this collection's products ── */
      buildCategoryMap(productIds);

      /* ── Price range max ── */
      const maxPrice = parseInt(colSettings.max_price) ||
        (allProducts.length > 0
          ? Math.ceil(Math.max(...allProducts.map(p => p.compare_price || p.price)) / 10) * 10
          : 200);

      activeFilters.priceMax  = maxPrice;
      if (colRangeMin) colRangeMin.max = maxPrice;
      if (colRangeMax) { colRangeMax.max = maxPrice; colRangeMax.value = maxPrice; }
      if (colPriceInpMax) { colPriceInpMax.max = maxPrice; colPriceInpMax.value = maxPrice; }
      if (colPriceDispMax) colPriceDispMax.textContent = '$' + maxPrice;

      /* ── Hero section ── */
      injectCollectionHero(colSettings);

      /* ── Social links ── */
      injectSocialLinks(settings.social_links || {});

      /* ── Build filters ── */
      buildColorList();
      buildSizeGrid();
      buildDiscountFilters();
      updateAvailabilityCounts();

      /* ── Render ── */
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
        const activeSizeBtn = card.querySelector('.col-card__size-btn.active');
        const selectedSize  = activeSizeBtn ? activeSizeBtn.textContent.trim() : null;
        addProductToCartWithColor(prod, color, cartBtn, selectedSize);
      });
    }

    const qvBtn = card.querySelector('.col-card__quick-view');
    if (qvBtn) {
      qvBtn.addEventListener('click', e => { e.stopPropagation(); openQuickView(prod, color); });
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
    if (!colStickyBar) return;
    const count = selectedProducts.size;
    if (colSelectedCount) colSelectedCount.textContent = count;
    if (count > 0) {
      colStickyBar.style.display = 'block';
      requestAnimationFrame(() => { requestAnimationFrame(() => { colStickyBar.classList.add('visible'); }); });
    } else {
      colStickyBar.classList.remove('visible');
      setTimeout(() => { if (selectedProducts.size === 0) colStickyBar.style.display = 'none'; }, 310);
    }
  }

  if (colStickyAddCart) {
    colStickyAddCart.addEventListener('click', () => {
      selectedProducts.forEach(key => {
        const underscoreIdx = key.indexOf('_');
        let prodId, colorName;
        if (underscoreIdx !== -1) { prodId = key.substring(0, underscoreIdx); colorName = key.substring(underscoreIdx + 1); }
        else { prodId = key; colorName = null; }
        const prod = allProducts.find(p => p.id === prodId);
        if (!prod) return;
        const color = colorName ? (prod.colors || []).find(c => c.name === colorName) : null;
        addProductToCartWithColor(prod, color, colStickyAddCart);
      });
      selectedProducts.clear();
      updateStickyBar();
      $$('.col-card__select input').forEach(chk => { chk.checked = false; });
    });
  }

  if (colStickyBarClear) {
    colStickyBarClear.addEventListener('click', () => {
      selectedProducts.clear();
      updateStickyBar();
      $$('.col-card__select input').forEach(chk => { chk.checked = false; });
    });
  }

  if (colCompareBtn) { colCompareBtn.addEventListener('click', openCompareModal); }

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
        navigator.clipboard.writeText('SAVE15').catch(() => {});
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
    const allReal = window.__allProducts || allProducts;
    const idx = allReal.findIndex(p => String(p.id) === String(id));
    if (idx === -1) return 'shop.html';
    const inProducts = window.location.pathname.includes('/products/') || /product\d+\.html$/.test(window.location.pathname);
    return inProducts ? 'product' + (idx+1) + '.html' : 'products/product' + (idx+1) + '.html';
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

})();