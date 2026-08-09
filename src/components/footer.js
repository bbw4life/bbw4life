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

    section_title: 'QUICK LINKS FOR OUR CUSTOMERS',

    mobile_links_behavior: 'two_columns_mobile',

    title1: 'EXPLORE MORE',
    links1: [
      { text: 'Most populare',   url: '/collections/most-popular.html' },
      { text: 'Bbw4life Style',  url: '#' },
      { text: 'FB Community',    url: '#' },
      { text: 'Our Blog Post',   url: '/blog/blog.html' },
      { text: 'Whats.Groupe',    url: '#' },
      { text: 'Find Your best',  url: '#' },
      { text: 'Find Your Look',  url: '#' },
      { text: 'Big deals',       url: '#' },
      { text: 'Commitment',      url: '#' },
      { text: 'Our-Mission',     url: '#' }
    ],

    title2: 'CUSTOMERS CARE',
    links2: [
      { text: 'Our newsletter',  url: '#' },
      { text: 'Returns policy',  url: '/policies/refund.html' },
      { text: 'About Bbw4life', url: '/page/about.html' },
      { text: 'Support 7/24',   url: 'page/contact.html' },
      { text: 'order-tracking',  url: '/page/order-tracking.html' },
      { text: 'Prodducts care',  url: '/page/products-care.html' },
      { text: 'Affiliation/Earn %',      url: '/account.html' },
      { text: 'Privacy policy',  url: '/policies/privacy.html' },
      { text: 'Shipping Info',   url: '/policies/shipping.html' },
      { text: 'Terms shop',      url: '/policies/terms.html' }
    ],

    title3:    'BEAUTY HAS NO SIZE',
    info_text: '<strong>BBW4LIFE</strong> celebrates plus-size women and their natural <strong>beauty</strong>. Every wom&acirc;n is perfect as she is &mdash; <strong>confident, powerful</strong>, and beautiful in every size.',

    logo_svg: `<?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 122.88 101.01" style="enable-background:new 0 0 122.88 101.01" xml:space="preserve"><style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style><g><path class="st0" d="M61.44,0l5.88,4.77l7.48-1.2l2.69,7.08l7.08,2.69l-1.2,7.48l4.77,5.88l-4.77,5.88l1.2,7.48l-7.08,2.69 l-2.69,7.08l-7.48-1.2l-5.88,4.77l-5.88-4.77l-7.48,1.2l-2.69-7.08l-7.08-2.69l1.2-7.48l-4.77-5.88l4.77-5.88l-1.2-7.48l7.08-2.69 l2.69-7.08l7.48,1.2L61.44,0L61.44,0z M66.41,84.78h21.91c1.76-1.75,3.69-3.57,5.64-5.42c4.11-3.89,8.4-7.95,12.81-13.03 c5.04-5.81,5.58-7.82,7.11-13.51c0.29-1.07,0.61-2.27,1.03-3.76l2.62-9.21l0.03-0.1c1.4-4.1,1.51-6.81,0.93-8.37 c-0.18-0.48-0.41-0.8-0.68-0.97c-0.21-0.14-0.49-0.19-0.78-0.16c-0.68,0.07-1.45,0.5-2.15,1.27l-7.78,18.53 c-0.07,0.17-0.17,0.33-0.28,0.47c-0.46,0.83-1.08,1.64-1.88,2.41l-13.8,15.39c-0.75,0.84-2.04,0.91-2.87,0.16 c-0.84-0.75-0.91-2.04-0.16-2.87c1.87-2.08,16.37-16.31,15.63-19.5c-0.92-3.93-10.8,6.16-11.98,7.2l-0.03,0.03 c-5.79,5.48-8.28,6.78-12.82,9.15c-0.95,0.5-1.99,1.04-3.28,1.74c-0.51,0.28-1.01,0.62-1.5,0.99c-0.52,0.4-1.02,0.81-1.49,1.21 c-2.4,2.02-3.66,3.66-4.38,5.47c-0.75,1.88-1.02,4.17-1.39,7.31c-0.15,1.26-0.26,2.52-0.35,3.77 C66.47,83.59,66.44,84.19,66.41,84.78L66.41,84.78L66.41,84.78z M56.47,84.78H34.55c-1.76-1.75-3.69-3.57-5.65-5.42 c-4.11-3.89-8.4-7.95-12.81-13.03c-5.04-5.81-5.58-7.82-7.11-13.51c-0.29-1.07-0.61-2.27-1.03-3.76l-2.62-9.21l-0.03-0.1 c-1.4-4.1-1.51-6.81-0.93-8.37c0.18-0.48,0.41-0.8,0.68-0.97c0.21-0.14,0.49-0.19,0.78-0.16c0.68,0.07,1.45,0.5,2.15,1.27 l7.78,18.53c0.07,0.17,0.17,0.33,0.28,0.47c0.46,0.83,1.08,1.64,1.88,2.41l13.8,15.39c0.75,0.84,2.04,0.91,2.87,0.16 c0.84-0.75,0.91-2.04,0.16-2.87C32.9,63.52,18.4,49.29,19.14,46.1c0.92-3.93,10.8,6.16,11.98,7.2l0.03,0.03 c5.79,5.48,8.28,6.78,12.82,9.15c0.95,0.5,1.99,1.04,3.28,1.74c0.51,0.28,1.01,0.62,1.5,0.99c0.52,0.4,1.02,0.81,1.49,1.21 c2.4,2.02,3.66,3.66,4.38,5.47c0.75,1.88,1.02,4.17,1.39,7.31c0.15,1.26,0.26,2.52,0.35,3.77C56.41,83.59,56.44,84.19,56.47,84.78 L56.47,84.78L56.47,84.78z M29.45,85.48c-0.31,0.36-0.5,0.83-0.5,1.34v12.14c0,1.13,0.92,2.04,2.04,2.04h27.58 c1.13,0,2.04-0.92,2.04-2.04V86.71c0-1.3-0.08-2.7-0.17-4c-0.09-1.33-0.21-2.65-0.36-3.96c-0.4-3.43-0.7-5.94-1.66-8.35 c-0.99-2.47-2.58-4.6-5.53-7.09c-0.54-0.46-1.09-0.92-1.67-1.35c-0.61-0.46-1.27-0.9-2.01-1.31c-1.2-0.65-2.32-1.24-3.34-1.78 c-4.2-2.2-6.5-3.4-11.91-8.52c-0.04-0.04-0.09-0.08-0.13-0.11l-5.22-4.61c-2.64-3.09-7.87-6.77-11.68-3.43 c-2.03-4.83-4.03-15.36-10.67-16.01c-1.21-0.12-2.38,0.14-3.4,0.8c-0.97,0.63-1.77,1.61-2.27,2.96c-0.88,2.35-0.86,6,0.86,11.05 l2.6,9.15c0.38,1.32,0.71,2.59,1.02,3.71c1.7,6.35,2.3,8.6,7.97,15.12c4.49,5.17,8.89,9.33,13.1,13.32 C27.23,83.36,28.33,84.41,29.45,85.48L29.45,85.48L29.45,85.48z M33.35,88.86c0.27,0.06,0.55,0.06,0.83,0h22.34v8.06H33.03v-8.06 H33.35L33.35,88.86z M93.43,85.48c0.31,0.36,0.5,0.83,0.5,1.34v12.14c0,1.13-0.91,2.04-2.04,2.04H64.32 c-1.13,0-2.04-0.92-2.04-2.04V86.71c0-0.07,0-0.15,0.01-0.22c0.03-1.31,0.08-2.58,0.16-3.78c0.09-1.33,0.21-2.65,0.36-3.96 c0.4-3.43,0.7-5.94,1.66-8.35c0.99-2.47,2.58-4.6,5.53-7.09c0.54-0.46,1.09-0.92,1.67-1.35c0.61-0.46,1.27-0.9,2.01-1.31 c1.2-0.65,2.32-1.24,3.34-1.78c4.2-2.2,6.5-3.4,11.91-8.52c0.04-0.04,0.09-0.08,0.13-0.11l5.22-4.61 c2.64-3.09,7.87-6.77,11.68-3.43c0.99-2.37,4.41-11.65,5.59-13.07c1.46-1.75,3.31-2.77,5.08-2.95c1.21-0.12,2.38,0.14,3.4,0.8 c0.97,0.63,1.77,1.61,2.27,2.96c0.88,2.35,0.86,6-0.86,11.05l-2.6,9.15c-0.38,1.32-0.71,2.59-1.02,3.71 c-1.7,6.35-2.3,8.6-7.97,15.12c-4.49,5.17-8.88,9.33-13.1,13.32C95.65,83.36,94.55,84.41,93.43,85.48L93.43,85.48L93.43,85.48z M89.53,88.86c-0.27,0.06-0.55,0.06-0.83,0H66.36v8.06h23.49v-8.06H89.53L89.53,88.86z M61.44,17.18l2.75,6.72l7.25,0.54 l-5.54,4.69l1.73,7.06l-6.18-3.83l-6.18,3.83L57,29.14l-5.56-4.69l7.25-0.54l2.75-6.72H61.44L61.44,17.18z M61.44,11.61 c8.33,0,15.08,6.76,15.08,15.08c0,8.33-6.76,15.08-15.08,15.08c-8.33,0-15.08-6.76-15.08-15.08 C46.36,18.37,53.11,11.61,61.44,11.61L61.44,11.61z"/></g></svg>`,
    logo_link: '/',

    title4:                     'NEED HELP? CONTACT US',
    contact_text:               'Available Monday to Friday/ 7h:Am-10PM',
    email_link:                 'support@bbw4life.com',
    whatsapp_chat_now_text:     '💬 Chat With Us',
    phone_number:               '18298940709',
    phone_suffix_text:          '/Only text please',
    whatsapp_number:            '18298940709',
    whatsapp_send_button_text:  'Send',

    social_title: 'Follow us in social Media',
    social_links: {
      facebook:  '',
      twitter:   '',
      instagram: '',
      youtube:   '',
      tiktok:    ''
    },

    novelty_title:          'NEW GEMS TO DISCOVER',
    new_in_autoplay_enable: true,
    new_in_autoplay_delay:  5,

    copyright_year: '2026'
  };

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
    const all         = window.__allProducts || [];
    const rawSettings = all.find(p => p.type === 'settings') || {};
    const s           = Object.assign({}, DEFAULTS, rawSettings);

    applySectionTitle(s);
    applyCol1(s);
    applyCol2(s);
    applyCol3(s);
    applyCol4(s);
    applyCol5(s, rawSettings);
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
     2. COL 1 & 2 — links
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
    const list     = items.length ? items : fallback;

    ulEl.innerHTML = '';
    list.forEach(function (item) {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href        = item.url || '#';
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
     3. COL 3 — info text + logo
  ────────────────────────────────────────────────────────────── */
  function applyCol3(s) {
    const titleEl = $('bbwCol3Title');
    if (titleEl) titleEl.textContent = stripTags(s.title3 || DEFAULTS.title3);

    const infoEl = $('bbwInfoText');
    if (infoEl) infoEl.innerHTML = s.info_text || DEFAULTS.info_text;

    const logoEl = $('bbwFooterLogoSvg');
    if (logoEl) logoEl.innerHTML = s.logo_svg || DEFAULTS.logo_svg;

    const logoLink = $('bbwFooterLogoLink');
    if (logoLink) logoLink.href = s.logo_link || '/';
  }

  /* ──────────────────────────────────────────────────────────────
     4. COL 4 — contact + social
  ────────────────────────────────────────────────────────────── */
  function applyCol4(s) {
    const titleEl = $('bbwCol4Title');
    if (titleEl) titleEl.textContent = s.title4 || DEFAULTS.title4;

    const contactText = $('bbwContactText');
    if (contactText) contactText.textContent = s.contact_text || '';

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
    if (socialTitle) socialTitle.textContent = s.social_title || 'Follow us in social Media';

    const socialMap = {
      facebook:  { id: 'bbwSocFacebook',  urlKey: 'facebook'  },
      twitter:   { id: 'bbwSocTwitter',   urlKey: 'twitter'   },
      instagram: { id: 'bbwSocInstagram', urlKey: 'instagram' },
      youtube:   { id: 'bbwSocYoutube',   urlKey: 'youtube'   },
      tiktok:    { id: 'bbwSocTiktok',    urlKey: 'tiktok'    }
    };

    const socialLinks = s.social_links || {};
    Object.entries(socialMap).forEach(function ([key, cfg]) {
      const a = $(cfg.id);
      if (!a) return;
      a.innerHTML = SOCIAL_SVGS[key] || '';
      const url   = socialLinks[cfg.urlKey] || socialLinks[cfg.urlKey + '_link'] || '#';
      a.href      = url;
    });
  }

  /* ──────────────────────────────────────────────────────────────
     5. COL 5 — New Gems slider
     rawSettings passé séparément pour éviter le merge partiel
  ────────────────────────────────────────────────────────────── */
  function applyCol5(s, rawSettings) {
    const titleEl = $('bbwCol5Title');
    if (titleEl) titleEl.textContent = stripTags(s.novelty_title || DEFAULTS.novelty_title);

    const wrapper = $('bbwNewInWrapper');
    if (!wrapper) return;

    const gemsConfig    = s.footer_new_gems   || {};
    const collectionIds = gemsConfig.collection_ids || [];
    const productIds    = gemsConfig.product_ids    || [];

    const all = window.__allProducts || [];

    /* Lire jrgq_collections depuis rawSettings en priorité (évite merge partiel) */
    const raw        = rawSettings || {};
    const jrgqData   = raw.jrgq_collections || s.jrgq_collections || {};
    const jrgqCols   = (jrgqData && jrgqData.collections) ? jrgqData.collections : [];
    const realProds  = all.filter(function (p) { return !p.type; });

    const slides    = [];
    const MAX_TITLE = 32;

    function truncate(str) {
      return str && str.length > MAX_TITLE
        ? str.substring(0, MAX_TITLE) + '…'
        : (str || '');
    }

    const maxPairs = Math.max(collectionIds.length, productIds.length);

    for (let i = 0; i < maxPairs; i++) {

      /* — collection — */
      if (collectionIds[i]) {
        const col = jrgqCols.find(function (c) { return c.id === collectionIds[i]; });
        if (col) {
          slides.push({
            image:        col.image || '',
            title:        truncate(col.title),
            url:          col.url   || '#',
            isCollection: true
          });
        }
      }

      /* — product — */
      if (productIds[i]) {
        const prod = realProds.find(function (p) { return p.id === productIds[i]; });
        if (prod) {
          const prodUrl = typeof window.getProductUrl === 'function'
            ? window.getProductUrl(prod.id)
            : (prod.url || '#');
          slides.push({
            image:        prod.image || '',
            title:        truncate(prod.title),
            url:          prodUrl,
            isCollection: false
          });
        }
      }
    }

    /* Placeholder seulement si vraiment rien trouvé */
    if (!slides.length) {
      console.warn('[BBW Footer] footer_new_gems: aucun slide trouvé — vérifier les IDs dans products.data.json');
      [
        { image: 'https://cdn.shopify.com/s/files/1/0746/5346/6724/files/Curvy_Woman.png?v=1777936945', title: 'Curvy Woman', url: '/collections/curvy-woman.html' },
        { image: 'https://cdn.shopify.com/s/files/1/0746/5346/6724/files/BBW_Original_Coming_Soon.png?v=1777936945', title: 'New Arrivals',        url: '/collections/bbw-features-products.html' },
        { image: 'https://cdn.shopify.com/s/files/1/0746/5346/6724/files/Plus_Size_Men.png?v=1777937294', title: 'Men Plus Size',        url: '/collections/men-plus-size.html' }
      ].forEach(function (item) {
        slides.push({ image: item.image, title: item.title, url: item.url, isCollection: false });
      });
    }

    wrapper.innerHTML = '';
    slides.forEach(function (item) {
      const slide = document.createElement('div');
      slide.className = 'bbw-footer__newin-slide';

      const a   = document.createElement('a');
      a.href      = item.url;
      a.className = 'bbw-footer__newin-link';

      const img   = document.createElement('img');
      img.src       = item.image;
      img.alt       = item.title;
      img.loading   = 'lazy';
      img.className = 'bbw-footer__newin-img';

      const cap   = document.createElement('p');
      cap.className   = 'bbw-footer__newin-caption';
      cap.textContent = item.title;
      if (item.isCollection) cap.classList.add('bbw-footer__newin-caption--collection');

      a.appendChild(img);
      a.appendChild(cap);
      slide.appendChild(a);
      wrapper.appendChild(slide);
    });

    const nav = $('bbwNewInNav');
    if (nav) nav.style.display = slides.length > 1 ? 'block' : 'none';
  }

  /* ──────────────────────────────────────────────────────────────
     6. BOTTOM BAR
  ────────────────────────────────────────────────────────────── */
  function applyBottom(s) {
    const copy = $('bbwCopyright');
    if (!copy) return;
    const year  = s.copyright_year || new Date().getFullYear();
    const brand = s.brand_name     || 'bbw4life';
    copy.innerHTML = `© ${year}, <a href="/index.html" class="bbw-footer__brand-link">${brand}</a> All Rights Reserved`;
  }

  /* ──────────────────────────────────────────────────────────────
     7. MOBILE BEHAVIOR
  ────────────────────────────────────────────────────────────── */
  function initMobileBehavior(s) {
    const footer = document.getElementById('bbw-footer');
    if (!footer) return;

    let behavior = 'two_columns_mobile';
    const raw    = s.mobile_links_behavior;

    if (typeof raw === 'string' && raw.trim()) {
      behavior = raw.trim().toLowerCase();
    } else if (raw && typeof raw === 'object') {
      /* Cherche la clé dont la valeur est "yes" */
      const found = Object.keys(raw).find(function (k) {
        return String(raw[k]).toLowerCase() === 'yes';
      });
      if (found) behavior = found.toLowerCase();
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

  function initCollapsible() {
    document.querySelectorAll('.bbw-footer__col-title').forEach(function (title) {
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
     8. NEW IN SLIDER — autoplay + swipe + buttons
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
        col5.addEventListener('touchstart', stopAutoplay,   { passive: true });
        col5.addEventListener('touchend',   startAutoplay,  { passive: true });
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────
     9. WHATSAPP CHAT
  ────────────────────────────────────────────────────────────── */
  function initWhatsApp(s) {
    const btn    = $('bbwChatNowBtn');
    const sel    = $('bbwProblemSelect');
    const sendB  = $('bbwSendBtn');
    const number = s.whatsapp_number || DEFAULTS.whatsapp_number;

    if (btn && sel && sendB) {
      btn.addEventListener('click', function () {
        const visible   = sel.style.display === 'block';
        sel.style.display   = visible ? 'none' : 'block';
        sendB.style.display = visible ? 'none' : 'inline';
      });

      sendB.addEventListener('click', function () {
        const msg = sel.value;
        if (!msg) { alert('Please select an issue to continue.'); return; }
        window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(msg), '_blank');
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     10. COUNTRY + LANG SELECTORS — bottom bar
  ────────────────────────────────────────────────────────────── */
  function applyFooterSelectors(s) {
    const countryCfg     = s.country_selector  || {};
    const langCfg        = s.language_selector || {};
    const countryOptions = countryCfg.options  || [];
    const langOptions    = langCfg.options     || [];
    const defaultCountry = localStorage.getItem('bbw_country') || countryCfg.default_country || 'us';
    const defaultLang    = localStorage.getItem('bbw_lang')    || langCfg.default_lang        || 'en';

    /* Country list */
    const countryList = document.getElementById('bbwCountryList');
    const countryEl   = document.getElementById('bbwFooterCountrySelect');
    if (countryList && countryOptions.length) {
      countryList.innerHTML = '';
      if (countryEl) countryEl.innerHTML = '';
      countryOptions.forEach(function (opt) {
        const li = document.createElement('li');
        li.dataset.value = opt.code;
        li.dataset.lang  = opt.lang || 'en';
        li.innerHTML = `<span class="opt-flag">${opt.flag || ''}</span><span class="opt-name">${opt.name || ''}</span><span class="opt-currency">${opt.currency || ''}</span>`;
        if (opt.code === defaultCountry) li.classList.add('active');
        countryList.appendChild(li);
        if (countryEl) {
          const o = document.createElement('option');
          o.value       = opt.code;
          o.textContent = opt.name;
          if (opt.code === defaultCountry) o.selected = true;
          countryEl.appendChild(o);
        }
      });
      const def = countryOptions.find(function (o) { return o.code === defaultCountry; }) || countryOptions[0];
      if (def) {
        const flagEl  = document.getElementById('bbwCountryFlag');
        const labelEl = document.getElementById('bbwCountryLabel');
        if (flagEl)  flagEl.textContent  = def.flag || '';
        if (labelEl) labelEl.textContent = def.name + (def.currency ? ' | ' + def.currency : '');
      }
    }

    /* Lang list */
    const langList = document.getElementById('bbwLangList');
    const langEl   = document.getElementById('bbwFooterLangSelect');
    if (langList && langOptions.length) {
      langList.innerHTML = '';
      if (langEl) langEl.innerHTML = '';
      langOptions.forEach(function (opt) {
        const li = document.createElement('li');
        li.dataset.value = opt.code;
        li.innerHTML = `<span class="opt-flag">${opt.flag || ''}</span><span class="opt-name">${opt.name || ''}</span>`;
        if (opt.code === defaultLang) li.classList.add('active');
        langList.appendChild(li);
        if (langEl) {
          const o = document.createElement('option');
          o.value       = opt.code;
          o.textContent = opt.flag + ' ' + opt.name;
          if (opt.code === defaultLang) o.selected = true;
          langEl.appendChild(o);
        }
      });
      const defL = langOptions.find(function (o) { return o.code === defaultLang; }) || langOptions[0];
      if (defL) {
        const flagEl  = document.getElementById('bbwLangFlag2');
        const labelEl = document.getElementById('bbwLangLabel2');
        if (flagEl)  flagEl.textContent  = defL.flag || '';
        if (labelEl) labelEl.textContent = defL.name || '';
      }
    }

    initCustomSelects();
  }

  function initCustomSelects() {

    /* Toggle open/close */
    document.querySelectorAll('.bbw-custom-select__trigger').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        const parent = trigger.closest('.bbw-custom-select');
        const isOpen = parent.classList.contains('open');
        document.querySelectorAll('.bbw-custom-select').forEach(function (d) { d.classList.remove('open'); });
        if (!isOpen) parent.classList.add('open');
      });
    });

    /* Fermer si clic dehors */
    document.addEventListener('click', function () {
      document.querySelectorAll('.bbw-custom-select').forEach(function (d) { d.classList.remove('open'); });
    });

    /* Sélection pays */
    const countryList = document.getElementById('bbwCountryList');
    if (countryList) {
      countryList.addEventListener('click', function (e) {
        const li = e.target.closest('li');
        if (!li) return;
        const flagEl2    = li.querySelector('.opt-flag');
        const nameEl2    = li.querySelector('.opt-name');
        const currencyEl = li.querySelector('.opt-currency');
        const flag       = flagEl2     ? flagEl2.textContent     : '';
        const name       = nameEl2     ? nameEl2.textContent     : '';
        const currency   = currencyEl  ? currencyEl.textContent  : '';
        const code       = li.dataset.value;
        const lang       = li.dataset.lang;
        const flagEl  = document.getElementById('bbwCountryFlag');
        const labelEl = document.getElementById('bbwCountryLabel');
        if (flagEl)  flagEl.textContent  = flag;
        if (labelEl) labelEl.textContent = name + (currency ? ' | ' + currency : '');
        countryList.querySelectorAll('li').forEach(function (l) { l.classList.remove('active'); });
        li.classList.add('active');
        const sel = document.getElementById('bbwFooterCountrySelect');
        if (sel) sel.value = code;
        const drop = document.getElementById('bbwCountryDrop');
        if (drop) drop.classList.remove('open');
        if (lang && typeof translateTo === 'function') translateTo(lang);
      });
    }

    /* Search pays */
    const search = document.getElementById('bbwCountrySearch');
    if (search) {
      search.addEventListener('input', function () {
        const q = search.value.toLowerCase();
        if (countryList) {
          countryList.querySelectorAll('li').forEach(function (li) {
            const nameEl = li.querySelector('.opt-name');
            const name   = nameEl ? nameEl.textContent.toLowerCase() : '';
            li.style.display = name.includes(q) ? '' : 'none';
          });
        }
      });
      search.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    /* Sélection langue */
    const langList = document.getElementById('bbwLangList');
    if (langList) {
      langList.addEventListener('click', function (e) {
        const li = e.target.closest('li');
        if (!li) return;
        const code    = li.dataset.value;
        const flagEl2 = li.querySelector('.opt-flag');
        const nameEl2 = li.querySelector('.opt-name');
        const flag    = flagEl2 ? flagEl2.textContent : '';
        const name    = nameEl2 ? nameEl2.textContent : '';
        const flagEl  = document.getElementById('bbwLangFlag2');
        const labelEl = document.getElementById('bbwLangLabel2');
        if (flagEl)  flagEl.textContent  = flag;
        if (labelEl) labelEl.textContent = name;
        langList.querySelectorAll('li').forEach(function (l) { l.classList.remove('active'); });
        li.classList.add('active');
        const sel = document.getElementById('bbwFooterLangSelect');
        if (sel) sel.value = code;
        const drop = document.getElementById('bbwLangDrop');
        if (drop) drop.classList.remove('open');
        if (typeof translateTo === 'function') translateTo(code);
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
     BOOTSTRAP — attend __allProducts ET le DOM footer
  ────────────────────────────────────────────────────────────── */
  function bootstrap() {
    const dataReady = function () {
      return window.__allProducts && window.__allProducts.length > 0;
    };
    const domReady = function () {
      return !!document.getElementById('bbwFooterSectionTitle');
    };

    if (dataReady() && domReady()) {
      init();
      return;
    }

    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      if (dataReady() && domReady()) {
        clearInterval(poll);
        init();
      } else if (tries > 150) { /* 15s max */
        clearInterval(poll);
        init(); /* init avec DEFAULTS si timeout */
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.bbwFooterInit = init;

})();



/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — "Find Your Best" Style Quiz — bbw-quiz.js
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────
     WAIT FOR products.data.json THEN INIT
  ────────────────────────────────────────────────────────────── */
  function waitForProducts(cb) {
    if (window.__allProducts && window.__allProducts.length) { cb(); return; }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll); cb();
      } else if (++tries > 100) {
        clearInterval(poll);
      }
    }, 100);
  }

  /* ──────────────────────────────────────────────────────────────
     STYLE DESCRIPTIONS (fallbacks if not in settings)
  ────────────────────────────────────────────────────────────── */
  var STYLE_DESCS = {
    Casual:  'Comfortable, relaxed and effortlessly chic for everyday living.',
    Chic:    'Refined elegance with a contemporary edge — timeless sophistication.',
    Beauty:  'Soft, feminine and delicate — pieces that celebrate your natural glow.',
    Glamour: 'Bold, dazzling and unapologetically radiant — you were born to shine.'
  };

  var OCCASION_SLOTS = {
    Everyday: 0,
    Evening:  1,
    Work:     2,
    Party:    3
  };

  /* ──────────────────────────────────────────────────────────────
     DOM HELPERS
  ────────────────────────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };

  /* ──────────────────────────────────────────────────────────────
     STATE
  ────────────────────────────────────────────────────────────── */
  var state = {
    step:              0,   // 0=intro, 1=Q1, 2=Q2, 3=Q3, 4=Q4, 5=result
    style:             null,
    occasion:          null,
    color:             null,
    size:              null,
    stylePool:         [],  // product IDs for chosen style
    selectedProduct:   null,
    selectedVariant:   null,
    quizSettings:      {}
  };

  /* ──────────────────────────────────────────────────────────────
     CONFETTI
  ────────────────────────────────────────────────────────────── */
  function fireConfetti() {
    var container = $('bbqConfetti');
    if (!container) return;
    container.innerHTML = '';
    var colors = ['#c0385e','#c9963e','#e8bc6a','#7b3f6e','#FFD700','#fff'];
    for (var i = 0; i < 38; i++) {
      var piece = document.createElement('div');
      piece.className = 'bbq-confetti-piece';
      piece.style.left        = Math.random() * 100 + '%';
      piece.style.background  = colors[Math.floor(Math.random() * colors.length)];
      piece.style.width        = (Math.random() * 8 + 5) + 'px';
      piece.style.height       = (Math.random() * 8 + 5) + 'px';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.animationDuration = (Math.random() * 1.5 + 1) + 's';
      piece.style.animationDelay   = (Math.random() * 0.8) + 's';
      container.appendChild(piece);
    }
  }

  /* ──────────────────────────────────────────────────────────────
     PROGRESS
  ────────────────────────────────────────────────────────────── */
  function updateProgress(step) {
    var bar   = $('bbqProgressBar');
    var label = $('bbqProgressLabel');
    var wrap  = $('bbqProgressWrap');
    if (!bar || !label) return;

    if (step === 0) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (wrap) wrap.style.display = 'flex';

    var totalSteps = 4;
    var pct = Math.round((step / totalSteps) * 100);
    bar.style.setProperty('--bbq-progress', pct + '%');
    label.textContent = 'Step ' + step + ' of ' + totalSteps;
  }

  /* ──────────────────────────────────────────────────────────────
     SHOW SCREEN
  ────────────────────────────────────────────────────────────── */
  function showScreen(id, direction) {
    var screens = document.querySelectorAll('.bbq-screen');
    screens.forEach(function (s) {
      s.classList.remove('bbq-screen--active', 'bbq-screen--back');
    });
    var target = $(id);
    if (!target) return;
    if (direction === 'back') target.classList.add('bbq-screen--back');
    target.classList.add('bbq-screen--active');
  }

  /* ──────────────────────────────────────────────────────────────
     BACK NAV VISIBILITY
  ────────────────────────────────────────────────────────────── */
  function updateNav(step) {
    var nav = $('bbqNav');
    if (!nav) return;
    nav.style.display = step >= 1 && step <= 4 ? 'flex' : 'none';
  }

  /* ──────────────────────────────────────────────────────────────
     GET PRODUCT FROM __allProducts BY ID
  ────────────────────────────────────────────────────────────── */
  function getProductById(pid) {
    return (window.__allProducts || []).find(function (p) {
      return p.id === pid;
    }) || null;
  }

  /* ──────────────────────────────────────────────────────────────
     GO TO STEP
  ────────────────────────────────────────────────────────────── */
  function goTo(step, direction) {
    state.step = step;
    updateProgress(step);
    updateNav(step);

    if (step === 0) { showScreen('bbqIntro', direction); return; }
    if (step === 1) { showScreen('bbqQ1',    direction); return; }
    if (step === 2) { buildQ2(); showScreen('bbqQ2', direction); return; }
    if (step === 3) { buildColorPalette(); showScreen('bbqQ3', direction); return; }
    if (step === 4) { buildSizeGrid(); showScreen('bbqQ4', direction); return; }
    if (step === 5) { buildResult(); showScreen('bbqResult', direction); return; }
  }

  /* ──────────────────────────────────────────────────────────────
     Q1 — STYLE SELECTED
  ────────────────────────────────────────────────────────────── */
  function onStyleSelected(styleVal) {
    state.style = styleVal;

    var cfg = (state.quizSettings.styles || {})[styleVal] || {};
    var ids = cfg.product_ids || [];
    state.stylePool = ids;

    goTo(2);
  }

  /* ──────────────────────────────────────────────────────────────
     Q2 — BUILD OCCASION OPTIONS
     (labels are fixed; products come from the style pool)
  ────────────────────────────────────────────────────────────── */
  function buildQ2() {
    // No dynamic content needed — options are static HTML already.
    // Just reset selection state.
    state.occasion = null;
    document.querySelectorAll('#bbqQ2Options .bbq-opt-card').forEach(function (btn) {
      btn.classList.remove('bbq-selected');
    });
  }

  /* ──────────────────────────────────────────────────────────────
     Q2 — OCCASION SELECTED
  ────────────────────────────────────────────────────────────── */
  function onOccasionSelected(occasionVal) {
    state.occasion = occasionVal;

    var cfg    = (state.quizSettings.occasions || {})[occasionVal] || {};
    var slot   = typeof cfg.slot === 'number' ? cfg.slot : (OCCASION_SLOTS[occasionVal] || 0);
    var pool   = state.stylePool;

    // Cycle through pool in case slot > pool.length
    var pid    = pool.length ? pool[slot % pool.length] : null;
    var prod   = pid ? getProductById(pid) : null;

    // Fallback: pick any product from the pool
    if (!prod && pool.length) {
      for (var i = 0; i < pool.length; i++) {
        prod = getProductById(pool[i]);
        if (prod) break;
      }
    }

    state.selectedProduct = prod;
    goTo(3);
  }

  /* ──────────────────────────────────────────────────────────────
     Q3 — BUILD COLOR PALETTE
  ────────────────────────────────────────────────────────────── */
  function buildColorPalette() {
    state.color = null;
    var palette  = $('bbqColorPalette');
    var noMsg    = $('bbqNoColorMsg');
    var prod     = state.selectedProduct;
    if (!palette) return;

    palette.innerHTML = '';
    if (noMsg) noMsg.style.display = 'none';

    var colors = (prod && prod.colors && prod.colors.length) ? prod.colors : [];

    if (!colors.length) {
      // No colors — auto advance
      if (noMsg) noMsg.style.display = 'block';
      state.color = null;
      setTimeout(function () { goTo(4); }, 1800);
      return;
    }

    colors.forEach(function (colorObj) {
      var swatch = document.createElement('div');
      swatch.className = 'bbq-color-swatch';

      var circle = document.createElement('div');
      circle.className = 'bbq-color-circle';
      circle.style.backgroundColor = colorObj.hex || '#ccc';

      var name = document.createElement('span');
      name.className   = 'bbq-color-name';
      name.textContent = colorObj.name;

      swatch.appendChild(circle);
      swatch.appendChild(name);
      palette.appendChild(swatch);

      swatch.addEventListener('click', function () {
        palette.querySelectorAll('.bbq-color-swatch').forEach(function (s) {
          s.classList.remove('bbq-selected');
        });
        swatch.classList.add('bbq-selected');
        state.color = colorObj.name;

        // Update product image to match chosen color
        if (colorObj.image && $('bbqResultImg')) {
          // pre-cache
          var preload = new Image();
          preload.src = typeof upgradeShopifyImageUrl === 'function'
            ? upgradeShopifyImageUrl(colorObj.image, 400)
            : colorObj.image;
        }

        setTimeout(function () { goTo(4); }, 400);
      });
    });
  }

  /* ──────────────────────────────────────────────────────────────
     Q4 — BUILD SIZE GRID
  ────────────────────────────────────────────────────────────── */
  function buildSizeGrid() {
    state.size = null;
    var grid  = $('bbqSizeGrid');
    var noMsg = $('bbqNoSizeMsg');
    var prod  = state.selectedProduct;
    if (!grid) return;

    grid.innerHTML = '';
    if (noMsg) noMsg.style.display = 'none';

    var sizes = (prod && prod.sizes && prod.sizes.length) ? prod.sizes : [];

    if (!sizes.length) {
      if (noMsg) noMsg.style.display = 'block';
      state.size = null;
      setTimeout(function () { buildAndShowResult(); }, 1800);
      return;
    }

    sizes.forEach(function (sz) {
      var btn = document.createElement('button');
      btn.className   = 'bbq-size-btn';
      btn.textContent = sz;

      btn.addEventListener('click', function () {
        grid.querySelectorAll('.bbq-size-btn').forEach(function (b) {
          b.classList.remove('bbq-selected');
        });
        btn.classList.add('bbq-selected');
        state.size = sz;

        setTimeout(function () { buildAndShowResult(); }, 350);
      });

      grid.appendChild(btn);
    });
  }

  /* ──────────────────────────────────────────────────────────────
     RESOLVE VARIANT
  ────────────────────────────────────────────────────────────── */
  function resolveVariant(prod, colorName, sizeName) {
    if (!prod) return null;
    var variants = prod.variants || [];

    // Exact match
    if (colorName && sizeName) {
      var exact = variants.find(function (v) {
        return v.color === colorName && v.size === sizeName;
      });
      if (exact) return exact;
    }

    // Color only
    if (colorName) {
      var byColor = variants.find(function (v) { return v.color === colorName; });
      if (byColor) return byColor;
    }

    // Size only
    if (sizeName) {
      var bySize = variants.find(function (v) { return v.size === sizeName; });
      if (bySize) return bySize;
    }

    // Fallback: first variant
    return variants[0] || null;
  }

  /* ──────────────────────────────────────────────────────────────
     GET IMAGE FOR VARIANT
  ────────────────────────────────────────────────────────────── */
  function getVariantImage(prod, colorName) {
    if (!prod) return '';
    if (colorName && prod.colors) {
      var colorObj = prod.colors.find(function (c) { return c.name === colorName; });
      if (colorObj && colorObj.image) return colorObj.image;
    }
    return prod.image || '';
  }

  /* ──────────────────────────────────────────────────────────────
     BUILD RESULT SCREEN
  ────────────────────────────────────────────────────────────── */
  function buildAndShowResult() {
    goTo(5);
  }

  function buildResult() {
    var prod    = state.selectedProduct;
    var variant = resolveVariant(prod, state.color, state.size);
    state.selectedVariant = variant;

    // Style description
    var styleCfg = ((state.quizSettings.styles || {})[state.style]) || {};
    var desc = styleCfg.description || STYLE_DESCS[state.style] || '';

    var titleEl    = $('bbqResultTitle');
    var styleEl    = $('bbqResultStyle');
    var descEl     = $('bbqResultDesc');
    var imgEl      = $('bbqResultImg');
    var nameEl     = $('bbqResultProdName');
    var variantEl  = $('bbqResultProdVariant');
    var priceEl    = $('bbqResultProdPrice');

    if (titleEl)   titleEl.textContent   = 'Your ' + (state.style || '') + ' Look!';
    if (styleEl)   styleEl.textContent   = (state.style || '') + ' · ' + (state.occasion || '');
    if (descEl)    descEl.textContent    = desc;

    if (prod) {
      var imgSrc = getVariantImage(prod, state.color);
      if (typeof upgradeShopifyImageUrl === 'function') imgSrc = upgradeShopifyImageUrl(imgSrc, 400);
      if (imgEl) { imgEl.src = imgSrc; imgEl.alt = prod.title; }
      if (nameEl)  nameEl.textContent  = prod.title;

      var variantParts = [];
      if (state.color) variantParts.push(state.color);
      if (state.size)  variantParts.push('Size: ' + state.size);
      if (variantEl) variantEl.textContent = variantParts.join(' — ') || 'One size';

      var price = variant ? variant.price : prod.price;
      if (priceEl) priceEl.textContent = '$' + parseFloat(price).toFixed(2);
    } else {
      if (imgEl)     imgEl.style.display  = 'none';
      if (nameEl)    nameEl.textContent   = 'No product found for this combination.';
      if (variantEl) variantEl.textContent = '';
      if (priceEl)   priceEl.textContent   = '';
    }

    fireConfetti();
  }

  /* ──────────────────────────────────────────────────────────────
     ADD TO CART
  ────────────────────────────────────────────────────────────── */
  function addResultToCart() {
    var prod    = state.selectedProduct;
    var variant = state.selectedVariant;
    if (!prod) return;

    var color = state.color || (variant ? variant.color || null : null);
    var size  = state.size  || (variant ? variant.size  || null : null);
    var price = variant ? parseFloat(variant.price) : parseFloat(prod.price);
    var vid   = variant ? variant.vid : null;

    var imgSrc = getVariantImage(prod, color);
    if (typeof upgradeShopifyImageUrl === 'function') imgSrc = upgradeShopifyImageUrl(imgSrc, 600);

    // Get cart
    var cart = [];
    if (typeof window.__getCart === 'function') {
      cart = window.__getCart();
    } else {
      try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
    }
    if (!Array.isArray(cart)) cart = [];

    var existing = cart.find(function (i) {
      return i.id === prod.id && i.color === color && i.size === size;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id:            prod.id,
        title:         prod.title,
        price:         price,
        compare_price: parseFloat(prod.compare_price) || price,
        image:         imgSrc,
        size:          size  || null,
        color:         color || null,
        quantity:      1,
        fromQuiz:      true,
        cj_product_id: prod.cj_id || null,
        cj_variant_id: vid        || null
      });
    }

    // Save
    if (typeof window.__setCart === 'function') window.__setCart(cart);
    localStorage.setItem('cart', JSON.stringify(cart));

    if (typeof window.saveCart                  === 'function') window.saveCart();
    if (typeof window.updateCartQuantityInSheet === 'function') window.updateCartQuantityInSheet();
    if (typeof window.applyPromoFreeItems       === 'function') window.applyPromoFreeItems();
    if (typeof window.updateBadges              === 'function') window.updateBadges();
    if (typeof window.renderCart                === 'function') window.renderCart();

    // Close quiz
    closeQuiz();

    // Open cart drawer
    setTimeout(function () {
      if (typeof window.openCartDrawer === 'function') window.openCartDrawer();
    }, 280);
  }

  /* ──────────────────────────────────────────────────────────────
     OPEN / CLOSE
  ────────────────────────────────────────────────────────────── */
  function openQuiz() {
    var overlay = $('bbw-quiz-overlay');
    if (!overlay) return;
    document.body.style.overflow = 'hidden';
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('bbq-active');
    resetQuiz();
  }

  function closeQuiz() {
    var overlay = $('bbw-quiz-overlay');
    if (!overlay) return;
    overlay.classList.remove('bbq-active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function resetQuiz() {
    state.step            = 0;
    state.style           = null;
    state.occasion        = null;
    state.color           = null;
    state.size            = null;
    state.stylePool       = [];
    state.selectedProduct = null;
    state.selectedVariant = null;

    // Clear option selections
    document.querySelectorAll('.bbq-opt-card').forEach(function (btn) {
      btn.classList.remove('bbq-selected');
    });

    goTo(0);
  }

  /* ──────────────────────────────────────────────────────────────
     BACK NAVIGATION
  ────────────────────────────────────────────────────────────── */
  function goBack() {
    var step = state.step;
    if (step <= 1) { goTo(0, 'back'); return; }
    goTo(step - 1, 'back');
  }

  /* ──────────────────────────────────────────────────────────────
     BIND EVENTS
  ────────────────────────────────────────────────────────────── */
  function bindEvents() {
    
    var startBtn = $('bbqStartBtn');
    if (startBtn) startBtn.addEventListener('click', function () { goTo(1); });

    
    var closeBtn = $('bbqCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeQuiz);

    
    var overlay = $('bbw-quiz-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeQuiz();
      });
    }

    
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeQuiz();
    });

    
    document.querySelectorAll('#bbqQ1Options .bbq-opt-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#bbqQ1Options .bbq-opt-card').forEach(function (b) {
          b.classList.remove('bbq-selected');
        });
        btn.classList.add('bbq-selected');
        var val = btn.getAttribute('data-val');
        setTimeout(function () { onStyleSelected(val); }, 320);
      });
    });

    
    document.querySelectorAll('#bbqQ2Options .bbq-opt-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#bbqQ2Options .bbq-opt-card').forEach(function (b) {
          b.classList.remove('bbq-selected');
        });
        btn.classList.add('bbq-selected');
        var val = btn.getAttribute('data-val');
        setTimeout(function () { onOccasionSelected(val); }, 320);
      });
    });

    
    var atcBtn = $('bbqAddToCartBtn');
    if (atcBtn) atcBtn.addEventListener('click', addResultToCart);

    
    var retakeBtn = $('bbqRetakeBtn');
    if (retakeBtn) retakeBtn.addEventListener('click', resetQuiz);

    
    var backBtn = $('bbqNavBack');
    if (backBtn) backBtn.addEventListener('click', goBack);

    /* ── Trigger links in footer / header / anywhere ──
       Any element with id="bbwFindYourBestLink"
       OR data-open-quiz="true" will open the quiz.
    ── */
    function bindOpenTriggers() {
      
      var footerLink = $('bbwFindYourBestLink');
      if (footerLink) {
        footerLink.addEventListener('click', function (e) {
          e.preventDefault();
          openQuiz();
        });
      }

      
      document.querySelectorAll('[data-open-quiz]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          openQuiz();
        });
      });
    }

    bindOpenTriggers();

    
    setTimeout(bindOpenTriggers, 1200);
    setTimeout(bindOpenTriggers, 3000);
  }

  /* ──────────────────────────────────────────────────────────────
     LOAD QUIZ SETTINGS
  ────────────────────────────────────────────────────────────── */
  function loadSettings() {
    var settings = (window.__allProducts || []).find(function (p) {
      return p.type === 'settings';
    }) || {};
    state.quizSettings = settings.style_quiz || {};
  }

  /* ──────────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────────── */
  function init() {
    loadSettings();
    bindEvents();
    // Start on intro (hidden until opened)
    goTo(0);

    
    window.openStyleQuiz = openQuiz;
    window.closeStyleQuiz = closeQuiz;
  }

  /* ──────────────────────────────────────────────────────────────
     BOOTSTRAP
  ────────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      waitForProducts(init);
    });
  } else {
    waitForProducts(init);
  }

})();

document.addEventListener('click', function (e) {
  var el = e.target;
  if (
    el.tagName === 'A' &&
    (
      el.id === 'bbwFindYourBestLink' ||
      el.getAttribute('data-open-quiz') ||
      (el.textContent && el.textContent.trim().toLowerCase().includes('find your best'))
    )
  ) {
    e.preventDefault();
    if (typeof window.openStyleQuiz === 'function') window.openStyleQuiz();
  }
});




/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — STYLE LOOKBOOK POPUP JS
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  
  var overlay  = document.getElementById('bbwStyleOverlay');
  var closeBtn = document.getElementById('bbwsCloseBtn');
  var tabs     = document.querySelectorAll('.bbws-tab');
  var panels   = document.querySelectorAll('.bbws-panel');

  if (!overlay) return; 

  /* ─────────────────────────────────────────
     OUVRIR
  ───────────────────────────────────────── */
  function openStylePopup() {
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('bbws-active');
    document.body.style.overflow = 'hidden';
    
    switchTab('casual', false);
  }

  /* ─────────────────────────────────────────
     FERMER
  ───────────────────────────────────────── */
  function closeStylePopup() {
    overlay.classList.remove('bbws-active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ─────────────────────────────────────────
     SWITCH D'ONGLET
  ───────────────────────────────────────── */
  function switchTab(tabId, fromLeft) {
    tabs.forEach(function (t) {
      var active = t.getAttribute('data-tab') === tabId;
      t.classList.toggle('bbws-tab--active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach(function (p) {
      var panelId = 'bbws-panel-' + tabId;
      var isActive = p.id === panelId;

      if (isActive) {
        p.classList.add('bbws-panel--active');
        
        var imgs = p.querySelectorAll('.bbws-img-wrap');
        imgs.forEach(function (img) {
          img.style.animation = 'none';
          
          void img.offsetWidth;
          img.style.animation = '';
        });
      } else {
        p.classList.remove('bbws-panel--active');
      }
    });
  }

  /* ─────────────────────────────────────────
     ÉVÉNEMENTS — ONGLETS
  ───────────────────────────────────────── */
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var tabId = tab.getAttribute('data-tab');
      switchTab(tabId, false);
    });
  });

  /* ─────────────────────────────────────────
     ÉVÉNEMENTS — FERMETURE
  ───────────────────────────────────────── */
  if (closeBtn) {
    closeBtn.addEventListener('click', closeStylePopup);
  }

  
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeStylePopup();
  });

  
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('bbws-active')) {
      closeStylePopup();
    }
  });

  function bindStyleTriggers() {
    
    document.querySelectorAll('[data-open-style-popup]').forEach(function (el) {
      if (!el._bbwsStyleBound) {
        el._bbwsStyleBound = true;
        el.addEventListener('click', function (e) {
          e.preventDefault();
          openStylePopup();
        });
      }
    });

    
    var allLinks = document.querySelectorAll('a, button');
    allLinks.forEach(function (el) {
      if (el._bbwsStyleBound) return;
      var txt = (el.textContent || '').trim().toLowerCase();
      if (txt === 'bbw4life style') {
        el._bbwsStyleBound = true;
        el.addEventListener('click', function (e) {
          e.preventDefault();
          openStylePopup();
        });
      }
    });
  }

  
  bindStyleTriggers();
  setTimeout(bindStyleTriggers, 800);
  setTimeout(bindStyleTriggers, 2000);
  setTimeout(bindStyleTriggers, 4000);

  /* ─────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────── */
  window.openStylePopup  = openStylePopup;
  window.closeStylePopup = closeStylePopup;

  
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'A') return;

    var txt = (el.textContent || '').trim().toLowerCase();
    if (
      el.getAttribute('data-open-style-popup') !== null ||
      txt === 'bbw4life style'
    ) {
      e.preventDefault();
      openStylePopup();
    }
  });

})();




(function () {
  'use strict';

  var overlay  = document.getElementById('bbwLookOverlay');
  var closeBtn = document.getElementById('bbwlCloseBtn');
  var tabs     = document.querySelectorAll('.bbwl-tab');
  var panels   = document.querySelectorAll('.bbwl-panel');
  var rendered = {};

  if (!overlay) return;
  function waitForProducts(cb) {
    if (window.__allProducts && window.__allProducts.length) {
      cb();
      return;
    }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll);
        cb();
      } else if (++tries > 100) {
        clearInterval(poll);
        cb();
      }
    }, 100);
  }

  
  function getSettings() {
    var all = window.__allProducts || [];
    var settings = all.find(function (p) { return p.type === 'settings'; }) || {};
    return settings.find_your_look || {};
  }

  
  function getProductById(id) {
    var all = window.__allProducts || [];
    return all.find(function (p) { return p.id === id; }) || null;
  }

  
  function getProductImage(prod, colorName) {
    if (!prod) return '';

    var imgUrl = prod.image || '';

    
    if (colorName && prod.colors && prod.colors.length) {
      var colorObj = prod.colors.find(function (c) { return c.name === colorName; });
      if (colorObj && colorObj.image) {
        imgUrl = colorObj.image;
      }
    }

    
    if (typeof upgradeShopifyImageUrl === 'function' && imgUrl) {
      return upgradeShopifyImageUrl(imgUrl, 400);
    }

    return imgUrl;
  }

  function formatPrice(price) {
    return '$' + parseFloat(price || 0).toFixed(2);
  }

  
  function buildProductCard(prod, styleLabel) {
    if (!prod) return null;

    
    var firstColor = (prod.colors && prod.colors.length) ? prod.colors[0].name : null;
    var imgSrc = getProductImage(prod, firstColor);

    var price = prod.price || 0;
    var comparePrice = prod.compare_price || 0;

    var priceHtml = formatPrice(price);
    if (comparePrice && comparePrice > price) {
      priceHtml += '<del>' + formatPrice(comparePrice) + '</del>';
    }

    
    var url = '#';
    if (typeof getProductUrl === 'function') {
      url = getProductUrl(prod.id);
    } else if (prod.url) {
      url = prod.url;
    }

    var card = document.createElement('a');
    card.href = url;
    card.className = 'bbwl-prod-card';

    card.innerHTML =
      '<div class="bbwl-prod-img-wrap">' +
        '<img src="' + imgSrc + '" alt="' + (prod.title || '') + '" loading="lazy"/>' +
        (styleLabel ? '<span class="bbwl-prod-style-label">' + styleLabel + '</span>' : '') +
        '<span class="bbwl-prod-link-hint"><i class="fa-solid fa-arrow-right"></i></span>' +
      '</div>' +
      '<div class="bbwl-prod-body">' +
        '<p class="bbwl-prod-title">' + (prod.title || '') + '</p>' +
        '<p class="bbwl-prod-price">' + priceHtml + '</p>' +
      '</div>';

    return card;
  }

  
  function renderMorph(morphKey) {
    if (rendered[morphKey]) return;
    rendered[morphKey] = true;

    var cfg = getSettings();
    var morphData = cfg[morphKey] || {};
    var items = morphData.items || [];

    var gridEl = document.getElementById('bbwl-products-' + morphKey);
    if (!gridEl) return;

    gridEl.innerHTML = '';

    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'bbwl-prod-empty';
      empty.innerHTML = '<i class="fa-solid fa-circle-info"></i> No products configured for this look yet.';
      gridEl.appendChild(empty);
      return;
    }

    
    var validItems = items.filter(function (item) {
      return !!getProductById(item.product_id);
    });

    var colCount = validItems.length >= 3 ? 3 : 2;
    gridEl.className = 'bbwl-products-grid bbwl-products-grid--' + colCount + 'col';

    var animDelay = 0.08;
    items.forEach(function (item) {
      var prod = getProductById(item.product_id);
      if (!prod) return;

      var card = buildProductCard(prod, item.label || '');
      if (card) {
        card.style.animationDelay = animDelay + 's';
        animDelay += 0.08;
        gridEl.appendChild(card);
      }
    });

    
    var panel = gridEl.closest('.bbwl-panel');
    if (panel && morphData.collection_url) {
      var ctaBtn = panel.querySelector('.bbwl-cta-btn');
      if (ctaBtn) ctaBtn.href = morphData.collection_url;
    }
  }

  
  function switchTab(morphKey) {
    tabs.forEach(function (t) {
      var active = t.getAttribute('data-morph') === morphKey;
      t.classList.toggle('bbwl-tab--active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach(function (p) {
      var isActive = p.id === 'bbwl-panel-' + morphKey;
      if (isActive) {
        p.classList.add('bbwl-panel--active');
        
        p.style.animation = 'none';
        void p.offsetWidth;
        p.style.animation = '';
        
        waitForProducts(function () {
          renderMorph(morphKey);
        });
      } else {
        p.classList.remove('bbwl-panel--active');
      }
    });
  }

  
  function openLookPopup() {
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('bbwl-active');
    document.body.style.overflow = 'hidden';
    
    rendered = {};
    switchTab('apple');
  }

  
  function closeLookPopup() {
    overlay.classList.remove('bbwl-active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchTab(tab.getAttribute('data-morph'));
    });
  });

  
  if (closeBtn) closeBtn.addEventListener('click', closeLookPopup);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeLookPopup();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('bbwl-active')) closeLookPopup();
  });

  
  function bindTriggers() {
    document.querySelectorAll('a, button, li').forEach(function (el) {
      if (el._bbwlLookBound) return;
      var txt = (el.textContent || '').trim().toLowerCase();
      var hasAttr = el.getAttribute('data-open-look-popup') !== null;
      if (hasAttr || txt === 'find your look') {
        el._bbwlLookBound = true;
        el.addEventListener('click', function (e) {
          e.preventDefault();
          openLookPopup();
        });
      }
    });
  }

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el) return;
    var txt = (el.textContent || '').trim().toLowerCase();
    var hasAttr = el.getAttribute && el.getAttribute('data-open-look-popup') !== null;
    if (hasAttr || txt === 'find your look') {
      e.preventDefault();
      openLookPopup();
    }
  });

  function boot() {
    bindTriggers();
    setTimeout(bindTriggers, 800);
    setTimeout(bindTriggers, 2000);
    setTimeout(bindTriggers, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.openLookPopup  = openLookPopup;
  window.closeLookPopup = closeLookPopup;

})();



(function () {
  'use strict';

  var overlay  = document.getElementById('bdOverlay');
  var modal    = document.getElementById('bdModal');
  var closeBtn = document.getElementById('bdClose');
  var mainBtn  = document.getElementById('bdMainBtn');

  if (!overlay || !modal) return;

  var COLLECTION_URL = '/collections/bbw4life-all-product.html';
  var CD_KEY         = 'bd_countdown_end';

  function openPopup() {
    overlay.classList.add('bwflash-active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    startUrgencyBar();
  }

  function closePopup() {
    overlay.classList.remove('bwflash-active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closePopup);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePopup();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopup();
  });

  if (mainBtn) {
    mainBtn.addEventListener('click', function () {
      window.location.href = COLLECTION_URL;
    });
  }

  function bindTriggers() {
    document.querySelectorAll('a, button, li').forEach(function (el) {
      if (el._bdBound) return;
      var txt  = (el.textContent || '').trim().toLowerCase();
      var href = el.getAttribute('href') || '';
      var id   = el.id || '';
      if (
        id === 'openBigDealsPopup' ||
        txt === 'big deals' ||
        (href === '#' && txt === 'big deals')
      ) {
        el._bdBound = true;
        el.addEventListener('click', function (e) {
          e.preventDefault();
          openPopup();
        });
      }
    });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button, li');
    if (!el) return;
    var txt = (el.textContent || '').trim().toLowerCase();
    if (txt === 'big deals') {
      e.preventDefault();
      openPopup();
    }
  });

  bindTriggers();
  setTimeout(bindTriggers, 800);
  setTimeout(bindTriggers, 2000);
  setTimeout(bindTriggers, 4000);

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function startCountdown() {
    var hEl = document.getElementById('bdH');
    var mEl = document.getElementById('bdM');
    var sEl = document.getElementById('bdS');
    if (!hEl || !mEl || !sEl) return;

    var now    = Date.now();
    var stored = parseInt(localStorage.getItem(CD_KEY) || '0');

    var endTime;
    if (stored && stored > now) {
      endTime = stored;
    } else {
      endTime = now + 24 * 3600 * 1000;
      localStorage.setItem(CD_KEY, endTime);
    }

    function tick() {
      var rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      if (rem === 0) {
        endTime = Date.now() + 24 * 3600 * 1000;
        localStorage.setItem(CD_KEY, endTime);
      }
      var hh = Math.floor(rem / 3600);
      var mm = Math.floor((rem % 3600) / 60);
      var ss = rem % 60;
      hEl.textContent = pad(hh);
      mEl.textContent = pad(mm);
      sEl.textContent = pad(ss);
    }

    tick();
    setInterval(tick, 1000);
  }

  startCountdown();

  function startUrgencyBar() {
    var fill = document.getElementById('bdUrgFill');
    if (!fill) return;

    var CD_URG_KEY  = 'bd_urgency_start';
    var TOTAL_SECS  = 86400;
    var now         = Date.now();
    var startStored = parseInt(localStorage.getItem(CD_URG_KEY) || '0');

    if (!startStored || now - startStored > TOTAL_SECS * 1000) {
      startStored = now;
      localStorage.setItem(CD_URG_KEY, startStored);
    }

    function updateBar() {
      var elapsed = (Date.now() - startStored) / 1000;
      var pct     = Math.max(0, 100 - (elapsed / TOTAL_SECS) * 100);
      fill.style.width = pct.toFixed(2) + '%';
    }

    updateBar();
    setInterval(updateBar, 5000);
  }

  function buildPromosCard(settings) {
    var listEl = document.getElementById('bdPromosList');
    if (!listEl) return;

    var promos = settings.promos || [];
    if (!promos.length) {
      listEl.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,.40)">Check our site for active promo codes</span>';
      return;
    }

    var MAX_SHOW = 3;
    var shown   = promos.slice(0, MAX_SHOW);
    listEl.innerHTML = '';

    shown.forEach(function (p, i) {
      if (i > 0) {
        var div = document.createElement('div');
        div.className = 'bwflash-promo-divider';
        listEl.appendChild(div);
      }

      var row = document.createElement('div');
      row.className = 'bwflash-promo-row';

      var pct = document.createElement('span');
      pct.className   = 'bwflash-promo-percent';
      pct.textContent = p.percent + '% OFF';

      var items = document.createElement('span');
      items.className   = 'bwflash-promo-items';
      items.textContent = 'On ' + p.items + '+ items';

      var pill = document.createElement('span');
      pill.className   = 'bwflash-code-pill';
      pill.textContent = p.code;
      pill.title       = 'Click to copy';

      var copyBtn = document.createElement('button');
      copyBtn.className = 'bwflash-copy-btn';
      copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';

      (function (code, btn) {
        function doCopy() {
          navigator.clipboard.writeText(code).then(function () {
            btn.classList.add('bwflash-copied');
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(function () {
              btn.classList.remove('bwflash-copied');
              btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2200);
          }).catch(function () {
            var ta = document.createElement('textarea');
            ta.value = code;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            btn.classList.add('bwflash-copied');
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(function () {
              btn.classList.remove('bwflash-copied');
              btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2200);
          });
        }
        btn.addEventListener('click', doCopy);
        pill.addEventListener('click', doCopy);
      })(p.code, copyBtn);

      row.appendChild(pct);
      row.appendChild(items);
      row.appendChild(pill);
      row.appendChild(copyBtn);
      listEl.appendChild(row);
    });
  }

  function buildShippingCard(settings) {
    var valEl = document.getElementById('bdShipVal');
    if (!valEl) return;

    var cd        = settings.cart_drawer || {};
    var threshold = parseFloat(cd.free_shipping_threshold) || 75;
    valEl.textContent = '$' + threshold.toFixed(0);
  }

  function buildBuyGetCard(settings) {
    var valEl  = document.getElementById('bdBuyGetVal');
    var descEl = document.getElementById('bdBuyGetDesc');
    if (!valEl || !descEl) return;

    var cd  = settings.cart_drawer || {};
    var buy = parseInt(cd.promo_buy_quantity) || 3;
    var get = parseInt(cd.promo_get_quantity)  || 1;

    valEl.textContent  = buy + ' + ' + get;
    descEl.textContent = 'Buy ' + buy + ' item' + (buy > 1 ? 's' : '') + ', get ' + get + ' absolutely free';
  }

  function loadSettings() {
    if (window.__allProducts && window.__allProducts.length) {
      var s = window.__allProducts.find(function (p) { return p.type === 'settings'; }) || {};
      buildPromosCard(s);
      buildShippingCard(s);
      buildBuyGetCard(s);
      return;
    }

    fetch('/products.data.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        window.__allProducts = window.__allProducts || data;
        var s = data.find(function (p) { return p.type === 'settings'; }) || {};
        buildPromosCard(s);
        buildShippingCard(s);
        buildBuyGetCard(s);
      })
      .catch(function () {
        buildPromosCard({});
        buildShippingCard({});
        buildBuyGetCard({});
      });
  }

  loadSettings();

  window.openBigDealsPopup  = openPopup;
  window.closeBigDealsPopup = closePopup;

})();



/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — COMMITMENT POPUP
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var BBWC_OVERLAY_ID = 'bbwCommitmentOverlay';
  var BBWC_CLOSE_ID   = 'bbwcCloseBtn';

  
  function bbwcOpen() {
    var overlay = document.getElementById(BBWC_OVERLAY_ID);
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('bbwc-active');
    document.body.style.overflow = 'hidden';
  }

  
  function bbwcClose() {
    var overlay = document.getElementById(BBWC_OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove('bbwc-active');
    overlay.setAttribute('aria-hidden', 'true');
    
    var otherOpen = document.querySelector(
      '#bbw-quiz-overlay.bbq-active, #bbwStyleOverlay.bbws-active, #bbwLookOverlay.bbwl-active, #bdOverlay.bd-active'
    );
    if (!otherOpen) {
      document.body.style.overflow = '';
    }
  }

  
  function bbwcBindTriggers() {
    document.querySelectorAll('a, button, li').forEach(function (el) {
      if (el._bbwcBound) return;

      var txt     = (el.textContent || '').trim().toLowerCase();
      var hasAttr = el.getAttribute && el.getAttribute('data-open-commitment') !== null;

      if (hasAttr || txt === 'commitment') {
        el._bbwcBound = true;
        el.addEventListener('click', function (e) {
          e.preventDefault();
          bbwcOpen();
        });
      }
    });
  }

  
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el) return;

    
    var anchor = el.closest ? el.closest('a, button, li') : el;
    if (!anchor) return;

    var txt     = (anchor.textContent || '').trim().toLowerCase();
    var hasAttr = anchor.getAttribute && anchor.getAttribute('data-open-commitment') !== null;

    if (hasAttr || txt === 'commitment') {
      e.preventDefault();
      bbwcOpen();
    }
  });

  
  function bbwcInit() {
    var overlay  = document.getElementById(BBWC_OVERLAY_ID);
    var closeBtn = document.getElementById(BBWC_CLOSE_ID);

    if (!overlay) return; 

    if (closeBtn) {
      closeBtn.addEventListener('click', bbwcClose);
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) bbwcClose();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('bbwc-active')) {
        bbwcClose();
      }
    });

    
    bbwcBindTriggers();
    setTimeout(bbwcBindTriggers, 800);
    setTimeout(bbwcBindTriggers, 2000);
    setTimeout(bbwcBindTriggers, 4000);
  }

  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bbwcInit);
  } else {
    bbwcInit();
  }

  
  window.openCommitmentPopup  = bbwcOpen;
  window.closeCommitmentPopup = bbwcClose;

})();





/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — NEWSLETTER POPUP JS
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     DOM REFS
  ────────────────────────────────────────────────────────── */
  var overlay      = document.getElementById('bbwNlOverlay');
  var closeBtn     = document.getElementById('bbwNlClose');
  var form         = document.getElementById('bbwNlForm');
  var submitBtn    = document.getElementById('bbwNlSubmit');
  var errorEl      = document.getElementById('bbwNlError');
  var successEl    = document.getElementById('bbwNlSuccess');
  var successClose = document.getElementById('bbwNlSuccessClose');
  var particlesEl  = document.getElementById('bbwNlParticles');
  var confettiEl   = document.getElementById('bbwNlConfetti');

  var inputFirst = document.getElementById('bbwNlFirst');
  var inputLast  = document.getElementById('bbwNlLast');
  var inputEmail = document.getElementById('bbwNlEmail');
  var inputBday  = document.getElementById('bbwNlBday');

  if (!overlay) return; 

  /* ──────────────────────────────────────────────────────────
     RISING PARTICLES (ambient)
  ────────────────────────────────────────────────────────── */
  var PTCL_COLORS = [
    'rgba(201,150,62,0.55)',
    'rgba(192,56,94,0.45)',
    'rgba(232,188,106,0.40)',
    'rgba(123,63,110,0.35)',
    'rgba(255,215,0,0.30)'
  ];

  function spawnParticles() {
    if (!particlesEl) return;
    particlesEl.innerHTML = '';
    for (var i = 0; i < 18; i++) {
      var p    = document.createElement('div');
      p.className = 'bbwnl-ptcl';
      var sz   = Math.random() * 5 + 3;
      var dur  = Math.random() * 5 + 4;
      var del  = Math.random() * 6;
      var left = Math.random() * 100;
      var drift = (Math.random() - 0.5) * 60;
      p.style.cssText =
        'width:' + sz + 'px;' +
        'height:' + sz + 'px;' +
        'left:' + left + '%;' +
        'background:' + PTCL_COLORS[Math.floor(Math.random() * PTCL_COLORS.length)] + ';' +
        'animation-duration:' + dur + 's;' +
        'animation-delay:' + del + 's;' +
        '--drift:' + drift + 'px;' +
        'border-radius:' + (Math.random() > 0.4 ? '50%' : '3px') + ';';
      particlesEl.appendChild(p);
    }
  }

  /* ──────────────────────────────────────────────────────────
     CONFETTI BURST (success)
  ────────────────────────────────────────────────────────── */
  function fireConfetti() {
    if (!confettiEl) return;
    confettiEl.innerHTML = '';
    var colors = ['#c9963e','#c0385e','#e8bc6a','#7b3f6e','#FFD700','#fff','#d4506e'];
    for (var i = 0; i < 42; i++) {
      var piece = document.createElement('div');
      piece.className = 'bbwnl-confetti-piece';
      var sz  = Math.random() * 9 + 5;
      var dur = Math.random() * 1.4 + 0.9;
      var del = Math.random() * 0.6;
      piece.style.cssText =
        'left:' + (Math.random() * 100) + '%;' +
        'width:' + sz + 'px;' +
        'height:' + sz + 'px;' +
        'background:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
        'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
        'animation-duration:' + dur + 's;' +
        'animation-delay:' + del + 's;';
      confettiEl.appendChild(piece);
    }
    
    setTimeout(function () {
      if (confettiEl) confettiEl.innerHTML = '';
    }, 2200);
  }

  /* ──────────────────────────────────────────────────────────
     SUCCESS MESSAGE TEXT — unified with settings.newsletter_popup
     (same source used by #newsletter-popup on the home newsletter
     section), so the thank-you message is identical everywhere.
  ────────────────────────────────────────────────────────── */
  function applySuccessTexts() {
    var allProducts = window.__allProducts || [];
    var settings = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
    var np = settings.newsletter_popup || {};

    var titleEl = document.getElementById('bbwNlSuccessTitle');
    var msgEl   = document.getElementById('bbwNlSuccessMsg');
    var closeEl = document.getElementById('bbwNlSuccessCloseText');

    if (titleEl && np.title)     titleEl.textContent = np.title;
    if (msgEl   && np.message)   msgEl.textContent   = np.message;
    if (closeEl && np.close_btn) closeEl.textContent = np.close_btn;
  }

  /* ──────────────────────────────────────────────────────────
     OPEN / CLOSE
  ────────────────────────────────────────────────────────── */
  function openPopup() {
    resetForm();
    applySuccessTexts();
    overlay.classList.add('bbwnl-active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    spawnParticles();
  }

  function closePopup() {
    overlay.classList.remove('bbwnl-active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function resetForm() {
    if (form)        form.style.display    = 'flex';
    if (successEl)   successEl.style.display = 'none';
    if (errorEl)     { errorEl.textContent = ''; errorEl.classList.remove('bbwnl-error--visible'); }
    if (inputFirst)  inputFirst.value  = '';
    if (inputLast)   inputLast.value   = '';
    if (inputEmail)  inputEmail.value  = '';
    if (inputBday)   inputBday.value   = '';
    if (submitBtn)   {
      submitBtn.disabled = false;
      showBtnText();
    }
    if (inputEmail)  inputEmail.classList.remove('bbwnl-input--invalid');

    var thankYouEl  = document.getElementById('bbwNlThankYou');
    var spinStepEl  = document.getElementById('bbwNlSpinStep');
    var resultStepEl = document.getElementById('bbwNlResultStep');
    var wheelEl      = document.getElementById('nlSpinWheel');
    var spinBtn       = document.getElementById('nlSpinBtn');
    if (thankYouEl)   thankYouEl.style.display   = 'block';
    if (spinStepEl)   spinStepEl.style.display   = 'none';
    if (resultStepEl) resultStepEl.style.display = 'none';
    if (wheelEl) { wheelEl.style.transition = 'none'; wheelEl.style.transform = 'rotate(0deg)'; }
    if (spinBtn)  spinBtn.disabled = false;
  }

  /* ──────────────────────────────────────────────────────────
     BUTTON STATE HELPERS
  ────────────────────────────────────────────────────────── */
  function showBtnText() {
    var txtEl  = submitBtn ? submitBtn.querySelector('.bbwnl-cta-text')   : null;
    var ldrEl  = submitBtn ? submitBtn.querySelector('.bbwnl-cta-loader') : null;
    if (txtEl) txtEl.style.display = 'flex';
    if (ldrEl) ldrEl.style.display = 'none';
  }

  function showBtnLoader() {
    var txtEl  = submitBtn ? submitBtn.querySelector('.bbwnl-cta-text')   : null;
    var ldrEl  = submitBtn ? submitBtn.querySelector('.bbwnl-cta-loader') : null;
    if (txtEl) txtEl.style.display = 'none';
    if (ldrEl) ldrEl.style.display = 'flex';
  }

  /* ──────────────────────────────────────────────────────────
     ERROR HELPER
  ────────────────────────────────────────────────────────── */
  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.add('bbwnl-error--visible');
    
    errorEl.style.animation = 'none';
    void errorEl.offsetHeight;
    errorEl.style.animation = '';
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('bbwnl-error--visible');
  }

  /* ──────────────────────────────────────────────────────────
     FORM SUBMIT → EXISTING SHEET SYSTEM
  ────────────────────────────────────────────────────────── */
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError();

      var firstName = (inputFirst  ? inputFirst.value.trim()  : '');
      var lastName  = (inputLast   ? inputLast.value.trim()   : '');
      var email     = (inputEmail  ? inputEmail.value.trim()  : '');
      var birthday  = (inputBday   ? inputBday.value.trim()   : '');

      
      if (!email || !email.includes('@') || !email.includes('.')) {
        showError('Please enter a valid email address.');
        if (inputEmail) {
          inputEmail.classList.add('bbwnl-input--invalid');
          inputEmail.focus();
        }
        return;
      }

      submitBtn.disabled = true;
      showBtnLoader();

      try {
        
        var res = await fetch('/.netlify/functions/save-account', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:     'newsletter-subscribe',
            email:      email,
            firstName:  firstName,
            lastName:   lastName,
            birthday:   birthday,
            newsletter: 'Yes'
          })
        });
        var data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Subscription failed. Please try again.');
        }


        if (form)      form.style.display      = 'none';
        if (successEl) successEl.style.display = 'block';

        try { localStorage.setItem('bbwnl_subscribed', 'yes'); } catch (e) {}
        document.dispatchEvent(new CustomEvent('bbwnl:subscribed'));


        if (window.BbwNlSpinWheel && window.BbwNlSpinWheel.isEnabled()) {
          window.BbwNlSpinWheel.start(email, firstName);
        } else {
          fireConfetti();
          setTimeout(closePopup, 5000);
        }

      } catch (err) {
        showError(err.message || 'Something went wrong. Please try again.');
        submitBtn.disabled = false;
        showBtnText();
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     CLOSE EVENTS
  ────────────────────────────────────────────────────────── */
  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (successClose) successClose.addEventListener('click', closePopup);

  var resultCloseBtn = document.getElementById('nlResultCloseBtn');
  if (resultCloseBtn) resultCloseBtn.addEventListener('click', closePopup);


  overlay.addEventListener('click', function (e) {
    var modal = overlay.querySelector('.bbwnl-modal');
    if (modal && !modal.contains(e.target)) closePopup();
  });

  
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('bbwnl-active')) closePopup();
  });

  
  if (inputEmail) {
    inputEmail.addEventListener('input', function () {
      this.classList.remove('bbwnl-input--invalid');
      clearError();
    });
  }

  /* ──────────────────────────────────────────────────────────
     BIND TRIGGERS
     Matches:
       • <a>/<button> with trimmed text "Our newsletter"  (footer link)
       • Any element with data-open-newsletter attribute
  ────────────────────────────────────────────────────────── */
  function bindTriggers() {
    document.querySelectorAll('a, button, li').forEach(function (el) {
      if (el._bbwNlBound) return;

      var hasAttr  = el.getAttribute && el.getAttribute('data-open-newsletter') !== null;
      var txt      = (el.textContent || '').trim().toLowerCase();
      var isMatch  = hasAttr || txt === 'our newsletter';

      if (isMatch) {
        el._bbwNlBound = true;
        el.addEventListener('click', function (ev) {
          ev.preventDefault();
          openPopup();
        });
      }
    });
  }

  
  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button, li');
    if (!el) return;
    var hasAttr = el.getAttribute && el.getAttribute('data-open-newsletter') !== null;
    var txt     = (el.textContent || '').trim().toLowerCase();
    if (hasAttr || txt === 'our newsletter') {
      e.preventDefault();
      openPopup();
    }
  });

 
  bindTriggers();
  setTimeout(bindTriggers, 800);
  setTimeout(bindTriggers, 2000);
  setTimeout(bindTriggers, 4000);

  /* ──────────────────────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────────────────────── */
  window.openNewsletterPopup  = openPopup;
  window.closeNewsletterPopup = closePopup;

})();




/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — NEWSLETTER SPIN-TO-WIN WHEEL
   Extends the newsletter popup's success step with a reward wheel.
   EVERYTHING here is read live from settings.newsletter_spin_wheel,
   settings.promos and settings.cart_drawer at the moment it's needed —
   no segment, code, percent, quantity or threshold is ever hardcoded.
═══════════════════════════════════════════════════════════════ */
window.BbwNlSpinWheel = (function () {
  'use strict';

  var WHEEL_COLORS = ['#15110E', '#F6EFE5', '#B8925A'];

  function getSettings() {
    var allProducts = window.__allProducts || [];
    return allProducts.find(function (p) { return p.type === 'settings'; }) || {};
  }

  function getWheelConfig() {
    var settings = getSettings();
    return settings.newsletter_spin_wheel || {};
  }

  function isEnabled() {
    var cfg = getWheelConfig();
    return (cfg.show || 'no').toString().toLowerCase().trim() === 'yes'
      && Array.isArray(cfg.segments) && cfg.segments.length > 0;
  }

  function isOnePerEmail() {
    var cfg = getWheelConfig();
    return (cfg.one_spin_per_email || 'no').toString().toLowerCase().trim() === 'yes';
  }

  function spinStorageKey(email) {
    return 'bbw_spin_used_' + (email || 'anon').toLowerCase().trim();
  }

  /* ────────────────────────────────────────────────────────────
     Look up the real promo (code + percent) referenced by a segment,
     always live from settings.promos — never a value typed into JS.
  ────────────────────────────────────────────────────────────── */
  function resolvePromo(promoCodeRef) {
    if (!promoCodeRef) return null;
    var settings = getSettings();
    var promos = Array.isArray(settings.promos) ? settings.promos : [];
    return promos.find(function (p) {
      return (p.code || '').toString().toLowerCase() === promoCodeRef.toString().toLowerCase();
    }) || null;
  }

  /* ────────────────────────────────────────────────────────────
     Weighted random pick among segments (higher weight = more likely).
  ────────────────────────────────────────────────────────────── */
  function pickWeightedSegment(segments) {
    var total = segments.reduce(function (sum, s) { return sum + (parseFloat(s.weight) || 0); }, 0);
    if (total <= 0) return segments[Math.floor(Math.random() * segments.length)];
    var r = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < segments.length; i++) {
      acc += (parseFloat(segments[i].weight) || 0);
      if (r <= acc) return segments[i];
    }
    return segments[segments.length - 1];
  }

  /* ────────────────────────────────────────────────────────────
     Build the wheel SVG dynamically from N segments — no fixed
     segment count anywhere, it adapts to whatever settings provide.
  ────────────────────────────────────────────────────────────── */
  function polarPoint(cx, cy, r, angleDeg) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  /* Segment label: read as-is from settings, except "bxgx" which is always
     rebuilt live from settings.cart_drawer (buy/get quantities can change
     anytime without editing the wheel's label text). */
  function getSegmentLabel(seg) {
    if ((seg.type || '').toLowerCase() === 'bxgx') {
      var settings = getSettings();
      var cd = settings.cart_drawer || {};
      var buyQty = cd.promo_buy_quantity;
      var getQty = cd.promo_get_quantity;
      return 'BUY ' + buyQty + ' GET ' + getQty;
    }
    return seg.label || '';
  }

  function buildWheelSvg(segments) {
    var svg = document.getElementById('nlSpinWheelSvg');
    if (!svg) return;
    svg.innerHTML = '';

    var cx = 150, cy = 150, r = 148;
    var n = segments.length;
    var sliceAngle = 360 / n;
    var ns = 'http://www.w3.org/2000/svg';

    segments.forEach(function (seg, i) {
      var startAngle = i * sliceAngle;
      var endAngle   = startAngle + sliceAngle;
      var p1 = polarPoint(cx, cy, r, startAngle);
      var p2 = polarPoint(cx, cy, r, endAngle);
      var largeArc = sliceAngle > 180 ? 1 : 0;

      var path = document.createElementNS(ns, 'path');
      path.setAttribute('d',
        'M' + cx + ',' + cy +
        ' L' + p1.x.toFixed(2) + ',' + p1.y.toFixed(2) +
        ' A' + r + ',' + r + ' 0 ' + largeArc + ',1 ' + p2.x.toFixed(2) + ',' + p2.y.toFixed(2) +
        ' Z');
      path.setAttribute('fill', WHEEL_COLORS[i % WHEEL_COLORS.length]);
      path.setAttribute('stroke', '#B8925A');
      path.setAttribute('stroke-width', '1');
      svg.appendChild(path);

      var midAngle = startAngle + sliceAngle / 2;
      var isDarkSlice = WHEEL_COLORS[i % WHEEL_COLORS.length] === '#15110E';
      var label = getSegmentLabel(seg);

      /* Radial (vertical) text — runs from near the center out toward the
         rim along the slice's bisector, instead of following the arc. This
         leaves room to add more segments later without the label wrapping
         or overlapping neighbouring slices. */
      var textStartR = r * 0.30;
      var textEndR   = r * 0.90;
      var startPos = polarPoint(cx, cy, textStartR, midAngle);
      var textPathId = 'nlSpinTextPath' + i;

      var defs = svg.querySelector('defs') || (function () {
        var d = document.createElementNS(ns, 'defs');
        svg.insertBefore(d, svg.firstChild);
        return d;
      })();

      var endPos = polarPoint(cx, cy, textEndR, midAngle);
      var pathDef = document.createElementNS(ns, 'path');
      pathDef.setAttribute('id', textPathId);
      pathDef.setAttribute('d', 'M' + startPos.x.toFixed(2) + ',' + startPos.y.toFixed(2) +
        ' L' + endPos.x.toFixed(2) + ',' + endPos.y.toFixed(2));
      pathDef.setAttribute('fill', 'none');
      defs.appendChild(pathDef);

      var text = document.createElementNS(ns, 'text');
      text.setAttribute('fill', isDarkSlice ? '#F6EFE5' : '#15110E');
      text.setAttribute('font-size', segments.length > 6 ? '10' : '12');
      text.setAttribute('font-weight', '700');
      text.setAttribute('font-family', 'Inter, system-ui, sans-serif');

      var textPath = document.createElementNS(ns, 'textPath');
      textPath.setAttribute('href', '#' + textPathId);
      textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + textPathId);
      textPath.setAttribute('startOffset', '0');
      textPath.textContent = label;
      text.appendChild(textPath);
      svg.appendChild(text);
    });
  }

  /* ────────────────────────────────────────────────────────────
     Build the result copy for a winning segment — every number/code
     comes from settings at the moment this runs.
  ────────────────────────────────────────────────────────────── */
  function buildResultContent(seg) {
    var settings = getSettings();
    var cd = settings.cart_drawer || {};
    var type = (seg.type || '').toLowerCase();

    if (type === 'percent' || type === 'amount') {
      var promo = resolvePromo(seg.promo_code_ref);
      var value = promo ? promo.percent : seg.value;
      var unit  = type === 'percent' ? '%' : '$';
      var code  = promo ? promo.code : (seg.promo_code_ref || '');
      return {
        message: '🎉 Congratulations! You just earned ' + value + unit + ' OFF your next order.',
        code: code,
        showCode: !!code
      };
    }

    if (type === 'shipping') {
      return {
        message: '🎉 Congratulations! You\'re now eligible for FREE SHIPPING on your next order!',
        code: null,
        showCode: false
      };
    }

    if (type === 'bxgx') {
      var buyQty = cd.promo_buy_quantity;
      var getQty = cd.promo_get_quantity;
      return {
        message: '🎉 Congratulations! Buy ' + buyQty + ' get ' + getQty + ' FREE — this will apply automatically once you reach that quantity in your cart!',
        code: null,
        showCode: false
      };
    }

    return { message: '🎉 Congratulations on your spin!', code: null, showCode: false };
  }

  /* ────────────────────────────────────────────────────────────
     Confetti burst (reuses the same visual language as fireConfetti
     in the newsletter success step / the birthday gift widget).
  ────────────────────────────────────────────────────────────── */
  function fireResultConfetti() {
    var wrap = document.getElementById('bbwNlConfetti');
    if (!wrap) return;
    wrap.innerHTML = '';
    var colors = ['#c9963e', '#c0385e', '#e8bc6a', '#7b3f6e', '#FFD700', '#fff', '#d4506e'];
    for (var i = 0; i < 42; i++) {
      var piece = document.createElement('div');
      piece.className = 'bbwnl-confetti-piece';
      var sz  = Math.random() * 9 + 5;
      var dur = Math.random() * 1.4 + 0.9;
      var del = Math.random() * 0.6;
      piece.style.cssText =
        'left:' + (Math.random() * 100) + '%;' +
        'width:' + sz + 'px;' +
        'height:' + sz + 'px;' +
        'background:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
        'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
        'animation-duration:' + dur + 's;' +
        'animation-delay:' + del + 's;';
      wrap.appendChild(piece);
    }
    setTimeout(function () { if (wrap) wrap.innerHTML = ''; }, 2200);
  }

  /* ────────────────────────────────────────────────────────────
     Show the result step with the winning segment's content.
  ────────────────────────────────────────────────────────────── */
  function showResult(seg) {
    var spinStepEl   = document.getElementById('bbwNlSpinStep');
    var resultStepEl = document.getElementById('bbwNlResultStep');
    var titleEl      = document.getElementById('nlResultTitle');
    var msgEl        = document.getElementById('nlResultMsg');
    var codeWrapEl   = document.getElementById('nlSpinCodeWrap');
    var codeValEl    = document.getElementById('nlSpinCodeVal');
    var copyBtn      = document.getElementById('nlSpinCodeCopy');
    var copyTextEl   = document.getElementById('nlSpinCodeCopyText');

    var content = buildResultContent(seg);

    if (titleEl) titleEl.textContent = 'Congratulations!';
    if (msgEl)   msgEl.textContent   = content.message;

    if (codeWrapEl) codeWrapEl.style.display = content.showCode ? 'flex' : 'none';
    if (content.showCode && codeValEl) codeValEl.textContent = content.code;

    if (copyBtn && content.showCode) {
      copyBtn.onclick = function () {
        navigator.clipboard.writeText(content.code).then(function () {
          if (copyTextEl) copyTextEl.textContent = 'Copied!';
          setTimeout(function () { if (copyTextEl) copyTextEl.textContent = 'Copy Code'; }, 2000);
        });
      };
    }

    if (seg.type === 'bxgx') {
      var cart = window.cart;
      if (Array.isArray(cart) && cart.length > 0 && typeof applyPromoFreeItems === 'function') {
        applyPromoFreeItems();
        if (typeof window.renderCart === 'function') window.renderCart();
      }
    }

    if (spinStepEl)   spinStepEl.style.display   = 'none';
    if (resultStepEl) resultStepEl.style.display = 'block';
    fireResultConfetti();
  }

  /* ────────────────────────────────────────────────────────────
     Already-spun state (one_spin_per_email): skip straight to the
     plain thank-you, since the wheel result itself isn't persisted.
  ────────────────────────────────────────────────────────────── */
  function hasAlreadySpun(email) {
    if (!isOnePerEmail()) return false;
    try { return localStorage.getItem(spinStorageKey(email)) === 'yes'; } catch (e) { return false; }
  }

  function markSpun(email) {
    if (!isOnePerEmail()) return;
    try { localStorage.setItem(spinStorageKey(email), 'yes'); } catch (e) {}
  }

  /* ────────────────────────────────────────────────────────────
     Entry point — called by the footer.js submit handler on
     subscribe success, instead of the plain thank-you.
  ────────────────────────────────────────────────────────────── */
  function start(email, firstName) {
    var cfg = getWheelConfig();
    var segments = Array.isArray(cfg.segments) ? cfg.segments : [];

    var thankYouEl   = document.getElementById('bbwNlThankYou');
    var spinStepEl    = document.getElementById('bbwNlSpinStep');
    var resultStepEl  = document.getElementById('bbwNlResultStep');
    var introEl       = document.getElementById('bbwNlSpinIntro');
    var spinBtn        = document.getElementById('nlSpinBtn');
    var wheelEl        = document.getElementById('nlSpinWheel');

    if (!segments.length || hasAlreadySpun(email)) {
      if (thankYouEl)  thankYouEl.style.display  = 'block';
      if (spinStepEl)  spinStepEl.style.display  = 'none';
      if (resultStepEl) resultStepEl.style.display = 'none';
      fireResultConfetti();
      setTimeout(function () { if (typeof window.closeNewsletterPopup === 'function') window.closeNewsletterPopup(); }, 5000);
      return;
    }

    if (thankYouEl)   thankYouEl.style.display   = 'none';
    if (resultStepEl) resultStepEl.style.display = 'none';
    if (spinStepEl)    spinStepEl.style.display    = 'block';
    if (introEl)        introEl.textContent = firstName ? ('Ready to spin, ' + firstName + '?') : 'Ready to spin?';

    buildWheelSvg(segments);

    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.onclick = function () {
        if (spinBtn.disabled) return;
        spinBtn.disabled = true;

        var winner = pickWeightedSegment(segments);
        var winnerIndex = segments.indexOf(winner);
        var sliceAngle = 360 / segments.length;
        var targetSliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
        // Land the pointer (fixed at top, 0deg) on the winning slice: rotate
        // so that slice's center ends up at 0deg, plus several full spins.
        var fullSpins = 6;
        var finalRotation = (fullSpins * 360) + (360 - targetSliceCenter);

        if (wheelEl) {
          wheelEl.style.transition = 'transform 4.6s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
          wheelEl.style.transform  = 'rotate(' + finalRotation + 'deg)';
        }

        setTimeout(function () {
          markSpun(email);
          showResult(winner);
        }, 4700);
      };
    }
  }

  return {
    isEnabled: isEnabled,
    start: start
  };
})();







/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — MISSION POPUP 
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var BBWM_OVERLAY_ID = 'bbwMissionOverlay';
  var BBWM_CLOSE_ID   = 'bbwmCloseBtn';

  
  var BBWM_TRIGGERS = ['our-mission', 'our mission', 'notre mission'];

  
  function bbwmOpen() {
    var overlay = document.getElementById(BBWM_OVERLAY_ID);
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('bbwm-active');
    document.body.style.overflow = 'hidden';
  }

  
  function bbwmClose() {
    var overlay = document.getElementById(BBWM_OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove('bbwm-active');
    overlay.setAttribute('aria-hidden', 'true');
    
    var otherOpen = document.querySelector(
      '#bbw-quiz-overlay.bbq-active, #bbwStyleOverlay.bbws-active, ' +
      '#bbwLookOverlay.bbwl-active, #bdOverlay.bd-active, ' +
      '#bbwCommitmentOverlay.bbwc-active'
    );
    if (!otherOpen) {
      document.body.style.overflow = '';
    }
  }

  
  function bbwmMatches(el) {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute('data-open-mission') !== null) return true;
    var txt = (el.textContent || '').trim().toLowerCase();
    return BBWM_TRIGGERS.indexOf(txt) !== -1;
  }

  
  function bbwmBindTriggers() {
    document.querySelectorAll('a, button, li').forEach(function (el) {
      if (el._bbwmBound) return;
      if (bbwmMatches(el)) {
        el._bbwmBound = true;
        el.addEventListener('click', function (e) {
          e.preventDefault();
          bbwmOpen();
        });
      }
    });
  }

  
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el) return;
    
    var anchor = el.closest ? el.closest('a, button, li') : el;
    if (anchor && bbwmMatches(anchor)) {
      e.preventDefault();
      bbwmOpen();
    }
  });

  
  function bbwmInit() {
    var overlay  = document.getElementById(BBWM_OVERLAY_ID);
    var closeBtn = document.getElementById(BBWM_CLOSE_ID);

    if (!overlay) return;

    
    if (closeBtn) {
      closeBtn.addEventListener('click', bbwmClose);
    }

    
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) bbwmClose();
    });

    
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('bbwm-active')) {
        bbwmClose();
      }
    });

    
    bbwmBindTriggers();
    setTimeout(bbwmBindTriggers, 800);
    setTimeout(bbwmBindTriggers, 2000);
    setTimeout(bbwmBindTriggers, 4000);
  }

  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bbwmInit);
  } else {
    bbwmInit();
  }


  window.openMissionPopup  = bbwmOpen;
  window.closeMissionPopup = bbwmClose;

})();


/* ══════════════════════════════════════════════════════════════
   PROMO BANNER — Affiliate + Free Shipping — valeurs dynamiques
   (.bbw-promo-grid, .bbw-promo-jackpot-badge dans .bbw-finale)
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function waitForProductsPromo(cb) {
    if (window.__allProducts && window.__allProducts.length) { cb(); return; }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll); cb();
      } else if (++tries > 100) {
        clearInterval(poll);
      }
    }, 100);
  }

  function injectPromoBannerValues() {
    var all = window.__allProducts || [];
    var settings = all.find(function (p) { return p.type === 'settings'; }) || {};
    var aff = settings.affiliation || {};
    var cartDrawer = settings.cart_drawer || {};

    var commission = aff.commission_percent != null ? aff.commission_percent : 10;
    var jackpot    = aff.jackpot_reward_amount != null ? aff.jackpot_reward_amount : 150;
    var threshold  = aff.jackpot_orders_threshold != null ? aff.jackpot_orders_threshold : 30;
    var freeShip   = cartDrawer.free_shipping_threshold != null ? cartDrawer.free_shipping_threshold : 350;

    document.querySelectorAll('[data-aff-commission]').forEach(function (el) { el.textContent = commission; });
    document.querySelectorAll('[data-aff-jackpot]').forEach(function (el) { el.textContent = jackpot; });
    document.querySelectorAll('[data-aff-jackpot-badge]').forEach(function (el) { el.textContent = jackpot; });
    document.querySelectorAll('[data-aff-threshold]').forEach(function (el) { el.textContent = threshold; });
    document.querySelectorAll('[data-shipping-threshold]').forEach(function (el) { el.textContent = freeShip; });
  }

  waitForProductsPromo(injectPromoBannerValues);

  // Le footer est injecté après coup sur certaines pages (fetch de
  // footer.html) — si les produits étaient déjà chargés avant que ce
  // fichier ne s'exécute, on retente une fois après l'événement dédié.
  document.addEventListener('footer:loaded', function () {
    waitForProductsPromo(injectPromoBannerValues);
  });
})();


