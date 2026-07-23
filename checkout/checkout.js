// checkout.js
document.addEventListener('DOMContentLoaded', async () => {

    // ====================== RESTORE ABANDONED CART ======================
    const urlParams = new URLSearchParams(window.location.search);
    const restoreOrderId = urlParams.get('restore');

    if (restoreOrderId) {
        try {
            const res = await fetch(`/.netlify/functions/restore-abandoned-cart?orderId=${encodeURIComponent(restoreOrderId)}`);
            const data = await res.json();

            if (res.ok && data.success) {
                if (Array.isArray(data.cart) && data.cart.length > 0) {
                    localStorage.setItem('cart', JSON.stringify(data.cart));
                }

                const s = data.shipping || {};
                const setIfPresent = (id, value) => {
                    const el = document.getElementById(id);
                    if (el && value) el.value = value;
                };
                // Pré-remplissage différé car le formulaire existe déjà dans le DOM à ce stade
                setIfPresent('first-name',  s.firstName);
                setIfPresent('last-name',   s.lastName);
                setIfPresent('email',       s.email);
                setIfPresent('phone',       s.phone);
                setIfPresent('state',       s.state);
                setIfPresent('postal-code', s.postalCode);
                setIfPresent('address',     s.address);

                if (data.promoCode) {
                    const promoInput = document.getElementById('promo-input');
                    if (promoInput) promoInput.value = data.promoCode;
                }

                console.log(`[ABANDONED CART] Panier restauré pour ${restoreOrderId}`);
            } else {
                console.warn('[ABANDONED CART] Restauration échouée:', data.error);
            }
        } catch (e) {
            console.warn('[ABANDONED CART] Erreur restauration:', e.message);
        }
    }
    // ====================== END RESTORE ABANDONED CART ======================

    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (!Array.isArray(cart)) cart = [];
    } catch {
        cart = [];
    }

    const cartItemsContainer = document.querySelector('.cart-items');
    const shippingForm = document.getElementById('shipping-form');
    const payButton = document.getElementById('pay-button');
    const paymentOptions = document.querySelectorAll('input[name="payment"]');

    let productsData = [];
    let TAX_RATE = 0.1;
    let SHIPPING_COST = 10.00;
    let promos = [];
    let appliedPromo = null;
    let discountAmount = 0;
    let _promoFreeApplying = false;
    let upsellDiscountAmount = 0;
    let upsellDiscountApplied = false;
    let affPromoCode     = localStorage.getItem('bbw_aff_promo_code')     || null;
    let affPromoDiscount = parseFloat(localStorage.getItem('bbw_aff_promo_discount')) || 0;
    let affPromoApplied  = false;


    // ====================== POPUP ======================
    function showErrorPopup(message) {
        const popup = document.getElementById('error-popup');
        const popupText = document.getElementById('popup-message');
        const closeBtn = document.getElementById('popup-close');
        if (!popup || !popupText || !closeBtn) { console.error("Popup HTML missing!"); return; }
        popupText.textContent = message;
        popup.classList.add('show');
        closeBtn.onclick = () => popup.classList.remove('show');
        setTimeout(() => { if (popup.classList.contains('show')) popup.classList.remove('show'); }, 10000);
    }

    function showSuccessPopup(message) {
        const popup = document.getElementById('success-popup');
        const text  = document.getElementById('success-message');
        const close = document.getElementById('success-close');
        if (!popup || !text || !close) return;
        text.textContent = message;
        popup.classList.add('show');
        close.onclick = () => popup.classList.remove('show');
        setTimeout(() => popup.classList.remove('show'), 4000);
    }

    fetch('/products.data.json')
      .then(response => response.json())
      .then(data => {
        productsData = data;
        const settings = productsData.find(item => item.type === "settings");
        if (settings) {
          TAX_RATE = settings.tax_rate || 0.1;
          SHIPPING_COST = settings.shipping_cost || 10.00;
          promos = settings.promos || [];

          const delayMap = {
            'Standard Shipping': settings.shipping_standard_delay || '',
            'Express DHL':        settings.shipping_dhl_delay      || '',
            'Priority FedEx':     settings.shipping_priority_delay || '',
            'Economy Shipping':   settings.shipping_economy_delay  || '',
          };
          document.querySelectorAll('.shipping-option').forEach(opt => {
            const method = opt.dataset.method;
            if (delayMap[method]) {
              const p = opt.querySelector('p');
              if (p) p.textContent = delayMap[method];
            }
          });

          // ══ INJECT DELAYS INTO SHIPPING MODAL ══
          const modalDelayMap = {
              'modal-delay-standard': settings.shipping_standard_delay || '—',
              'modal-delay-dhl':      settings.shipping_dhl_delay      || '—',
              'modal-delay-priority': settings.shipping_priority_delay || '—',
              'modal-delay-economy':  settings.shipping_economy_delay  || '—',
          };
          Object.entries(modalDelayMap).forEach(([id, value]) => {
              const el = document.getElementById(id);
              if (el) el.textContent = value;
          });

          // ══ INJECT CONTACT EMAILS FROM SETTINGS ══
          (function injectContactEmails() {
            const emails = settings.contact_emails || {};
            if (!Object.keys(emails).length) return;

            document.querySelectorAll('[data-email-key]').forEach(el => {
              const key   = el.dataset.emailKey;
              const email = emails[key];
              if (!email) return;

              if (el.dataset.emailCta) {
                el.href = 'mailto:' + email;
                return;
              }

              if (el.tagName === 'A') {
                el.href        = 'mailto:' + email;
                el.textContent = email;
              } else {
                el.textContent = email;
              }
            });
          })();

          // ══ TOGGLE NOWPAYMENTS (CRYPTO) OPTION ══
          (function toggleNowPayments() {
            const showCrypto = (settings.show_nowpayments || 'yes').toLowerCase().trim() === 'yes';
            if (showCrypto) return;

            const cryptoRadio = document.querySelector('input[name="payment"][value="nowpayments"]');
            const cryptoLabel = cryptoRadio ? cryptoRadio.closest('.payment-label') : null;
            if (cryptoLabel) cryptoLabel.style.display = 'none';
          })();
          
        }
        applyPromoFreeItems();
        // ══ COLLAPSIBLE ORDER SUMMARY ══
        (function initCollapsibleOrderSummary() {
        const setting = (settings?.collapsible_order_summary || 'No').trim().toLowerCase();
        if (setting !== 'yes') return;

        const section = document.querySelector('.order-summary');
        const toggle  = document.getElementById('order-summary-toggle');
        if (!section || !toggle) return;

        section.classList.add('collapsible');

        toggle.addEventListener('click', () => {
            const isOpen = section.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen);
        });
        })();
        renderCart();
      })
      .catch(error => {
        console.error('Error loading /products.data.json:', error);
        renderCart();
      });

    // ====================== ACCOUNT PRE-FILL ======================
    if (localStorage.getItem('isLoggedIn') === 'true') {
        const setField = (id, value) => {
            const el = document.getElementById(id);
            if (el && value) el.value = value;
        };
        setField('first-name',   localStorage.getItem('userFirstName')    || '');
        setField('last-name',    localStorage.getItem('userLastName')     || '');
        setField('email',        localStorage.getItem('userEmail')        || '');
        setField('address',      localStorage.getItem('userAddressLine1') || '');
        setField('city',         localStorage.getItem('userCity')         || '');
        setField('state',        localStorage.getItem('userState')        || '');
        setField('postal-code',  localStorage.getItem('userZip')          || '');
        const line2 = localStorage.getItem('userLine2') || '';
        setField('address2',      line2);
        setField('address-line2', line2);
        setField('addr-line2',    line2);
    }

    // ====================== RENDER CART ======================
    function renderCart() {
        if (!cart.length) {
            cartItemsContainer.innerHTML = "<p>Your cart is empty.</p>";
            return;
        }
        cartItemsContainer.innerHTML = '';
        let subtotal = 0;
        let bundleSavings = 0;
        let hasBundle = false;
        cart.forEach(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            if (item.fromBundle) {
                hasBundle = true;
                bundleSavings += (item.compare_price ? (item.compare_price - price) * quantity : 0);
            }
            subtotal += price * quantity;
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');
            const img = document.createElement('img');
            img.src = item.image || '';
            img.alt = item.title || 'Product';
            img.loading = "lazy";
            const info = document.createElement('div');
            info.classList.add('item-info');

            const freeBadge = item.isFreePromo
                ? `<span class="free-badge">🎁 Free 0.00$</span>`
                : '';

            info.innerHTML = `
                <h3>${(item.title || '').replace('', '')} ${freeBadge}</h3>
                <p>Price: ${item.isFreePromo ? '' : '$' + price.toFixed(2) + (item.fromBundle ? ' (Bundle Discount Applied)' : '')}</p>
                <p>Quantity: ${quantity}</p>
                ${item.size  ? `<p>Size: ${item.size}</p>`   : ''}
                ${item.color ? `<p>Color: ${item.color}</p>` : ''}
                <p>Total: ${item.isFreePromo ? '' : '$' + (price * quantity).toFixed(2)}</p>
            `;

            itemDiv.appendChild(img);
            itemDiv.appendChild(info);
            cartItemsContainer.appendChild(itemDiv);
        });
        if (hasBundle && bundleSavings > 0) {
            const savingsDiv = document.createElement('div');
            savingsDiv.classList.add('bundle-savings');
            savingsDiv.innerHTML = `<p>Bundle Savings: -$${bundleSavings.toFixed(2)}</p>`;
            cartItemsContainer.appendChild(savingsDiv);
        }
        updatePromoDisplay();
        applyUpsellDiscount();
        updateTotals();
    }

   paymentOptions.forEach(option => {
        option.addEventListener('change', () => {
            const labels = {
                stripe:      'Pay with Card',
                paypal:      'Pay with PayPal',
                nowpayments: 'Pay with Crypto'
            };
            payButton.textContent = labels[option.value] || 'Pay Now';
        });
    });

    // ====================== FORM VALIDATION ======================
    function validateForm() {
        const requiredIds = ['first-name', 'last-name', 'email', 'address', 'postal-code', 'phone'];
        let valid = true;
        requiredIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!el.value.trim()) {
                valid = false;
                el.style.borderColor = 'red';
            } else {
                el.style.borderColor = '#ccc';
            }
        });
        const countryHidden = document.getElementById('country');
        if (!countryHidden || !countryHidden.value.trim()) {
            valid = false;
            const trigger = document.getElementById('country-trigger');
            if (trigger) trigger.style.borderColor = 'red';
        } else {
            const trigger = document.getElementById('country-trigger');
            if (trigger) trigger.style.borderColor = '#ccc';
        }

        if (!valid) {
            showErrorPopup('Please fill all required fields before finalizing the payment');
            return false;
        }
        return true;
    }

    function getPhoneCode(idd) {
        if (!idd?.root) return '';
        if (idd.suffixes?.length !== 1) return idd.root;
        return idd.root + idd.suffixes[0];
    }

    async function getCountryCode(countryName) {
        if (selectedCountryCCA2 && selectedCountryCCA2.length === 2) {
            return selectedCountryCCA2;
        }
        if (allCountries.length > 0) {
            const match = allCountries.find(c => c.name.common === countryName);
            if (match?.cca2) return match.cca2;
        }
        return 'US';
    }

    async function getShippingData() {
        const countryName = selectedCountryName || document.getElementById('country').value.trim();
        const countryCode = await getCountryCode(countryName);
        const phoneCode   = document.getElementById('phone-code').value.trim();
        const phoneNumber = document.getElementById('phone').value.trim();
        const fullPhone   = (phoneCode + phoneNumber).replace(/\s+/g, '');
        const address2El  = document.getElementById('address2') || document.getElementById('address-line2');

        // ── Détecte fulfillment depuis countries.json (déjà chargé dans allCountries) ──
        let fulfillment_method = 'eprolo'; // défaut
        if (allCountries.length > 0) {
            const countryEntry = allCountries.find(c => c.name.common === countryName);
            if (countryEntry && countryEntry.fulfillment) {
                fulfillment_method = countryEntry.fulfillment; // 'eprolo' ou 'cj'
            }
        }
        console.log(`[CHECKOUT] Country: ${countryName} → Fulfillment: ${fulfillment_method}`);

        return {
            firstName:          document.getElementById('first-name').value.trim(),
            lastName:           document.getElementById('last-name').value.trim(),
            email:              document.getElementById('email').value.trim(),
            phone:              fullPhone,
            country:            countryName,
            countryCode:        countryCode,
            city:               selectedCityName || document.getElementById('city').value.trim() || '',
            state:              (document.getElementById('state') || {}).value?.trim() || '',
            postalCode:         document.getElementById('postal-code').value.trim(),
            address:            document.getElementById('address').value.trim(),
            address2:           address2El ? address2El.value.trim() : '',
            shipping_method:    document.querySelector('.shipping-option.selected')?.dataset.method || 'Standard Shipping',
            fulfillment_method: fulfillment_method  // ← NOUVEAU
        };
    }

    function getDiscountedCart() {
        let workingCart = JSON.parse(JSON.stringify(cart));
        if (discountAmount > 0) {
            const preDiscountSubtotal = getSubtotal();
            const ratio = (preDiscountSubtotal - discountAmount) / preDiscountSubtotal;
            workingCart = workingCart.map(item => ({
                ...item,
                price: (Number(item.price) * ratio).toFixed(2)
            }));
        }
        return workingCart;
    }

    // ====================== PAYMENT ======================
    payButton.addEventListener('click', async () => {
    if (!validateForm()) return;
    if (!cart.length) {
        showErrorPopup('Your cart is empty. Please add some products before checking out.');
        return;
    }

    payButton.disabled = true;
    payButton.textContent = "Processing...";

    const pendingAffEmail = sessionStorage.getItem('pendingAffPromo');
    if (pendingAffEmail && appliedPromo && appliedPromo.isAffiliate) {
        try {
            await fetch('/.netlify/functions/save-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'aff-mark-promo-used', email: pendingAffEmail })
            });
        } catch(e) { console.warn('Could not mark promo as used:', e.message); }
        sessionStorage.removeItem('pendingAffPromo');
    }

    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

    try {
        const shippingData = await getShippingData();
        shippingData.affRef = window.getAffRef ? window.getAffRef() : (localStorage.getItem('aff_ref') || '');

        const discountedCart = getDiscountedCart();
        const selectedMethodPay = document.querySelector('.shipping-option.selected')?.dataset.method || 'Standard Shipping';
        const clientSubtotal = discountedCart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
        const clientTotal = parseFloat(document.getElementById('total').textContent.replace('$', '')) || clientSubtotal;

        // ── ÉTAPE 1 : Validation serveur + token ──
        const validationRes = await fetch('/.netlify/functions/validate-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'validate',
                cart: discountedCart,
                shipping: shippingData,
                shippingMethod: selectedMethodPay,
                clientTotal,
                promoCode: appliedPromo ? appliedPromo.code : null
            })
        });
        const validationData = await validationRes.json();
        if (!validationRes.ok || !validationData.success) {
            showErrorPopup(validationData.errors?.join('\n') || validationData.error || 'Validation failed. Please try again.');
            payButton.disabled = false;
            payButton.textContent = "Pay Now";
            return;
        }

        const { cartToken, sanitizedCart, shippingCost, taxAmount } = validationData;

        // ── ÉTAPE 2 : Vérification token avant paiement ──
        const verifyRes = await fetch('/.netlify/functions/validate-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'verify-token',
                cart: sanitizedCart,
                shippingMethod: selectedMethodPay,
                clientTotal,
                cartToken,
                promoCode: appliedPromo ? appliedPromo.code : null
            })
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
            showErrorPopup(verifyData.error || 'Cart integrity check failed. Please refresh and try again.');
            payButton.disabled = false;
            payButton.textContent = "Pay Now";
            return;
        }

        // ── ÉTAPE 3 : Paiement avec totaux serveur ──
        if (paymentMethod === 'stripe') {
            const STRIPE_PUBLIC_KEY = "pk_live_51PMDwoF9QAVBUyaU9ffneo6gWLCCPP94en6PPapDPawI9mnKqWBnJUjTbjUzjw3B8Et2ZWLBQHfCxm2djyCkzvXw00sP60H2NX";
            const stripe = Stripe(STRIPE_PUBLIC_KEY);
            const response = await fetch('/.netlify/functions/create-stripe-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cart: sanitizedCart,
                    shipping: shippingData,
                    cartToken,
                    promoCode: appliedPromo ? appliedPromo.code : null
                })
            });
            const data = await response.json();
            if (!response.ok || !data.sessionId) throw new Error(data.error || 'Stripe session failed');
            localStorage.setItem("pendingOrder", "stripe");
            await stripe.redirectToCheckout({ sessionId: data.sessionId });

        } else if (paymentMethod === 'paypal') {
            const response = await fetch('/.netlify/functions/paypal-create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cart: sanitizedCart,
                    shipping: shippingData,
                    shipping_cost: shippingCost.toFixed(2),
                    tax: taxAmount.toFixed(2),
                    cartToken,
                    promoCode: appliedPromo ? appliedPromo.code : null
                })
            });
            const data = await response.json();
            if (!response.ok || !data.orderID) throw new Error(data.error || 'PayPal order failed');
            const paypalDomain = data.paypalDomain || 'https://www.sandbox.paypal.com';
            localStorage.setItem("pendingOrder", "paypal");
            window.location.href = `${paypalDomain}/checkoutnow?token=${data.orderID}`;

        } else if (paymentMethod === 'nowpayments') {
            const response = await fetch('/.netlify/functions/nowpayments-create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cart:          sanitizedCart,
                    shipping:      shippingData,
                    shipping_cost: shippingCost.toFixed(2),
                    tax:           taxAmount.toFixed(2),
                    cartToken
                })
            });
            const data = await response.json();
            if (!response.ok || !data.invoiceUrl) {
                throw new Error(data.error || 'NOWPayments order failed');
            }
            localStorage.setItem('pendingOrder', 'nowpayments');
            window.location.href = data.invoiceUrl;
        }



    } catch (error) {
        console.error("Payment error:", error.message);
        showErrorPopup('Payment failed. Please try again.');
        payButton.disabled = false;
        payButton.textContent = "Pay Now";
    }
});

    // ====================== MODALS ======================
    const refundLink = document.getElementById('refund-policy-link');
    const shippingLink = document.getElementById('shipping-policy-link');
    const refundModal = document.getElementById('refund-modal');
    const shippingModal = document.getElementById('shipping-modal');
    const closes = document.querySelectorAll('.close');
    if (refundLink) refundLink.addEventListener('click', (e) => { e.preventDefault(); refundModal.style.display = 'flex'; });
    if (shippingLink) shippingLink.addEventListener('click', (e) => { e.preventDefault(); shippingModal.style.display = 'flex'; });
    closes.forEach(close => close.addEventListener('click', () => {
        if (refundModal) refundModal.style.display = 'none';
        if (shippingModal) shippingModal.style.display = 'none';
    }));
    window.addEventListener('click', (e) => {
        if (e.target === refundModal) refundModal.style.display = 'none';
        if (e.target === shippingModal) shippingModal.style.display = 'none';
    });

    // ====================== COUNTRY & CITY (CUSTOM SEARCHABLE SELECT) ======================

    let allCountries = [];
    let allCities = [];
    let selectedCountryName = '';
    let selectedCountryCode = '';
    let selectedCountryCCA2 = '';
    let selectedCityName = '';
    let countriesLoaded = false;

    function buildCustomSelect({ wrapperId, triggerId, displayId, dropdownId, searchId, listId, hiddenId, placeholder }) {
        const wrapper  = document.getElementById(wrapperId);
        const trigger  = document.getElementById(triggerId);
        const display  = document.getElementById(displayId);
        const dropdown = document.getElementById(dropdownId);
        const search   = document.getElementById(searchId);
        const list     = document.getElementById(listId);
        const hidden   = document.getElementById(hiddenId);
        if (!wrapper || !trigger || !display || !dropdown || !search || !list || !hidden) return;

        function openDropdown() {
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
                if (w.id !== wrapperId) w.classList.remove('open');
            });
            wrapper.classList.add('open');
            search.value = '';
            search.focus();
            filterList('');
        }

        function closeDropdown() {
            wrapper.classList.remove('open');
        }

        function filterList(query) {
            const q = query.toLowerCase().trim();
            const items = list.querySelectorAll('li:not(.no-results):not(.loading)');
            let visibleCount = 0;
            items.forEach(li => {
                const text = (li.dataset.label || '').toLowerCase();
                if (!q || text.includes(q)) {
                    li.style.display = '';
                    visibleCount++;
                } else {
                    li.style.display = 'none';
                }
            });
            const noResults = list.querySelector('.no-results');
            if (noResults) noResults.style.display = visibleCount === 0 ? '' : 'none';
        }

        trigger.addEventListener('click', () => {
            wrapper.classList.contains('open') ? closeDropdown() : openDropdown();
        });

        trigger.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); }
            if (e.key === 'Escape') closeDropdown();
        });

        search.addEventListener('input', () => filterList(search.value));
        search.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });

        document.addEventListener('click', e => {
            if (!wrapper.contains(e.target)) closeDropdown();
        });

        return { wrapper, trigger, display, dropdown, search, list, hidden, placeholder, closeDropdown };
    }

    // ── Country init ──
    const countryCtrl = buildCustomSelect({
        wrapperId:  'country-wrapper',
        triggerId:  'country-trigger',
        displayId:  'country-display',
        dropdownId: 'country-dropdown',
        searchId:   'country-search',
        listId:     'country-list',
        hiddenId:   'country',
        placeholder: 'Select your country'
    });

    // ── City init ──
    const cityCtrl = buildCustomSelect({
        wrapperId:  'city-wrapper',
        triggerId:  'city-trigger',
        displayId:  'city-display',
        dropdownId: 'city-dropdown',
        searchId:   'city-search',
        listId:     'city-list',
        hiddenId:   'city',
        placeholder: 'Select your city'
    });

    function populateCityList(cities, savedCity) {
        const list    = document.getElementById('city-list');
        const hidden  = document.getElementById('city');
        const display = document.getElementById('city-display');
        if (!list) return;
        list.innerHTML = '';

        const noItem = document.createElement('li');
        noItem.className = 'no-results';
        noItem.textContent = 'No cities found';
        noItem.style.display = 'none';
        list.appendChild(noItem);

        cities.forEach(city => {
            const li = document.createElement('li');
            li.dataset.label = city;
            li.dataset.value = city;
            li.textContent = city;
            li.addEventListener('click', () => {
                selectedCityName = city;
                hidden.value = city;
                display.textContent = city;
                display.classList.remove('placeholder');
                list.querySelectorAll('li').forEach(i => i.classList.remove('selected'));
                li.classList.add('selected');
                if (cityCtrl) cityCtrl.closeDropdown();
            });
            list.appendChild(li);
        });

        if (savedCity) {
            const match = cities.find(c => c === savedCity);
            if (match) {
                hidden.value = match;
                display.textContent = match;
                display.classList.remove('placeholder');
                selectedCityName = match;
            }
        }
        allCities = cities;
    }

    async function loadCitiesForCountry(countryName, savedCity) {
        const list    = document.getElementById('city-list');
        const display = document.getElementById('city-display');
        const hidden  = document.getElementById('city');
        if (!list) return;

        list.innerHTML = '<li class="loading">Loading cities...</li>';
        if (display) { display.textContent = 'Select your city'; display.classList.add('placeholder'); }
        if (hidden)  hidden.value = '';
        selectedCityName = '';

        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: countryName })
            });
            const data = await res.json();
            const cities = (data.data && data.data.length) ? data.data : [];
            populateCityList(cities, savedCity);
            if (!cities.length) {
                list.innerHTML = '<li class="no-results">No cities found</li>';
            }
        } catch (err) {
            console.error('City load error', err);
            list.innerHTML = '<li class="no-results">No cities found</li>';
        }
    }

    // ====================== LOAD COUNTRIES FROM LOCAL FILE ONLY ======================
    async function loadCountries() {
        if (countriesLoaded) return;
        countriesLoaded = true;

        const list           = document.getElementById('country-list');
        const hidden         = document.getElementById('country');
        const display        = document.getElementById('country-display');
        const phoneCodeInput = document.getElementById('phone-code');
        if (!list) return;

        list.innerHTML = '<li class="loading">Loading countries...</li>';

        let data = null;

        try {
            const res = await fetch('/countries.json');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            data = await res.json();
        } catch (err) {
            countriesLoaded = false;
            console.error('Failed to load countries.json:', err);
            list.innerHTML = '<li class="no-results">Failed to load countries — please refresh</li>';
            return;
        }

        allCountries = data.sort((a, b) => a.name.common.localeCompare(b.name.common));

        list.innerHTML = '';
        const noItem = document.createElement('li');
        noItem.className = 'no-results';
        noItem.textContent = 'No results';
        noItem.style.display = 'none';
        list.appendChild(noItem);

        allCountries.forEach(country => {
            const name = country.name.common;
            const code = getPhoneCode(country.idd);
            const cca2 = country.cca2;

            const li = document.createElement('li');
            li.dataset.label = name;
            li.dataset.value = name;
            li.dataset.code  = code;
            li.dataset.cca2  = cca2;
            li.textContent   = name;

            li.addEventListener('click', () => {
                selectedCountryName = name;
                selectedCountryCode = code;
                selectedCountryCCA2 = cca2;

                hidden.value = name;
                display.textContent = name;
                display.classList.remove('placeholder');
                if (phoneCodeInput) phoneCodeInput.value = code;

                list.querySelectorAll('li').forEach(i => i.classList.remove('selected'));
                li.classList.add('selected');
                if (countryCtrl) countryCtrl.closeDropdown();

                const savedCity = localStorage.getItem('isLoggedIn') === 'true' ? localStorage.getItem('userCity') || '' : '';
                loadCitiesForCountry(name, savedCity);
            });

            list.appendChild(li);
        });

        const savedCountry = localStorage.getItem('isLoggedIn') === 'true' ? localStorage.getItem('userCountry') || '' : '';
        if (savedCountry) {
            const match = allCountries.find(c => c.name.common === savedCountry);
            if (match) {
                const name = match.name.common;
                const code = getPhoneCode(match.idd);
                selectedCountryName = name;
                selectedCountryCode = code;
                selectedCountryCCA2 = match.cca2;
                hidden.value = name;
                display.textContent = name;
                display.classList.remove('placeholder');
                if (phoneCodeInput) phoneCodeInput.value = code;
                const savedCity = localStorage.getItem('userCity') || '';
                loadCitiesForCountry(name, savedCity);
            }
        }
    }
    // ====================== END LOAD COUNTRIES ======================

    loadCountries();

    const shippingOptions = document.querySelectorAll('.shipping-option');
    shippingOptions.forEach(option => {
        option.addEventListener('click', () => {
            shippingOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            updateTotals();
        });
    });

    // ====================== PROMO ======================
    function updatePromoDisplay() {
        const hasBundle = cart.some(item => item.fromBundle);
        const settings = productsData.find(i => i.type === 'settings');
        const cd = settings?.cart_drawer || {};
        const countFreeForPromo = (cd.promo_count_free_items || 'No').toLowerCase() === 'yes';
        const totalQuantity = countFreeForPromo
            ? cart.reduce((sum, item) => sum + item.quantity, 0)
            : cart.filter(i => !i.isFreePromo).reduce((sum, item) => sum + item.quantity, 0);
        const suggested = promos.find(p => p.items === totalQuantity);
        const suggestedDiv = document.getElementById('suggested-promo');
        const suggestedCodeEl = document.getElementById('suggested-code');
        const itemCountDisplay = document.getElementById('item-count-display');
        const promoMessage = document.getElementById('promo-message');
        if (suggestedDiv && suggestedCodeEl && itemCountDisplay) {
            itemCountDisplay.textContent = totalQuantity;
            if (!hasBundle && suggested) {
                suggestedDiv.style.display = 'block';
                suggestedCodeEl.textContent = suggested.code;
            } else {
                suggestedDiv.style.display = 'none';
            }
        }
        const hasFreePromo = cart.some(item => item.isFreePromo);
        if (promoMessage) {
            if (hasBundle) {
                promoMessage.textContent = "Promo codes are not available with bundle purchases.";
                promoMessage.style.color = 'red';
            } else if (hasFreePromo) {
                promoMessage.textContent = "Promo codes are not available with free promotional items.";
                promoMessage.style.color = 'red';
            } else {
                promoMessage.textContent = '';
            }
        }
    }

    function getSubtotal() {
        return cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    }

    // Une fois le seuil de livraison gratuite atteint, le code promo ne peut
    // plus être combiné : on masque le champ de saisie (au lieu de juste
    // bloquer au clic) et on efface toute réduction déjà appliquée, pour que
    // la livraison gratuite et un code promo ne se cumulent jamais.
    let _wasFreeByThreshold = false;
    function updateFreeShippingPromoLock(isFreeByThreshold) {
        const promoTitle      = document.getElementById('promo-title');
        const suggestedPromo  = document.getElementById('suggested-promo');
        const promoInputGroup = document.querySelector('.promo-input-group');
        const promoMessage    = document.getElementById('promo-message');
        const freeShipMsg     = document.getElementById('free-shipping-unlocked-message');

        if (isFreeByThreshold) {
            if (promoTitle)      promoTitle.style.display = 'none';
            if (suggestedPromo)  suggestedPromo.style.display = 'none';
            if (promoInputGroup) promoInputGroup.style.display = 'none';
            if (promoMessage)    { promoMessage.textContent = ''; promoMessage.style.display = 'none'; }
            if (freeShipMsg) {
                freeShipMsg.style.display = 'block';
                freeShipMsg.innerHTML = `✨ <strong>Free Shipping Unlocked!</strong> Your order already qualifies for free shipping, so promo codes can't be stacked on top of this offer — but every stitch of savings is already working in your favor, Queen.`;
            }
            if (appliedPromo || discountAmount > 0 || affPromoApplied) {
                appliedPromo    = null;
                discountAmount  = 0;
                affPromoApplied = false;
            }
        } else {
            if (promoTitle)      promoTitle.style.display = '';
            if (promoInputGroup) promoInputGroup.style.display = '';
            if (promoMessage)    promoMessage.style.display = '';
            if (freeShipMsg)     freeShipMsg.style.display = 'none';
            // #suggested-promo a sa propre logique dans updatePromoDisplay() —
            // on la relance ici pour qu'elle reprenne la main correctement
            // au lieu de deviner nous-mêmes son état.
            if (_wasFreeByThreshold && typeof updatePromoDisplay === 'function') updatePromoDisplay();
        }
        _wasFreeByThreshold = isFreeByThreshold;
    }

    function updateTotals() {
        const subtotal = getSubtotal();
        const selectedMethod = document.querySelector('.shipping-option.selected')?.dataset.method || '';
        const freeShipThresh = (() => {
            const s = productsData.find(i => i.type === 'settings');
            return s?.cart_drawer?.free_shipping_threshold || 0;
        })();
        const isFreeByThreshold = freeShipThresh > 0 && subtotal >= freeShipThresh;
        updateFreeShippingPromoLock(isFreeByThreshold);
        const isFreeMethod = ['Standard Shipping', 'Economy Shipping'].includes(selectedMethod);
        const effectiveShipping = (isFreeByThreshold || isFreeMethod) ? 0 : SHIPPING_COST;
        const effectiveTax = (isFreeByThreshold || isFreeMethod) ? 0 : subtotal * TAX_RATE;
        let affPromoDiscountAmount = 0;
        if (affPromoApplied && affPromoDiscount > 0) {
            affPromoDiscountAmount = subtotal * (affPromoDiscount / 100);
            const discountLine = document.getElementById('promo-line');
            const discountEl   = document.getElementById('discount-amount');
            if (discountLine) discountLine.style.display = 'block';
            if (discountEl)   discountEl.textContent = `-$${(discountAmount + affPromoDiscountAmount).toFixed(2)} (-${affPromoDiscount}%)`;
        }
        const finalTotal = subtotal + effectiveTax + effectiveShipping - discountAmount - affPromoDiscountAmount;
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('taxes').textContent = `$${effectiveTax.toFixed(2)}`;
        const taxLabel = document.getElementById('tax-rate-label');
        if (taxLabel) taxLabel.textContent = (isFreeByThreshold || isFreeMethod)
            ? 0
            : (TAX_RATE * 100).toFixed(TAX_RATE * 100 % 1 === 0 ? 0 : 1);
        document.getElementById('shipping').textContent = effectiveShipping === 0 ? 'FREE' : `$${effectiveShipping.toFixed(2)}`;
        document.getElementById('total').textContent = `$${Math.max(0, finalTotal).toFixed(2)}`;
        const promoLine  = document.getElementById('promo-line');
        const discountEl = document.getElementById('discount-amount');
        const totalDiscount = discountAmount + affPromoDiscountAmount;
        if (totalDiscount > 0) {
            if (promoLine)  promoLine.style.display = 'block';
            if (discountEl) discountEl.textContent  = `-$${totalDiscount.toFixed(2)}`;
        } else {
            if (promoLine) promoLine.style.display = 'none';
        }
        const togglePreview = document.getElementById('toggle-total-preview');
        if (togglePreview) togglePreview.textContent = `$${Math.max(0, finalTotal).toFixed(2)}`;
    }

    function applyPromoFreeItems() {
        const settings = productsData.find(i => i.type === 'settings');
        if (!settings) return;
        const cd = settings.cart_drawer || {};

        const showPromo = (cd.show_promo_message || 'Yes').toLowerCase() === 'yes';
        if (!showPromo) {
            cart = cart.filter(i => !i.isFreePromo);
            applyUpsellDiscount();
            localStorage.setItem('cart', JSON.stringify(cart));
            return;
        }
        const buyQty = parseInt(cd.promo_buy_quantity) || 0;
        const getQty = parseInt(cd.promo_get_quantity)  || 0;
        if (!buyQty || !getQty) return;

        const realProducts = productsData.filter(p => !p.type && p.active !== false);

        const freeIds = Array.isArray(cd.promo_free_product_ids) && cd.promo_free_product_ids.length > 0
            ? cd.promo_free_product_ids
            : null;

        const paidQty = cart.filter(i => !i.isFreePromo).reduce((sum, i) => sum + i.quantity, 0);
        cart = cart.filter(i => !i.isFreePromo);

        if (paidQty >= buyQty) {
            for (let idx = 0; idx < getQty; idx++) {
                let prod;
                if (freeIds) {
                    const targetId = freeIds[idx];
                    if (!targetId) break;
                    prod = realProducts.find(p => p.id === targetId);
                } else {
                    prod = realProducts[idx];
                }
                if (!prod) break;

                const firstVariant = (prod.variants && prod.variants.length > 0)
                    ? prod.variants[0]
                    : null;

                const color = firstVariant ? (firstVariant.color || null) : null;
                const size  = firstVariant ? (firstVariant.size  || null) : null;

                const colorObj = (color && prod.colors)
                    ? prod.colors.find(c => c.name === color)
                    : null;
                const image = colorObj
                    ? (colorObj.image || prod.image)
                    : prod.image;

                cart.push({
                    id:            prod.id,
                    title:         prod.title,
                    price:         0,
                    compare_price: firstVariant ? firstVariant.price : prod.price,
                    image:         image || prod.image,
                    size:          size  || null,
                    color:         color || null,
                    quantity:      1,
                    isFreePromo:   true,
                    cj_product_id: prod.cj_id,
                    cj_variant_id: firstVariant ? firstVariant.vid : null
                });
            }
        }

        localStorage.setItem('cart', JSON.stringify(cart));
    }

    // ====================== UPSELL DISCOUNT AUTO-APPLY ======================
    function applyUpsellDiscount() {
        upsellDiscountAmount  = 0;
        upsellDiscountApplied = false;

        const settings  = productsData.find(i => i.type === 'settings');
        const upsellCfg = (settings?.product_upsell) || {};
        const autoApply = (upsellCfg.auto_apply_to_checkout || 'no').toLowerCase() === 'yes';

        if (!autoApply) { renderUpsellDiscountLine(); return; }

        const hasFreePromo = cart.some(i => i.isFreePromo);
        const hasPromoCode = appliedPromo !== null && discountAmount > 0;

        if (hasFreePromo || hasPromoCode) { renderUpsellDiscountLine(); return; }

        cart.forEach(function(item) {
            if (!item.fromUpsell || !item.upsellDiscount) return;

            var discountPct = parseFloat(item.upsellDiscount) || 0;
            if (discountPct <= 0) return;

            var currentPrice  = parseFloat(item.price) || 0;
            var originalPrice = currentPrice / (1 - discountPct / 100);

            var saving = (originalPrice - currentPrice) * item.quantity;
            upsellDiscountAmount += saving;
            upsellDiscountApplied = true;
        });

        renderUpsellDiscountLine();
    }
    // ====================== END UPSELL DISCOUNT ======================

    function renderUpsellDiscountLine() {
        let line = document.getElementById('upsell-discount-line');

        if (upsellDiscountAmount > 0 && upsellDiscountApplied) {
            if (!line) {
                const promoLine   = document.getElementById('promo-line');
                const totalRow    = document.getElementById('total')?.closest('.total-row, .order-row, p, div');

                line = document.createElement('div');
                line.id = 'upsell-discount-line';
                line.style.cssText = 'display:flex;justify-content:space-between;color:#22a06b;font-size:0.88rem;margin:4px 0;font-weight:600;';
                line.innerHTML = `
                    <span>🎁 Kit Discount Applied</span>
                    <span id="upsell-discount-amount">-$${upsellDiscountAmount.toFixed(2)}</span>`;

                if (promoLine && promoLine.parentNode) {
                    promoLine.parentNode.insertBefore(line, promoLine.nextSibling);
                } else if (totalRow && totalRow.parentNode) {
                    totalRow.parentNode.insertBefore(line, totalRow);
                }
            } else {
                line.style.display = 'flex';
                const amountEl = document.getElementById('upsell-discount-amount');
                if (amountEl) amountEl.textContent = `-$${upsellDiscountAmount.toFixed(2)}`;
            }
        } else {
            if (line) line.style.display = 'none';
        }
    }
    // ====================== END UPSELL DISCOUNT ======================

    document.getElementById('copy-suggested')?.addEventListener('click', () => {
        const code = document.getElementById('suggested-code').textContent;
        navigator.clipboard.writeText(code).then(() => showSuccessPopup('Promo code copied successfully!'));
    });

    document.getElementById('apply-promo')?.addEventListener('click', async () => {
    const input       = document.getElementById('promo-input').value.trim().toUpperCase();
    const promoMessage = document.getElementById('promo-message');
    const hasBundle   = cart.some(item => item.fromBundle);
    const settings    = productsData.find(i => i.type === 'settings');
    const cd          = settings?.cart_drawer || {};
    const affCfg      = settings?.affiliation || {};

    // ── Garde : aucun code promo ne peut être combiné avec la livraison
    //    gratuite une fois le seuil atteint (le champ est normalement déjà
    //    masqué à ce stade — ceci protège aussi contre un état obsolète) ──
    const freeShipThreshGuard = parseFloat(cd.free_shipping_threshold) || 0;
    if (freeShipThreshGuard > 0 && getSubtotal() >= freeShipThreshGuard) {
        promoMessage.textContent = "This code cannot be combined with free shipping.";
        promoMessage.style.color = 'red';
        return;
    }

    // ── Récupère la config birthday depuis les settings ──
    const birthdayCfg      = settings?.birthday_gift || {};
    const birthdayCode     = (birthdayCfg.promo_code || '').toUpperCase().trim();
    const birthdayDiscount = parseFloat(
      (birthdayCfg.promo_discount || '0').toString().replace('%', '').trim()
    ) || 0;

    const countFreeForPromo = (cd.promo_count_free_items || 'No').toLowerCase() === 'yes';
    const totalQuantity = countFreeForPromo
        ? cart.reduce((sum, item) => sum + item.quantity, 0)
        : cart.filter(i => !i.isFreePromo).reduce((sum, item) => sum + item.quantity, 0);
    const hasFreePromo = cart.some(item => item.isFreePromo);
    const hasUpsell    = cart.some(i => i.fromUpsell);

    if (!input) { promoMessage.textContent = "Please enter a promo code."; promoMessage.style.color = 'red'; return; }

    // ── Lire allow_combine depuis les settings birthday ──
    const birthdayAllowCombine = (birthdayCfg.allow_combine || 'no').toLowerCase().trim() === 'yes';
    const isBirthdayCode       = birthdayCode && input === birthdayCode;

    // Gardes de combinaison — ignorées pour le code birthday si allow_combine = yes
    if (hasBundle    && !(isBirthdayCode && birthdayAllowCombine)) {
        promoMessage.textContent = "Promo codes cannot be used with bundles.";
        promoMessage.style.color = 'red'; return;
    }
    if (hasUpsell    && !(isBirthdayCode && birthdayAllowCombine)) {
        promoMessage.textContent = "Promo codes cannot be combined with Kit discounts.";
        promoMessage.style.color = 'red'; return;
    }
    if (hasFreePromo && !(isBirthdayCode && birthdayAllowCombine)) {
        promoMessage.textContent = "Promo codes cannot be used with free promotional items.";
        promoMessage.style.color = 'red'; return;
    }
    // ══════════════════════════════════════════════════════
    //  CODE BIRTHDAY — vérification 3 conditions obligatoires
    // ══════════════════════════════════════════════════════
    if (birthdayCode && input === birthdayCode) {
        const isLoggedIn  = localStorage.getItem('isLoggedIn') === 'true';
        const userEmail   = localStorage.getItem('userEmail') || '';

        if (!isLoggedIn || !userEmail) {
            promoMessage.innerHTML = `
                <span style="display:flex;align-items:flex-start;gap:8px;line-height:1.5">
                  <span style="font-size:1.1em">🔐</span>
                  <span>
                    <strong>Account required</strong><br>
                    Please <a href="/account.html" style="color:inherit;text-decoration:underline">log in to your account</a>
                    to use this exclusive birthday code.
                  </span>
                </span>`;
            promoMessage.style.color = '#c0385e';
            return;
        }

        // Feedback visuel pendant la vérification
        promoMessage.textContent = '🎂 Checking your birthday eligibility...';
        promoMessage.style.color = '#888';

        try {
            const res  = await fetch('/.netlify/functions/save-account', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    action: 'check-birthday-promo-eligibility',
                    email:  userEmail,
                    token:  localStorage.getItem('userAccountToken') || ''
                })
            });
            const data = await res.json();

            if (!data.success) {
                const errorMessages = {
                    NOT_LOGGED_IN:  {
                        icon: '🔐',
                        title: 'Account required',
                        body: `Please <a href="/account.html" style="color:inherit;text-decoration:underline">log in</a> to use this birthday code.`
                    },
                    USER_NOT_FOUND: {
                        icon: '❌',
                        title: 'Account not found',
                        body: 'We could not find your account. Please contact our support team.'
                    },
                    NOT_SUBSCRIBED: {
                        icon: '💌',
                        title: 'Newsletter subscription required',
                        body: `This exclusive code is reserved for our subscribers. Please
                               <a href="#newsletter-form" style="color:inherit;text-decoration:underline">subscribe to our newsletter</a>
                               first, then come back to use your birthday gift!`
                    },
                    NO_BIRTHDAY: {
                        icon: '🎂',
                        title: 'Birthday date missing',
                        body: `We need your birthday to unlock this gift!
                               Please add it in <a href="/account.html" style="color:inherit;text-decoration:underline">your account settings</a>
                               and come back — we'll keep your special code waiting. 🎁`
                    }
                };

                const reason = data.reason || 'USER_NOT_FOUND';
                const msg    = errorMessages[reason] || errorMessages['USER_NOT_FOUND'];

                promoMessage.innerHTML = `
                    <span style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:rgba(192,56,94,0.07);border:1px solid rgba(192,56,94,0.2);border-radius:10px;line-height:1.6">
                      <span style="font-size:1.3em;flex-shrink:0">${msg.icon}</span>
                      <span>
                        <strong style="display:block;margin-bottom:3px;color:#c0385e">${msg.title}</strong>
                        <span style="font-size:0.88em">${msg.body}</span>
                      </span>
                    </span>`;
                promoMessage.style.color = '';
                return;
            }

            // Vérification réussie — toutes les 3 conditions OK
            if (birthdayDiscount > 0) {
                appliedPromo = {
                    code:           input,
                    percent:        birthdayDiscount,
                    isBirthday:     true,
                    allowCombine:   birthdayAllowCombine
                };
                const baseForDiscount = birthdayAllowCombine
                    ? cart.filter(i => !i.isFreePromo).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
                    : getSubtotal();

                discountAmount = baseForDiscount * (birthdayDiscount / 100);

                promoMessage.innerHTML = `
                    <span style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(34,160,107,0.08);border:1px solid rgba(34,160,107,0.25);border-radius:10px">
                      <span style="font-size:1.2em">🎂</span>
                      <span style="color:#166534;font-weight:600">
                        Happy Birthday! Your exclusive ${birthdayDiscount}% birthday discount has been applied! 🎉
                      </span>
                    </span>`;
                promoMessage.style.color = '';
                updateTotals();
            } else {
                promoMessage.textContent = 'Birthday code recognized but no discount is configured. Please contact support.';
                promoMessage.style.color = 'orange';
            }

        } catch (err) {
            console.error('[BirthdayPromo] Error:', err);
            promoMessage.textContent = 'Network error while verifying your birthday code. Please try again.';
            promoMessage.style.color = 'red';
        }
        return;
    }

    // ══════════════════════════════════════════════════════
    //  CODE AFFILIÉ
    // ══════════════════════════════════════════════════════
    const affPrefix = (affCfg.promo_code_prefix || '').toUpperCase();
    if (affPrefix && (input === affPrefix || input.startsWith(affPrefix + '-'))) {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const userEmail  = localStorage.getItem('userEmail') || '';
        if (!isLoggedIn || !userEmail) {
            promoMessage.textContent = "You must be logged in to use this affiliate promo code.";
            promoMessage.style.color = 'red';
            return;
        }

        promoMessage.textContent = "Checking eligibility...";
        promoMessage.style.color = '#888';

        try {
            const check = await window.bbwValidateAffPromoCode(input);
            if (!check || !check.valid) {
                promoMessage.textContent = "This promo code has already been used or is invalid.";
                promoMessage.style.color = 'red';
                return;
            }

            const discountPct    = check.discountPct || 0;
            const freeShipThresh = parseFloat(cd.free_shipping_threshold) || 0;
            const subtotal       = getSubtotal();
            if (freeShipThresh > 0 && subtotal >= freeShipThresh) {
                promoMessage.textContent = "This code cannot be combined with free shipping.";
                promoMessage.style.color = 'red';
                return;
            }

            appliedPromo   = { code: input, percent: discountPct, isAffiliate: true };
            discountAmount = subtotal * (discountPct / 100);
            promoMessage.textContent = `Affiliate code applied: ${discountPct}% off!`;
            promoMessage.style.color = 'green';
            sessionStorage.setItem('pendingAffPromo', userEmail);
            updateTotals();
            return;

        } catch (err) {
            promoMessage.textContent = "Error verifying affiliate code. Please try again.";
            promoMessage.style.color = 'red';
            return;
        }
    }

    // ══════════════════════════════════════════════════════
    //  CODES CLASSIQUES (basés sur quantité)
    // ══════════════════════════════════════════════════════
    const promo = promos.find(p => p.code.toUpperCase() === input);
    if (promo && promo.items === totalQuantity) {
        appliedPromo   = promo;
        discountAmount = getSubtotal() * (promo.percent / 100);
        promoMessage.textContent = `Promo applied: ${promo.percent}% off!`;
        promoMessage.style.color = 'green';
        updateTotals();
    } else {
        appliedPromo   = null;
        discountAmount = 0;
        promoMessage.textContent = "Invalid or inapplicable promo code.";
        promoMessage.style.color = 'red';
        updateTotals();
    }
});

    // ── Remove affiliate code if PayPal is selected ──
    paymentOptions.forEach(function (radio) {
        radio.addEventListener('change', function () {
            if (!affPromoApplied) return;
            if (this.value === 'paypal') {
                affPromoApplied  = false;
                affPromoCode     = null;
                affPromoDiscount = 0;
                localStorage.removeItem('bbw_aff_promo_code');
                localStorage.removeItem('bbw_aff_promo_discount');
                const promoMsg = document.getElementById('promo-message');
                if (promoMsg) {
                    promoMsg.textContent = 'Promo code removed — not compatible with PayPal.';
                    promoMsg.style.color = '#f59e0b';
                }
                const promoInput = document.getElementById('promo-input');
                if (promoInput) promoInput.value = '';
                updateTotals();
            }
        });
    });

});