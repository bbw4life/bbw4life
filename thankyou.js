// thankyou.js — BBW4LIFE Order Confirmation
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 BBW4LIFE thankyou.html LOADED - Starting verification...");

    const spinner   = document.getElementById('spinner');
    const messageEl = document.getElementById('message');
    const buttonsEl = document.getElementById('buttons');

    const urlParams  = new URLSearchParams(window.location.search);
    const sessionId  = urlParams.get('session_id');
    const orderID    = urlParams.get('token');
    const forceReset = urlParams.get('reset') === '1';

    // ── NOWPayments : commande déjà traitée par le webhook ──
        const provider = urlParams.get('provider') || '';
         if (provider === 'nowpayments') {
            localStorage.removeItem('cart');
            if (spinner) spinner.style.display = 'none';
            showSuccess();
            return;
        }

    console.log(`📌 sessionId: ${sessionId} | orderID: ${orderID} | forceReset: ${forceReset}`);

    if (forceReset) {
        sessionStorage.clear();
        console.log("🔄 sessionStorage cleared (forceReset)");
    }

    let payload = null;
    if (sessionId) payload = { provider: 'stripe',  sessionId };
    else if (orderID) payload = { provider: 'paypal', orderID  };

    if (!payload) {
        displayError("We're sorry, but we couldn't find your payment information. Please contact the BBW4LIFE support team for assistance — we're here for you.");
        spinner.style.display = "none";
        return;
    }

    const verifiedId = sessionId || orderID;
    if (sessionStorage.getItem("paymentVerified") === verifiedId) {
        console.log("✅ Already verified in this session — skipping server call");
        localStorage.removeItem('cart');
        spinner.style.display = "none";
        showSuccess();
        return;
    }

    try {
        const functionUrl = `${window.location.origin}/.netlify/functions/verify-payment`;
        console.log(`📡 Calling: ${functionUrl}`);

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`📡 Response status: ${response.status}`);

        if (response.status === 404) {
            throw new Error("We're experiencing a temporary issue with order verification. Please try again in a moment or contact BBW4LIFE support — we will make it right.");
        }

        const data = await response.json();
        console.log("📦 Data received:", data);

        if (!response.ok || !data.success) {
            throw new Error(data.error || "There was an issue verifying your order. Please contact BBW4LIFE support and we'll take care of you right away.");
        }

        sessionStorage.setItem("paymentVerified", verifiedId);
        localStorage.removeItem('cart');

        showSuccess();
        console.log("🎉 VERIFICATION COMPLETED — Welcome to the BBW4LIFE family!");

    } catch (error) {
        console.error("❌ ERREUR COMPLETE:", error);
        displayError(error.message || "An unexpected error occurred. Please contact BBW4LIFE support and we'll resolve it for you.");
    } finally {
        spinner.style.display = "none";
    }
});

// ── Reveal all extra sections with staggered animation ──
function revealExtraSections() {
    const ids = [
        'ty-order-details-section',
        'ty-order-summary-section',
        'next-steps-section',
        'gratitude-section',
        'share-section',
        'bbw-request-section',
        'bbw-banner-section',
        'bbw-request-personalized-section',
        'support-bar-section',
        'ty-footer-section',
        'success-icon'
    ];
    ids.forEach((id, i) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === 'success-icon') ? 'flex' : '';
        }, i * 180);
    });
    // Update main title
    const h1 = document.querySelector('.container > h1');
    if (h1) {
        h1.textContent = 'Order Confirmed! 🎉';
        h1.style.background = 'linear-gradient(135deg, var(--bbw-gold, #B8925A), var(--bbw-gold-vivid, #CBA45C))';
        h1.style.webkitBackgroundClip = 'text';
        h1.style.webkitTextFillColor = 'transparent';
        h1.style.backgroundClip = 'text';
    }

    // Order number / date — dérivés de l'identifiant de paiement déjà
    // présent dans l'URL (session_id Stripe ou token PayPal), sans
    // dépendre d'un champ que le backend ne renvoie pas aujourd'hui.
    const urlParams = new URLSearchParams(window.location.search);
    const rawId = urlParams.get('session_id') || urlParams.get('token') || '';
    const orderNumberEl = document.getElementById('ty-order-number');
    if (orderNumberEl) {
        orderNumberEl.textContent = rawId ? '#' + rawId.slice(-10).toUpperCase() : '—';
    }
    const orderDateEl = document.getElementById('ty-order-date');
    if (orderDateEl) {
        orderDateEl.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    loadOrderSummary();
}

// ── Order Summary : récupère la dernière commande depuis le Sheet
//    (bbw4life-accounts, colonne "history", écrite par verify-payment →
//    save-account/record-order) — pas le panier local (déjà vidé à ce
//    stade) et pas de recalcul approximatif : le "total" vient du vrai
//    montant facturé par Stripe/PayPal (inclut le choix de livraison
//    réel fait au checkout, gratuite ou payante).
function loadOrderSummary() {
    const section = document.getElementById('ty-order-summary-section');
    if (!section) return;

    const userEmail = localStorage.getItem('userEmail');
    const userToken = localStorage.getItem('userAccountToken');
    if (!userEmail || !userToken) { section.style.display = 'none'; return; }

    fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats', email: userEmail, token: userToken })
    })
        .then(r => r.json())
        .then(data => {
            const history = Array.isArray(data.history) ? data.history : [];
            const lastOrder = history[history.length - 1];
            if (!lastOrder || !Array.isArray(lastOrder.items) || lastOrder.items.length === 0) {
                section.style.display = 'none';
                return;
            }

            const itemsEl = document.getElementById('ty-order-summary-items');
            if (itemsEl) {
                itemsEl.innerHTML = lastOrder.items.map(item => {
                    const variantParts = [item.color, item.size].filter(Boolean).join(' / ');
                    return `
                        <div class="ty-order-summary__item">
                            <img src="${item.image || ''}" alt="${item.title || ''}" loading="lazy">
                            <div class="ty-order-summary__item-info">
                                <strong>${item.title || ''}</strong>
                                ${variantParts ? `<span>${variantParts}</span>` : ''}
                                <span>Qty: ${item.quantity || 1}</span>
                            </div>
                            <div class="ty-order-summary__item-price">$${parseFloat(item.lineTotal || (item.price * item.quantity) || 0).toFixed(2)}</div>
                        </div>`;
                }).join('');
            }

            const subtotal = lastOrder.items.reduce((sum, item) => sum + parseFloat(item.lineTotal || (item.price * item.quantity) || 0), 0);
            const total = parseFloat(lastOrder.total) || subtotal;
            const shippingAndTax = total - subtotal;

            const subtotalEl = document.getElementById('ty-summary-subtotal');
            if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

            const shippingRow = document.getElementById('ty-summary-shipping-row');
            const shippingEl  = document.getElementById('ty-summary-shipping');
            if (shippingRow && shippingEl) {
                if (shippingAndTax > 0.01) {
                    shippingEl.textContent = `$${shippingAndTax.toFixed(2)}`;
                    shippingRow.style.display = '';
                } else if (shippingAndTax <= 0.01 && shippingAndTax >= -0.01) {
                    shippingEl.textContent = 'Free';
                    shippingRow.style.display = '';
                }
            }

            const totalEl = document.getElementById('ty-summary-total');
            if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
        })
        .catch(() => { section.style.display = 'none'; });
}

// ── Bandeau promo (photo bienvenue) + liens sociaux du footer : lus
//    depuis settings.promos[0] / settings.social_links — même système
//    que src/components/footer.js (window.__allProducts, déjà chargé
//    par script.js — pas de fetch séparé qui pourrait arriver trop
//    tard ou échouer silencieusement, laissant les liens sur "#").
function applyPromoAndSocialLinks() {
    const all = window.__allProducts || [];
    const settings = all.find(p => p.type === 'settings') || {};

    const pctEl  = document.getElementById('ty-promo-pct');
    const codeEl = document.getElementById('ty-promo-code');
    const promo = (settings.promos || [])[0];
    if (promo) {
        if (pctEl)  pctEl.textContent  = `${promo.percent}% OFF`;
        if (codeEl) codeEl.textContent = promo.code;
    }

    const socialLinks = settings.social_links || {};
    const socialMap = {
        'ty-social-instagram': socialLinks.instagram,
        'ty-social-facebook':  socialLinks.facebook,
        'ty-social-tiktok':    socialLinks.tiktok,
        'ty-social-pinterest': socialLinks.pinterest,
        'ty-social-youtube':   socialLinks.youtube,
        'ty-social-whatsapp':  socialLinks.whatsapp
    };
    Object.entries(socialMap).forEach(([id, url]) => {
        const el = document.getElementById(id);
        if (el && url) el.href = url;
    });
}

function waitForProductsThenApply() {
    if (window.__allProducts && window.__allProducts.length) {
        applyPromoAndSocialLinks();
        return;
    }
    let tries = 0;
    const iv = setInterval(() => {
        tries++;
        if (window.__allProducts && window.__allProducts.length) {
            clearInterval(iv);
            applyPromoAndSocialLinks();
        } else if (tries > 50) {
            clearInterval(iv);
            // Dernier recours : fetch direct si script.js n'a jamais abouti.
            fetch('/products.data.json')
                .then(r => r.json())
                .then(data => {
                    window.__allProducts = window.__allProducts || data;
                    applyPromoAndSocialLinks();
                })
                .catch(() => {});
        }
    }, 100);
}
document.addEventListener('DOMContentLoaded', waitForProductsThenApply);

// ── Show success state ──
function showSuccess() {
    document.getElementById('message').innerHTML = `
        <h1>Welcome to the BBW4LIFE Family! 💖</h1>
        <p>Your order has been confirmed — and we couldn't be more excited for you!</p>
        <p>✅ <strong>Your order is confirmed!</strong></p>
        <p>Your package is being prepared with care and will be on its way to you soon.</p>
        <p>📧 Please check your email inbox for your order details and tracking number.</p>
        <p>Remember: <em>Beauty Has No Sizes.</em> You made the right choice — for yourself. 🌸</p>
    `;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';

    // ✅ Appel direct ici — revealExtraSections est dans le même fichier
    revealExtraSections();
}

// ── Show error state ──
function displayError(message) {
    document.getElementById('message').innerHTML = `<p class="error">${message}</p>`;
    document.getElementById('message').style.display = 'block';
    document.getElementById('buttons').style.display = 'block';
}

// ── Footer year + share buttons (moved out of inline <script> for CSP compliance) ──
document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('ty-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ── Copy link button ──
    document.getElementById('copy-link-btn')?.addEventListener('click', function() {
        const msg = `🌸 I just ordered from BBW4LIFE — Beauty Has No Sizes! A brand that truly celebrates every curve and every woman. Check them out! 👉 ${window.location.origin}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(msg).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                this.style.background = 'var(--green)';
                this.style.color = '#fff';
                this.style.borderColor = 'var(--green)';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-link"></i> Copy Link';
                    this.style.background = '';
                    this.style.color = '';
                    this.style.borderColor = '';
                }, 2500);
            });
        } else {
            const el = document.createElement('textarea');
            el.value = msg;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            this.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-link"></i> Copy Link';
            }, 2500);
        }
    });

    // ── Instagram share button ──
    document.getElementById('share-instagram-btn')?.addEventListener('click', function(e) {
        e.preventDefault();

        const msg = `🌸 I just ordered from BBW4LIFE — Beauty Has No Sizes! A brand that truly celebrates every curve and every woman. Check them out! 👉 ${window.location.origin}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(msg).then(() => {
                this.innerHTML = '<i class="fab fa-instagram"></i> Message Copied!';
                setTimeout(() => {
                    window.open('https://www.instagram.com', '_blank');
                    this.innerHTML = '<i class="fab fa-instagram"></i> Instagram';
                }, 800);
            });
        } else {
            const el = document.createElement('textarea');
            el.value = msg;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            this.innerHTML = '<i class="fab fa-instagram"></i> Message Copied!';
            setTimeout(() => {
                window.open('https://www.instagram.com', '_blank');
                this.innerHTML = '<i class="fab fa-instagram"></i> Instagram';
            }, 800);
        }
    });

    // ── Footer newsletter : même action/contrat que le popup newsletter
    //    principal (footer.js → action:'newsletter-subscribe') — écrit
    //    dans le même Sheet bbw4life-accounts. Seul l'email est requis
    //    côté fonction, donc ce mini-formulaire (email + bouton) suffit.
    const nlForm  = document.getElementById('ty-footer-newsletter-form');
    const nlEmail = document.getElementById('ty-footer-newsletter-email');
    const nlBtn   = document.getElementById('ty-footer-newsletter-btn');
    const nlMsg   = document.getElementById('ty-footer-newsletter-msg');

    nlForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = (nlEmail.value || '').trim();
        if (!email) return;

        nlBtn.disabled = true;
        nlMsg.textContent = '';
        nlMsg.className = 'ty-footer__newsletter-msg';

        fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'newsletter-subscribe', email })
        })
            .then(r => r.json())
            .then(data => {
                if (data && data.success !== false) {
                    nlMsg.textContent = 'Thank you for subscribing!';
                    nlMsg.classList.add('is-success');
                    nlForm.reset();
                } else {
                    nlMsg.textContent = (data && data.error) || 'Something went wrong. Please try again.';
                    nlMsg.classList.add('is-error');
                }
            })
            .catch(() => {
                nlMsg.textContent = 'Something went wrong. Please try again.';
                nlMsg.classList.add('is-error');
            })
            .finally(() => { nlBtn.disabled = false; });
    });
});
