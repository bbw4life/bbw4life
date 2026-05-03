(function BlogBannerSearch() {
  'use strict';

  /* ── Flatten blog-articles.json en tableau plat pour la recherche ── */
  function flattenArticles(data) {
    var articles = [];

    // Featured
    if (data.featured) {
      articles.push({
        id:       'featured',
        title:    data.featured.title,
        category: data.featured.badge,
        excerpt:  data.featured.excerpt,
        author:   data.featured.author.name,
        views:    data.featured.views,
        date:     data.featured.date,
        url:      data.featured.url,
        selector: '#featured-article'
      });
    }

    // Cards
    if (data.cards) {
      data.cards.forEach(function (card) {
        articles.push({
          id:       card.id,
          title:    card.title,
          category: card.badge,
          excerpt:  card.excerpt,
          author:   card.author.name,
          views:    card.views,
          date:     card.date,
          url:      card.url,
          selector: '#' + card.id
        });
      });
    }

    // Popular
    if (data.popular) {
      data.popular.forEach(function (item) {
        articles.push({
          id:       'popular-' + item.rank,
          title:    item.title,
          category: item.category,
          excerpt:  '',
          author:   '',
          views:    item.views,
          date:     '',
          url:      item.url,
          selector: '#most-popular'
        });
      });
    }

    return articles;
  }

  /* ── Normalise une chaîne ── */
  function normalize(s) {
    return (s || '').toLowerCase().trim();
  }

  /* ── Recherche dans le tableau plat ── */
  function search(articles, q) {
    if (!q || q.length < 2) return [];
    var n = normalize(q);
    return articles.filter(function (a) {
      return normalize(a.title).includes(n)    ||
             normalize(a.category).includes(n) ||
             normalize(a.excerpt).includes(n)  ||
             normalize(a.author).includes(n)   ||
             normalize(a.date).includes(n);
    }).slice(0, 7);
  }

  /* ── Surligne le terme recherché ── */
  function highlight(text, q) {
    if (!q || !text) return text || '';
    var esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp('(' + esc + ')', 'gi'), '<mark>$1</mark>');
  }

  /* ── Récupère la position absolue d'un élément ── */
  function getAbsTop(el) {
    var top = 0, node = el;
    while (node) { top += node.offsetTop || 0; node = node.offsetParent; }
    return top;
  }

  /* ── Scroll vers l'article et highlight temporaire ── */
  function scrollToArticle(article) {
    var el = document.querySelector(article.selector);
    if (!el) return;
    if (el.style.display === 'none') el.style.display = 'block';
    var headerH = (document.querySelector('.sticky-header') || {}).offsetHeight || 80;
    var target  = Math.max(0, getAbsTop(el) - headerH - 20);
    window.scrollTo({ top: target, behavior: 'smooth' });
    el.classList.add('bsearch-highlight');
    setTimeout(function () { el.classList.remove('bsearch-highlight'); }, 2400);
  }

  /* ── Initialisation ── */
  function init(articles) {

    var input = document.getElementById('blog-search-input');
    if (!input) return;

    var wrapper = input.closest('.blog-search');

    /* Créer le dropdown et l'ajouter au body */
    var drop = document.createElement('div');
    drop.className = 'bsearch-drop';
    document.body.appendChild(drop);

    var activeIdx = -1;
    var current   = [];
    var closeT    = null;

    /* ── Positionne le dropdown sous l'input ── */
    function positionDrop() {
      var rect      = input.getBoundingClientRect();
      drop.style.top   = (rect.bottom + window.scrollY + 6) + 'px';
      drop.style.left  = rect.left + 'px';
      drop.style.width = rect.width + 'px';
    }

    /* ── Rendu du dropdown ── */
    function render(results, q) {
      drop.innerHTML = '';

      if (!results.length) {
        drop.innerHTML =
          '<div class="bsearch-empty">Aucun article trouvé pour "<strong>' +
          q.replace(/</g, '&lt;') + '</strong>"</div>';
        return;
      }

      results.forEach(function (a) {
        var item = document.createElement('div');
        item.className = 'bsearch-item';

        /* Métadonnées (auteur, vues, date) */
        var meta = [];
        if (a.author) meta.push('<span class="bsearch-meta-author"><i class="fi fi-rr-user"></i> ' + a.author + '</span>');
        if (a.views)  meta.push('<span class="bsearch-meta-views"><i class="fi fi-rr-eye"></i> ' + a.views + '</span>');
        if (a.date)   meta.push('<span class="bsearch-meta-date"><i class="fi fi-rr-calendar"></i> ' + a.date + '</span>');

        item.innerHTML =
          '<div class="bsearch-info">' +
            '<div class="bsearch-cat">' + (a.category || '') + '</div>' +
            '<div class="bsearch-title">' + highlight(a.title, q) + '</div>' +
            (meta.length ? '<div class="bsearch-meta">' + meta.join('') + '</div>' : '') +
          '</div>' +
          '<div class="bsearch-actions">' +
            '<button class="bsearch-btn-show" title="Faire défiler jusqu\'à l\'article">&#8595; Voir</button>' +
            '<button class="bsearch-btn-read" title="Lire l\'article">Lire →</button>' +
          '</div>';

        /* Clic sur "Voir" */
        item.querySelector('.bsearch-btn-show').addEventListener('mousedown', function (e) {
          e.preventDefault();
          close();
          input.value = '';
          scrollToArticle(a);
        });

        /* Clic sur "Lire" */
        item.querySelector('.bsearch-btn-read').addEventListener('mousedown', function (e) {
          e.preventDefault();
          window.location.href = a.url;
        });

        /* Clic sur la ligne entière */
        item.addEventListener('mousedown', function (e) {
          if (e.target.tagName === 'BUTTON') return;
          e.preventDefault();
          close();
          input.value = '';
          scrollToArticle(a);
        });

        drop.appendChild(item);
      });
    }

    function open()  { positionDrop(); drop.classList.add('open'); }
    function close() { drop.classList.remove('open'); activeIdx = -1; }

    /* ── Navigation clavier ── */
    function setActive(idx) {
      var items = drop.querySelectorAll('.bsearch-item');
      items.forEach(function (el, i) {
        el.classList.toggle('bsearch-active', i === idx);
      });
      activeIdx = idx;
    }

    /* ── Lancer la recherche ── */
    function doSearch() {
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      current = search(articles, q);
      render(current, q);
      open();
      activeIdx = -1;
    }

    /* ── Action sur Entrée ou clic icône ── */
    function doAction() {
      var art = (activeIdx >= 0 && current[activeIdx]) ? current[activeIdx] : current[0];
      if (!art) return;
      close();
      input.value = '';
      scrollToArticle(art);
    }

    /* ── Événements ── */
    input.addEventListener('input', doSearch);

    input.addEventListener('keydown', function (e) {
      var items = drop.querySelectorAll('.bsearch-item');
      if      (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
      else if (e.key === 'Enter')     { e.preventDefault(); doAction(); }
      else if (e.key === 'Escape')    { close(); input.blur(); }
    });

    /* Icône recherche cliquable */
    var icon = wrapper ? wrapper.querySelector('.search-icon-inner') : null;
    if (icon) {
      icon.style.cursor = 'pointer';
      icon.addEventListener('click', doAction);
    }

    /* Bouton "Search" cliquable */
    var searchBtn = wrapper ? wrapper.querySelector('.search-btn') : null;
    if (searchBtn) {
      searchBtn.addEventListener('click', function (e) {
        e.preventDefault();
        doAction();
      });
    }

    input.addEventListener('focus', function () {
      clearTimeout(closeT);
      if (input.value.trim().length >= 2) open();
    });

    input.addEventListener('blur', function () {
      closeT = setTimeout(close, 180);
    });

    window.addEventListener('scroll', function () {
      if (drop.classList.contains('open')) positionDrop();
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (drop.classList.contains('open')) positionDrop();
    });
  }

  /* ── Chargement du JSON ── */
  function load() {
    fetch('/blog/blog-articles.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var articles = flattenArticles(data);
        init(articles);
      })
      .catch(function (err) {
        console.warn('blog-articles.json introuvable :', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

})();