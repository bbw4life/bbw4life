/* ════════════════════════════════════════════════════════════════
   BBW4LIFE — PAYPAL SHIPPING MODAL (pages produit)
   Popup de livraison ouvert par le bouton "Buy with PayPal" quand le
   panier était vide avant le clic (achat direct d'un seul produit).
   Reproduit le MÊME formulaire que checkout.js (pays/ville avec
   autocomplete, téléphone, méthode d'expédition, code promo), pour
   que la commande contienne exactement les mêmes données envoyées à
   Eprolo/CJ que le flux checkout classique — juste sans changer de
   page. Une fois validé, crée la commande PayPal via
   /.netlify/functions/paypal-create-order (même fonction, même
   sécurité serveur que le checkout) et redirige vers PayPal.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var HTML = `
<div class="ppsm-overlay" id="ppsmOverlay">
  <div class="ppsm-modal">
    <button type="button" class="ppsm-close" id="ppsmClose" aria-label="Close">×</button>
    <h3 class="ppsm-title">Shipping Information</h3>
    <p class="ppsm-subtitle">Enter your delivery details to continue with PayPal.</p>

    <form id="ppsm-shipping-form" autocomplete="on">
      <div>
        <label for="ppsm-first-name">First Name</label>
        <input type="text" id="ppsm-first-name" required>
      </div>
      <div>
        <label for="ppsm-last-name">Last Name</label>
        <input type="text" id="ppsm-last-name" required>
      </div>
      <div class="ppsm-full">
        <label for="ppsm-email">Email Address</label>
        <input type="email" id="ppsm-email" required>
      </div>
      <div class="ppsm-full">
        <label for="ppsm-phone">Phone Number</label>
        <div class="ppsm-phone-group">
          <input type="text" id="ppsm-phone-code" readonly>
          <input type="tel" id="ppsm-phone" required>
        </div>
      </div>

      <div>
        <label for="ppsm-country">Country</label>
        <div class="ppsm-select-wrapper" id="ppsm-country-wrapper">
          <div class="ppsm-select-trigger" id="ppsm-country-trigger" tabindex="0">
            <span id="ppsm-country-display" class="placeholder">Select your country</span>
            <i class="fas fa-chevron-down ppsm-select-arrow"></i>
          </div>
          <div class="ppsm-select-dropdown" id="ppsm-country-dropdown">
            <input type="text" class="ppsm-select-search" id="ppsm-country-search" placeholder="Search country..." autocomplete="off">
            <ul class="ppsm-select-list" id="ppsm-country-list"></ul>
          </div>
          <input type="hidden" id="ppsm-country" required>
        </div>
      </div>
      <div>
        <label for="ppsm-city">City</label>
        <div class="ppsm-select-wrapper" id="ppsm-city-wrapper">
          <div class="ppsm-select-trigger" id="ppsm-city-trigger" tabindex="0">
            <span id="ppsm-city-display" class="placeholder">Select your city</span>
            <i class="fas fa-chevron-down ppsm-select-arrow"></i>
          </div>
          <div class="ppsm-select-dropdown" id="ppsm-city-dropdown">
            <input type="text" class="ppsm-select-search" id="ppsm-city-search" placeholder="Search city..." autocomplete="off">
            <ul class="ppsm-select-list" id="ppsm-city-list"></ul>
          </div>
          <input type="hidden" id="ppsm-city" required>
        </div>
      </div>

      <div>
        <label for="ppsm-state">State / Department</label>
        <input type="text" id="ppsm-state" required>
      </div>
      <div>
        <label for="ppsm-postal-code">Postal Code</label>
        <input type="text" id="ppsm-postal-code" required>
      </div>
      <div class="ppsm-full">
        <label for="ppsm-address">Full Address</label>
        <textarea id="ppsm-address" required></textarea>
      </div>

      <div class="ppsm-full">
        <label>Shipping Method</label>
        <div class="ppsm-shipping-options" id="ppsm-shipping-options">
          <div class="ppsm-shipping-option selected" data-method="Standard Shipping"><i class="fas fa-truck"></i><span class="ppsm-shipping-option__label">Standard</span><span class="ppsm-shipping-option__delay" data-delay-for="Standard Shipping"></span></div>
          <div class="ppsm-shipping-option" data-method="Express DHL"><i class="fas fa-plane"></i><span class="ppsm-shipping-option__label">Express DHL</span><span class="ppsm-shipping-option__delay" data-delay-for="Express DHL"></span></div>
          <div class="ppsm-shipping-option" data-method="Priority FedEx"><i class="fas fa-bolt"></i><span class="ppsm-shipping-option__label">Priority FedEx</span><span class="ppsm-shipping-option__delay" data-delay-for="Priority FedEx"></span></div>
          <div class="ppsm-shipping-option" data-method="Economy Shipping"><i class="fas fa-clock"></i><span class="ppsm-shipping-option__label">Economy</span><span class="ppsm-shipping-option__delay" data-delay-for="Economy Shipping"></span></div>
        </div>
      </div>

      <div class="ppsm-full">
        <label for="ppsm-promo-input">Promo Code</label>
        <div class="ppsm-promo-row" id="ppsm-suggested-promo" style="display:none;">
          <span class="ppsm-suggested-text">Recommended for your cart (<span id="ppsm-item-count-display">0</span> items): <strong id="ppsm-suggested-code"></strong></span>
          <button type="button" id="ppsm-copy-suggested">Copy</button>
        </div>
        <div class="ppsm-promo-row">
          <input type="text" id="ppsm-promo-input" placeholder="Enter promo code">
          <button type="button" id="ppsm-promo-apply">Apply</button>
        </div>
        <p id="ppsm-promo-message"></p>
      </div>
    </form>

    <div class="ppsm-summary">
      <p><span>Subtotal</span><span id="ppsm-subtotal">$0.00</span></p>
      <p><span>Taxes (<span id="ppsm-tax-rate-label">0</span>%)</span><span id="ppsm-taxes">$0.00</span></p>
      <p><span>Shipping</span><span id="ppsm-shipping">$0.00</span></p>
      <p class="ppsm-summary__discount" id="ppsm-promo-line" style="display:none;"><span>Discount</span><span id="ppsm-discount-amount">-$0.00</span></p>
      <p class="ppsm-summary__total"><span>Total</span><span id="ppsm-total">$0.00</span></p>
    </div>

    <button type="button" id="ppsm-continue-btn">Continue with PayPal</button>
  </div>
</div>`;

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('.buy-paypal')) return; // pas de bouton PayPal sur cette page
    var container = document.createElement('div');
    container.innerHTML = HTML;
    document.body.appendChild(container);
    initModal();
  });

  function initModal() {
    var overlay      = document.getElementById('ppsmOverlay');
    var closeBtn      = document.getElementById('ppsmClose');
    var continueBtn   = document.getElementById('ppsm-continue-btn');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    // Verrouille le scroll du body tant que le popup est ouvert — sans ça,
    // sur mobile, scroller à l'intérieur du popup peut aussi faire défiler
    // la page en arrière-plan (scroll chaining) et repositionner d'autres
    // éléments position:fixed (ex: cart-drawer) qui semblent alors passer
    // par-dessus le popup malgré son z-index plus élevé.
    var scrollLockY = 0;
    function lockBodyScroll() {
      scrollLockY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + scrollLockY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    function unlockBodyScroll() {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollLockY);
    }

    function closeModal() {
      overlay.classList.remove('active');
      unlockBodyScroll();
      if (continueBtn) { continueBtn.disabled = false; continueBtn.textContent = 'Continue with PayPal'; }
    }

    // ── Shipping method selection ──
    document.querySelectorAll('#ppsm-shipping-options .ppsm-shipping-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        document.querySelectorAll('#ppsm-shipping-options .ppsm-shipping-option').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
      });
    });

    // ── Délais de livraison + code promo suggéré — lus depuis
    // settings (products.data.json), jamais en dur, même source que
    // checkout.js (settings.shipping_*_delay / settings.promos /
    // settings.cart_drawer.promo_count_free_items). Recalculé à CHAQUE
    // ouverture du popup (pas seulement au chargement de la page) : le
    // panier ne contient le produit qu'après le clic sur "Buy with PayPal",
    // donc lire localStorage.cart une seule fois au DOMContentLoaded
    // (avant l'ajout) donnait toujours un panier vide/périmé.
    var cachedSettings = null;
    function refreshPromoAndDelays() {
      var applySettings = function (settings) {
        var delayMap = {
          'Standard Shipping': settings.shipping_standard_delay || '',
          'Express DHL':       settings.shipping_dhl_delay      || '',
          'Priority FedEx':    settings.shipping_priority_delay || '',
          'Economy Shipping':  settings.shipping_economy_delay  || ''
        };
        document.querySelectorAll('.ppsm-shipping-option__delay').forEach(function (el) {
          var method = el.dataset.delayFor;
          if (delayMap[method]) el.textContent = delayMap[method];
        });

        var cart = [];
        try { cart = JSON.parse(localStorage.getItem('cart')) || []; } catch (e) { cart = []; }
        var cd = settings.cart_drawer || {};
        var countFreeForPromo = (cd.promo_count_free_items || 'No').toLowerCase() === 'yes';
        var totalQuantity = countFreeForPromo
          ? cart.reduce(function (sum, item) { return sum + item.quantity; }, 0)
          : cart.filter(function (i) { return !i.isFreePromo; }).reduce(function (sum, item) { return sum + item.quantity; }, 0);

        var promos = settings.promos || [];
        var suggested = promos.find(function (p) { return p.items === totalQuantity; });
        var hasBundle = cart.some(function (item) { return item.fromBundle; });

        var suggestedP = document.getElementById('ppsm-suggested-promo');
        var suggestedCodeEl = document.getElementById('ppsm-suggested-code');
        var itemCountDisplay = document.getElementById('ppsm-item-count-display');
        if (suggestedP && suggestedCodeEl && itemCountDisplay) {
          itemCountDisplay.textContent = totalQuantity;
          if (!hasBundle && suggested) {
            suggestedP.style.display = 'flex';
            suggestedCodeEl.textContent = suggested.code;
          } else {
            suggestedP.style.display = 'none';
          }
        }

        appliedDiscountAmount = 0; // reset à chaque (ré)ouverture du popup
        updateSummary();
      };

      if (cachedSettings) { applySettings(cachedSettings); return; }
      fetch('/products.data.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var arr = Array.isArray(data) ? data : [];
          cachedSettings = arr.find(function (p) { return p.type === 'settings'; }) || {};
          applySettings(cachedSettings);
        })
        .catch(function () {});
    }
    refreshPromoAndDelays();

    var copyBtn = document.getElementById('ppsm-copy-suggested');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var code = document.getElementById('ppsm-suggested-code').textContent;
        document.getElementById('ppsm-promo-input').value = code;
        navigator.clipboard.writeText(code).then(function () {
          var original = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = original; }, 2000);
        });
      });
    }

    // ── Résumé de commande (subtotal/tax/shipping/discount/total) — même
    // règles que checkout.js updateTotals() : Standard/Economy gratuits,
    // Express DHL/Priority FedEx payants (settings.shipping_cost), taxe
    // settings.tax_rate, réduction si un code promo classique correspond au
    // nombre d'articles (settings.promos). Le total final réel reste de
    // toute façon toujours recalculé et sécurisé côté serveur
    // (paypal-create-order.js → computeServerTotal) au clic final. ──
    var appliedDiscountAmount = 0;
    function getCart() {
      var cart = [];
      try { cart = JSON.parse(localStorage.getItem('cart')) || []; } catch (e) { cart = []; }
      return cart;
    }
    function getSubtotal() {
      return getCart().reduce(function (sum, item) { return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0); }, 0);
    }
    function updateSummary() {
      if (!cachedSettings) return;
      var subtotal = getSubtotal();
      var selectedOpt = document.querySelector('#ppsm-shipping-options .ppsm-shipping-option.selected');
      var selectedMethod = selectedOpt ? selectedOpt.dataset.method : 'Standard Shipping';
      var isFreeMethod = selectedMethod === 'Standard Shipping' || selectedMethod === 'Economy Shipping';
      var shippingCost = parseFloat(cachedSettings.shipping_cost) || 10.00;
      var taxRate = parseFloat(cachedSettings.tax_rate) || 0;
      var effectiveShipping = isFreeMethod ? 0 : shippingCost;
      var effectiveTax = isFreeMethod ? 0 : parseFloat((subtotal * taxRate).toFixed(2));
      var finalTotal = Math.max(0, parseFloat((subtotal + effectiveTax + effectiveShipping - appliedDiscountAmount).toFixed(2)));

      var subtotalEl = document.getElementById('ppsm-subtotal');
      var taxesEl = document.getElementById('ppsm-taxes');
      var taxLabelEl = document.getElementById('ppsm-tax-rate-label');
      var shippingEl = document.getElementById('ppsm-shipping');
      var totalEl = document.getElementById('ppsm-total');
      var promoLineEl = document.getElementById('ppsm-promo-line');
      var discountEl = document.getElementById('ppsm-discount-amount');
      if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
      if (taxesEl) taxesEl.textContent = '$' + effectiveTax.toFixed(2);
      if (taxLabelEl) taxLabelEl.textContent = isFreeMethod ? 0 : (taxRate * 100).toFixed(taxRate * 100 % 1 === 0 ? 0 : 1);
      if (shippingEl) shippingEl.textContent = effectiveShipping === 0 ? 'FREE' : '$' + effectiveShipping.toFixed(2);
      if (totalEl) totalEl.textContent = '$' + finalTotal.toFixed(2);
      if (promoLineEl && discountEl) {
        if (appliedDiscountAmount > 0) {
          promoLineEl.style.display = 'flex';
          discountEl.textContent = '-$' + appliedDiscountAmount.toFixed(2);
        } else {
          promoLineEl.style.display = 'none';
        }
      }
    }
    document.querySelectorAll('#ppsm-shipping-options .ppsm-shipping-option').forEach(function (opt) {
      opt.addEventListener('click', updateSummary);
    });

    var applyBtn = document.getElementById('ppsm-promo-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var promoMessage = document.getElementById('ppsm-promo-message');
        var input = document.getElementById('ppsm-promo-input').value.trim().toUpperCase();
        if (!promoMessage) return;
        if (!input) {
          promoMessage.textContent = 'Please enter a promo code.';
          promoMessage.style.color = '#c0385e';
          return;
        }
        if (!cachedSettings) { promoMessage.textContent = ''; return; }

        var cart = getCart();
        var cd = cachedSettings.cart_drawer || {};
        var countFreeForPromo = (cd.promo_count_free_items || 'No').toLowerCase() === 'yes';
        var totalQuantity = countFreeForPromo
          ? cart.reduce(function (sum, item) { return sum + item.quantity; }, 0)
          : cart.filter(function (i) { return !i.isFreePromo; }).reduce(function (sum, item) { return sum + item.quantity; }, 0);

        var promos = cachedSettings.promos || [];
        var promo = promos.find(function (p) { return p.code.toUpperCase() === input; });
        if (promo && promo.items === totalQuantity) {
          appliedDiscountAmount = parseFloat((getSubtotal() * (promo.percent / 100)).toFixed(2));
          promoMessage.textContent = 'Promo applied: ' + promo.percent + '% off!';
          promoMessage.style.color = '#3E7C5A';
        } else {
          appliedDiscountAmount = 0;
          promoMessage.textContent = 'Invalid or inapplicable promo code.';
          promoMessage.style.color = '#c0385e';
        }
        updateSummary();
      });
    }

    // ── Custom searchable select (pays / ville) — même logique que checkout.js ──
    var allCountries = [];
    var selectedCountryName = '';
    var selectedCountryCode = '';
    var selectedCountryCCA2 = '';
    var selectedCityName = '';
    var countriesLoaded = false;

    function buildCustomSelect(opts) {
      var wrapper = document.getElementById(opts.wrapperId);
      var trigger = document.getElementById(opts.triggerId);
      var display = document.getElementById(opts.displayId);
      var dropdown = document.getElementById(opts.dropdownId);
      var search = document.getElementById(opts.searchId);
      var list = document.getElementById(opts.listId);
      var hidden = document.getElementById(opts.hiddenId);
      if (!wrapper || !trigger || !display || !dropdown || !search || !list || !hidden) return null;

      function openDropdown() {
        document.querySelectorAll('.ppsm-select-wrapper.open').forEach(function (w) {
          if (w.id !== opts.wrapperId) w.classList.remove('open');
        });
        wrapper.classList.add('open');
        search.value = '';
        search.focus();
        filterList('');
      }
      function closeDropdown() { wrapper.classList.remove('open'); }
      function filterList(query) {
        var q = query.toLowerCase().trim();
        var items = list.querySelectorAll('li:not(.no-results):not(.loading)');
        var visibleCount = 0;
        items.forEach(function (li) {
          var text = (li.dataset.label || '').toLowerCase();
          if (!q || text.indexOf(q) !== -1) { li.style.display = ''; visibleCount++; }
          else { li.style.display = 'none'; }
        });
        var noResults = list.querySelector('.no-results');
        if (noResults) noResults.style.display = visibleCount === 0 ? '' : 'none';
      }

      trigger.addEventListener('click', function () {
        wrapper.classList.contains('open') ? closeDropdown() : openDropdown();
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); }
        if (e.key === 'Escape') closeDropdown();
      });
      search.addEventListener('input', function () { filterList(search.value); });
      search.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDropdown(); });
      document.addEventListener('click', function (e) { if (!wrapper.contains(e.target)) closeDropdown(); });

      return { closeDropdown: closeDropdown };
    }

    var countryCtrl = buildCustomSelect({
      wrapperId: 'ppsm-country-wrapper', triggerId: 'ppsm-country-trigger',
      displayId: 'ppsm-country-display', dropdownId: 'ppsm-country-dropdown',
      searchId: 'ppsm-country-search', listId: 'ppsm-country-list', hiddenId: 'ppsm-country'
    });
    var cityCtrl = buildCustomSelect({
      wrapperId: 'ppsm-city-wrapper', triggerId: 'ppsm-city-trigger',
      displayId: 'ppsm-city-display', dropdownId: 'ppsm-city-dropdown',
      searchId: 'ppsm-city-search', listId: 'ppsm-city-list', hiddenId: 'ppsm-city'
    });

    function getPhoneCode(idd) {
      if (!idd || !idd.root) return '';
      if (!idd.suffixes || idd.suffixes.length !== 1) return idd.root;
      return idd.root + idd.suffixes[0];
    }

    function populateCityList(cities) {
      var list = document.getElementById('ppsm-city-list');
      var hidden = document.getElementById('ppsm-city');
      var display = document.getElementById('ppsm-city-display');
      if (!list) return;
      list.innerHTML = '';
      var noItem = document.createElement('li');
      noItem.className = 'no-results';
      noItem.textContent = 'No cities found';
      noItem.style.display = 'none';
      list.appendChild(noItem);

      cities.forEach(function (city) {
        var li = document.createElement('li');
        li.dataset.label = city;
        li.textContent = city;
        li.addEventListener('click', function () {
          selectedCityName = city;
          hidden.value = city;
          display.textContent = city;
          display.classList.remove('placeholder');
          list.querySelectorAll('li').forEach(function (i) { i.classList.remove('selected'); });
          li.classList.add('selected');
          if (cityCtrl) cityCtrl.closeDropdown();
        });
        list.appendChild(li);
      });
    }

    function loadCitiesForCountry(countryName) {
      var list = document.getElementById('ppsm-city-list');
      var display = document.getElementById('ppsm-city-display');
      var hidden = document.getElementById('ppsm-city');
      if (!list) return;
      list.innerHTML = '<li class="loading">Loading cities...</li>';
      if (display) { display.textContent = 'Select your city'; display.classList.add('placeholder'); }
      if (hidden) hidden.value = '';
      selectedCityName = '';

      fetch('https://countriesnow.space/api/v0.1/countries/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var cities = (data.data && data.data.length) ? data.data : [];
          populateCityList(cities);
          if (!cities.length) list.innerHTML = '<li class="no-results">No cities found</li>';
        })
        .catch(function () { list.innerHTML = '<li class="no-results">No cities found</li>'; });
    }

    function loadCountries() {
      if (countriesLoaded) return;
      countriesLoaded = true;
      var list = document.getElementById('ppsm-country-list');
      var hidden = document.getElementById('ppsm-country');
      var display = document.getElementById('ppsm-country-display');
      var phoneCodeInput = document.getElementById('ppsm-phone-code');
      if (!list) return;
      list.innerHTML = '<li class="loading">Loading countries...</li>';

      fetch('/countries.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          allCountries = data.sort(function (a, b) { return a.name.common.localeCompare(b.name.common); });
          list.innerHTML = '';
          var noItem = document.createElement('li');
          noItem.className = 'no-results';
          noItem.textContent = 'No results';
          noItem.style.display = 'none';
          list.appendChild(noItem);

          allCountries.forEach(function (country) {
            var name = country.name.common;
            var code = getPhoneCode(country.idd);
            var cca2 = country.cca2;
            var li = document.createElement('li');
            li.dataset.label = name;
            li.textContent = name;
            li.addEventListener('click', function () {
              selectedCountryName = name;
              selectedCountryCode = code;
              selectedCountryCCA2 = cca2;
              hidden.value = name;
              display.textContent = name;
              display.classList.remove('placeholder');
              if (phoneCodeInput) phoneCodeInput.value = code;
              list.querySelectorAll('li').forEach(function (i) { i.classList.remove('selected'); });
              li.classList.add('selected');
              if (countryCtrl) countryCtrl.closeDropdown();
              loadCitiesForCountry(name);
            });
            list.appendChild(li);
          });
        })
        .catch(function () {
          countriesLoaded = false;
          list.innerHTML = '<li class="no-results">Failed to load countries — please refresh</li>';
        });
    }

    function getCountryCode(countryName) {
      if (selectedCountryCCA2 && selectedCountryCCA2.length === 2) return selectedCountryCCA2;
      var match = allCountries.find(function (c) { return c.name.common === countryName; });
      return (match && match.cca2) || 'US';
    }

    // ── Form validation (même logique que validateForm() de checkout.js) ──
    function validateForm() {
      var requiredIds = ['ppsm-first-name', 'ppsm-last-name', 'ppsm-email', 'ppsm-address', 'ppsm-postal-code', 'ppsm-phone', 'ppsm-state'];
      var valid = true;
      requiredIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (!el.value.trim()) { valid = false; el.style.borderColor = 'red'; }
        else { el.style.borderColor = ''; }
      });
      var countryHidden = document.getElementById('ppsm-country');
      var countryTrigger = document.getElementById('ppsm-country-trigger');
      if (!countryHidden || !countryHidden.value.trim()) {
        valid = false;
        if (countryTrigger) countryTrigger.style.borderColor = 'red';
      } else if (countryTrigger) countryTrigger.style.borderColor = '';

      var cityHidden = document.getElementById('ppsm-city');
      var cityTrigger = document.getElementById('ppsm-city-trigger');
      if (!cityHidden || !cityHidden.value.trim()) {
        valid = false;
        if (cityTrigger) cityTrigger.style.borderColor = 'red';
      } else if (cityTrigger) cityTrigger.style.borderColor = '';

      if (!valid && typeof window.showErrorPopup === 'function') {
        window.showErrorPopup('Please fill all required fields before finalizing the payment.');
      }
      return valid;
    }

    function getShippingData() {
      var countryName = selectedCountryName || document.getElementById('ppsm-country').value.trim();
      var countryCode = getCountryCode(countryName);
      var phoneCode = document.getElementById('ppsm-phone-code').value.trim();
      var phoneNumber = document.getElementById('ppsm-phone').value.trim();
      var fullPhone = (phoneCode + phoneNumber).replace(/\s+/g, '');
      var shippingMethodEl = document.querySelector('#ppsm-shipping-options .ppsm-shipping-option.selected');

      var fulfillment_method = 'eprolo';
      if (allCountries.length > 0) {
        var countryEntry = allCountries.find(function (c) { return c.name.common === countryName; });
        if (countryEntry && countryEntry.fulfillment) fulfillment_method = countryEntry.fulfillment;
      }

      return {
        firstName: document.getElementById('ppsm-first-name').value.trim(),
        lastName: document.getElementById('ppsm-last-name').value.trim(),
        email: document.getElementById('ppsm-email').value.trim(),
        phone: fullPhone,
        country: countryName,
        countryCode: countryCode,
        city: selectedCityName || document.getElementById('ppsm-city').value.trim() || '',
        state: document.getElementById('ppsm-state').value.trim(),
        postalCode: document.getElementById('ppsm-postal-code').value.trim(),
        address: document.getElementById('ppsm-address').value.trim(),
        shipping_method: (shippingMethodEl && shippingMethodEl.dataset.method) || 'Standard Shipping',
        fulfillment_method: fulfillment_method
      };
    }

    // ── Continue button : valide, crée la commande PayPal, redirige ──
    continueBtn.addEventListener('click', function () {
      if (!validateForm()) return;

      continueBtn.disabled = true;
      continueBtn.textContent = 'Processing...';

      var cart = [];
      try { cart = JSON.parse(localStorage.getItem('cart')) || []; } catch (e) { cart = []; }
      if (!cart.length) {
        if (typeof window.showErrorPopup === 'function') window.showErrorPopup('Your cart is empty.');
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continue with PayPal';
        return;
      }

      var shippingData = getShippingData();
      var promoCode = document.getElementById('ppsm-promo-input').value.trim().toUpperCase() || null;

      fetch('/.netlify/functions/paypal-create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: cart,
          shipping: shippingData,
          promoCode: promoCode
        })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok || !res.data.orderID) throw new Error((res.data && res.data.error) || 'PayPal order failed');
          localStorage.setItem('pendingOrder', 'paypal');
          var paypalDomain = res.data.paypalDomain || 'https://www.sandbox.paypal.com';
          window.location.href = paypalDomain + '/checkoutnow?token=' + res.data.orderID;
        })
        .catch(function (err) {
          console.error('PayPal order error:', err);
          if (typeof window.showErrorPopup === 'function') {
            window.showErrorPopup('PayPal payment could not be started. Please try again.');
          }
          continueBtn.disabled = false;
          continueBtn.textContent = 'Continue with PayPal';
        });
    });

    loadCountries();

    // ── Exposé globalement pour que script.js (buyWithPaypal) puisse l'ouvrir ──
    window.openPaypalShippingModal = function () {
      overlay.classList.add('active');
      lockBodyScroll();
      refreshPromoAndDelays(); // panier à jour : recalcule le code promo suggéré
    };
  }
})();
