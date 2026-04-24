(function CurvaSearch() {
  'use strict';

  let searchIndex = [];
  let searchReady = false;

  const TYPE_LABELS = {
    page:    'Page',
    product: 'Product',
    blog:    'Blog',
    program: 'Program',
    feature: 'Feature',
    coach:   'Coach',
    policy:  'Policy'
  };

  const TYPE_ORDER = ['product', 'program', 'page', 'blog', 'feature', 'coach', 'policy'];

  function loadIndex() {
    Promise.all([
      fetch('/search.data.json').then(r => r.json()),
      fetch('/products.data.json').then(r => r.json())
    ])
    .then(([searchData, productsData]) => {

      // Récupérer les vrais produits (sans l'objet settings)
      const realProducts = productsData.filter(p => !p.type);

      // Pour chaque entrée de type "product" dans search.data.json
      // on retrouve le produit correspondant via l'URL (ex: product1.html → index 0)
      searchIndex = searchData.map(item => {
        if (item.type !== 'product') return item;

        // Extraire le numéro depuis l'URL (ex: /products/product3.html → 3)
        const match = (item.url || '').match(/product(\d+)\.html/);
        if (!match) return item;

        const productIndex = parseInt(match[1]) - 1;
        const prod = realProducts[productIndex];
        if (!prod) return item;

        // Remplacer le titre par celui de products.data.json
        return {
          ...item,
          title: prod.title
        };
      });

      searchReady = true;
      initSearch();
    })
    .catch(() => {
      searchReady = false;
    });
  }

  function score(item, query) {
    const q = query.toLowerCase().trim();
    const title = (item.title || '').toLowerCase();
    const keywords = (item.keywords || []).join(' ').toLowerCase();
    const type = (item.type || '').toLowerCase();

    if (title === q) return 100;
    if (title.startsWith(q)) return 85;
    if (title.includes(q)) return 70;
    const words = q.split(/\s+/);
    const allInTitle = words.every(w => title.includes(w));
    if (allInTitle) return 60;
    if (keywords.includes(q)) return 50;
    const anyInKeywords = words.some(w => keywords.includes(w));
    if (anyInKeywords) return 30;
    if (type.includes(q)) return 15;
    return 0;
  }

  function search(query) {
    if (!query || query.length < 2) return [];
    const results = searchIndex
      .map(item => ({ item, score: score(item, query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return TYPE_ORDER.indexOf(a.item.type) - TYPE_ORDER.indexOf(b.item.type);
      })
      .slice(0, 8)
      .map(r => r.item);
    return results;
  }

  function highlight(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  function buildDropdown() {
    const existing = document.getElementById('curva-search-dropdown');
    if (existing) return existing;
    const div = document.createElement('div');
    div.id = 'curva-search-dropdown';
    div.className = 'curva-search-dropdown';
    div.setAttribute('role', 'listbox');
    document.body.appendChild(div);
    return div;
  }

  function positionDropdown(input, dropdown) {
    const rect = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropWidth = Math.min(Math.max(rect.width, 340), 500);

    let left = rect.left;

    if (left + dropWidth > viewportWidth - 8) {
      left = viewportWidth - dropWidth - 8;
    }

    if (left < 8) {
      left = 8;
    }

    dropdown.style.top   = (rect.bottom + 6) + 'px';
    dropdown.style.left  = left + 'px';
    dropdown.style.width = dropWidth + 'px';
  }

  function renderDropdown(dropdown, results, query) {
    dropdown.innerHTML = '';
    if (!results.length) {
      dropdown.innerHTML = `<div class="curva-search-empty">No results for "<strong>${query}</strong>"</div>`;
      return;
    }

    let lastType = null;
    results.forEach((item, idx) => {
      if (item.type !== lastType) {
        const header = document.createElement('div');
        header.className = 'curva-search-header';
        header.textContent = TYPE_LABELS[item.type] || item.type;
        dropdown.appendChild(header);
        lastType = item.type;
      }

      const link = document.createElement('a');
      link.className = 'curva-search-item';
      link.href = item.url;
      link.setAttribute('role', 'option');
      link.dataset.idx = idx;

      const icon = document.createElement('span');
      icon.className = 'curva-search-icon';
      if (item.icon && item.icon.startsWith('fa')) {
        const i = document.createElement('i');
        i.className = item.icon;
        i.style.color = '#e91e63';
        icon.appendChild(i);
      } else {
        icon.textContent = item.icon || '📄';
      }

      const text = document.createElement('span');
      text.className = 'curva-search-text';

      const title = document.createElement('span');
      title.className = 'curva-search-title';
      title.innerHTML = highlight(item.title, query);

      text.appendChild(title);

      const badge = document.createElement('span');
      badge.className = 'curva-search-badge';
      badge.textContent = TYPE_LABELS[item.type] || item.type;

      link.appendChild(icon);
      link.appendChild(text);
      link.appendChild(badge);

      link.addEventListener('mousedown', e => {
        e.preventDefault();
        window.location.href = item.url;
      });

      dropdown.appendChild(link);
    });
  }

  function initSearch() {
    const searchBars = document.querySelectorAll('.search-bar');
    if (!searchBars.length) return;

    searchBars.forEach(bar => {
      const input = bar.querySelector('input[type="text"]');
      if (!input || input.dataset.curvaSearch) return;
      input.dataset.curvaSearch = '1';

      input.removeAttribute('list');
      const oldDatalist = input.getAttribute('list');
      if (oldDatalist) {
        const dl = document.getElementById(oldDatalist);
        if (dl) dl.style.display = 'none';
      }

      const dropdown = buildDropdown();
      let activeIdx = -1;
      let currentResults = [];
      let closeTimer = null;

      function open() {
        positionDropdown(input, dropdown);
        dropdown.classList.add('open');
      }

      function close() {
        dropdown.classList.remove('open');
        activeIdx = -1;
      }

      function setActive(idx) {
        const items = dropdown.querySelectorAll('.curva-search-item');
        items.forEach((el, i) => el.classList.toggle('active', i === idx));
        activeIdx = idx;
      }

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
          if (activeIdx >= 0 && items[activeIdx]) {
            e.preventDefault();
            window.location.href = items[activeIdx].href;
          } else if (input.value.trim()) {
            const first = currentResults[0];
            if (first) window.location.href = first.url;
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

      window.addEventListener('scroll', () => {
        if (dropdown.classList.contains('open')) {
          positionDropdown(input, dropdown);
        }
      }, { passive: true });

      window.addEventListener('resize', () => {
        if (dropdown.classList.contains('open')) {
          positionDropdown(input, dropdown);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIndex);
  } else {
    loadIndex();
  }

})();