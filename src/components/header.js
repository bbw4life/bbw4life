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

      if (
        typeof window.openCartDrawer === 'function' &&
        typeof window.openWishlistModal === 'function'
      ) return;

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

        if (++tries > 80) clearInterval(wait);
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
     13. LANG + COUNTRY SELECTORS — injection dynamique depuis settings
  ────────────────────────────────────────────────────────────── */

  /* Helper : synchronise le sélecteur de langue du drawer vers un code donné */
  function _syncDrawerLang(code) {
    const langList = document.getElementById('bbwDrawerLangList');
    const langFlag = document.getElementById('bbwDrawerLangFlag');
    const langLbl  = document.getElementById('bbwDrawerLangLabel');
    if (!langList) return;

    const target = langList.querySelector('[data-lang="' + code + '"]');
    if (!target) return;

    langList.querySelectorAll('.bbw-drawer__select-opt').forEach(o => o.classList.remove('active'));
    target.classList.add('active');
    if (langFlag) langFlag.textContent = target.dataset.flag  || '';
    if (langLbl)  langLbl.textContent  = target.dataset.label || '';
  }

  function applyLangCountrySelectors() {
    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(p => p.type === 'settings') || {};

    const langCfg    = settings.language_selector || {};
    const countryCfg = settings.country_selector  || {};

    const langEnabled    = (langCfg.enabled    || 'yes').toLowerCase() === 'yes';
    const countryEnabled = (countryCfg.enabled || 'yes').toLowerCase() === 'yes';

    const langOptions    = langCfg.options    || [];
    const countryOptions = countryCfg.options || [];

    const defaultLang    = langCfg.default_lang       || 'en';
    const defaultCountry = countryCfg.default_country || 'us';

    /* ══════════════════════════════════════════════════════════
       1. DESKTOP LANG DROPDOWN
    ══════════════════════════════════════════════════════════ */
    if (langEnabled && langOptions.length) {
      const dropdown = document.getElementById('bbwLangDropdown');
      const flagEl   = document.getElementById('bbwLangFlag');
      const labelEl  = document.getElementById('bbwLangLabel');

      if (dropdown) {
        dropdown.innerHTML = '';

        langOptions.forEach(opt => {
          const btn = document.createElement('button');
          btn.className     = 'bbw-lang-select__option' + (opt.code === defaultLang ? ' active' : '');
          btn.dataset.lang  = opt.code;
          btn.dataset.flag  = opt.flag;
          btn.dataset.label = opt.label;
          btn.setAttribute('role', 'option');
          btn.innerHTML = `
            <span class="opt-flag">${opt.flag}</span>
            <span class="opt-name">${opt.name}</span>
            <span class="opt-check">✓</span>
          `;

          btn.addEventListener('click', () => {
            dropdown.querySelectorAll('.bbw-lang-select__option').forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            if (flagEl)  flagEl.textContent  = opt.flag;
            if (labelEl) labelEl.textContent = opt.label;
            const langSelectEl = document.getElementById('bbwLangSelect');
            const langBtnEl    = document.getElementById('bbwLangBtn');
            if (langSelectEl) langSelectEl.classList.remove('is-open');
            if (langBtnEl)    langBtnEl.setAttribute('aria-expanded', 'false');
            _syncDrawerLang(opt.code);
          });

          dropdown.appendChild(btn);
        });

        /* Défaut affiché dans le bouton */
        const defLang = langOptions.find(o => o.code === defaultLang) || langOptions[0];
        if (defLang) {
          if (flagEl)  flagEl.textContent  = defLang.flag;
          if (labelEl) labelEl.textContent = defLang.label;
        }
      }
    }

    /* ══════════════════════════════════════════════════════════
       2. MOBILE DRAWER — COUNTRY LIST
    ══════════════════════════════════════════════════════════ */
    if (countryEnabled && countryOptions.length) {
      const countryList = document.getElementById('bbwDrawerCountryList');
      const countryFlag = document.getElementById('bbwDrawerCountryFlag');
      const countryLbl  = document.getElementById('bbwDrawerCountryLabel');

      if (countryList) {
        countryList.innerHTML = '';

        countryOptions.forEach(opt => {
          const btn = document.createElement('button');
          btn.className       = 'bbw-drawer__select-opt' + (opt.code === defaultCountry ? ' active' : '');
          btn.dataset.country = opt.code;
          btn.dataset.flag    = opt.flag;
          btn.dataset.label   = opt.label;
          btn.dataset.lang    = opt.lang || '';
          btn.innerHTML = `
            <span class="opt-flag">${opt.flag}</span>
            <span>${opt.name}</span>
            <span class="opt-check">✓</span>
          `;

          btn.addEventListener('click', () => {
            countryList.querySelectorAll('.bbw-drawer__select-opt').forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            if (countryFlag) countryFlag.textContent = opt.flag;
            if (countryLbl)  countryLbl.textContent  = opt.label;
            countryList.classList.remove('is-open');
            /* Sync automatique de la langue quand on change de pays */
            if (opt.lang) _syncDrawerLang(opt.lang);
          });

          countryList.appendChild(btn);
        });

        /* Défaut */
        const defCountry = countryOptions.find(o => o.code === defaultCountry) || countryOptions[0];
        if (defCountry) {
          if (countryFlag) countryFlag.textContent = defCountry.flag;
          if (countryLbl)  countryLbl.textContent  = defCountry.label;
        }
      }
    }

    /* ══════════════════════════════════════════════════════════
       3. MOBILE DRAWER — LANG LIST
    ══════════════════════════════════════════════════════════ */
    if (langEnabled && langOptions.length) {
      const langList = document.getElementById('bbwDrawerLangList');
      const langFlag = document.getElementById('bbwDrawerLangFlag');
      const langLbl  = document.getElementById('bbwDrawerLangLabel');

      if (langList) {
        langList.innerHTML = '';

        langOptions.forEach(opt => {
          const btn = document.createElement('button');
          btn.className    = 'bbw-drawer__select-opt' + (opt.code === defaultLang ? ' active' : '');
          btn.dataset.lang  = opt.code;
          btn.dataset.flag  = opt.flag;
          btn.dataset.label = opt.name;
          btn.innerHTML = `
            <span class="opt-flag">${opt.flag}</span>
            <span>${opt.name}</span>
            <span class="opt-check">✓</span>
          `;

          btn.addEventListener('click', () => {
            langList.querySelectorAll('.bbw-drawer__select-opt').forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            if (langFlag) langFlag.textContent = opt.flag;
            if (langLbl)  langLbl.textContent  = opt.name;
            langList.classList.remove('is-open');
          });

          langList.appendChild(btn);
        });

        /* Défaut */
        const defLang = langOptions.find(o => o.code === defaultLang) || langOptions[0];
        if (defLang) {
          if (langFlag) langFlag.textContent = defLang.flag;
          if (langLbl)  langLbl.textContent  = defLang.name;
        }
      }
    }

    /* ══════════════════════════════════════════════════════════
       4. BIND OPEN/CLOSE pour les boutons du drawer (mobile)
          — on rebinde ici APRÈS avoir injecté les options
    ══════════════════════════════════════════════════════════ */
    const drawerCountryBtn  = document.getElementById('bbwDrawerCountryBtn');
    const drawerCountryList = document.getElementById('bbwDrawerCountryList');
    const drawerLangBtn     = document.getElementById('bbwDrawerLangBtn');
    const drawerLangList    = document.getElementById('bbwDrawerLangList');

    if (drawerCountryBtn && drawerCountryList) {
      /* Retire un éventuel listener précédent en clonant */
      const newCountryBtn = drawerCountryBtn.cloneNode(true);
      drawerCountryBtn.parentNode.replaceChild(newCountryBtn, drawerCountryBtn);
      newCountryBtn.addEventListener('click', () => {
        const isOpen = drawerCountryList.classList.toggle('is-open');
        if (isOpen && drawerLangList) drawerLangList.classList.remove('is-open');
      });
    }

    if (drawerLangBtn && drawerLangList) {
      const newLangBtn = drawerLangBtn.cloneNode(true);
      drawerLangBtn.parentNode.replaceChild(newLangBtn, drawerLangBtn);
      newLangBtn.addEventListener('click', () => {
        const isOpen = drawerLangList.classList.toggle('is-open');
        if (isOpen && drawerCountryList) drawerCountryList.classList.remove('is-open');
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     14. DESKTOP LANG BTN — open/close dropdown
         (bind immédiat, les options sont injectées plus tard)
  ────────────────────────────────────────────────────────────── */
  const langSelectEl = document.getElementById('bbwLangSelect');
  const langBtnEl    = document.getElementById('bbwLangBtn');

  if (langBtnEl && langSelectEl) {
    langBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      langSelectEl.classList.toggle('is-open');
      langBtnEl.setAttribute('aria-expanded', langSelectEl.classList.contains('is-open'));
    });

    document.addEventListener('click', (e) => {
      if (!langSelectEl.contains(e.target)) {
        langSelectEl.classList.remove('is-open');
        langBtnEl.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────
     15. BADGES — sync depuis localStorage
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

  /* ──────────────────────────────────────────────────────────────
     16. INIT
  ────────────────────────────────────────────────────────────── */
  function init() {
    spawnHeaderParticles();
    markActiveLink();
    syncBadgesFromStorage();

    document.addEventListener('cart:update',      syncBadgesFromStorage);
    document.addEventListener('wishlist:change',  syncBadgesFromStorage);

    if (window.__allProducts && window.__allProducts.length) {
      applySearchSetting();
      applySocialLinks();
      applyLangCountrySelectors();
    } else {
      let tries = 0;
      const wait = setInterval(() => {
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(wait);
          applySearchSetting();
          applySocialLinks();
          applyLangCountrySelectors();
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