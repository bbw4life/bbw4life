/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — FOOTER.JS
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);

  /* ──────────────────────────────────────────────────────────────
     DEFAULT SETTINGS (used when products.data.json is absent)
  ────────────────────────────────────────────────────────────── */
  const DEFAULTS = {
    /* General */
    section_title: 'QUICK LINKS FOR OUR CUSTOMERS',

    /* mobile behavior — key option */
    mobile_links_behavior: 'two_columns_mobile',

    /* Col 1 */
    title1: 'EXPLORE MORE',
    links1: [
      { text: 'Most populare',   url: '#' },
      { text: 'Bbw4life Style',  url: '#' },
      { text: 'FB Community',    url: '#' },
      { text: 'Our Blog Post',   url: '#' },
      { text: 'Whats.Groupe',    url: '#' },
      { text: 'Find Your best',  url: '#' },
      { text: 'Find Your Look',  url: '#' },
      { text: 'Big deals',       url: '#' },
      { text: 'Commitment',      url: '#' },
      { text: 'Our-Mission',     url: '#' }
    ],

    /* Col 2 */
    title2: 'CUSTOMERS CARE',
    links2: [
      { text: 'Our newsletter',  url: '#' },
      { text: 'Returns policy',  url: '#' },
      { text: 'About Bbw4life', url: '#' },
      { text: 'Support 7/24',   url: '#' },
      { text: 'order-tracking',  url: '#' },
      { text: 'Prodducts care',  url: '#' },
      { text: 'My account',      url: '#' },
      { text: 'Privacy policy',  url: '#' },
      { text: 'Shipping Info',   url: '#' },
      { text: 'Terms shop',      url: '#' }
    ],

    /* Col 3 — info */
    title3:           'BEAUTY HAS NO SIZE',
    info_text:        '<strong>BBW4LIFE</strong> celebrates plus-size women and their natural <strong>beauty</strong>. Every wom&acirc;n is perfect as she is &mdash; <strong>confident, powerful</strong>, and beautiful in every size.',

    /* Logo */
    logo_svg: `<svg width="120" height="120" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
      <circle cx="90" cy="90" r="80" fill="none" stroke="currentColor" stroke-width="6"/>
      <path d="M55 90 Q70 60 90 75 Q110 60 125 90 Q110 120 90 130 Q70 120 55 90Z" fill="currentColor" opacity="0.85"/>
      <circle cx="90" cy="90" r="18" fill="none" stroke="currentColor" stroke-width="4"/>
      <path d="M90 50 L95 80 L90 72 L85 80 Z" fill="currentColor"/>
    </svg>`,
    logo_link:  '/',

    /* Col 4 — contact */
    title4:           'NEED HELP? CONTACT US',
    contact_text:     'Available Monday to Friday/ 7h:Am-10PM',
    email_link:       'support@bbw4life.com',
    whatsapp_chat_now_text: '💬 Chat With Us',
    phone_number:     '18093770077',
    phone_suffix_text:'/Only text please',
    whatsapp_number:  '18296221518',
    whatsapp_send_button_text:  'Send',

    /* Social */
    social_title:        'Follow us in social Media',
    social_links: {
      facebook:  '#',
      twitter:   '#',
      instagram: '#',
      youtube:   '#',
      tiktok:    '#'
    },

    /* New In (col 5) — fallback placeholders uniquement */
    novelty_title: 'NEW GEMS TO DISCOVER',
    new_in_autoplay_enable: true,
    new_in_autoplay_delay:  5,

    /* Bottom */
    copyright_year: '2026'
  };

  /* SVG ICONS ------------------------------------------------- */
  const SOCIAL_SVGS = {
    facebook: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    twitter:  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    instagram:`<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.258-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"/></svg>`,
    youtube:  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    tiktok:   `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>`
  };

  /* ──────────────────────────────────────────────────────────────
     MAIN INIT
  ────────────────────────────────────────────────────────────── */
  function init() {
    const all = window.__allProducts || [];
    const rawSettings = all.find(p => p.type === 'settings') || {};
    const s = Object.assign({}, DEFAULTS, rawSettings);
    applySectionTitle(s);
    applyCol1(s);
    applyCol2(s);
    applyCol3(s);
    applyCol4(s);
    applyCol5(s);
    applyBottom(s);
    initMobileBehavior(s);
    initWhatsApp(s);
    initNewInSlider(s);
    applyFooterSelectors(s);
  }

  /* ──────────────────────────────────────────────────────────────
     1. SECTION TITLE
  ────────────────────────────────────────────────────────────── */
  function applySectionTitle(s) {
    const el = $('bbwFooterSectionTitle');
    if (el) el.textContent = s.section_title || DEFAULTS.section_title;
  }

  /* ──────────────────────────────────────────────────────────────
     3. COL 1 & 2 — links
  ────────────────────────────────────────────────────────────── */
  function buildLinks(s, colNum, ulEl, titleEl, titleKey) {
    if (!ulEl) return;
    if (titleEl) titleEl.textContent = s[titleKey] || '';

    const items = [];
    for (let i = 1; i <= 20; i++) {
      const txt = s[`text${colNum}_${i}`];
      const url = s[`link${colNum}_${i}`] || '#';
      if (txt) items.push({ text: txt, url });
    }

    const fallback = s[`links${colNum}`] || [];
    const list = items.length ? items : fallback;

    ulEl.innerHTML = '';
    list.forEach(item => {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href = item.url || '#';
      a.textContent = item.text;
      li.appendChild(a);
      ulEl.appendChild(li);
    });
  }

  function applyCol1(s) {
    buildLinks(s, 1, $('bbwCol1Links'), $('bbwCol1Title'), 'title1');
  }

  function applyCol2(s) {
    buildLinks(s, 2, $('bbwCol2Links'), $('bbwCol2Title'), 'title2');
  }

  /* ──────────────────────────────────────────────────────────────
     4. COL 3 — info text + logo
  ────────────────────────────────────────────────────────────── */
  function applyCol3(s) {
    const titleEl = $('bbwCol3Title');
    if (titleEl) titleEl.textContent = stripTags(s.title3 || DEFAULTS.title3);

    const infoEl = $('bbwInfoText');
    if (infoEl) {
      infoEl.innerHTML = s.info_text || DEFAULTS.info_text;
    }

    const logoEl = $('bbwFooterLogoSvg');
    if (logoEl) {
      logoEl.innerHTML = s.logo_svg || DEFAULTS.logo_svg;
    }

    const logoLink = $('bbwFooterLogoLink');
    if (logoLink) logoLink.href = s.logo_link || '/';
  }

  /* ──────────────────────────────────────────────────────────────
     5. COL 4 — contact + social
  ────────────────────────────────────────────────────────────── */
  function applyCol4(s) {
    const titleEl = $('bbwCol4Title');
    if (titleEl) titleEl.textContent = s.title4 || DEFAULTS.title4;

    const contactText = $('bbwContactText');
    if (contactText) {
      contactText.textContent = s.contact_text || '';
    }

    const emailLink = $('bbwEmailLink');
    if (emailLink) emailLink.href = 'mailto:' + (s.email_link || '');

    const chatBtn = $('bbwChatNowBtn');
    if (chatBtn) chatBtn.textContent = s.whatsapp_chat_now_text || '💬 Chat With Us';

    const phoneNum = $('bbwPhoneNumber');
    if (phoneNum) phoneNum.textContent = s.phone_number || '';

    const phoneSuffix = $('bbwPhoneSuffix');
    if (phoneSuffix) phoneSuffix.textContent = s.phone_suffix_text || '';

    const phoneLink = $('bbwPhoneLink');
    if (phoneLink) phoneLink.href = 'tel:' + (s.phone_number || '');

    const socialTitle = $('bbwSocialTitle');
    if (socialTitle) {
      socialTitle.textContent = s.social_title || 'Follow us in social Media';
    }

    const socialMap = {
      facebook:  { id: 'bbwSocFacebook',  urlKey: 'facebook'  },
      twitter:   { id: 'bbwSocTwitter',   urlKey: 'twitter'   },
      instagram: { id: 'bbwSocInstagram', urlKey: 'instagram' },
      youtube:   { id: 'bbwSocYoutube',   urlKey: 'youtube'   },
      tiktok:    { id: 'bbwSocTiktok',    urlKey: 'tiktok'    }
    };

    const socialLinks = s.social_links || {};
    Object.entries(socialMap).forEach(([key, cfg]) => {
      const a = $(cfg.id);
      if (!a) return;
      a.innerHTML = SOCIAL_SVGS[key] || '';
      const url = socialLinks[cfg.urlKey] || socialLinks[`${cfg.urlKey}_link`] || '#';
      a.href = url;
    });
  }

  /* ──────────────────────────────────────────────────────────────
     6. COL 5 — New Gems slider
     Ordre : collection, produit, collection, produit, ...
     Sources : settings.footer_new_gems.collection_ids  → jrgq_collections
               settings.footer_new_gems.product_ids     → produits réels
  ────────────────────────────────────────────────────────────── */
  function applyCol5(s) {
    const titleEl = $('bbwCol5Title');
    if (titleEl) titleEl.textContent = stripTags(s.novelty_title || DEFAULTS.novelty_title);

    const wrapper = $('bbwNewInWrapper');
    if (!wrapper) return;

    /* ── Récupère la config footer_new_gems ── */
    const gemsConfig    = s.footer_new_gems   || {};
    const collectionIds = gemsConfig.collection_ids || [];
    const productIds    = gemsConfig.product_ids    || [];

    /* ── Récupère les sources depuis __allProducts ── */
    const all        = window.__allProducts || [];
    const jrgqCols   = (s.jrgq_collections && s.jrgq_collections.collections) || [];
    const realProds  = all.filter(function(p) { return !p.type; });

    /* ── Construit la liste alternée col → prod → col → prod... ── */
    const slides = [];
    const maxPairs = Math.max(collectionIds.length, productIds.length);
    const MAX_TITLE = 32;

    function truncate(str) {
      return str && str.length > MAX_TITLE ? str.substring(0, MAX_TITLE) + '…' : (str || '');
    }

    for (let i = 0; i < maxPairs; i++) {

      /* Collection */
      if (collectionIds[i]) {
        const col = jrgqCols.find(function(c) { return c.id === collectionIds[i]; });
        if (col) {
          slides.push({
            image:        col.image || '',
            title:        truncate(col.title),
            url:          col.url   || '#',
            isCollection: true
          });
        }
      }

      /* Produit */
      if (productIds[i]) {
        const prod = realProds.find(function(p) { return p.id === productIds[i]; });
        if (prod) {
          let prodUrl = prod.url || '#';
          /* Essaie d'utiliser getProductUrl si disponible dans le scope global */
          if (typeof window.getProductUrl === 'function') {
            prodUrl = window.getProductUrl(prod.id);
          }
          slides.push({
            image:        prod.image || '',
            title:        truncate(prod.title),
            url:          prodUrl,
            isCollection: false
          });
        }
      }
    }

    /* ── Fallback si rien trouvé : 3 placeholders neutres ── */
    if (!slides.length) {
      [
        { image: 'https://placehold.co/300x280/1a1a1a/FFD700?text=Collection+1', title: 'Bbw4life collection', url: '#' },
        { image: 'https://placehold.co/300x280/1a1a1a/FFD700?text=Collection+2', title: 'New Arrivals',        url: '#' },
        { image: 'https://placehold.co/300x280/1a1a1a/FFD700?text=Collection+3', title: 'Best Sellers',        url: '#' }
      ].forEach(function(item) {
        slides.push({ image: item.image, title: item.title, url: item.url, isCollection: false });
      });
    }

    /* ── Injecte les slides dans le DOM ── */
    wrapper.innerHTML = '';

    slides.forEach(function(item) {
      const slide = document.createElement('div');
      slide.className = 'bbw-footer__newin-slide';

      const a = document.createElement('a');
      a.href      = item.url;
      a.className = 'bbw-footer__newin-link';

      const img = document.createElement('img');
      img.src       = item.image;
      img.alt       = item.title;
      img.loading   = 'lazy';
      img.className = 'bbw-footer__newin-img';

      const cap = document.createElement('p');
      cap.className   = 'bbw-footer__newin-caption';
      cap.textContent = item.title;
      if (item.isCollection) cap.classList.add('bbw-footer__newin-caption--collection');

      a.appendChild(img);
      a.appendChild(cap);
      slide.appendChild(a);
      wrapper.appendChild(slide);
    });

    /* ── Affiche / cache la nav selon le nombre de slides ── */
    const nav = $('bbwNewInNav');
    if (nav) nav.style.display = slides.length > 1 ? 'block' : 'none';
  }

  /* ──────────────────────────────────────────────────────────────
     7. BOTTOM BAR
  ────────────────────────────────────────────────────────────── */
  function applyBottom(s) {
    const copy = $('bbwCopyright');
    if (!copy) return;
    const year  = s.copyright_year || new Date().getFullYear();
    const brand = s.brand_name     || 'bbw4life';
    copy.innerHTML = `© ${year}, <a href="/index.html" class="bbw-footer__brand-link">${brand}</a> All Rights Reserved`;
  }

  /* ──────────────────────────────────────────────────────────────
     8. MOBILE BEHAVIOR
  ────────────────────────────────────────────────────────────── */
  function initMobileBehavior(s) {
    const footer = document.getElementById('bbw-footer');
    if (!footer) return;
    let behavior = 'two_columns_mobile';

    const raw = s.mobile_links_behavior;
    if (typeof raw === 'string') {
      behavior = raw.toLowerCase().trim();
    } else if (raw && typeof raw === 'object') {
      const found = Object.keys(raw).find(k => (raw[k] || '').toString().toLowerCase() === 'yes');
      if (found) behavior = found.toLowerCase().trim();
    }

    footer.classList.remove('bbw-behavior--hide', 'bbw-behavior--show-all', 'bbw-behavior--two-cols');

    if (behavior === 'hide_completely') {
      footer.classList.add('bbw-behavior--hide');
      initCollapsible();
    } else if (behavior === 'show_all_centered') {
      footer.classList.add('bbw-behavior--show-all');
    } else {
      footer.classList.add('bbw-behavior--two-cols');
    }
  }

  /* Collapsible — "hide_completely" mode only */
  function initCollapsible() {
    document.querySelectorAll('.bbw-footer__col-title').forEach(title => {
      const icon = title.querySelector('.bbw-footer__col-icon');
      title.addEventListener('click', function () {
        if (window.innerWidth > 767) return;
        const col = title.closest('.bbw-footer__col');
        if (!col) return;
        const isOpen = col.classList.toggle('is-open');
        if (icon) icon.textContent = isOpen ? '−' : '+';
      });
    });
  }

  /* ──────────────────────────────────────────────────────────────
     9. NEW IN SLIDER — autoplay + swipe + buttons
  ────────────────────────────────────────────────────────────── */
  function initNewInSlider(s) {
    const wrapper = $('bbwNewInWrapper');
    if (!wrapper) return;

    requestAnimationFrame(function () {
      const slides = wrapper.querySelectorAll('.bbw-footer__newin-slide');
      if (slides.length <= 1) return;

      const prevBtn = $('bbwNewInPrev');
      const nextBtn = $('bbwNewInNext');
      let currentIdx    = 0;
      let autoplayTimer = null;

      const nav = $('bbwNewInNav');
      if (nav) nav.style.display = 'block';

      const scrollToSlide = function (idx) {
        if (idx < 0) idx = slides.length - 1;
        if (idx >= slides.length) idx = 0;
        currentIdx = idx;
        wrapper.scrollTo({ left: slides[idx].offsetLeft, behavior: 'smooth' });
      };

      const nextSlide = function () { scrollToSlide(currentIdx + 1); };
      const prevSlide = function () { scrollToSlide(currentIdx - 1); };

      if (nextBtn) nextBtn.addEventListener('click', nextSlide);
      if (prevBtn) prevBtn.addEventListener('click', prevSlide);

      let touchStartX = 0;
      wrapper.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      wrapper.addEventListener('touchend', function (e) {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) { diff > 0 ? nextSlide() : prevSlide(); }
        touchStartX = 0;
      }, { passive: true });

      const delay   = (s.new_in_autoplay_delay || 5) * 1000;
      const enabled = s.new_in_autoplay_enable !== false;

      const startAutoplay = function () {
        if (enabled && !autoplayTimer) autoplayTimer = setInterval(nextSlide, delay);
      };
      const stopAutoplay = function () {
        if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
      };

      startAutoplay();

      const col5 = $('bbwFooterCol5');
      if (col5) {
        col5.addEventListener('mouseenter', stopAutoplay);
        col5.addEventListener('mouseleave', startAutoplay);
        col5.addEventListener('touchstart', stopAutoplay, { passive: true });
        col5.addEventListener('touchend',   startAutoplay, { passive: true });
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────
     10. WHATSAPP CHAT
  ────────────────────────────────────────────────────────────── */
  function initWhatsApp(s) {
    const btn    = $('bbwChatNowBtn');
    const sel    = $('bbwProblemSelect');
    const sendB  = $('bbwSendBtn');
    const number = s.whatsapp_number || DEFAULTS.whatsapp_number;

    if (btn && sel && sendB) {
      btn.addEventListener('click', () => {
        const visible = sel.style.display === 'block';
        sel.style.display   = visible ? 'none' : 'block';
        sendB.style.display = visible ? 'none' : 'inline';
      });

      sendB.addEventListener('click', () => {
        const msg = sel.value;
        if (!msg) { alert('Please select an issue to continue.'); return; }
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank');
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     11. COUNTRY + LANG SELECTORS — bottom bar
  ────────────────────────────────────────────────────────────── */
  function applyFooterSelectors(s) {
    const countryCfg     = s.country_selector  || {};
    const langCfg        = s.language_selector || {};
    const countryOptions = countryCfg.options  || [];
    const langOptions    = langCfg.options     || [];
    const defaultCountry = countryCfg.default_country || 'us';
    const defaultLang    = langCfg.default_lang        || 'en';

    const countryEl = document.getElementById('bbwFooterCountrySelect');
    if (countryEl && countryOptions.length) {
      countryEl.innerHTML = '';
      countryOptions.forEach(opt => {
        const o       = document.createElement('option');
        o.value       = opt.code;
        o.textContent = opt.currency ? opt.name + ' | ' + opt.currency : opt.name;
        if (opt.code === defaultCountry) o.selected = true;
        countryEl.appendChild(o);
      });
    }

    const langEl = document.getElementById('bbwFooterLangSelect');
    if (langEl && langOptions.length) {
      langEl.innerHTML = '';
      langOptions.forEach(opt => {
        const o       = document.createElement('option');
        o.value       = opt.code;
        o.textContent = opt.flag + ' ' + opt.name;
        if (opt.code === defaultLang) o.selected = true;
        langEl.appendChild(o);
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     UTILITY
  ────────────────────────────────────────────────────────────── */
  function stripTags(str) {
    const d = document.createElement('div');
    d.innerHTML = str || '';
    return d.textContent || d.innerText || '';
  }

  /* ──────────────────────────────────────────────────────────────
     BOOTSTRAP
  ────────────────────────────────────────────────────────────── */
  function bootstrap() {
    if (window.__allProducts && window.__allProducts.length) {
      init();
    } else {
      let tries = 0;
      const poll = setInterval(() => {
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(poll);
          init();
        } else if (++tries > 80) {
          clearInterval(poll);
          init();
        }
      }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  /* Expose public API */
  window.bbwFooterInit = init;

})();