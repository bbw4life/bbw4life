/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — GEO-DETECT.JS
   Détecte le pays du visiteur via l'API gratuite ipapi.co
   et met à jour les sélecteurs pays/langue du header et footer.
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Délai max avant de lancer la mise à jour (ms) */
  var MAX_WAIT = 6000;

  /* ── Applique le pays détecté aux sélecteurs ── */
  function applyGeoCountry(countryCode) {
    countryCode = (countryCode || 'us').toLowerCase();

    /* Cherche le pays dans le setting */
    var allProducts    = window.__allProducts || [];
    var settings       = allProducts.find(function(p){ return p.type === 'settings'; }) || {};
    var countryCfg     = settings.country_selector  || {};
    var langCfg        = settings.language_selector || {};
    var countryOptions = countryCfg.options || [];
    var langOptions    = langCfg.options    || [];

    /* Trouve le pays (fallback = us) */
    var found = countryOptions.find(function(o){ return o.code === countryCode; });
    if (!found) found = countryOptions.find(function(o){ return o.code === 'us'; });
    if (!found) return; /* rien à faire */

    var targetLang = found.lang || 'en';

    /* Trouve la langue correspondante */
    var foundLang = langOptions.find(function(o){ return o.code === targetLang; });
    if (!foundLang) foundLang = langOptions.find(function(o){ return o.code === 'en'; });

    /* ── FOOTER — Country select ── */
    var footerCountry = document.getElementById('bbwFooterCountrySelect');
    if (footerCountry) footerCountry.value = found.code;

    /* ── FOOTER — Lang select ── */
    var footerLang = document.getElementById('bbwFooterLangSelect');
    if (footerLang && foundLang) footerLang.value = foundLang.code;

    /* ── HEADER DESKTOP — Lang dropdown ── */
    var headerFlag  = document.getElementById('bbwLangFlag');
    var headerLabel = document.getElementById('bbwLangLabel');
    if (foundLang) {
      if (headerFlag)  headerFlag.textContent  = foundLang.flag;
      if (headerLabel) headerLabel.textContent = foundLang.label;
    }
    /* Active la bonne option dans le dropdown desktop */
    var desktopOpts = document.querySelectorAll('#bbwLangDropdown .bbw-lang-select__option');
    desktopOpts.forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.lang === targetLang);
    });

    /* ── HEADER DRAWER MOBILE — Country ── */
    var drawerCountryFlag  = document.getElementById('bbwDrawerCountryFlag');
    var drawerCountryLabel = document.getElementById('bbwDrawerCountryLabel');
    if (drawerCountryFlag)  drawerCountryFlag.textContent  = found.flag;
    if (drawerCountryLabel) drawerCountryLabel.textContent = found.label;
    var drawerCountryOpts = document.querySelectorAll('#bbwDrawerCountryList .bbw-drawer__select-opt');
    drawerCountryOpts.forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.country === found.code);
    });

    /* ── HEADER DRAWER MOBILE — Lang ── */
    var drawerLangFlag  = document.getElementById('bbwDrawerLangFlag');
    var drawerLangLabel = document.getElementById('bbwDrawerLangLabel');
    if (foundLang) {
      if (drawerLangFlag)  drawerLangFlag.textContent = foundLang.flag;
      if (drawerLangLabel) drawerLangLabel.textContent = foundLang.name;
    }
    var drawerLangOpts = document.querySelectorAll('#bbwDrawerLangList .bbw-drawer__select-opt');
    drawerLangOpts.forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.lang === targetLang);
    });

    console.log('[BBW4LIFE Geo] Applied country:', found.code, '| lang:', targetLang);
  }

  /* ── Fetch géolocalisation ── */
  function detectAndApply() {
    /* Cache de session pour éviter un appel API à chaque page */
    try {
      var cached = sessionStorage.getItem('bbw_geo_country');
      if (cached) {
        applyGeoCountry(cached);
        return;
      }
    } catch(e) {}

    fetch('https://ipapi.co/json/')
      .then(function(res){ return res.json(); })
      .then(function(data){
        var code = (data && data.country_code) ? data.country_code.toLowerCase() : 'us';
        try { sessionStorage.setItem('bbw_geo_country', code); } catch(e) {}
        applyGeoCountry(code);
      })
      .catch(function(){
        /* En cas d'erreur réseau → fallback USA */
        applyGeoCountry('us');
      });
  }

  /* ── Attendre que __allProducts ET le DOM soient prêts ── */
  function waitAndDetect() {
    var waited = 0;
    var interval = setInterval(function(){
      waited += 100;
      var allProducts = window.__allProducts || [];
      var settings    = allProducts.find(function(p){ return p.type === 'settings'; }) || {};
      var hasCfg      = settings.country_selector && settings.country_selector.options;

      if (hasCfg || waited >= MAX_WAIT) {
        clearInterval(interval);
        detectAndApply();
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndDetect);
  } else {
    waitAndDetect();
  }

})();