(function () {
  'use strict';

  // ── Cache localStorage du HTML header/footer/breadcrumb/newsletter ──
  // But : éviter le flash visuel de rechargement quand on revient sur une
  // page déjà visitée (header/footer/etc. réinjectés à chaque fois par
  // fetch). On sert la version en cache immédiatement (sans attendre le
  // réseau), puis on revalide en arrière-plan pour garder le cache à jour
  // si header.html/footer.html changent plus tard.
  var CACHE_VERSION = 'v2';
  var CACHE_PREFIX = 'bbw_layout_cache_' + CACHE_VERSION + '_';
  var CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h : re-fetch même si cache présent, au cas où le contenu a changé

  function cacheKey(url) { return CACHE_PREFIX + url; }

  function readCache(url) {
    try {
      var raw = localStorage.getItem(cacheKey(url));
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || typeof entry.html !== 'string') return null;
      return entry;
    } catch (e) { return null; }
  }

  function writeCache(url, html) {
    try {
      localStorage.setItem(cacheKey(url), JSON.stringify({ html: html, ts: Date.now() }));
    } catch (e) { /* quota dépassé ou storage indisponible — pas bloquant */ }
  }

  /**
   * Charge un fragment HTML dans un container.
   * - Si un cache valide existe : injection immédiate (synchrone), puis
   *   revalidation silencieuse en arrière-plan (le DOM n'est ré-injecté
   *   que si le contenu réseau diffère du cache, pour éviter tout flash).
   * - Sinon : fetch normal, injection + mise en cache pour la prochaine fois.
   * @param {string} url
   * @param {string} containerId
   * @param {(html: string) => void} onInject - reçoit le HTML injecté (pour poser des <script> après coup, dispatch d'event, etc.)
   */
  function loadFragment(url, containerId, onInject) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var cached = readCache(url);
    var injectedFromCache = false;

    if (cached) {
      container.innerHTML = cached.html;
      injectedFromCache = true;
      if (onInject) onInject(cached.html);
    }

    var isStale = !cached || (Date.now() - cached.ts) > CACHE_MAX_AGE_MS;

    // Si on a servi depuis le cache et qu'il n'est pas trop vieux, on ne
    // revalide même pas en arrière-plan tout de suite — évite un fetch
    // réseau inutile à chaque navigation. Le cache expire après 24h.
    if (injectedFromCache && !isStale) return;

    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        writeCache(url, html);
        // Si rien n'était affiché (pas de cache), ou si le contenu réseau
        // diffère du cache déjà affiché, on (ré)injecte.
        if (!injectedFromCache || html !== cached.html) {
          container.innerHTML = html;
          if (onInject) onInject(html);
        }
      })
      .catch(function (err) {
        console.error('[layout-loader] ' + url + ' load error:', err);
      });
  }

  function appendScript(src) {
    var s = document.createElement('script');
    s.src = src;
    document.body.appendChild(s);
  }

  // ── Header ──
  loadFragment('/src/components/header.html', 'header-container', function () {
    appendScript('/src/components/header.js');
  });

  // ── Breadcrumb (outerHTML : remplace le placeholder par le vrai <nav>) ──
  (function loadBreadcrumb() {
    var container = document.getElementById('breadcrumb-container');
    if (!container) return;
    var url = '/src/components/breadcrumb.html';
    var cached = readCache(url);

    if (cached) {
      container.outerHTML = cached.html;
    }

    var isStale = !cached || (Date.now() - cached.ts) > CACHE_MAX_AGE_MS;
    if (cached && !isStale) return;

    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        writeCache(url, html);
        // outerHTML ne peut être réappliqué qu'une fois : si déjà remplacé
        // par le cache, on ne retouche le DOM que si le contenu a changé,
        // en ciblant à nouveau via un sélecteur qui survit au remplacement.
        if (!cached) {
          container.outerHTML = html;
        }
        // Si cached existait déjà et que html diffère, on laisse la version
        // cache affichée pour cette visite (évite un flash) ; le cache mis à
        // jour ci-dessus sera utilisé dès la prochaine navigation.
      })
      .catch(function (err) {
        console.error('[layout-loader] breadcrumb load error:', err);
      });
  })();

  // ── Footer ──
  loadFragment('/src/components/footer.html', 'footer-container', function () {
    document.dispatchEvent(new Event('footer:loaded'));
    appendScript('/src/components/footer.js');
  });

  // ── Newsletter ──
  loadFragment('/src/components/newsletter.html', 'newsletter-container');
})();
