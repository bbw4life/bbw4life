/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — HEADER.JS — FINAL FIXED
   Préfixe dropdown : bbwHdr* → zéro conflit avec footer
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
      const p        = document.createElement('div');
      p.className    = 'bbw-hp';
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
        box-shadow:0 0 ${size * 2}px ${color};
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

  if (burger)      burger.addEventListener('click', () => drawer && drawer.classList.contains('is-open') ? closeDrawer() : openDrawer());
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (overlay)     overlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) closeDrawer();
  });

  let touchStartX = 0;
  if (drawer) {
    drawer.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    drawer.addEventListener('touchend',   e => {
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
  const headerEl     = document.getElementById('bbw-header');

  // `backdrop-filter` sur .bbw-header--scrolled crée un nouveau containing
  // block pour tout descendant en position:fixed (dont .bbw-search__bar en
  // mobile) — si le header est scrollé quand on ouvre la recherche, la barre
  // se positionne alors relativement au header au lieu du viewport et
  // "tombe" sous le header au lieu de le recouvrir. On neutralise donc le
  // blur du header tant que la recherche mobile est ouverte.
  function setSearchOpen(open) {
    if (searchBar) searchBar.classList.toggle('is-open', open);
    if (headerEl)  headerEl.classList.toggle('bbw-header--search-open', open);
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', e => {
      e.stopPropagation();
      if (window.innerWidth > 768 && searchEl && searchEl.getAttribute('data-always-visible') === 'yes') {
        const di = document.getElementById('bbwSearchDesktopInput');
        if (di) di.focus();
        return;
      }
      const isOpen = searchBar && !searchBar.classList.contains('is-open');
      setSearchOpen(isOpen);
      if (isOpen && searchInput) setTimeout(() => searchInput.focus(), 100);
    });
  }

  // Mode "always visible" mobile (barre compacte intégrée au header) :
  // taper/toucher le champ doit quand même déclencher le même overlay
  // plein-largeur que le clic sur l'icône loupe en mode normal — pas
  // rester dans la petite barre compacte pour la saisie.
  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      if (window.innerWidth <= 768 && searchEl && searchEl.getAttribute('data-always-visible') === 'yes') {
        setSearchOpen(true);
      }
    });
  }

  if (searchClose) {
    searchClose.addEventListener('click', () => {
      setSearchOpen(false);
      if (searchInput) searchInput.value = '';
    });
  }

  document.addEventListener('click', e => {
    if (!searchEl || !searchBar) return;
    if (!searchEl.contains(e.target)) setSearchOpen(false);
  });

  const searchSubmitMobile = searchBar ? searchBar.querySelector('.bbw-search__submit') : null;
  if (searchSubmitMobile) {
    searchSubmitMobile.addEventListener('click', () => {
      const q = searchInput ? searchInput.value.trim() : '';
      if (q) window.location.href = '/search-results.html?q=' + encodeURIComponent(q);
    });
  }

  /* ──────────────────────────────────────────────────────────────
     VOICE SEARCH — barres de recherche du header (mobile + desktop)
     Web Speech API ; bouton reste caché (display:none en HTML) si le
     navigateur ne le supporte pas (ex: Firefox).
  ────────────────────────────────────────────────────────────── */
  function initHeaderVoiceSearch(micBtn, input) {
    if (!micBtn || !input) return;
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    micBtn.style.display = '';

    const recognition = new SpeechRecognitionCtor();
    recognition.lang           = 'en-US';
    recognition.continuous     = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let listening = false;
    function setListening(on) {
      listening = on;
      micBtn.classList.toggle('is-listening', on);
    }

    micBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (listening) { recognition.stop(); return; }
      try { recognition.start(); setListening(true); }
      catch (err) { console.warn('[VoiceSearch] start failed:', err.message); }
    });

    recognition.addEventListener('result', event => {
      input.value = event.results[0][0].transcript;
    });

    recognition.addEventListener('end', () => {
      setListening(false);
      const q = input.value.trim();
      if (q) window.location.href = '/search-results.html?q=' + encodeURIComponent(q);
    });

    recognition.addEventListener('error', () => { setListening(false); });
  }

  initHeaderVoiceSearch(document.getElementById('bbwSearchMic'), searchInput);

  /* ──────────────────────────────────────────────────────────────
     4. SEARCH DESKTOP ALWAYS-VISIBLE
  ────────────────────────────────────────────────────────────── */
  /* ──────────────────────────────────────────────────────────────
     4. SEARCH DESKTOP ALWAYS-VISIBLE
  ────────────────────────────────────────────────────────────── */
  // Cache localStorage : évite que la barre de recherche desktop reste
  // invisible (style="display:none" figé dans le HTML statique) pendant
  // tout le temps du fetch réseau ci-dessous — on applique immédiatement
  // la dernière valeur connue, confirmée/corrigée juste après par le fetch.
  var SEARCH_VISIBLE_CACHE_KEY = 'bbw_header_search_always_visible';
  (function applyCachedSearchVisibility() {
    var cached = null;
    try { cached = localStorage.getItem(SEARCH_VISIBLE_CACHE_KEY); } catch (e) {}
    if (cached !== 'yes') return;
    var desktopSearch = document.getElementById('bbwSearchDesktop');
    if (desktopSearch && window.innerWidth > 768) desktopSearch.style.display = 'flex';
    // Mobile : pose immédiatement l'attribut (déjà lu depuis le cache, pas
    // encore confirmé par le fetch ci-dessous) pour éviter le flash icône
    // loupe → barre always-visible au chargement.
    if (searchEl) searchEl.setAttribute('data-always-visible', 'yes');
  })();

  function applySearchSetting() {
    fetch('/products.data.json')
      .then(r => r.json())
      .then(data => {
        const settings      = data.find(p => p.type === 'settings') || {};
        const alwaysVisible = (settings.header_search_always_visible || 'no').toLowerCase() === 'yes';

        try { localStorage.setItem(SEARCH_VISIBLE_CACHE_KEY, alwaysVisible ? 'yes' : 'no'); } catch (e) {}

        if (searchEl) searchEl.setAttribute('data-always-visible', alwaysVisible ? 'yes' : 'no');

        const desktopSearch = document.getElementById('bbwSearchDesktop');
        if (desktopSearch) desktopSearch.style.display = (alwaysVisible && window.innerWidth > 768) ? 'flex' : 'none';

        // ── Placeholder animé (type → pause → delete → mot suivant) ──
        const realProducts = data.filter(p => !p.type).map(p => p.title).filter(Boolean);
        const sampleTitles = realProducts
          .slice() // ne mute pas le tableau d'origine
          .sort(() => Math.random() - 0.5)
          .slice(0, 5);
        const words = ['Search products…', 'Search collections…', ...sampleTitles];
        initAnimatedPlaceholder(document.getElementById('bbwSearchInput'), words);
        initAnimatedPlaceholder(document.getElementById('bbwSearchDesktopInput'), words);
      })
      .catch(() => {});
  }

  /* ──────────────────────────────────────────────────────────────
     ANIMATED PLACEHOLDER — effet machine à écrire (type/pause/delete)
     qui cycle entre plusieurs mots, comme sur les grandes plateformes.
     S'arrête tant que l'input a le focus ou contient du texte tapé par
     l'utilisateur, pour ne jamais interférer avec une vraie saisie.
  ────────────────────────────────────────────────────────────── */
  function initAnimatedPlaceholder(input, words) {
    if (!input || !words || !words.length) return;
    if (input.dataset.bbwPlaceholderAnim) return; // évite les timers dupliqués (ex: resize -> applySearchSetting() rappelée)
    input.dataset.bbwPlaceholderAnim = '1';

    const TYPE_SPEED   = 45;   // ms par caractère à l'écriture
    const DELETE_SPEED = 25;   // ms par caractère à l'effacement
    const HOLD_MS       = 1500; // pause une fois le mot complet affiché
    const GAP_MS         = 300;  // pause entre l'effacement et le mot suivant

    let wordIdx = 0;
    let timer   = null;
    let paused  = false;

    function step(charIdx, deleting) {
      if (paused) return;
      const word = words[wordIdx];

      if (!deleting) {
        input.placeholder = word.slice(0, charIdx);
        if (charIdx < word.length) {
          timer = setTimeout(() => step(charIdx + 1, false), TYPE_SPEED);
        } else {
          timer = setTimeout(() => step(word.length, true), HOLD_MS);
        }
      } else {
        input.placeholder = word.slice(0, charIdx);
        if (charIdx > 0) {
          timer = setTimeout(() => step(charIdx - 1, true), DELETE_SPEED);
        } else {
          wordIdx = (wordIdx + 1) % words.length;
          timer = setTimeout(() => step(0, false), GAP_MS);
        }
      }
    }

    input.addEventListener('focus', () => { paused = true; clearTimeout(timer); });
    input.addEventListener('blur',  () => {
      if (input.value.trim()) return; // l'utilisateur a tapé quelque chose, on n'y touche plus
      paused = false;
      step(0, false);
    });

    step(0, false);
  }

  window.addEventListener('resize', applySearchSetting, { passive: true });

  const desktopSubmit = document.getElementById('bbwSearchDesktopSubmit');
  const desktopInput  = document.getElementById('bbwSearchDesktopInput');
  if (desktopSubmit) {
    desktopSubmit.addEventListener('click', () => {
      const q = desktopInput ? desktopInput.value.trim() : '';
      if (q) window.location.href = '/search-results.html?q=' + encodeURIComponent(q);
    });
  }

  initHeaderVoiceSearch(document.getElementById('bbwSearchDesktopMic'), desktopInput);

  /* ──────────────────────────────────────────────────────────────
     5. ACCOUNT TRIGGER
  ────────────────────────────────────────────────────────────── */
  const accountTrigger = document.getElementById('bbwAccountTrigger');
  if (accountTrigger) {
    accountTrigger.addEventListener('click', () => {
      const paulTrigger = document.getElementById('paulTrigger');
      if (paulTrigger) paulTrigger.click();
      else window.location.href = '/account.html';
    });
  }

  /* ──────────────────────────────────────────────────────────────
     6. CART & WISHLIST — bridge vers script.js
  ────────────────────────────────────────────────────────────── */
  (function bindCartWishlist() {
    function tryBind() {
      const cartEl     = document.getElementById('bbwCartTrigger');
      const wishlistEl = document.getElementById('bbwWishlistTrigger');

      if (cartEl && typeof window.openCartDrawer === 'function') {
        cartEl.addEventListener('click', window.openCartDrawer);
        cartEl.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openCartDrawer(); }
        });
      }
      if (wishlistEl && typeof window.openWishlistModal === 'function') {
        wishlistEl.addEventListener('click', window.openWishlistModal);
        wishlistEl.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openWishlistModal(); }
        });
      }

      if (typeof window.openCartDrawer === 'function' && typeof window.openWishlistModal === 'function') return;

      let tries = 0;
      const wait = setInterval(() => {
        const c = document.getElementById('bbwCartTrigger');
        const w = document.getElementById('bbwWishlistTrigger');
        if (c && typeof window.openCartDrawer === 'function') {
          c.addEventListener('click', window.openCartDrawer);
          c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openCartDrawer(); } });
        }
        if (w && typeof window.openWishlistModal === 'function') {
          w.addEventListener('click', window.openWishlistModal);
          w.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openWishlistModal(); } });
        }
        if (typeof window.openCartDrawer === 'function' && typeof window.openWishlistModal === 'function') clearInterval(wait);
        if (++tries > 80) clearInterval(wait);
      }, 80);
    }
    tryBind();
  })();

  /* ──────────────────────────────────────────────────────────────
     7. SCROLL EFFECT
  ────────────────────────────────────────────────────────────── */
  const header = document.getElementById('bbw-header');
  if (header) {
    const SCROLLED_THRESHOLD = 60;
    const onHeaderScroll = () => {
      header.style.boxShadow = window.scrollY > 10
        ? '0 4px 30px rgba(0,0,0,0.60),0 0 0 1px rgba(201,150,62,0.15)'
        : 'none';
      header.classList.toggle('bbw-header--scrolled', window.scrollY > SCROLLED_THRESHOLD);
    };
    window.addEventListener('scroll', onHeaderScroll, { passive: true });
    onHeaderScroll();
  }

  /* ──────────────────────────────────────────────────────────────
     8. ACTIVE LINK
  ────────────────────────────────────────────────────────────── */
  function markActiveLink() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.bbw-drawer__link').forEach(link => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('active', href && (currentPath.endsWith(href) || currentPath === href));
    });
  }

  /* ──────────────────────────────────────────────────────────────
     9. SOCIAL LINKS dans le drawer
  ────────────────────────────────────────────────────────────── */
  function applySocialLinks() {
    const settings    = (window.__allProducts || []).find(p => p.type === 'settings') || {};
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
     10. BADGES — sync depuis localStorage
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

  
  function _setChevron(btn, isOpen) {
    if (!btn) return;
    const ch = btn.querySelector('.bbw-drawer__select-chevron');
    if (ch) ch.textContent = isOpen ? '▲' : '▼';
  }

  function applyLangCountrySelectors() {
    const settings = (window.__allProducts || []).find(p => p.type === 'settings') || {};

    const langCfg    = settings.language_selector || {};
    const countryCfg = settings.country_selector  || {};

    const langEnabled    = (langCfg.enabled    || 'yes').toLowerCase() === 'yes';
    const countryEnabled = (countryCfg.enabled || 'yes').toLowerCase() === 'yes';

    const langOptions    = langCfg.options    || [];
    const countryOptions = countryCfg.options || [];

    const savedLang      = localStorage.getItem('bbw_lang')    || langCfg.default_lang    || 'en';
    const savedCountry   = localStorage.getItem('bbw_country') || countryCfg.default_country || 'us';
    const defaultLang    = savedLang;
    const defaultCountry = savedCountry;

    /* ══════════════════════════════════════════════════════════
       A. DESKTOP — .bbw-hdr-lang
    ══════════════════════════════════════════════════════════ */
    const hdrLangWrap  = document.getElementById('bbwHdrLang');
    const hdrLangBtn   = document.getElementById('bbwHdrLangBtn');
    const hdrLangDrop  = document.getElementById('bbwHdrLangDropdown');
    const hdrLangFlag  = document.getElementById('bbwHdrLangFlag');
    const hdrLangLabel = document.getElementById('bbwHdrLangLabel');

    if (langEnabled && langOptions.length && hdrLangDrop) {

      hdrLangDrop.innerHTML = '';
      langOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className     = 'bbw-hdr-lang__option' + (opt.code === defaultLang ? ' active' : '');
        btn.dataset.lang  = opt.code;
        btn.dataset.flag  = opt.flag  || '';
        btn.dataset.label = opt.label || opt.name || '';
        btn.setAttribute('role', 'option');
        btn.innerHTML = `
          <span class="opt-flag">${opt.flag || ''}</span>
          <span class="opt-name">${opt.name || ''}</span>
          <span class="opt-check">✓</span>`;

        btn.addEventListener('click', () => {
          hdrLangDrop.querySelectorAll('.bbw-hdr-lang__option').forEach(o => o.classList.remove('active'));
          btn.classList.add('active');
          if (hdrLangFlag)  hdrLangFlag.textContent  = opt.flag  || '';
          if (hdrLangLabel) hdrLangLabel.textContent = opt.label || opt.name || '';
          if (hdrLangWrap)  hdrLangWrap.classList.remove('is-open');
          const freshB = hdrLangWrap ? hdrLangWrap.querySelector('.bbw-hdr-lang__btn') : null;
          if (freshB) freshB.setAttribute('aria-expanded', 'false');
          _syncDrawerLang(opt.code);
          if (typeof window.translateTo === 'function') window.translateTo(opt.code);
        });

        hdrLangDrop.appendChild(btn);
      });

      
      const defLang = langOptions.find(o => o.code === defaultLang) || langOptions[0];
      if (defLang) {
        if (hdrLangFlag)  hdrLangFlag.textContent  = defLang.flag  || '';
        if (hdrLangLabel) hdrLangLabel.textContent = defLang.label || defLang.name || '';
      }
    }

    
    if (hdrLangBtn && hdrLangWrap) {
      const freshBtn = hdrLangBtn.cloneNode(true);
      hdrLangBtn.parentNode.replaceChild(freshBtn, hdrLangBtn);

      freshBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = hdrLangWrap.classList.toggle('is-open');
        freshBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    
    document.addEventListener('click', e => {
      if (hdrLangWrap && !hdrLangWrap.contains(e.target)) {
        hdrLangWrap.classList.remove('is-open');
        const b = hdrLangWrap.querySelector('.bbw-hdr-lang__btn');
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });

    /* ══════════════════════════════════════════════════════════
       B. MOBILE DRAWER — COUNTRY
          #bbwDrawerCountryList est imbriqué dans la colonne country
          du HTML → s'ouvre dans sa propre colonne uniquement
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
          btn.dataset.flag    = opt.flag  || '';
          btn.dataset.label   = opt.label || opt.name || '';
          btn.dataset.lang    = opt.lang  || '';
          btn.innerHTML = `
            <span class="opt-flag">${opt.flag || ''}</span>
            <span>${opt.name || ''}</span>
            <span class="opt-check">✓</span>`;

          btn.addEventListener('click', () => {
            countryList.querySelectorAll('.bbw-drawer__select-opt').forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            if (countryFlag) countryFlag.textContent = opt.flag  || '';
            if (countryLbl)  countryLbl.textContent  = opt.label || opt.name || '';

            
            countryList.classList.remove('is-open');
            _setChevron(document.getElementById('bbwDrawerCountryBtn'), false);

            if (opt.lang) _syncDrawerLang(opt.lang);
            if (typeof window.translateTo === 'function' && opt.lang) window.translateTo(opt.lang);
          });

          countryList.appendChild(btn);
        });

        
        const defCountry = countryOptions.find(o => o.code === defaultCountry) || countryOptions[0];
        if (defCountry) {
          if (countryFlag) countryFlag.textContent = defCountry.flag  || '';
          if (countryLbl)  countryLbl.textContent  = defCountry.label || defCountry.name || '';
        }
      }
    }

    /* ══════════════════════════════════════════════════════════
       C. MOBILE DRAWER — LANGUAGE
          #bbwDrawerLangList est imbriqué dans la colonne lang du HTML
    ══════════════════════════════════════════════════════════ */
    if (langEnabled && langOptions.length) {
      const langList = document.getElementById('bbwDrawerLangList');
      const langFlag = document.getElementById('bbwDrawerLangFlag');
      const langLbl  = document.getElementById('bbwDrawerLangLabel');

      if (langList) {
        langList.innerHTML = '';

        langOptions.forEach(opt => {
          const btn = document.createElement('button');
          btn.className     = 'bbw-drawer__select-opt' + (opt.code === defaultLang ? ' active' : '');
          btn.dataset.lang  = opt.code;
          btn.dataset.flag  = opt.flag || '';
          btn.dataset.label = opt.name || '';
          btn.innerHTML = `
            <span class="opt-flag">${opt.flag || ''}</span>
            <span>${opt.name || ''}</span>
            <span class="opt-check">✓</span>`;

          btn.addEventListener('click', () => {
            langList.querySelectorAll('.bbw-drawer__select-opt').forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            if (langFlag) langFlag.textContent = opt.flag || '';
            if (langLbl)  langLbl.textContent  = opt.name || '';

            
            langList.classList.remove('is-open');
            _setChevron(document.getElementById('bbwDrawerLangBtn'), false);

            if (typeof window.translateTo === 'function') window.translateTo(opt.code);
          });

          langList.appendChild(btn);
        });

        
        const defLang = langOptions.find(o => o.code === defaultLang) || langOptions[0];
        if (defLang) {
          if (langFlag) langFlag.textContent = defLang.flag || '';
          if (langLbl)  langLbl.textContent  = defLang.name || '';
        }
      }
    }

    /* ══════════════════════════════════════════════════════════
       D. BIND open/close boutons drawer
          — clone pour éviter doublons de listeners
          — chevron ▼ / ▲
          — ferme l'autre colonne quand on en ouvre une
    ══════════════════════════════════════════════════════════ */
    const drawerCountryBtn  = document.getElementById('bbwDrawerCountryBtn');
    const drawerCountryList = document.getElementById('bbwDrawerCountryList');
    const drawerLangBtn     = document.getElementById('bbwDrawerLangBtn');
    const drawerLangList    = document.getElementById('bbwDrawerLangList');

    if (drawerCountryBtn && drawerCountryList) {
      const freshCB = drawerCountryBtn.cloneNode(true);
      drawerCountryBtn.parentNode.replaceChild(freshCB, drawerCountryBtn);

      freshCB.addEventListener('click', () => {
        const isOpen = drawerCountryList.classList.toggle('is-open');
        _setChevron(freshCB, isOpen);

        
        if (isOpen && drawerLangList) {
          drawerLangList.classList.remove('is-open');
          _setChevron(document.getElementById('bbwDrawerLangBtn'), false);
        }
      });
    }

    if (drawerLangBtn && drawerLangList) {
      const freshLB = drawerLangBtn.cloneNode(true);
      drawerLangBtn.parentNode.replaceChild(freshLB, drawerLangBtn);

      freshLB.addEventListener('click', () => {
        const isOpen = drawerLangList.classList.toggle('is-open');
        _setChevron(freshLB, isOpen);

        
        if (isOpen && drawerCountryList) {
          drawerCountryList.classList.remove('is-open');
          _setChevron(document.getElementById('bbwDrawerCountryBtn'), false);
        }
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     12. INIT PRINCIPALE
  ────────────────────────────────────────────────────────────── */
  function init() {
    spawnHeaderParticles();
    markActiveLink();
    syncBadgesFromStorage();

    document.addEventListener('cart:update',     syncBadgesFromStorage);
    document.addEventListener('wishlist:change', syncBadgesFromStorage);

    function applyAll() {
      applySearchSetting();
      applySocialLinks();
      applyLangCountrySelectors();
    }

    if (window.__allProducts && window.__allProducts.length) {
      applyAll();
    } else {
      let tries = 0;
      const wait = setInterval(() => {
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(wait);
          applyAll();
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



// ── Announcement Bar ──
(function() {
  const slides = document.querySelectorAll('.ann-bar__slide');
  const dots   = document.querySelectorAll('.ann-bar__dot');
  let current  = 0;
  let timer;

  function goTo(next, dir) {
    if (next === current) return;
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (next + slides.length) % slides.length;
    slides[current].style.transform = dir > 0 ? 'translateY(100%)' : 'translateY(-100%)';
    slides[current].style.opacity = '0';
    slides[current].classList.add('active');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slides[current].style.transform = '';
      slides[current].style.opacity = '';
    }));
    dots[current].classList.add('active');
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo((current + 1) % slides.length, 1), 5000);
  }

  const btnNext = document.getElementById('annNext');
  const btnPrev = document.getElementById('annPrev');
  if (btnNext) btnNext.addEventListener('click', () => { goTo((current+1)%slides.length, 1); startTimer(); });
  if (btnPrev) btnPrev.addEventListener('click', () => { goTo((current-1+slides.length)%slides.length, -1); startTimer(); });

  startTimer();
})();



/* ──────────────────────────────────────────────────────────────
   INACTIVE TAB CTA
────────────────────────────────────────────────────────────── */
(function initInactiveTabCTA() {

  function run() {
    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(p => p.type === 'settings') || {};
    const cfg         = settings.inactive_tab_cta || {};

    if ((cfg.enabled || 'yes').toLowerCase() !== 'yes') return;

    const originalTitle  = document.title;
    const rawMessage     = cfg.message      || 'YOUR ORDER IS WAITING';
    const animationSpeed = parseInt(cfg.speed) || 150;
    const catchyAddon    = cfg.catchy_addon || '✨ HURRY!';

    // ── Separator — premier "yes" trouvé
    const separatorMap = {
      space:       '\u00A0',
      dash:        ' - ',
      dot:         ' . ',
      star:        ' * ',
      none:        '',
      pipe:        ' | ',
      arrow:       ' → ',
      bullet:      ' • ',
      tilde:       ' ~ ',
      double_dash: ' -- '
    };

    const separatorCfg = cfg.separator || { space: 'yes' };
    const activeSep = Object.keys(separatorCfg).find(
      k => (separatorCfg[k] || '').toLowerCase() === 'yes'
    ) || 'space';
    const sepChar = separatorMap[activeSep] !== undefined
      ? separatorMap[activeSep]
      : '\u00A0';

    const customMessage = rawMessage.split(' ').join(sepChar);
    const finalMessage  = customMessage + ' ' + catchyAddon;

    // ── Animation — premier "yes" trouvé
    const animationCfg = cfg.animation || { typewriter: 'yes' };
    const animationType = Object.keys(animationCfg).find(
      k => (animationCfg[k] || '').toLowerCase() === 'yes'
    ) || 'typewriter';

    let intervalId = null;
    let isInactive = false;

    // ── Animations
    function typewriterEffect() {
      let i = 0;
      document.title = '';
      intervalId = setInterval(() => {
        if (i < finalMessage.length) {
          document.title += finalMessage.charAt(i);
          i++;
        } else {
          clearInterval(intervalId);
        }
      }, animationSpeed);
    }

    function fadeEffect() {
      document.title = finalMessage;
      intervalId = setInterval(() => {
        document.title = document.title === '' ? finalMessage : '';
      }, animationSpeed * 10);
    }

    function bounceEffect() {
      document.title = finalMessage + ' ⬆️';
      intervalId = setInterval(() => {
        document.title = document.title.includes('⬆️')
          ? finalMessage + ' ⬇️'
          : finalMessage + ' ⬆️';
      }, animationSpeed * 5);
    }

    function slideEffect() {
      let position = 0;
      intervalId = setInterval(() => {
        document.title = finalMessage.substring(position) + finalMessage.substring(0, position);
        position = (position + 1) % finalMessage.length;
      }, animationSpeed * 2);
    }

    function rotateEffect() {
      document.title = finalMessage;
      intervalId = setInterval(() => {
        document.title = document.title === finalMessage ? '...' : finalMessage;
      }, animationSpeed * 8);
    }

    function blinkEffect() {
      document.title = finalMessage;
      let visible = true;
      intervalId = setInterval(() => {
        visible = !visible;
        document.title = visible ? finalMessage : '';
      }, animationSpeed * 6);
    }

    function waveEffect() {
      const chars = finalMessage.split('');
      let step = 0;
      intervalId = setInterval(() => {
        document.title = chars.map((c, i) =>
          i === step % chars.length ? c.toUpperCase() : c.toLowerCase()
        ).join('');
        step++;
      }, animationSpeed * 3);
    }

    function marqueeEffect() {
      const padded = finalMessage + '   ';
      let pos = 0;
      intervalId = setInterval(() => {
        document.title = padded.substring(pos) + padded.substring(0, pos);
        pos = (pos + 1) % padded.length;
      }, animationSpeed * 2);
    }

    function flashEffect() {
      const messages = [finalMessage, '🔥 ' + finalMessage, '⚡ ' + finalMessage, finalMessage];
      let i = 0;
      intervalId = setInterval(() => {
        document.title = messages[i % messages.length];
        i++;
      }, animationSpeed * 7);
    }

    function pingEffect() {
      const states = [finalMessage, '🔔 ' + finalMessage, finalMessage, ''];
      let i = 0;
      intervalId = setInterval(() => {
        document.title = states[i % states.length];
        i++;
      }, animationSpeed * 9);
    }

    function startAnimation() {
      const effects = {
        typewriter: typewriterEffect,
        fade:       fadeEffect,
        bounce:     bounceEffect,
        slide:      slideEffect,
        rotate:     rotateEffect,
        blink:      blinkEffect,
        wave:       waveEffect,
        marquee:    marqueeEffect,
        flash:      flashEffect,
        ping:       pingEffect
      };
      const fn = effects[animationType];
      if (fn) fn();
    }

    // ── Détection visibilité onglet
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (!isInactive) {
          isInactive = true;
          startAnimation();
        }
      } else {
        if (isInactive) {
          isInactive = false;
          clearInterval(intervalId);
          document.title = originalTitle;
        }
      }
    });
  }

  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    let tries = 0;
    const wait = setInterval(() => {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (++tries > 60) {
        clearInterval(wait);
        run();
      }
    }, 100);
  }

})();


/* ──────────────────────────────────────────────────────────────
   PROMO BAR — affiliate/jackpot + free shipping (textes dynamiques
   depuis les settings, jamais en dur)
────────────────────────────────────────────────────────────── */
(function initPromoBar() {

  // La hauteur réelle de #promoBar varie selon le texte injecté (montants
  // à 2 ou 3 chiffres) et le breakpoint (le texte peut wrapper sur 2
  // lignes en mobile) — --promo-bar-h ne peut pas être devinée en dur
  // sans risquer un écart de quelques pixels avec le header qui doit
  // coller juste en dessous. On la mesure et on la pousse en variable
  // CSS à chaque changement pertinent.
  function syncPromoBarHeight() {
    const bar = document.getElementById('promoBar');
    if (!bar) return;
    const h = bar.getBoundingClientRect().height;
    if (h > 0) document.documentElement.style.setProperty('--promo-bar-h', h + 'px');
  }

  function run() {
    const allProducts = window.__allProducts || [];
    const settings     = allProducts.find(p => p.type === 'settings') || {};

    const jackpot  = settings.jackpot_reward_amount || 150;
    const shipping = (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold) || 75;

    const affiliateEl = document.getElementById('promoBarAffiliate');
    const shippingEl   = document.getElementById('promoBarShipping');

    if (affiliateEl) {
      affiliateEl.textContent = `Become an Affiliate — Earn Per Click + a $${jackpot} Jackpot Bonus`;
    }
    if (shippingEl) {
      shippingEl.textContent = `Free Worldwide Shipping on Orders Over $${shipping}`;
    }

    syncPromoBarHeight();
    requestAnimationFrame(syncPromoBarHeight);
    // Le texte peut être mesuré avec la police de fallback avant que la
    // vraie webfont ne charge — une police plus large peut forcer un
    // retour à la ligne supplémentaire et agrandir la barre après coup.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncPromoBarHeight);
    }
    setTimeout(syncPromoBarHeight, 500);
  }

  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    let tries = 0;
    const wait = setInterval(() => {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (++tries > 60) {
        clearInterval(wait);
        run();
      }
    }, 100);
  }

  window.addEventListener('resize', syncPromoBarHeight, { passive: true });

})();