/* ================================================================
   BBW4LIFE — SEARCH RESULTS: FILTERS, SORT & PAGINATION
   Adapté de collections/collections.js (même comportement/CSS .col-*)
   mais sans notion de "collection" (pas de catégories/onglets) et sans
   variantes couleur explosées en cards séparées — une card par produit.
================================================================ */
(function () {
  'use strict';

  const grid = document.getElementById('srGrid');
  if (!grid) return; // pas sur la page search-results

  /* ────────────────────────────────────────────────────────────
     COLOR HELPERS (repris de collections.js pour cohérence visuelle)
  ──────────────────────────────────────────────────────────── */
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
    other:'#CCCCCC', wine:'#722F37', navyblue:'#000080', darkblue:'#00008B'
  };
  function getHex(colorName) {
    if (!colorName) return '#CCCCCC';
    const lower = colorName.toLowerCase().trim();
    if (COLOR_HEX[lower]) return COLOR_HEX[lower];
    const joined = lower.replace(/\s+/g, '');
    if (COLOR_HEX[joined]) return COLOR_HEX[joined];
    const words = lower.split(/[\s_-]+/);
    for (let i = words.length - 1; i >= 0; i--) { if (COLOR_HEX[words[i]]) return COLOR_HEX[words[i]]; }
    return '#CCCCCC';
  }
  function isLightColor(hex) {
    if (!hex || hex.length < 6) return false;
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0,2), 16), g = parseInt(h.substring(2,4), 16), b = parseInt(h.substring(4,6), 16);
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.75;
  }
  function getColorBase(colorName) {
    if (!colorName) return 'other';
    return colorName.toLowerCase().trim().split(/[\s_-]+/)[0];
  }

  /* ────────────────────────────────────────────────────────────
     DOM SHORTCUTS
  ──────────────────────────────────────────────────────────── */
  const $  = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  const srToolbar        = $('srToolbar');
  const srEmpty          = $('srEmpty');
  const srEmptyText      = $('srEmptyText');
  const srPrompt         = $('srPrompt');
  const srResultsSummary = $('srResultsSummary');
  const srVisibleCount   = $('srVisibleCount');
  const srPagination     = $('srPagination');

  const srFilterToggle   = $('srFilterToggle');
  const srFilterCount    = $('srFilterCount');
  const srDrawer         = $('srDrawer');
  const srDrawerOverlay  = $('srDrawerOverlay');
  const srDrawerClose    = $('srDrawerClose');
  const srDrawerApply    = $('srDrawerApply');
  const srDrawerClear    = $('srDrawerClear');
  const srDrawerCount    = $('srDrawerCount');
  const srSortBtn        = $('srSortBtn');
  const srSortMenu       = $('srSortMenu');
  const srSortLabel      = $('srSortLabel');
  const srActiveFilters  = $('srActiveFilters');
  const srActivePills    = $('srActivePills');
  const srClearAll       = $('srClearAll');
  const srRangeMin       = $('srRangeMin');
  const srRangeMax       = $('srRangeMax');
  const srRangeFill      = $('srRangeFill');
  const srPriceDispMin   = $('srPriceDispMin');
  const srPriceDispMax   = $('srPriceDispMax');
  const srPriceInpMin    = $('srPriceInpMin');
  const srPriceInpMax    = $('srPriceInpMax');
  const srColorSwatches  = $('srColorSwatches');
  const srSizeGrid       = $('srSizeGrid');
  const srDiscountFilters= $('srDiscountFilters');

  /* ────────────────────────────────────────────────────────────
     STATE
  ──────────────────────────────────────────────────────────── */
  let allProducts = [];   // résultats de recherche bruts (résolus par script.js)
  let filtered    = [];

  let activeFilters = {
    availability: [], priceMin: 0, priceMax: 150,
    colors: [], sizes: [], rating: 0, discount: null
  };

  let currentSort = 'default';
  let currentPage = 1;
  const pageSize  = 12;

  function getDiscount(prod) {
    if (!prod.compare_price || prod.compare_price <= prod.price) return 0;
    return Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100);
  }

  function productMatchesFilters(prod) {
    if (prod.price > activeFilters.priceMax) return false;
    if (activeFilters.priceMin > 0 && prod.price < activeFilters.priceMin) return false;

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
    switch (currentSort) {
      case 'price-asc':  return copy.sort((a,b) => a.price - b.price);
      case 'price-desc': return copy.sort((a,b) => b.price - a.price);
      case 'discount':   return copy.sort((a,b) => getDiscount(b) - getDiscount(a));
      case 'rating':     return copy.sort((a,b) => (b.rating||0) - (a.rating||0));
      case 'reviews':    return copy.sort((a,b) => (b.reviews_count||0) - (a.reviews_count||0));
      case 'name-asc':   return copy.sort((a,b) => a.title.localeCompare(b.title));
      default:           return copy; // "Best Match" = ordre de pertinence déjà fourni par la recherche
    }
  }

  function applyAll() {
    filtered    = allProducts.filter(productMatchesFilters);
    filtered    = sortProducts(filtered);
    currentPage = 1;
    renderPage();
    renderPagination();
    updateActiveFiltersUI();
  }

  /* ────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────── */
  function renderPage() {
    grid.innerHTML = '';

    if (srVisibleCount) srVisibleCount.textContent = filtered.length;

    if (filtered.length === 0) {
      grid.style.display = 'none';
      if (srResultsSummary) srResultsSummary.style.display = 'none';
      if (srEmpty) {
        srEmpty.style.display = 'block';
        if (srEmptyText) srEmptyText.textContent = 'No products match your filters. Try adjusting or clearing them.';
      }
      return;
    }

    if (srEmpty) srEmpty.style.display = 'none';
    grid.style.display = 'grid';

    const start = (currentPage - 1) * pageSize;
    filtered.slice(start, start + pageSize).forEach((prod, idx) => {
      const card = window.__srBuildCard(prod);
      card.style.setProperty('--sr-delay', (Math.min(idx, 11) * 0.05) + 's');
      grid.appendChild(card);
    });

    if (typeof window.__srUpdateWishlistIcons === 'function') window.__srUpdateWishlistIcons();
  }

  function makePagBtn(label, disabled) {
    const btn = document.createElement('button');
    btn.className = 'col-page-btn'; btn.textContent = label;
    if (disabled) btn.disabled = true;
    return btn;
  }

  function goPage(page) { currentPage = page; renderPage(); renderPagination(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function renderPagination() {
    if (!srPagination) return;
    srPagination.innerHTML = '';
    const totalPages = Math.ceil(filtered.length / pageSize);
    if (totalPages <= 1) return;

    const maxVisible = window.innerWidth <= 768 ? 5 : 7;

    const prev = makePagBtn('←', currentPage === 1);
    prev.addEventListener('click', () => { if (currentPage > 1) goPage(currentPage - 1); });
    srPagination.appendChild(prev);

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end   = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      const b = makePagBtn('1'); b.addEventListener('click', () => goPage(1)); srPagination.appendChild(b);
      if (start > 2) { const e = document.createElement('span'); e.className = 'col-page-ellipsis'; e.textContent = '…'; srPagination.appendChild(e); }
    }
    for (let i = start; i <= end; i++) {
      const btn = makePagBtn(String(i));
      if (i === currentPage) btn.classList.add('active');
      btn.addEventListener('click', (pg => () => goPage(pg))(i));
      srPagination.appendChild(btn);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) { const e = document.createElement('span'); e.className = 'col-page-ellipsis'; e.textContent = '…'; srPagination.appendChild(e); }
      const b = makePagBtn(String(totalPages)); b.addEventListener('click', () => goPage(totalPages)); srPagination.appendChild(b);
    }

    const next = makePagBtn('→', currentPage === totalPages);
    next.addEventListener('click', () => { if (currentPage < totalPages) goPage(currentPage + 1); });
    srPagination.appendChild(next);
  }

  /* ────────────────────────────────────────────────────────────
     BUILD FILTER OPTIONS FROM allProducts
  ──────────────────────────────────────────────────────────── */
  function buildColorList() {
    if (!srColorSwatches) return;
    const colorMap = new Map();
    allProducts.forEach(prod => {
      if (!prod.colors) return;
      prod.colors.forEach(c => {
        const base = getColorBase(c.name);
        if (!colorMap.has(base)) colorMap.set(base, { name: c.name, hex: c.hex || getHex(c.name) });
      });
    });
    srColorSwatches.innerHTML = '';
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
        if (idx === -1) activeFilters.colors.push(base); else activeFilters.colors.splice(idx, 1);
        updateActiveFiltersUI(); updateDrawerCount();
      });
      srColorSwatches.appendChild(row);
    });
  }

  function buildSizeGrid() {
    if (!srSizeGrid) return;
    const sizeSet = new Set();
    allProducts.forEach(prod => { if (prod.sizes) prod.sizes.forEach(s => sizeSet.add(s)); });
    srSizeGrid.innerHTML = '';
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
      srSizeGrid.appendChild(btn);
    });
  }

  function buildDiscountFilters() {
    if (!srDiscountFilters) return;
    srDiscountFilters.innerHTML = '';
    [10,20,30,40,50].forEach(pct => {
      const label = document.createElement('label');
      label.className = 'col-check';
      label.innerHTML =
        '<input type="checkbox" name="sr-discount" value="' + pct + '">' +
        '<span class="col-check__box"></span>' +
        '<span class="col-check__label">' + pct + '%+ off</span>';
      const cb = label.querySelector('input');
      cb.addEventListener('change', () => {
        activeFilters.discount = cb.checked ? pct : null;
        $$('input[name="sr-discount"]').forEach(c => { if (c !== cb) c.checked = false; });
        updateActiveFiltersUI(); updateDrawerCount();
      });
      srDiscountFilters.appendChild(label);
    });
  }

  function updateAvailabilityCounts() {
    const inStock  = allProducts.filter(p => p.variants && p.variants.some(v => v.active)).length;
    const outStock = allProducts.length - inStock;
    const el1 = $('sr-cnt-instock'), el2 = $('sr-cnt-outstock');
    if (el1) el1.textContent = inStock;
    if (el2) el2.textContent = outStock;
  }

  /* ────────────────────────────────────────────────────────────
     ACTIVE FILTERS UI (pills + count)
  ──────────────────────────────────────────────────────────── */
  function addPill(label, type, removeFn) {
    const pill = document.createElement('div');
    pill.className = 'col-pill';
    pill.innerHTML = '<span>' + type + ': ' + label + '</span><span class="col-pill__remove"><i class="fas fa-times"></i></span>';
    pill.querySelector('.col-pill__remove').addEventListener('click', removeFn);
    srActivePills.appendChild(pill);
  }

  function updateActiveFiltersUI() {
    if (!srActivePills) return;
    srActivePills.innerHTML = '';
    let count = 0;

    if (srRangeMax && (activeFilters.priceMin > 0 || activeFilters.priceMax < parseInt(srRangeMax.max))) {
      addPill('$' + activeFilters.priceMin + ' – $' + activeFilters.priceMax, 'Price', () => {
        const max = parseInt(srRangeMax.max);
        activeFilters.priceMin = 0; activeFilters.priceMax = max;
        srRangeMin.value = 0; srRangeMax.value = max;
        srPriceInpMin.value = 0; srPriceInpMax.value = max;
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
        activeFilters.availability = []; $$('input[name="sr-availability"]').forEach(cb => cb.checked = false); applyAll();
      }); count++;
    }

    if (activeFilters.rating > 0) {
      addPill(activeFilters.rating + '★+', 'Rating', () => {
        activeFilters.rating = 0; $$('#srRatingOpts .col-rating-opt').forEach(b => b.classList.toggle('active', b.dataset.rating === '0')); applyAll();
      }); count++;
    }

    if (activeFilters.discount !== null) {
      addPill(activeFilters.discount + '%+ off', 'Discount', () => {
        activeFilters.discount = null; $$('input[name="sr-discount"]').forEach(cb => cb.checked = false); applyAll();
      }); count++;
    }

    if (srActiveFilters) srActiveFilters.style.display = count > 0 ? 'flex' : 'none';
    if (srFilterCount) { srFilterCount.textContent = count; srFilterCount.style.display = count > 0 ? 'inline-flex' : 'none'; }
  }

  /* ────────────────────────────────────────────────────────────
     DRAWER
  ──────────────────────────────────────────────────────────── */
  function openDrawer() {
    if (srDrawer) srDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    updateDrawerCount();
  }
  function closeDrawer() {
    if (srDrawer) srDrawer.classList.remove('open');
    document.body.style.overflow = '';
  }
  function updateDrawerCount() {
    const preview = allProducts.filter(productMatchesFilters).length;
    if (srDrawerCount) srDrawerCount.textContent = preview;
  }

  if (srFilterToggle)  srFilterToggle.addEventListener('click', openDrawer);
  if (srDrawerClose)   srDrawerClose.addEventListener('click', closeDrawer);
  if (srDrawerOverlay) srDrawerOverlay.addEventListener('click', closeDrawer);
  if (srDrawerApply)   srDrawerApply.addEventListener('click', () => { applyAll(); closeDrawer(); });
  if (srDrawerClear)   srDrawerClear.addEventListener('click', resetAllFilters);
  if (srClearAll)      srClearAll.addEventListener('click', resetAllFilters);

  (function initSwipeClose() {
    const panel = srDrawer ? srDrawer.querySelector('.col-drawer__panel') : null;
    if (!panel) return;
    let startX = 0;
    panel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    panel.addEventListener('touchend', e => { if (e.changedTouches[0].clientX - startX < -60) closeDrawer(); }, { passive: true });
  })();

  function resetAllFilters() {
    const max = srRangeMax ? (parseInt(srRangeMax.max) || 150) : 150;
    activeFilters = { availability: [], priceMin: 0, priceMax: max, colors: [], sizes: [], rating: 0, discount: null };
    currentSort = 'default';
    if (srRangeMin) srRangeMin.value = 0;
    if (srRangeMax) srRangeMax.value = max;
    if (srPriceInpMin) srPriceInpMin.value = 0;
    if (srPriceInpMax) srPriceInpMax.value = max;
    updateRangeFill();
    $$('.col-color-row').forEach(row => row.classList.remove('active'));
    $$('.col-size-btn').forEach(btn => btn.classList.remove('active'));
    $$('#srRatingOpts .col-rating-opt').forEach(b => b.classList.toggle('active', b.dataset.rating === '0'));
    $$('input[name="sr-availability"]').forEach(cb => cb.checked = false);
    $$('input[name="sr-discount"]').forEach(cb => cb.checked = false);
    $$('#srSortMenu .col-sort-item').forEach(s => s.classList.toggle('active', s.dataset.sort === 'default'));
    if (srSortLabel) srSortLabel.textContent = 'Best Match';
    if (srSortBtn)  srSortBtn.classList.remove('open');
    if (srSortMenu) srSortMenu.classList.remove('open');
    applyAll();
  }

  $$('.col-filter-block__head').forEach(head => {
    head.addEventListener('click', () => { head.closest('.col-filter-block').classList.toggle('collapsed'); });
  });

  $$('input[name="sr-availability"]').forEach(cb => {
    cb.addEventListener('change', () => {
      activeFilters.availability = Array.from($$('input[name="sr-availability"]:checked')).map(i => i.value);
      updateDrawerCount();
    });
  });

  $$('#srRatingOpts .col-rating-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#srRatingOpts .col-rating-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilters.rating = parseFloat(btn.dataset.rating);
      updateDrawerCount();
    });
  });

  /* ────────────────────────────────────────────────────────────
     PRICE RANGE
  ──────────────────────────────────────────────────────────── */
  function updateRangeFill() {
    if (!srRangeMin || !srRangeMax || !srRangeFill) return;
    const max = parseInt(srRangeMax.max) || 150;
    const minVal = parseInt(srRangeMin.value), maxVal = parseInt(srRangeMax.value);
    srRangeFill.style.left  = (minVal / max * 100) + '%';
    srRangeFill.style.right = ((1 - maxVal / max) * 100) + '%';
    if (srPriceDispMin) srPriceDispMin.textContent = '$' + minVal;
    if (srPriceDispMax) srPriceDispMax.textContent = '$' + maxVal;
  }

  if (srRangeMin) srRangeMin.addEventListener('input', () => {
    let val = parseInt(srRangeMin.value);
    if (val > parseInt(srRangeMax.value)) { srRangeMin.value = srRangeMax.value; val = parseInt(srRangeMax.value); }
    activeFilters.priceMin = val; if (srPriceInpMin) srPriceInpMin.value = val; updateRangeFill(); updateDrawerCount();
  });
  if (srRangeMax) srRangeMax.addEventListener('input', () => {
    let val = parseInt(srRangeMax.value);
    if (val < parseInt(srRangeMin.value)) { srRangeMax.value = srRangeMin.value; val = parseInt(srRangeMin.value); }
    activeFilters.priceMax = val; if (srPriceInpMax) srPriceInpMax.value = val; updateRangeFill(); updateDrawerCount();
  });
  if (srPriceInpMin) srPriceInpMin.addEventListener('input', () => {
    let val = parseInt(srPriceInpMin.value) || 0;
    val = Math.max(0, Math.min(val, parseInt(srRangeMax.value) || 150));
    srPriceInpMin.value = val; srRangeMin.value = val; activeFilters.priceMin = val; updateRangeFill(); updateDrawerCount();
  });
  if (srPriceInpMax) srPriceInpMax.addEventListener('input', () => {
    const maxTotal = parseInt(srRangeMax.max) || 150;
    let val = Math.min(maxTotal, Math.max(parseInt(srPriceInpMax.value) || maxTotal, parseInt(srRangeMin.value) || 0));
    srPriceInpMax.value = val; srRangeMax.value = val; activeFilters.priceMax = val; updateRangeFill(); updateDrawerCount();
  });

  /* ────────────────────────────────────────────────────────────
     SORT
  ──────────────────────────────────────────────────────────── */
  if (srSortBtn) srSortBtn.addEventListener('click', e => {
    e.stopPropagation(); srSortBtn.classList.toggle('open'); if (srSortMenu) srSortMenu.classList.toggle('open');
  });
  document.addEventListener('click', () => {
    if (srSortBtn)  srSortBtn.classList.remove('open');
    if (srSortMenu) srSortMenu.classList.remove('open');
  });
  $$('#srSortMenu .col-sort-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      $$('#srSortMenu .col-sort-item').forEach(s => s.classList.remove('active'));
      item.classList.add('active'); currentSort = item.dataset.sort;
      const labels = { default:'Best Match', 'price-asc':'Price ↑', 'price-desc':'Price ↓', discount:'Discount', rating:'Top Rated', reviews:'Most Reviewed', 'name-asc':'A → Z' };
      if (srSortLabel) srSortLabel.textContent = labels[currentSort] || 'Best Match';
      if (srSortBtn)  srSortBtn.classList.remove('open');
      if (srSortMenu) srSortMenu.classList.remove('open');
      applyAll();
    });
  });

  /* ────────────────────────────────────────────────────────────
     ENTRY POINT — appelé par search-results.js à chaque recherche
  ──────────────────────────────────────────────────────────── */
  function loadResults(query) {
    if (!query) {
      grid.style.display = 'none';
      if (srToolbar) srToolbar.style.display = 'none';
      if (srResultsSummary) srResultsSummary.style.display = 'none';
      if (srEmpty)  srEmpty.style.display  = 'none';
      if (srPrompt) srPrompt.style.display = 'block';
      if (srPagination) srPagination.innerHTML = '';
      if (srActiveFilters) srActiveFilters.style.display = 'none';
      return;
    }

    if (srPrompt) srPrompt.style.display = 'none';

    if (typeof window.__srResolveResults !== 'function') return;
    allProducts = window.__srResolveResults(query);

    if (!allProducts.length) {
      if (srToolbar) srToolbar.style.display = 'none';
      if (srActiveFilters) srActiveFilters.style.display = 'none';
      grid.style.display = 'none';
      if (srResultsSummary) srResultsSummary.style.display = 'none';
      if (srPagination) srPagination.innerHTML = '';
      if (srEmpty) {
        srEmpty.style.display = 'block';
        if (srEmptyText) srEmptyText.textContent = `We couldn't find anything for "${query}". Try a different word, or browse our full catalog.`;
      }
      return;
    }

    if (srToolbar) srToolbar.style.display = 'flex';
    if (srResultsSummary) {
      srResultsSummary.style.display = 'block';
      srResultsSummary.textContent = `${allProducts.length} result${allProducts.length > 1 ? 's' : ''} for "${query}"`;
    }

    // Reset des filtres à chaque nouvelle recherche (query différente).
    const maxPrice = Math.ceil(Math.max(...allProducts.map(p => p.compare_price || p.price)) / 10) * 10 || 150;
    activeFilters = { availability: [], priceMin: 0, priceMax: maxPrice, colors: [], sizes: [], rating: 0, discount: null };
    currentSort = 'default';
    if (srRangeMin)  { srRangeMin.max = maxPrice; srRangeMin.value = 0; }
    if (srRangeMax)  { srRangeMax.max = maxPrice; srRangeMax.value = maxPrice; }
    if (srPriceInpMin) srPriceInpMin.value = 0;
    if (srPriceInpMax) srPriceInpMax.value = maxPrice;
    updateRangeFill();
    if (srSortLabel) srSortLabel.textContent = 'Best Match';

    buildColorList();
    buildSizeGrid();
    buildDiscountFilters();
    updateAvailabilityCounts();
    applyAll();
  }

  window.__srLoadResults = loadResults;
})();
