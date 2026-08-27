(function BBW4LIFESearch() {
  'use strict';

  let searchIndex = [];
  let searchReady = false;

  /* ──────────────────────────────────────────────────────────────
     TYPE LABELS & ORDER
  ────────────────────────────────────────────────────────────── */
  const TYPE_LABELS = {
    page:    'Page',
    product: 'Product',
    blog:    'Blog',
    program: 'Program',
    feature: 'Feature',
    coach:   'Coach',
    policy:  'Policy'
  };

  const TYPE_ORDER = ['product', 'page', 'blog', 'feature', 'coach', 'program', 'policy'];

  /* ──────────────────────────────────────────────────────────────
     LOAD INDEX
     Merge search.data.json titles with real product titles
     from products.data.json (window.__allProducts)
  ────────────────────────────────────────────────────────────── */
  function loadIndex() {
    const fetchSearch   = fetch('/search.data.json').then(r => r.json());
    const fetchProducts = window.__allProducts && window.__allProducts.length
      ? Promise.resolve(window.__allProducts)
      : fetch('/products.data.json').then(r => r.json());

    Promise.all([fetchSearch, fetchProducts])
      .then(([searchData, productsData]) => {

        // Store in global if not already
        if (!window.__allProducts || !window.__allProducts.length) {
          window.__allProducts = productsData;
        }

        // Real products (exclude settings object)
        const realProducts = productsData.filter(p => !p.type);

        // Build a map: product id → product (e.g. "Pdg-Francenel-product7" → {...})
        const productById = {};
        realProducts.forEach(p => { productById[p.id] = p; });

        // Merge: for type="product" entries, use the real title + image from products.data.json
        searchIndex = searchData.map(item => {
          if (item.type !== 'product') return item;

          // Match by URL pattern: /products/productN.html → "Pdg-Francenel-productN"
          const match = (item.url || '').match(/product(\d+)\.html/);
          if (!match) return item;

          const productId = 'Pdg-Francenel-product' + match[1];
          const prod = productById[productId];
          if (!prod) return item;

          // Enrich with real title and additional auto-keywords
          const autoKeywords = [
            prod.title,
            prod.description,
            prod.badge && prod.badge.text,
            ...(prod.colors || []).map(c => c.name),
            ...(prod.sizes  || [])
          ].filter(Boolean).map(k => k.toLowerCase());

          return {
            ...item,
            title:    prod.title,
            image:    prod.image  || item.image  || '',
            price:    prod.price  || null,
            keywords: [...(item.keywords || []), ...autoKeywords]
          };
        });

        searchReady = true;
        initSearch();
      })
      .catch(err => {
        console.warn('[BBW4LIFE Search] Failed to load index:', err);
        searchReady = false;
      });
  }

  /* ──────────────────────────────────────────────────────────────
     SCORING
     Au-delà des correspondances exactes/partielles de la requête entière,
     on mesure aussi la PROPORTION de mots de la requête retrouvés dans le
     titre (et inversement un bonus si les mots du titre couvrent bien la
     requête) — pour classer plus finement les titres "les plus proches"
     d'une recherche multi-mots, plutôt qu'un simple oui/non par mot.
  ────────────────────────────────────────────────────────────── */
  function wordOverlapScore(queryWords, titleWords) {
    if (!queryWords.length || !titleWords.length) return 0;
    let matched = 0;
    queryWords.forEach(qw => {
      if (titleWords.some(tw => tw === qw || tw.includes(qw) || qw.includes(tw))) matched++;
    });
    return matched / queryWords.length; // 0..1 — proportion de mots de la requête couverts
  }

  function score(item, query) {
    const q        = query.toLowerCase().trim();
    const title    = (item.title    || '').toLowerCase();
    const keywords = (item.keywords || []).join(' ').toLowerCase();
    const type     = (item.type     || '').toLowerCase();
    const words    = q.split(/\s+/).filter(Boolean);
    const titleWords = title.split(/\s+/).filter(Boolean);

    if (title === q)          return 100;
    if (title.startsWith(q))  return 88;
    if (title.includes(q))    return 75;

    // Correspondance partielle graduée par mots communs titre/requête —
    // remplace l'ancien "tout ou rien" (words.every) par une note continue,
    // pour distinguer un titre qui matche 3/3 mots d'un titre qui n'en
    // matche que 1/3, même quand aucun des deux n'est un match parfait.
    const overlap = wordOverlapScore(words, titleWords);
    if (overlap > 0) {
      // 40 (au moins un mot commun) → 65 (tous les mots de la requête présents)
      return Math.round(40 + overlap * 25);
    }

    if (keywords.includes(q))                     return 52;
    if (words.some(w => keywords.includes(w)))    return 32;
    if (type.includes(q))                         return 15;
    return 0;
  }

  /* ──────────────────────────────────────────────────────────────
     SEARCH
  ────────────────────────────────────────────────────────────── */
  function search(query) {
    if (!query || query.length < 2) return [];

    return searchIndex
      .map(item => ({ item, score: score(item, query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return TYPE_ORDER.indexOf(a.item.type) - TYPE_ORDER.indexOf(b.item.type);
      })
      .slice(0, 8)
      .map(r => r.item);
  }

  /* ──────────────────────────────────────────────────────────────
     SEARCH ALWAYS — pour la page de résultats dédiée (search-results.html) :
     jamais de tableau vide tant qu'il y a un index chargé. Pas de seuil de
     longueur (même 1 lettre), pas de filtre "score > 0" strict, pas de
     limite à 8 — tout est classé du plus proche au moins proche, et
     search-filters.js se charge ensuite de filtrer/paginer côté page.
  ────────────────────────────────────────────────────────────── */
  function searchAlways(query) {
    const q = (query || '').trim();
    if (!q) return [];

    const ranked = searchIndex
      .map(item => ({ item, score: score(item, q) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return TYPE_ORDER.indexOf(a.item.type) - TYPE_ORDER.indexOf(b.item.type);
      });

    const withScore = ranked.filter(r => r.score > 0);
    if (withScore.length) return withScore.map(r => r.item);

    // Aucun score positif (ex: 1 lettre isolée, faute de frappe totale) —
    // fallback : classe quand même tout l'index par proximité de caractères
    // partagés avec la requête, pour ne jamais renvoyer un résultat vide.
    const ql = q.toLowerCase();
    return searchIndex
      .map(item => {
        const title = (item.title || '').toLowerCase();
        let shared = 0;
        for (const ch of ql) { if (title.includes(ch)) shared++; }
        return { item, shared };
      })
      .sort((a, b) => b.shared - a.shared)
      .map(r => r.item);
  }

  /* ──────────────────────────────────────────────────────────────
     HIGHLIGHT
  ────────────────────────────────────────────────────────────── */
  function highlight(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  /* ──────────────────────────────────────────────────────────────
     DROPDOWN — BUILD ONCE, REUSE
  ────────────────────────────────────────────────────────────── */
  function buildDropdown() {
    const existing = document.getElementById('bbw-search-dropdown');
    if (existing) return existing;

    const div = document.createElement('div');
    div.id        = 'bbw-search-dropdown';
    div.className = 'curva-search-dropdown';
    div.setAttribute('role', 'listbox');
    document.body.appendChild(div);
    return div;
  }

  /* ──────────────────────────────────────────────────────────────
     DROPDOWN — POSITION
  ────────────────────────────────────────────────────────────── */
  function positionDropdown(input, dropdown) {
    const rect         = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropWidth    = Math.min(Math.max(rect.width, 320), 520);

    let left = rect.left + window.scrollX;

    if (left + dropWidth > viewportWidth - 8) {
      left = viewportWidth - dropWidth - 8;
    }
    if (left < 8) left = 8;

    dropdown.style.top    = (rect.bottom + window.scrollY + 6) + 'px';
    dropdown.style.left   = left + 'px';
    dropdown.style.width  = dropWidth + 'px';
    dropdown.style.position = 'absolute';
  }

  /* ──────────────────────────────────────────────────────────────
     DROPDOWN — RENDER
  ────────────────────────────────────────────────────────────── */
  function renderDropdown(dropdown, results, query) {
    dropdown.innerHTML = '';

    if (!results.length) {
      dropdown.innerHTML =
        `<div class="curva-search-empty">No results for "<strong>${escapeHtml(query)}</strong>"</div>`;
      return;
    }

    let lastType = null;

    results.forEach((item, idx) => {

      // Section header when type changes
      if (item.type !== lastType) {
        const header = document.createElement('div');
        header.className   = 'curva-search-header';
        header.textContent = TYPE_LABELS[item.type] || item.type;
        dropdown.appendChild(header);
        lastType = item.type;
      }

      const link = document.createElement('a');
      link.className = 'curva-search-item';
      link.href      = item.url;
      link.setAttribute('role', 'option');
      link.dataset.idx = idx;

      // Icon — kept as before for every result type.
      const icon = document.createElement('span');
      icon.className = 'curva-search-icon';
      if (item.icon && (item.icon.startsWith('fas ') || item.icon.startsWith('far ') || item.icon.startsWith('fab '))) {
        const i = document.createElement('i');
        i.className = item.icon;
        i.style.color = '#c0385e';
        icon.appendChild(i);
      } else {
        icon.textContent = item.icon || '📄';
      }

      // Thumbnail — real product image (from products.data.json), shown
      // next to the icon for product results only.
      let thumb = null;
      if (item.type === 'product' && item.image) {
        thumb = document.createElement('span');
        thumb.className = 'curva-search-thumb';
        const img = document.createElement('img');
        img.className = 'curva-search-thumb-img';
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      }

      // Text block
      const text = document.createElement('span');
      text.className = 'curva-search-text';

      const title = document.createElement('span');
      title.className = 'curva-search-title';
      title.innerHTML = highlight(escapeHtml(item.title), query);

      // Optional price for products
      if (item.type === 'product' && item.price) {
        const price = document.createElement('span');
        price.className   = 'curva-search-price';
        price.textContent = '$' + parseFloat(item.price).toFixed(2);
        text.appendChild(title);
        text.appendChild(price);
      } else {
        text.appendChild(title);
      }

      // Badge
      const badge = document.createElement('span');
      badge.className   = 'curva-search-badge';
      badge.textContent = TYPE_LABELS[item.type] || item.type;

      link.appendChild(icon);
      if (thumb) link.appendChild(thumb);
      link.appendChild(text);
      link.appendChild(badge);

      // Navigation on click — a result can carry a custom "action" instead
      // of a real URL (ex: Affiliate Program opens the footer popup via
      // window.openAffiliatePopup, exposed by src/components/footer.js,
      // rather than navigating to a page).
      link.addEventListener('mousedown', e => {
        e.preventDefault();
        if (item.action === 'open-affiliate-popup' && typeof window.openAffiliatePopup === 'function') {
          window.openAffiliatePopup();
          return;
        }
        window.location.href = item.url;
      });

      dropdown.appendChild(link);
    });
  }

  /* ──────────────────────────────────────────────────────────────
     UTILITY — escape HTML
  ────────────────────────────────────────────────────────────── */
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ──────────────────────────────────────────────────────────────
     BIND ONE INPUT
  ────────────────────────────────────────────────────────────── */
  function bindInput(input, dropdown) {
    if (input.dataset.bbwSearch) return;
    input.dataset.bbwSearch = '1';

    // Remove native datalist
    input.removeAttribute('list');
    const oldList = input.getAttribute('list');
    if (oldList) {
      const dl = document.getElementById(oldList);
      if (dl) dl.style.display = 'none';
    }

    let activeIdx      = -1;
    let currentResults = [];
    let closeTimer     = null;

    const open = () => {
      positionDropdown(input, dropdown);
      dropdown.classList.add('open');
    };

    const close = () => {
      dropdown.classList.remove('open');
      activeIdx = -1;
    };

    const setActive = idx => {
      const items = dropdown.querySelectorAll('.curva-search-item');
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
      activeIdx = idx;
    };

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (q.length < 2) { close(); return; }
      currentResults = search(q);
      renderDropdown(dropdown, currentResults, q);
      positionDropdown(input, dropdown);
      open();
      activeIdx = -1;
    });

    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('.curva-search-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(activeIdx + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(activeIdx - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && items[activeIdx]) {
          // Suggestion précise sélectionnée aux flèches — comportement inchangé.
          window.location.href = items[activeIdx].href;
        } else {
          // Enter "brut" (aucune suggestion sélectionnée) — nouvelle page
          // de résultats dédiée, plutôt que de sauter directement vers la
          // première suggestion du dropdown.
          const q = input.value.trim();
          if (q) window.location.href = '/search-results.html?q=' + encodeURIComponent(q);
        }
        close();
      } else if (e.key === 'Escape') {
        close();
        input.blur();
      }
    });

    input.addEventListener('focus', () => {
      clearTimeout(closeTimer);
      if (input.value.trim().length >= 2) {
        positionDropdown(input, dropdown);
        open();
      }
    });

    input.addEventListener('blur', () => {
      closeTimer = setTimeout(close, 200);
    });

    window.addEventListener('scroll',  () => { if (dropdown.classList.contains('open')) positionDropdown(input, dropdown); }, { passive: true });
    window.addEventListener('resize',  () => { if (dropdown.classList.contains('open')) positionDropdown(input, dropdown); });
  }

  /* ──────────────────────────────────────────────────────────────
     INIT SEARCH — binds all search inputs found in the page
     Supports: .search-bar input, #bbwSearchInput, #bbwSearchDesktopInput
  ────────────────────────────────────────────────────────────── */
  function initSearch() {
    const dropdown = buildDropdown();

    // 1. Classic .search-bar wrappers (original selector)
    document.querySelectorAll('.search-bar input[type="text"]').forEach(input => {
      bindInput(input, dropdown);
    });

    // 2. BBW header mobile search input
    const mobileInput = document.getElementById('bbwSearchInput');
    if (mobileInput) bindInput(mobileInput, dropdown);

    // 3. BBW header desktop search input
    const desktopInput = document.getElementById('bbwSearchDesktopInput');
    if (desktopInput) bindInput(desktopInput, dropdown);

    // 4. Search results page — barre de recherche en haut de page
    const srInput = document.getElementById('srSearchInput');
    if (srInput) bindInput(srInput, dropdown);
  }

  /* ──────────────────────────────────────────────────────────────
     BOOTSTRAP
  ────────────────────────────────────────────────────────────── */
  function bootstrap() {
    // If products already loaded, no need to re-fetch
    loadIndex();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Expose for external use
  window.bbwSearch = { search, searchAlways, highlight, isReady: () => searchReady };

})();