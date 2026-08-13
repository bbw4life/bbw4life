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
        'next-steps-section',
        'order-stats-section',
        'gratitude-section',
        'share-section',
        'bbw-request-section',
        'bbw-banner-section',
        'bbw-request-personalized-section',
        'support-bar-section',
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
}

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
});
