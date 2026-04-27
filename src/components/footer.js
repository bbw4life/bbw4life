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
    logo_svg: `<?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 122.88 101.01" style="enable-background:new 0 0 122.88 101.01" xml:space="preserve"><style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style><g><path class="st0" d="M61.44,0l5.88,4.77l7.48-1.2l2.69,7.08l7.08,2.69l-1.2,7.48l4.77,5.88l-4.77,5.88l1.2,7.48l-7.08,2.69 l-2.69,7.08l-7.48-1.2l-5.88,4.77l-5.88-4.77l-7.48,1.2l-2.69-7.08l-7.08-2.69l1.2-7.48l-4.77-5.88l4.77-5.88l-1.2-7.48l7.08-2.69 l2.69-7.08l7.48,1.2L61.44,0L61.44,0z M66.41,84.78h21.91c1.76-1.75,3.69-3.57,5.64-5.42c4.11-3.89,8.4-7.95,12.81-13.03 c5.04-5.81,5.58-7.82,7.11-13.51c0.29-1.07,0.61-2.27,1.03-3.76l2.62-9.21l0.03-0.1c1.4-4.1,1.51-6.81,0.93-8.37 c-0.18-0.48-0.41-0.8-0.68-0.97c-0.21-0.14-0.49-0.19-0.78-0.16c-0.68,0.07-1.45,0.5-2.15,1.27l-7.78,18.53 c-0.07,0.17-0.17,0.33-0.28,0.47c-0.46,0.83-1.08,1.64-1.88,2.41l-13.8,15.39c-0.75,0.84-2.04,0.91-2.87,0.16 c-0.84-0.75-0.91-2.04-0.16-2.87c1.87-2.08,16.37-16.31,15.63-19.5c-0.92-3.93-10.8,6.16-11.98,7.2l-0.03,0.03 c-5.79,5.48-8.28,6.78-12.82,9.15c-0.95,0.5-1.99,1.04-3.28,1.74c-0.51,0.28-1.01,0.62-1.5,0.99c-0.52,0.4-1.02,0.81-1.49,1.21 c-2.4,2.02-3.66,3.66-4.38,5.47c-0.75,1.88-1.02,4.17-1.39,7.31c-0.15,1.26-0.26,2.52-0.35,3.77 C66.47,83.59,66.44,84.19,66.41,84.78L66.41,84.78L66.41,84.78z M56.47,84.78H34.55c-1.76-1.75-3.69-3.57-5.65-5.42 c-4.11-3.89-8.4-7.95-12.81-13.03c-5.04-5.81-5.58-7.82-7.11-13.51c-0.29-1.07-0.61-2.27-1.03-3.76l-2.62-9.21l-0.03-0.1 c-1.4-4.1-1.51-6.81-0.93-8.37c0.18-0.48,0.41-0.8,0.68-0.97c0.21-0.14,0.49-0.19,0.78-0.16c0.68,0.07,1.45,0.5,2.15,1.27 l7.78,18.53c0.07,0.17,0.17,0.33,0.28,0.47c0.46,0.83,1.08,1.64,1.88,2.41l13.8,15.39c0.75,0.84,2.04,0.91,2.87,0.16 c0.84-0.75,0.91-2.04,0.16-2.87C32.9,63.52,18.4,49.29,19.14,46.1c0.92-3.93,10.8,6.16,11.98,7.2l0.03,0.03 c5.79,5.48,8.28,6.78,12.82,9.15c0.95,0.5,1.99,1.04,3.28,1.74c0.51,0.28,1.01,0.62,1.5,0.99c0.52,0.4,1.02,0.81,1.49,1.21 c2.4,2.02,3.66,3.66,4.38,5.47c0.75,1.88,1.02,4.17,1.39,7.31c0.15,1.26,0.26,2.52,0.35,3.77C56.41,83.59,56.44,84.19,56.47,84.78 L56.47,84.78L56.47,84.78z M29.45,85.48c-0.31,0.36-0.5,0.83-0.5,1.34v12.14c0,1.13,0.92,2.04,2.04,2.04h27.58 c1.13,0,2.04-0.92,2.04-2.04V86.71c0-1.3-0.08-2.7-0.17-4c-0.09-1.33-0.21-2.65-0.36-3.96c-0.4-3.43-0.7-5.94-1.66-8.35 c-0.99-2.47-2.58-4.6-5.53-7.09c-0.54-0.46-1.09-0.92-1.67-1.35c-0.61-0.46-1.27-0.9-2.01-1.31c-1.2-0.65-2.32-1.24-3.34-1.78 c-4.2-2.2-6.5-3.4-11.91-8.52c-0.04-0.04-0.09-0.08-0.13-0.11l-5.22-4.61c-2.64-3.09-7.87-6.77-11.68-3.43 c-2.03-4.83-4.03-15.36-10.67-16.01c-1.21-0.12-2.38,0.14-3.4,0.8c-0.97,0.63-1.77,1.61-2.27,2.96c-0.88,2.35-0.86,6,0.86,11.05 l2.6,9.15c0.38,1.32,0.71,2.59,1.02,3.71c1.7,6.35,2.3,8.6,7.97,15.12c4.49,5.17,8.89,9.33,13.1,13.32 C27.23,83.36,28.33,84.41,29.45,85.48L29.45,85.48L29.45,85.48z M33.35,88.86c0.27,0.06,0.55,0.06,0.83,0h22.34v8.06H33.03v-8.06 H33.35L33.35,88.86z M93.43,85.48c0.31,0.36,0.5,0.83,0.5,1.34v12.14c0,1.13-0.91,2.04-2.04,2.04H64.32 c-1.13,0-2.04-0.92-2.04-2.04V86.71c0-0.07,0-0.15,0.01-0.22c0.03-1.31,0.08-2.58,0.16-3.78c0.09-1.33,0.21-2.65,0.36-3.96 c0.4-3.43,0.7-5.94,1.66-8.35c0.99-2.47,2.58-4.6,5.53-7.09c0.54-0.46,1.09-0.92,1.67-1.35c0.61-0.46,1.27-0.9,2.01-1.31 c1.2-0.65,2.32-1.24,3.34-1.78c4.2-2.2,6.5-3.4,11.91-8.52c0.04-0.04,0.09-0.08,0.13-0.11l5.22-4.61 c2.64-3.09,7.87-6.77,11.68-3.43c0.99-2.37,4.41-11.65,5.59-13.07c1.46-1.75,3.31-2.77,5.08-2.95c1.21-0.12,2.38,0.14,3.4,0.8 c0.97,0.63,1.77,1.61,2.27,2.96c0.88,2.35,0.86,6-0.86,11.05l-2.6,9.15c-0.38,1.32-0.71,2.59-1.02,3.71 c-1.7,6.35-2.3,8.6-7.97,15.12c-4.49,5.17-8.88,9.33-13.1,13.32C95.65,83.36,94.55,84.41,93.43,85.48L93.43,85.48L93.43,85.48z M89.53,88.86c-0.27,0.06-0.55,0.06-0.83,0H66.36v8.06h23.49v-8.06H89.53L89.53,88.86z M61.44,17.18l2.75,6.72l7.25,0.54 l-5.54,4.69l1.73,7.06l-6.18-3.83l-6.18,3.83L57,29.14l-5.56-4.69l7.25-0.54l2.75-6.72H61.44L61.44,17.18z M61.44,11.61 c8.33,0,15.08,6.76,15.08,15.08c0,8.33-6.76,15.08-15.08,15.08c-8.33,0-15.08-6.76-15.08-15.08 C46.36,18.37,53.11,11.61,61.44,11.61L61.44,11.61z"/></g></svg>`,
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