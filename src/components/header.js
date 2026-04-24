/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — HEADER.JS — FINAL FIXED
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────
     1. PARTICLES
  ────────────────────────────────────────────────────────────── */
  function spawnHeaderParticles() {
    const container = document.getElementById('bbwHeaderParticles');
    if (!container) return;

    const colors = [
      'rgba(255,215,0,0.70)',
      'rgba(201,150,62,0.60)',
      'rgba(255,215,0,0.40)',
      'rgba(255,255,255,0.25)'
    ];

    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'bbw-hp';
      const size     = Math.random() * 4 + 2;
      const left     = Math.random() * 100;
      const duration = Math.random() * 4 + 3;
      const delay    = Math.random() * 6;
      const color    = colors[Math.floor(Math.random() * colors.length)];

      p.style.cssText = `
        width:${size}px;
        height:${size}px;
        left:${left}%;
        background:${color};
        border-radius:50%;
        animation-duration:${duration}s;
        animation-delay:-${delay}s;
        box-shadow: 0 0 ${size * 2}px ${color};
      `;
      container.appendChild(p);
    }
  }

  /* ──────────────────────────────────────────────────────────────
     2. DRAWER — Ouvrir / Fermer
  ────────────────────────────────────────────────────────────── */
  const burger      = document.getElementById('bbwBurger');
  const drawer      = document.getElementById('bbwDrawer');
  const overlay     = document.getElementById('bbwDrawerOverlay');
  const drawerClose = document.getElementById('bbwDrawerClose');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (burger) {
      burger.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
    }
    document.body.style.overflow = 'hidden';

    const body = drawer.querySelector('.bbw-drawer__body');
    if (body) body.scrollTop = 0;

    markActiveLink();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (burger) {
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
  }

  if (burger) {
    burger.addEventListener('click', () => {
      drawer && drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });
  }

  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (overlay)     overlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) closeDrawer();
  });

  let touchStartX = 0;
  if (drawer) {
    drawer.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    drawer.addEventListener('touchend', e => {
      if (touchStartX - e.changedTouches[0].clientX > 80) closeDrawer();
    }, { passive: true });
  }

  /* ──────────────────────────────────────────────────────────────
     3. SEARCH MOBILE
  ────────────────────────────────────────────────────────────── */
  const searchToggle = document.getElementById('bbwSearchToggle');
  const searchBar    = document.getElementById('bbwSearchBar');
  const searchClose  = document.getElementById('bbwSearchClose');
  const searchInput  = document.getElementById('bbwSearchInput');
  const searchEl     = document.getElementById('bbwSearch');

  function doMobileSearch() {
    const query = searchInput ? searchInput.value.trim() : '';
    if (!query) return;
    if (typeof window.showErrorPopup === 'function') {
      window.showErrorPopup(`Searching for: ${query}`);
    } else {
      console.log('[BBW4LIFE Search]:', query);
    }
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.innerWidth > 768 && searchEl && searchEl.getAttribute('data-always-visible') === 'yes') {
        const desktopInput = document.getElementById('bbwSearchDesktopInput');
        if (desktopInput) desktopInput.focus();
        return;
      }
      const isOpen = searchBar.classList.toggle('is-open');
      if (isOpen && searchInput) setTimeout(() => searchInput.focus(), 100);
    });
  }

  if (searchClose) {
    searchClose.addEventListener('click', () => {
      if (searchBar) searchBar.classList.remove('is-open');
      if (searchInput) searchInput.value = '';
    });
  }

  document.addEventListener('click', e => {
    if (!searchEl) return;
    if (!searchEl.contains(e.target)) {
      if (searchBar) searchBar.classList.remove('is-open');
    }
  });

  const searchSubmitMobile = searchBar ? searchBar.querySelector('.bbw-search__submit') : null;
  if (searchSubmitMobile) searchSubmitMobile.addEventListener('click', doMobileSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') doMobileSearch();
    });
  }

  /* ──────────────────────────────────────────────────────────────
     4. SEARCH DESKTOP ALWAYS-VISIBLE
  ────────────────────────────────────────────────────────────── */
  function applySearchSetting() {
    const allProducts = window.__allProducts || [];
    const settings = allProducts.find(p => p.type === 'settings') || {};
    const alwaysVisible = (settings.header_search_always_visible || 'no').toLowerCase() === 'yes';

    if (searchEl) {
      searchEl.setAttribute('data-always-visible', alwaysVisible ? 'yes' : 'no');
    }

    const desktopSearch = document.getElementById('bbwSearchDesktop');
    if (!desktopSearch) return;

    if (alwaysVisible && window.innerWidth > 768) {
      desktopSearch.style.display = 'flex';
    } else {
      desktopSearch.style.display = 'none';
    }
  }

  window.addEventListener('resize', applySearchSetting, { passive: true });

  function doDesktopSearch() {
    const desktopInput = document.getElementById('bbwSearchDesktopInput');
    const query = desktopInput ? desktopInput.value.trim() : '';
    if (!query) return;
    if (typeof window.showErrorPopup === 'function') {
      window.showErrorPopup(`Searching for: ${query}`);
    } else {
      console.log('[BBW4LIFE Desktop Search]:', query);
    }
  }

  const desktopSubmit = document.getElementById('bbwSearchDesktopSubmit');
  const desktopInput  = document.getElementById('bbwSearchDesktopInput');

  if (desktopSubmit) desktopSubmit.addEventListener('click', doDesktopSearch);
  if (desktopInput) {
    desktopInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') doDesktopSearch();
    });
  }

  /* ──────────────────────────────────────────────────────────────
     5. LANGUAGE DROPDOWN (header desktop)
  ────────────────────────────────────────────────────────────── */
  const langEl = document.getElementById('bbwLang');
  if (langEl) {
    const langBtn   = langEl.querySelector('.bbw-lang__btn');
    const langLabel = langEl.querySelector('.bbw-lang__label');

    if (langBtn) {
      langBtn.addEventListener('click', e => {
        e.stopPropagation();
        langEl.classList.toggle('is-open');
      });
    }

    langEl.querySelectorAll('.bbw-lang__option').forEach(opt => {
      opt.addEventListener('click', () => {
        langEl.querySelectorAll('.bbw-lang__option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        if (langLabel) langLabel.textContent = opt.dataset.lang.toUpperCase();
        langEl.classList.remove('is-open');
      });
    });

    document.addEventListener('click', e => {
      if (!langEl.contains(e.target)) langEl.classList.remove('is-open');
    });
  }

  /* ──────────────────────────────────────────────────────────────
     6. LANGUAGE DRAWER
  ────────────────────────────────────────────────────────────── */
  const drawerLangBlock = document.getElementById('bbwDrawerLang');
  if (drawerLangBlock) {
    drawerLangBlock.querySelectorAll('.bbw-drawer__lang-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        drawerLangBlock.querySelectorAll('.bbw-drawer__lang-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const langLabel = document.querySelector('.bbw-lang__label');
        if (langLabel) langLabel.textContent = opt.dataset.lang.toUpperCase();
        const desktopOpts = document.querySelectorAll('.bbw-lang__option');
        desktopOpts.forEach(o => {
          o.classList.toggle('active', o.dataset.lang === opt.dataset.lang);
        });
      });
    });
  }

  /* ──────────────────────────────────────────────────────────────
     7. ACCOUNT TRIGGER → appelle paulTrigger (script.js)
  ────────────────────────────────────────────────────────────── */
  const accountTrigger = document.getElementById('bbwAccountTrigger');
  if (accountTrigger) {
    accountTrigger.addEventListener('click', () => {
      const paulTrigger = document.getElementById('paulTrigger');
      if (paulTrigger) {
        paulTrigger.click();
      } else {
        window.location.href = '/account.html';
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────
     8. CART & WISHLIST — bridge vers script.js
     
     STRATÉGIE : on ne re-bind pas sur les mêmes éléments que script.js.
     On utilise openCartDrawer / openWishlistModal exposés sur window.
     Si pas encore prêts (race condition fetch), on poll jusqu'à 5s.
  ────────────────────────────────────────────────────────────── */
  const cartTrigger     = document.getElementById('bbwCartTrigger');
  const wishlistTrigger = document.getElementById('bbwWishlistTrigger');

  /**
   * Appelle window[fnName]() dès qu'il est disponible.
   * Poll toutes les 80ms pendant max 5s.
   */
  function callWhenReady(fnName) {
    if (typeof window[fnName] === 'function') {
      window[fnName]();
      return;
    }
    let tries = 0;
    const wait = setInterval(() => {
      if (typeof window[fnName] === 'function') {
        clearInterval(wait);
        window[fnName]();
      } else if (++tries > 62) { // ~5 secondes
        clearInterval(wait);
        console.warn('[BBW Header] fonction non trouvée après 5s :', fnName);
      }
    }, 80);
  }

  if (cartTrigger) {
    cartTrigger.addEventListener('click', () => {
      callWhenReady('openCartDrawer');
    });
    cartTrigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callWhenReady('openCartDrawer');
      }
    });
  }

  if (wishlistTrigger) {
    wishlistTrigger.addEventListener('click', () => {
      callWhenReady('openWishlistModal');
    });
    wishlistTrigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callWhenReady('openWishlistModal');
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────
     9. BADGES — fonctions exposées pour script.js
     script.js appelle : window.bbwUpdateCartBadge(n)
                         window.bbwUpdateWishlistBadge(n)
     script.js met aussi à jour directement .cart-badge et
     .wishlist-badge (querySelector), qui sont présents dans
     le header.html.
  ────────────────────────────────────────────────────────────── */
  function updateBadge(selector, count) {
    const badge = document.querySelector(selector);
    if (!badge) return;
    badge.textContent = count;
    badge.classList.toggle('active', count > 0);
  }

  window.bbwUpdateCartBadge     = (n) => updateBadge('.cart-badge', n);
  window.bbwUpdateWishlistBadge = (n) => updateBadge('.wishlist-badge', n);

  /* ──────────────────────────────────────────────────────────────
     10. SCROLL EFFECT — box-shadow header
  ────────────────────────────────────────────────────────────── */
  const header = document.getElementById('bbw-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 10) {
        header.style.boxShadow = '0 4px 30px rgba(0,0,0,0.60), 0 0 0 1px rgba(201,150,62,0.15)';
      } else {
        header.style.boxShadow = 'none';
      }
    }, { passive: true });
  }

  /* ──────────────────────────────────────────────────────────────
     11. ACTIVE LINK selon page courante
  ────────────────────────────────────────────────────────────── */
  function markActiveLink() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.bbw-drawer__link').forEach(link => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('active',
        href && (currentPath.endsWith(href) || currentPath === href)
      );
    });
  }

  /* ──────────────────────────────────────────────────────────────
     12. SOCIALS dans le drawer depuis settings
  ────────────────────────────────────────────────────────────── */
  function applySocialLinks() {
    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(p => p.type === 'settings') || {};
    const socialLinks = settings.social_links || {};

    const urlMap = {
      facebook:  socialLinks.facebook,
      instagram: socialLinks.instagram,
      tiktok:    socialLinks.tiktok,
      youtube:   socialLinks.youtube,
      pinterest: socialLinks.pinterest,
      whatsapp:  socialLinks.whatsapp,
      twitter:   socialLinks.twitter
    };

    document.querySelectorAll('.bbw-drawer__social').forEach(a => {
      const url = urlMap[a.dataset.social];
      if (url) a.href = url;
    });
  }

  /* ──────────────────────────────────────────────────────────────
     13. INIT
  ────────────────────────────────────────────────────────────── */
  function syncBadgesFromStorage() {
    try {
      const cart     = JSON.parse(localStorage.getItem('cart')     || '[]');
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');

      const cartQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
      updateBadge('.cart-badge',     cartQty);
      updateBadge('.wishlist-badge', wishlist.length);
    } catch (e) {
      // silencieux
    }
  }

  function init() {
    spawnHeaderParticles();
    markActiveLink();
    syncBadgesFromStorage();

    if (window.__allProducts && window.__allProducts.length) {
      applySearchSetting();
      applySocialLinks();
    } else {
      let tries = 0;
      const wait = setInterval(() => {
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(wait);
          applySearchSetting();
          applySocialLinks();
        } else if (++tries > 60) {
          clearInterval(wait);
        }
      }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();