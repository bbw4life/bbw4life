/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — GEO-DETECT.JS  v2.1
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var STORAGE_LANG    = 'bbw_lang';
  var STORAGE_COUNTRY = 'bbw_country';
  var MAX_WAIT        = 6000;

  /* ══════════════════════════════════════════════════════════════
     0. CSS — masque TOUT ce que Google Translate peut afficher
        y compris le logo spinner injecté dynamiquement
  ══════════════════════════════════════════════════════════════ */
  (function injectHideStyle() {
    var css = [
      
      '.goog-te-banner-frame,',
      'iframe.goog-te-banner-frame,',
      '.skiptranslate > iframe,',
      '#\\:1\\.container,',

      
      '.goog-te-balloon-frame,',
      '#goog-gt-tt,',
      '.goog-tooltip,',
      '.goog-tooltip:hover,',

      
      '.goog-te-gadget,',
      '.goog-te-gadget-icon,',
      '.goog-te-gadget-simple,',
      '.goog-logo-link,',
      '.goog-te-ftab-float,',
      '.goog-te-menu-value:hover,',
      '.goog-te-menu-frame,',

      
      '.goog-te-spinner,',
      '.goog-te-spinner-pos,',
      '#goog-gt-,',

      
      '.VIpgJd-ZVi9od-aZ2wEe,',
      '.VIpgJd-ZVi9od-aZ2wEe-wib3jc,',
      '.VIpgJd-ZVi9od-aZ2wEe-OiiCO,',
      '.VIpgJd-ZVi9od-ORHb,',
      '.VIpgJd-ZVi9od-SmfZ,',
      '.VIpgJd-yAWNEb-L7lbkb,',
      '[class^="VIpgJd"],',
      '[class*=" VIpgJd"],',

      
      '[id^="goog-gt"],',

      
      '#google_translate_element,',
      '#google_translate_element2,',
      '.skiptranslate:not(font) {',
      '  display:         none !important;',
      '  visibility:      hidden !important;',
      '  height:          0 !important;',
      '  width:           0 !important;',
      '  max-height:      0 !important;',
      '  max-width:       0 !important;',
      '  overflow:        hidden !important;',
      '  pointer-events:  none !important;',
      '  opacity:         0 !important;',
      '  position:        absolute !important;',
      '  top:             -9999px !important;',
      '  left:            -9999px !important;',
      '}',

      
      
      'body.translated-ltr,',
      'body { font-size: initial !important; }',
      'font { vertical-align: inherit !important; display: inline !important; }'
    ].join('\n');

    var style = document.createElement('style');
    style.id  = 'bbw-hide-google-translate';
    style.textContent = css;
    
    (document.head || document.documentElement).appendChild(style);
  })();

  /* MutationObserver — force le masquage sur les éléments injectés APRÈS le load
     (le spinner apparaît souvent 1-2 s après l'init de Google Translate)        */
  (function watchGoogleInjects() {
    var SELECTORS_TO_HIDE = [
      '.goog-te-banner-frame',
      '.goog-te-gadget',
      '.goog-te-gadget-simple',
      '.goog-logo-link',
      '.goog-te-menu-frame',
      '.goog-te-spinner',
      '.goog-te-spinner-pos',
      '.VIpgJd-ZVi9od-aZ2wEe',
      '.VIpgJd-ZVi9od-aZ2wEe-OiiCO',
      '.VIpgJd-ZVi9od-ORHb',
      '.VIpgJd-ZVi9od-SmfZ',
      '.VIpgJd-yAWNEb-L7lbkb',
      '[class^="VIpgJd"]',
      '[class*=" VIpgJd"]',
      '[id^="goog-gt"]',
      '#goog-gt-',
      '#google_translate_element',
      '#google_translate_element2'
    ];

    function forceHide(el) {
      el.style.cssText += [
        'display:none!important',
        'visibility:hidden!important',
        'height:0!important',
        'width:0!important',
        'overflow:hidden!important',
        'opacity:0!important',
        'pointer-events:none!important',
        'position:absolute!important',
        'top:-9999px!important',
        'left:-9999px!important'
      ].join(';') + ';';
    }

    function scanAndHide() {
      SELECTORS_TO_HIDE.forEach(function (sel) {
        try {
          document.querySelectorAll(sel).forEach(forceHide);
        } catch (e) {  }
      });
      
      document.querySelectorAll('iframe').forEach(function (f) {
        var src = f.src || '';
        if (src.indexOf('translate.google') !== -1 || src.indexOf('translate.googleapis') !== -1) {
          forceHide(f);
        }
      });
      
      if (document.body) document.body.style.top = '0';
    }

    
    if (window.MutationObserver) {
      var observer = new MutationObserver(function (mutations) {
        var needed = false;
        mutations.forEach(function (m) {
          if (m.addedNodes.length) needed = true;
        });
        if (needed) scanAndHide();
      });
      var target = document.body || document.documentElement;
      observer.observe(target, { childList: true, subtree: true });
      
      setTimeout(function () { observer.disconnect(); }, 30000);
    }

    
    scanAndHide();
    setTimeout(scanAndHide, 500);
    setTimeout(scanAndHide, 1000);
    setTimeout(scanAndHide, 3000);
    setTimeout(scanAndHide, 5000);
    setTimeout(scanAndHide, 8000);
  })();

  /* ══════════════════════════════════════════════════════════════
     1. COOKIES
  ══════════════════════════════════════════════════════════════ */
  function setCookie(name, value, days, domain) {
    var expires = '';
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + days * 86400000);
      expires = '; expires=' + d.toUTCString();
    }
    var dom = domain ? '; domain=' + domain : '';
    document.cookie = name + '=' + (value || '') + expires + '; path=/' + dom + '; SameSite=Lax';
  }

  function eraseCookie(name) {
    setCookie(name, '', -1);
    setCookie(name, '', -1, location.hostname);
    setCookie(name, '', -1, '.' + location.hostname);
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ══════════════════════════════════════════════════════════════
     2. PERSISTANCE langue + pays  (localStorage + cookie)
  ══════════════════════════════════════════════════════════════ */
  function saveLang(code) {
    try { localStorage.setItem(STORAGE_LANG, code); } catch (e) {}
    
    if (code && code !== 'en') {
      setCookie('googtrans', '/en/' + code, 365);
      setCookie('googtrans', '/en/' + code, 365, '.' + location.hostname);
    } else {
      eraseCookie('googtrans');
    }
  }

  function loadSavedLang() {
    try {
      var ls = localStorage.getItem(STORAGE_LANG);
      if (ls) return ls;
    } catch (e) {}
    
    var c = getCookie('googtrans');
    if (c) { var parts = c.split('/'); return parts[parts.length - 1] || 'en'; }
    return null;
  }

  function saveCountry(code) {
    try { localStorage.setItem(STORAGE_COUNTRY, code); } catch (e) {}
    try { sessionStorage.setItem('bbw_geo_country', code); } catch (e) {}
  }

  function loadSavedCountry() {
    try {
      var ls = localStorage.getItem(STORAGE_COUNTRY);
      if (ls) return ls;
    } catch (e) {}
    try { return sessionStorage.getItem('bbw_geo_country'); } catch (e) {}
    return null;
  }

  /* ══════════════════════════════════════════════════════════════
     3. GOOGLE TRANSLATE — injection + appel via combo select
  ══════════════════════════════════════════════════════════════ */
  function injectGoogleTranslate() {
    if (document.getElementById('google_translate_element')) return;

    
    var hiddenDiv = document.createElement('div');
    hiddenDiv.id = 'google_translate_element';
    document.body.appendChild(hiddenDiv);

    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          autoDisplay: false,
          layout: google.translate.TranslateElement.InlineLayout.NONE
        },
        'google_translate_element'
      );
    };

    var s = document.createElement('script');
    s.src   = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════
     4. TRADUIRE — cœur de la logique
  ══════════════════════════════════════════════════════════════ */
  function translateTo(langCode) {
    if (!langCode) return;
    langCode = langCode.toLowerCase().trim();

    
    saveLang(langCode);

    if (langCode === 'en') {
      
      eraseCookie('googtrans');
      try { localStorage.removeItem(STORAGE_LANG); } catch (e) {}
      location.reload();
      return;
    }

    
    var tries    = 0;
    var maxTries = 40;
    var interval = setInterval(function () {
      tries++;
      var combo = document.querySelector('.goog-te-combo');
      if (combo) {
        combo.value = langCode;
        combo.dispatchEvent(new Event('change'));
        clearInterval(interval);
      } else if (tries >= maxTries) {
        clearInterval(interval);
        location.reload();
      }
    }, 100);
  }

  
  window.translateTo = translateTo;

  /* ══════════════════════════════════════════════════════════════
     5. SYNCHRONISER TOUS LES SÉLECTEURS
        Appelé chaque fois que la langue ou le pays change
  ══════════════════════════════════════════════════════════════ */
  function syncAllSelectors(langCode, countryCode) {
    var allProducts    = window.__allProducts || [];
    var settings       = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
    var langCfg        = settings.language_selector || {};
    var countryCfg     = settings.country_selector  || {};
    var langOptions    = langCfg.options    || [];
    var countryOptions = countryCfg.options || [];

    var foundLang    = langOptions.find(function (o) { return o.code === langCode; })
                       || langOptions.find(function (o) { return o.code === 'en'; });
    var foundCountry = countryCode
                       ? (countryOptions.find(function (o) { return o.code === countryCode; })
                          || countryOptions.find(function (o) { return o.code === 'us'; }))
                       : null;

    
    if (foundLang) {
      var hFlag  = document.getElementById('bbwHdrLangFlag');
      var hLabel = document.getElementById('bbwHdrLangLabel');
      if (hFlag)  hFlag.textContent  = foundLang.flag  || '';
      if (hLabel) hLabel.textContent = foundLang.label || foundLang.name || '';

      document.querySelectorAll('#bbwHdrLangDropdown .bbw-hdr-lang__option').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.lang === langCode);
      });
    }

    
    if (foundLang) {
      var dLangFlag  = document.getElementById('bbwDrawerLangFlag');
      var dLangLabel = document.getElementById('bbwDrawerLangLabel');
      if (dLangFlag)  dLangFlag.textContent  = foundLang.flag || '';
      if (dLangLabel) dLangLabel.textContent = foundLang.name || '';

      document.querySelectorAll('#bbwDrawerLangList .bbw-drawer__select-opt').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.lang === langCode);
      });
    }

    
    if (foundCountry) {
      var dCFlag  = document.getElementById('bbwDrawerCountryFlag');
      var dCLabel = document.getElementById('bbwDrawerCountryLabel');
      if (dCFlag)  dCFlag.textContent  = foundCountry.flag  || '';
      if (dCLabel) dCLabel.textContent = foundCountry.label || foundCountry.name || '';

      document.querySelectorAll('#bbwDrawerCountryList .bbw-drawer__select-opt').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.country === countryCode);
      });
    }

    
    if (foundLang) {
      var fLangFlag  = document.getElementById('bbwLangFlag2');
      var fLangLabel = document.getElementById('bbwLangLabel2');
      if (fLangFlag)  fLangFlag.textContent  = foundLang.flag || '';
      if (fLangLabel) fLangLabel.textContent = foundLang.name || '';

      var fLangList = document.getElementById('bbwLangList');
      if (fLangList) {
        fLangList.querySelectorAll('li').forEach(function (li) {
          li.classList.toggle('active', li.dataset.value === langCode);
        });
      }

      var fLangSel = document.getElementById('bbwFooterLangSelect');
      if (fLangSel) fLangSel.value = langCode;
    }

    
    if (foundCountry) {
      var fCFlag  = document.getElementById('bbwCountryFlag');
      var fCLabel = document.getElementById('bbwCountryLabel');
      if (fCFlag)  fCFlag.textContent  = foundCountry.flag || '';
      if (fCLabel) {
        var cur = foundCountry.currency ? ' | ' + foundCountry.currency : '';
        fCLabel.textContent = (foundCountry.name || '') + cur;
      }

      var fCList = document.getElementById('bbwCountryList');
      if (fCList) {
        fCList.querySelectorAll('li').forEach(function (li) {
          li.classList.toggle('active', li.dataset.value === countryCode);
        });
      }

      var fCSel = document.getElementById('bbwFooterCountrySelect');
      if (fCSel) fCSel.value = countryCode;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     6. APPLIQUER UN PAYS (depuis géo ou sélection manuelle)
  ══════════════════════════════════════════════════════════════ */
  function applyCountry(countryCode, forceLangTranslate) {
    countryCode = (countryCode || 'us').toLowerCase();

    var allProducts    = window.__allProducts || [];
    var settings       = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
    var countryCfg     = settings.country_selector  || {};
    var countryOptions = countryCfg.options || [];

    var found = countryOptions.find(function (o) { return o.code === countryCode; })
                || countryOptions.find(function (o) { return o.code === 'us'; });
    if (!found) return;

    saveCountry(found.code);

    var targetLang = found.lang || 'en';
    var savedLang  = loadSavedLang();
    var langToUse  = savedLang || targetLang;

    
    _observerStarted = false;
    _activeCountry   = null;

    syncAllSelectors(langToUse, found.code);

    
    document.querySelectorAll(PRICE_SELECTORS).forEach(function(el) {
      if (el.dataset.usd) {
        el.textContent = '$' + parseFloat(el.dataset.usd).toFixed(2);
      }
      delete el.dataset.converted;
    });

    
    document.querySelectorAll('[data-raw-text]').forEach(function(el) {
      var nodes = el.childNodes;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === Node.TEXT_NODE) {
          nodes[i].nodeValue = el.dataset.rawText;
          break;
        }
      }
      delete el.dataset.rawText;
      delete el.dataset.rawCountry;
    });

    
    setTimeout(function() {
      convertPricesForCountry(found.code);
    }, 80);

    var currentCookie = getCookie('googtrans');
    var currentLang   = currentCookie ? currentCookie.split('/').pop() : 'en';
    if (currentLang !== langToUse) {
      translateTo(langToUse);
    }
  }

  window.applyGeoCountry = applyCountry;

  /* ══════════════════════════════════════════════════════════════
     6b. CONVERSION MONNAIE — Fallback circulaire 3 APIs
  ══════════════════════════════════════════════════════════════ */
  var _ratesCache      = {};
  var _ratesFetched    = false;
  var _ratesPending    = [];
  var _activeCountry   = null;
  var _observerStarted = false;

  var RATES_KEY     = 'bbw_fx_rates';
  var RATES_EXP_KEY = 'bbw_fx_expires';
  var RATES_TTL     = 24 * 60 * 60 * 1000;

  
  var RATE_APIS = [
    function() { return fetch('https://open.er-api.com/v6/latest/USD')
      .then(function(r){ return r.json(); })
      .then(function(d){ if (!d || !d.rates) throw new Error('no rates'); return d.rates; }); },

    function() { return fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(function(r){ return r.json(); })
      .then(function(d){ if (!d || !d.rates) throw new Error('no rates'); return d.rates; }); },

    function() { return fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (!d || !d.usd) throw new Error('no rates');
        
        var normalized = {};
        Object.keys(d.usd).forEach(function(k){ normalized[k.toUpperCase()] = d.usd[k]; });
        return normalized;
      }); }
  ];

  var _apiIndex = 0;

  function fetchRates(callback) {
    if (_ratesFetched) { callback(_ratesCache); return; }

    
    try {
      var exp   = parseInt(localStorage.getItem(RATES_EXP_KEY) || '0');
      var saved = localStorage.getItem(RATES_KEY);
      if (saved && Date.now() < exp) {
        _ratesCache   = JSON.parse(saved);
        _ratesFetched = true;
        callback(_ratesCache);
        return;
      }
    } catch(e) {}

    _ratesPending.push(callback);
    if (_ratesPending.length > 1) return; 

    function tryAPI(idx, attempts) {
      if (attempts >= RATE_APIS.length) {
        
        _ratesPending.forEach(function(cb){ cb({}); });
        _ratesPending = [];
        return;
      }
      var api = RATE_APIS[idx % RATE_APIS.length];
      api()
        .then(function(rates) {
          _ratesCache   = rates;
          _ratesFetched = true;
          try {
            localStorage.setItem(RATES_KEY,     JSON.stringify(rates));
            localStorage.setItem(RATES_EXP_KEY, String(Date.now() + RATES_TTL));
          } catch(e) {}
          _ratesPending.forEach(function(cb){ cb(rates); });
          _ratesPending = [];
        })
        .catch(function() {
          
          setTimeout(function(){ tryAPI(idx + 1, attempts + 1); }, 300);
        });
    }

    tryAPI(_apiIndex, 0);
  }

  
  function extractUSD(el) {
    if (el.dataset.usd) return parseFloat(el.dataset.usd);
    var text  = el.textContent || '';
    var match = text.match(/\$\s*([\d,]+\.?\d*)/);
    if (!match) return null;
    return parseFloat(match[1].replace(/,/g, ''));
  }

  
  function formatPrice(usd, rate, symbol) {
    var converted = (usd * rate);
    
    var formatted;
    if (converted < 10)        formatted = converted.toFixed(2);
    else if (converted < 100)  formatted = converted.toFixed(2);
    else if (converted < 1000) formatted = converted.toFixed(0);
    else                       formatted = Math.round(converted).toLocaleString();
    return symbol + ' ' + formatted;
  }

  
  function convertElement(el, rate, symbol, currencyCode) {
    if (currencyCode === 'USD') {
      
      if (el.dataset.usd) {
        el.textContent = '$' + parseFloat(el.dataset.usd).toFixed(2);
      }
      return;
    }
    var usd = extractUSD(el);
    if (usd === null || isNaN(usd) || usd <= 0) return;
    
    if (!el.dataset.usd) el.dataset.usd = String(usd);
    el.textContent = formatPrice(usd, rate, symbol);
  }

  var PRICE_SELECTORS = [
    '.current-price', '.compare-price',
    '.col-card__price', '.col-card__compare',
    '.cs-price', '.cs-compare-price',
    '.bbwpg-card__price', '.bbwpg-card__compare',
    '.rv-card__price', '.rv-card__compare',
    '.fs-price', '.fs-compare',
    '.p2-upsell-new', '.p2-upsell-old',
    '.col-qv-price', '.col-qv-compare',
    '.bd-original s',
    '.bd-save strong',
    '.bd-total-price',
    '.bd-product-price',
    '.cp-extra-card__price', '.cp-extra-card__compare',
    '.drawer-extra-card__price', '.drawer-extra-card__compare',
    '.cp-item-price-col', '.cp-item-line-total',
    '#cp-subtotal-val', '#cp-tax-val', '#cp-total-val',
    '#cp-savings-val', '#cp-upsell-total-display',
    '#cp-sticky-total',
    '.subtotal',
    '.cart-item .item-meta p',
    '#satc-price',
    '#single-price', '#duo-price', '#trio-price',
    '#single-original-price', '#duo-original-price', '#trio-original-price',
    '.bundle-price span',
    '.product-item .current-price', '.product-item .compare-price',
    '.bbwpg-card__price', '.bbwpg-card__compare',
    '.cs-price', '.cs-compare-price',
    '.fs-price', '.fs-compare',
    '.prog-price',
    '.paul-reservation-price-label',
    '#satc-price',
    '.product-price .current-price',
    '.product-price .compare-price',
    '.price-wrapper .current-price',
    '.price-wrapper .compare-price'
  ].join(', ');

  /* Sélecteurs "nombre nu" : le span ne contient que le chiffre — le
     symbole $ (s'il existe) est un caractère HTML statique juste avant,
     en dehors du span (ex: "Over $<span class="marquee-free-shipping">
     140</span>"). extractUSD/convertElement exigent un "$" DANS le
     textContent, donc ces éléments ne sont jamais convertis par le
     mécanisme normal — traités séparément ci-dessous. */
  var BARE_NUMBER_SELECTORS = [
    '.marquee-free-shipping',
    '.col-marquee-free-shipping',
    '.hdr-free-shipping-threshold',
    '[data-aff-jackpot]',
    '[data-aff-jackpot-badge]',
    '[data-shipping-threshold]'
  ].join(', ');

  function convertBareNumberElement(el, rate, symbol, currencyCode) {
    if (currencyCode === 'USD') {
      if (el.dataset.usdBare && el.textContent !== el.dataset.usdBare) {
        el.textContent = el.dataset.usdBare;
      }
      return;
    }
    var raw = el.dataset.usdBare;
    if (raw === undefined) {
      raw = (el.textContent || '').replace(/[^\d.]/g, '');
      if (!raw) return;
      el.dataset.usdBare = raw;
    }
    var usd = parseFloat(raw);
    if (isNaN(usd) || usd <= 0) return;

    // Neutralise le "$" littéral statique juste avant le span (texte libre
    // dans le même parent) pour éviter un double symbole ("$€ 130") — le
    // span devient la seule source du symbole affiché. Fait une seule
    // fois (marqué par prevDollarRemoved) : ce même appel est redéclenché
    // en boucle par le MutationObserver qui nous a fait démarrer (chaque
    // écriture DOM ci-dessous est elle-même une mutation), donc il ne
    // faut jamais retester /\$\s*$/ après coup — il ne matchera plus une
    // fois le "$" retiré, et on retomberait sur le nombre seul sans symbole.
    if (el.dataset.prevDollarRemoved !== '1') {
      var prev = el.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE && /\$\s*$/.test(prev.nodeValue)) {
        prev.nodeValue = prev.nodeValue.replace(/\$\s*$/, '');
      }
      el.dataset.prevDollarRemoved = '1';
    }

    var converted = usd * rate;
    var formatted = converted < 1000 ? Math.round(converted) : Math.round(converted).toLocaleString();
    var newText = symbol + formatted;
    if (el.textContent !== newText) el.textContent = newText;
  }

  function convertBareNumbersForCountry(rate, symbol, currencyCode) {
    document.querySelectorAll(BARE_NUMBER_SELECTORS).forEach(function(el) {
      convertBareNumberElement(el, rate, symbol, currencyCode);
    });
  }

  function resetBareNumbersToUSD() {
    document.querySelectorAll(BARE_NUMBER_SELECTORS).forEach(function(el) {
      if (el.dataset.usdBare && el.textContent !== el.dataset.usdBare) {
        el.textContent = el.dataset.usdBare;
      }
      if (el.dataset.prevDollarRemoved === '1') {
        var prev = el.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE && !/\$\s*$/.test(prev.nodeValue)) {
          prev.nodeValue = prev.nodeValue + '$';
        }
        delete el.dataset.prevDollarRemoved;
      }
    });
  }

  function convertAllPrices(rate, symbol, currencyCode) {
    
    document.querySelectorAll(PRICE_SELECTORS).forEach(function(el) {
      convertElement(el, rate, symbol, currencyCode);
    });

    
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (/\$\s*[\d,]+\.?\d*/.test(node.nodeValue)) {
        nodes.push(node);
      }
    }

    nodes.forEach(function(textNode) {
      var parent = textNode.parentElement;
      if (!parent) return;

      
      var tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'INPUT' || tag === 'TEXTAREA') return;

      
      if (parent.dataset && parent.dataset.rawCountry === currencyCode) return;

      var original = textNode.nodeValue;
      var converted = original.replace(/\$\s*([\d,]+\.?\d*)/g, function(match, amount) {
        var usd = parseFloat(amount.replace(/,/g, ''));
        if (isNaN(usd) || usd <= 0) return match;

        
        if (!parent.dataset.rawText) {
          parent.dataset.rawText    = original;
          parent.dataset.rawCountry = currencyCode;
        }

        if (currencyCode === 'USD') return match;

        var converted_amount = usd * rate;
        var formatted;
        if (converted_amount < 10)        formatted = converted_amount.toFixed(2);
        else if (converted_amount < 1000) formatted = converted_amount.toFixed(0);
        else                              formatted = Math.round(converted_amount).toLocaleString();

        return symbol + ' ' + formatted;
      });

      if (converted !== original) {
        textNode.nodeValue = converted;
      }
    });
  }

  
  function startPriceObserver(rate, symbol, currencyCode) {
    if (_observerStarted) return;
    _observerStarted = true;

    if (!window.MutationObserver) return;

    var observer = new MutationObserver(function(mutations) {
      var hasNewNodes = false;
      mutations.forEach(function(m) {
        if (m.addedNodes.length) hasNewNodes = true;
      });
      if (!hasNewNodes) return;

      setTimeout(function() {
        
        var country = _activeCountry;
        if (!country) return;

        var allProducts    = window.__allProducts || [];
        var settings       = allProducts.find(function(p){ return p.type === 'settings'; }) || {};
        var countryOptions = (settings.country_selector && settings.country_selector.options) || [];
        var found          = countryOptions.find(function(o){ return o.code === country; });
        if (!found || !found.currency) return;

        var parts = found.currency.trim().split(/\s+/);
        var code  = parts[parts.length - 1].toUpperCase();
        var sym   = parts.slice(0, -1).join(' ') || code;

        if (code === 'USD') return; 

        fetchRates(function(rates) {
          var r = rates[code];
          if (!r) return;
          
          document.querySelectorAll(PRICE_SELECTORS).forEach(function(el) {
            if (!el.dataset.converted || el.dataset.converted !== country) {
              convertElement(el, r, sym, code);
              el.dataset.converted = country;
            }
          });
          convertBareNumbersForCountry(r, sym, code);
        });
      }, 50);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function convertPricesForCountry(countryCode) {
    _activeCountry = countryCode;

    var allProducts    = window.__allProducts || [];
    var settings       = allProducts.find(function(p){ return p.type === 'settings'; }) || {};
    var countryOptions = (settings.country_selector && settings.country_selector.options) || [];

    var found = countryOptions.find(function(o){ return o.code === countryCode; });
    if (!found || !found.currency) return;

    var parts  = found.currency.trim().split(/\s+/);
    var code   = parts[parts.length - 1].toUpperCase();
    var symbol = parts.slice(0, -1).join(' ') || code;

    
    document.querySelectorAll(PRICE_SELECTORS).forEach(function(el) {
      if (el.dataset.usd) {
        el.textContent = '$' + parseFloat(el.dataset.usd).toFixed(2);
      }
      delete el.dataset.converted;
    });

    
    document.querySelectorAll('[data-raw-text]').forEach(function(el) {
      var nodes = el.childNodes;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === Node.TEXT_NODE) {
          nodes[i].nodeValue = el.dataset.rawText;
          break;
        }
      }
      delete el.dataset.rawText;
      delete el.dataset.rawCountry;
    });

    if (code === 'USD') {

      document.querySelectorAll(PRICE_SELECTORS).forEach(function(el) {
        if (el.dataset.usd) {
          el.textContent = '$' + parseFloat(el.dataset.usd).toFixed(2);
          delete el.dataset.usd;
        }
      });
      resetBareNumbersToUSD();
      _observerStarted = false;
      return;
    }

    fetchRates(function(rates) {
      var rate = rates[code];
      if (!rate) {
        console.warn('[BBW FX] Rate not found for', code);
        return;
      }


      convertAllPrices(rate, symbol, code);
      document.querySelectorAll(PRICE_SELECTORS).forEach(function(el) {
        el.dataset.converted = countryCode;
      });
      convertBareNumbersForCountry(rate, symbol, code);


      _observerStarted = false;
      startPriceObserver(rate, symbol, code);
    });


    [500, 1000, 2000, 3000, 5000, 8000, 12000].forEach(function(delay) {
      setTimeout(function() {
        if (_activeCountry !== countryCode) return;
        fetchRates(function(rates) {
          var r = rates[code];
          if (!r) return;
          document.querySelectorAll(PRICE_SELECTORS).forEach(function(el) {
            if (!el.dataset.converted || el.dataset.converted !== countryCode) {
              convertElement(el, r, symbol, code);
              el.dataset.converted = countryCode;
            }
          });
          convertBareNumbersForCountry(r, symbol, code);
        });
      }, delay);
    });
  }

  window.convertPricesForCountry = convertPricesForCountry;

  /* ══════════════════════════════════════════════════════════════
     7. ÉCOUTER les clics/changements sur TOUS les sélecteurs
        → Met à jour les autres en cascade
  ══════════════════════════════════════════════════════════════ */
  function bindAllSelectors() {

    
    document.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-lang]');
      if (!opt) return;
      
      if (opt.dataset.country) return;
      var lang = (opt.dataset.lang || '').toLowerCase().trim();
      if (!lang) return;

      saveLang(lang);
      syncAllSelectors(lang, loadSavedCountry());
      translateTo(lang);
    });

    
    document.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-country]');
      if (!opt) return;
      var country = (opt.dataset.country || '').toLowerCase().trim();
      var lang    = (opt.dataset.lang    || '').toLowerCase().trim();
      if (!country) return;

      saveCountry(country);

      
      _observerStarted = false;
      _activeCountry   = null;

      if (lang) {
        saveLang(lang);
        syncAllSelectors(lang, country);
      } else {
        syncAllSelectors(loadSavedLang() || 'en', country);
      }

      
      applyCountry(country, false);
    });

    
    document.addEventListener('change', function (e) {
      if (e.target.id === 'bbwFooterLangSelect') {
        var lang = e.target.value;
        saveLang(lang);
        syncAllSelectors(lang, loadSavedCountry());
        translateTo(lang);
      }
    });

    
    document.addEventListener('change', function (e) {
      if (e.target.id === 'bbwFooterCountrySelect') {
        var countryCode = e.target.value;
        saveCountry(countryCode);
        applyCountry(countryCode, false);
      }
    });

    
    var fLangList = document.getElementById('bbwLangList');
    if (fLangList) {
      fLangList.addEventListener('click', function (e) {
        var li = e.target.closest('li');
        if (!li) return;
        var lang = li.dataset.value;
        if (!lang) return;
        saveLang(lang);
        syncAllSelectors(lang, loadSavedCountry());
        translateTo(lang);
      });
    }

    
    var fCountryList = document.getElementById('bbwCountryList');
    if (fCountryList) {
      fCountryList.addEventListener('click', function (e) {
        var li = e.target.closest('li');
        if (!li) return;
        var country = li.dataset.value;
        var lang    = li.dataset.lang;
        if (!country) return;
        saveCountry(country);
        if (lang) {
          saveLang(lang);
          syncAllSelectors(lang, country);
        } else {
          syncAllSelectors(loadSavedLang() || 'en', country);
        }
        applyCountry(country, false);
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     8. GÉOLOCALISATION — Multi-fallback (ipapi → ip-api → 'us')
  ══════════════════════════════════════════════════════════════ */
  function detectGeo() {
    
    var savedCountry = loadSavedCountry();
    if (savedCountry) {
      applyCountry(savedCountry, false);
      return;
    }

    function apply(code) {
      saveCountry(code);
      applyCountry(code, true);
    }

    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var c = d && d.country_code ? d.country_code.toLowerCase() : null;
        if (c) apply(c); else throw new Error('no code');
      })
      .catch(function () {
        fetch('https://ip-api.com/json/')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var c = d && d.countryCode ? d.countryCode.toLowerCase() : null;
            if (c) apply(c); else throw new Error('no code');
          })
          .catch(function () { apply('us'); });
      });
  }

  /* ══════════════════════════════════════════════════════════════
     9. RESTAURER la langue sauvegardée au chargement
  ══════════════════════════════════════════════════════════════ */
  function restoreSavedState() {
    var savedLang    = loadSavedLang();
    var savedCountry = loadSavedCountry();

    if (savedLang || savedCountry) {
      syncAllSelectors(savedLang || 'en', savedCountry || 'us');
      if (savedCountry) {
        convertPricesForCountry(savedCountry);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     10. INIT PRINCIPALE — attend __allProducts + DOM prêt
  ══════════════════════════════════════════════════════════════ */
  function waitAndInit() {
    var waited = 0;
    var interval = setInterval(function () {
      waited += 100;
      var allProducts = window.__allProducts || [];
      var settings    = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
      var hasCfg      = settings.country_selector && settings.country_selector.options;

      if (hasCfg || waited >= MAX_WAIT) {
        clearInterval(interval);
        injectGoogleTranslate();
        bindAllSelectors();
        restoreSavedState();

        var autoTranslate = (settings.language_selector && settings.language_selector.auto_translate
          ? settings.language_selector.auto_translate
          : 'no').toLowerCase().trim();

        if (autoTranslate === 'yes') {
          detectGeo();
        } else {
          var savedL = loadSavedLang();
          var savedC = loadSavedCountry();
          if (savedL || savedC) {
            syncAllSelectors(savedL || 'en', savedC || 'us');
          }
        }
        var savedCountry = loadSavedCountry();
        if (savedCountry) {
          
          [500, 1500, 3000, 5000, 8000].forEach(function(delay) {
            setTimeout(function() {
              convertPricesForCountry(savedCountry);
            }, delay);
          });
        }
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }

})();