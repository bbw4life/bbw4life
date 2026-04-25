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
   On attend que script.js expose les fonctions, puis on bind.
────────────────────────────────────────────────────────────── */
(function bindCartWishlist() {
  function tryBind() {
    const cartTrigger     = document.getElementById('bbwCartTrigger');
    const wishlistTrigger = document.getElementById('bbwWishlistTrigger');

    if (cartTrigger && typeof window.openCartDrawer === 'function') {
      cartTrigger.addEventListener('click', window.openCartDrawer);
      cartTrigger.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openCartDrawer(); }
      });
    }

    if (wishlistTrigger && typeof window.openWishlistModal === 'function') {
      wishlistTrigger.addEventListener('click', window.openWishlistModal);
      wishlistTrigger.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openWishlistModal(); }
      });
    }

    // Si les deux sont bindés → terminé
    if (
      typeof window.openCartDrawer === 'function' &&
      typeof window.openWishlistModal === 'function'
    ) return;

    // Sinon réessayer
    let tries = 0;
    const wait = setInterval(() => {
      const cart     = document.getElementById('bbwCartTrigger');
      const wishlist = document.getElementById('bbwWishlistTrigger');

      if (cart && typeof window.openCartDrawer === 'function') {
        cart.addEventListener('click', window.openCartDrawer);
        cart.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openCartDrawer(); }
        });
      }

      if (wishlist && typeof window.openWishlistModal === 'function') {
        wishlist.addEventListener('click', window.openWishlistModal);
        wishlist.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openWishlistModal(); }
        });
      }

      if (
        (typeof window.openCartDrawer === 'function') &&
        (typeof window.openWishlistModal === 'function')
      ) {
        clearInterval(wait);
      }

      if (++tries > 80) clearInterval(wait); // ~6.4s max
    }, 80);
  }

  tryBind();
})();

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
    const cartQty  = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    document.querySelectorAll('.cart-badge').forEach(b => {
      b.textContent = cartQty;
      b.classList.toggle('active', cartQty > 0);
    });
    document.querySelectorAll('.wishlist-badge').forEach(b => {
      b.textContent = wishlist.length;
      b.classList.toggle('active', wishlist.length > 0);
    });
  } catch (e) {}
}


  function init() {
    spawnHeaderParticles();
    markActiveLink();
    syncBadgesFromStorage();
    // AJOUTER CES 2 LIGNES
  document.addEventListener('cart:update', syncBadgesFromStorage);
  document.addEventListener('wishlist:change', syncBadgesFromStorage);

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






/* ──────────────────────────────────────────────────────────────
     LANG SELECTOR — DESKTOP
  ────────────────────────────────────────────────────────────── */
  const langSelect   = document.getElementById('bbwLangSelect');
  const langBtn      = document.getElementById('bbwLangBtn');
  const langDropdown = document.getElementById('bbwLangDropdown');
  const langFlag     = document.getElementById('bbwLangFlag');
  const langLabel    = document.getElementById('bbwLangLabel');

  if (langBtn && langSelect) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      langSelect.classList.toggle('is-open');
      langBtn.setAttribute('aria-expanded', langSelect.classList.contains('is-open'));
    });

    document.addEventListener('click', (e) => {
      if (!langSelect.contains(e.target)) {
        langSelect.classList.remove('is-open');
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });

    if (langDropdown) {
      langDropdown.querySelectorAll('.bbw-lang-select__option').forEach(opt => {
        opt.addEventListener('click', () => {
          langDropdown.querySelectorAll('.bbw-lang-select__option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          langFlag.textContent  = opt.dataset.flag;
          langLabel.textContent = opt.dataset.label;
          langSelect.classList.remove('is-open');
          langBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     COUNTRY + LANG SELECTORS — MOBILE DRAWER
  ────────────────────────────────────────────────────────────── */
  const drawerCountryBtn  = document.getElementById('bbwDrawerCountryBtn');
  const drawerCountryList = document.getElementById('bbwDrawerCountryList');
  const drawerCountryFlag = document.getElementById('bbwDrawerCountryFlag');
  const drawerCountryLbl  = document.getElementById('bbwDrawerCountryLabel');

  const drawerLangBtn     = document.getElementById('bbwDrawerLangBtn');
  const drawerLangList    = document.getElementById('bbwDrawerLangList');
  const drawerLangFlag    = document.getElementById('bbwDrawerLangFlag');
  const drawerLangLbl     = document.getElementById('bbwDrawerLangLabel');

  if (drawerCountryBtn && drawerCountryList) {
    drawerCountryBtn.addEventListener('click', () => {
      const isOpen = drawerCountryList.classList.toggle('is-open');
      // fermer lang si ouvert
      if (isOpen && drawerLangList) drawerLangList.classList.remove('is-open');
    });
    drawerCountryList.querySelectorAll('.bbw-drawer__select-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        drawerCountryList.querySelectorAll('.bbw-drawer__select-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        drawerCountryFlag.textContent = opt.dataset.flag;
        drawerCountryLbl.textContent  = opt.dataset.label;
        drawerCountryList.classList.remove('is-open');
      });
    });
  }

  if (drawerLangBtn && drawerLangList) {
    drawerLangBtn.addEventListener('click', () => {
      const isOpen = drawerLangList.classList.toggle('is-open');
      // fermer country si ouvert
      if (isOpen && drawerCountryList) drawerCountryList.classList.remove('is-open');
    });
    drawerLangList.querySelectorAll('.bbw-drawer__select-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        drawerLangList.querySelectorAll('.bbw-drawer__select-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        drawerLangFlag.textContent = opt.dataset.flag;
        drawerLangLbl.textContent  = opt.dataset.label;
        drawerLangList.classList.remove('is-open');
      });
    });
  }