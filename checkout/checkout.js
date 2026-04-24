// checkout.js
document.addEventListener('DOMContentLoaded', () => {
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


    // ====================== POPUP ======================
    function showErrorPopup(message) {
        const popup = document.getElementById('error-popup');
        const popupText = document.getElementById('popup-message');
        const closeBtn = document.getElementById('popup-close');
        if (!popup || !popupText || !closeBtn) { console.error("Popup HTML manquant !"); return; }
        popupText.textContent = message;
        popup.classList.add('show');
        closeBtn.onclick = () => popup.classList.remove('show');
        setTimeout(() => { if (popup.classList.contains('show')) popup.classList.remove('show'); }, 10000);
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

          // ══ INJECT CONTACT EMAILS FROM SETTINGS ══
      (function injectContactEmails() {
        const emails = settings.contact_emails || {};
        if (!Object.keys(emails).length) return;

        document.querySelectorAll('[data-email-key]').forEach(el => {
          const key   = el.dataset.emailKey;
          const email = emails[key];
          if (!email) return;

          // Bouton CTA spécial — on met juste le href, on garde le texte du bouton
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

        }
        applyPromoFreeItems(); 
        // ══ COLLAPSIBLE ORDER SUMMARY ══
        (function initCollapsibleOrderSummary() {
        const setting = (settings?.collapsible_order_summary || 'No').trim().toLowerCase();
        if (setting !== 'yes') return;

        const section = document.querySelector('.order-summary');
        const toggle  = document.getElementById('order-summary-toggle');
        if (!section || !toggle) return;

        section.classList.add('collapsible'); // fermé par défaut

        toggle.addEventListener('click', () => {
            const isOpen = section.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen);
        });
        })();
        renderCart();
      })
      .catch(error => {
        console.error('Erreur de chargement de /products.data.json:', error);
        renderCart();
      });

    // ====================== PRÉ-REMPLISSAGE COMPTE ======================
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
            payButton.textContent = option.value === 'stripe' ? 'Pay with Card' : 'Pay with PayPal';
        });
    });

    // ====================== VALIDATION FORM ======================
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

    // ====================== FIX 1 : getPhoneCode ======================
    // Certains pays (USA, Canada, Russie...) ont plusieurs suffixes IDD.
    // L'ancien code prenait toujours suffixes[0], donnant +1201, +1202...
    // On ne concatène le suffixe QUE si le pays en a exactement un.
    function getPhoneCode(idd) {
        if (!idd?.root) return '';
        if (idd.suffixes?.length !== 1) return idd.root;
        return idd.root + idd.suffixes[0];
    }

    // ====================== FIX 2 : getCountryCode (accolade manquante corrigée) ======================
    async function getCountryCode(countryName) {
        // Priorité 1 : CCA2 déjà résolu lors de la sélection du pays
        if (selectedCountryCCA2 && selectedCountryCCA2.length === 2) {
            return selectedCountryCCA2;
        }
        // Priorité 2 : chercher dans la liste déjà en mémoire (sans appel réseau)
        if (allCountries.length > 0) {
            const match = allCountries.find(c => c.name.common === countryName);
            if (match?.cca2) return match.cca2;
        }
        // Fallback : appel API
        try {
            const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fields=cca2&fullText=true`);
            if (res.ok) {
                const d = await res.json();
                return d[0]?.cca2 || 'US';
            }
        } catch(e) {
            console.warn('getCountryCode fallback failed:', e);
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

        return {
            firstName:       document.getElementById('first-name').value.trim(),
            lastName:        document.getElementById('last-name').value.trim(),
            email:           document.getElementById('email').value.trim(),
            phone:           fullPhone,
            country:         countryName,
            countryCode:     countryCode,
            city:            selectedCityName || document.getElementById('city').value.trim() || '',
            state:           (document.getElementById('state') || {}).value?.trim() || '',
            postalCode:      document.getElementById('postal-code').value.trim(),
            address:         document.getElementById('address').value.trim(),
            address2:        address2El ? address2El.value.trim() : '',
            shipping_method: document.querySelector('.shipping-option.selected')?.dataset.method || 'Standard Shipping',
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

    // ====================== PAIEMENT ======================
    payButton.addEventListener('click', async () => {
        if (!validateForm()) return;
        if (!cart.length) {
            showErrorPopup('Your cart is empty. Please add some products before checking out.');
            return;
        }

        payButton.disabled = true;
        payButton.textContent = "Processing...";

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

        try {
            const shippingData = await getShippingData();
            const discountedCart = getDiscountedCart();
            const discountedSubtotal = discountedCart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
            const selectedMethodPay = document.querySelector('.shipping-option.selected')?.dataset.method || '';
            const freeThreshPay = (() => { const s = productsData.find(i => i.type === 'settings'); return s?.cart_drawer?.free_shipping_threshold || 0; })();
            const isFreePayMethod = ['Standard Shipping', 'Economy Shipping'].includes(selectedMethodPay);
            const isFreePayThresh = freeThreshPay > 0 && discountedSubtotal >= freeThreshPay;
            const taxes = (isFreePayMethod || isFreePayThresh) ? 0 : discountedSubtotal * TAX_RATE;
            const effectiveShippingPay = (isFreePayMethod || isFreePayThresh) ? 0 : SHIPPING_COST;

            if (paymentMethod === 'stripe') {
                const STRIPE_PUBLIC_KEY = "pk_test_51PMDwoF9QAVBUyaUqwc7ekbAhyZdI9oA3ubZT8b7TtWGrykoPLvsql4mexEwEoS5pggyssqN6jpj2w5VQMHOSftf00q97Rbt1f";
                const stripe = Stripe(STRIPE_PUBLIC_KEY);
                const response = await fetch('/.netlify/functions/create-stripe-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cart: discountedCart,
                        shipping: shippingData,
                        shipping_cost: effectiveShippingPay.toFixed(2),
                        tax: taxes.toFixed(2)
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.sessionId) throw new Error(data.error || 'Stripe session failed');
                localStorage.setItem("pendingOrder", "stripe");
                await stripe.redirectToCheckout({ sessionId: data.sessionId });

            } else {
                const response = await fetch('/.netlify/functions/paypal-create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cart: discountedCart,
                        shipping: shippingData,
                        shipping_cost: effectiveShippingPay.toFixed(2),
                        tax: taxes.toFixed(2)
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.orderID) throw new Error(data.error || 'PayPal order failed');
                const paypalDomain = data.paypalDomain || 'https://www.sandbox.paypal.com';
                localStorage.setItem("pendingOrder", "paypal");
                window.location.href = `${paypalDomain}/checkoutnow?token=${data.orderID}`;
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

    // ====================== PAYS & VILLES (CUSTOM SEARCHABLE SELECT) ======================

    let allCountries = [];
    let allCities = [];
    let selectedCountryName = '';
    let selectedCountryCode = '';
    let selectedCountryCCA2 = '';
    let selectedCityName = '';

    // ====================== FIX 3 : flag pour éviter double chargement ======================
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

    // ── Initialisation Country ──
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

    // ── Initialisation City ──
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

        list.innerHTML = '<li class="loading">Loading cities…</li>';
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

    async function loadCountries() {
        // FIX : on ne charge les pays qu'une seule fois
        if (countriesLoaded) return;
        countriesLoaded = true;

        const list           = document.getElementById('country-list');
        const hidden         = document.getElementById('country');
        const display        = document.getElementById('country-display');
        const phoneCodeInput = document.getElementById('phone-code');
        if (!list) return;

        list.innerHTML = '<li class="loading">Loading countries…</li>';

        try {
            const res  = await fetch('https://restcountries.com/v3.1/all?fields=name,idd,cca2');
            const data = await res.json();
            allCountries = data.sort((a, b) => a.name.common.localeCompare(b.name.common));

            list.innerHTML = '';
            const noItem = document.createElement('li');
            noItem.className = 'no-results';
            noItem.textContent = 'No results';
            noItem.style.display = 'none';
            list.appendChild(noItem);

            allCountries.forEach(country => {
                const name = country.name.common;
                // FIX : utilisation de getPhoneCode() pour éviter +1201, +1202...
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

            // Pré-sélectionne si utilisateur connecté
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

        } catch (err) {
            countriesLoaded = false; // permet retry si réseau fail
            console.error('Country load error', err);
            list.innerHTML = '<li class="no-results">Failed to load countries</li>';
        }
    }

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

    function updateTotals() {
        const subtotal = getSubtotal();
        const selectedMethod = document.querySelector('.shipping-option.selected')?.dataset.method || '';
        const freeShipThresh = (() => {
            const s = productsData.find(i => i.type === 'settings');
            return s?.cart_drawer?.free_shipping_threshold || 0;
        })();
        const isFreeByThreshold = freeShipThresh > 0 && subtotal >= freeShipThresh;
        const isFreeMethod = ['Standard Shipping', 'Economy Shipping'].includes(selectedMethod);
        const effectiveShipping = (isFreeByThreshold || isFreeMethod) ? 0 : SHIPPING_COST;
        const effectiveTax = (isFreeByThreshold || isFreeMethod) ? 0 : subtotal * TAX_RATE;
        const finalTotal = subtotal + effectiveTax + effectiveShipping - discountAmount;
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('taxes').textContent = `$${effectiveTax.toFixed(2)}`;
        const taxLabel = document.getElementById('tax-rate-label');
        if (taxLabel) taxLabel.textContent = (isFreeByThreshold || isFreeMethod)
            ? 0
            : (TAX_RATE * 100).toFixed(TAX_RATE * 100 % 1 === 0 ? 0 : 1);
        document.getElementById('shipping').textContent = effectiveShipping === 0 ? 'FREE' : `$${effectiveShipping.toFixed(2)}`;
        document.getElementById('total').textContent = `$${Math.max(0, finalTotal).toFixed(2)}`;
        const promoLine = document.getElementById('promo-line');
        const discountEl = document.getElementById('discount-amount');
        if (discountAmount > 0) {
            if (promoLine) promoLine.style.display = 'block';
            if (discountEl) discountEl.textContent = `-$${discountAmount.toFixed(2)}`;
        } else {
            if (promoLine) promoLine.style.display = 'none';
        }
        // Mise à jour du preview dans le toggle collapsible
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

        // discountPct vient directement du setting sauvegardé dans l'item
        var discountPct = parseFloat(item.upsellDiscount) || 0;
        if (discountPct <= 0) return;

        // Prix ORIGINAL avant remise = price / (1 - discount%)
        var currentPrice  = parseFloat(item.price) || 0;
        var originalPrice = currentPrice / (1 - discountPct / 100);

        // Saving réel = original - discounted
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
            // Créer la ligne dynamiquement dans le résumé
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
        navigator.clipboard.writeText(code).then(() => showErrorPopup('Code copied: ' + code));
    });

    document.getElementById('apply-promo')?.addEventListener('click', () => {
        const input = document.getElementById('promo-input').value.trim().toUpperCase();
        const promoMessage = document.getElementById('promo-message');
        const hasBundle = cart.some(item => item.fromBundle);
        const settings = productsData.find(i => i.type === 'settings');
        const cd = settings?.cart_drawer || {};
        const countFreeForPromo = (cd.promo_count_free_items || 'No').toLowerCase() === 'yes';
        const totalQuantity = countFreeForPromo
            ? cart.reduce((sum, item) => sum + item.quantity, 0)
            : cart.filter(i => !i.isFreePromo).reduce((sum, item) => sum + item.quantity, 0);
        const hasFreePromo = cart.some(item => item.isFreePromo);
        if (hasBundle) { promoMessage.textContent = "Promo codes cannot be used with bundles."; promoMessage.style.color = 'red'; return; }
        // Bloquer promo code si items upsell dans le cart
        const hasUpsell = cart.some(i => i.fromUpsell);
        if (hasUpsell) {
            promoMessage.textContent = "Promo codes cannot be combined with Kit discounts.";
            promoMessage.style.color = 'red';
            return;
        }
        if (hasFreePromo) { promoMessage.textContent = "Promo codes cannot be used with free promotional items."; promoMessage.style.color = 'red'; return; }
        if (!input) { promoMessage.textContent = "Please enter a code."; promoMessage.style.color = 'red'; return; }
        const promo = promos.find(p => p.code.toUpperCase() === input);
        if (promo && promo.items === totalQuantity) {
            appliedPromo = promo;
            discountAmount = getSubtotal() * (promo.percent / 100);
            promoMessage.textContent = `Promo applied: ${promo.percent}% off!`;
            promoMessage.style.color = 'green';
            updateTotals();
        } else {
            appliedPromo = null;
            discountAmount = 0;
            promoMessage.textContent = "Invalid or inapplicable promo code.";
            promoMessage.style.color = 'red';
            updateTotals();
        }
    });
});