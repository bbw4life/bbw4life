const BBW_VAPID_PUBLIC_KEY = 'BPAy2x7jsTHvHMYA5uLWKZAbmwpAtUlFtCbgSiALsYFH4EKhSTxUemonrVf-xzg5FxsQIB4GXZdA_N5gwvLWF8Y';


(function captureAffiliateRef() {
  const urlParams = new URLSearchParams(window.location.search);
  const refParam  = urlParams.get('ref');
  
  if (refParam) {
    localStorage.setItem('aff_ref', refParam);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `aff_ref=${encodeURIComponent(refParam)};expires=${expires};path=/;SameSite=Lax`;
    
    fetch('/.netlify/functions/save-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aff-track-click', username: refParam }),
      keepalive: true
    })
    .then(r => r.json())
    .then(d => console.log('[AFF] Click tracked:', d))
    .catch(e => console.warn('[AFF] Track failed:', e.message));
  }

  window.getAffRef = function() {
    const fromStorage = localStorage.getItem('aff_ref');
    if (fromStorage) return fromStorage;
    const match = document.cookie.match(/(?:^|;\s*)aff_ref=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  };
})();



if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'OPEN_CART') {
      let tries = 0;
      const tryOpen = setInterval(function () {
        tries++;
        if (typeof window.openCartDrawer === 'function') {
          clearInterval(tryOpen);
          window.openCartDrawer();
        } else if (tries > 30) {
          clearInterval(tryOpen);
          // Filet de sécurité : si le drawer JS n'a jamais fini de charger,
          // rediriger vers la vraie page panier plutôt que de laisser le
          // clic "View Cart" sans aucun effet visible pour l'utilisateur.
          window.location.href = '/cart.html';
        }
      }, 200);
    }
    // "Shop Now" avec un onglet déjà ouvert : la page se charge de naviguer
    // elle-même via location.href plutôt que le service worker via
    // client.navigate() — cet appel échoue silencieusement dans la plupart
    // des navigateurs quand il suit un focus() dans le même handler
    // (l'activation utilisateur transitoire du clic sur la notif n'autorise
    // qu'un seul appel consommateur : focus() OU navigate(), pas les deux).
    if (event.data && event.data.type === 'NAVIGATE_TO') {
      // Filet de sécurité : URL absente/invalide → page d'accueil plutôt
      // que de ne rien faire.
      const fallback = '/';
      let url = event.data.url || fallback;
      const current = window.location.pathname + window.location.search;
      let target;
      try { target = new URL(url, window.location.origin); }
      catch (e) { target = new URL(fallback, window.location.origin); url = fallback; }
      if (current !== target.pathname + target.search) {
        window.location.href = url;
      }
    }
  });
}

function bbwGetPushDeviceId() {
  let id = localStorage.getItem('bbw_push_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    localStorage.setItem('bbw_push_device_id', id);
  }
  return id;
}

function bbwUrlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let bbwPushInitInProgress = false;

async function bbwInitCartPushReminder() {
  if (bbwPushInitInProgress) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');
  if (!currentCart.length) return;

  bbwPushInitInProgress = true;

  try {
    const registration = await navigator.serviceWorker.register('/sw-push.js');
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { bbwPushInitInProgress = false; return; }
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bbwUrlBase64ToUint8Array(BBW_VAPID_PUBLIC_KEY)
      });
    }

    const deviceId = bbwGetPushDeviceId();

    await fetch('/.netlify/functions/save-push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription, cart: currentCart })
    });
  } catch (e) {
    console.warn('[PushReminder] init failed:', e.message);
  }

  bbwPushInitInProgress = false;
}


async function bbwSubscribeGeneral() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  try {
    const registration = await navigator.serviceWorker.register('/sw-push.js');
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bbwUrlBase64ToUint8Array(BBW_VAPID_PUBLIC_KEY)
      });
    }

    const deviceId = bbwGetPushDeviceId();
    const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');

    await fetch('/.netlify/functions/save-push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription, cart: currentCart })
    });
  } catch (e) {
    console.warn('[PushGeneral] init failed:', e.message);
  }
}


function bbwShowPromoWarningPopup(code, discountPct) {
  if (document.getElementById('bbw-promo-popup-overlay')) {
    document.getElementById('bbw-promo-popup-overlay').classList.add('bbw-promo-popup--visible');
    return;
  }

  // ── Récupérer le lien WhatsApp depuis les settings ──
  const allProducts = window.__allProducts || [];
  const settings = allProducts.find(function(p) { return p.type === 'settings'; }) || {};
  const whatsappUrl = (settings.contact && settings.contact.whatsapp_url)
    ? settings.contact.whatsapp_url
    : 'https://wa.me/1828940709'; // fallback

  const overlay = document.createElement('div');
  overlay.id = 'bbw-promo-popup-overlay';

  overlay.innerHTML = `
    <div class="bbw-promo-popup-modal" role="dialog" aria-modal="true" aria-label="Promo code notice">

      <button class="bbw-promo-popup-close" id="bbwPromoCls" aria-label="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div class="bbw-promo-popup-icon">🎟️</div>

      <h2 class="bbw-promo-popup-title">
        Dear <span>Valued Customer</span>
      </h2>
      <p class="bbw-promo-popup-sub">Affiliate Reward — Exclusive Code</p>

      <div class="bbw-promo-popup-code-wrap">
        <span class="bbw-promo-popup-code-val">${code}</span>
        <span class="bbw-promo-popup-code-badge">-${discountPct}%</span>
      </div>

      <div class="bbw-promo-popup-warning">
        <p>
          <strong>⚠️ Note — Single Use Only:</strong>
          This promo code can only be applied <strong>once</strong> during checkout.
        </p>
        <p>
          If you apply this code and do not complete your order, the code will be <strong>marked as used</strong>.
        </p>
        <p>
          In that case, please contact our customer support to receive a new code.
        </p>
      </div>

      <p class="bbw-promo-popup-contact">
        Need help? Contact us via
        <a href="/page/contact.html">our contact page</a>
        or on
        <a href="${whatsappUrl}" target="_blank" rel="noopener">WhatsApp</a>.
      </p>

      <button class="bbw-promo-popup-cta" id="bbwPromoCtaCheckout">
        <i class="fi fi-rr-shopping-cart"></i> &nbsp;Go to Checkout now
      </button>

      <div class="bbw-promo-popup-divider">or</div>

      <button class="bbw-promo-popup-checkout-link" id="bbwPromoCtaClose">
        Got it — I'll use it later
      </button>

    </div>`;
    
  document.body.appendChild(overlay);

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      overlay.classList.add('bbw-promo-popup--visible');
    });
  });

  function closePopup() {
    overlay.classList.remove('bbw-promo-popup--visible');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 380);
  }

  document.getElementById('bbwPromoCls').addEventListener('click', closePopup);
  document.getElementById('bbwPromoCtaClose').addEventListener('click', closePopup);

  document.getElementById('bbwPromoCtaCheckout').addEventListener('click', function () {
    localStorage.setItem('bbw_aff_promo_code', code);
    localStorage.setItem('bbw_aff_promo_discount', discountPct);
    closePopup();
    window.location.href = '/checkout/checkout.html';
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePopup();
  });

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { closePopup(); document.removeEventListener('keydown', onEsc); }
  });
}


window.bbwValidateAffPromoCode = async function (code) {
  if (!code) return null;
  try {
    const res  = await fetch('/.netlify/functions/validate-promo-code', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'validate', code: code, consume: false })
    });
    const data = await res.json();
    if (data.success && data.valid) {
      return { valid: true, discountPct: data.discountPct };
    }
    return { valid: false, reason: data.reason || 'INVALID' };
  } catch (e) {
    console.warn('[PromoCode] Validation error:', e.message);
    return null;
  }
};
 
window.bbwConsumeAffPromoCode = async function (code) {
  if (!code) return;
  try {
    await fetch('/.netlify/functions/validate-promo-code', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'validate', code: code, consume: true })
    });
    // Clear localStorage after consumption
    localStorage.removeItem('bbw_aff_promo_code');
    localStorage.removeItem('bbw_aff_promo_discount');
  } catch (e) {
    console.warn('[PromoCode] Consumption error:', e.message);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  (function () {
    'use strict';

    // Ne pas tracker la page analytics elle-même
    if (window.location.pathname.includes('curvafit-analytiques')) return;

    function getBrowser() {
      const ua = navigator.userAgent;
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('SamsungBrowser')) return 'Samsung';
      if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
      if (ua.includes('Edg')) return 'Edge';
      if (ua.includes('Chrome')) return 'Chrome';
      if (ua.includes('Safari')) return 'Safari';
      return 'Other';
    }

    function getDevice() {
      const ua = navigator.userAgent;
      if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
      if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return 'mobile';
      return 'desktop';
    }

    function genId() {
      return 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    }

    let sessionId = sessionStorage.getItem('cf_an_sid');
    if (!sessionId) { sessionId = genId(); sessionStorage.setItem('cf_an_sid', sessionId); }

    const startTime  = Date.now();
    let clicks       = 0;
    let menuClicks   = 0;
    let actionsCount = 0;
    let maxScroll    = 0;
    let sent         = false;

    document.addEventListener('click', function (e) {
      clicks++; actionsCount++;
      const target = e.target.closest('a, button, .nav, nav');
      if (target && (target.tagName === 'A' || target.tagName === 'BUTTON')) menuClicks++;
    });

    window.addEventListener('scroll', function () {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct  = docH > 0 ? Math.round((window.scrollY / docH) * 100) : 0;
      if (pct > maxScroll) maxScroll = pct;
    });

    function sendData() {
      if (sent) return;
      sent = true;

      const timeOnPage = Math.round((Date.now() - startTime) / 1000);

      const payload = {
        timestamp:    new Date().toISOString(),
        sessionId,
        country:      'Unknown',
        city:         'Unknown',
        pageUrl:      window.location.href,
        pageTitle:    document.title,
        timeOnPage,
        clicks,
        menuClicks,
        scrollDepth:  maxScroll,
        referrer:     document.referrer || 'direct',
        device:       getDevice(),
        browser:      getBrowser(),
        screenWidth:  window.screen.width,
        actionsCount
      };

      fetch('/.netlify/functions/save-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }

    window.addEventListener('pagehide', sendData);
    window.addEventListener('beforeunload', sendData);
    setTimeout(sendData, 90000);
  })();



/* ══════════════════════════════════════════
   BBW4LIFE PRELOADER — Beauty Has No Sizes
══════════════════════════════════════════ */
(function () {
  'use strict';
  var STYLE_MAP = {
    style_pulse_logo:   'style-pulse-logo',
    style_progress_bar: 'style-progress-bar',
    style_spinner_ring: 'style-spinner-ring',
    style_dots_wave:    'style-dots-wave',
    style_morph_text:   'style-morph-text'
  };

  var MORPH_TEXTS  = ['Welcome ✨', 'Beauty Has No Sizes', 'You Are Enough', 'BBW4LIFE 💖'];
  var morphTimer   = null;
  var barTimer     = null;
  var morphIdx     = 0;
  var dismissed    = false;
  var MIN_SHOW_MS  = 3000;
  var startedAt    = Date.now();
  var pageReady    = false;
  var pl           = null;
  var barFill      = null;
  var barPct       = null;
  var morphEl      = null;
  var currentPct   = 0;

  fetch('/products.data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var arr      = Array.isArray(data) ? data : [];
      var settings = arr.find(function (p) { return p.type === 'settings'; }) || {};
      var cfg      = settings.preloader || {};

      var show = (cfg.show || 'yes').trim().toLowerCase();

      pl = document.getElementById('cf-preloader');
      if (!pl) return;

      if (show !== 'yes') {
        pl.style.cssText = 'display:none!important';
        var st = document.getElementById('cf-pre-style');
        if (st && st.parentNode) st.parentNode.removeChild(st);
        return;
      }

      barFill = document.getElementById('cf-pre-progress-fill');
      barPct  = document.getElementById('cf-pre-progress-pct');
      morphEl = document.getElementById('cf-pre-morph-text');

      spawnParticles();

      var activeKey = Object.keys(STYLE_MAP).find(function (k) {
        return (cfg[k] || 'no').trim().toLowerCase() === 'yes';
      }) || 'style_dots_wave';

      applyStyle(activeKey);

      if (pageReady) {
        tryHide();
      } else {
        window.addEventListener('load', function () {
          pageReady = true;
          tryHide();
        });
      }
    })
    .catch(function () {});

  if (document.readyState === 'complete') {
    pageReady = true;
  } else {
    window.addEventListener('load', function () { pageReady = true; });
  }

  function spawnParticles() {
    var container = document.getElementById('cf-pre-particles');
    if (!container) return;
    var colors = [
      'rgba(110,36,57,0.5)',
      'rgba(184,146,90,0.5)',
      'rgba(156,58,82,0.45)',
      'rgba(21,17,14,0.12)'
    ];
    for (var i = 0; i < 22; i++) {
      var p        = document.createElement('div');
      p.className  = 'cf-pre-particle';
      var size     = Math.random() * 5 + 3;
      var left     = Math.random() * 100;
      var duration = Math.random() * 6 + 5;
      var delay    = Math.random() * 8;
      var color    = colors[Math.floor(Math.random() * colors.length)];
      p.style.cssText =
        'width:' + size + 'px;height:' + size + 'px;' +
        'left:' + left + '%;' +
        'background:' + color + ';' +
        'animation-duration:' + duration + 's;' +
        'animation-delay:' + delay + 's;';
      container.appendChild(p);
    }
  }

  function applyStyle(key) {
    var cssClass = STYLE_MAP[key] || STYLE_MAP.style_dots_wave;
    Object.values(STYLE_MAP).forEach(function (cls) { pl.classList.remove(cls); });
    pl.classList.add(cssClass);

    if (cssClass === 'style-progress-bar' && barFill && barPct) {
      barTimer = setInterval(function () {
        var step = currentPct < 70 ? 3 : currentPct < 90 ? 1 : 0.4;
        currentPct = Math.min(95, currentPct + step);
        barFill.style.width = currentPct + '%';
        barPct.textContent  = Math.floor(currentPct) + '%';
      }, 80);
    }

    if (cssClass === 'style-morph-text' && morphEl) {
      morphEl.textContent = MORPH_TEXTS[0];
      morphEl.className   = 'cf-pre-morph-text cf-morph-active';
      morphTimer = setInterval(function () {
        morphIdx = (morphIdx + 1) % MORPH_TEXTS.length;
        morphEl.className = 'cf-pre-morph-text cf-morph-exit';
        setTimeout(function () {
          morphEl.textContent = MORPH_TEXTS[morphIdx];
          morphEl.className   = 'cf-pre-morph-text cf-morph-enter';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              morphEl.className = 'cf-pre-morph-text cf-morph-active';
            });
          });
        }, 420);
      }, 1600);
    }

    setTimeout(doHide, 8000);
  }

  function tryHide() {
    if (dismissed || !pl) return;
    var elapsed = Date.now() - startedAt;
    var delay   = Math.max(0, MIN_SHOW_MS - elapsed);
    setTimeout(doHide, delay);
  }

  function doHide() {
    if (dismissed || !pl) return;
    dismissed = true;
    clearInterval(barTimer);
    clearInterval(morphTimer);

    if (barFill) {
      barFill.style.width = '100%';
      if (barPct) barPct.textContent = '100%';
    }

    var isProgress = pl.classList.contains('style-progress-bar');
    setTimeout(function () {
      pl.classList.add('cf-pre--hidden');
      setTimeout(function () {
        if (pl && pl.parentNode) pl.parentNode.removeChild(pl);
        var st = document.getElementById('cf-pre-style');
        if (st && st.parentNode) st.parentNode.removeChild(st);
      }, 600);
    }, isProgress ? 350 : 0);
  }

})();


 function upgradeShopifyImageUrl(url, size) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('cdn.shopify.com')) return url;
  if (url.startsWith('data:')) return url;

  url = url.replace(/[?&]width=\d+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
  url = url.replace(/[?&]quality=\d+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
  url = url.replace(/[?&]format=\w+/g, '').replace(/\?&/, '?').replace(/\?$/, '');

  url = url.replace(
    /_(pico|icon|thumb|small|compact|medium|large|grande|original|master|1024x1024|2048x2048|\d+x\d+|\d+x|x\d+)(\.(?:jpg|jpeg|png|webp|gif|avif))(\?|$)/gi,
    '$2$3'
  );

  const w = size || 1000;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + `width=${w}&quality=85&format=webp`;
}


/* ══════════════════════════════════════════════════════
   BBW4LIFE — HIDE BROKEN IMAGE PLACEHOLDERS
══════════════════════════════════════════════════════ */
(function hideBrokenImagePlaceholders() {
  const style = document.createElement('style');
  style.id = 'bbw-content-protection-css';
  style.textContent = `
    body.bbw-no-select,
    body.bbw-no-select * {
      -webkit-user-select: none;
      -moz-user-select:    none;
      -ms-user-select:     none;
      user-select:         none;
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
      e.target.style.visibility = 'hidden';
      e.target.style.opacity = '0';
    }
  }, true);

  document.addEventListener('load', function(e) {
    if (e.target.tagName === 'IMG') {
      e.target.style.visibility = '';
      e.target.style.opacity = '';
    }
  }, true);
})();




   if ('fonts' in document) {
        document.fonts.ready.then(() => {
            document.documentElement.classList.add('fonts-loaded');
        });
    } else {
        window.addEventListener('load', () => {
            document.documentElement.classList.add('fonts-loaded');
        });
    }


(function initDraggables() {

  function makeDraggable(widget, opts) {
    opts = opts || {};
    let isDragging = false;
    let startX, startY, origLeft, origTop, hasMoved;

    // ← CRITIQUE sur mobile : bloque le scroll natif sur l'élément
    widget.style.touchAction = 'none';

    function getPos() {
      const rect = widget.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    }

    function applyPos(left, top) {
      const current = widget.getAttribute('style') || '';
      const cleaned = current
        .replace(/\bright\s*:[^;]+;?/g, '')
        .replace(/\bbottom\s*:[^;]+;?/g, '')
        .replace(/\bleft\s*:[^;]+;?/g, '')
        .replace(/\btop\s*:[^;]+;?/g, '')
        .replace(/\bposition\s*:[^;]+;?/g, '');
      widget.setAttribute('style',
        cleaned +
        ' position:fixed !important;' +
        ' right:auto !important;' +
        ' bottom:auto !important;' +
        ' left:' + left + 'px !important;' +
        ' top:'  + top  + 'px !important;' +
        ' touch-action:none;'
      );
    }

    function startDrag(clientX, clientY, target) {
      if (opts.handleSelector && !target.closest(opts.handleSelector)) return false;
      isDragging = true;
      hasMoved   = false;
      startX     = clientX;
      startY     = clientY;
      const pos  = getPos();
      origLeft   = pos.left;
      origTop    = pos.top;
      return true;
    }

    function moveDrag(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
      if (!hasMoved) return;
      const bW = widget.offsetWidth;
      const bH = widget.offsetHeight;
      const nl = Math.max(8, Math.min(window.innerWidth  - bW - 8, origLeft + dx));
      const nt = Math.max(8, Math.min(window.innerHeight - bH - 8, origTop  + dy));
      applyPos(nl, nt);
    }

    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      if (hasMoved && opts.blockClickSelector) {
        const el = widget.querySelector(opts.blockClickSelector);
        if (el) {
          const block = (ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            el.removeEventListener('click', block, true);
          };
          el.addEventListener('click', block, true);
        }
      }
    }

    // ── Mouse ──
    widget.addEventListener('mousedown', (e) => {
      if (startDrag(e.clientX, e.clientY, e.target)) e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);

    // ── Touch : tout sur le WIDGET, pas sur document ──
    widget.addEventListener('touchstart', (e) => {
      startDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
      // pas de preventDefault → clics préservés
    }, { passive: true });

    // ← CRITIQUE : attaché sur widget, pas document, et passive:false
    widget.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      e.preventDefault(); // bloque le scroll page pendant le drag
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    widget.addEventListener('touchend', endDrag);
  }

  const floatingNav = document.getElementById('floating-nav');
  if (floatingNav) {
    makeDraggable(floatingNav, { handleSelector: '#fnav-toggle' });
  }

 const paulIndicator = document.querySelector('.paul-indicator-wrapper');
  if (paulIndicator) {
    makeDraggable(paulIndicator, {});
  }

  const bdayGiftBtn = document.getElementById('bbwBdayGiftBtn');
  if (bdayGiftBtn) {
    makeDraggable(bdayGiftBtn, {});
  }

  const dockWishlist = document.getElementById('bbwDockWishlistTrigger');
  if (dockWishlist) {
    makeDraggable(dockWishlist, {});
  }

  const dockCart = document.getElementById('bbwDockCartTrigger');
  if (dockCart) {
    makeDraggable(dockCart, {});
  }

})();


// ══ FLOATING NAV ══
  const fnavToggle = document.getElementById('fnav-toggle');
  const fnavWheel  = document.getElementById('fnav-wheel');

  if (fnavToggle && fnavWheel) {
    fnavToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = fnavWheel.classList.toggle('open');
      fnavToggle.classList.toggle('open', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#floating-nav')) {
        fnavWheel.classList.remove('open');
        fnavToggle.classList.remove('open');
      }
    });

    const PAGE_ORDER = [
        '/',
        '/collections/all',
        '/collections/all-collections',
        '/collections/featured',
        '/collections/most-popular',
        '/collections/dresses',
        '/collections/curvy-woman',
        '/collections/beauty',
        '/collections/men',
        '/collections/shoes',
        '/collections/pants-skirts',
        '/bbw4life/glam-heels',
        '/bbw4life/retrorun-sneakers',
        '/bbw4life/bohoflip-sandals',
        '/bbw4life/powerheels',
        '/bbw4life/winterboost-boots',
        '/bbw4life/colorstilettos',
        '/bbw4life/nightchic-dress',
        '/bbw4life/slitlux-dress',
        '/bbw4life/plaidoverall-dress',
        '/bbw4life/floralflounce-dress',
        '/bbw4life/vintagesquare-dress',
        '/bbw4life/paisleybelt-dress',
        '/bbw4life/meshduo-set',
        '/bbw4life/meshglam-dress',
        '/bbw4life/linenbreeze-dress',
        '/bbw4life/stripedmini-dress',
        '/bbw4life/loungerobe',
        '/bbw4life/lacenight-dress',
        '/bbw4life/lacethong-set',
        '/bbw4life/solidsexy-bikini',
        '/bbw4life/curvebikini',
        '/bbw4life/leopardnight-set',
        '/bbw4life/supportbra',
        '/bbw4life/laceromper',
        '/bbw4life/stripedbikini',
        '/bbw4life/tubebikinii',
        '/bbw4life/ruffleone-bikini',
        '/bbw4life/bandagebikini',
        '/bbw4life/contrastone-piece',
        '/bbw4life/premiumbikini',
        '/bbw4life/irregulartop',
        '/bbw4life/christmassweat',
        '/bbw4life/dalmationshorts',
        '/bbw4life/leopardshirt',
        '/bbw4life/drawstringpants',
        '/bbw4life/cropslimpants',
        '/bbw4life/haremprints',
        '/bbw4life/loosejeans',
        '/bbw4life/britishloafers',
        '/bbw4life/airmesh-runners',
        '/bbw4life/leathercasuals',
        '/bbw4life/businessdress-shoes',
        '/bbw4life/hollowsneakers',
        '/bbw4life/tendtrainers',
        '/bbw4life/patentloafers',
        '/bbw4life/collarshirt',
        '/bbw4life/geopolo-shirt',
        '/bbw4life/stripedcollar-sweater',
        '/bbw4life/turtlenecklux',
        '/bbw4life/hikejacket',
        '/bbw4life/roundneck-sweatshirt',
        '/bbw4life/nailbond-glue',
        '/bbw4life/bownails',
        '/bbw4life/nailrepair-lotion',
        '/bbw4life/browdye-pencil',
        '/bbw4life/curl-volume-mascara',
        '/bbw4life/browkit-pro',
        '/bbw4life/obsidian-lip-balm',
        '/bbw4life/tearoff-lip-gloss',
        '/bbw4life/gingerclean-pads',
        '/bbw4life/deeprepair-hair-mask',
        '/bbw4life/batanaglow-oil',
        '/bbw4life/batanaboost-oil',
        '/bbw4life/poreclean-gel',
        '/bbw4life/knucklewhite-serum',
        '/bbw4life/propolis-glow-essence',
        '/bbw4life/menglow-cream',
        '/bbw4life/iceglow-grid-set',
        '/bbw4life/glamsatin-dress',
        '/bbw4life/powersuit',
        '/bbw4life/bohofloral-maxi',
        '/bbw4life/cozylounge-set',
        '/bbw4life/blushlace-gown',
        '/bbw4life/tealempire-gown',
        '/bbw4life/jacquardpower-suit',
        '/bbw4life/patchlace-flats',
        '/bbw4life/warmstep-boots',
        '/bbw4life/platformwalk-sneakers',
        '/bbw4life/stripewrap-bodycon',
        '/bbw4life/flarefit-dress',
        '/bbw4life/officestripe-shirt',
        '/bbw4life/drawshirt-dress',
        '/bbw4life/autumnvneck-maxi',
        '/bbw4life/beltedbanquet-dress',
        '/bbw4life/woventassel-bag',
        '/bbw4life/koreantrend-bag',
        '/bbw4life/blocksquare-bag',
        '/bbw4life/rattanring-tote',
        '/bbw4life/commutercanvas-tote',
        '/bbw4life/embroidtote-bag',
        '/bbw4life/texturedmini-bag',
        '/bbw4life/retroniche-bag',
        '/bbw4life/leopardunderarm-bag',
        '/bbw4life/metalchain-clutch',
        '/bbw4life/patterntote-bag',
        '/bbw4life/pleatedtwo-piece',
        '/bbw4life/onepiece-swim',
        '/blog',
        '/blog/beauty-has-no-sizes-the-movement-redefining-beauty',
        '/blog/stop-dieting-how-bbw-women-take-care-of-themselves',
        '/blog/nutrition-for-curvy-women-eat-to-feel-amazing',
        '/blog/7-body-positive-affirmations-that-change-how-you-see-yourself',
        '/blog/how-to-stop-letting-opinions-destroy-your-body-confidence',
        '/blog/pcos-and-the-plus-size-body-understanding-your-hormones',
        '/blog/move-without-injury-gentle-exercises-for-plus-size-women',
        '/blog/plus-size-fashion-2026-outfits-that-turn-heads',
        '/blog/how-i-stopped-being-ashamed-of-my-body',
        '/blog/10-must-have-wardrobe-pieces-for-plus-size-women',
        '/blog/bbw-style-guide-how-to-dress-confidently',
        '/blog/plus-size-dresses-how-to-find-the-one-that-flatters',
        '/blog/bbw-and-seduction-your-body-is-a-gift',
        '/blog/how-to-dress-as-a-bbw-and-feel-beautiful',
        '/blog/bbw-and-seduction-your-body-is-a-power',
        '/blog/bbw4life-being-a-big-beautiful-woman-is-a-lifestyle',
        '/pages/our-story',
        '/pages/about',
        '/pages/contact',
        '/pages/faq',
        '/pages/order-tracking',
        '/pages/product-care',
        '/pages/disclaimer',
        '/policies/privacy',
        '/policies/refund',
        '/policies/shipping',
        '/policies/terms',
        '/account',
        '/checkout',
        '/cart'
      ];

    document.getElementById('fnav-next').addEventListener('click', () => {
      const currentPath = window.location.pathname;
      const idx = PAGE_ORDER.findIndex(p => currentPath.endsWith(p) || currentPath === p);
      const nextPage = idx !== -1 && idx < PAGE_ORDER.length - 1
        ? PAGE_ORDER[idx + 1]
        : PAGE_ORDER[0];
      window.location.href = nextPage;
    });

    // ── Scroll par paliers de 10% ──
    const STEP = 0.10;

    const btnUp = fnavWheel.querySelector('.fnav-top');
    const btnDown = fnavWheel.querySelector('.fnav-bottom');

    if (btnUp) {
      btnUp.addEventListener('click', () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const target = Math.max(0, window.scrollY - maxScroll * STEP);
        window.scrollTo({ top: target, behavior: 'smooth' });
      });
    }

    if (btnDown) {
      btnDown.addEventListener('click', () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const target = Math.min(maxScroll, window.scrollY + maxScroll * STEP);
        window.scrollTo({ top: target, behavior: 'smooth' });
      });
    }
  }

  // ====================== IMAGES NETTES (ANTI-FLOU GLOBAL) ======================
  (function injectSharpImageStyles() {
  const style = document.createElement('style');
  style.id = 'sharp-images-style';
  style.textContent = `
    img,
    .main-image img,
    .thumbnail-item img,
    .mini-media-image,
    .product-card img,
    .wishlist-img,
    .cart-item img {
      image-rendering: auto;
      filter: none !important;
      -webkit-filter: none !important;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transform: translateZ(0);
      -webkit-transform: translateZ(0);
      will-change: auto;
      max-width: 100%;
    }
    .main-image img { height: 100% !important; }
  `;
  document.head.appendChild(style);
})();
  // ====================== FIN IMAGES NETTES ======================

  let products = [];

// ====================== APPLY PROMO FREE ITEMS ======================
function applyPromoFreeItems() {
    const settings = products.find(p => p.type === 'settings');
    if (!settings) return;
    const cd = settings.cart_drawer || {};

    const showPromo = (cd.show_promo_message || 'Yes').toLowerCase() === 'yes';
    if (!showPromo) {
        cart = cart.filter(i => !i.isFreePromo);
        localStorage.setItem('cart', JSON.stringify(cart));
        return;
    }

    const buyQty  = parseInt(cd.promo_buy_quantity) || 0;
    const getQty  = parseInt(cd.promo_get_quantity)  || 0;
    if (!buyQty || !getQty) return;

    const realProducts = products.filter(p => !p.type && p.active !== false);

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
                image:         upgradeShopifyImageUrl(image || prod.image),
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

  // ====================== POPUP ======================
function showErrorPopup(message) {
  let popup = document.getElementById('error-popup');

  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'error-popup';
    popup.innerHTML = `
      <div class="popup-content">
        <p id="popup-message" class="popup-text"></p>
        <button id="popup-close" class="popup-btn">OK</button>
      </div>`;
    document.body.appendChild(popup);
  }

  const popupText = popup.querySelector('#popup-message, .popup-text');
  const closeBtn  = popup.querySelector('#popup-close, .popup-btn');

  if (popupText) popupText.textContent = message;
  popup.classList.add('show');

  if (closeBtn) closeBtn.onclick = () => popup.classList.remove('show');
  setTimeout(() => popup.classList.remove('show'), 10000);
}

  // ====================== GET PRODUCT URL ======================
  function getProductUrl(id) {
  if (!products || !Array.isArray(products) || products.length === 0) { return '/collections/bbw4life-all-product.html'; }
  const productIndex = products.findIndex(p => String(p.id) === String(id));
  if (productIndex === -1) { return '/collections/bbw4life-all-product.html'; }
  return `/products/product${productIndex + 1}.html`;
}

  // ====================== PRODUCT MEDIA ======================
  // Détecte si une URL de média pointe vers une vidéo (extension) plutôt
  // qu'une image — permet d'ajouter un lien vidéo dans le tableau `media`
  // d'un produit exactement comme un lien image, sans champ séparé.
  function isVideoMediaSrc(src) {
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(src || ''));
  }

  // Placeholder logo affiché par-dessus une vidéo média tant qu'elle n'a
  // pas fini de charger — système autonome, séparé de initCardPreloadLogo
  // (celui des cards produits) pour ne jamais interférer avec lui.
  const VIDEO_PLACEHOLDER_LOGO_HTML =
    '<img class="bbw-video-placeholder-logo" src="/public/vrlogo%20bbw4life.png" alt="" aria-hidden="true">';

  function revealVideoWhenReady(container) {
    const vid = container.querySelector('video');
    const placeholder = container.querySelector('.bbw-video-placeholder-logo');
    if (!vid || !placeholder) return;
    function reveal() {
      placeholder.classList.add('is-loaded');
      container.classList.remove('bbw-video-loading');
      setTimeout(() => { if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder); }, 400);
    }
    if (vid.readyState >= 2) {
      reveal();
    } else {
      vid.addEventListener('loadeddata', reveal, { once: true });
      vid.addEventListener('error', reveal, { once: true });
    }
  }

  function populateMainProductMedia(media, productTitle) {
    const thumbsContainer = document.getElementById('product-thumbnails');
    const mainSlider = document.getElementById('main-image-slider');
    if (!thumbsContainer || !mainSlider) return;
    const escapeAttr = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const altBase = escapeAttr(productTitle ? `${productTitle} — BBW4LIFE plus size` : 'BBW4LIFE plus size product');
    thumbsContainer.innerHTML = '';
    mainSlider.querySelectorAll('.main-image').forEach(el => el.remove());
    // Retire le skeleton statique (product1.html etc.) posé sur l'image
    // principale en attendant ce remplissage réel.
    const mainSkel = mainSlider.querySelector('[data-skel-main-image]');
    if (mainSkel) mainSkel.remove();
    // Mobile n'a pas besoin d'une image aussi large que desktop — l'écran
    // physique le plus large (devicePixelRatio compris) ne dépasse jamais
    // ~1300px de large réel, donc demander 1800px partout gonfle
    // inutilement le poids téléchargé sur réseau lent.
    const mainImageSize = window.innerWidth <= 768 ? 900 : 1800;
    media.forEach((src, index) => {
      const isVideo = isVideoMediaSrc(src);

      const thumb = document.createElement('div');
      thumb.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
      if (isVideo) {
        // Thumbnail vidéo : muette, boucle — aperçu silencieux. Ne charge
        // (preload/autoplay) que si elle est déjà le média actif au premier
        // rendu ; sinon reste en preload="none" tant qu'on ne clique pas
        // dessus, pour ne pas télécharger des vidéos jamais consultées.
        const isActive = index === 0;
        thumb.innerHTML = `<video src="${src}" muted loop playsinline preload="${isActive ? 'metadata' : 'none'}" ${isActive ? 'autoplay' : ''}></video>${VIDEO_PLACEHOLDER_LOGO_HTML}`;
      } else {
        const thumbSrc = upgradeShopifyImageUrl(src, 300);
        thumb.innerHTML = `<img src="${thumbSrc}" alt="${altBase} — photo ${index+1}" loading="lazy">`;
      }
      thumb.addEventListener('click', () => changeMainImage(index));
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        thumb.addEventListener('mouseenter', () => changeMainImage(index));
      }
      thumbsContainer.appendChild(thumb);

      const mainDiv = document.createElement('div');
      mainDiv.className = `main-image ${index === 0 ? 'active' : ''}`;
      const depth = index === 0 ? '0' : (index <= 2 ? String(index) : 'hidden');
      mainDiv.dataset.depth = depth;
      if (isVideo) {
        mainDiv.dataset.originalSrc = src;
        mainDiv.dataset.isVideo = '1';
        // Muette par défaut (comme la thumbnail) ; se met en lecture active
        // (avec le reste des comportements de l'image active) via changeMainImage.
        // preload="none" tant que ce n'est pas le média actif au premier
        // rendu, pour ne pas télécharger des vidéos jamais consultées.
        const isActive = index === 0;
        // bbw-video-loading désactive will-change sur le <video> tant qu'il
        // charge : will-change crée son propre layer de composition GPU qui
        // peut passer au-dessus du placeholder logo malgré son z-index.
        mainDiv.classList.add('bbw-video-loading');
        mainDiv.innerHTML = `<video src="${src}" muted loop playsinline preload="${isActive ? 'metadata' : 'none'}" ${isActive ? 'autoplay' : ''}></video>${VIDEO_PLACEHOLDER_LOGO_HTML}`;
      } else {
        const mainSrc = upgradeShopifyImageUrl(src, mainImageSize);
        mainDiv.dataset.originalSrc = mainSrc;
        const loadAttr = index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
        mainDiv.innerHTML = `<img src="${mainSrc}" alt="${altBase}" ${loadAttr}>`;
      }
      mainSlider.insertBefore(mainDiv, mainSlider.querySelector('.slider-arrow.next'));
      if (isVideo) {
        revealVideoWhenReady(thumb);
        revealVideoWhenReady(mainDiv);
      }
    });
    currentMainIndex = 0;
    mainSlider.classList.toggle('main-image-slider--video-active', isVideoMediaSrc(media[0]));
    mainSlider.querySelector('.prev').onclick = () => changeMainImage('prev');
    mainSlider.querySelector('.next').onclick = () => changeMainImage('next');
    initMediaCounter(mainSlider, media.length);
  }

  // ════════════════════════════════════════════════
  //   MEDIA COUNTER — "01 / 06" au-dessus du bouton share
  // ════════════════════════════════════════════════
  function initMediaCounter(mainSlider, total) {
    const settings = (window.__allProducts || []).find(p => p.type === 'settings') || {};
    const cd = settings.cart_drawer || {};
    const showIt = (cd.show_media_counter || 'yes').toLowerCase().trim() === 'yes';

    let counter = mainSlider.querySelector('.pp-media-counter');
    if (!showIt || total <= 1) {
      if (counter) counter.remove();
      return;
    }
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'pp-media-counter';
      counter.innerHTML = `<span class="pp-media-counter__current">01</span> / <span class="pp-media-counter__total">${String(total).padStart(2, '0')}</span>`;
      mainSlider.appendChild(counter);
    } else {
      const totalEl = counter.querySelector('.pp-media-counter__total');
      if (totalEl) totalEl.textContent = String(total).padStart(2, '0');
    }
    updateMediaCounter(1);
  }

  function updateMediaCounter(indexOneBased) {
    const currentEl = document.querySelector('#main-image-slider .pp-media-counter__current');
    if (currentEl) currentEl.textContent = String(indexOneBased).padStart(2, '0');
  }

  let currentMainIndex = 0;
  // Nombre de cartes visibles empilées derrière l'image active (cf. pile de
  // cartes en profondeur en bas-gauche) ; au-delà, data-depth="hidden".
  const STACK_VISIBLE_DEPTH = 2;
  function changeMainImage(dir) {
    const images = document.querySelectorAll('#main-image-slider .main-image');
    const thumbs = document.querySelectorAll('#product-thumbnails .thumbnail-item');
    if (!images.length) return;
    images[currentMainIndex].classList.remove('active');
    thumbs[currentMainIndex].classList.remove('active');
    if (dir === 'prev') currentMainIndex = (currentMainIndex - 1 + images.length) % images.length;
    else if (dir === 'next') currentMainIndex = (currentMainIndex + 1) % images.length;
    else currentMainIndex = dir;
    images[currentMainIndex].classList.add('active');
    thumbs[currentMainIndex].classList.add('active');
    updateMediaCounter(currentMainIndex + 1);
    images.forEach((img, i) => {
      const depth = (i - currentMainIndex + images.length) % images.length;
      img.dataset.depth = depth === 0 ? '0' : (depth <= STACK_VISIBLE_DEPTH ? String(depth) : 'hidden');
    });
    const thumbsContainer = document.getElementById('product-thumbnails');
    const activeThumb = thumbs[currentMainIndex];
    const isHorizontal = thumbsContainer.scrollWidth > thumbsContainer.clientWidth;
    if (isHorizontal) {
      thumbsContainer.scrollTo({ left: activeThumb.offsetLeft - (thumbsContainer.clientWidth / 2) + (activeThumb.clientWidth / 2), behavior: 'smooth' });
    } else {
      thumbsContainer.scrollTo({ top: activeThumb.offsetTop - (thumbsContainer.clientHeight / 2) + (activeThumb.clientHeight / 2), behavior: 'smooth' });
    }
    const activeContainer = images[currentMainIndex];
    const activeImg = activeContainer.querySelector('img');
    if (activeImg && activeContainer.dataset.originalSrc) activeImg.src = activeContainer.dataset.originalSrc;

    // Vidéos : joue seulement la vidéo active, met en pause les autres.
    // .play() déclenche lui-même le chargement si preload="none" n'a
    // encore rien téléchargé (comportement natif HTML5). Le son s'active
    // automatiquement sur la vidéo active — changeMainImage n'est appelée
    // que suite à une interaction utilisateur (clic/hover), donc le
    // navigateur autorise ici l'audio sans le bloquer comme un autoplay.
    images.forEach((container) => {
      const vid = container.querySelector('video');
      if (!vid) return;
      if (container === activeContainer) {
        vid.muted = false;
        vid.play().catch(() => {});
      } else {
        vid.pause();
        vid.muted = true;
      }
    });
    const activeThumbVid = activeThumb.querySelector('video');
    if (activeThumbVid) activeThumbVid.play().catch(() => {});

    // Quand le média actif est une vidéo, elle doit occuper tout l'espace
    // de la carte — pas de pile de cartes empilées par-dessus (celle-ci
    // n'a de sens que pour comparer des photos entre elles).
    const mainSlider = document.getElementById('main-image-slider');
    if (mainSlider) {
      mainSlider.classList.toggle('main-image-slider--video-active', activeContainer.dataset.isVideo === '1');
    }

    // Micro-glissement de la page produit entière pour accompagner la transition.
    const productLayout = document.querySelector('.product-layout');
    if (productLayout) {
      productLayout.style.setProperty('--media-shift-x', dir === 'prev' ? '4px' : '-4px');
      productLayout.classList.remove('media-shift');
      void productLayout.offsetWidth;
      productLayout.classList.add('media-shift');
    }
  }
  // Exposée pour products/mz-quickbuy.js (swipe entre images dans le zoom
  // plein écran mobile) — réutilise cette fonction telle quelle plutôt que
  // de dupliquer la logique de navigation (miniatures, compteur, vidéos).
  window.changeMainImage = changeMainImage;

  function populateMiniSlider(slider, media) {
    if (!slider || !media) return;
    slider.innerHTML = '';
    media.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = upgradeShopifyImageUrl(src);
      img.alt = 'BBW4LIFE plus size fashion';
      img.className = `mini-media-image ${i === 0 ? 'active' : ''}`;
      img.loading = 'lazy';
      slider.appendChild(img);
    });
    const prev = document.createElement('div');
    prev.className = 'mini-media-slider-prev';
    const next = document.createElement('div');
    next.className = 'mini-media-slider-next';
    prev.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); slideMini(slider, 'prev'); });
    next.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); slideMini(slider, 'next'); });
    slider.appendChild(prev);
    slider.appendChild(next);
  }

  function slideMini(slider, direction) {
    const images = slider.querySelectorAll('.mini-media-image');
    if (!images.length) return;
    let active = slider.querySelector('.mini-media-image.active');
    let index = Array.from(images).indexOf(active);
    images[index].classList.remove('active');
    if (direction === 'prev') index = (index - 1 + images.length) % images.length;
    else index = (index + 1) % images.length;
    images[index].classList.add('active');
  }





  function initAnnouncementBar() {
  const slider = document.getElementById('paulAnnouncementSlider');
  if (!slider) return;

  const settings = (products.find(p => p.type === 'settings') || {});
  const ab = settings.announcement_bar || {};

  const items    = ab.items        || [];
  const prefix   = ab.promo_prefix || 'Get 20% OFF with code:';
  const code     = ab.promo_code   || 'paul26';
  const copiedTx = ab.copied_text  || 'Copied!';

  items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'paul-announcement-item' + (i === 0 ? ' active' : '');
    div.innerHTML = `${item.text} <i class="${item.icon}"></i>`;
    slider.appendChild(div);
  });

  const promoDiv = document.createElement('div');
  promoDiv.className = 'paul-announcement-item promo';
  promoDiv.innerHTML = `
    ${prefix}
    <span class="paul-promo-code" id="paulPromoCode">
      ${code}
      <i class="fi fi-rr-copy copy-icon" id="copyIcon"></i>
    </span>
    <span class="copied-message" id="copiedMessage">${copiedTx}</span>`;
  slider.appendChild(promoDiv);

  const promoCodeEl = promoDiv.querySelector('#paulPromoCode');
  const copiedMsgEl = promoDiv.querySelector('#copiedMessage');
  if (promoCodeEl) {
    promoCodeEl.addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        copiedMsgEl.style.display = 'inline';
        setTimeout(() => { copiedMsgEl.style.display = 'none'; }, 2000);
      });
    });
  }

  const allItems = slider.querySelectorAll('.paul-announcement-item');
  let current = 0;
  function showItem(index) {
    allItems.forEach((el, i) => el.classList.toggle('active', i === index));
    current = index;
  }
  if (allItems.length > 1) {
    setInterval(() => showItem((current + 1) % allItems.length), 4000);
  }
}

  // ====================== FETCH PRODUCTS ======================
  fetch('/products.data.json')
    .then(response => response.json())
    .then(data => {
      products = data;
      window.__allProducts = data;



      // ══ INJECT MARQUEE DYNAMIC VALUES ══
    (function injectMarqueeValues() {
      const settings = products.find(p => p.type === 'settings') || {};
      const cd       = settings.cart_drawer  || {};
      const ab       = settings.announcement_bar || {};
      const stats    = settings.site_stats   || {};

      const freeShipping = cd.free_shipping_threshold || 350;
      const buyQty       = cd.promo_buy_quantity      || 5;
      const getQty       = cd.promo_get_quantity      || 3;
      const members      = stats.members              || 12000;
      const promoCode    = ab.promo_code              || 'PAUL81';
      const discount     = ab.discount_label          || '40%';

      document.querySelectorAll('.marquee-free-shipping').forEach(el => el.textContent = freeShipping);
      document.querySelectorAll('.marquee-buy-qty').forEach(el       => el.textContent = buyQty);
      document.querySelectorAll('.marquee-get-qty').forEach(el       => el.textContent = getQty);
      document.querySelectorAll('.marquee-members').forEach(el       => el.textContent = members.toLocaleString());
      document.querySelectorAll('.marquee-promo-code').forEach(el    => el.textContent = promoCode);

      document.querySelectorAll('.col-marquee-free-shipping').forEach(el => el.textContent = freeShipping);
      document.querySelectorAll('.col-marquee-members').forEach(el       => el.textContent = members.toLocaleString());
      document.querySelectorAll('.col-marquee-discount').forEach(el      => el.textContent = discount);
    })();


      // ══════════════════════════════════════════
      //  BBW FEATURED — vitrine home (designs originaux BBW4LIFE)
      // ══════════════════════════════════════════
      (function renderBbwFeaturedHome() {
        const section = document.getElementById('bbw-nb-section');
        const grid    = document.getElementById('bbw-nb-grid');
        if (!section || !grid) return;

        const settings = products.find(p => p.type === 'settings') || {};
        const cfg = settings.bbw_featured_home || {};
        const ids = cfg.product_ids || [];
        if (!ids.length) { section.style.display = 'none'; return; }

        const photoImg = document.getElementById('bbw-nb-photo-img');
        const photoPreloadLogo = document.getElementById('bbwNbPhotoPreloadLogo');
        const photoSkeleton = document.getElementById('bbwNbPhotoSkeleton');
        if (photoImg && cfg.photo) {
          if (photoPreloadLogo) {
            const revealPhoto = () => {
              photoPreloadLogo.classList.add('is-loaded');
              if (photoSkeleton && photoSkeleton.parentNode) photoSkeleton.parentNode.removeChild(photoSkeleton);
            };
            photoImg.addEventListener('load', revealPhoto, { once: true });
            photoImg.addEventListener('error', revealPhoto, { once: true });
          }
          photoImg.src = cfg.photo;
          if (photoPreloadLogo && photoImg.complete && photoImg.naturalWidth > 0) {
            photoPreloadLogo.classList.add('is-loaded');
            if (photoSkeleton && photoSkeleton.parentNode) photoSkeleton.parentNode.removeChild(photoSkeleton);
          }
        }

        const taglineEl = document.getElementById('bbw-nb-tagline');
        if (taglineEl && cfg.tagline) taglineEl.textContent = cfg.tagline;

        const prods = ids
          .map(id => products.find(p => p.id === id))
          .filter(Boolean);
        if (!prods.length) { section.style.display = 'none'; return; }

        grid.innerHTML = ''; // retire un éventuel skeleton avant de remplir

        prods.forEach(prod => {
          const productUrl = getProductUrl(prod.id);
          const imgMain     = upgradeShopifyImageUrl(prod.image, 600);
          const price       = parseFloat(prod.price || 0).toFixed(2);
          const rating      = parseFloat(prod.rating || 0);
          const reviews     = prod.reviews_count || 0;
          const fullStars   = Math.round(rating);

          let starsHTML = '';
          for (let i = 0; i < 5; i++) {
            starsHTML += `<i class="fas fa-star${i < fullStars ? '' : ' bbw-nb-card__star--empty'}"></i>`;
          }

          const badgeText = (prod.badge && prod.badge.text) ? prod.badge.text : 'New';

          const card = document.createElement('div');
          card.className = 'bbw-nb-card';
          card.innerHTML = `
            <a href="${productUrl}" class="bbw-nb-card__media">
              <span class="bbw-nb-card__badge">${badgeText}</span>
              <img src="${imgMain}" alt="${prod.title}" loading="lazy">
            </a>
            <div class="bbw-nb-card__body">
              <a href="${productUrl}" class="bbw-nb-card__title">${prod.title}</a>
              <div class="bbw-nb-card__price">$${price}</div>
              <div class="bbw-nb-card__rating">
                <span class="bbw-nb-card__stars">${starsHTML}</span>
                <span class="bbw-nb-card__count">(${reviews})</span>
              </div>
              <a href="${productUrl}" class="bbw-nb-card__btn">View Product</a>
            </div>`;
          grid.appendChild(card);
        });
      })();


      // ══════════════════════════════════════════
      //  WIDGET VISIBILITY PER PAGE
      // ══════════════════════════════════════════
      (function applyWidgetVisibility() {
        const settings = products.find(p => p.type === 'settings') || {};
        const wv = settings.widget_visibility;
        if (!wv) return;

        const currentPath = window.location.pathname;
        const pages = wv.pages || [];

        const isProductPage = !!document.querySelector('.product-section');
        const isHomePage    = currentPath === '/' || currentPath === '/index.html' || currentPath === '';

        // Only apply on listed pages
        const matches = pages.some(p => {
          if (p === 'ALL_PRODUCT_PAGES') return isProductPage;
          if (p === 'HOME_PAGE') return isHomePage;
          return currentPath.endsWith(p) || currentPath === p || currentPath.includes(p);
        });

        if (!matches) return;

        const widgetMap = {
          'cf_chat_toggle': document.getElementById('cf-chat-toggle'),
          'paul_trigger':   document.querySelector('.paul-indicator-wrapper'),
          'floating_nav':   document.getElementById('floating-nav'),
          'audio_player':   document.getElementById('audio-player')
        };

        Object.entries(widgetMap).forEach(([key, el]) => {
          if (!el) return;
          const show = (wv[key] || 'yes').toLowerCase() === 'yes';
          el.style.setProperty('display', show ? '' : 'none', 'important');
        });
      })();

      // ── Inject audio src from settings ──
    (function injectAudioSrc() {
      const settings = products.find(p => p.type === 'settings') || {};
      const ap = settings.audio_player || {};
      if (ap.src && audio) {
        const source = audio.querySelector('source');
        if (source) {
          source.src = ap.src;
          audio.load();
        }
      }
    })();



  

 // ====================== INJECT SITE STATS ======================
(function injectSiteStats() {
  const settings = products.find(p => p.type === 'settings') || {};
  const s = settings.site_stats || {};
  if (!Object.keys(s).length) return;

  // Counters → data-target
  document.querySelectorAll('[data-stat-counter]').forEach(el => {
    const key = el.dataset.statKey;
    if (key && s[key] !== undefined) {
      el.setAttribute('data-target', s[key]);
      el.textContent = '0';
    }
  });

  // Text → textContent
  document.querySelectorAll('[data-stat-text]').forEach(el => {
    const key = el.dataset.statKey;
    if (key && s[key] !== undefined) {
      const val = s[key];
      el.textContent = (typeof val === 'number' && val >= 1000)
        ? (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'K'
        : val;
    }
  });



  // Bars → data-fill (% calculé depuis data-stat-max)
  document.querySelectorAll('[data-stat-bar]').forEach(el => {
    const key = el.dataset.statKey;
    const max = parseFloat(el.dataset.statMax) || 100;
    if (key && s[key] !== undefined) {
      const pct = Math.min((s[key] / max) * 100, 100);
      el.setAttribute('data-fill', pct.toFixed(1));
    }
  });

  // Ring → data-fill (% calculé depuis data-stat-max)
  document.querySelectorAll('[data-stat-ring]').forEach(el => {
    const key = el.dataset.statKey;
    const max = parseFloat(el.dataset.statMax) || 100;
    if (key && s[key] !== undefined) {
      const pct = Math.min((s[key] / max) * 100, 100);
      el.setAttribute('data-fill', pct.toFixed(1));
    }
  });

})();
// ====================== END INJECT SITE STATS ======================



      // ══ SHOP HIGHLIGHT — index.html ══
(function initShopHighlight() {
    const cards = document.querySelectorAll('.highlight-product-card[data-highlight-index]');
    if (!cards.length) return;

    const realProducts = products.filter(p => !p.type);

    cards.forEach(card => {
        const index   = parseInt(card.dataset.highlightIndex);
        const prod    = realProducts[index];
        if (!prod) return;

        const img   = card.querySelector('img');
        const title = card.querySelector('h3');
        const link  = card.querySelector('.highlight-product-link');

        const productUrl = getProductUrl(prod.id);

        if (img) {
            img.src = upgradeShopifyImageUrl(prod.image);
            img.alt = prod.title;
        }
        if (title) {
            title.textContent = prod.title;
        }
        if (link) {
            link.href = productUrl;
        }

        // Hover image swap
        if (prod.image_hover && img) {
            const preload = new Image();
            preload.src = upgradeShopifyImageUrl(prod.image_hover);
            card.addEventListener('mouseenter', () => { img.src = upgradeShopifyImageUrl(prod.image_hover); });
            card.addEventListener('mouseleave', () => { img.src = upgradeShopifyImageUrl(prod.image); });
        }
    });
})();




      const settings = products.find(p => p.type === "settings") || {};

      const accordionDays = document.getElementById('accordion-delivery-days');
      if (accordionDays && settings.shipping_standard_delay) {
        accordionDays.textContent = settings.shipping_standard_delay;
      }

      // ── Inject free_shipping_threshold into header spans ──
    (function injectFreeShippingHeader() {
      const threshold = (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold)
        ? settings.cart_drawer.free_shipping_threshold
        : 75;
      document.querySelectorAll('.hdr-free-shipping-threshold').forEach(el => {
        el.textContent = threshold;
      });
    })();

      // ── Inject loyalty_points_per_order into header spans ──
    (function injectLoyaltyPointsHeader() {
      const points = settings.loyalty_points_per_order || 10;
      document.querySelectorAll('.hdr-loyalty-points').forEach(el => {
        el.textContent = points;
      });
    })();


    // ════════════════════════════════════════════════
//  THUMBNAILS LAYOUT — DESKTOP & MOBILE
//  Lit les settings yes/no et applique les classes CSS
// ════════════════════════════════════════════════
(function initThumbnailsLayout() {

    const mediaEl = document.querySelector('.product-media');
    if (!mediaEl) return;

    /* ── DESKTOP ── */
    const desktopVertical   = (settings.thumbnails_desktop_vertical_left   || 'yes').toLowerCase().trim() === 'yes';
    const desktopHorizontal = (settings.thumbnails_desktop_horizontal_below || 'no').toLowerCase().trim() === 'yes';

    /* ── MOBILE ── */
    const mobileHorizontal = (settings.thumbnails_mobile_horizontal   || 'yes').toLowerCase().trim() === 'yes';
    const mobileVertical   = (settings.thumbnails_mobile_vertical_left || 'no').toLowerCase().trim() === 'yes';

    /* ── Nettoyer toutes les classes ── */
    mediaEl.classList.remove(
        'thumbs-desktop-vertical-left',
        'thumbs-desktop-horizontal-below',
        'thumbs-mobile-horizontal',
        'thumbs-mobile-vertical-left'
    );

    /* ── Appliquer DESKTOP (vertical_left prioritaire si les deux sont yes) ── */
    if (desktopVertical) {
        mediaEl.classList.add('thumbs-desktop-vertical-left');
    } else if (desktopHorizontal) {
        mediaEl.classList.add('thumbs-desktop-horizontal-below');
    } else {
        /* fallback si les deux sont no */
        mediaEl.classList.add('thumbs-desktop-vertical-left');
    }

    /* ── Appliquer MOBILE (horizontal prioritaire si les deux sont yes) ── */
    if (mobileHorizontal) {
        mediaEl.classList.add('thumbs-mobile-horizontal');
    } else if (mobileVertical) {
        mediaEl.classList.add('thumbs-mobile-vertical-left');
    } else {
        /* fallback si les deux sont no */
        mediaEl.classList.add('thumbs-mobile-horizontal');
    }

})();

(function initBxgxBannerWidget() {
    const widget = document.getElementById('bbwBxgxWidget');
    if (!widget) return;

    /* Pages BBW Features (First Edition / Request) exclues — même liste que
       les autres exclusions produit de cette page. */
    const BBW_FEATURED_IDS_BXGX = [
        'Pdg-Francenel-product69','Pdg-Francenel-product70','Pdg-Francenel-product71',
        'Pdg-Francenel-product72','Pdg-Francenel-product73','Pdg-Francenel-product74',
        'Pdg-Francenel-product75',
        'Pdg-Francenel-product98','Pdg-Francenel-product99','Pdg-Francenel-product100',
        'Pdg-Francenel-product101','Pdg-Francenel-product102','Pdg-Francenel-product103',
        'Pdg-Francenel-product104','Pdg-Francenel-product105','Pdg-Francenel-product106',
        'Pdg-Francenel-product107','Pdg-Francenel-product108','Pdg-Francenel-product109',
        'Pdg-Francenel-product110'
    ];
    const productSection = document.querySelector('.product-section');
    const pid = productSection ? productSection.dataset.productId : null;
    if (pid && BBW_FEATURED_IDS_BXGX.includes(pid)) return;

    const cd     = settings.cart_drawer || {};
    const showIt = (cd.show_banner_bxgx_widget || 'Yes').toLowerCase().trim() === 'yes';
    const buyQty = parseInt(cd.promo_buy_quantity) || 0;
    const getQty = parseInt(cd.promo_get_quantity) || 1;
    if (!showIt || !buyQty) return;

    const titleEl   = document.getElementById('bbwBxgxTitle');
    const fillEl    = document.getElementById('bbwBxgxFill');
    const tooltipEl = document.getElementById('bbwBxgxTooltip');
    const pctEl     = document.getElementById('bbwBxgxPct');
    const countEl   = document.getElementById('bbwBxgxCount');
    const msgEl     = document.getElementById('bbwBxgxMsg');

    const giftWord  = getQty > 1 ? 'FREE Gifts' : 'FREE Gift';
    const titleDefault = `Buy ${buyQty}, Get ${getQty} ${giftWord}!`;
    const titleUnlocked = `Congratulations! Your ${getQty} ${giftWord} ${getQty > 1 ? 'are' : 'is'} waiting — checkout now!`;

    if (titleEl) titleEl.textContent = titleDefault;

    function render() {
        let cartNow = [];
        try { cartNow = JSON.parse(localStorage.getItem('cart')) || []; } catch (e) {}
        const paidQty = cartNow.filter(i => !i.isFreePromo).reduce((sum, i) => sum + (i.quantity || 0), 0);

        const clamped = Math.min(paidQty, buyQty);
        const pct = buyQty > 0 ? Math.round((clamped / buyQty) * 100) : 0;
        const unlocked = paidQty >= buyQty;

        if (fillEl) fillEl.style.width = pct + '%';
        if (tooltipEl) tooltipEl.textContent = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
        if (countEl) countEl.textContent = `${clamped}/${buyQty}`;
        widget.classList.toggle('is-active', paidQty > 0);
        widget.classList.toggle('is-unlocked', unlocked);

        if (titleEl) titleEl.textContent = unlocked ? titleUnlocked : titleDefault;

        if (msgEl) {
            const giftLabel = getQty > 1 ? `${getQty} free gifts` : 'free gift';
            if (unlocked) {
                msgEl.textContent = `You've unlocked your ${giftLabel} from BBW4LIFE!`;
            } else {
                const remaining = buyQty - paidQty;
                msgEl.textContent = `Get ${getQty} FREE — only ${remaining} more to go!`;
            }
        }

        widget.style.display = 'block';
    }

    render();
    document.addEventListener('cart:update', render);
})();

      // ══ THEME COLOR META ══
      const themeColor = settings.theme_color || '#c0385e';
      const themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      themeMeta.content = themeColor;
      document.head.appendChild(themeMeta);


      // ══ SANAICA BANNER ══
      (function initSanaicaBanner() {
        const banner = document.getElementById('sanaica-banner-paul');
        if (!banner) return;

        const sb = settings.sanaica_banner || {};

        if ((sb.show || 'Yes').toLowerCase() !== 'yes') {
          banner.style.display = 'none';
          return;
        }

        if (sb.video_url) {
          const video        = banner.querySelector('.sanaica-banner-paul-video');
          const videoWrapper = banner.querySelector('.sanaica-banner-paul-video-wrapper');
          if (video)        video.src = sb.video_url;
          if (videoWrapper) videoWrapper.style.display = 'block';
        }

        // ── Placeholder shimmer : reste visible tant que les images du
        //    carrousel n'ont pas fini de charger, pour éviter un flash de
        //    fond vide (même principe que le hero banner de la home) ──
        const placeholderEl = banner.querySelector('#sanaicaBannerPlaceholder');
        const bannerImgEls  = Array.from(banner.querySelectorAll('.sanaica-banner-paul-image'));
        let loadedCount = 0;

        function hideSanaicaPlaceholder() {
          if (!placeholderEl) return;
          placeholderEl.style.opacity = '0';
          setTimeout(() => {
            if (placeholderEl.parentNode) placeholderEl.parentNode.removeChild(placeholderEl);
          }, 500);
        }

        function onOneImageSettled() {
          loadedCount++;
          if (loadedCount >= bannerImgEls.length) hideSanaicaPlaceholder();
        }

        bannerImgEls.forEach((img, i) => {
          const slide = sb.slides && sb.slides[i];
          if (!slide) { onOneImageSettled(); return; }
          img.alt = slide.alt;
          if (img.complete && img.naturalWidth > 0 && img.src === slide.image) {
            onOneImageSettled();
          } else {
            img.addEventListener('load',  onOneImageSettled, { once: true });
            img.addEventListener('error', onOneImageSettled, { once: true });
            img.src = slide.image;
          }
        });

        if (!bannerImgEls.length) hideSanaicaPlaceholder();
      })();

      // ══ INJECT AUTH POPUP TEXTS FROM SETTINGS ══
        (function injectAuthPopupTexts() {
            const ap = settings.auth_popup || {};

            const set = (id, text) => {
                const el = document.getElementById(id);
                if (el && text) el.textContent = text;
            };

            set('paul-offer-title',      ap.offer_title);
            set('paul-offer-subtitle',   ap.offer_subtitle);
            set('paul-login-title',      ap.login_title);
            set('paul-login-btn',        ap.login_btn);
            set('paul-login-switch',     ap.login_switch);
            set('goToSignup',            ap.login_switch_link);
            set('paul-signup-title',     ap.signup_title);
            set('paul-signup-btn',       ap.signup_btn);
            set('paul-signup-switch',    ap.signup_switch);
            set('goToLogin',             ap.signup_switch_link);
            set('paul-newsletter-label', ap.signup_newsletter_label);
            set('paul-remember-label',   ap.signup_remember_label);
            set('paul-tooltip-text',     ap.tooltip_text);
            set('paul-forgot-title',     ap.forgot_title     || 'Reset Password');
            set('paul-forgot-btn',       ap.forgot_btn       || 'Reset My Password');
            set('goToForgot',            ap.forgot_link      || 'Forgot Password?');
            const fpEmail   = document.getElementById('forgot-email');
            const fpNew     = document.getElementById('forgot-new-password');
            const fpConfirm = document.getElementById('forgot-confirm-password');
            if (fpEmail)   fpEmail.placeholder   = ap.forgot_email_placeholder   || 'Enter your account email';
            if (fpNew)     fpNew.placeholder     = ap.forgot_new_password_placeholder || 'New password';
            if (fpConfirm) fpConfirm.placeholder = ap.forgot_confirm_password_placeholder || 'Confirm new password';
        })();
          // ── Chat widget inject ──
          (function() {
            const w     = settings.chat_widget      || {};
            const chips = settings.chat_quick_chips || [];

            const logo = document.getElementById('cf-agent-logo');
            if (logo && w.agent_logo) {
              logo.src = w.agent_logo;
              logo.onerror = () => { logo.style.display = 'none'; };
              logo.style.display = 'block';
            }

            const nameEl = document.getElementById('cf-agent-name');
            if (nameEl) {
              nameEl.innerHTML = (w.agent_name || 'Curva')
                + (w.agent_badge ? ` <span class="cf-ai-badge">${w.agent_badge}</span>` : '');
            }

            const titleEl = document.getElementById('cf-agent-title');
            if (titleEl) titleEl.textContent = w.agent_title || 'CurvaFit Fitness Expert';

            const typingEl = document.getElementById('cf-typing-label');
            if (typingEl) typingEl.textContent = w.typing_label || 'Curva is typing…';

            const inputEl = document.getElementById('cf-input');
            if (inputEl) inputEl.placeholder = w.input_placeholder || 'Ask me anything…';

            const hintEl = document.getElementById('cf-powered-by');
            if (hintEl) hintEl.textContent = w.powered_by || 'Powered by CurvaFit AI · Press Enter to send';

            const chipsContainer = document.getElementById('cf-quick-chips');
            if (chipsContainer && chips.length) {
              chipsContainer.innerHTML = chips.map(chip => `
                <button class="cf-chip" data-msg="${chip.msg.replace(/"/g, '&quot;')}">
                  <i class="${chip.icon}"></i> ${chip.label}
                </button>
              `).join('');

              chipsContainer.querySelectorAll('.cf-chip').forEach(btn => {
                btn.addEventListener('click', () => {
                  const msg = btn.getAttribute('data-msg');
                  if (msg && typeof window.__cfSendMessage === 'function') {
                    window.__cfSendMessage(msg);
                  }
                });
              });
            }
          })();


      const plansAvailable = (settings.plans_available || 'no').toLowerCase() === 'yes';
      document.querySelectorAll('.plan-request-trigger-wrap').forEach(wrap => {
        wrap.style.display = plansAvailable ? 'none' : '';
      });
      // Free shipping threshold → risk-reversal section
      const freeShippingThreshold = (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold)
        ? settings.cart_drawer.free_shipping_threshold
        : 75;
      document.querySelectorAll('.rr-pillar').forEach(pillar => {
      const strong = pillar.querySelector('strong');
      if (strong && strong.textContent.trim() === 'Free Shipping') {
        const span = pillar.querySelector('span:last-child'); // ← cibler le dernier span
        if (span) span.textContent = `On orders over $${freeShippingThreshold}`;
      }
    });
     
    // ══ INJECT NEWSLETTER POPUP TEXTS FROM SETTINGS ══
    (function injectNewsletterPopupTexts() {
      const np = settings.newsletter_popup || {};

      const popup     = document.getElementById('newsletter-popup');
      if (!popup) return;

      const iconEl    = popup.querySelector('.popup-icon i');
      const titleEl   = popup.querySelector('.popup-content h3');
      const messageEl = popup.querySelector('.popup-content p');
      const closeEl   = document.getElementById('popup-close-btn');

      if (iconEl && np.icon) {
        iconEl.className = `fi ${np.icon}`;
      }
      if (titleEl   && np.title)     titleEl.textContent   = np.title;
      if (messageEl && np.message)   messageEl.textContent = np.message;
      if (closeEl   && np.close_btn) closeEl.textContent   = np.close_btn;
    })();


      const btnLabels = settings.button_labels || {};
      const L = {
        addToCart:   btnLabels.add_to_cart    || 'Add to Cart',
        buyNow:      btnLabels.buy_now        || 'Buy Now',
        shopNow:     btnLabels.shop_now       || 'Shop Now',
        checkout:    btnLabels.checkout       || 'Checkout',
        addAll:      btnLabels.add_all_to_cart|| 'Add All to Cart',
        viewProduct: btnLabels.view_product   || 'View Product →'
      };

      document.querySelectorAll('.add-to-cart').forEach(btn => {
        if (!btn.closest('.bundle-save-container')) btn.innerHTML = `<i class="fi fi-rr-shopping-cart"></i> ${L.addToCart}`;
      });
      document.querySelectorAll('.buy-now').forEach(btn => {
        btn.innerHTML = `<i class="fi fi-rr-bolt"></i> ${L.buyNow}`;
      });
      document.querySelectorAll('.flash-deal__cta, .ba-cta, .empty-cart .cta').forEach(btn => {
        btn.textContent = `${L.shopNow} →`;
      });
      document.querySelectorAll('.checkout').forEach(btn => btn.textContent = L.checkout);
      document.querySelectorAll('.add-all-to-cart').forEach(btn => btn.textContent = L.addAll);
      document.querySelectorAll('.bundle-add-btn').forEach(btn => {
        const type = btn.closest('.bundle-option')?.dataset.bundle;
        if (type === 'single') btn.textContent = btnLabels.bundle_single || 'Add to Cart & Checkout';
        else if (type === 'duo')  btn.textContent = btnLabels.bundle_duo  || 'Add 2 Items & Checkout';
        else if (type === 'trio') btn.textContent = btnLabels.bundle_trio || 'Add 3 Items & Checkout';
      });


      const enableMediaZoom = (settings.enable_media_zoom || "no").toLowerCase() === "yes";

      // PATCH 2 — Désactiver complètement le zoom si "no"
    if (!enableMediaZoom) {
        const noZoomStyle = document.createElement('style');
        noZoomStyle.id = 'no-zoom-style';
        noZoomStyle.textContent = `
            .main-image img { transform: none !important; cursor: default !important; }
            .main-image:hover img { transform: none !important; }
            #media-zoom-modal { display: none !important; pointer-events: none !important; }
            .bbw-zoom-lens, .bbw-zoom-pane { display: none !important; }
        `;
        document.head.appendChild(noZoomStyle);
    }


      // ══════════════════════════════════════════
      //  FEATURED SPOTLIGHT — dynamique depuis settings
      // ══════════════════════════════════════════
      (function initFeaturedSpotlight() {
        const spotlightId = settings.featured_spotlight && settings.featured_spotlight.product_id;
        if (!spotlightId) return;

        const prod = products.find(p => p.id === spotlightId);
        if (!prod) return;

        const section = document.getElementById('featured-spotlight');
        if (!section) return;

        // Titre
        const titleEl = section.querySelector('.fs-title');
        if (titleEl) titleEl.textContent = prod.title;

        // Catégorie
        const catEl = section.querySelector('.fs-category');
        if (catEl) catEl.textContent = 'FEATURED · MOST POPULAR';

        // Prix
        const priceEl = section.querySelector('.fs-price');
        if (priceEl) priceEl.textContent = `$${prod.price.toFixed(2)}`;

        const compareEl = section.querySelector('.fs-compare');
        if (compareEl) compareEl.textContent = `$${prod.compare_price.toFixed(2)}`;

        const discountTagEl = section.querySelector('.fs-discount-tag');
        if (discountTagEl && prod.compare_price > prod.price) {
          const pct = Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100);
          discountTagEl.textContent = `-${pct}%`;
        }

        // Description
        const descEl = section.querySelector('.fs-desc');
        if (descEl) descEl.textContent = prod.description;

        // Rating & reviews
        const starsEl = section.querySelector('.fs-stars');
        const countEl = section.querySelector('.fs-count');
        const rating = prod.rating || 4.8;
        const reviewsCount = prod.reviews_count || 0;

        if (starsEl) {
          starsEl.innerHTML = '';
          for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'unique-star';
            if (i <= Math.floor(rating)) {
              star.classList.add('full');
            } else if (i - rating < 1 && i - rating > 0) {
              star.classList.add('half');
            }
            starsEl.appendChild(star);
          }
        }
        if (countEl) countEl.textContent = `${rating.toFixed(1)} · ${reviewsCount.toLocaleString()} reviews`;

        // Badge depuis le produit
        const fsBadgeFloat = section.querySelector('.fs-badge-float');
        if (fsBadgeFloat) {
          if (prod.badge && prod.badge.text) {
            fsBadgeFloat.textContent = prod.badge.text;
            fsBadgeFloat.style.display = '';
          } else {
            fsBadgeFloat.style.display = 'none';
          }
        }

        // Image principale — première image media
        const mainImg = section.querySelector('.fs-main-img');
        const media = prod.media || [];
        if (mainImg && media.length > 0) {
          mainImg.src = upgradeShopifyImageUrl(media[0]);
          mainImg.alt = prod.title;
        }

        // Thumbnails — 3 premières images media
        const thumbs = section.querySelectorAll('.fs-thumb');
        thumbs.forEach((thumb, i) => {
          const src = media[i] ? upgradeShopifyImageUrl(media[i]) : '';
          if (src) {
            thumb.src = src;
            thumb.alt = `${prod.title} ${i + 1}`;
            thumb.style.display = 'block';

            // Clic thumbnail → change image principale
            thumb.addEventListener('click', () => {
              if (mainImg) mainImg.src = src;
              // Active state
              thumbs.forEach(t => t.classList.remove('fs-thumb--active'));
              thumb.classList.add('fs-thumb--active');
            });
          } else {
            thumb.style.display = 'none';
          }
        });

        // Activer le premier thumbnail par défaut
        if (thumbs[0]) thumbs[0].classList.add('fs-thumb--active');

        // Lien "View Product"
        const viewBtn = section.querySelector('.fs-btn-primary');
        if (viewBtn) viewBtn.href = getProductUrl(spotlightId);

        // Stock dynamique
          if (prod.cj_id) {
            const fsStock = section.querySelector('.fs-stock');
            if (fsStock) {
              fsStock.innerHTML = '⏳ Checking stock...';
              fetch(`/.netlify/functions/get-product-stock?cj_id=${prod.cj_id}`)
                .then(r => r.json())
                .then(stockData => {
                  if (stockData.success && stockData.totalStock !== null) {
                    const inventoryMode = (settings.inventory_display_mode || 'anderson').toLowerCase().trim();
                    const s = inventoryMode === 'francenel'
                      ? stockData.totalStock
                      : capDisplayStock(stockData.totalStock);
                    const color = s <= 100 ? '🔴' : s <= 200 ? '🟡' : '🟢';
                    fsStock.innerHTML = `${color} Only <strong>${s} left</strong> in stock`;
                  } else {
                    fsStock.style.display = 'none';
                  }
                })
                .catch(() => { fsStock.style.display = 'none'; });
            }
          }
      })();

      // ══════════════════════════════════════════
      //  BUNDLE DEAL — dynamique depuis settings
      // ══════════════════════════════════════════
      (function initBundleDeal() {
        const bd = settings.bundle_deal;
        if (!bd) return;

        const section = document.getElementById('bundle-deal');
        if (!section) return;

        const titleEl = section.querySelector('.bd-header h2');
        if (titleEl) titleEl.textContent = bd.title || '';
        const subEl = section.querySelector('.bd-header p');
        if (subEl) subEl.textContent = bd.subtitle || '';

        const bdProducts = (bd.products || []).map(entry => {
          return { ...entry, product: products.find(p => p.id === entry.id) };
        }).filter(e => e.product);

        if (!bdProducts.length) return;

        const productItemsEl = section.querySelector('.bd-products');
        if (productItemsEl) {
          productItemsEl.innerHTML = '';
          bdProducts.forEach((entry, idx) => {
            const prod = entry.product;
            const firstVariant = prod.variants && prod.variants.length ? prod.variants[0] : null;
            const price = firstVariant ? firstVariant.price : prod.price;

            const item = document.createElement('div');
            item.className = 'bd-product-item';
            item.dataset.productId = prod.id;
            item.dataset.variantId = firstVariant ? firstVariant.vid : '';
            item.dataset.price = price;

            const productUrl = getProductUrl(prod.id);

            item.innerHTML = `
              <a href="${productUrl}" class="bd-product-item__media">
                <img src="${upgradeShopifyImageUrl(prod.image)}" alt="${prod.title}" loading="lazy">
              </a>
              <div class="bd-product-info">
                <a href="${productUrl}" class="bd-product-item__title"><strong>${prod.title}</strong></a>
                <span>${entry.subtitle || prod.description}</span>
              </div>
              <span class="bd-product-price">$${price.toFixed(2)}</span>
            `;

            productItemsEl.appendChild(item);

            if (idx < bdProducts.length - 1) {
              const plus = document.createElement('div');
              plus.className = 'bd-plus';
              plus.textContent = '+';
              productItemsEl.appendChild(plus);
            }
          });
        }

        const totalPrice = bdProducts.reduce((sum, entry) => {
          const firstVariant = entry.product.variants && entry.product.variants.length ? entry.product.variants[0] : null;
          return sum + (firstVariant ? firstVariant.price : entry.product.price);
        }, 0);

        const totalCompare = bdProducts.reduce((sum, entry) => {
          return sum + entry.product.compare_price;
        }, 0);

        const savings = totalCompare - totalPrice;

        const originalEl = section.querySelector('.bd-original');
        if (originalEl) originalEl.innerHTML = `Original: <s>$${totalCompare.toFixed(2)}</s>`;

        const saveEl = section.querySelector('.bd-save');
        if (saveEl) saveEl.innerHTML = `${bd.savings_label || 'You Save:'} <strong>$${savings.toFixed(2)}</strong>`;

        const totalEl = section.querySelector('.bd-total');
        if (totalEl) totalEl.innerHTML = `Bundle Price: <strong class="bd-total-price">$${totalPrice.toFixed(2)}</strong>`;

        const ctaEl = section.querySelector('.bd-cta');
        if (ctaEl) {
          ctaEl.textContent = `${bd.cta_label || 'Get The Bundle'} — $${totalPrice.toFixed(2)}`;

          ctaEl.addEventListener('click', function(e) {
            e.preventDefault();

            bdProducts.forEach(entry => {
              const prod = entry.product;
              const firstVariant = prod.variants && prod.variants.length ? prod.variants[0] : null;
              const price = firstVariant ? firstVariant.price : prod.price;
              const color = firstVariant ? firstVariant.color || null : null;
              const size = firstVariant ? (firstVariant.size || null) : null;
              const colorObj = (color && prod.colors) ? prod.colors.find(c => c.name === color) : null;
              const image = colorObj ? colorObj.image || prod.image : prod.image;

              let existing = cart.find(i => i.id === prod.id && i.color === color && i.size === size);
              if (existing) {
                existing.quantity += 1;
              } else {
                cart.push({
                  id: prod.id,
                  title: prod.title,
                  price: price,
                  compare_price: prod.compare_price,
                  image: upgradeShopifyImageUrl(image || prod.image),
                  size: size || null,
                  color: color || null,
                  quantity: 1,
                  fromBundle: true,
                  cj_product_id: prod.cj_id,
                  cj_variant_id: firstVariant ? firstVariant.vid : null
                });
              }
            });

            saveCart();
            updateCartQuantityInSheet();
            updateBadges();
            renderCart();
            localStorage.setItem('checkoutCart', JSON.stringify(cart));
            window.location.href = '/checkout/checkout.html';
          });
        }
      })();

      // ══════════════════════════════════════════
      //  FLASH DEAL — heures depuis settings
      // ══════════════════════════════════════════
      (function initFlashDeal() {
        const fd = settings.flash_deal || {};
        const hours = parseInt(fd.hours) || 8;

        const KEY = 'flashDealEnd';
        const totalSeconds = hours * 3600;
        let end = parseInt(localStorage.getItem(KEY) || '0');
        const now = Date.now();

        if (!end || end <= now) {
          end = now + totalSeconds * 1000;
          localStorage.setItem(KEY, end);
        }

        function tick() {
          const rem = Math.max(0, Math.floor((end - Date.now()) / 1000));
          if (rem === 0) {
            end = Date.now() + totalSeconds * 1000;
            localStorage.setItem(KEY, end);
          }
          const ftH = document.getElementById('ft-hours');
          const ftM = document.getElementById('ft-mins');
          const ftS = document.getElementById('ft-secs');
          if (ftH) ftH.textContent = String(Math.floor(rem / 3600)).padStart(2, '0');
          if (ftM) ftM.textContent = String(Math.floor((rem % 3600) / 60)).padStart(2, '0');
          if (ftS) ftS.textContent = String(rem % 60).padStart(2, '0');
        }

        tick();
        setInterval(tick, 1000);
      })();

      // ══════════════════════════════════════════
      //  SOCIAL PROOF WALL — slider mobile uniquement
      // ══════════════════════════════════════════
      (function initSocialProofSlider() {
        const reviewsContainer = document.querySelector('.social-proof-wall .spw-reviews');
        if (!reviewsContainer) return;

        const cards = Array.from(reviewsContainer.querySelectorAll('.spw-review-card'));
        if (cards.length <= 1) return;

        let track = null;
        let dotsContainer = null;
        let current = 0;
        let timer = null;

        function buildSlider() {
          if (track) return;

          track = document.createElement('div');
          track.className = 'spw-reviews-track';
          cards.forEach(card => track.appendChild(card));
          reviewsContainer.appendChild(track);

          dotsContainer = document.createElement('div');
          dotsContainer.className = 'spw-dots';
          cards.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'spw-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Review ${i + 1}`);
            dot.addEventListener('click', () => { goToSlide(i); resetTimer(); });
            dotsContainer.appendChild(dot);
          });
          reviewsContainer.parentElement.insertBefore(dotsContainer, reviewsContainer.nextSibling);
        }

        function destroySlider() {
          if (!track) return;
          cards.forEach(card => reviewsContainer.appendChild(card));
          track.remove();
          track = null;
          if (dotsContainer) { dotsContainer.remove(); dotsContainer = null; }
          if (timer) { clearInterval(timer); timer = null; }
        }

        function goToSlide(index) {
          current = index;
          if (track) track.style.transform = `translateX(-${current * 100}%)`;
          if (dotsContainer) {
            dotsContainer.querySelectorAll('.spw-dot').forEach((d, i) => d.classList.toggle('active', i === current));
          }
        }

        function nextSlide() {
          goToSlide((current + 1) % cards.length);
        }

        function resetTimer() {
          if (timer) clearInterval(timer);
          timer = setInterval(nextSlide, 5000);
        }

        function onResize() {
          const isMobile = window.innerWidth <= 768;
          if (isMobile) {
            buildSlider();
            goToSlide(current);
            resetTimer();
          } else {
            destroySlider();
          }
        }

        window.addEventListener('resize', onResize);
        onResize();
      })();


      // ====================== SOCIAL LINKS ======================
      const socialLinks = settings.social_links || {};
      const socialMap = {
        'fa-facebook-f':  socialLinks.facebook,
        'fa-instagram':   socialLinks.instagram,
        'fa-tiktok':      socialLinks.tiktok,
        'fa-pinterest-p': socialLinks.pinterest,
        'fa-youtube':     socialLinks.youtube,
        'fa-whatsapp':    socialLinks.whatsapp,
        'fa-x-twitter':   socialLinks.twitter
      };
      document.querySelectorAll('.footer-social a').forEach(a => {
        const icon = a.querySelector('i');
        if (!icon) return;
        for (const [cls, url] of Object.entries(socialMap)) {
          if (url && icon.classList.contains(cls)) {
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            break;
          }
        }
      });


      // ====================== MOBILE NAV SOCIAL LINKS ======================
      document.querySelectorAll('.mobile-nav-footer__social-btn').forEach(a => {
        const social = a.dataset.social;
        const urlMap = {
          facebook:  socialLinks.facebook,
          instagram: socialLinks.instagram,
          tiktok:    socialLinks.tiktok,
          youtube:   socialLinks.youtube,
          pinterest: socialLinks.pinterest,
          whatsapp:  socialLinks.whatsapp,
          twitter:   socialLinks.twitter
        };
        const url = urlMap[social];
        if (url) {
          a.href = url;
        }
      });

      // ====================== PROGRAM PRICES ======================
      const programs = settings.programs || {};
      const programMap = {
        beginner:     programs.beginner     || { price: 99,  label: 'Start Soft Start' },
        intermediate: programs.intermediate || { price: 149, label: 'Start Deeper Refiner' },
        maintenance:  programs.maintenance  || { price: 79,  label: 'Start Forever Fit' }
      };

      document.querySelectorAll('.program-card').forEach(card => {
        const tier = card.id.replace('program-', '');
        const prog = programMap[tier];
        if (!prog) return;
        const priceEl = card.querySelector('.prog-price');
        if (priceEl) priceEl.textContent = `$${prog.price}`;
        const ctaEl = card.querySelector('.prog-cta');
        if (ctaEl) ctaEl.textContent = `${prog.label} →`;
      });

      const priceRow = document.querySelector('.comparison-table-section .price-row');
      if (priceRow) {
        const cells = priceRow.querySelectorAll('td');
        if (cells[1]) cells[1].textContent = `$${programMap.beginner.price}`;
        if (cells[2]) cells[2].textContent = `$${programMap.intermediate.price}`;
        if (cells[3]) cells[3].textContent = `$${programMap.maintenance.price}`;
      }

      const plansOn = (settings.plans_available || 'no').toLowerCase() === 'yes';
    const finalBtns = document.querySelectorAll('.final-cta-btn');
    finalBtns.forEach(btn => {
      if (btn.classList.contains('final-cta-btn--beginner'))
        btn.innerHTML = `<i class="fa-solid fa-seedling"></i> Start Beginner — $${plansOn ? programMap.beginner.price : '0.00'}`;
      else if (btn.classList.contains('final-cta-btn--featured'))
        btn.innerHTML = `<i class="fa-solid fa-fire-flame-curved"></i> Start Intermediate — $${plansOn ? programMap.intermediate.price : '0.00'}`;
      else if (btn.classList.contains('final-cta-btn--maintenance'))
        btn.innerHTML = `<i class="fa-solid fa-star"></i> Start Maintenance — $${plansOn ? programMap.maintenance.price : '0.00'}`;
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

      // ====================== SOCIAL CHANNELS SECTION ======================
      const iconClassMap = {
        'fa-instagram':   socialLinks.instagram,
        'fa-facebook-f':  socialLinks.facebook,
        'fa-tiktok':      socialLinks.tiktok,
        'fa-whatsapp':    socialLinks.whatsapp,
        'fa-youtube':     socialLinks.youtube,
        'fa-pinterest-p': socialLinks.pinterest,
        'fa-x-twitter':   socialLinks.twitter
      };

      document.querySelectorAll('.social-channel-card').forEach(card => {
        const icon = card.querySelector('i');
        if (!icon) return;
        for (const [cls, url] of Object.entries(iconClassMap)) {
          if (url && icon.classList.contains(cls)) {
            card.href = url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            break;
          }
        }
      });

      document.querySelectorAll('.footer-social a').forEach(a => {
        if (a.href && a.href !== window.location.href && a.href !== '#') return;
        for (const [cls, url] of Object.entries(socialMap)) {
          if (url && a.classList.contains(cls)) {
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            break;
          }
        }
      });

      // ====================== COMPARISON TABLE ======================
      const comparisonTable = document.querySelector('.comparison-table tbody');
    if (comparisonTable) {
        const rows = comparisonTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const product = products[index];
            if (product) {
                const titleCell  = row.querySelector('td:nth-child(1)');
                const priceCell  = row.querySelector('td:nth-child(2)');
                const ratingCell = row.querySelector('td:nth-child(5)');
                if (titleCell)  titleCell.textContent  = product.title;
                if (priceCell)  priceCell.textContent  = `$${product.price.toFixed(2)}`;
                if (ratingCell) ratingCell.textContent = product.rating ? `${product.rating}/5` : '—';
            }
        });
    }

      // ====================== PRODUCT CARDS ======================
      document.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.id;
        const product = products.find(p => p.id === id);
        if (product) {
          if (product.url) {
            card.href = product.url;
          }
          card.querySelector('h3').textContent = product.title;
          card.querySelector('.current-price').textContent = `$${product.price.toFixed(2)}`;
          card.querySelector('.compare-price').textContent = `$${product.compare_price.toFixed(2)}`;
          card.querySelector('p').textContent = product.description;
          const img = card.querySelector('img');
          if (img) { img.src = upgradeShopifyImageUrl(product.image, 1000); img.alt = product.title; }
          // ── BADGE depuis products.data.json — coin inférieur droit ──
            let badgeEl = card.querySelector('.product-card-json-badge');
            if (!badgeEl) {
              badgeEl = document.createElement('span');
              badgeEl.className = 'product-card-json-badge';
              // Le wrapper de l'image doit être position:relative
              const imgWrapper = img.parentElement;
              imgWrapper.style.position = 'relative';
              imgWrapper.appendChild(badgeEl);
            }
            if (product.badge && product.badge.text) {
              badgeEl.textContent = product.badge.text;
              badgeEl.style.display = 'block';
            } else {
              badgeEl.style.display = 'none';
            }
          // ── HOVER IMAGE SWAP ──
            if (product.image_hover) {
                const imgHover = upgradeShopifyImageUrl(product.image_hover);
                const preload = new Image();
                preload.src = imgHover;

                card.addEventListener('mouseenter', () => { img.src = imgHover; });
                card.addEventListener('mouseleave', () => { img.src = upgradeShopifyImageUrl(product.image); });

                card.addEventListener('touchstart', () => { img.src = imgHover; }, { passive: true });
                card.addEventListener('touchend', () => { setTimeout(() => { img.src = upgradeShopifyImageUrl(product.image); }, 700); }, { passive: true });
            }

          card.dataset.title = product.title;
          card.dataset.price = product.price;
          card.dataset.comparePrice = product.compare_price;
          const badge = card.querySelector('.discount-badge');
          if (product.compare_price > product.price) {
            const discountPercent = Math.round(((product.compare_price - product.price) / product.compare_price) * 100);
            badge.textContent = `-${discountPercent}%`;
            badge.classList.add('active');
          }
        }
      });


      // ── Mini product slider ──
      const miniSliderEl = document.getElementById('mini-product-slider');
      if (miniSliderEl) {

        const WISHLIST_SVG = `
          <svg class="wishlist-icon-empty" width="30px" height="30px" viewBox="0 0 24 24" fill="none" stroke="#d4b60c" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <svg class="wishlist-icon-filled" width="30px" height="30px" viewBox="0 0 24 24" fill="#fffef7" stroke="#fffef7" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>`;

        const sliderCfg   = (settings.mini_product_slider) || {};
        const sliderTitle = sliderCfg.title || 'Queens Also Love These';
        const sliderIds   = sliderCfg.product_ids || [];

        const titleEl = miniSliderEl.querySelector('.section-title');
        if (titleEl) titleEl.textContent = sliderTitle;

        const sliderTrack = miniSliderEl.querySelector('.product-slider');

        /* ── flags pause ── */
        let miniAutoSliderPaused   = false;
        let miniImageSlidersPaused = false;
        let miniPauseTimer         = null;

        function miniPause() {
          miniAutoSliderPaused   = true;
          miniImageSlidersPaused = true;
          clearTimeout(miniPauseTimer);
          miniPauseTimer = setTimeout(() => {
            miniAutoSliderPaused   = false;
            miniImageSlidersPaused = false;
          }, 3000);
        }

        if (sliderTrack) {
          /* ── Pause sur scroll manuel (desktop + mobile) ── */
          sliderTrack.addEventListener('scroll',     miniPause, { passive: true });

          /* ── Pause sur touch (mobile) ── */
          sliderTrack.addEventListener('touchstart', miniPause, { passive: true });
          sliderTrack.addEventListener('touchmove',  miniPause, { passive: true });

          /* ── Pause sur mousedown + mousemove (desktop drag) ── */
          sliderTrack.addEventListener('mousedown',  miniPause);
          sliderTrack.addEventListener('mousemove',  miniPause);
        }

        /* ── Pause sur scroll manuel de la PAGE tant que la section est visible ── */
        let miniSectionInView = false;
        if ('IntersectionObserver' in window) {
          const miniVisibilityObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => { miniSectionInView = entry.isIntersecting; });
          }, { threshold: 0.15 });
          miniVisibilityObserver.observe(miniSliderEl);

          window.addEventListener('scroll', () => {
            if (miniSectionInView) miniPause();
          }, { passive: true });
          window.addEventListener('touchmove', () => {
            if (miniSectionInView) miniPause();
          }, { passive: true });
        }

        /* ── Injecter les items depuis les IDs du setting ── */
        sliderIds.forEach(pid => {
          const prod = products.find(p => p.id === pid);
          if (!prod) return;

          const productUrl = getProductUrl(pid);
          const item = document.createElement('div');
          item.className        = 'product-item';
          item.dataset.productId = pid;

          item.innerHTML = `
            <div class="product-image">
              <a href="${productUrl}" class="mini-product-link">
                <div class="mini-media-slider" id="mini-slider-${pid}"></div>
              </a>
              <div class="mini-discount-badge"></div>
              <span class="mini-wishlist-icon" data-id="${pid}"></span>
            </div>
            <div class="product-info">
              <p class="product-price">
                <span class="current-price"></span>
                <span class="compare-price"></span>
              </p>
            </div>`;

          sliderTrack.appendChild(item);

          /* Wishlist SVG */
          const wishlistIcon = item.querySelector('.mini-wishlist-icon');
          if (wishlistIcon) wishlistIcon.innerHTML = WISHLIST_SVG;

          /* Prix + badge */
          const currentPriceEl = item.querySelector('.current-price');
          const comparePriceEl = item.querySelector('.compare-price');
          const discountBadge  = item.querySelector('.mini-discount-badge');
          if (currentPriceEl) currentPriceEl.textContent = `$${prod.price.toFixed(2)}`;
          if (comparePriceEl) comparePriceEl.textContent = `$${prod.compare_price.toFixed(2)}`;
          if (discountBadge && prod.compare_price > prod.price) {
            const pct = Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100);
            discountBadge.textContent   = `${pct}% OFF`;
            discountBadge.style.display = 'block';
          } else if (discountBadge) {
            discountBadge.style.display = 'none';
          }

          /* Media slider */
          const sliderDiv = item.querySelector(`#mini-slider-${pid}`);
          if (sliderDiv && prod.media) populateMiniSlider(sliderDiv, prod.media);
        });

        sliderTrack.querySelectorAll('.mini-wishlist-icon').forEach(icon => {
          icon.addEventListener('click', toggleWishlist);
        });
        updateWishlistIcons();

        /* ── Auto-slide produits ── */
        if (sliderTrack) {
          const items = sliderTrack.querySelectorAll('.product-item');
          if (items.length > 1) {
            let currentSlide = 0;

            setInterval(() => {
              if (miniAutoSliderPaused) return;
              currentSlide = (currentSlide + 1) % items.length;
              const itemWidth = items[0].offsetWidth + parseInt(getComputedStyle(sliderTrack).gap || 0);
              sliderTrack.scrollTo({ left: currentSlide * itemWidth, behavior: 'smooth' });
            }, 8000);
          }
        }
      }

      // ── PDP collection grid ("More To Love") ──
      const pdpGridEl = document.getElementById('pdp-grid-section');
      if (pdpGridEl) {

        const PDP_WISHLIST_SVG = `
          <svg class="wishlist-icon-empty" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fffef7" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <svg class="wishlist-icon-filled" width="18" height="18" viewBox="0 0 24 24" fill="#fffef7" stroke="#fffef7" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>`;

        const gridCfg = (settings.pdp_collection_grid) || {};
        const gridIds = gridCfg.product_ids || [];

        const gridTrack = pdpGridEl.querySelector('.pdp-grid');
        let gridCardsBuilt = 0;

        if (gridTrack) {
          gridIds.forEach(pid => {
            const prod = products.find(p => p.id === pid);
            if (!prod) return;

            const productUrl  = getProductUrl(pid);
            const hasDiscount = prod.compare_price > prod.price;
            const discPct     = hasDiscount ? Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100) : 0;
            const badgeIcon   = (prod.badge && prod.badge.icon) ? `<i class="fi ${prod.badge.icon}"></i> ` : '';
            const badgeHTML   = (prod.badge && prod.badge.text) ? `<span class="pdp-grid-card__badge">${badgeIcon}${prod.badge.text}</span>` : '';
            const discHTML    = discPct > 0 ? `<span class="pdp-grid-card__discount">-${discPct}%</span>` : '';
            const discTextHTML = discPct > 0 ? `<span class="pdp-grid-card__discount-text">(-${discPct}%)</span>` : '';
            const compareHTML = hasDiscount ? `<span class="pdp-grid-card__compare">$${parseFloat(prod.compare_price).toFixed(2)}</span>` : '';
            const imgMain     = upgradeShopifyImageUrl(prod.image, 600);

            const swatchColors = (prod.colors || []).filter(c => c.active !== false && c.image);
            const swatchesHTML = swatchColors.length ? `
              <div class="pdp-grid-card__swatches">
                ${swatchColors.map((c, i) => `<img class="pdp-grid-card__swatch${i === 0 ? ' active' : ''}" src="${upgradeShopifyImageUrl(c.image, 80)}" data-full="${upgradeShopifyImageUrl(c.image, 600)}" alt="${c.name}" title="${c.name}" loading="lazy">`).join('')}
              </div>` : '';

            const card = document.createElement('div');
            card.className  = 'pdp-grid-card product-card';
            card.dataset.id = pid;
            card.innerHTML = `
              ${badgeHTML}
              <a href="${productUrl}" class="pdp-grid-card__media">
                <img class="pdp-grid-card__img" src="${imgMain}" alt="${prod.title}" loading="lazy">
                ${discHTML}
                <span class="mini-wishlist-icon pdp-grid-card__wishlist" data-id="${pid}"></span>
                <button type="button" class="pdp-grid-card__cart add-to-cart" aria-label="Add to cart"><i class="fi fi-rr-shopping-cart"></i></button>
              </a>
              <div class="pdp-grid-card__body">
                <a href="${productUrl}" class="pdp-grid-card__title">${prod.title}</a>
                <p class="pdp-grid-card__prices">
                  <span class="pdp-grid-card__price">$${parseFloat(prod.price).toFixed(2)}</span>
                  ${discTextHTML}
                  ${compareHTML}
                </p>
                ${swatchesHTML}
              </div>`;
            gridTrack.appendChild(card);
            gridCardsBuilt++;

            if (swatchColors.length > 0) {
              card.dataset.selectedColor = swatchColors[0].name;
              /* Précharge les images des variantes pour un affichage instantané au clic */
              swatchColors.forEach(c => { new Image().src = upgradeShopifyImageUrl(c.image, 600); });
            }

            const wishIcon = card.querySelector('.pdp-grid-card__wishlist');
            wishIcon.innerHTML = PDP_WISHLIST_SVG;
            wishIcon.addEventListener('click', function (e) { e.preventDefault(); toggleWishlist(e); });

            const cartBtn = card.querySelector('.pdp-grid-card__cart');
            cartBtn.addEventListener('click', function (e) { e.preventDefault(); addToCart(e); });

            const mainImg = card.querySelector('.pdp-grid-card__img');
            card.querySelectorAll('.pdp-grid-card__swatch').forEach(function (swatch) {
              swatch.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                mainImg.src = swatch.dataset.full;
                card.dataset.selectedColor = swatch.alt;
                card.querySelectorAll('.pdp-grid-card__swatch').forEach(function (s) { s.classList.remove('active'); });
                swatch.classList.add('active');
              });
            });
          });
        }

        if (gridCardsBuilt > 0) {
          updateWishlistIcons();
        } else {
          pdpGridEl.style.display = 'none';
        }
      }

      // ══════════════════════════════════════════
      //  SEARCH RESULTS PAGE — /search-results.html
      //  Réutilise le même pattern de card que pdp-grid (ci-dessus) pour
      //  bénéficier directement de addToCart()/toggleWishlist() sans
      //  dupliquer/exposer ces fonctions sur window.
      // ══════════════════════════════════════════
      (function initSearchResultsBridge() {
        const grid = document.getElementById('srGrid');
        if (!grid) return; // pas sur la page search-results

        const PDP_WISHLIST_SVG = `
          <svg class="wishlist-icon-empty" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fffef7" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <svg class="wishlist-icon-filled" width="18" height="18" viewBox="0 0 24 24" fill="#fffef7" stroke="#fffef7" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>`;

        // ── Construction de card, exposée pour search-filters.js ──
        // (garde addToCart()/toggleWishlist() dans leur scope d'origine,
        // sans les exposer directement sur window.)
        function buildResultCard(prod) {
          const productUrl  = getProductUrl(prod.id);
          const hasDiscount = prod.compare_price > prod.price;
          const discPct     = hasDiscount ? Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100) : 0;
          const badgeIcon   = (prod.badge && prod.badge.icon) ? `<i class="fi ${prod.badge.icon}"></i> ` : '';
          const badgeHTML   = (prod.badge && prod.badge.text) ? `<span class="sr-card__badge">${badgeIcon}${prod.badge.text}</span>` : '';
          const discHTML    = discPct > 0 ? `<span class="sr-card__discount">-${discPct}%</span>` : '';
          const compareHTML = hasDiscount ? `<span class="sr-card__compare">$${parseFloat(prod.compare_price).toFixed(2)}</span>` : '';
          const imgMain     = upgradeShopifyImageUrl(prod.image, 600);

          const card = document.createElement('div');
          card.className  = 'sr-card product-card';
          card.dataset.id = prod.id;
          card.innerHTML = `
            ${badgeHTML}
            <a href="${productUrl}" class="sr-card__media">
              <img class="sr-card__img" src="${imgMain}" alt="${prod.title}" loading="lazy">
              ${discHTML}
              <span class="mini-wishlist-icon sr-card__wishlist" data-id="${prod.id}"></span>
              <button type="button" class="sr-card__cart add-to-cart" aria-label="Add to cart"><i class="fi fi-rr-shopping-cart"></i></button>
            </a>
            <div class="sr-card__body">
              <a href="${productUrl}" class="sr-card__title">${prod.title}</a>
              <p class="sr-card__prices">
                <span class="sr-card__price">$${parseFloat(prod.price).toFixed(2)}</span>
                ${compareHTML}
              </p>
            </div>`;

          const wishIcon = card.querySelector('.sr-card__wishlist');
          wishIcon.innerHTML = PDP_WISHLIST_SVG;
          wishIcon.addEventListener('click', function (e) { e.preventDefault(); toggleWishlist(e); });

          const cartBtn = card.querySelector('.sr-card__cart');
          cartBtn.addEventListener('click', function (e) { e.preventDefault(); addToCart(e); });

          return card;
        }

        function resolveProductFromResult(item) {
          const match = (item.url || '').match(/product(\d+)\.html/);
          if (!match) return null;
          const productId = 'Pdg-Francenel-product' + match[1];
          return products.find(p => p.id === productId) || null;
        }

        // ── Résout une query en liste de vrais objets produit (avec prix,
        //    colors, sizes, variants...) triés par pertinence de recherche.
        //    search-filters.js applique ensuite ses propres filtres/tri
        //    par-dessus cette liste. ──
        function resolveSearchResults(query) {
          if (!query) return [];
          const results = (window.bbwSearch && typeof window.bbwSearch.searchAlways === 'function')
            ? window.bbwSearch.searchAlways(query)
            : [];
          const productResults = results
            .filter(r => r.type === 'product')
            .map(resolveProductFromResult)
            .filter(Boolean);
          // Si vraiment aucun produit ne matche le type "product" de l'index
          // (cas extrême), retombe sur le catalogue complet plutôt que rien —
          // la page ne doit jamais afficher "aucun résultat".
          if (productResults.length) return productResults;
          return products.filter(p => !p.type);
        }

        window.__srBuildCard         = buildResultCard;
        window.__srResolveResults    = resolveSearchResults;
        window.__srUpdateWishlistIcons = updateWishlistIcons;
      })();

      function populateMiniSlider(slider, media) {
        if (!slider || !media) return;
        slider.innerHTML = '';
        media.forEach((src, i) => {
          const img     = document.createElement('img');
          img.className = `mini-media-image ${i === 0 ? 'active' : ''}`;
          img.loading   = i === 0 ? 'eager' : 'lazy';
          img.decoding  = 'async';
          img.style.minHeight = i === 0 ? '1px' : '';
          img.dataset.ready = '0';
          img.addEventListener('load', () => { img.dataset.ready = '1'; }, { once: true });
          img.alt       = 'BBW4LIFE plus size fashion';
          img.src       = upgradeShopifyImageUrl(src);
          if (img.complete && img.naturalWidth > 0) img.dataset.ready = '1';
          slider.appendChild(img);
        });
        const prev = document.createElement('div');
        const next = document.createElement('div');
        prev.className = 'mini-media-slider-prev';
        next.className = 'mini-media-slider-next';
        prev.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          miniPause();
          slideMini(slider, 'prev');
        });
        next.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          miniPause();
          slideMini(slider, 'next');
        });

        /* ── Pause sur touch du media slider ── */
        slider.addEventListener('touchstart', miniPause, { passive: true });
        slider.addEventListener('touchmove',  miniPause, { passive: true });

        slider.appendChild(prev);
        slider.appendChild(next);
      }

      // ====================== PAGE PRODUIT ======================
      const productSection = document.querySelector('.product-section');
      if (productSection) {
        const pid = productSection.dataset.productId;
        window.currentProductId = pid;
        console.log("✅ Product ID chargé pour les reviews :", window.currentProductId);
        if (typeof loadDynamicReviews === 'function') loadDynamicReviews();
        const prod = products.find(p => p.id === pid);
        // PATCH 3 — Stock bar
        if (prod && prod.cj_id) {
            initStockBar(prod.cj_id);
        }

        // ====================== RATING & REVIEWS COUNT ======================
        if (prod) {
          const rating = prod.rating || 4.8;
          const reviewsCount = prod.reviews_count || 0;

          const ratingEl = document.querySelector('.unique-stars');
          const ratingTextEl = document.querySelector('.unique-rating-text');
          const reviewsCountEl = document.querySelector('.unique-reviews');

          if (ratingEl) {
            ratingEl.dataset.rating = rating;
            ratingEl.innerHTML = '';
            for (let i = 0; i < 5; i++) {
              const star = document.createElement('span');
              star.classList.add('unique-star');
              if (i + 1 <= Math.floor(rating)) {
                star.classList.add('full');
              } else if (i < rating && i + 1 > rating) {
                star.classList.add('half');
              }
              ratingEl.appendChild(star);
            }
          }
          if (ratingTextEl) ratingTextEl.textContent = rating.toFixed(1) + ' / 5';
          if (reviewsCountEl) reviewsCountEl.textContent = reviewsCount + ' reviews';
          const trustRating = document.querySelector('.pp-trust-strip .pp-trust-item:last-child');
          if (trustRating) trustRating.innerHTML = `<i class="fas fa-star"></i> ${rating.toFixed(1)} / 5`;

          const scrollToReviews = () => {
            const reviewsSection = document.getElementById('reviews-section');
            if (reviewsSection) reviewsSection.scrollIntoView({ behavior: 'smooth' });
          };
          if (ratingEl) ratingEl.style.cursor = 'pointer';
          if (ratingEl) ratingEl.addEventListener('click', scrollToReviews);
          if (ratingTextEl) ratingTextEl.style.cursor = 'pointer';
          if (ratingTextEl) ratingTextEl.addEventListener('click', scrollToReviews);
          if (reviewsCountEl) reviewsCountEl.style.cursor = 'pointer';
          if (reviewsCountEl) reviewsCountEl.addEventListener('click', scrollToReviews);
        }

        if (prod && prod.media) {
          populateMainProductMedia(prod.media, prod.title);


          // ════════════════════════════════════════════════
            //   PRODUCT SHARE — inject button + popup
            // ════════════════════════════════════════════════
            (function initProductShare() {
              'use strict';

              // ── Injecter le bouton dans le slider
              const mainSlider = document.getElementById('main-image-slider');
              if (!mainSlider) return;

              // Éviter le doublon
              if (mainSlider.querySelector('.pp-share-btn')) return;

              // Bouton share
              const shareBtn = document.createElement('button');
              shareBtn.className = 'pp-share-btn';
              shareBtn.id = 'pp-share-btn';
              shareBtn.setAttribute('aria-label', 'Share this product');
              shareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
              mainSlider.appendChild(shareBtn);

              // ── Construire le popup (une seule fois dans le body)
              if (!document.getElementById('pp-share-overlay')) {
                const overlay = document.createElement('div');
                overlay.id = 'pp-share-overlay';
                overlay.className = 'pp-share-overlay';
                overlay.setAttribute('aria-hidden', 'true');
                overlay.innerHTML = `
                  <div class="pp-share-modal" role="dialog" aria-modal="true">
                    <button class="pp-share-close" id="pp-share-close" aria-label="Close">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                    <div class="pp-share-header">
                      <div class="pp-share-title-row">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span>Share this product</span>
                      </div>
                      <div class="pp-share-preview" id="pp-share-preview"></div>
                    </div>
                    <div class="pp-share-grid">
                      <button class="pp-share-option" data-platform="copy">
                        <div class="pp-share-icon pp-share-icon--copy">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="22" height="22">
                            <rect width="14" height="14" x="8" y="8" rx="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                        </div>
                        <span>Copy Link</span>
                      </button>
                      <button class="pp-share-option" data-platform="whatsapp">
                        <div class="pp-share-icon pp-share-icon--whatsapp">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                        </div>
                        <span>WhatsApp</span>
                      </button>
                      <button class="pp-share-option" data-platform="facebook">
                        <div class="pp-share-icon pp-share-icon--facebook">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </div>
                        <span>Facebook</span>
                      </button>
                      <button class="pp-share-option" data-platform="instagram">
                        <div class="pp-share-icon pp-share-icon--instagram">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </div>
                        <span>Instagram</span>
                      </button>
                      <button class="pp-share-option" data-platform="pinterest">
                        <div class="pp-share-icon pp-share-icon--pinterest">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                            <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                          </svg>
                        </div>
                        <span>Pinterest</span>
                      </button>
                      <button class="pp-share-option" data-platform="email">
                        <div class="pp-share-icon pp-share-icon--email">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="22" height="22">
                            <rect width="20" height="16" x="2" y="4" rx="2"/>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                          </svg>
                        </div>
                        <span>Email</span>
                      </button>
                    </div>
                  </div>`;
                document.body.appendChild(overlay);
              }

              // ── Toast
              function showShareToast(msg) {
                let toast = document.getElementById('pp-share-toast');
                if (!toast) {
                  toast = document.createElement('div');
                  toast.id = 'pp-share-toast';
                  toast.className = 'pp-share-toast';
                  document.body.appendChild(toast);
                }
                toast.textContent = msg;
                toast.classList.add('show');
                clearTimeout(toast._t);
                toast._t = setTimeout(function() { toast.classList.remove('show'); }, 3000);
              }



              const PRODUCT_SLUGS = {
              'Pdg-Francenel-product1':  'glam-heels-cross-strap-stiletto-sandals',
              'Pdg-Francenel-product2':  'retrorun-sneakers-chunky-sole-street-style',
              'Pdg-Francenel-product3':  'bohoflip-sandals-embroidered-boho-flip-flops',
              'Pdg-Francenel-product4':  'powerheels-12cm-stiletto-pumps',
              'Pdg-Francenel-product5':  'winterboost-boots-ankle-boots',
              'Pdg-Francenel-product6':  'colorstilettos-vibrant-stiletto-flip-flops',
              'Pdg-Francenel-product7':  'nightchic-dress-mock-neck-long-sleeve-printed',
              'Pdg-Francenel-product8':  'slitlux-dress-cutout-slit-round-neck',
              'Pdg-Francenel-product9':  'plaidoverall-dress-wide-strap-dungaree',
              'Pdg-Francenel-product10': 'floralflounce-dress-surplice-flounce-sleeve-maxi',
              'Pdg-Francenel-product11': 'vintagesquare-dress-printed-square-neck',
              'Pdg-Francenel-product12': 'paisleybelt-dress-orange-floral-print-belted',
              'Pdg-Francenel-product13': 'meshduo-set-sheer-mesh-long-dress-suit',
              'Pdg-Francenel-product14': 'meshglam-dress-solid-color-stitching-maxi',
              'Pdg-Francenel-product15': 'linenbreeze-dress-cotton-linen-button-down',
              'Pdg-Francenel-product16': 'stripedmini-dress-vneck-long-sleeve',
              'Pdg-Francenel-product17': 'loungerobe-loose-sleepwear-bathrobe',
              'Pdg-Francenel-product18': 'lacenight-dress-sexy-short-strap-lace-nightdress',
              'Pdg-Francenel-product19': 'lacethong-set-sheer-lace-skirt-lingerie',
              'Pdg-Francenel-product20': 'solidsexy-bikini-high-waist-hot-swimsuit',
              'Pdg-Francenel-product21': 'curvebikini-solid-color-high-waist-swimwear',
              'Pdg-Francenel-product22': 'leopardnight-set-mesh-pajama-lingerie-dress',
              'Pdg-Francenel-product23': 'supportbra-large-cup-breathable-mesh-bra',
              'Pdg-Francenel-product24': 'laceromper-jumpsuit-lace-splicing-thong',
              'Pdg-Francenel-product25': 'stripedbikini-print-striped-swimwear',
              'Pdg-Francenel-product26': 'tubebikinii-tube-top-swimsuit',
              'Pdg-Francenel-product27': 'ruffleone-bikini-vneck-ruffled-one-piece',
              'Pdg-Francenel-product28': 'bandagebikini-solid-color-bandage-swimsuit',
              'Pdg-Francenel-product29': 'contrastone-piece-contrasting-color-swimwear',
              'Pdg-Francenel-product30': 'premiumbikini-plus-size-swimsuit-collection',
              'Pdg-Francenel-product31': 'irregulartop-loose-round-neck-irregular-hem',
              'Pdg-Francenel-product32': 'christmassweat-casual-holiday-sweatshirt',
              'Pdg-Francenel-product33': 'dalmationshorts-high-waist-dalmatian-print',
              'Pdg-Francenel-product34': 'leopardshirt-irregular-collar-spliced-blouse',
              'Pdg-Francenel-product35': 'drawstringpants-casual-pants-with-pockets',
              'Pdg-Francenel-product36': 'cropslimpants-mens-drawstring-cropped-pants',
              'Pdg-Francenel-product37': 'haremprints-printed-harem-trousers-men',
              'Pdg-Francenel-product38': 'loosejeans-mens-relaxed-fit-denim',
              'Pdg-Francenel-product39': 'britishloafers-formal-tassel-party-shoes-men',
              'Pdg-Francenel-product40': 'airmesh-runners-professional-sports-sneakers-men',
              'Pdg-Francenel-product41': 'leathercasuals-mens-breathable-flat-sneakers',
              'Pdg-Francenel-product42': 'businessdress-shoes-classic-wedding-formal',
              'Pdg-Francenel-product43': 'hollowsneakers-mesh-big-size-fashion-shoes-men',
              'Pdg-Francenel-product44': 'tendtrainers-mens-outdoor-sport-sneakers',
              'Pdg-Francenel-product45': 'patentloafers-luxury-patent-leather-party-shoes',
              'Pdg-Francenel-product46': 'collarshirt-mens-plus-size-button-down',
              'Pdg-Francenel-product47': 'geopolo-shirt-geometric-print-men-polo',
              'Pdg-Francenel-product48': 'stripedcollar-sweater-mens-casual-knit',
              'Pdg-Francenel-product49': 'turtlenecklux-mens-plus-size-turtleneck-sweater',
              'Pdg-Francenel-product50': 'hikejacket-waterproof-outdoor-jacket',
              'Pdg-Francenel-product51': 'roundneck-sweatshirt-mens-plus-size-pullover',
              'Pdg-Francenel-product52': 'nailbond-glue-strong-uv-nail-tips-adhesive',
              'Pdg-Francenel-product53': 'bownails-manicure-long-almond-fake-nails',
              'Pdg-Francenel-product54': 'nailrepair-lotion-nourishing-nail-solution',
              'Pdg-Francenel-product55': 'browdye-pencil-waterproof-quick-dry-eyebrow',
              'Pdg-Francenel-product56': 'curl-volume-mascara-4d-waterproof-formula',
              'Pdg-Francenel-product57': 'browkit-pro-waterproof-eyebrow-stencil-cream',
              'Pdg-Francenel-product58': 'obsidian-lip-balm-warming-moisture-treatment',
              'Pdg-Francenel-product59': 'tearoff-lip-gloss-4-color-long-lasting-peel',
              'Pdg-Francenel-product60': 'gingerclean-pads-ginger-lemon-makeup-remover',
              'Pdg-Francenel-product61': 'deeprepair-hair-mask-moisturizing-smoothing',
              'Pdg-Francenel-product62': 'batanaglow-oil-moisturizing-hair-care',
              'Pdg-Francenel-product63': 'batanaboost-oil-120ml-hair-growth-conditioner',
              'Pdg-Francenel-product64': 'poreclean-gel-deep-exfoliating-anti-acne',
              'Pdg-Francenel-product65': 'knucklewhite-serum-hand-joint-skin-brightener',
              'Pdg-Francenel-product66': 'propolis-glow-essence-brightening-facial-serum',
              'Pdg-Francenel-product67': 'menglow-cream-concealing-brightening-lazy-cream',
              'Pdg-Francenel-product68': 'iceglow-grid-set-silicone-facial-cooling-tool',
              'Pdg-Francenel-product69': 'glamsatin-dress-black-halter-ruched-maxi',
              'Pdg-Francenel-product70': 'powersuit-ivory-structured-skirt-suit',
              'Pdg-Francenel-product71': 'bohofloral-maxi-wrap-floral-bishop-sleeve-dress',
              'Pdg-Francenel-product72': 'cozylounge-set-cream-tank-beige-wide-leg',
              'Pdg-Francenel-product73': 'blushlace-gown-lace-cap-sleeve-empire-maxi',
              'Pdg-Francenel-product74': 'tealempire-gown-sleeveless-vneck-formal-maxi',
              'Pdg-Francenel-product75': 'jacquardpower-suit-multicolor-floral-brocade',
              'Pdg-Francenel-product76': 'patchlace-flats-leisure-patchwork-shoelace-sneakers',
              'Pdg-Francenel-product77': 'warmstep-boots-padded-fur-lined-winter-sneakers',
              'Pdg-Francenel-product78': 'platformwalk-sneakers-vulcanized-plus-size-shoes',
              'Pdg-Francenel-product79': 'stripewrap-bodycon-short-sleeve-bandage-dress',
              'Pdg-Francenel-product80': 'flarefit-dress-spring-flared-sleeve-hip-hugging',
              'Pdg-Francenel-product81': 'officestripe-shirt-dress-patchwork-streetwear-midi',
              'Pdg-Francenel-product82': 'drawshirt-dress-drawstring-shirt-collar-streetwear',
              'Pdg-Francenel-product83': 'autumnvneck-maxi-high-waist-family-matching-dress',
              'Pdg-Francenel-product84': 'beltedbanquet-dress-long-sleeve-printed-high-waist',
              'Pdg-Francenel-product85': 'woventassel-bag-hand-crochet-shoulder-bag',
              'Pdg-Francenel-product86': 'koreantrend-bag-small-messenger-bag',
              'Pdg-Francenel-product87': 'blocksquare-bag-color-blocked-mini-bag',
              'Pdg-Francenel-product88': 'rattanring-tote-hand-knitted-beach-bag',
              'Pdg-Francenel-product89': 'commutercanvas-tote-multi-pocket-zipper-bag',
              'Pdg-Francenel-product90': 'embroidtote-bag-leather-top-handle-crossbody',
              'Pdg-Francenel-product91': 'texturedmini-bag-japanese-style-hand-bag',
              'Pdg-Francenel-product92': 'retroniche-bag-large-capacity-shoulder-messenger',
              'Pdg-Francenel-product93': 'leopardunderarm-bag-retro-drawstring-crossbody',
              'Pdg-Francenel-product94': 'metalchain-clutch-trendy-evening-party-bag',
              'Pdg-Francenel-product95': 'patterntote-bag-earring-decorated-shoulder-tote',
              'Pdg-Francenel-product96': 'pleatedtwo-piece-solid-color-skirt-set',
              'Pdg-Francenel-product97': 'onepiece-swim-plus-size-solid-swimsuit',
              'Pdg-Francenel-product98': 'gilded-gala-gown-sequin-bodice-tiered-tulle',
              'Pdg-Francenel-product99': 'midnightvelvet-sheath-three-quarter-sleeve-bodycon',
              'Pdg-Francenel-product100': 'velvetwrap-jumpsuit-gold-belt-wide-leg',
              'Pdg-Francenel-product101': 'savannahprint-sundress-tribal-tiered-mini',
              'Pdg-Francenel-product102': 'classictrench-coat-belted-double-breasted',
              'Pdg-Francenel-product103': 'tiefront-sheath-cap-sleeve-wrap-detail',
              'Pdg-Francenel-product104': 'slouchsuede-boots-knee-high-block-heel',
              'Pdg-Francenel-product105': 'velvettailored-blazer-peak-lapel-jacket',
              'Pdg-Francenel-product106': 'colorblockmidi-stripe-detail-sheath-dress',
              'Pdg-Francenel-product107': 'houndstoothtweed-set-button-front-skirt-dress',
              'Pdg-Francenel-product108': 'rufflecascade-sheath-draped-side-detail',
              'Pdg-Francenel-product109': 'tweedshift-dress-cuffed-sleeve-classic',
              'Pdg-Francenel-product110': 'polkadotblouse-set-wide-leg-belted-trouser',
            };

              // ── Récupérer les données du produit courant
              function getShareData() {
                const productSection = document.querySelector('.product-section');
                if (!productSection) return null;
                const pid = productSection.dataset.productId;
                const allProds = window.__allProducts || [];
                const prod = allProds.find(function(p) { return p.id === pid; });
                if (!prod) return null;

                const slug     = PRODUCT_SLUGS[pid];
                const pageUrl  = slug
                  ? window.location.origin + '/bbw4life/' + slug
                  : window.location.origin + (typeof getProductUrl === 'function' ? getProductUrl(pid) : window.location.pathname);
                const title    = prod.title || '';
                const price    = '$' + parseFloat(prod.price).toFixed(2);
                const badge    = (prod.badge && prod.badge.text) ? prod.badge.text : '';
                const imgSrc   = (typeof upgradeShopifyImageUrl === 'function') ? upgradeShopifyImageUrl(prod.image, 200) : prod.image;

                // Message pré-rempli identique pour toutes les plateformes
                const message =
                  'Hi friend! 👋 I\'m browsing BBW4LIFE — a store that celebrates every curve 💕\n\n' +
                  'I just found this amazing product and had to share it with you!\n\n' +
                  '✨ ' + title + '\n' +
                  '💰 Price: ' + price + (badge ? '\n🏷️ ' + badge : '') + '\n\n' +
                  '🔗 Check it out here: ' + pageUrl + '\n\n' +
                  'Beauty Has No Sizes 👑 — bbw4life.com';

                return { title: title, price: price, badge: badge, imgSrc: imgSrc, pageUrl: pageUrl, message: message };
              }

              // ── Remplir le preview dans le popup
              function fillPreview(data) {
                const preview = document.getElementById('pp-share-preview');
                if (!preview || !data) return;
                preview.innerHTML =
                  '<img src="' + data.imgSrc + '" alt="' + data.title + '" loading="lazy">' +
                  '<div class="pp-share-preview-info">' +
                    '<div class="pp-share-preview-title">' + data.title + '</div>' +
                    '<div class="pp-share-preview-price">' + data.price + '</div>' +
                  '</div>' +
                  (data.badge ? '<span class="pp-share-preview-badge">' + data.badge + '</span>' : '');
              }

              // ── Ouvrir / fermer le popup
              function openSharePopup() {
                const overlay = document.getElementById('pp-share-overlay');
                if (!overlay) return;
                const data = getShareData();
                fillPreview(data);
                overlay.classList.add('active');
                overlay.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
              }

              function closeSharePopup() {
                const overlay = document.getElementById('pp-share-overlay');
                if (!overlay) return;
                overlay.classList.remove('active');
                overlay.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
              }

              // ── Gestion des clics sur les options
              document.addEventListener('click', function(e) {
                // Ouvrir via le bouton share
                if (e.target.closest('#pp-share-btn')) {
                  e.stopPropagation();
                  openSharePopup();
                  return;
                }

                // Fermer via le bouton close
                if (e.target.closest('#pp-share-close')) {
                  closeSharePopup();
                  return;
                }

                // Fermer en cliquant sur l'overlay
                const overlay = document.getElementById('pp-share-overlay');
                if (overlay && e.target === overlay) {
                  closeSharePopup();
                  return;
                }

                // Clic sur une option de partage
                const option = e.target.closest('.pp-share-option');
                if (!option) return;
                const platform = option.dataset.platform;
                if (!platform) return;

                const data = getShareData();
                if (!data) return;

                const encodedMsg = encodeURIComponent(data.message);
                const encodedUrl = encodeURIComponent(data.pageUrl);

               if (platform === 'copy') {
                navigator.clipboard.writeText(data.message).then(function() {
                    option.classList.add('pp-copied');
                    option.querySelector('span').textContent = '✓ Copied!';
                    setTimeout(function() {
                      option.classList.remove('pp-copied');
                      option.querySelector('span').textContent = 'Copy Link';
                    }, 2000);
                    showShareToast('🔗 Link copied to clipboard!');
                  }).catch(function() {
                    showShareToast('Could not copy. Please copy manually.');
                  });
                  return;
                }

                if (platform === 'instagram') {
                navigator.clipboard.writeText(data.message).then(function() {
                  showShareToast('📋 Message copied! Opening Instagram...');
                  setTimeout(function() {
                    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
                  }, 800);
                }).catch(function() {});
                  closeSharePopup();
                  return;
                }

                var urls = {
                  whatsapp:  'https://wa.me/?text=' + encodedMsg,
                  facebook:  'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '&quote=' + encodedMsg,
                  pinterest: 'https://www.pinterest.com/pin-builder/?url=' + encodedUrl + '&media=' + encodeURIComponent(data.imgSrc) + '&description=' + encodeURIComponent(data.title + ' — ' + data.price),
                  email:     'mailto:?subject=' + encodeURIComponent('Check out this product on BBW4LIFE!') + '&body=' + encodedMsg
                };

                if (urls[platform]) {
                  window.open(urls[platform], '_blank', 'noopener,noreferrer,width=600,height=500');
                  closeSharePopup();
                }
              });

              // Fermer avec Escape
              document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeSharePopup();
              });

            })();


          // ── INJECT PRODUCT BADGE FROM JSON ──
          const badgeEl = document.querySelector('.product-badge');
          if (badgeEl) {
            if (prod.badge && prod.badge.text) {
              const icon = prod.badge.icon ? `<i class="fi ${prod.badge.icon}"></i> ` : '';
              badgeEl.innerHTML = `${icon}${prod.badge.text}`;
              badgeEl.style.display = '';
            } else {
              badgeEl.style.display = 'none';
            }
          }
          const colorContainer = document.querySelector('.color-swatches');
          if (colorContainer && prod.colors && prod.colors.length) {
            colorContainer.innerHTML = '';
            // Précharge l'image de chaque couleur en arrière-plan dès l'affichage
            // de la fiche produit, pour que le clic sur un swatch réutilise une
            // image déjà en cache navigateur au lieu d'attendre un téléchargement.
            const colorPreloadSize = window.innerWidth <= 768 ? 900 : 1800;
            prod.colors.forEach((color) => {
              if (color.image) {
                new Image().src = upgradeShopifyImageUrl(color.image, colorPreloadSize);
              }
            });
            prod.colors.forEach((color) => {
              const swatch = document.createElement('div');
              swatch.className = 'swatch';
              swatch.style.backgroundColor = color.hex;
              swatch.dataset.color = color.name;
              swatch.addEventListener('click', () => {
                colorContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                updateProductPrice();
              });
              // Le tooltip (::after, "content: attr(data-color)") est centré
              // sur le swatch par défaut — au survol, on mesure sa position
              // réelle et on décale via --tooltip-shift pour qu'il ne
              // déborde jamais de l'écran (surtout les 1ers swatches, près
              // du bord gauche, sur mobile).
              function repositionTooltip() {
                const rect = swatch.getBoundingClientRect();
                const tooltipHalfWidth = 70; // estimation large, sécurise même les noms longs
                const margin = 8;
                let shift = 0;
                const leftEdge  = rect.left + rect.width / 2 - tooltipHalfWidth;
                const rightEdge = rect.left + rect.width / 2 + tooltipHalfWidth;
                if (leftEdge < margin) shift = margin - leftEdge;
                else if (rightEdge > window.innerWidth - margin) shift = (window.innerWidth - margin) - rightEdge;
                swatch.style.setProperty('--tooltip-shift', shift + 'px');
              }
              swatch.addEventListener('mouseenter', repositionTooltip);
              swatch.addEventListener('touchstart', repositionTooltip, { passive: true });
              colorContainer.appendChild(swatch);
            });
            colorContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
          } else if (colorContainer) {
            colorContainer.style.display = 'none';
          }

          const sizeSelect = document.getElementById('size-select');
          if (sizeSelect && prod.sizes && prod.sizes.length > 0) {
            sizeSelect.innerHTML = '';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Select Size';
            defaultOpt.selected = true;
            defaultOpt.disabled = true;
            sizeSelect.appendChild(defaultOpt);
            prod.sizes.forEach(size => {
              const opt = document.createElement('option');
              opt.value = size;
              opt.textContent = size;
              sizeSelect.appendChild(opt);
            });
            sizeSelect.value = '';
          } else if (sizeSelect) {
            sizeSelect.style.display = 'none';
            const sizeLabel = document.querySelector('label[for="size-select"]');
            if (sizeLabel) sizeLabel.style.display = 'none';
          }

          function getVariantPrice(product, color, size) {
            if (!color || !size) return product.price;
            const variant = product.variants.find(v => v.color === color && v.size === size);
            return variant ? variant.price : product.price;
          }
          function getVariantComparePrice(product, color, size) {
            const varPrice = getVariantPrice(product, color, size);
            const ratio = product.compare_price / product.price;
            return varPrice * ratio;
          }
          function updateProductPrice() {
            const activeSwatch = document.querySelector('.swatch.active');
            let selectedColor = activeSwatch ? activeSwatch.dataset.color : null;
            let selectedSize = sizeSelect ? sizeSelect.value : null;
            if (selectedSize === "") selectedSize = null;
            const currentPrice = getVariantPrice(prod, selectedColor, selectedSize);
            const currentCompare = getVariantComparePrice(prod, selectedColor, selectedSize);
            const currentPriceEl = document.querySelector('.current-price');
            if (currentPriceEl) currentPriceEl.textContent = `$${currentPrice.toFixed(2)}`;
            const comparePriceEl = document.querySelector('.compare-price');
            if (comparePriceEl) comparePriceEl.textContent = `$${currentCompare.toFixed(2)}`;
            const badge = document.querySelector('.discount-badge');
            if (badge) {
              if (currentCompare > currentPrice) {
                const discountPercent = Math.round(((currentCompare - currentPrice) / currentCompare) * 100);
                badge.textContent = `-${discountPercent}%`;
                badge.classList.add('active');
              } else {
                badge.classList.remove('active');
              }
            }
            if (selectedColor) {
              const colorObj = prod.colors.find(c => c.name === selectedColor);
              if (colorObj && colorObj.image) {
                const mainImg = document.querySelector('#main-image-slider .main-image.active img');
                // Même taille que le préchargement ci-dessus pour que le
                // navigateur réutilise l'image déjà en cache.
                const colorImgSize = window.innerWidth <= 768 ? 900 : 1800;
                if (mainImg) mainImg.src = upgradeShopifyImageUrl(colorObj.image, colorImgSize);
              }
            }
          }
          if (sizeSelect) sizeSelect.addEventListener('change', updateProductPrice);
          updateProductPrice();
        }

        // Media zoom
        if (enableMediaZoom) {
          const mainSlider = document.getElementById('main-image-slider');
          const mainImages = mainSlider ? mainSlider.querySelectorAll('.main-image') : [];
          const modal = document.getElementById('media-zoom-modal');
          const modalImg = document.getElementById('modal-zoom-image');
          const modalContainer = document.querySelector('.modal-zoom-container');
          const closeBtn = modal ? modal.querySelector('.modal-close') : null;
          const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          let scale = 1, translateX = 0, translateY = 0, isDraggingZoom = false;
          let lastTouchX = 0, lastTouchY = 0, maxTranslateX = 0, maxTranslateY = 0;
          let wasZoomedIn = false;
          function updateTransform(smooth = true) {
            modalImg.style.transition = smooth ? 'transform 0.25s ease' : 'none';
            modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            // Ne touche au DOM (classList) que sur un vrai changement d'état
            // zoomé/dézoomé — pas à chaque frame de pan (touchmove appelle
            // updateTransform en continu pendant un drag à scale > 1).
            const isZoomedIn = scale > 1.01;
            if (isZoomedIn !== wasZoomedIn) {
              wasZoomedIn = isZoomedIn;
              if (modal) modal.classList.toggle('mz-zoomed-in', isZoomedIn);
            }
          }
          function calculateBounds() {
            if (!modalImg.naturalWidth || !modalContainer) return;
            const contW = modalContainer.clientWidth, contH = modalContainer.clientHeight;
            const fitScale = Math.min(contW / modalImg.naturalWidth, contH / modalImg.naturalHeight);
            maxTranslateX = Math.max(0, (modalImg.naturalWidth * fitScale * scale - contW) / 2);
            maxTranslateY = Math.max(0, (modalImg.naturalHeight * fitScale * scale - contH) / 2);
          }
          function clampTranslate() {
            translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX));
            translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
          }
          if (!isTouchDevice && mainSlider) {
            // Appended to <body> (position:fixed) on purpose: .product-media
            // computes to position:sticky at this breakpoint, which opens its
            // own stacking context and traps any descendant z-index below
            // .product-content — escaping to <body> guarantees the pane
            // always renders above the page, regardless of ancestor stacking.
            const lens = document.createElement('div');
            lens.className = 'bbw-zoom-lens';
            const pane = document.createElement('div');
            pane.className = 'bbw-zoom-pane';
            document.body.appendChild(lens);
            document.body.appendChild(pane);

            const getActiveImg = () => mainSlider.querySelector('.main-image.active img');

            const showZoom = () => {
              const img = getActiveImg();
              if (!img || !window.matchMedia('(min-width: 1100px)').matches) return;
              const rect = mainSlider.getBoundingClientRect();
              const rawSrc = img.currentSrc || img.src;
              const hiResSrc = typeof upgradeShopifyImageUrl === 'function'
                ? upgradeShopifyImageUrl(rawSrc, 2200)
                : rawSrc;
              pane.style.backgroundImage = `url("${hiResSrc}")`;
              pane.style.width = rect.width + 'px';
              pane.style.height = rect.height + 'px';
              pane.style.top = rect.top + 'px';
              pane.style.left = (rect.right + 24) + 'px';
              lens.classList.add('is-active');
              pane.classList.add('is-active');
            };
            const hideZoom = () => {
              lens.classList.remove('is-active');
              pane.classList.remove('is-active');
            };
            const moveZoom = (e) => {
              if (e.target.closest('.slider-arrow')) { hideZoom(); return; }
              if (!lens.classList.contains('is-active')) showZoom();
              const rect = mainSlider.getBoundingClientRect();
              const lensW = lens.offsetWidth, lensH = lens.offsetHeight;
              let x = e.clientX - rect.left;
              let y = e.clientY - rect.top;
              x = Math.max(lensW / 2, Math.min(rect.width - lensW / 2, x));
              y = Math.max(lensH / 2, Math.min(rect.height - lensH / 2, y));
              lens.style.left = (rect.left + x - lensW / 2) + 'px';
              lens.style.top = (rect.top + y - lensH / 2) + 'px';
              pane.style.top = rect.top + 'px';
              pane.style.left = (rect.right + 24) + 'px';

              // single uniform ratio (lens is a square, lensW === lensH) so the
              // zoomed image scales proportionally instead of stretching
              const zoomRatio = pane.offsetHeight / lensH;
              pane.style.backgroundSize = `${rect.width * zoomRatio}px ${rect.height * zoomRatio}px`;
              pane.style.backgroundPosition = `-${(x - lensW / 2) * zoomRatio}px -${(y - lensH / 2) * zoomRatio}px`;
            };

            mainSlider.addEventListener('mouseenter', showZoom);
            mainSlider.addEventListener('mousemove', moveZoom);
            mainSlider.addEventListener('mouseleave', hideZoom);
          }

          function openZoomForImg(img) {
            const rawSrc = img.currentSrc || img.src;
            // 1400px suffit pour un zoom max 2.5x sur un écran mobile
            // (~400px CSS de large) — 2200px était un second téléchargement
            // lourd et redondant avec l'image déjà affichée (900px).
            modalImg.src = typeof upgradeShopifyImageUrl === 'function' ? upgradeShopifyImageUrl(rawSrc, 1400) : rawSrc;
            modal.classList.add('active');
            scale = 1; translateX = 0; translateY = 0;
            updateTransform(false);
            if (modalImg.complete) calculateBounds();
            else modalImg.onload = calculateBounds;
          }

          mainImages.forEach(container => {
            const img = container.querySelector('img');
            if (!img) return;
            if (isTouchDevice) {
              container.style.cursor = 'pointer';
              container.addEventListener('click', (e) => {
                e.stopImmediatePropagation();
                openZoomForImg(img);
              });
            }
          });

          // ── Bouton loupe mobile (sous le badge) — même système de zoom ──
          if (isTouchDevice && mainSlider) {
            const settingsZoomBtn = (window.__allProducts || []).find(p => p.type === 'settings') || {};
            const cdZoomBtn = settingsZoomBtn.cart_drawer || {};
            const showZoomBtn = (cdZoomBtn.show_mobile_zoom_icon || 'yes').toLowerCase().trim() === 'yes';
            if (showZoomBtn && !mainSlider.querySelector('.pp-mobile-zoom-btn')) {
              const zoomBtn = document.createElement('button');
              zoomBtn.className = 'pp-mobile-zoom-btn';
              zoomBtn.setAttribute('aria-label', 'Zoom image');
              zoomBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
              zoomBtn.addEventListener('click', (e) => {
                e.stopImmediatePropagation();
                const activeImg = mainSlider.querySelector('.main-image.active img');
                if (activeImg) openZoomForImg(activeImg);
              });
              mainSlider.appendChild(zoomBtn);
            }
          }
          if (closeBtn && modal) {
            const closeModal = () => {
              modal.classList.remove('active');
              modal.classList.remove('mz-zoomed-in');
              wasZoomedIn = false;
              scale = 1; translateX = 0; translateY = 0;
              modalImg.style.transform = '';
            };
            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
            modalImg.addEventListener('click', () => {
              if (scale > 1) { scale = 1; translateX = 0; translateY = 0; }
              else { scale = 2.5; }
              calculateBounds(); clampTranslate(); updateTransform(true);
            });
            modalImg.addEventListener('touchstart', (e) => {
              if (e.touches.length > 1 || scale <= 1) return;
              isDraggingZoom = true;
              lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
              modalImg.style.transition = 'none';
              e.preventDefault();
            });
            modalImg.addEventListener('touchmove', (e) => {
              if (!isDraggingZoom || e.touches.length > 1) return;
              translateX += e.touches[0].clientX - lastTouchX;
              translateY += e.touches[0].clientY - lastTouchY;
              lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
              clampTranslate(); updateTransform(false);
              e.preventDefault();
            });
            modalImg.addEventListener('touchend', () => { isDraggingZoom = false; });
          }
        }

        // Delivery dates
      if (prod) {
        const today = new Date(); today.setHours(0,0,0,0);

        const cycleStart = parseInt(prod.cycle_days_start);
        const cycleEnd   = parseInt(prod.cycle_days_end);

        if (!cycleStart || !cycleEnd || cycleStart <= 0 || cycleEnd <= 0) { showTextDelivery(); return; }

        const currentStart = new Date(today);
        currentStart.setDate(today.getDate() + cycleStart);

        const currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + cycleEnd);

        function formatDate(date) {
          return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getFullYear()).slice(-2)}`;
        }

        const startEl = document.getElementById("start-date"), endEl = document.getElementById("end-date");
        if (startEl && endEl) { startEl.innerText = formatDate(currentStart); endEl.innerText = formatDate(currentEnd); }

        showTextDelivery();
        function showTextDelivery() {
          const textEl = document.getElementById("delivery-text");
          if (textEl) textEl.style.visibility = "visible";
        }
      }
     }

      // Mini media sliders
      document.querySelectorAll('.mini-media-slider').forEach(slider => {
        const item = slider.closest('.product-item');
        if (item) {
          const pid = item.dataset.productId;
          const prod = products.find(p => p.id === pid);
          if (prod && prod.media) populateMiniSlider(slider, prod.media);
        }
      });

      // Bundle (page produit)
      const bundleContainer = document.querySelector('.bundle-save-container');
      if (bundleContainer) {
        const productSection = document.querySelector('.product-section');
        const productId = productSection.dataset.productId;
        const product = products.find(p => p.id === productId);
        if (product) {
          function getVariantPrice(product, color, size) {
            if (!color || !size) return product.price;
            const variant = product.variants.find(v => v.color === color && v.size === size);
            return variant ? variant.price : product.price;
          }
          function getVariantComparePrice(product, color, size) {
            return getVariantPrice(product, color, size) * (product.compare_price / product.price);
          }
          const hasSizes = product.sizes && product.sizes.length > 0;
          const hasColors = product.colors && product.colors.length > 0;
          const uniqueSizes = hasSizes ? product.sizes : [];
          const uniqueColors = hasColors ? product.colors.map(c => c.name) : [];

          function createSelect(options, labelText, placeholder = "Select...") {
            if (!options || options.length === 0) return null;
            const wrapper = document.createElement("div");
            const label = document.createElement("label"); label.textContent = labelText;
            wrapper.appendChild(label);
            const select = document.createElement("select"); select.required = true;
            const defaultOption = document.createElement("option"); defaultOption.value = ""; defaultOption.textContent = placeholder;
            select.appendChild(defaultOption);
            options.forEach(value => {
              const opt = document.createElement('option'); opt.value = value; opt.textContent = value;
              select.appendChild(opt);
            });
            wrapper.appendChild(select);
            return wrapper;
          }

          function populateSelectors(container) {
            if (container.dataset.populated) return;
            container.dataset.populated = "true";
            container.querySelectorAll(".variant-selectors").forEach(div => {
              div.innerHTML = "";
              if (hasColors) {
                const colorSelect = createSelect(uniqueColors, "Color");
                if (colorSelect) {
                  div.appendChild(colorSelect);
                  colorSelect.querySelector('select').addEventListener('change', (e) => {
                    const colorObj = product.colors.find(c => c.name === e.target.value);
                    if (colorObj) {
                      const previewImg = div.closest('.variant-row').querySelector('.variant-preview img');
                      if (previewImg) previewImg.src = colorObj.image;
                    }
                    calculateBundlePrice(container.closest('.bundle-option').dataset.bundle);
                  });
                }
              }
              if (hasSizes) {
                const sizeSelect = createSelect(uniqueSizes, "Size");
                if (sizeSelect) {
                  div.appendChild(sizeSelect);
                  sizeSelect.querySelector('select').addEventListener('change', () => {
                    calculateBundlePrice(container.closest('.bundle-option').dataset.bundle);
                  });
                }
              }
              if (!hasColors && !hasSizes) div.innerHTML = '<p style="color:#555;font-size:13px;margin:8px 0;">No options available</p>';
            });
            container.querySelectorAll('.variant-preview img').forEach(img => { img.src = product.image; });
          }

          function getSelectedValues(selectorsContainer) {
            const values = {};
            selectorsContainer.querySelectorAll("select").forEach(select => {
              const label = select.parentElement.querySelector("label")?.textContent.toLowerCase() || "";
              if (select.value !== "") {
                if (label.includes("color")) values.color = select.value;
                else if (label.includes("size")) values.size = select.value;
              }
            });
            return values;
          }

          function calculateBundlePrice(type) {
            const option = document.querySelector(`.bundle-option[data-bundle="${type}"]`);
            if (!option) return;
            let totalPrice = 0, totalCompare = 0;
            const ratio = product.compare_price / product.price;
            const discount = (type === "single" ? (product.single_discount||0) : type === "duo" ? (product.duo_discount||0) : (product.trio_discount||0)) / 100;
            option.querySelectorAll(".variant-selectors").forEach(sel => {
              const { color = null, size = null } = getSelectedValues(sel);
              const varPrice = getVariantPrice(product, color, size);
              totalPrice += varPrice; totalCompare += varPrice * ratio;
            });
            const priceEl = document.getElementById(`${type}-price`);
            if (priceEl) priceEl.textContent = `$${(totalPrice * (1 - discount)).toFixed(2)}`;
            const originalEl = document.getElementById(`${type}-original-price`);
            if (originalEl) originalEl.textContent = `$${(totalCompare * (1 - discount)).toFixed(2)}`;
          }

          function updateBundlePrices(product) {
            const dSingle = (product.single_discount||0)/100, dDuo = (product.duo_discount||0)/100, dTrio = (product.trio_discount||0)/100;
            const ratio = product.compare_price / product.price;
            document.getElementById("single-price").textContent = `$${(product.price*(1-dSingle)).toFixed(2)}`;
            document.getElementById("single-original-price").textContent = `$${(product.price*ratio*(1-dSingle)).toFixed(2)}`;
            document.getElementById("duo-price").textContent = `$${(product.price*2*(1-dDuo)).toFixed(2)}`;
            document.getElementById("duo-original-price").textContent = `$${(product.price*ratio*2*(1-dDuo)).toFixed(2)}`;
            document.getElementById("trio-price").textContent = `$${(product.price*3*(1-dTrio)).toFixed(2)}`;
            document.getElementById("trio-original-price").textContent = `$${(product.price*ratio*3*(1-dTrio)).toFixed(2)}`;
          }

          function addBundleToCart(items) {
            items.forEach(item => {
              let cartItem = cart.find(i => i.id === item.id && i.size === item.size && i.color === item.color);
              if (cartItem) cartItem.quantity += item.quantity;
              else cart.push(item);
            });
            saveCart(); updateCartQuantityInSheet(); updateBadges(); renderCart(); checkout();
          }

          document.querySelectorAll('.bundle-option label').forEach(label => { label.addEventListener('click', e => e.preventDefault()); });

          document.querySelectorAll(".bundle-option").forEach(option => {
            option.addEventListener("click", function(e) {
              if (e.target.closest(".bundle-selection")) return;
              const radio = this.querySelector("input[type='radio']");
              const wasChecked = radio.checked;
              document.querySelectorAll(".bundle-option").forEach(el => {
                el.classList.remove("active");
                const sel = el.querySelector(".bundle-selection");
                if (sel) sel.style.display = "none";
                el.querySelector("input[type='radio']").checked = false;
              });
              if (!wasChecked) {
                radio.checked = true; this.classList.add("active");
                const selection = this.querySelector(".bundle-selection");
                if (selection) { selection.style.display = "block"; populateSelectors(selection); calculateBundlePrice(this.dataset.bundle); }
              }
            });
          });

          document.querySelectorAll(".bundle-add-btn").forEach(btn => {
            btn.addEventListener("click", function() {
              const container = this.closest(".bundle-selection");
              const type = container.closest(".bundle-option").dataset.bundle;
              const items = [];
              let itemImage = product.image;
              const discount = (type === "single" ? (product.single_discount||0) : type === "duo" ? (product.duo_discount||0) : (product.trio_discount||0)) / 100;
              const ratio = product.compare_price / product.price;
              if (type === "single") {
                if (!hasColors && !hasSizes) {
                  const variant = product.variants ? product.variants[0] : null;
                  items.push({ id: product.id, title: product.title, price: product.price*(1-discount), compare_price: product.price*ratio, image: itemImage, size: null, color: null, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                } else {
                  const { color: selectedColor = null, size: selectedSize = null } = getSelectedValues(container);
                  if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) { showErrorPopup("Please complete your selection."); return; }
                  if (selectedColor) { const colorObj = product.colors.find(c => c.name === selectedColor); if (colorObj) itemImage = colorObj.image; }
                  const varPrice = getVariantPrice(product, selectedColor, selectedSize);
                  const variant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize);
                  items.push({ id: product.id, title: product.title, price: varPrice*(1-discount), compare_price: varPrice*ratio, image: itemImage, size: selectedSize, color: selectedColor, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                }
              } else {
                const count = type === "duo" ? 2 : 3;
                let valid = true;
                for (let i = 1; i <= count; i++) {
                  const pair = container.querySelector(`.variant-pair[data-index="${i}"]`);
                  if (!pair) continue;
                  let pairImage = product.image;
                  if (!hasColors && !hasSizes) {
                    const variant = product.variants ? product.variants[0] : null;
                    items.push({ id: product.id, title: product.title, price: product.price*(1-discount), compare_price: product.price*ratio, image: pairImage, size: null, color: null, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                    continue;
                  }
                  const { color: selectedColor = null, size: selectedSize = null } = getSelectedValues(pair);
                  if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) { valid = false; showErrorPopup(`Item ${i}: Please complete selection.`); break; }
                  if (selectedColor) { const colorObj = product.colors.find(c => c.name === selectedColor); if (colorObj) pairImage = colorObj.image; }
                  const varPrice = getVariantPrice(product, selectedColor, selectedSize);
                  const variant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize);
                  items.push({ id: product.id, title: product.title, price: varPrice*(1-discount), compare_price: varPrice*ratio, image: pairImage, size: selectedSize, color: selectedColor, quantity: 1, fromBundle: true, cj_product_id: product.cj_id, cj_variant_id: variant ? variant.vid : null });
                }
                if (!valid) return;
              }
              if (items.length > 0) addBundleToCart(items);
            });
          });

          updateBundlePrices(product);
          const singleDesc = document.querySelector('.single-description');
          const duoDesc = document.querySelector('.duo-description');
          const trioDesc = document.querySelector('.trio-description');
          if (singleDesc) singleDesc.textContent = product.single_discount > 0 ? `Save ${product.single_discount}%` : 'Standard Price';
          if (duoDesc) duoDesc.textContent = `Save ${product.duo_discount || 0}%`;
          if (trioDesc) trioDesc.textContent = `Save ${product.trio_discount || 0}%`;
        }
      }

    setTimeout(() => {
    document.querySelectorAll('.color-swatches .swatch').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('#main-image-slider .main-image').forEach(container => {
        const img = container.querySelector('img');
        if (img && container.dataset.originalSrc) img.src = container.dataset.originalSrc;
    });
}, 300);






// ════════════════════════════════════════════════
//   RECENTLY VIEWED — injection dynamique
// ════════════════════════════════════════════════
(function initRecentlyViewedSection() {
  'use strict';

  const RV_KEY   = 'cf_recently_viewed';
  const RV_MAX   = 20;
  const VISIBLE  = { desktop: 4, mobile: 2 };

  const section  = document.getElementById('rv-section');
  const track    = document.getElementById('rv-track');
  const prevBtn  = document.getElementById('rv-prev');
  const nextBtn  = document.getElementById('rv-next');
  const clearBtn = document.getElementById('rv-clear-btn');

  if (!section || !track) return;

  /* ── Storage ── */
  function getRV() {
    try { return JSON.parse(localStorage.getItem(RV_KEY) || '[]'); } catch(e) { return []; }
  }
  function saveRV(arr) {
    try { localStorage.setItem(RV_KEY, JSON.stringify(arr)); } catch(e) {}
  }

  /* ── Capture le produit courant ── */
  const productSection = document.querySelector('.product-section');
  if (productSection) {
    const pid  = productSection.dataset.productId;
    const prod = products.find(function(p) { return p.id === pid; });
    if (prod) {
      let rv = getRV();
      rv = rv.filter(function(id) { return id !== pid; });
      rv.unshift(pid);
      if (rv.length > RV_MAX) rv = rv.slice(0, RV_MAX);
      saveRV(rv);
    }
  }

  /* ── Slider state ── */
  let currentIdx  = 0;
  let totalCards  = 0;
  let isDragging  = false;
  let dragStartX  = 0;
  let dragDelta   = 0;
  let baseOffset  = 0;

  function getVisible() {
    return window.innerWidth <= 768 ? VISIBLE.mobile : VISIBLE.desktop;
  }

  function getCardWidth() {
    const cards = track.querySelectorAll('.rv-card');
    if (!cards.length) return 0;
    const gap = parseInt(getComputedStyle(track).gap) || 14;
    return cards[0].offsetWidth + gap;
  }

  function goTo(idx) {
    const vis   = getVisible();
    const max   = Math.max(0, totalCards - vis);
    currentIdx  = Math.max(0, Math.min(idx, max));
    baseOffset  = currentIdx * getCardWidth();
    track.style.transition = 'transform 0.42s cubic-bezier(0.4,0,0.2,1)';
    track.style.transform  = 'translateX(-' + baseOffset + 'px)';
  }

  /* ── Build cards ── */
  function buildCards() {
    const rv      = getRV();
    const pid     = productSection ? productSection.dataset.productId : '';
    const filtered = rv.filter(function(id) { return id !== pid; });

    if (!filtered.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    track.innerHTML = '';
    currentIdx = 0;
    totalCards = 0;

    filtered.forEach(function(id) {
      const prod = products.find(function(p) { return p.id === id; });
      if (!prod) return;

      totalCards++;

      const url         = typeof getProductUrl === 'function' ? getProductUrl(id) : (prod.url || '#');
      const imgMain     = upgradeShopifyImageUrl(prod.image,       600);
      const imgHov      = prod.image_hover
                          ? upgradeShopifyImageUrl(prod.image_hover, 600)
                          : null;
      const hasDiscount = prod.compare_price > prod.price;
      const discPct     = hasDiscount
                          ? Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100)
                          : 0;
      const badgeTxt    = prod.badge && prod.badge.text ? prod.badge.text : '';

      const card = document.createElement('a');
      card.className = 'rv-card';
      card.href      = url;

      /* Image wrap :
         image_hover  → affiché par défaut (opacity 1)
         image_principale → affiché au hover (opacity 0 → 1) */
      let imgWrapHTML = '';
      if (imgHov) {
        imgWrapHTML =
          '<img class="rv-card__img" src="'      + imgMain + '" alt="' + prod.title + '" loading="lazy">' +
          '<img class="rv-card__img-hover" src="' + imgHov  + '" alt="" loading="lazy" aria-hidden="true">';
      } else {
        /* Pas d'image hover → affiche la principale directement */
        imgWrapHTML =
          '<img class="rv-card__img rv-no-hover" src="' + imgMain + '" alt="' + prod.title + '" loading="lazy">';
      }

      const badgeHTML    = badgeTxt
        ? '<span class="rv-card__badge">' + badgeTxt + '</span>'
        : '';
      const discHTML     = discPct > 0
        ? '<span class="rv-card__discount">-' + discPct + '%</span>'
        : '';
      const compareHTML  = hasDiscount
        ? '<span class="rv-card__price-compare">$' + parseFloat(prod.compare_price).toFixed(2) + '</span>'
        : '';

      card.innerHTML =
        '<div class="rv-card__img-wrap">' +
          imgWrapHTML +
          badgeHTML +
          discHTML +
        '</div>' +
        '<div class="rv-card__body">' +
          '<div class="rv-card__title">' + prod.title + '</div>' +
          '<div class="rv-card__prices">' +
            '<span class="rv-card__price-current">$' + parseFloat(prod.price).toFixed(2) + '</span>' +
            compareHTML +
          '</div>' +
        '</div>';

      track.appendChild(card);
    });

    /* ── Navigation visibility ── */
    const vis = getVisible();
    const showNav = totalCards > vis;
    if (prevBtn) prevBtn.style.display = showNav ? '' : 'none';
    if (nextBtn) nextBtn.style.display = showNav ? '' : 'none';
  }

  /* ── Build ── */
  buildCards();

  /* ── Nav buttons ── */
  if (prevBtn) prevBtn.addEventListener('click', function() { goTo(currentIdx - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function() { goTo(currentIdx + 1); });

  /* ── Clear ── */
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      const pid = productSection ? productSection.dataset.productId : '';
      saveRV(pid ? [pid] : []);
      buildCards();
    });
  }

  /* ── Drag / Swipe ── */
  function onDragStart(clientX) {
    isDragging = true;
    dragStartX = clientX;
    dragDelta  = 0;
    track.style.transition = 'none';
    track.style.cursor     = 'grabbing';
  }

  function onDragMove(clientX) {
    if (!isDragging) return;
    dragDelta = clientX - dragStartX;
    track.style.transform = 'translateX(' + (-baseOffset + dragDelta) + 'px)';
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    track.style.cursor = 'grab';

    const threshold = 60;
    if (dragDelta < -threshold)      goTo(currentIdx + 1);
    else if (dragDelta > threshold)  goTo(currentIdx - 1);
    else                             goTo(currentIdx);
  }

  /* Mouse */
  track.addEventListener('mousedown', function(e) { onDragStart(e.clientX); });
  window.addEventListener('mousemove', function(e) { if (isDragging) onDragMove(e.clientX); });
  window.addEventListener('mouseup',   onDragEnd);

  /* Touch */
  let touchStartX = 0, touchStartY = 0, touchDirection = null;

  track.addEventListener('touchstart', function (e) {
    const t = e.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY; touchDirection = null;
  }, { passive: true });

  track.addEventListener('touchmove', function (e) {
    const t = e.touches[0];
    const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
    if (touchDirection === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      touchDirection = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (touchDirection === 'h') onDragStart(touchStartX);
      else return; // intention verticale : laisser le navigateur scroller nativement
    }
    if (touchDirection !== 'h') return;
    e.preventDefault();
    onDragMove(t.clientX);
  }, { passive: false });

  track.addEventListener('touchend', function () { touchDirection = null; onDragEnd(); });

  /* Prevent link click after drag */
  track.addEventListener('click', function(e) {
    if (Math.abs(dragDelta) > 8) e.preventDefault();
  }, true);

  /* ── Resize ── */
  let resizeTimer = null;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      currentIdx = 0;
      baseOffset = 0;
      track.style.transition = 'none';
      track.style.transform  = 'translateX(0)';
      const vis      = getVisible();
      const showNav  = totalCards > vis;
      if (prevBtn) prevBtn.style.display = showNav && window.innerWidth > 768 ? '' : 'none';
      if (nextBtn) nextBtn.style.display = showNav && window.innerWidth > 768 ? '' : 'none';
    }, 200);
  });

})();
// ════════════════════════════════════════════════
//   END RECENTLY VIEWED
// ════════════════════════════════════════════════








      window.getProductUrl = getProductUrl;

// Ces lignes existaient déjà — NE PAS SUPPRIMER
window.openCartDrawer = openCartDrawer;
window.checkout = checkout;
window.showCheckoutBlockPopup = showCheckoutBlockPopup;
window.showCheckoutBlockPopup = showCheckoutBlockPopup;
window.openWishlistModal = openWishlistModal;
window.renderCart = renderCart;
window.renderWishlist = renderWishlist;
window.updateBadges = updateBadges;
window.updateWishlistIcons = updateWishlistIcons;



// ══════════════════════════════════════════
//  PRODUCT UPSELL — injecté depuis settings
//  Fonctionne sur n'importe quelle page produit
// ══════════════════════════════════════════
(function initProductUpsell() {

  const upsellItemsContainer = document.getElementById('p2-upsell-items');
  const upsellAddBtn         = document.getElementById('p2-upsell-add-btn');
  const upsellTotalEl        = document.getElementById('p2-upsell-total');
  const upsellBadgeEl        = document.getElementById('p2-upsell-save-badge');

  if (!upsellItemsContainer || !upsellAddBtn) return;

  function run() {
    const settings  = (window.__allProducts || []).find(function(p) { return p.type === 'settings'; }) || {};

    
    var pageKey = '';
    var productSection = document.querySelector('.product-section');
    if (productSection && productSection.dataset.productId) {
      var realProducts = (window.__allProducts || []).filter(function(p) { return !p.type; });
      var idx = realProducts.findIndex(function(p) { return p.id === productSection.dataset.productId; });
      if (idx !== -1) pageKey = 'product' + (idx + 1);
    }
    var upsellCfg  = (settings.product_upsell || {})[pageKey] || {};

    var discountPct = parseFloat(upsellCfg.discount_percent) || 0;
    var itemsCfg    = upsellCfg.items || [];

    if (!itemsCfg.length) return;

    var upsellProducts = itemsCfg.map(function(cfg) {
      return (window.__allProducts || []).find(function(p) { return p.id === cfg.product_id; });
    }).filter(Boolean);

    if (!upsellProducts.length) return;

    upsellProducts.forEach(function(prod) {
      var firstVariant    = prod.variants && prod.variants.length ? prod.variants[0] : null;
      var originalPrice   = firstVariant ? parseFloat(firstVariant.price) : parseFloat(prod.price);
      var comparePrice    = parseFloat(prod.compare_price) || originalPrice;
      var discountedPrice = parseFloat((originalPrice * (1 - discountPct / 100)).toFixed(2));

      var item = document.createElement('div');
      item.className          = 'p2-upsell-item';
      item.dataset.id         = prod.id;
      item.dataset.original   = originalPrice;
      item.dataset.discounted = discountedPrice;
      item.dataset.compare    = comparePrice;

      var imgSrc = upgradeShopifyImageUrl(prod.image, 120);

      item.innerHTML =
        '<div class="p2-upsell-check-wrap">' +
          '<input type="checkbox" id="check-upsell-' + prod.id + '" class="p2-upsell-check" data-id="' + prod.id + '">' +
          '<label for="check-upsell-' + prod.id + '" class="p2-upsell-check-label"></label>' +
        '</div>' +
        '<div class="p2-upsell-img-wrap">' +
          '<img src="' + imgSrc + '" alt="' + prod.title + '" loading="lazy">' +
        '</div>' +
        '<div class="p2-upsell-info">' +
          '<strong>' + prod.title + '</strong>' +
          '<span>' + (prod.description ? prod.description.substring(0, 55) + '…' : '') + '</span>' +
        '</div>' +
        '<div class="p2-upsell-price-col">' +
          '<span class="p2-upsell-old">$' + comparePrice.toFixed(2) + '</span>' +
          '<span class="p2-upsell-new">+$' + discountedPrice.toFixed(2) + '</span>' +
        '</div>';

      upsellItemsContainer.appendChild(item);

      var checkbox = item.querySelector('.p2-upsell-check');
      checkbox.addEventListener('change', updateUpsellTotal);
    });

    function updateUpsellTotal() {
      var total      = 0;
      var anyChecked = false;

      upsellItemsContainer.querySelectorAll('.p2-upsell-check').forEach(function(cb) {
        if (cb.checked) {
          anyChecked = true;
          var itemEl = cb.closest('.p2-upsell-item');
          total += parseFloat(itemEl.dataset.discounted || 0);
        }
      });

      upsellTotalEl.textContent = anyChecked ? '+ $' + total.toFixed(2) : '+ $0.00';
      upsellAddBtn.disabled     = !anyChecked;
    }

    upsellAddBtn.addEventListener('click', function() {
      var added = 0;

      upsellItemsContainer.querySelectorAll('.p2-upsell-check').forEach(function(cb) {
        if (!cb.checked) return;

        var prodId = cb.dataset.id;
        var prod   = (window.__allProducts || []).find(function(p) { return p.id === prodId; });
        if (!prod) return;

        var firstVariant = prod.variants && prod.variants.length ? prod.variants[0] : null;
        var itemEl       = cb.closest('.p2-upsell-item');
        var price        = parseFloat(itemEl.dataset.discounted || prod.price);
        var comparePrice = parseFloat(itemEl.dataset.compare   || prod.compare_price);
        var color        = firstVariant ? (firstVariant.color || null) : null;
        var size         = firstVariant ? (firstVariant.size  || null) : null;
        var cjVariantId  = firstVariant ? firstVariant.vid : null;

        var colorObj = (color && prod.colors)
          ? prod.colors.find(function(c) { return c.name === color; })
          : null;
        var image = upgradeShopifyImageUrl(colorObj ? (colorObj.image || prod.image) : prod.image);

        var existing = cart.find(function(i) {
          return i.id === prodId && i.color === color && i.size === size;
        });

        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({
          id:            prodId,
          title:         prod.title,
          price:         price,
          compare_price: comparePrice,
          image:         image,
          size:          size  || null,
          color:         color || null,
          quantity:      1,
          fromUpsell:    true,
          upsellDiscount: discountPct,
          cj_product_id: prod.cj_id,
          cj_variant_id: cjVariantId
      });
        }
        added++;
      });

      if (added > 0) {
        saveCart();
        updateCartQuantityInSheet();
        if (typeof applyPromoFreeItems === 'function') applyPromoFreeItems();
        saveCart();
        updateBadges();
        renderCart();
        openCartDrawer();

        upsellAddBtn.classList.add('added');
        upsellAddBtn.innerHTML = '<i class="fas fa-check"></i> Added to Cart!';
        setTimeout(function() {
          upsellAddBtn.classList.remove('added');
          upsellAddBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Selected to Cart';
        }, 2500);
      }
    });
  }

  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    var tries = 0;
    var wait = setInterval(function() {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (++tries > 60) {
        clearInterval(wait);
      }
    }, 100);
  }

})();


// Ces 4 lignes sont NOUVELLES — à ajouter
window.__getCart = () => cart;
window.__setCart = (c) => { 
  cart = c;
  localStorage.setItem('cart', JSON.stringify(cart));
  window.cart = cart;
};
window.__getWishlist = () => wishlist;
window.__setWishlist = (w) => { wishlist = w; };

(function() {
  var badge = document.getElementById('p2-upsell-badge');
  if (!badge) return;
  var pageKey = '';
  var productSection = document.querySelector('.product-section');
  if (productSection && productSection.dataset.productId && window.__allProducts) {
    var realProducts = window.__allProducts.filter(function(p) { return !p.type; });
    var idx = realProducts.findIndex(function(p) { return p.id === productSection.dataset.productId; });
    if (idx !== -1) pageKey = 'product' + (idx + 1);
  }
  var upsellCfg   = (settings.product_upsell || {})[pageKey] || {};
  var discountPct = parseFloat(upsellCfg.discount_percent) || 0;
  if (discountPct > 0) badge.textContent = 'Save ' + discountPct + '%';
})();
initAnnouncementBar();



// ══ DRAWER BG IMAGE ══
(function() {
  const cfg = (settings.drawer_bg_image) || {};
  if ((cfg.show || 'no').toLowerCase() !== 'yes' || !cfg.url) return;

  const img = document.getElementById('bbwDrawerBgImg');
  if (!img) return;

  img.src = cfg.url;
  ['bbwDrawerBg','bbwDrawerBgOverlay','bbwDrawerShimmerTop','bbwDrawerShimmerBottom']
    .forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('bbw-drawer-bg--hidden');
    });
})();





(function initStickyMediaMobile() {
  const stickyOn = (settings.sticky_media_mobile || 'no').toLowerCase().trim() === 'yes';
  if (!stickyOn) return;
  if (window.innerWidth > 768) return;

  const mediaEl = document.querySelector('.product-media');
  if (!mediaEl) return;

  // Supprimer les styles inline bloquants
  mediaEl.style.removeProperty('position');
  mediaEl.style.removeProperty('overflow');
  mediaEl.style.removeProperty('top');

  mediaEl.classList.add('sticky-media-mobile');
})();


/* ================================================================
   BBW4LIFE — PRODUCT GRID SECTION 
================================================================ */

(function initBBWProductGrid() {
  'use strict';

  function waitAndRun(cb) {
    if (window.__allProducts && window.__allProducts.length) {
      cb(window.__allProducts);
    } else {
      var tries = 0;
      var poll = setInterval(function () {
        tries++;
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(poll);
          cb(window.__allProducts);
        } else if (tries > 80) {
          clearInterval(poll);
        }
      }, 100);
    }
  }

  function sharpImg(url, size) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('cdn.shopify.com')) return url;
    url = url.replace(/[?&]width=\d+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
    var sep = url.includes('?') ? '&' : '?';
    return url + sep + 'width=' + (size || 600) + '&quality=90';
  }

  function getUrl(allProducts, id) {
    var idx = allProducts.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return '#';
    return '/products/product' + (idx + 1) + '.html';
  }

  function buildCard(prod, url, btnText) {
    var hasDiscount = prod.compare_price && prod.compare_price > prod.price;
    var discountPct = hasDiscount
      ? Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100)
      : 0;

    var badgeHTML = '';
    if (prod.badge && prod.badge.text) {
      badgeHTML = '<span class="bbwpg-card__badge">' + prod.badge.text + '</span>';
    }

    var discHTML = discountPct > 0
      ? '<span class="bbwpg-card__discount">-' + discountPct + '%</span>'
      : '';

    var compareHTML = hasDiscount
      ? '<span class="bbwpg-card__compare">$' + parseFloat(prod.compare_price).toFixed(2) + '</span>'
      : '';

    var imgSrc = sharpImg(prod.image, 600);
    var imgHoverSrc = prod.image_hover ? sharpImg(prod.image_hover, 600) : '';

    var card = document.createElement('div');
    card.className = 'bbwpg-card';

   card.innerHTML =
  '<a class="bbwpg-card__img-link" href="' + url + '" aria-label="' + prod.title + '">' +
    '<div class="bbwpg-card__img-wrap">' +
      '<img class="bbwpg-card__img bbwpg-card__img--main" src="' + (imgHoverSrc || imgSrc) + '" alt="' + prod.title + '" loading="lazy">' +
      (imgHoverSrc
        ? '<img class="bbwpg-card__img bbwpg-card__img--hover" src="' + imgSrc + '" alt="" loading="lazy" aria-hidden="true">'
        : '') +
          badgeHTML +
          discHTML +
        '</div>' +
      '</a>' +
      '<div class="bbwpg-card__body">' +
        '<a class="bbwpg-card__title" href="' + url + '">' + prod.title + '</a>' +
        '<div class="bbwpg-card__prices">' +
          '<span class="bbwpg-card__price">$' + parseFloat(prod.price).toFixed(2) + '</span>' +
          compareHTML +
        '</div>' +
        '<a class="bbwpg-card__btn" href="' + url + '">' +
          '<span>' + (btnText || 'View Product') + '</span>' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12H19M13 6l6 6-6 6"/></svg>' +
        '</a>' +
      '</div>';

    return card;
  }

  function run(allProducts) {

    var section  = document.getElementById('bbw-product-grid-featured');
    var track    = document.getElementById('bbwpg-track');
    var viewport = document.getElementById('bbwpg-viewport');
    var dotsWrap = document.getElementById('bbwpg-dots');
    var prevBtn  = document.getElementById('bbwpg-prev');
    var nextBtn  = document.getElementById('bbwpg-next');

    if (!section || !track) return;

    var settings  = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
    var cfg       = settings.product_grid_section || {};
    var ids       = cfg.product_ids || [];
    var btnText   = cfg.view_product_btn_text || 'View Product';

    if (!ids.length) { section.style.display = 'none'; return; }

    var eyebrowEl  = document.getElementById('bbwpg-eyebrow');
    var titleEl    = document.getElementById('bbwpg-title');
    var subtitleEl = document.getElementById('bbwpg-subtitle');
    if (eyebrowEl  && cfg.eyebrow)   eyebrowEl.textContent  = cfg.eyebrow;
    if (titleEl    && cfg.title)     titleEl.textContent     = cfg.title;
    if (subtitleEl && cfg.subtitle)  subtitleEl.textContent  = cfg.subtitle;

    var prods = ids
      .map(function (id) { return allProducts.find(function (p) { return p.id === id; }); })
      .filter(Boolean);

    if (!prods.length) { section.style.display = 'none'; return; }

    track.innerHTML = ''; // retire un éventuel skeleton avant de remplir

    prods.forEach(function (prod) {
      var url  = getUrl(allProducts, prod.id);
      var card = buildCard(prod, url, btnText);
      track.appendChild(card);
    });

    /* ── Slider logic ── */
    var isMobile    = function () { return window.innerWidth < 768; };
    var perPage     = function () { return isMobile() ? 2 : 4; };
    var totalPages  = function () { return Math.ceil(prods.length / perPage()); };
    var currentPage = 0;
    var isAnimating = false;

    /* ── DESKTOP — translateX ── */
    function getCardWidth() {
      var cards = track.querySelectorAll('.bbwpg-card');
      if (!cards.length) return 0;
      var gap = parseInt(getComputedStyle(track).gap) || 20;
      return cards[0].offsetWidth + gap;
    }

    function goToDesktop(page) {
      if (isAnimating) return;
      var tp = totalPages();
      if (page < 0)   page = tp - 1;
      if (page >= tp) page = 0;
      currentPage = page;
      var offset = page * perPage() * getCardWidth();
      track.style.transform = 'translateX(-' + offset + 'px)';
      isAnimating = true;
      setTimeout(function () { isAnimating = false; }, 480);
      updateDots();
      updateArrows();
    }

    /* ── MOBILE — scroll natif + snap ── */
    function initMobileScroll() {
      track.style.overflowX = 'auto';
      track.style.scrollSnapType = 'x mandatory';
      track.style.webkitOverflowScrolling = 'touch';
      track.style.scrollbarWidth = 'none';
      track.querySelectorAll('.bbwpg-card').forEach(function (card) {
        card.style.scrollSnapAlign = 'start';
        card.style.flexShrink = '0';
      });
      var syncTimer = null;
      track.addEventListener('scroll', function () {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(function () {
          var cards = track.querySelectorAll('.bbwpg-card');
          if (!cards.length) return;
          var gap   = parseInt(getComputedStyle(track).gap) || 12;
          var cardW = cards[0].offsetWidth + gap;
          var idx   = Math.round(track.scrollLeft / cardW);
          var page  = Math.floor(idx / 2);
          if (page !== currentPage) {
            currentPage = page;
            updateDots();
          }
        }, 60);
      }, { passive: true });
    }

    function goToMobile(page) {
      var cards = track.querySelectorAll('.bbwpg-card');
      if (!cards.length) return;
      var tp = totalPages();
      if (page < 0)   page = tp - 1;
      if (page >= tp) page = 0;
      currentPage = page;
      var gap   = parseInt(getComputedStyle(track).gap) || 12;
      var cardW = cards[0].offsetWidth + gap;
      track.scrollTo({ left: page * 2 * cardW, behavior: 'smooth' });
      updateDots();
      updateArrows();
    }

    function goTo(page) {
      if (isMobile()) { goToMobile(page); } else { goToDesktop(page); }
    }

    /* ── Dots ── */
    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      var tp = totalPages();
      for (var i = 0; i < tp; i++) {
        (function (idx) {
          var dot = document.createElement('button');
          dot.className = 'bbwpg-dot' + (idx === 0 ? ' bbwpg-dot--active' : '');
          dot.setAttribute('role', 'tab');
          dot.setAttribute('aria-label', 'Page ' + (idx + 1));
          dot.addEventListener('click', function () { goTo(idx); });
          dotsWrap.appendChild(dot);
        })(i);
      }
    }

    function updateDots() {
      if (!dotsWrap) return;
      dotsWrap.querySelectorAll('.bbwpg-dot').forEach(function (d, i) {
        d.classList.toggle('bbwpg-dot--active', i === currentPage);
      });
    }

    function updateArrows() {
      var tp = totalPages();
      if (prevBtn) prevBtn.style.display = tp <= 1 ? 'none' : '';
      if (nextBtn) nextBtn.style.display = tp <= 1 ? 'none' : '';
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(currentPage + 1); });

    /* ── Resize ── */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        currentPage = 0;
        if (isMobile()) {
          track.scrollLeft = 0;
        } else {
          track.style.transition = 'none';
          track.style.transform  = 'translateX(0)';
          setTimeout(function () { track.style.transition = ''; }, 50);
        }
        buildDots();
        updateArrows();
      }, 200);
    });

    /* ── Init ── */
    if (isMobile()) { initMobileScroll(); }
    buildDots();
    updateArrows();
  }

  waitAndRun(run);

})();




// ══════════════════════════════════════════
//  JRGQ COLLECTIONS — inject from settings
// ══════════════════════════════════════════
(function initJrgqCollections() {
  const mosaic = document.getElementById('jrgq-gallery-mosaic');
  if (!mosaic) return;

  const settings = products.find(p => p.type === 'settings') || {};
  const jrgqCfg  = settings.jrgq_collections || {};
  const cols     = jrgqCfg.collections || [];

  if (!cols.length) return;

  // ── IDs à exclure uniquement de cette section (jrgq-gallery-mosaic) ──
  const HIDDEN_IN_JRGQ = ['bbw4life-new-arrivals', 'curvy-bags'];
  const visibleCols = cols.filter(function(col) {
    return !HIDDEN_IN_JRGQ.includes(col.id);
  });

  if (!visibleCols.length) return;

  mosaic.innerHTML = '';

  visibleCols.forEach(function(col, idx) {
    // Classe de positionnement identique à l'original
    var posClass = 'jrgq-gal-item--' + (idx + 1);
    var featClass = col.featured ? ' jrgq-gal-item--featured' : '';

    var featuredBadge = col.featured
      ? '<div class="jrgq-gal-featured-badge"><i class="fas fa-heart"></i> Most Loved</div>'
      : '';

    var item = document.createElement('div');
    item.className = 'jrgq-gal-item ' + posClass + featClass;
    item.dataset.index = idx;

    // L'image est cliquable — redirige vers la page collection
    item.innerHTML =
      '<a href="' + col.url + '" class="jrgq-gal-img-link" aria-label="Voir la collection ' + col.title + '">' +
        '<div class="jrgq-gal-img-wrap">' +
          '<img src="' + (col.image || '') + '" alt="Collection ' + col.title + '" loading="lazy" class="jrgq-gal-img">' +
          '<div class="jrgq-gal-gradient"></div>' +
          '<div class="jrgq-gal-shimmer"></div>' +
          featuredBadge +
        '</div>' +
      '</a>' +
      '<div class="jrgq-gal-info' + (col.featured ? ' jrgq-gal-info--featured' : '') + '">' +
        '<span class="jrgq-gal-loss">' + (col.loss || '') + '</span>' +
        '<span class="jrgq-gal-time">' + (col.weeks || '') + '</span>' +
        '<span class="jrgq-gal-name">' + col.title + '</span>' +
        '<div class="jrgq-gal-stars">★★★★★</div>' +
        '<p class="jrgq-gal-quote">"' + (col.quote || col.subtitle || '') + '"</p>' +
        '<a href="' + col.url + '" class="jrgq-gal-cta-btn">' + (col.cta_label || 'View Collection →') + '</a>' +
      '</div>' +
      '<div class="jrgq-gal-badge">Curated</div>';

    mosaic.appendChild(item);
  });

  // ── Réactive l'IntersectionObserver sur les nouvelles cartes ──
  if ('IntersectionObserver' in window) {
    var galItems = mosaic.querySelectorAll('.jrgq-gal-item');
    var galObs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0) scale(1)';
          galObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    galItems.forEach(function(item, i) {
      item.style.opacity = '0';
      item.style.transform = 'translateY(30px) scale(0.95)';
      item.style.transition =
        'opacity 0.65s ease ' + (i * 0.08) + 's, ' +
        'transform 0.65s cubic-bezier(0.34,1.2,0.64,1) ' + (i * 0.08) + 's';
      galObs.observe(item);
    });
  }

})();

// ── PLANS AVAILABLE — block program CTAs when setting = no ──
(function applyPlansAvailableSetting() {
    const settings     = products.find(p => p.type === 'settings') || {};
    const plansOn      = (settings.plans_available || 'no').toLowerCase() === 'yes';

    // 1. Plan request trigger button — visible quand plans NON disponibles
    const triggerWrap  = document.querySelector('.plan-request-trigger-wrap');
    if (triggerWrap) {
        triggerWrap.style.display = plansOn ? 'none' : '';
    }

    // 2. Program card CTA buttons + prices
    document.querySelectorAll('.program-card').forEach(card => {
        const ctaBtn   = card.querySelector('.prog-cta');
        const priceEl  = card.querySelector('.prog-price');

        if (!plansOn) {
            if (ctaBtn) {
                ctaBtn.disabled = true;
                ctaBtn.classList.add('prog-cta--disabled');
                ctaBtn.setAttribute('title', 'Plans temporarily unavailable');
                const clone = ctaBtn.cloneNode(true);
                ctaBtn.parentNode.replaceChild(clone, ctaBtn);
            }
            if (priceEl) {
                priceEl.textContent = '$0.00';
                priceEl.classList.add('prog-price--free');
                priceEl.style.opacity = '0.4';
            }
        }
    });

    // 3. Comparison table price row
    if (!plansOn) {
        const priceRow = document.querySelector('.comparison-table-section .price-row');
        if (priceRow) {
            priceRow.querySelectorAll('td:not(:first-child)').forEach(td => {
                td.textContent = '$0.00';
                td.style.opacity = '0.4';
            });
        }

        document.querySelectorAll('.final-cta-btn').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('prog-cta--disabled');
            btn.setAttribute('title', 'Plans temporarily unavailable');
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
        });
    }

    // 4. Block open-plan-program-popup triggers
    if (!plansOn) {
        document.querySelectorAll('.open-plan-program-popup').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('prog-cta--disabled');
            btn.setAttribute('title', 'Plans temporarily unavailable');
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
        });
    }
})();


(function initPlanReservationPopup() {
    'use strict';

    const BBW_FEATURED_IDS = [
      'Pdg-Francenel-product69',
      'Pdg-Francenel-product70',
      'Pdg-Francenel-product71',
      'Pdg-Francenel-product72',
      'Pdg-Francenel-product73',
      'Pdg-Francenel-product74',
      'Pdg-Francenel-product75',
      'Pdg-Francenel-product98',
      'Pdg-Francenel-product99',
      'Pdg-Francenel-product100',
      'Pdg-Francenel-product101',
      'Pdg-Francenel-product102',
      'Pdg-Francenel-product103',
      'Pdg-Francenel-product104',
      'Pdg-Francenel-product105',
      'Pdg-Francenel-product106',
      'Pdg-Francenel-product107',
      'Pdg-Francenel-product108',
      'Pdg-Francenel-product109',
      'Pdg-Francenel-product110'
    ];

    const overlay     = document.getElementById('plan-popup-overlay');
    const modal       = overlay ? overlay.querySelector('.plan-popup-modal') : null;
    const closeBtn    = document.getElementById('plan-popup-close');
    const stepForm    = document.getElementById('plan-step-form');
    const stepPayment = document.getElementById('plan-step-payment');
    const stepThanks  = document.getElementById('plan-step-thanks');
    const submitBtn   = document.getElementById('plan-submit-btn');
    const payBtn      = document.getElementById('plan-pay-btn');
    const backBtn     = document.getElementById('plan-back-btn');
    const closeThanks = document.getElementById('plan-close-thanks');
    const spotsCount  = document.getElementById('plan-spots-count');

    if (!overlay || !modal) return;

    let clientData        = {};
    let selectedProgram   = '';
    let selectedProductId = '';
    let selectedSize      = '';
    let selectedColor     = '';
    let selectedProductImage = ''; 
    let reservationPrice  = 10;

    function injectPriceLabels(price) {
      document.querySelectorAll('.plan-reservation-price-label').forEach(el => {
        el.textContent = '$' + price;
      });
    }

    function loadReservationPrice() {
      const s = (window.__allProducts || []).find(p => p.type === 'settings') || {};
      if (s.reservation_price !== undefined) {
        reservationPrice = parseFloat(s.reservation_price) || 10;
        injectPriceLabels(reservationPrice);
      } else {
        let tries = 0;
        const wait = setInterval(() => {
          tries++;
          const s2 = (window.__allProducts || []).find(p => p.type === 'settings') || {};
          if (s2.reservation_price !== undefined) {
            clearInterval(wait);
            reservationPrice = parseFloat(s2.reservation_price) || 10;
            injectPriceLabels(reservationPrice);
          } else if (tries > 60) {
            clearInterval(wait);
            injectPriceLabels(reservationPrice);
          }
        }, 100);
      }
    }
    loadReservationPrice();

    const SPOTS_KEY = 'plan_spots_remaining';
    let spotsRemaining = parseInt(sessionStorage.getItem(SPOTS_KEY) || '27');
    if (spotsCount) spotsCount.textContent = spotsRemaining;
    function decreaseSpot() {
      if (spotsRemaining > 1) {
        spotsRemaining = Math.max(1, spotsRemaining - 1);
        sessionStorage.setItem(SPOTS_KEY, spotsRemaining);
        if (spotsCount) spotsCount.textContent = spotsRemaining;
      }
    }
    setInterval(decreaseSpot, Math.random() * 90000 + 90000);

    function populateProductSelect() {
      const selectEl = document.getElementById('plan-program');
      if (!selectEl) return;

      const allProds = window.__allProducts || [];
      const featuredProds = BBW_FEATURED_IDS
        .map(id => allProds.find(p => p.id === id))
        .filter(Boolean);

      selectEl.innerHTML = '<option value="" disabled selected>Choose a product...</option>';
      featuredProds.forEach(prod => {
        const opt = document.createElement('option');
        opt.value = prod.id;
        opt.textContent = prod.title;
        opt.dataset.productId = prod.id;
        selectEl.appendChild(opt);
      });

      selectEl.addEventListener('change', function() {
        const pid = this.value;
        const prod = allProds.find(p => p.id === pid);
        if (prod) {
          selectedProductId = pid;
          selectedProgram   = prod.title;
          selectedProductImage = (prod.media && prod.media.length > 0)
            ? upgradeShopifyImageUrl(prod.media[0], 600)
            : upgradeShopifyImageUrl(prod.image, 600);
          populateSizeSelect(prod);
          populateColorSelect(prod);
        }
      });
    }

    function populateSizeSelect(prod) {
      const sizeEl  = document.getElementById('plan-size');
      const sizeGrp = document.getElementById('plan-size-group');
      if (!sizeEl) return;

      if (sizeGrp) sizeGrp.style.display = '';
      sizeEl.oninput = function() { selectedSize = this.value; };
    }

    function populateColorSelect(prod) {
      const colorEl     = document.getElementById('plan-color');
      const colorGrp    = document.getElementById('plan-color-group');
      const previewWrap = document.getElementById('plan-color-preview-wrap');
      const previewCont = document.getElementById('plan-color-swatches-preview');
      if (!colorEl) return;

      if (colorGrp) colorGrp.style.display = '';

      if (previewCont && previewWrap) {
        previewCont.innerHTML = '';
        const colors = (prod.colors || []).filter(c => c.active !== false);
        colors.forEach(c => {
          const item = document.createElement('div');
          item.className = 'plan-color-swatch-item';
          item.dataset.color = c.name;
          item.innerHTML = `<span class="plan-color-swatch-dot" style="background:${c.hex || '#ccc'}"></span>${c.name}`;
          item.addEventListener('click', () => {
            previewCont.querySelectorAll('.plan-color-swatch-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            colorEl.value = c.name;
            selectedColor = c.name;
          });
          previewCont.appendChild(item);
        });
        previewWrap.style.display = colors.length > 0 ? '' : 'none';
      }

      colorEl.oninput = function() {
        selectedColor = this.value;
        if (previewCont) {
          previewCont.querySelectorAll('.plan-color-swatch-item').forEach(item => {
            item.classList.toggle('active', item.dataset.color === selectedColor);
          });
        }
      };
    }

    function openPopup(preselectedProductId) {
      if (window.__allProducts && window.__allProducts.length) {
        populateProductSelect();
        if (preselectedProductId) {
          setTimeout(() => {
            const sel = document.getElementById('plan-program');
            if (sel) {
              sel.value = preselectedProductId;
              sel.dispatchEvent(new Event('change'));
            }
          }, 50);
        }
      } else {
        let tries = 0;
        const wait = setInterval(() => {
          tries++;
          if (window.__allProducts && window.__allProducts.length) {
            clearInterval(wait);
            populateProductSelect();
            if (preselectedProductId) {
              setTimeout(() => {
                const sel = document.getElementById('plan-program');
                if (sel) { sel.value = preselectedProductId; sel.dispatchEvent(new Event('change')); }
              }, 50);
            }
          } else if (tries > 60) clearInterval(wait);
        }, 100);
      }

      showStep('form');
      clearErrors();
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      injectPriceLabels(reservationPrice);
    }

    function closePopup() {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function showStep(step) {
      stepForm.style.display    = step === 'form'    ? '' : 'none';
      stepPayment.style.display = step === 'payment' ? '' : 'none';
      stepThanks.style.display  = step === 'thanks'  ? '' : 'none';
    }

    function showThanksStep(firstName, program) {
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      showStep('thanks');
      injectPriceLabels(reservationPrice);
      const thanksName  = document.getElementById('plan-thanks-name');
      const thanksBadge = document.getElementById('plan-thanks-program-text');
      if (thanksName)  thanksName.textContent  = 'Welcome, ' + firstName + '!';
      if (thanksBadge) thanksBadge.textContent = program || '';
    }

    window.openProductRequestPopup = openPopup;
    window.openPlanPopup           = openPopup;

    function showError(id, msg) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = msg; el.style.display = 'block';
    }
    function clearErrors() {
      ['plan-popup-error', 'plan-pay-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.style.display = 'none'; }
      });
    }
    function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
    function setBtnLoading(btn, loading) {
      if (!btn) return;
      btn.disabled = loading;
      btn.innerHTML = loading
        ? '<div class="plan-spinner"></div> Processing...'
        : '<i class="fi fi-rr-lock"></i> Pay $' + reservationPrice + ' — Reserve My Product';
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        clearErrors();
        const firstName = val('plan-firstname');
        const lastName  = val('plan-lastname');
        const email     = val('plan-email');
        const phone     = val('plan-phone');
        const program   = val('plan-program');
        const size      = val('plan-size');
        const color     = val('plan-color');
        const consent   = document.getElementById('plan-consent') && document.getElementById('plan-consent').checked;

        const selectEl = document.getElementById('plan-program');
        const productTitle = selectEl && selectEl.selectedIndex > 0
          ? selectEl.options[selectEl.selectedIndex].text
          : program;

        if (!firstName || !lastName || !email || !program) {
          showError('plan-popup-error', 'Please fill in all required fields.');
          return;
        }
        if (!email.includes('@') || !email.includes('.')) {
          showError('plan-popup-error', 'Please enter a valid email address.');
          return;
        }
        if (!consent) {
          showError('plan-popup-error', 'Please check the consent box to continue.');
          return;
        }

        selectedSize      = size;
        selectedColor     = color;
        selectedProgram   = productTitle;
        selectedProductId = program;

        clientData = {
          firstName,
          lastName,
          email,
          phone,
          program:   productTitle,
          productId: program,
          size:      size,
          color:     color,
          consent:   'Yes'
        };

        const payProgramName    = document.getElementById('plan-pay-program-name');
        const payVariantSummary = document.getElementById('plan-pay-variant-summary');
        if (payProgramName)    payProgramName.textContent    = productTitle;
        if (payVariantSummary) payVariantSummary.textContent =
          (size ? 'Size: ' + size : '') + (size && color ? ' · ' : '') + (color ? 'Color: ' + color : '');

        showStep('payment');
      });
    }

    if (backBtn) backBtn.addEventListener('click', () => showStep('form'));

    if (payBtn) {
      payBtn.addEventListener('click', async () => {
        clearErrors();
        const method = document.querySelector('input[name="plan-payment"]:checked');
        if (!method) { showError('plan-pay-error', 'Please choose a payment method.'); return; }
        setBtnLoading(payBtn, true);
        try {
          if (method.value === 'stripe') await handleStripe();
          else await handlePaypal();
        } catch (err) {
          showError('plan-pay-error', err.message || 'Payment failed. Please try again.');
          setBtnLoading(payBtn, false);
        }
      });
    }

    async function handleStripe() {
      const returnUrl = window.location.origin + window.location.pathname;

      const res = await fetch('/.netlify/functions/create-reservation-stripe-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          amount: reservationPrice,
          program: selectedProgram,
          productId: selectedProductId,
          productImage: selectedProductImage,
          customer: clientData,
          returnUrl
        })
      });
      const data = await res.json();
      if (!data.success || !data.sessionId) throw new Error(data.error || 'Stripe session failed.');

      sessionStorage.setItem('plan_res_client',     JSON.stringify(clientData));
      sessionStorage.setItem('plan_res_program',    selectedProgram);
      sessionStorage.setItem('plan_res_return_url', returnUrl);

      const settings = (window.__allProducts || []).find(p => p.type === 'settings') || {};
      const stripe = Stripe(window.STRIPE_PUBLIC_KEY || settings.stripe_public_key || '');
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    }

    async function handlePaypal() {
      const returnUrl = window.location.origin + window.location.pathname;

      const res = await fetch('/.netlify/functions/create-reservation-paypal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', amount: reservationPrice, program: selectedProgram, customer: clientData, returnUrl })
      });
      const data = await res.json();
      if (!data.success || !data.approvalUrl) throw new Error(data.error || 'PayPal failed.');

      sessionStorage.setItem('plan_res_client',     JSON.stringify(clientData));
      sessionStorage.setItem('plan_res_program',    selectedProgram);
      sessionStorage.setItem('plan_res_return_url', returnUrl);

      window.location.href = data.approvalUrl;
    }

    /* ── Return Stripe ── */
    async function checkReturnFromStripe() {
      const params    = new URLSearchParams(window.location.search);
      const sessionId = params.get('res_session_id');
      if (!sessionId) return false;

      const savedReturnUrl = sessionStorage.getItem('plan_res_return_url');
      if (savedReturnUrl) {
        const currentBase = window.location.href.split('?')[0];
        if (currentBase !== savedReturnUrl) {
          window.location.replace(savedReturnUrl + window.location.search);
          return false;
        }
      }

      const rawClient      = sessionStorage.getItem('plan_res_client');
      const pendingProgram = sessionStorage.getItem('plan_res_program') || '';
      let pendingClient    = null;
      try { pendingClient = rawClient ? JSON.parse(rawClient) : null; } catch(e) {}

      const firstName = pendingClient ? pendingClient.firstName : '';
      showThanksStep(firstName, pendingProgram);

      // ← SAUVEGARDE IMMÉDIATE — sans attendre verify
      if (pendingClient) {
        pendingClient.program = pendingClient.program || pendingProgram;
        await savePlanRequestToSheet(pendingClient);
      }

      sessionStorage.removeItem('plan_res_client');
      sessionStorage.removeItem('plan_res_program');
      sessionStorage.removeItem('plan_res_return_url');
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }

    /* ── Return PayPal ── */
    async function checkReturnFromPaypal() {
      const params    = new URLSearchParams(window.location.search);
      const resPaypal = params.get('res_paypal');
      const orderID   = params.get('token');
      if (!resPaypal || !orderID) return false;

      const savedReturnUrl = sessionStorage.getItem('plan_res_return_url');
      if (savedReturnUrl) {
        const currentBase = window.location.href.split('?')[0];
        if (currentBase !== savedReturnUrl) {
          window.location.replace(savedReturnUrl + window.location.search);
          return false;
        }
      }

      const rawClient      = sessionStorage.getItem('plan_res_client');
      const pendingProgram = sessionStorage.getItem('plan_res_program') || '';
      let pendingClient    = null;
      try { pendingClient = rawClient ? JSON.parse(rawClient) : null; } catch(e) {}

      const firstName = pendingClient ? pendingClient.firstName : '';
      showThanksStep(firstName, pendingProgram);

      // ← CAPTURE PAYPAL
      try {
        await fetch('/.netlify/functions/create-reservation-paypal', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'capture', orderID, clientData: pendingClient, program: pendingProgram, amount: reservationPrice })
        });
      } catch (err) {
        console.error('[PayPal Return] capture error:', err.message);
      }

      // ← SAUVEGARDE IMMÉDIATE
      if (pendingClient) {
        pendingClient.program = pendingClient.program || pendingProgram;
        await savePlanRequestToSheet(pendingClient);
      }

      sessionStorage.removeItem('plan_res_client');
      sessionStorage.removeItem('plan_res_program');
      sessionStorage.removeItem('plan_res_return_url');
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }

    /* ── Save to sheet ── */
    async function savePlanRequestToSheet(client) {
      if (!client) return;
      try {
        const res = await fetch('/.netlify/functions/save-plan-request', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: client.firstName  || '',
            lastName:  client.lastName   || '',
            email:     client.email      || '',
            phone:     client.phone      || '',
            program:   client.program    || '',
            productId: client.productId  || '',
            size:      client.size       || '',
            color:     client.color      || '',
            consent:   client.consent    || 'Yes'
          })
        });
        const data = await res.json();
        console.log('[savePlanRequestToSheet] Response:', data);
        if (!data.success) console.error('[savePlanRequestToSheet] Failed:', data.error);
      } catch (e) {
        console.error('[savePlanRequestToSheet] failed:', e.message);
      }
    }

    if (closeBtn)    closeBtn.addEventListener('click', closePopup);
    if (closeThanks) closeThanks.addEventListener('click', closePopup);
    overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });

    const openBtn = document.getElementById('open-plan-popup');
    if (openBtn) openBtn.addEventListener('click', () => openPopup(null));

    document.querySelectorAll('.open-plan-popup-extra').forEach(btn => {
      btn.addEventListener('click', () => openPopup(btn.dataset.productId || null));
    });

    async function init() {
      const stripeHandled = await checkReturnFromStripe();
      if (!stripeHandled) await checkReturnFromPaypal();
    }
    init();

})();




/* ══════════════════════════════════════════════════════════════
   BBW4LIFE — FEATURED PRODUCTS REQUEST MODE
   Runs after products.data.json is loaded
══════════════════════════════════════════════════════════════ */
(function initFeaturedRequestMode() {
  'use strict';

  const BBW_FEATURED_IDS = [
    'Pdg-Francenel-product69',
    'Pdg-Francenel-product70',
    'Pdg-Francenel-product71',
    'Pdg-Francenel-product72',
    'Pdg-Francenel-product73',
    'Pdg-Francenel-product74',
    'Pdg-Francenel-product75',
    'Pdg-Francenel-product98',
    'Pdg-Francenel-product99',
    'Pdg-Francenel-product100',
    'Pdg-Francenel-product101',
    'Pdg-Francenel-product102',
    'Pdg-Francenel-product103',
    'Pdg-Francenel-product104',
    'Pdg-Francenel-product105',
    'Pdg-Francenel-product106',
    'Pdg-Francenel-product107',
    'Pdg-Francenel-product108',
    'Pdg-Francenel-product109',
    'Pdg-Francenel-product110'
  ];

  function isFeaturedProduct(id) {
    return BBW_FEATURED_IDS.includes(id);
  }

  function run() {
    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(p => p.type === 'settings') || {};
    const plansOn     = (settings.plans_available || 'no').toLowerCase() === 'yes';

    /* ══ PRODUCT PAGE — detect if current page is a featured product ══ */
    const productSection = document.querySelector('.product-section');
    if (productSection) {
      const pid = productSection.dataset.productId;
      if (pid && isFeaturedProduct(pid)) {
       if (!plansOn) {
          productSection.classList.add('bbw-featured-request-mode');


          const satcAddBtn = document.getElementById('satc-add-btn');
          if (satcAddBtn) {
            const newBtn = satcAddBtn.cloneNode(true);
            newBtn.innerHTML = '<i class="fi fi-rr-shopping-bag"></i><span>Request This Product</span>';
            newBtn.addEventListener('click', () => {
              if (typeof window.openProductRequestPopup === 'function') window.openProductRequestPopup(pid);
            });
            satcAddBtn.parentNode.replaceChild(newBtn, satcAddBtn);
          }

          /* ── 1. Injecter un bouton REQUEST à la place du bloc quantity ── */
          const qtyWrapper = productSection.querySelector('.quantity-add-wrapper');
          if (qtyWrapper && !qtyWrapper.querySelector('.bbw-featured-request-btn')) {
            const reqBtnInline = document.createElement('button');
            reqBtnInline.className = 'bbw-featured-request-btn';
            reqBtnInline.innerHTML = '<i class="fi fi-rr-shopping-bag"></i> Request This Product';
            reqBtnInline.addEventListener('click', () => {
              if (typeof window.openProductRequestPopup === 'function') window.openProductRequestPopup(pid);
            });
            qtyWrapper.insertAdjacentElement('afterend', reqBtnInline);
            qtyWrapper.style.display = 'none';
          }

          /* ── 2. Transformer le Sticky ATC en bouton REQUEST ── */
          const satcBar = document.getElementById('sticky-atc');
          if (satcBar) {
            /* #sticky-atc est hors de .product-section dans le DOM (juste
               avant </body>) — la classe posée plus haut sur productSection
               ne peut donc pas être ciblée par un sélecteur CSS descendant
               depuis le sticky bar. On la pose aussi ici directement. */
            satcBar.classList.add('bbw-featured-request-mode');

            /* Remplacer le bouton ATC du sticky */
            const satcAddBtn = document.getElementById('satc-add-btn');
            if (satcAddBtn && !satcAddBtn.dataset.requestified) {
              satcAddBtn.dataset.requestified = '1';
              satcAddBtn.innerHTML = '<i class="fi fi-rr-shopping-bag"></i><span>Request This Product</span>';
              satcAddBtn.style.background = 'linear-gradient(135deg, #c0385e, #7b3f6e)';
              /* Supprimer l'ancien listener en clonant */
              const newSatcBtn = satcAddBtn.cloneNode(true);
              satcAddBtn.parentNode.replaceChild(newSatcBtn, satcAddBtn);
              newSatcBtn.addEventListener('click', () => {
                if (typeof window.openProductRequestPopup === 'function') window.openProductRequestPopup(pid);
              });
            }

            /* Masquer les selectors taille/couleur/qty dans le sticky — inutiles pour une request */
            const satcSelectors = satcBar.querySelector('.sticky-atc__selectors');
            if (satcSelectors) satcSelectors.style.display = 'none';

            /* Masquer le bouton Buy Now — pas de vente directe en mode request */
            const satcBuyBtn = document.getElementById('satc-buy-btn');
            if (satcBuyBtn) satcBuyBtn.style.display = 'none';
          }

          /* ── 3. Masquer le bloc plan-request-section (bouton en bas de page) et afficher le nôtre ── */
          const reqSection = document.getElementById('bbw-request-section');
          if (reqSection) reqSection.style.display = 'none';
        } else {
          /* plans_available = yes — hide request button */
          const reqWrap = document.getElementById('plan-request-trigger-wrap');
          if (reqWrap) reqWrap.style.display = 'none';
        }
      }
    }

    /* ══ COLLECTION GRID — mark featured cards ══ */
    function applyCollectionCards() {
      document.querySelectorAll('.col-product-card').forEach(card => {
        const pid = card.dataset.id;
        if (!pid || !isFeaturedProduct(pid)) return;

        if (!plansOn) {
          card.classList.add('bbw-request-only');

          /* Quick View button → open popup instead */
          const qvBtn = card.querySelector('.col-card__quick-view');
          if (qvBtn) {
            qvBtn.classList.remove('bbw-qv-hidden');
            qvBtn.innerHTML = '<i class="fi fi-rr-shopping-bag"></i> Request';
            qvBtn.onclick = (e) => {
              e.stopPropagation();
              if (typeof window.openProductRequestPopup === 'function') {
                window.openProductRequestPopup(pid);
              }
            };
          }

          /* ATC button → open popup instead of adding to cart */
          const atcBtn = card.querySelector('.col-card__btn--cart');
          if (atcBtn) {
            atcBtn.innerHTML = '<i class="fi fi-rr-shopping-bag"></i> Request';
            atcBtn.onclick = (e) => {
              e.stopPropagation();
              if (typeof window.openProductRequestPopup === 'function') {
                window.openProductRequestPopup(pid);
              }
            };
          }

        } else {
          /* plans_available = yes — normal behavior, hide nothing */
          card.classList.remove('bbw-request-only');
        }
      });
    }

    /* Apply immediately and re-apply after each collection render */
    applyCollectionCards();

    /* Watch for dynamically rendered cards (collection.js renders async) */
    const colGrid = document.getElementById('colGrid');
    if (colGrid) {
      const observer = new MutationObserver(() => { applyCollectionCards(); });
      observer.observe(colGrid, { childList: true, subtree: false });
    }
  }

  /* Wait for products then run */
  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    let tries = 0;
    const wait = setInterval(() => {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (tries > 80) clearInterval(wait);
    }, 100);
  }

})();


// ══ SPOTLIGHT SLIDER — mobile only ══
if (window.innerWidth <= 768) {
    const grid = document.querySelector('.spotlight-grid');
    if (grid) {
        let current = 0;
        setInterval(() => {
            current = (current + 1) % grid.querySelectorAll('img').length;
            grid.scrollTo({ left: grid.offsetWidth * current, behavior: 'smooth' });
        }, 4000);
    }
}


// ══════════════════════════════════════════
//  CART DRAWER REVIEWS — inject from settings
// ══════════════════════════════════════════
(function initCartReviews() {
  const container = document.getElementById('cart-reviews-carousel');
  if (!container) return;

  const settings = (products.find(p => p.type === 'settings') || {});
  const reviews  = settings.cart_reviews || [];

  if (!reviews.length) return;

  const googleSVG = `
    <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>`;

  reviews.forEach(r => {
    const stars = '★'.repeat(Math.min(5, Math.max(1, r.stars || 5)));

    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `
      <div class="review-item-inner">
        <div class="review-top">
          <img src="${r.avatar}" alt="${r.name}" class="review-avatar">
          <div class="review-meta">
            <h4>${r.name}</h4>
            <div class="review-stars">${stars}</div>
          </div>
          <span class="verified-badge">${googleSVG}</span>
        </div>
        <p class="review-text">"${r.text}"</p>
        <span class="review-date">${r.date}</span>
      </div>`;

    container.appendChild(item);
  });

  // Carousel auto-rotation
  const items = container.querySelectorAll('.review-item');
  if (items.length > 1) {
    let current = 0;
    items[current].classList.add('active');
    setInterval(() => {
      items[current].classList.remove('active');
      current = (current + 1) % items.length;
      items[current].classList.add('active');
    }, 5000);
  } else if (items.length === 1) {
    items[0].classList.add('active');
  }
})();

// ══════════════════════════════════════════
//  BAR SEPARATOR — inject from settings
// ══════════════════════════════════════════
(function initBarSeparator() {
  function run() {
    const settings = (window.__allProducts || []).find(p => p.type === 'settings') || {};
    const bs = settings.bar_separator || {};

    const section = document.getElementById('bar-separator-section');
    const line    = section ? section.querySelector('.bar-separator-line') : null;
    if (!section || !line) return;

    // Show/hide
    if ((bs.show || 'yes').toLowerCase() !== 'yes') {
      section.style.display = 'none';
      return;
    }

    // Padding & background
    section.style.paddingTop    = (bs.padding_top    || 20) + 'px';
    section.style.paddingBottom = (bs.padding_bottom || 20) + 'px';
    section.style.backgroundColor = bs.bg_color || '';

    const height   = parseInt(bs.height) || 4;
    const barColor = bs.bar_color || '#000000';

    // Detect active style (first "yes" wins)
    const styleMap = {
      style_solid:  'solid',
      style_dashed: 'dashed',
      style_dotted: 'dotted',
      style_double: 'double',
      style_groove: 'groove',
      style_none:   'none'
    };

    let activeStyle = 'solid';
    for (const [key, val] of Object.entries(styleMap)) {
      if ((bs[key] || 'no').toLowerCase() === 'yes') {
        activeStyle = val;
        break;
      }
    }

    // Apply style
    if (activeStyle === 'none') {
      line.style.display = 'none';
      return;
    }

    if (activeStyle === 'solid') {
      line.style.height          = height + 'px';
      line.style.backgroundColor = barColor;
      line.style.borderTop       = 'none';
    } else {
      line.style.height          = '0';
      line.style.backgroundColor = 'transparent';
      const thickness = activeStyle === 'double' ? (height * 3) + 'px' : height + 'px';
      line.style.borderTop = `${thickness} ${activeStyle} ${barColor}`;
    }
  }

  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    let tries = 0;
    const wait = setInterval(() => {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (++tries > 60) clearInterval(wait);
    }, 100);
  }
})();

// ═══════════════════════════════════════
//  SNOW / FALLING EFFECT
// ═══════════════════════════════════════
(function initSnowEffect() {
  const settings = (products.find(p => p.type === 'settings') || {});
  const se = settings.snow_effect || {};

  if ((se.show || 'yes').toLowerCase() !== 'yes') return;

  const container = document.getElementById('snow-container');
  if (!container) return;

  // ── Quel effet est actif (premier "yes" trouvé)
  const effectMap = {
    'effect_none':    null,
    'effect_dots':    '•',
    'effect_stars':   '★',
    'effect_snow':    '❄',
    'effect_sparkle': '✶',
    'effect_twinkle': '⋆',
    'effect_hearts':  '❤',
    'effect_petals':  '🌸',
    'effect_gifts':   '🎁',
    'effect_bubbles': '○'
  };

  let activeSymbol = '•'; // fallback
  let foundEffect  = false;
  for (const [key, symbol] of Object.entries(effectMap)) {
    if ((se[key] || 'no').toLowerCase() === 'yes') {
      if (symbol === null) return; // effect_none = désactivé
      activeSymbol = symbol;
      foundEffect  = true;
      break;
    }
  }
  if (!foundEffect) return;

  // ── Paramètres
  const color       = se.color         || '#e91e8c';
  const sizeMin     = parseInt(se.size_min)      || 10;
  const sizeMax     = parseInt(se.size_max)      || 22;
  const durMin      = parseFloat(se.duration_min) || 3;
  const durMax      = parseFloat(se.duration_max) || 7;
  const maxCount    = parseInt(se.element_count)  || 35;

  // ── Crée un élément tombant
  function createEl() {
    if (container.children.length >= maxCount) return;

    const el = document.createElement('span');
    el.className   = 'snow-el';
    el.textContent = activeSymbol;

    const size     = Math.random() * (sizeMax - sizeMin) + sizeMin;
    const left     = Math.random() * 100;
    const duration = Math.random() * (durMax - durMin) + durMin;
    const delay    = Math.random() * durMax;
    const drift    = (Math.random() - 0.5) * 80;
    const opacity  = Math.random() * 0.5 + 0.5;

    el.style.cssText = `
      left: ${left}vw;
      font-size: ${size}px;
      color: ${color};
      opacity: ${opacity};
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      --snow-drift: ${drift}px;
    `;

    container.appendChild(el);

    // Supprime l'élément après son animation
    setTimeout(() => {
      el.remove();
    }, (duration + delay) * 1000 + 500);
  }

  // ── Lance la création en boucle
  function spawnLoop() {
    createEl();
    const next = Math.random() * 600 + 200;
    setTimeout(spawnLoop, next);
  }

  // ── Démarrage initial : crée plusieurs éléments d'un coup
  for (let i = 0; i < Math.floor(maxCount / 2); i++) {
    setTimeout(createEl, Math.random() * 3000);
  }

  // ── Boucle continue
  setTimeout(spawnLoop, 1000);

})();




// ═══════════════════════════════════════
//  BREADCRUMBS
// ═══════════════════════════════════════
(function initBreadcrumbs(retriesLeft) {
  retriesLeft = typeof retriesLeft === 'number' ? retriesLeft : 40;
  const settings = (products.find(p => p.type === 'settings') || {});
  const bc = settings.breadcrumbs || {};

  if ((bc.show || 'yes').toLowerCase() !== 'yes') return;

  const nav  = document.getElementById('bc-nav');
  const list = document.getElementById('bc-list');
  // #bc-nav est injecté async (fetch de breadcrumb.html) — s'il n'est pas
  // encore là, on réessaie plutôt que d'abandonner silencieusement.
  if (!nav || !list) {
    if (retriesLeft > 0) setTimeout(() => initBreadcrumbs(retriesLeft - 1), 50);
    return;
  }

  // Transparence au scroll — même traitement que le header (verre
  // dépoli), sur toutes les pages.
  (function bcScrollTransparency() {
    const THRESHOLD = 60;
    const onScroll = () => nav.classList.toggle('bc-nav--scrolled', window.scrollY > THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  const separatorMap = {
    'separator_arrow':        '">"',
    'separator_slash':        '"/"',
    'separator_dash':         '"-"',
    'separator_dot':          '"•"',
    'separator_chevron':      '"»"',
    'separator_pipe':         '"|"',
    'separator_double_arrow': '">>"'
  };

  let activeSep = '"/"';
  for (const [key, val] of Object.entries(separatorMap)) {
    if ((bc[key] || 'no').toLowerCase() === 'yes') {
      activeSep = val;
      break;
    }
  }
  document.documentElement.style.setProperty('--bc-sep', activeSep);

  function build(title) {
    const currentPath    = window.location.pathname;
    const currentTitle   = title.split('|')[0].trim() || title;
    const currentNoExt   = currentPath.replace(/\.html$/, '');

    const BC_KEY = 'bc_visited';
    const BC_MAX = 6;

    let visited = [];
    try { visited = JSON.parse(localStorage.getItem(BC_KEY) || '[]'); } catch(e) {}

    // Filtre avec ou sans .html
    visited = visited.filter(p => p.url.replace(/\.html$/, '') !== currentNoExt);

    if (currentPath !== '/' && currentPath !== '/index.html') {
      visited.unshift({ url: currentPath, title: currentTitle });
    }

    if (visited.length > BC_MAX) visited = visited.slice(0, BC_MAX);

    try { localStorage.setItem(BC_KEY, JSON.stringify(visited)); } catch(e) {}

    list.innerHTML = `
      <li class="bc-item">
        <a href="/">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 21V12h6v9"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Home
        </a>
      </li>`;

    visited.forEach(page => {
      const isActive = page.url.replace(/\.html$/, '') === currentNoExt;
      const li = document.createElement('li');
      li.className = 'bc-item' + (isActive ? ' bc-active' : '');
      li.innerHTML = `<a href="${page.url}">${page.title}</a>`;
      list.appendChild(li);
    });

    nav.style.display = 'block';

    // Mesure la hauteur RÉELLE du breadcrumb (fixed) et l'injecte dans
    // --bbw-bc-h : la valeur codée en dur en CSS était une estimation
    // légèrement trop généreuse, ce qui créait un petit espace vide
    // constant sous le breadcrumb sur toutes les pages. Mesurer la
    // vraie valeur élimine cet écart, quel que soit le navigateur/la
    // largeur d'écran.
    function syncBcHeight() {
      const h = nav.getBoundingClientRect().height;
      if (h > 0) document.documentElement.style.setProperty('--bbw-bc-h', h + 'px');
    }
    syncBcHeight();
    window.addEventListener('resize', syncBcHeight, { passive: true });
  }

  function tryBuild() {
    const title = window.__seoTitle || document.title;
    if (title && title !== 'BBW4LIFE — Beauty Has No Size | Plus Size Fashion') {
      build(title);
      return true;
    }
    return false;
  }

  if (!tryBuild()) {
    document.addEventListener('seo:ready', function(e) {
      build(e.detail.title);
    }, { once: true });

    let attempts = 0;
    const poll = setInterval(function() {
      attempts++;
      if (window.__seoTitle) {
        clearInterval(poll);
        build(window.__seoTitle);
      } else if (attempts > 50) {
        clearInterval(poll);
        build(document.title);
      }
    }, 100);
  }

})();



(function initRememberCartPopup() {
  const settings = (products.find(p => p.type === 'settings') || {});
  const rc = settings.remember_cart_popup || {};

  if ((rc.show || 'yes').toLowerCase() !== 'yes') return;

  const container  = document.getElementById('rc-popup-container');
  const popup      = document.getElementById('rc-popup');
  const closeBtn   = document.getElementById('rc-close');
  const avatarImg  = document.getElementById('rc-avatar-img');
  const avatarVid  = document.getElementById('rc-avatar-video');
  const subtitleEl = document.getElementById('rc-subtitle');
  const titleEl    = document.getElementById('rc-title');
  const descEl     = document.getElementById('rc-description');
  const btnText    = document.getElementById('rc-btn-text');
  const countText  = document.getElementById('rc-count-text');
  const fill       = document.getElementById('rc-urgency-fill');

  if (!container || !popup) return;

  // ── Position
  const positionMap = {
    'position_bottom_right': 'rc-pos-bottom-right',
    'position_bottom_left':  'rc-pos-bottom-left',
    'position_top_right':    'rc-pos-top-right',
    'position_top_left':     'rc-pos-top-left'
  };
  let activePos = 'rc-pos-bottom-right';
  for (const [key, cls] of Object.entries(positionMap)) {
    if ((rc[key] || 'no').toLowerCase() === 'yes') { activePos = cls; break; }
  }
  container.classList.add(activePos);

  // ── Avatar
  if (rc.avatar_video_url) {
    const src = document.createElement('source');
    src.src = rc.avatar_video_url;
    avatarVid.appendChild(src);
    avatarVid.load();
    avatarVid.style.display = 'block';
    avatarImg.style.display = 'none';
  } else if (rc.avatar_image) {
    avatarImg.src = rc.avatar_image;
    avatarImg.style.display = 'block';
    avatarVid.style.display = 'none';
  }

  // ── Texts
  subtitleEl.textContent = rc.subtitle_text    || "Don't forget!";
  descEl.textContent     = rc.description_text || "Complete your order before it's gone!";
  btnText.textContent    = rc.button_text      || "Complete My Purchase";

  const initialDelay = parseInt(rc.initial_delay_ms)    || 8000;
  const displayTime  = parseInt(rc.display_duration_ms) || 6000;
  const interval     = parseInt(rc.interval_ms)         || 30000;

  // ── Persistance via sessionStorage
  const SS_LAST_ADD   = 'rc_last_add_at';     // timestamp du dernier ajout/changement panier
  const SS_LAST_SHOWN = 'rc_last_shown_at';   // timestamp du dernier affichage

  const now = Date.now();

  // Aucun ajout enregistré pour cette session : on démarre le compteur du
  // délai initial dès le chargement, pour couvrir le cas d'un panier déjà
  // rempli avant ce chargement (ex: retour sur le site plus tard).
  if (!sessionStorage.getItem(SS_LAST_ADD)) {
    sessionStorage.setItem(SS_LAST_ADD, now.toString());
  }

  const lastAddAt     = () => parseInt(sessionStorage.getItem(SS_LAST_ADD));
  const setLastAddNow = () => sessionStorage.setItem(SS_LAST_ADD, Date.now().toString());
  const lastShownAt   = () => parseInt(sessionStorage.getItem(SS_LAST_SHOWN) || '0');
  const setLastShown  = () => sessionStorage.setItem(SS_LAST_SHOWN, Date.now().toString());

  // initial_delay est-il écoulé depuis le DERNIER AJOUT/CHANGEMENT panier ?
  // (redémarre à chaque interaction panier, jamais d'affichage immédiat
  // après avoir ajouté un produit).
  const initialDelayDone = () => (Date.now() - lastAddAt()) >= initialDelay;

  // interval est-il écoulé depuis le dernier affichage ?
  const intervalDone = () => (Date.now() - lastShownAt()) >= interval;

  let hideTimer    = null;
  let cycleTimer   = null;
  let initialTimer = null;
  let visible      = false;

  function getCartQty() {
    return cart.reduce((sum, i) => sum + i.quantity, 0);
  }

  function updateTitle() {
    const qty = getCartQty();
    const raw = rc.title_text || 'You have [COUNT] item(s) in your cart';
    const label = qty > 1 ? 'items' : 'item';
    titleEl.textContent = raw
      .replace('[COUNT]', qty)
      .replace('item(s)', label);

    if (countText) {
      countText.textContent = qty + (qty > 1 ? ' items waiting' : ' item waiting');
    }
    if (fill) {
      fill.style.animation = 'none';
      fill.offsetHeight;
      fill.style.animationDuration = displayTime + 'ms';
      fill.style.animation = `rc-urgency-drain ${displayTime}ms linear forwards`;
    }
  }

  function showPopup() {
    if (getCartQty() === 0) return;
    updateTitle();
    container.style.display = 'block';
    popup.classList.remove('rc-hiding');
    visible = true;
    setLastShown();

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePopup, displayTime);
  }

  function hidePopup() {
    if (!visible) return;
    popup.classList.add('rc-hiding');
    setTimeout(() => {
      container.style.display = 'none';
      popup.classList.remove('rc-hiding');
      visible = false;
    }, 380);
  }

  // ── Planifie le premier affichage en tenant compte du temps déjà écoulé
  const elapsedSinceLastAdd   = Date.now() - lastAddAt();
  const remainingInitialDelay = Math.max(0, initialDelay - elapsedSinceLastAdd);

  setTimeout(() => {
    // Premier affichage : seulement si interval aussi respecté
    if (getCartQty() > 0 && intervalDone()) showPopup();

    // Puis cycle régulier
    cycleTimer = setInterval(() => {
      if (!visible && getCartQty() > 0 && initialDelayDone() && intervalDone()) {
        showPopup();
      }
    }, interval);

  }, remainingInitialDelay);

  // ── Fermeture manuelle
  closeBtn.addEventListener('click', () => {
    if (hideTimer) clearTimeout(hideTimer);
    hidePopup();
  });

  // ── Appelé par saveCart() à chaque changement de panier — redémarre le
  //    délai initial (jamais d'affichage immédiat après un ajout) puis
  //    replanifie un affichage après ce nouveau délai.
  window.__rcRefresh = function() {
    const qty = getCartQty();
    updateTitle();
    if (qty === 0) { hidePopup(); return; }

    setLastAddNow();
    if (initialTimer) clearTimeout(initialTimer);
    initialTimer = setTimeout(() => {
      if (!visible && getCartQty() > 0 && initialDelayDone() && intervalDone()) {
        showPopup();
      }
    }, initialDelay);
  };

})();


const rcCheckoutBtn = document.getElementById('rc-checkout-btn');
if (rcCheckoutBtn) {
  rcCheckoutBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (typeof window.checkout === 'function') {
      window.checkout();
    } else {
      window.location.href = '/checkout/checkout.html';
    }
  });
}

// ====================== FILTER BAR ======================
(function initFilterBar() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (!filterBtns.length) return;

    const gridMap = {
        all:        ['product-grid-1','product-grid-2','product-grid-3','product-grid-4'],
        slimming:   ['product-grid-1'],
        apparel:    ['product-grid-2'],
        wellness:   ['product-grid-3'],
        essentials: ['product-grid-4']
    };

    const allGrids = ['product-grid-1','product-grid-2','product-grid-3','product-grid-4'];

    // ── Mobile sticky fix ───────────────────────────────────────────
    function initMobileSticky() {
    if (window.innerWidth > 768) return;

    const filterBar   = document.getElementById('filter-bar');
    const placeholder = document.getElementById('filter-bar-placeholder');
    if (!filterBar || !placeholder) return;

    const stickyHeader = document.querySelector('.sticky-header');
    const headerH      = stickyHeader ? stickyHeader.offsetHeight : 80;
    const barH         = filterBar.offsetHeight;

    placeholder.style.height = barH + 'px';

    let isFixed = false;

    function onScroll() {
        const barTop = filterBar.getBoundingClientRect().top;

        if (!isFixed && barTop <= headerH) {
            isFixed = true;
            filterBar.classList.add('is-fixed');
            placeholder.classList.add('visible');
        } else if (isFixed && (placeholder.getBoundingClientRect().top > headerH + 2)) {
            isFixed = false;
            filterBar.classList.remove('is-fixed');
            placeholder.classList.remove('visible');
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            filterBar.classList.remove('is-fixed');
            placeholder.classList.remove('visible');
            isFixed = false;
        } else {
            placeholder.style.height = filterBar.offsetHeight + 'px';
        }
    });
}

    // ── Offset pour scroll ──────────────────────────────────────────
    function getStickyOffset() {
        const stickyHeader = document.querySelector('.sticky-header');
        const filterBar    = document.getElementById('filter-bar');
        const stickyH      = stickyHeader ? stickyHeader.offsetHeight : 80;
        const filterH      = filterBar    ? filterBar.offsetHeight    : 44;
        return stickyH + filterH + 12;
    }

    // ── Affichage des grilles ───────────────────────────────────────
    function applyFilter(filter) {
        const visibleGrids = gridMap[filter] || allGrids;

        allGrids.forEach(gridId => {
            const section = document.getElementById(gridId);
            if (!section) return;

            if (visibleGrids.includes(gridId)) {
                section.style.display   = '';
                section.style.opacity   = '0';
                section.style.transform = 'translateY(12px)';
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        section.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        section.style.opacity    = '1';
                        section.style.transform  = 'translateY(0)';
                    });
                });
            } else {
                section.style.transition = 'none';
                section.style.display    = 'none';
                section.style.opacity    = '0';
            }
        });

        if (filter !== 'all') {
            const targetId = gridMap[filter][0];
            const target   = document.getElementById(targetId);
            if (target) {
                setTimeout(() => {
                    const offset = getStickyOffset();
                    const top    = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({ top, behavior: 'smooth' });
                }, 20);
            }
        } else {
            setTimeout(() => {
                const stickyHeader = document.querySelector('.sticky-header');
                const stickyH      = stickyHeader ? stickyHeader.offsetHeight : 80;
                const filterBar    = document.getElementById('filter-bar');
                if (filterBar) {
                    const top = filterBar.getBoundingClientRect().top + window.pageYOffset - stickyH - 8;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            }, 20);
        }
    }

    // ── Events ──────────────────────────────────────────────────────
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilter(btn.dataset.filter);
        });
    });

    // applyFilter('all');
     initMobileSticky();

})();
// ====================== END FILTER BAR ======================


// ====================== MY PERSONALIZED PRODUCT POPUP ======================
(function initMyProductPopup() {
    const overlay      = document.getElementById('mppOverlay');
    const openBtn      = document.getElementById('openMyProductPopup');
    const closeBtn     = document.getElementById('mppClose');
    const form         = document.getElementById('mppForm');
    const successBox   = document.getElementById('mppSuccess');
    const closeSucc    = document.getElementById('mppCloseSuccess');
    const imgInput1    = document.getElementById('imgInput1');
    const imgInput2    = document.getElementById('imgInput2');
    const uploadBox1   = document.getElementById('uploadBox1');
    const uploadBox2   = document.getElementById('uploadBox2');
    const uploadInner1 = document.getElementById('uploadInner1');
    const uploadInner2 = document.getElementById('uploadInner2');

    if (!overlay || !openBtn) return;

    function openPopup() {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closePopup() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    openBtn.addEventListener('click', openPopup);
    closeBtn.addEventListener('click', closePopup);
    closeSucc && closeSucc.addEventListener('click', closePopup);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closePopup();
    });

    // ── Compression identique au story-form de script.js ──
    function compressImage(file, maxPx, quality) {
        return new Promise(function(resolve) {
            if (!file) { resolve(''); return; }

            const url = URL.createObjectURL(file);
            const img = new Image();

            img.onload = function() {
                let w = img.width;
                let h = img.height;

                if (w > h) {
                    if (w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx; }
                } else {
                    if (h > maxPx) { w = Math.round(w * maxPx / h); h = maxPx; }
                }

                const canvas = document.createElement('canvas');
                canvas.width  = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                const compressed = canvas.toDataURL('image/jpeg', quality);
                URL.revokeObjectURL(url);
                resolve(compressed);
            };

            img.onerror = function() {
                URL.revokeObjectURL(url);
                resolve('');
            };

            img.src = url;
        });
    }

    function handleImagePreview(input, box) {
        input.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                let preview = box.querySelector('.mpp-upload-preview');
                if (!preview) {
                    preview = document.createElement('img');
                    preview.className = 'mpp-upload-preview';
                    box.appendChild(preview);
                }
                preview.src = e.target.result;
                box.classList.add('has-image');
            };
            reader.readAsDataURL(file);
        });
    }

    handleImagePreview(imgInput1, uploadBox1);
    handleImagePreview(imgInput2, uploadBox2);

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const sendBtn = form.querySelector('.mpp-send-btn');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        // ── Compression MAX 200px, qualité 0.6 — identique au story-form ──
        const image1Base64 = await compressImage(
            imgInput1.files[0] || null, 200, 0.6
        );
        const image2Base64 = await compressImage(
            imgInput2.files[0] || null, 200, 0.6
        );

        const payload = {
          firstname:     form.querySelector('[name="firstname"]').value,
          lastname:      form.querySelector('[name="lastname"]').value,
          email:         form.querySelector('[name="email"]').value,
          phone:         form.querySelector('[name="phone"]').value,
          size:          (form.querySelector('[name="size"]') || {}).value || '',
          color:         (form.querySelector('[name="color"]') || {}).value || '',
          product_title: form.querySelector('[name="product_title"]').value,
          product_desc:  form.querySelector('[name="product_desc"]').value,
          image1_base64: image1Base64,
          image2_base64: image2Base64
      };

        try {
            const res  = await fetch('/.netlify/functions/save-personalized-product', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Unknown error');

            form.style.display       = 'none';
            successBox.style.display = 'block';

        } catch (err) {
            console.error(err);
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send My Idea';
            alert('Something went wrong. Please try again.');
        }
    });
})();
// ====================== END MY PERSONALIZED PRODUCT POPUP ======================


(function initStoryCircles() {
  const section = document.getElementById('story-circles');
  const track   = document.getElementById('storyCirclesTrack');
  if (!section || !track) return;

  const settings = products.find(p => p.type === 'settings') || {};
  const sc       = settings.story_circles || {};
  const ids      = sc.product_ids || [];

  // ── Animation
  const animations = sc.animations || { marquee: 'yes' };
  const animType = Object.keys(animations).find(
    k => (animations[k] || '').toLowerCase() === 'yes'
  ) || 'marquee';

  if (!ids.length) { section.style.display = 'none'; return; }
  section.classList.add('anim--' + animType);

  // ── Border style
  const borderStyles = sc.border_style || {};
  const borderType = Object.keys(borderStyles).find(
    k => (borderStyles[k] || '').toLowerCase() === 'yes'
  ) || 'conic_noir';
  section.classList.add('border--' + borderType);

  // ── CSS vars
  const borderSize  = sc.border_size  || 3;
  const borderColor = sc.border_color || '#c0385e';
  section.style.setProperty('--sc-border-size',  borderSize + 'px');
  section.style.setProperty('--sc-border-color', borderColor);

  // ── Résout un ID collection ("collection:curvy-bags") en {title, url, image} ──
  function resolveCollection(colId) {
    const jrgq = (settings.jrgq_collections && settings.jrgq_collections.collections) || [];
    let col = jrgq.find(c => c.id === colId);
    if (!col) col = settings[colId] || null;
    return col;
  }

  // ── Fix alignement : injecter le nombre de cercles comme CSS var ──
  const realItems = ids
    .filter(id => !id.startsWith('--'))
    .map(id => {
      if (id.startsWith('collection:')) {
        const col = resolveCollection(id.slice('collection:'.length));
        if (!col) return null;
        return {
          kind:  'collection',
          url:   col.url,
          title: col.title || col.id,
          image: col.image
        };
      }
      const prod = products.find(p => p.id === id);
      if (!prod) return null;
      return { kind: 'product', url: getProductUrl(prod.id), title: prod.title, image: prod.image };
    })
    .filter(Boolean);

  if (!realItems.length) { section.style.display = 'none'; return; }

  section.style.setProperty('--sc-count', realItems.length);

  function makeItem(item) {
    const label = item.title.split('—')[0].split('-')[0].trim();
    const img   = upgradeShopifyImageUrl(item.image, 300);
    const a = document.createElement('a');
    a.href      = item.url;
    a.className = 'story-circle-item' + (item.kind === 'collection' ? ' story-circle-item--collection' : '');
    a.setAttribute('aria-label', item.title);
    a.innerHTML = `
      <div class="story-circle-ring">
        <img class="story-circle-img"
             src="${img}"
             alt="${item.title}"
             loading="lazy"
             onerror="this.src='${item.image}'">
      </div>
      <span class="story-circle-label">${label}</span>`;
    return a;
  }

  // Vide le track avant de le remplir (retire au passage le skeleton
  // éventuellement posé par src/components/skeleton.js) — sans ça, le
  // vrai contenu s'ajoutait après les placeholders au lieu de les
  // remplacer.
  track.innerHTML = '';

  if (animType === 'marquee') {
    const screenW = window.innerWidth;
    const itemW   = 90 + 18;
    const totalW  = realItems.length * itemW;
    const repeats = Math.ceil((screenW * 3) / totalW) + 1;

    const group1 = document.createElement('div');
    const group2 = document.createElement('div');
    group1.className = 'story-circles-marquee-inner';
    group2.className = 'story-circles-marquee-inner';

    for (let i = 0; i < repeats; i++) {
      realItems.forEach(item => {
        group1.appendChild(makeItem(item));
        group2.appendChild(makeItem(item));
      });
    }

    track.appendChild(group1);
    track.appendChild(group2);

  } else {
    realItems.forEach(item => track.appendChild(makeItem(item)));
  }
})();


// ── STORY ROWS (Femme / Homme) — même rendu visuel que #story-circles,
// mais 2 sections indépendantes au-dessus de BBW Features, alimentées
// chacune par leur propre clé settings (story_row_women / story_row_men).
(function initStoryRows() {
  const settings = products.find(p => p.type === 'settings') || {};

  function resolveCollection(colId) {
    const jrgq = (settings.jrgq_collections && settings.jrgq_collections.collections) || [];
    let col = jrgq.find(c => c.id === colId);
    if (!col) col = settings[colId] || null;
    return col;
  }

  function makeItem(item) {
    // Le CSS (.story-circle-label : max-width + overflow:hidden +
    // text-overflow:ellipsis) gère déjà la coupe visuelle selon l'espace
    // réel disponible — une troncature JS à longueur fixe en plus ne
    // faisait que couper le titre bien plus tôt que nécessaire.
    const label = item.title;
    const img   = upgradeShopifyImageUrl(item.image, 300);
    const a = document.createElement('a');
    a.href      = item.url;
    a.className = 'story-circle-item' + (item.kind === 'collection' ? ' story-circle-item--collection' : '');
    a.setAttribute('aria-label', item.title);
    a.innerHTML = `
      <div class="story-circle-ring">
        <img class="story-circle-img"
             src="${img}"
             alt="${item.title}"
             loading="lazy"
             onerror="this.src='${item.image}'">
      </div>
      <span class="story-circle-label">${label}</span>`;
    return a;
  }

  function buildRow(sectionId, trackId, settingsKey) {
    const section = document.getElementById(sectionId);
    const track   = document.getElementById(trackId);
    if (!section || !track) return;

    const rowSettings = settings[settingsKey] || {};
    const ids = rowSettings.product_ids || [];
    if (!ids.length) { section.style.display = 'none'; return; }

    section.classList.add('border--solid');
    section.style.setProperty('--sc-border-size', '2px');
    section.style.setProperty('--sc-border-color', '#B8925A');

    const realItems = ids
      .filter(id => !id.startsWith('--'))
      .map(id => {
        if (id.startsWith('collection:')) {
          const col = resolveCollection(id.slice('collection:'.length));
          if (!col) return null;
          return { kind: 'collection', url: col.url, title: col.title || col.id, image: col.image };
        }
        const prod = products.find(p => p.id === id);
        if (!prod) return null;
        return { kind: 'product', url: getProductUrl(prod.id), title: prod.title, image: prod.image };
      })
      .filter(Boolean);

    if (!realItems.length) { section.style.display = 'none'; return; }

    section.style.setProperty('--sc-count', realItems.length);

    track.innerHTML = ''; // retire un éventuel skeleton avant de remplir
    realItems.forEach(item => track.appendChild(makeItem(item)));
  }

  buildRow('story-row-women', 'storyRowWomenTrack', 'story_row_women');
  buildRow('story-row-men',   'storyRowMenTrack',   'story_row_men');
  // Page search-results.html uniquement (section absente ailleurs) —
  // réutilise intégralement le même buildRow générique, aucune logique
  // dupliquée.
  buildRow('sr-story-row', 'srStoryRowTrack', 'search_story_row');
})();


// ── SEARCH RESULTS — petites cards de collections (une seule ligne,
// scroll horizontal), sous le story row de search-results.html.
// Réutilise settings.jrgq_collections.collections telles quelles —
// même source que la mosaïque de collections de la home.
(function initSearchCollectionsRow() {
  const track = document.getElementById('srCollectionsTrack');
  if (!track) return;

  const settings = products.find(p => p.type === 'settings') || {};
  const cols = (settings.jrgq_collections && settings.jrgq_collections.collections) || [];
  if (!cols.length) { document.getElementById('sr-collections-row').style.display = 'none'; return; }

  track.innerHTML = '';
  cols.forEach(col => {
    const a = document.createElement('a');
    a.href = col.url;
    a.className = 'sr-collection-card';
    a.setAttribute('aria-label', col.title || col.id);
    a.innerHTML = `
      <img src="${upgradeShopifyImageUrl(col.image, 400)}" alt="${col.title || ''}" loading="lazy">
      <div class="sr-collection-card__overlay">
        <span class="sr-collection-card__title">${col.title || ''}</span>
      </div>`;
    track.appendChild(a);
  });
})();


    //  STICKY ATC — initialise après le fetch products.data.json
    (function initStickyATC() {

        // ── Cibler uniquement une page produit ──
        const productSection = document.querySelector('.product-section');
        if (!productSection) return;

        const pid     = productSection.dataset.productId;
        const product = products.find(p => p.id === pid);
        if (!product) return;

        // ── Éléments DOM ──
        const bar         = document.getElementById('sticky-atc');
        const satcImg     = document.getElementById('satc-img');
        const satcTitle   = document.getElementById('satc-title');
        const satcPrice   = document.getElementById('satc-price');
        const satcSwatches= document.getElementById('satc-swatches');
        const satcColorName = document.getElementById('satc-color-name');
        const satcColorField= document.getElementById('satc-color-field');
        const satcSizeField = document.getElementById('satc-size-field');
        const satcSizeEl  = document.getElementById('satc-size');
        const satcMinus   = document.getElementById('satc-minus');
        const satcPlus    = document.getElementById('satc-plus');
        const satcQtyVal  = document.getElementById('satc-qty-val');
        const satcAddBtn  = document.getElementById('satc-add-btn');
        const satcBuyBtn  = document.getElementById('satc-buy-btn');

        if (!bar || !satcImg) return;

        // ── État interne ──
        let satcQty          = 1;
        let satcSelectedColor = null;
        let satcSelectedSize  = null;

        const hasColors = product.colors && product.colors.length > 0;
        const hasSizes  = product.sizes  && product.sizes.length  > 0;

        // ── Libellé Buy Now (identique au bouton buy-now principal) ──
        if (satcBuyBtn) {
            const buyNowLabel = (settings.button_labels || {}).buy_now || 'Buy Now';
            const satcBuyBtnSpan = satcBuyBtn.querySelector('span');
            if (satcBuyBtnSpan) satcBuyBtnSpan.textContent = buyNowLabel;
        }

        // ── Remplir le titre ──
        satcTitle.textContent = product.title;

        // ── Image par défaut ──
        const defaultImg = (hasColors && product.colors[0].image) ? product.colors[0].image : product.image;
        satcImg.src = upgradeShopifyImageUrl(defaultImg);

        // ── Fonction prix ──
        function getSatcPrice(color, size) {
            if (!color || !size) return product.price;
            const v = product.variants.find(vv => vv.color === color && vv.size === size);
            return v ? v.price : product.price;
        }

        function updateSatcPrice() {
            const p = getSatcPrice(satcSelectedColor, satcSelectedSize);
            satcPrice.textContent = '$' + p.toFixed(2);
        }

        // ── Init prix ──
        satcPrice.textContent = '$' + product.price.toFixed(2);

        // ── Couleurs ──
        if (hasColors) {
            product.colors.forEach((col, i) => {
                const sw = document.createElement('div');
                sw.className = 'satc-swatch' + (i === 0 ? ' active' : '');
                sw.style.backgroundColor = col.hex;
                sw.title = col.name;
                sw.addEventListener('click', () => {
                    satcSwatches.querySelectorAll('.satc-swatch').forEach(s => s.classList.remove('active'));
                    sw.classList.add('active');
                    satcSelectedColor = col.name;
                    satcColorName.textContent = col.name;
                    if (col.image) satcImg.src = upgradeShopifyImageUrl(col.image);
                    updateSatcPrice();
                });
                satcSwatches.appendChild(sw);
            });
            // Sélectionner la 1ère couleur par défaut
            satcSelectedColor = product.colors[0].name;
            satcColorName.textContent = product.colors[0].name;
            if (product.colors.length > 3) {
                satcSwatches.classList.add('overflow-active');
                if (satcColorField) satcColorField.classList.add('satc-color-field--overflow');
            }
        } else {
            satcColorField.style.display = 'none';
        }

        // ── Tailles ──
        if (hasSizes) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = "";
        defaultOpt.textContent = "Select Size";
        defaultOpt.selected = true;
        defaultOpt.disabled = true;
        satcSizeEl.appendChild(defaultOpt);  // ✅ bonne variable
        product.sizes.forEach(sz => {
            const opt = document.createElement('option');
            opt.value = sz;
            opt.textContent = sz;
            satcSizeEl.appendChild(opt);
        });
        satcSizeEl.addEventListener('change', () => {
            satcSelectedSize = satcSizeEl.value || null;
            updateSatcPrice();
        });
    } else {
        satcSizeField.style.display = 'none';
    }

        // ── Quantité ──
        satcMinus.addEventListener('click', () => {
            if (satcQty > 1) { satcQty--; satcQtyVal.textContent = satcQty; }
        });
        satcPlus.addEventListener('click', () => {
            satcQty++;
            satcQtyVal.textContent = satcQty;
        });

      

        // ── Ajoute l'item courant du sticky bar au panier ──
        // Retourne false si la validation échoue (couleur/taille manquante).
        function addSatcItemToCart() {
            if (hasColors && !satcSelectedColor) {
                showErrorPopup('Please select a color.');
                return false;
            }
            if (hasSizes && !satcSelectedSize) {
                showErrorPopup('Please select a size.');
                return false;
            }

            // Image du variant
            let itemImage = upgradeShopifyImageUrl(product.image);
            if (satcSelectedColor) {
                const colorObj = product.colors.find(c => c.name === satcSelectedColor);
                if (colorObj && colorObj.image) itemImage = upgradeShopifyImageUrl(colorObj.image);
            }

            // Variant ID
            let cjVariantId = null;
            const variant = product.variants.find(v => {
                const colorMatch = !satcSelectedColor || v.color === satcSelectedColor;
                const sizeMatch  = !satcSelectedSize  || v.size  === satcSelectedSize;
                return colorMatch && sizeMatch;
            });
            if (variant) cjVariantId = variant.vid;
            else if (product.variants && product.variants.length > 0) cjVariantId = product.variants[0].vid;

            const price   = getSatcPrice(satcSelectedColor, satcSelectedSize);
            const ratio   = product.compare_price / product.price;
            const compare = price * ratio;

            // Ajouter au cart (utilise la variable `cart` globale de script.js)
            let cartItem = cart.find(i =>
                i.id    === product.id &&
                i.color === satcSelectedColor &&
                i.size  === satcSelectedSize
            );
            if (cartItem) {
                cartItem.quantity += satcQty;
            } else {
                cart.push({
                    id:            product.id,
                    title:         product.title,
                    price:         price,
                    compare_price: compare,
                    image:         itemImage,
                    size:          satcSelectedSize,
                    color:         satcSelectedColor,
                    quantity:      satcQty,
                    cj_product_id: product.cj_id,
                    cj_variant_id: cjVariantId
                });
            }

            saveCart();
            updateCartQuantityInSheet();
            updateBadges();
            renderCart();
            return true;
        }

        // ── Add to Cart ──
        satcAddBtn.addEventListener('click', () => {
            if (document.querySelector('.product-section.bbw-featured-request-mode')) return;
            if (!addSatcItemToCart()) return;

            openCartDrawer();

            // Feedback visuel
            satcAddBtn.classList.add('added');
            satcAddBtn.querySelector('span').textContent = 'Added!';
            setTimeout(() => {
                satcAddBtn.classList.remove('added');
                satcAddBtn.querySelector('span').textContent = 'Add to Cart';
            }, 2000);
        });

        // ── Buy Now ──
        if (satcBuyBtn) {
            satcBuyBtn.addEventListener('click', () => {
                if (document.querySelector('.product-section.bbw-featured-request-mode')) return;
                if (!addSatcItemToCart()) return;
                checkout();
            });
        }

        // ── Trigger : afficher la barre quand on approche du footer ──
        const footer = document.querySelector('footer.footer, footer.bbw-footer, .bbw-footer');
        const addToCartMainBtn = document.querySelector('.product-content .add-to-cart');

        function checkStickyVisibility() {
        if (!footer) return;

        const footerTop    = footer.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        const isMobileStickyAtc = window.innerWidth <= 768;
          const stickyAtcSettings = ((window.__allProducts || []).find(p => p.type === 'settings') || {});
          // Pages BBW Features (produits 69-75, 98-110) : contenu plus court
          // que les autres fiches produit, le footer arrive donc plus vite
          // en scroll — un threshold mobile dédié, plus petit, évite que la
          // barre sticky apparaisse trop tôt sur ces pages spécifiquement.
          const pageProductMatch = (window.location.pathname || '').match(/product(\d+)\.html/);
          const pageProductNum = pageProductMatch ? parseInt(pageProductMatch[1], 10) : null;
          const isBbwFeaturesPage = pageProductNum !== null &&
            ((pageProductNum >= 69 && pageProductNum <= 75) || (pageProductNum >= 98 && pageProductNum <= 110));
          const mobileThreshold = parseFloat(
            (isBbwFeaturesPage
              ? stickyAtcSettings.sticky_atc_mobile_threshold_bbw_features
              : stickyAtcSettings.sticky_atc_mobile_threshold) || 6.0
          );
          const desktopThreshold = parseFloat(
            stickyAtcSettings.sticky_atc_desktop_threshold || 4.5
          );
          const nearFooter = footerTop < windowHeight * (isMobileStickyAtc ? mobileThreshold : desktopThreshold);

        // Cacher si le bouton principal ATC est visible à l'écran
        let mainBtnVisible = false;
        if (addToCartMainBtn && addToCartMainBtn.offsetParent !== null) {
          const rect = addToCartMainBtn.getBoundingClientRect();
          mainBtnVisible = rect.top >= 0 && rect.bottom <= windowHeight;
      }

        if (nearFooter && !mainBtnVisible) {
            bar.classList.add('visible');
            bar.setAttribute('aria-hidden', 'false');
        } else {
            bar.classList.remove('visible');
            bar.setAttribute('aria-hidden', 'true');
        }
    }

        window.addEventListener('scroll', checkStickyVisibility, { passive: true });
        checkStickyVisibility();

    })();




    // ================================================================
    //   RECENTLY VIEWED
    // ================================================================
    (function initRecentlyViewed() {
      const RV_KEY      = 'cf_recently_viewed';
      const RV_MAX      = 12;
      const section     = document.getElementById('rv-section');
      const track       = document.getElementById('rv-track');
      const clearBtn    = document.getElementById('rv-clear-btn');
      if (!section || !track) return;

      // ── Helpers storage ──
      function getRV() {
        try { return JSON.parse(localStorage.getItem(RV_KEY) || '[]'); }
        catch(e) { return []; }
      }
      function saveRV(arr) {
        try { localStorage.setItem(RV_KEY, JSON.stringify(arr)); }
        catch(e) {}
      }

      // ── Capture current product page ──
      const productSection = document.querySelector('.product-section');
      if (productSection) {
        const pid  = productSection.dataset.productId;
        const prod = products.find(p => p.id === pid);
        if (prod) {
          let rv = getRV();
          // Remove if already present (move to front)
          rv = rv.filter(function(id) { return id !== pid; });
          rv.unshift(pid);
          if (rv.length > RV_MAX) rv = rv.slice(0, RV_MAX);
          saveRV(rv);
        }
      }

      // ── Build stars HTML ──
      function buildStars(rating) {
        if (!rating) return '';
        const full  = Math.floor(rating);
        const half  = rating - full >= 0.4 ? 1 : 0;
        const empty = 5 - full - half;
        let html = '<div class="rv-card__stars-icons">';
        for (var i = 0; i < full;  i++) html += '<span class="rv-card__star">★</span>';
        if (half)                        html += '<span class="rv-card__star">½</span>';
        for (var j = 0; j < empty; j++) html += '<span class="rv-card__star empty">★</span>';
        html += '</div>';
        html += '<span class="rv-card__rating-num">' + rating.toFixed(1) + '</span>';
        return html;
      }

      // ── Render ──
      function render() {
  track.innerHTML = '';
  const rv       = getRV();
  const pid      = (document.querySelector('.product-section') || {}).dataset
                   ? (document.querySelector('.product-section').dataset.productId || '')
                   : '';
  const filtered = rv.filter(function(id) { return id !== pid; });

  if (!filtered.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';

  filtered.forEach(function(id, idx) {
    const prod = products.find(function(p) { return p.id === id; });
    if (!prod) return;

    const url      = typeof window.getProductUrl === 'function'
                     ? window.getProductUrl(id)
                     : '/collections/bbw4life-all-product.html';
    const img      = upgradeShopifyImageUrl(prod.image, 400);
    const imgHover = prod.image_hover
                     ? upgradeShopifyImageUrl(prod.image_hover, 400)
                     : img;
    const discount = prod.compare_price > prod.price
                     ? Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100)
                     : 0;
    const badge    = (prod.badge && prod.badge.text) ? prod.badge.text : '';

    /* Stars HTML */
    function buildStars(rating) {
      if (!rating) return '';
      const full  = Math.floor(rating);
      const half  = rating - full >= 0.4 ? 1 : 0;
      const empty = 5 - full - half;
      let html = '<div class="rv-card__stars-icons">';
      for (var i = 0; i < full;  i++) html += '<span class="rv-card__star">★</span>';
      if (half)                        html += '<span class="rv-card__star">★</span>';
      for (var j = 0; j < empty; j++) html += '<span class="rv-card__star empty">★</span>';
      html += '</div>';
      html += '<span class="rv-card__rating-num">' + parseFloat(rating).toFixed(1) + '</span>';
      return html;
    }

    const card = document.createElement('a');
    card.className = 'rv-card';
    card.href      = url;

    card.innerHTML =
      '<div class="rv-card__img-wrap">' +
        '<img class="rv-card__img" src="' + img + '" alt="' + prod.title + '" loading="lazy">' +
        (imgHover !== img
          ? '<img class="rv-card__img-hover" src="' + imgHover + '" alt="" loading="lazy">'
          : '') +
        (badge
          ? '<span class="rv-card__badge">' + badge + '</span>'
          : '') +
        (discount > 0
          ? '<span class="rv-card__discount">-' + discount + '%</span>'
          : '') +
      '</div>' +
      '<div class="rv-card__body">' +
        '<div class="rv-card__title">' + prod.title + '</div>' +
        (prod.rating
          ? '<div class="rv-card__stars">' + buildStars(prod.rating) + '</div>'
          : '') +
        '<div class="rv-card__prices">' +
          '<span class="rv-card__price">$' + parseFloat(prod.price).toFixed(2) + '</span>' +
          (prod.compare_price > prod.price
            ? '<span class="rv-card__compare">$' + parseFloat(prod.compare_price).toFixed(2) + '</span>'
              + '<span class="rv-card__discount-inline">-' + discount + '%</span>'
            : '') +
        '</div>' +
        '<a class="rv-card__btn" href="' + url + '" onclick="event.stopPropagation()">' +
          'View Product' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
            '<path d="M5 12H19M13 6L19 12L13 18"/>' +
          '</svg>' +
        '</a>' +
      '</div>';

    track.appendChild(card);
  });
}

      // ── Clear button ──
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          // Keep current product in history (just clear the rest)
          const pid = (document.querySelector('.product-section') || {}).dataset
                      ? (document.querySelector('.product-section').dataset.productId || '')
                      : '';
          saveRV(pid ? [pid] : []);
          render();
        });
      }

      render();
    })();
    // ================================================================
    //   END RECENTLY VIEWED
    // ================================================================

    })
    .catch(error => console.error('Erreur de chargement des produits:', error));

  // ====================== SCROLL REVEAL ======================
  document.querySelectorAll('section').forEach(sec => { if (!sec.hasAttribute('data-scroll-reveal')) sec.setAttribute('data-scroll-reveal', ''); });




  // ── INJECT ACCOUNT ICON IN HEADER ──
(function injectAccountIcon() {
  const accountIcon = document.createElement('div');
  accountIcon.className = 'account-icon-wrapper';
  accountIcon.id = 'header-account-trigger';
  accountIcon.innerHTML = `<i class="fi fi-rr-user"></i>`;

  accountIcon.addEventListener('click', () => {
    const trigger = document.getElementById('paulTrigger');
    if (trigger) trigger.click();
  });

  const headerContainer = document.querySelector('.header-container');
  if (!headerContainer) return;

  // Desktop : insérer APRÈS .search-icon
  const searchIcon = headerContainer.querySelector('.search-icon');
  if (searchIcon) {
    searchIcon.insertAdjacentElement('afterend', accountIcon);
  }
})();


  // ====================== HAMBURGER ======================
  const hamburger = document.querySelector('.hamburger-menu');
  const nav = document.querySelector('.main-nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('active');
      const isOpen = nav.classList.contains('active');
      const icon = hamburger.querySelector('i');
      if (icon) {
        icon.classList.toggle('fi-rr-menu-burger', !isOpen);
        icon.classList.toggle('fi-rr-cross', isOpen);
      }
    });

    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !nav.contains(e.target)) {
        nav.classList.remove('active');
        const icon = hamburger.querySelector('i');
        if (icon) {
          icon.classList.add('fi-rr-menu-burger');
          icon.classList.remove('fi-rr-cross');
        }
      }
    });
  }

  // ====================== SEARCH ======================
  const searchIcon = document.querySelector('.search-icon');
  const searchBar = document.querySelector('.search-bar');
  const searchInput = searchBar?.querySelector('input');
  const submitSearch = searchBar?.querySelector('.submit-search');
  const headerContainer = document.querySelector('.header-container');
  if (searchIcon && searchBar) {
    searchIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      searchBar.classList.toggle('active');
      headerContainer.classList.toggle('search-active');
      if (searchBar.classList.contains('active')) searchInput.focus(); else searchInput.blur();
    });
    document.addEventListener('click', (e) => {
      if (!searchBar.contains(e.target) && !searchIcon.contains(e.target)) {
        searchBar.classList.remove('active'); headerContainer.classList.remove('search-active');
      }
    });
    submitSearch.addEventListener('click', () => { const query = searchInput.value; if (query) showErrorPopup(`Searching for: ${query}`); });
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { const query = searchInput.value; if (query) showErrorPopup(`Searching for: ${query}`); } });
  }

  // ====================== SMOOTH SCROLL ======================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ====================== PARALLAX ======================
  const parallaxes = document.querySelectorAll('.parallax-background');
  window.addEventListener('scroll', () => {
    const scrollPosition = window.pageYOffset;
    parallaxes.forEach(parallax => { parallax.style.transform = `translateY(${scrollPosition * 0.5}px)`; });
  });

  // ====================== SCROLL REVEAL ======================
  const revealElements = document.querySelectorAll('[data-scroll-reveal]');
  const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    revealElements.forEach(el => { if (el.getBoundingClientRect().top < windowHeight - 100) el.classList.add('revealed'); });
  };
  window.addEventListener('scroll', revealOnScroll);
  revealOnScroll();





  // ====================== COUNTERS ======================
document.querySelectorAll('.counter').forEach(counter => {
  const updateCount = () => {
    const target = +counter.getAttribute('data-target'), count = +counter.innerText, increment = target / 200;
    if (count < target) { counter.innerText = Math.ceil(count + increment); setTimeout(updateCount, 10); }
    else counter.innerText = target;
  };
  new IntersectionObserver(entries => { if (entries[0].isIntersecting) updateCount(); }).observe(counter);
});

// ====================== INJECT SITE STATS ======================
(function injectSiteStats() {
  // Attendre que products soit chargé
  function run() {
    const settings = (window.__allProducts || []).find(p => p.type === 'settings') || {};
    const s = settings.site_stats || {};
    if (!Object.keys(s).length) return;

    // Counters → data-target
    document.querySelectorAll('[data-stat-counter]').forEach(el => {
      const key = el.dataset.statKey;
      if (key && s[key] !== undefined) {
        el.setAttribute('data-target', s[key]);
        el.textContent = '0';
      }
    });

    // Bars
    document.querySelectorAll('[data-stat-bar]').forEach(el => {
      const key = el.dataset.statKey;
      const max = parseFloat(el.dataset.statMax) || null;
      if (key && s[key] !== undefined && max !== null) {
        const pct = Math.min((s[key] / max) * 100, 100);
        el.setAttribute('data-fill', pct.toFixed(1));
      }
      el.style.width = '0%';

      const trackEl = el.closest('.stat-bar-track') || el.parentElement || el;
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          const fill = parseFloat(el.getAttribute('data-fill')) || 0;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.width = fill + '%';
          }));
          obs.disconnect();
        }
      }, { threshold: 0.1 });
      obs.observe(trackEl);
    });

    // Ring
    const CIRCUMFERENCE = 2 * Math.PI * 50; // 314.159
    document.querySelectorAll('[data-stat-ring]').forEach(el => {
      const key = el.dataset.statKey;
      const max = parseFloat(el.dataset.statMax) || null;
      if (key && s[key] !== undefined && max !== null) {
        const pct = Math.min((s[key] / max) * 100, 100);
        el.setAttribute('data-fill', pct.toFixed(1));
      }
      el.style.strokeDasharray  = CIRCUMFERENCE.toFixed(2);
      el.style.strokeDashoffset = CIRCUMFERENCE.toFixed(2);

      const svgEl = el.closest('svg') || el.closest('.highlight-ring') || el;
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          const fill   = parseFloat(el.getAttribute('data-fill')) || 0;
          const offset = CIRCUMFERENCE - (fill / 100) * CIRCUMFERENCE;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.strokeDashoffset = offset.toFixed(2);
          }));
          obs.disconnect();
        }
      }, { threshold: 0.1 });
      obs.observe(svgEl);
    });
  }

  // Si products déjà chargé, run immédiatement ; sinon attendre
  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    let tries = 0;
    const wait = setInterval(() => {
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (++tries > 50) clearInterval(wait);
    }, 100);
  }
})();
// ====================== END INJECT SITE STATS ======================


  // ====================== TESTIMONIAL CAROUSEL ======================
const carousel = document.querySelector('.testimonial-carousel');
if (carousel) {
    let carouselSlides = Array.from(carousel.children);
    const gap = parseInt(getComputedStyle(carousel).gap) || 0;
    let slideWidth = carouselSlides[0].offsetWidth + gap;
    let carouselIndex = 0;

    // Clone 3 premiers à la fin
    [0, 1, 2].forEach(i => {
        carousel.appendChild(carouselSlides[i].cloneNode(true));
    });

    // Clone 3 derniers au début (ordre inversé)
    [carouselSlides.length - 1, carouselSlides.length - 2, carouselSlides.length - 3].forEach(i => {
        carousel.prepend(carouselSlides[i].cloneNode(true));
    });

    // Mettre à jour la liste après les clones
    carouselSlides = Array.from(carousel.children);

    // Départ à la position du 4ème slide (après les 3 clones du début)
    carousel.style.transform = `translateX(-${slideWidth * 3}px)`;

    const moveCarousel = () => {
        carouselIndex++;
        carousel.style.transition = 'transform 0.5s ease';
        carousel.style.transform = `translateX(-${(carouselIndex + 3) * slideWidth}px)`;
    };

    carousel.addEventListener('transitionend', () => {
        if (carouselIndex >= carouselSlides.length - 6) {
            carouselIndex = 0;
            carousel.style.transition = 'none';
            carousel.style.transform = `translateX(-${slideWidth * 3}px)`;
        }
    });

    window.addEventListener('resize', () => {
        slideWidth = carousel.querySelector('.testimonial').offsetWidth + gap;
        carousel.style.transition = 'none';
        carousel.style.transform = `translateX(-${(carouselIndex + 3) * slideWidth}px)`;
    });

    setInterval(moveCarousel, 3000);
}

      // ====================== AUDIO PLAYER ======================
    const audioPlayer = document.getElementById('audio-player');
    const audio = document.getElementById('audio-element');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playPauseBtn = document.getElementById('play-pause-btn');

    if (playPauseBtn && audio) {
      playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audio.paused) {
          audio.play();
          playIcon.style.display = 'none';
          pauseIcon.style.display = 'block';
        } else {
          audio.pause();
          playIcon.style.display = 'block';
          pauseIcon.style.display = 'none';
        }
      });
    }

    if (audioPlayer) {
      // ── Drag FIXE (position:fixed, ne scroll pas avec la page) ──
      let isDraggingAudio = false;
      let startX, startY, origLeft, origTop, audioHasMoved;

      // Forcer position fixed dès le départ
      function initAudioFixed() {
        const rect = audioPlayer.getBoundingClientRect();
        audioPlayer.style.position = 'fixed';
        audioPlayer.style.left = rect.left + 'px';
        audioPlayer.style.top  = rect.top  + 'px';
        audioPlayer.style.bottom = 'auto';
        audioPlayer.style.right  = 'auto';
      }

      function applyAudioPos(left, top) {
        const bW = audioPlayer.offsetWidth;
        const bH = audioPlayer.offsetHeight;
        const nl = Math.max(8, Math.min(window.innerWidth  - bW - 8, left));
        const nt = Math.max(8, Math.min(window.innerHeight - bH - 8, top));
        audioPlayer.style.position = 'fixed';
        audioPlayer.style.left   = nl + 'px';
        audioPlayer.style.top    = nt + 'px';
        audioPlayer.style.bottom = 'auto';
        audioPlayer.style.right  = 'auto';
      }

      function startAudioDrag(clientX, clientY) {
        if (!isDraggingAudio) initAudioFixed();
        isDraggingAudio = true;
        audioHasMoved   = false;
        startX = clientX;
        startY = clientY;
        origLeft = parseFloat(audioPlayer.style.left) || audioPlayer.getBoundingClientRect().left;
        origTop  = parseFloat(audioPlayer.style.top)  || audioPlayer.getBoundingClientRect().top;
        audioPlayer.style.cursor = 'grabbing';
      }

      function moveAudioDrag(clientX, clientY) {
        if (!isDraggingAudio) return;
        const dx = clientX - startX;
        const dy = clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) audioHasMoved = true;
        if (!audioHasMoved) return;
        applyAudioPos(origLeft + dx, origTop + dy);
      }

      function endAudioDrag() {
        if (!isDraggingAudio) return;
        isDraggingAudio = false;
        audioPlayer.style.cursor = 'move';
      }

      // Mouse
      audioPlayer.addEventListener('mousedown', (e) => {
        startAudioDrag(e.clientX, e.clientY);
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => moveAudioDrag(e.clientX, e.clientY));
      document.addEventListener('mouseup', endAudioDrag);

      // Touch
      audioPlayer.addEventListener('touchstart', (e) => {
        startAudioDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      audioPlayer.addEventListener('touchmove', (e) => {
        if (!isDraggingAudio) return;
        e.preventDefault();
        moveAudioDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false });

      audioPlayer.addEventListener('touchend', endAudioDrag);
    }

  // ====================== PROGRESS TABS ======================
  const tabButtons = document.querySelectorAll('.tab-button');
  const evolutionContent = document.querySelector('#evolution-content');
  const progressDescription = document.querySelector('#progress-description');
  const addProgressButton = document.querySelector('#add-progress');
  const progressDateInput = document.querySelector('#progress-date');
  const progressValueInput = document.querySelector('#progress-value');
  let chartInstance = null;
  let userProgress = JSON.parse(localStorage.getItem('userProgress')) || [];
  function saveProgress() { localStorage.setItem('userProgress', JSON.stringify(userProgress)); }
  if (addProgressButton) {
    addProgressButton.addEventListener('click', () => {
      const date = progressDateInput.value, value = parseFloat(progressValueInput.value);
      if (date && !isNaN(value)) {
        userProgress.push({ date, value });
        userProgress.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveProgress();
        showErrorPopup('Data added! Switch tabs to see updated chart.');
        updateChart(document.querySelector('.tab-button.active')?.dataset.tab);
      } else {
        showErrorPopup('Please enter a valid date and value.');
      }
    });
  }

  document.querySelectorAll('.product-card').forEach(card => { card.addEventListener('mouseenter', () => { card.style.transition = 'transform 0.3s ease'; }); });

  function aggregateData(tab) {
    if (userProgress.length === 0) {
      if (tab === 'daily') return { labels: ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'], data: [65,68,70,72,75,78,80], description: 'Your daily progress shows a steady increase. Add your own data for real tracking!' };
      if (tab === 'weekly') return { labels: ['Week 1','Week 2','Week 3','Week 4'], data: [70,75,80,85], description: "On a weekly basis, you've gained an average of 5 points per week. Add your own data!" };
      if (tab === 'monthly') return { labels: ['Month 1','Month 2','Month 3'], data: [75,85,95], description: 'Your monthly evolution demonstrates significant transformation. Add your own data!' };
    }
    const aggregated = {};
    userProgress.forEach(entry => {
      const date = new Date(entry.date);
      let key;
      if (tab === 'daily') key = entry.date;
      else if (tab === 'weekly') key = `Week ${Math.floor(date.getDate()/7)+1} (${date.getFullYear()}-${date.getMonth()+1})`;
      else if (tab === 'monthly') key = `Month ${date.getMonth()+1} (${date.getFullYear()})`;
      if (!aggregated[key]) aggregated[key] = [];
      aggregated[key].push(entry.value);
    });
    const labels = Object.keys(aggregated);
    const data = labels.map(key => aggregated[key].reduce((s,v) => s+v, 0) / aggregated[key].length);
    return { labels, data, description: `Your ${tab} progress based on your entered data.` };
  }

  function updateChart(tab) {
    const { labels, data, description } = aggregateData(tab);
    if (progressDescription) progressDescription.innerText = description;
    if (chartInstance) chartInstance.destroy();
    const ctxChart = document.getElementById('progress-chart')?.getContext('2d');
    if (!ctxChart) return;
    chartInstance = new Chart(ctxChart, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Progress', data, borderColor: '#e91e63', backgroundColor: 'rgba(233,30,99,0.2)', fill: true, tension: 0.4 }] },
      options: { responsive: true, scales: { y: { beginAtZero: false } }, plugins: { legend: { display: true } } }
    });
  }

  if (tabButtons && evolutionContent) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        updateChart(button.dataset.tab);
      });
    });
    tabButtons[0]?.click();
  }

  // ====================== ACCORDION ======================
  document.querySelectorAll('.accordion-header').forEach(header => { header.addEventListener('click', () => { header.parentElement.classList.toggle('active'); }); });

  // ====================== PLAY OVERLAY ======================
  const playOverlay = document.querySelector('.play-overlay');
  if (playOverlay) playOverlay.addEventListener('click', () => { showErrorPopup('Video playback started'); });

  // ====================== NEWSLETTER ======================
  // Delegated on document: #newsletter-form lives inside newsletter.html,
  // injected asynchronously AFTER script.js runs, so a direct
  // getElementById().addEventListener() here would silently find nothing.
  document.addEventListener('submit', async function(e) {
    const newsletterForm = e.target.closest('#newsletter-form');
    if (!newsletterForm) return;
    e.preventDefault();

    const emailInput = document.getElementById('newsletter-email');
    const email = emailInput ? emailInput.value.trim() : '';
    if (!email || !email.includes('@')) {
      showErrorPopup("Please enter a valid email");
      return;
    }

    const btn = newsletterForm.querySelector('button[type="submit"], .nl-btn');
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fi fi-rr-spinner"></i><span>Sending...</span>';
    }

    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'newsletter-subscribe', email: email })
      });
      const data = await res.json();

      if (data.success) {
        // Unified thank-you text — same source as #newsletter-popup / #bbwNlSuccess
        const npSettings = (window.__allProducts || []).find(p => p.type === 'settings') || {};
        const np = npSettings.newsletter_popup || {};
        const nlSuccessTextEl = document.getElementById('nl-success-text');
        if (nlSuccessTextEl && np.message) nlSuccessTextEl.textContent = np.message;

        // Popup thank you
        const popup = document.getElementById('newsletter-popup');
        if (popup) {
          popup.classList.add('show');
          setTimeout(() => popup.classList.remove('show'), 7000);
          const closeBtn = document.getElementById('popup-close-btn');
          if (closeBtn) closeBtn.onclick = () => popup.classList.remove('show');
        }

        // Message inline success
        const formWrap = document.getElementById('nl-form-wrap');
        const successMsg = document.getElementById('nl-success-msg');
        if (formWrap) formWrap.style.display = 'none';
        if (successMsg) successMsg.style.display = 'flex';

        emailInput.value = '';

        if (btn) {
          btn.innerHTML = '<i class="fi fi-rr-check"></i><span>Subscribed!</span>';
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
          }, 4000);
        }

      } else {
        showErrorPopup("Error: " + (data.error || "Unknown"));
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
      }

    } catch (err) {
      showErrorPopup("Network error. Please try again.");
      if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
      console.error('Newsletter error:', err);
    }
  });



  // ====================== PROGRESS CURVE ======================
  const ctxCurve = document.getElementById('progress-curve');
  if (ctxCurve) {
    new Chart(ctxCurve, {
      type: 'line',
      data: {
        labels: ['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6','Week 7','Week 8','Week 9','Week 10','Week 11','Week 12'],
        datasets: [
          { label: 'Average Weight Loss (lbs)', data: [2,4,6,8,10,12,13,14,15,16,17,18], borderColor: '#e91e63', backgroundColor: 'rgba(233,30,99,0.2)', fill: true, tension: 0.4 },
          { label: 'Average Confidence Score (1-10)', data: [4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5], borderColor: '#673ab7', backgroundColor: 'rgba(103,58,183,0.2)', fill: true, tension: 0.4 }
        ]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true } } }
    });
  }

  // ================================================================
  //   CART & WISHLIST
  // ================================================================
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
  const cartDrawer = document.querySelector('.cart-drawer');
  const wishlistModal = document.querySelector('.wishlist-modal');
  const overlay = document.querySelector('.overlay');
  function getOverlay() { return document.querySelector('.overlay'); }
  const cartItemsContainer = document.querySelector('.cart-items');
  const wishlistItemsContainer = document.querySelector('.wishlist-items');
  const cartBadge = document.querySelector('.cart-badge');
  const wishlistBadge = document.querySelector('.wishlist-badge');
  const cartIcon = document.querySelector('.cart-icon');

  // Recharge `wishlist` (variable de cette closure) depuis localStorage et
  // rafraîchit tout l'affichage — nécessaire pour tout code EXTÉRIEUR à
  // cette closure (ex: le wishlist share receiver, IIFE top-level plus bas
  // dans ce fichier) qui écrit dans localStorage sans jamais pouvoir
  // toucher directement cette variable `wishlist` locale. Sans ce pont,
  // le badge peut sembler à jour (mis à jour via window.updateBadges,
  // qui lit pourtant la même variable obsolète) alors que la popup
  // wishlist (renderWishlist) reste vide, et un ajout ultérieur écrase
  // silencieusement ce que le lien partagé avait ajouté.
  window.__bbwReloadWishlist = function () {
    try { wishlist = JSON.parse(localStorage.getItem('wishlist')) || []; } catch (e) { wishlist = []; }
    window.wishlist = wishlist;
    updateBadges();
    updateWishlistIcons();
    renderWishlist();
  };

 function saveCart() { 
  localStorage.setItem('cart', JSON.stringify(cart));
  window.cart = cart;
  document.dispatchEvent(new Event('cart:update'));
  if (typeof window.__rcRefresh === 'function') window.__rcRefresh();
  bbwInitCartPushReminder();

  // ── Sync vers le sheet si connecté ──
  const userEmail = localStorage.getItem('userEmail');
  if (userEmail) {
    updateCartQuantityInSheet();
  }

  const wishlistCountEl = document.querySelector('[data-wishlist-count]');
  if (wishlistCountEl) {
    const qty = cart.reduce((sum, i) => sum + i.quantity, 0);
    wishlistCountEl.textContent = qty;
  }
}
function saveWishlist() {
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
  // Miroir global, même pattern que window.cart (saveCart ci-dessus) —
  // requis par les IIFE top-level hors de cette closure (ex: le
  // wishlist share receiver plus bas dans ce fichier), qui n'ont sinon
  // aucun accès à cette variable `wishlist` locale.
  window.wishlist = wishlist;
}
window.saveWishlist        = saveWishlist;
window.updateBadges        = updateBadges;


window.__bbwRestoreSavedCart = async function (userEmail, token) {
    if (!userEmail) return;
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats', email: userEmail, token })
      });
      const data = await res.json();
      if (!data || !data.savedCart) return;

      let savedCart = [];
      try { savedCart = JSON.parse(data.savedCart); } catch (e) { savedCart = []; }
      if (!Array.isArray(savedCart) || savedCart.length === 0) return;

      // ── Fusionner avec le cart local ──
      let localCart = [];
      try { localCart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { localCart = []; }

      savedCart.forEach(function (savedItem) {
        const existing = localCart.find(function (i) {
          return i.id === savedItem.id && i.color === savedItem.color && i.size === savedItem.size;
        });
        if (existing) {
          existing.quantity = Math.max(existing.quantity, savedItem.quantity);
        } else {
          localCart.push(savedItem);
        }
      });

      // ── CRITIQUE : pousser dans la variable cart via __setCart ──
      if (typeof window.__setCart === 'function') {
        window.__setCart(localCart);
      } else {
        localStorage.setItem('cart', JSON.stringify(localCart));
      }

      // ── Attendre que le DOM soit prêt puis mettre à jour l'UI ──
      function applyCartToUI() {
        // Sync le badge cart header
        const cartQty = localCart.reduce((sum, i) => sum + i.quantity, 0);
        document.querySelectorAll('.cart-badge').forEach(badge => {
          badge.textContent = cartQty;
          badge.classList.toggle('active', cartQty > 0);
        });
        // Sync items in cart sur la page account
        const wishlistCountEl = document.querySelector('[data-wishlist-count]');
        if (wishlistCountEl) wishlistCountEl.textContent = cartQty;

        if (typeof window.updateBadges === 'function') window.updateBadges();
        if (typeof window.renderCart   === 'function') window.renderCart();
        if (typeof window.updateCartQuantityInSheet === 'function') window.updateCartQuantityInSheet();
      }

      // Petit délai pour s'assurer que les fonctions sont disponibles
      if (typeof window.updateBadges === 'function') {
        applyCartToUI();
      } else {
        setTimeout(applyCartToUI, 800);
      }

    } catch (e) {
      console.warn('[CartSync] Restore failed:', e.message);
    }
  };

document.dispatchEvent(new Event('wishlist:change'));


  function updateBadges() {
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = cartQuantity;
    badge.classList.toggle('active', cartQuantity > 0);
  });
  
  document.querySelectorAll('.wishlist-badge').forEach(badge => {
    badge.textContent = wishlist.length;
    badge.classList.toggle('active', wishlist.length > 0);
  });
}

  function renderCart() {
    if (!cartItemsContainer) return;
    if (typeof applyPromoFreeItems === 'function' && products && products.length) {
        applyPromoFreeItems();
    }

    cartItemsContainer.innerHTML = '';

    const emptyCart           = cartDrawer.querySelector('.empty-cart');
    const reviewsCarouselCart = cartDrawer.querySelector('.reviews-carousel');
    const cartMarquee         = cartDrawer.querySelector('.cart-marquee');
    const paymentIcons        = cartDrawer.querySelector('.payment-icons');
    const cartFooter          = cartDrawer.querySelector('.cart-drawer__footer');

   const countdown   = document.querySelector('.cart-drawer__countdown');
    const progressBar = document.querySelector('.cart-drawer__progress-container');
    const promoMsg    = document.querySelector('.cart-promo-message');
    const banner      = document.querySelector('.cart-drawer__paul-banner');
    const promoCodes  = document.querySelector('.cart-drawer__promo-slider-container');

    if (cart.length === 0) {
      if (emptyCart)           emptyCart.style.display           = 'block';
      if (reviewsCarouselCart) reviewsCarouselCart.style.display = 'none';
      if (cartMarquee)         cartMarquee.style.display         = 'none';
      if (paymentIcons)        paymentIcons.style.display        = 'none';
      if (cartFooter)          cartFooter.style.display          = 'none';
      if (countdown)   countdown.style.display   = 'none';
      if (progressBar) progressBar.style.display = 'none';
      if (promoMsg)    promoMsg.style.display     = 'none';
      if (banner)      banner.style.display       = 'none';
      if (promoCodes)  promoCodes.style.display   = 'none';
      const drawerExtra = document.getElementById('drawer-extra-section');
      if (drawerExtra) drawerExtra.style.display = 'none';
      const bbwTimeline = document.getElementById('bbw-order-timeline-drawer');
      if (bbwTimeline) bbwTimeline.style.display = 'none';
      const bbwGlobeDrawer = document.getElementById('bbw-globe-badge-drawer');
      if (bbwGlobeDrawer) bbwGlobeDrawer.style.display = 'none';
    } else {
      if (emptyCart)           emptyCart.style.display           = 'none';
      if (reviewsCarouselCart) reviewsCarouselCart.style.display = 'block';
      if (cartMarquee)         cartMarquee.style.display         = 'block';
      if (paymentIcons)        paymentIcons.style.display        = 'flex';
      if (cartFooter)          cartFooter.style.display          = 'block';
      if (countdown)   countdown.style.display   = 'flex';
      if (progressBar) progressBar.style.display = 'block';
      if (promoMsg)    promoMsg.style.display     = 'block'; 
      if (banner)      banner.style.display       = 'block';
      if (promoCodes)  promoCodes.style.display   = 'block';
      const drawerExtra2 = document.getElementById('drawer-extra-section');
      if (drawerExtra2) drawerExtra2.style.display = '';
      const bbwTimeline = document.getElementById('bbw-order-timeline-drawer');
      if (bbwTimeline) bbwTimeline.style.display = '';
      const bbwGlobeDrawer2 = document.getElementById('bbw-globe-badge-drawer');
      if (bbwGlobeDrawer2) bbwGlobeDrawer2.style.display = 'flex';

     const BBW_FEATURED_IDS = [
        'Pdg-Francenel-product69','Pdg-Francenel-product70','Pdg-Francenel-product71',
        'Pdg-Francenel-product72','Pdg-Francenel-product73','Pdg-Francenel-product74',
        'Pdg-Francenel-product75',
        'Pdg-Francenel-product98','Pdg-Francenel-product99','Pdg-Francenel-product100',
        'Pdg-Francenel-product101','Pdg-Francenel-product102','Pdg-Francenel-product103',
        'Pdg-Francenel-product104','Pdg-Francenel-product105','Pdg-Francenel-product106',
        'Pdg-Francenel-product107','Pdg-Francenel-product108','Pdg-Francenel-product109',
        'Pdg-Francenel-product110'
      ];

      cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');
        cartItem.dataset.id = item.id;
        if (item.size  != null) cartItem.dataset.size  = item.size;
        if (item.color != null) cartItem.dataset.color = item.color;

        const settings_check = products.find(p => p.type === 'settings') || {};
        const plansOn = (settings_check.plans_available || 'no').toLowerCase().trim() === 'yes';
        const isFeaturedWarning = BBW_FEATURED_IDS.includes(item.id) && !plansOn;

        const freeTag = item.isFreePromo
          ? `<span class="free-badge">🎁 Free 0.00$</span>`
          : '';

        const warningDot = isFeaturedWarning
          ? `<div class="cart-item-warning-dot">
              <span class="cart-item-warning-tooltip">
                ⚠️ This product is not yet validated on our site. Please submit a request.
              </span>
            </div>`
          : '';

        const requestBtn = isFeaturedWarning
          ? `<button class="cart-item-request-btn" data-product-id="${item.id}">
              <i class="fi fi-rr-shopping-bag"></i> Request this product
            </button>`
          : '';

        cartItem.innerHTML = `
          <div class="cart-item-img-wrap">
            <img src="${item.image}" alt="${item.title}">
            ${warningDot}
          </div>
          <div class="item-meta">
            <h4>${item.title.replace('', '')} ${freeTag}</h4>
            <p>${item.isFreePromo ? '' : '$' + parseFloat(item.price).toFixed(2)}</p>
            ${item.size  ? `<p class="item-variant">Size: ${item.size}</p>`   : ''}
            ${item.color ? `<p class="item-variant">Color: ${item.color}</p>` : ''}
            ${requestBtn}
            <div class="quantity-row">
              <div class="quantity">
                <button class="qty-minus">−</button>
                <span>${item.quantity}</span>
                <button class="qty-plus">+</button>
              </div>
              <button class="remove-item"><i class="fi fi-sr-trash"></i></button>
            </div>
          </div>`;

        cartItemsContainer.appendChild(cartItem);

        // Bind request button
        const reqBtn = cartItem.querySelector('.cart-item-request-btn');
        if (reqBtn) {
          reqBtn.addEventListener('click', () => {
            const pid = reqBtn.dataset.productId;
            if (typeof window.openProductRequestPopup === 'function') {
              window.openProductRequestPopup(pid);
            } else if (typeof window.openPlanPopup === 'function') {
              window.openPlanPopup(pid);
            }
          });
        }

        const img   = cartItem.querySelector('img');
        const title = cartItem.querySelector('h4');
        if (img && title && typeof window.getProductUrl === 'function') {
          const productUrl = window.getProductUrl(item.id);
          img.style.cursor = 'pointer'; title.style.cursor = 'pointer';
          img.addEventListener('click',   () => { window.location.href = productUrl; });
          title.addEventListener('click', () => { window.location.href = productUrl; });
        }
      });

      cartItemsContainer.querySelectorAll('.qty-plus').forEach(btn  => btn.addEventListener('click', handleQuantityChange));
      cartItemsContainer.querySelectorAll('.qty-minus').forEach(btn => btn.addEventListener('click', handleQuantityChange));
      cartItemsContainer.querySelectorAll('.remove-item').forEach(btn => btn.addEventListener('click', removeFromCart));
    }

   updateSubtotal();
    if (products.length) {
      const cd = (products.find(p => p.type === 'settings') || {}).cart_drawer || {};
      updateCartProgressBar(cd);
      updateCartPromoMessage(cd);
    }
    updateBadges();

    if (typeof window.convertPricesForCountry === 'function') {
      var _savedCountry = localStorage.getItem('bbw_country');
      if (_savedCountry) window.convertPricesForCountry(_savedCountry);
    }
  }

  function normalizeVal(v) {
  if (v === undefined || v === '' || v === 'null' || v === 'undefined') return null;
  return v;
}

  function handleQuantityChange(e) {
  const btn = e.target, itemElement = btn.closest('.cart-item');
  const id    = itemElement.dataset.id;
  const size  = normalizeVal(itemElement.dataset.size);
  const color = normalizeVal(itemElement.dataset.color);
  const item  = cart.find(i => {
    return i.id === id
      && normalizeVal(i.size)  === size
      && normalizeVal(i.color) === color;
  });
  if (item) {
    if (btn.classList.contains('qty-plus')) item.quantity++;
    else if (btn.classList.contains('qty-minus') && item.quantity > 1) item.quantity--;
    else if (btn.classList.contains('qty-minus') && item.quantity === 1) { removeFromCart(e); return; }
    itemElement.querySelector('.quantity span').textContent = item.quantity;
    saveCart();
    updateCartQuantityInSheet();
    if (products && products.length > 0 && typeof applyPromoFreeItems === 'function') {
      applyPromoFreeItems();
      saveCart();
    }
    updateSubtotal();
    updateBadges();
    renderCart();
  }
}

  function removeFromCart(e) {
  const itemElement = e.target.closest('.cart-item');
  const id    = itemElement.dataset.id;
  const size  = normalizeVal(itemElement.dataset.size);
  const color = normalizeVal(itemElement.dataset.color);
  const idx   = cart.findIndex(i => {
    return i.id === id
      && normalizeVal(i.size)  === size
      && normalizeVal(i.color) === color;
  });
  if (idx !== -1) cart.splice(idx, 1);
  saveCart(); updateCartQuantityInSheet(); updateSubtotal(); updateBadges(); renderCart();
}

  // ── "Fly to cart" — l'image du produit s'envole du bouton vers l'icône panier ──
  function flyToCart(startEl, imageUrl, quantity) {
    const liveCartIcon = document.querySelector('.cart-icon');
    if (!startEl || !imageUrl || !liveCartIcon) return;
    const startRect = startEl.getBoundingClientRect();
    const endRect = liveCartIcon.getBoundingClientRect();
    if (startRect.width === 0 || endRect.width === 0) return;

    const flyer = document.createElement('div');
    flyer.className = 'fly-to-cart';
    flyer.innerHTML = `<img src="${imageUrl}" alt="">${quantity > 1 ? `<span class="fly-to-cart__qty">${quantity}</span>` : ''}`;

    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;

    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    flyer.style.setProperty('--fly-dx', `${endX - startX}px`);
    flyer.style.setProperty('--fly-dy', `${endY - startY}px`);

    document.body.appendChild(flyer);

    requestAnimationFrame(() => { flyer.classList.add('fly-to-cart--go'); });

    flyer.addEventListener('animationend', () => {
      flyer.remove();
      liveCartIcon.classList.add('added');
      setTimeout(() => liveCartIcon.classList.remove('added'), 500);
    }, { once: true });
  }

  function updateSubtotal() {
    const el = cartDrawer ? cartDrawer.querySelector('.cart-drawer__footer .subtotal') : document.querySelector('.subtotal');
    if (!el) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    el.textContent = `Subtotal: $${subtotal.toFixed(2)}`;

    // Bandeau purement informatif (tax + reduction appliquees au checkout,
    // jamais soustraites/ajoutees ici pour eviter d'afficher un total
    // different de celui reellement facture — cf. cart-page.js pour le
    // meme principe sur cart.html).
    updateDrawerCheckoutNote(subtotal);
  }

  function updateDrawerCheckoutNote(subtotal) {
    const footer = cartDrawer ? cartDrawer.querySelector('.cart-drawer__footer') : null;
    if (!footer) return;

    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const settings = (products.find(p => p.type === 'settings')) || {};
    const promos = Array.isArray(settings.promos) ? settings.promos : [];
    const bestPromo = promos
      .filter(p => p && p.items > 0 && p.percent > 0 && totalQty >= p.items)
      .sort((a, b) => b.items - a.items)[0];

    let note = footer.querySelector('.cart-checkout-note');
    if (!bestPromo) {
      if (note) note.remove();
      return;
    }
    if (!note) {
      note = document.createElement('div');
      note.className = 'cart-checkout-note';
      footer.insertBefore(note, footer.querySelector('.subtotal'));
    }
    note.innerHTML = `<i class="fi fi-rr-badge-percent"></i> ${bestPromo.percent}% discount will be applied at checkout`;
  }

  function addToCart(e) {
    e.stopPropagation();
    const container = e.target.closest('.product-card') || e.target.closest('.product-section');
    if (!container) return false;
    const id = container.dataset.id || container.dataset.productId;
    const product = products.find(p => p.id === id);
    if (!product) return false;
    function getVariantPrice(product, color, size) {
      if (!color || !size) return product.price;
      const variant = product.variants.find(v => v.color === color && v.size === size);
      return variant ? variant.price : product.price;
    }
    function getVariantComparePrice(product, color, size) {
      return getVariantPrice(product, color, size) * (product.compare_price / product.price);
    }
    const isProductPage = !!container.dataset.productId;
    let quantity = 1;
    const qtyInput = container.querySelector('.quantity input');
    if (qtyInput) quantity = parseInt(qtyInput.value);
    let selectedSize = null, selectedColor = null, itemImage = upgradeShopifyImageUrl(product.image), cjVariantId = null;
    if (isProductPage) {
      const sizeSelect = document.getElementById('size-select');
      const activeSwatch = document.querySelector('.color-swatches .swatch.active');
      selectedSize  = sizeSelect && sizeSelect.value !== "" ? sizeSelect.value : null;
      selectedColor = activeSwatch ? activeSwatch.dataset.color : null;
      if ((product.colors && product.colors.length > 0 && !selectedColor) || (product.sizes && product.sizes.length > 0 && !selectedSize)) {
        showErrorPopup("Please select a color first."); return false;
      }
      if (selectedColor) { const colorObj = product.colors.find(c => c.name === selectedColor); if (colorObj && colorObj.image) itemImage = upgradeShopifyImageUrl(colorObj.image); }
    } else {
      const gridColorName = container.dataset.selectedColor;
      const gridColorObj  = gridColorName && product.colors ? product.colors.find(c => c.name === gridColorName) : null;
      if (gridColorObj) {
        selectedColor = gridColorObj.name;
        if (gridColorObj.image) itemImage = upgradeShopifyImageUrl(gridColorObj.image);
      } else if (product.colors && product.colors.length > 0) {
        selectedColor = product.colors[0].name;
        if (product.colors[0].image) itemImage = upgradeShopifyImageUrl(product.colors[0].image);
      }
      if (product.sizes && product.sizes.length > 0) selectedSize = product.sizes[0];
    }
    const variant = product.variants.find(v => {
      const colorMatch = !selectedColor || v.color === selectedColor;
      const sizeMatch  = (!selectedSize && v.size === "") || (selectedSize === null && v.size === "") || (selectedSize && v.size === selectedSize);
      return colorMatch && sizeMatch;
    });
    if (variant) cjVariantId = variant.vid;
    else if (product.variants && product.variants.length > 0) cjVariantId = product.variants[0].vid;
    const varPrice   = getVariantPrice(product, selectedColor, selectedSize);
    const varCompare = getVariantComparePrice(product, selectedColor, selectedSize);
    let cartItem = cart.find(i => i.id === id && i.size === selectedSize && i.color === selectedColor);
    if (cartItem) cartItem.quantity += quantity;
    else cart.push({ id: product.id, title: product.title, price: varPrice, compare_price: varCompare, image: itemImage, size: selectedSize, color: selectedColor, quantity, cj_product_id: product.cj_id, cj_variant_id: cjVariantId });
   saveCart();
    updateCartQuantityInSheet();
    if (products && products.length > 0 && typeof applyPromoFreeItems === 'function') {
        applyPromoFreeItems();
    }
    saveCart();
    updateBadges();
    renderCart();
    const flyBtn = e.target.closest('.add-to-cart');
    if (flyBtn && itemImage) {
      flyToCart(flyBtn, itemImage, quantity);
      setTimeout(openCartDrawer, 650);
    } else {
      const liveIcon = document.querySelector('.cart-icon');
      if (liveIcon) { liveIcon.classList.add('added'); setTimeout(() => liveIcon.classList.remove('added'), 500); }
      openCartDrawer();
    }
    return true;
  }

  function renderWishlist() {
    if (!wishlistItemsContainer) return;
    wishlistItemsContainer.innerHTML = '';
    wishlist.forEach(id => {
      const product = products.find(p => p.id === id);
      if (product) {
        const wishlistItem = document.createElement('div');
        wishlistItem.classList.add('wishlist-item');
        wishlistItem.dataset.id = id;
        const comparePriceHTML = product.compare_price && product.compare_price > product.price
          ? `<p class="compare-price">$${parseFloat(product.compare_price).toFixed(2)}</p>` : '';
        wishlistItem.innerHTML = `
        <img src="${upgradeShopifyImageUrl(product.image)}" alt="${product.title}" class="wishlist-img">
        <h4 class="wishlist-title">${product.title}</h4>
        <p>$${parseFloat(product.price).toFixed(2)}</p>
        ${comparePriceHTML}
        <button class="remove-wishlist" data-id="${id}">
          <i class="fi fi-rr-trash"></i>
        </button>`;
        const img = wishlistItem.querySelector('.wishlist-img');
        const titleEl = wishlistItem.querySelector('.wishlist-title');
        if (img && titleEl && typeof window.getProductUrl === 'function') {
          const productUrl = window.getProductUrl(id);
          img.style.cursor = 'pointer'; titleEl.style.cursor = 'pointer';
          img.addEventListener('click',    (e) => { e.stopPropagation(); window.location.href = productUrl; });
          titleEl.addEventListener('click',(e) => { e.stopPropagation(); window.location.href = productUrl; });
        }
        wishlistItemsContainer.appendChild(wishlistItem);
      }
    });
    wishlistItemsContainer.querySelectorAll('.remove-wishlist').forEach(btn => btn.addEventListener('click', removeFromWishlist));
  }

  function removeFromWishlist(e) {
    const itemElement = e.target.closest('.wishlist-item');
    const id = itemElement.dataset.id;
    wishlist = wishlist.filter(i => i !== id);
    itemElement.remove();
    saveWishlist(); updateBadges(); updateWishlistIcons();
  }

  function addAllToCart() {
    wishlist.forEach(id => {
      const product = products.find(p => p.id === id);
      if (!product) return;

      // ── Récupère la première variante valide ──
      const firstVariant = (product.variants && product.variants.length > 0)
        ? product.variants[0]
        : null;

      const color = firstVariant ? (firstVariant.color || null) : null;
      const size  = firstVariant ? (firstVariant.size  || null) : null;
      const price = firstVariant ? firstVariant.price  : product.price;
      const cjVariantId = firstVariant ? firstVariant.vid : null;

      // ── Image correspondant à la couleur si dispo ──
      const colorObj = (color && product.colors)
        ? product.colors.find(c => c.name === color)
        : null;
      const image = upgradeShopifyImageUrl(colorObj ? (colorObj.image || product.image) : product.image);

      // ── Compare price proportionnelle au variant ──
      const ratio = product.compare_price / product.price;
      const comparePrice = price * ratio;

      let cartItem = cart.find(i => i.id === id && i.color === color && i.size === size);
      if (cartItem) {
        cartItem.quantity++;
      } else {
        cart.push({
          id:            product.id,
          title:         product.title,
          price:         price,
          compare_price: comparePrice,
          image:         image,
          size:          size,
          color:         color,
          quantity:      1,
          cj_product_id: product.cj_id,
          cj_variant_id: cjVariantId
        });
      }
    });

    if (products && products.length > 0 && typeof applyPromoFreeItems === 'function') {
      applyPromoFreeItems();
    }

    saveCart();
    updateCartQuantityInSheet();
    updateBadges();
    renderCart();
    closeWishlistModal();
    openCartDrawer();
  }

  async function updateCartQuantityInSheet() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    const qty = cart.reduce((sum, item) => sum + item.quantity, 0);
    await fetch('/.netlify/functions/save-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-cart-quantity',
        email: userEmail,
        currentCartQuantity: qty,
        cartContent: cart
      })
    }).catch(() => {});
  }


  function openCartDrawer() {
    if (products && products.length > 0 && typeof applyPromoFreeItems === 'function') {
        applyPromoFreeItems();
        saveCart();
        updateBadges();
    }
    
    renderCart();
    cartDrawer.classList.add('active');
    overlay.classList.add('active');

    if (cart.length === 0) {
        // Masquer les éléments dynamiques créés par initCartDrawerExtras
        setTimeout(() => {
            const countdown   = document.querySelector('.cart-drawer__countdown');
            const progressBar = document.querySelector('.cart-drawer__progress-container');
            const promoMsg    = document.querySelector('.cart-promo-message');
            const banner      = document.querySelector('.cart-drawer__paul-banner');
            const promoCodes  = document.querySelector('.cart-drawer__promo-slider-container');
            const drawerExtra = document.getElementById('drawer-extra-section');

            if (countdown)   countdown.style.display   = 'none';
            if (progressBar) progressBar.style.display = 'none';
            if (promoMsg)    promoMsg.style.display     = 'none';
            if (banner)      banner.style.display       = 'none';
            if (promoCodes)  promoCodes.style.display   = 'none';
            if (drawerExtra) drawerExtra.style.display = 'none';
        }, 150); // après initCartDrawerExtras (100ms)
      } else {
            if (cart.length > 0) setTimeout(() => initCartDrawerExtras(), 100);
        }
}

  // ================================================================
  //   CART DRAWER EXTRAS
  // ================================================================
  let _countdownTimer   = null;
  let _countdownStarted = false;
  let _bannerTimer      = null;
  let _promoTimer       = null;

  function initCartDrawerExtras() {
    if (!products || products.length === 0) return;
    const settings = products.find(p => p.type === 'settings') || {};
    const cd       = settings.cart_drawer || {};
    const promos   = settings.promos || [];
    initCartCountdown(cd);
    updateCartProgressBar(cd);
    updateCartPromoMessage(cd);
    initCartBanner(cd);
    initCartPromoCodeSlider(promos);
  }

  function initCartCountdown(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;
    let el = body.querySelector('.cart-drawer__countdown');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cart-drawer__countdown';
      el.innerHTML = `
        <span class="cart-drawer__countdown-text"></span>
        <span class="cart-drawer__countdown-time" id="drawerCountdownTime"></span>`;
      body.insertAdjacentElement('afterbegin', el);
    }
    const textEl = el.querySelector('.cart-drawer__countdown-text');
    if (textEl) textEl.textContent = cd.countdown_text;

    if (_countdownStarted) return;
    _countdownStarted = true;

    const totalSeconds = (parseInt(cd.countdown_minutes) || 10) * 60;
    const suffix = cd.countdown_suffix || '';
    const STORAGE_KEY = 'drawerCountdownEnd';

    function runCycle() {
      const savedEnd = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();
      let endTime;
      if (savedEnd && parseInt(savedEnd) > now) {
        endTime = parseInt(savedEnd);
      } else {
        endTime = now + totalSeconds * 1000;
        localStorage.setItem(STORAGE_KEY, endTime);
      }
      if (_countdownTimer) clearInterval(_countdownTimer);
      _countdownTimer = setInterval(() => {
        const timeEl = document.getElementById('drawerCountdownTime');
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        if (remaining <= 0) {
          if (timeEl) timeEl.textContent = `0:00 ${suffix}`;
          clearInterval(_countdownTimer);
          setTimeout(() => {
            localStorage.removeItem(STORAGE_KEY);
            _countdownStarted = false;
            runCycle();
          }, 3000);
          return;
        }
        if (timeEl) {
          const m = Math.floor(remaining / 60);
          const s = remaining % 60;
          timeEl.textContent = `${m}:${s < 10 ? '0' : ''}${s} ${suffix}`;
        }
      }, 1000);
    }

    runCycle();
  }

  function updateCartProgressBar(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;

    const showBar = (cd.show_free_shipping_bar || 'Yes').toLowerCase() === 'yes';
    const existingContainer = body.querySelector('.cart-drawer__progress-container');
    if (!showBar) {
        if (existingContainer) existingContainer.style.display = 'none';
        return;
    }
    const threshold    = parseFloat(cd.free_shipping_threshold) || 75;
    const cartSubtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const remaining    = Math.max(0, threshold - cartSubtotal);
    const pct          = Math.min(100, (cartSubtotal / threshold) * 100);
    let container = body.querySelector('.cart-drawer__progress-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'cart-drawer__progress-container';
      container.innerHTML = `
      <span class="cart-drawer__progress-message"></span>
      <div class="cart-drawer__progress-bar">
        <div class="cart-drawer__progress-fill"></div>
        <span class="cart-drawer__progress-truck">
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17v-2.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </span>
      </div>`;
      const countdown = body.querySelector('.cart-drawer__countdown');
      if (countdown) countdown.insertAdjacentElement('afterend', container);
      else body.insertAdjacentElement('afterbegin', container);
    }
    const msgEl   = container.querySelector('.cart-drawer__progress-message');
    const fillEl  = container.querySelector('.cart-drawer__progress-fill');
    const truckEl = container.querySelector('.cart-drawer__progress-truck');
    if (cartSubtotal >= threshold) {
      msgEl.textContent = cd.progress_success_message;
      msgEl.style.color = '#22a06b';
      fillEl.style.width = '100%';
    } else {
      msgEl.textContent = (cd.progress_message || '').replace('${remaining}', `$${remaining.toFixed(2)}`);
      msgEl.style.color = '';
      fillEl.style.width = `${pct}%`;
    }
    requestAnimationFrame(() => {
      const barW = container.querySelector('.cart-drawer__progress-bar').offsetWidth;
      truckEl.style.right = `${Math.max(2, barW - (pct / 100) * barW - truckEl.offsetWidth / 2)}px`;
    });
  }

  function updateCartPromoMessage(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;

    const showPromo = (cd.show_promo_message || 'Yes').toLowerCase() === 'yes';
    const existingPromo = body.querySelector('.cart-promo-message');
    if (!showPromo) {
        if (existingPromo) existingPromo.style.display = 'none';
        return;
    }
    const buyQty = parseInt(cd.promo_buy_quantity) || 3;
    const getQty = parseInt(cd.promo_get_quantity) || 1;
    const count  = cart.reduce((s, i) => s + i.quantity, 0);
    let el = body.querySelector('.cart-promo-message');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cart-promo-message';
      el.innerHTML = '<span class="promo-text"></span>';
      const progress = body.querySelector('.cart-drawer__progress-container');
      if (progress) progress.insertAdjacentElement('afterend', el);
      else body.insertAdjacentElement('afterbegin', el);
    }
    const span = el.querySelector('.promo-text');
    let msg = '', cls = '';
    if (count >= buyQty) {
      msg = (cd.promo_complete_message || '').replace('{get}', `<strong class="promo-number">${getQty}</strong>`);
      cls = 'complete';
    } else if (count > 0) {
      const rem = buyQty - count;
      msg = (cd.promo_progress_message || '')
            .replace('{remaining}', `<strong class="promo-number">${rem}</strong>`)
            .replace('{get}', `<strong class="promo-number">${getQty}</strong>`);
      cls = 'progress';
    } else {
      msg = (cd.promo_initial_message || '')
            .replace('{buy}', `<strong class="promo-number">${buyQty}</strong>`)
            .replace('{get}', `<strong class="promo-number">${getQty}</strong>`);
      cls = 'initial';
    }
    span.innerHTML = msg;
    span.className = `promo-text ${cls}`;
  }

  function initCartBanner(cd) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body) return;
    const slides   = cd.banner_slides || [];
    const duration = cd.banner_slide_duration_ms || 5000;
    const videoUrl = cd.banner_video_url || '';

    if (!videoUrl && !slides.length) return;

    let banner = body.querySelector('.cart-drawer__paul-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'cart-drawer__paul-banner';
      const itemsDiv = body.querySelector('.cart-items');
      if (itemsDiv) itemsDiv.insertAdjacentElement('beforebegin', banner);
      else body.insertAdjacentElement('afterbegin', banner);
    }

    if (banner.dataset.built) return;
    banner.dataset.built = '1';

    // ── MODE VIDÉO + textes rotatifs par-dessus ──
    if (videoUrl) {
      banner.classList.add('paul-banner--video-mode');

      const video = document.createElement('video');
      video.autoplay    = true;
      video.muted       = true;
      video.loop        = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.className   = 'paul-banner-video';
      if (slides.length) video.poster = slides[0].image;

      const source = document.createElement('source');
      source.src  = videoUrl;
      source.type = 'video/mp4';
      video.appendChild(source);
      banner.appendChild(video);

      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          document.addEventListener('click', function tryPlay() {
            video.play().catch(() => {});
            document.removeEventListener('click', tryPlay);
          }, { once: true });
        });
      }

      // ── Textes rotatifs + dots par-dessus la vidéo ──
      if (slides.length) {
        const textsHTML = slides.map((s, i) => `
          <div class="paul-banner-video-text${i === 0 ? ' active' : ''}" data-index="${i}">
            ${s.text}
          </div>`).join('');

        const dotsHTML = slides.map((s, i) =>
          `<span class="paul-banner-indicator${i === 0 ? ' active' : ''}" data-slide="${i}"></span>`
        ).join('');

        const overlay = document.createElement('div');
        overlay.className = 'paul-banner-video-overlay';
        overlay.innerHTML = `
          <div class="paul-banner-video-texts">${textsHTML}</div>
          <div class="paul-banner-indicators dots">${dotsHTML}</div>`;
        banner.appendChild(overlay);

        overlay.querySelectorAll('.paul-banner-indicator').forEach(dot => {
          dot.addEventListener('click', () => {
            bannerVideoGoTo(banner, parseInt(dot.dataset.slide));
            restartBannerTimer(banner, duration);
          });
        });

        if (_bannerTimer) clearInterval(_bannerTimer);
        _bannerTimer = setInterval(() => {
          const allTexts = banner.querySelectorAll('.paul-banner-video-text');
          const active = Array.from(allTexts).findIndex(t => t.classList.contains('active'));
          bannerVideoGoTo(banner, (active + 1) % allTexts.length);
        }, duration);
      }

      return;
    }

    // ── MODE IMAGES ──
    const slidesHTML = slides.map((s, i) => `
      <div class="paul-banner-slide${i === 0 ? ' active' : ''}">
        <img src="${upgradeShopifyImageUrl(s.image)}" alt="${s.text}" class="paul-banner-image" loading="lazy">
        <h2 class="paul-banner-title">${s.text}</h2>
      </div>`).join('');

    const dotsHTML = slides.map((s, i) =>
      `<span class="paul-banner-indicator${i === 0 ? ' active' : ''}" data-slide="${i}"></span>`
    ).join('');

    banner.innerHTML = `
      <div class="paul-banner-slider-container">${slidesHTML}</div>
      <div class="paul-banner-indicators dots">${dotsHTML}</div>`;

    banner.querySelectorAll('.paul-banner-indicator').forEach(dot => {
      dot.addEventListener('click', () => {
        bannerGoTo(banner, parseInt(dot.dataset.slide));
        restartBannerTimer(banner, duration);
      });
    });

    if (_bannerTimer) clearInterval(_bannerTimer);
    _bannerTimer = setInterval(() => {
      const allSlides = banner.querySelectorAll('.paul-banner-slide');
      const active = Array.from(allSlides).findIndex(s => s.classList.contains('active'));
      bannerGoTo(banner, (active + 1) % allSlides.length);
    }, duration);
  }

  function bannerVideoGoTo(banner, idx) {
    banner.querySelectorAll('.paul-banner-video-text').forEach((t, i) => t.classList.toggle('active', i === idx));
    banner.querySelectorAll('.paul-banner-indicator').forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function bannerGoTo(banner, idx) {
    banner.querySelectorAll('.paul-banner-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    banner.querySelectorAll('.paul-banner-indicator').forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function restartBannerTimer(banner, duration) {
    if (_bannerTimer) clearInterval(_bannerTimer);
    _bannerTimer = setInterval(() => {
      const isVideo = banner.classList.contains('paul-banner--video-mode');
      if (isVideo) {
        const allTexts = banner.querySelectorAll('.paul-banner-video-text');
        const active = Array.from(allTexts).findIndex(t => t.classList.contains('active'));
        bannerVideoGoTo(banner, (active + 1) % allTexts.length);
      } else {
        const allSlides = banner.querySelectorAll('.paul-banner-slide');
        const active = Array.from(allSlides).findIndex(s => s.classList.contains('active'));
        bannerGoTo(banner, (active + 1) % allSlides.length);
      }
    }, duration);
  }

  function initCartPromoCodeSlider(promos) {
    const body = cartDrawer.querySelector('.cart-drawer__body');
    if (!body || !promos.length) return;
    let container = body.querySelector('.cart-drawer__promo-slider-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'cart-drawer__promo-slider-container';
      const slidesHTML = promos.map((p, i) => `
        <div class="cart-drawer__promo-slide${i === 0 ? ' active' : ''}" data-index="${i}">
          <div class="cart-drawer__promo-content">
            <h3 class="cart-drawer__promo-title">🎟️ Exclusive Code</h3>
            <p class="cart-drawer__promo-text">Use on <strong>${p.items}+</strong> items — Save <strong>${p.percent}%</strong></p>
            <div class="cart-drawer__promo-code-row">
              <span class="cart-drawer__promo-code" id="drawer-code-${i}">${p.code}</span>
              <button class="cart-drawer__promo-copy-btn" data-target="drawer-code-${i}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>`).join('');
      const dotsHTML = promos.map((p, i) =>
        `<span class="cart-drawer__promo-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
      ).join('');
      container.innerHTML = `
        <div class="cart-drawer__promo-slider">${slidesHTML}</div>
        <div class="cart-drawer__promo-indicators dots">${dotsHTML}</div>`;
      container.querySelectorAll('.cart-drawer__promo-dot').forEach(dot => {
        dot.addEventListener('click', () => { promoGoTo(container, parseInt(dot.dataset.index)); restartPromoTimer(container, promos.length); });
      });
      container.addEventListener('click', e => {
        const btn = e.target.closest('.cart-drawer__promo-copy-btn');
        if (!btn) return;
        const targetEl = container.querySelector(`#${btn.dataset.target}`);
        if (!targetEl) return;
        navigator.clipboard.writeText(targetEl.textContent.trim()).then(() => {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 1500);
        });
      });
      const payIcons = body.querySelector('.payment-icons');
      if (payIcons) payIcons.insertAdjacentElement('beforebegin', container);
      else body.appendChild(container);
    }
    if (_promoTimer) clearInterval(_promoTimer);
    if (promos.length > 1) restartPromoTimer(container, promos.length);
  }

  function promoGoTo(container, idx) {
    container.querySelectorAll('.cart-drawer__promo-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    container.querySelectorAll('.cart-drawer__promo-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  function restartPromoTimer(container, count) {
    if (_promoTimer) clearInterval(_promoTimer);
    _promoTimer = setInterval(() => {
      const active = container.querySelector('.cart-drawer__promo-slide.active');
      const idx = active ? parseInt(active.dataset.index) : 0;
      promoGoTo(container, (idx + 1) % count);
    }, 6000);
  }

  function closeCartDrawer() { cartDrawer.classList.remove('active'); overlay.classList.remove('active'); }
  function openWishlistModal() { renderWishlist(); wishlistModal.classList.add('active'); overlay.classList.add('active'); }
  function closeWishlistModal() { wishlistModal.classList.remove('active'); overlay.classList.remove('active'); }
  function checkout() {
  const settings_ck = products.find(p => p.type === 'settings') || {};
  const plansOn_ck  = (settings_ck.plans_available || 'no').toLowerCase().trim() === 'yes';

  const BBW_FEATURED_IDS_CK = [
    'Pdg-Francenel-product69','Pdg-Francenel-product70','Pdg-Francenel-product71',
    'Pdg-Francenel-product72','Pdg-Francenel-product73','Pdg-Francenel-product74',
    'Pdg-Francenel-product75',
    'Pdg-Francenel-product98','Pdg-Francenel-product99','Pdg-Francenel-product100',
    'Pdg-Francenel-product101','Pdg-Francenel-product102','Pdg-Francenel-product103',
    'Pdg-Francenel-product104','Pdg-Francenel-product105','Pdg-Francenel-product106',
    'Pdg-Francenel-product107','Pdg-Francenel-product108','Pdg-Francenel-product109',
    'Pdg-Francenel-product110'
  ];

  const hasFeatured = !plansOn_ck && cart.some(i => BBW_FEATURED_IDS_CK.includes(i.id));

  if (hasFeatured) {
    showCheckoutBlockPopup();
    return;
  }

  localStorage.setItem('checkoutCart', JSON.stringify(cart));
  window.location.href = '/checkout/checkout.html';
}

// ── Buy with PayPal (page produit) ──────────────────────────────
// 1) Panier vide avant le clic + couleur/taille valides (déjà vérifiées par
//    addToCart, qui bloque avec un popup sinon) : ouvre le popup de
//    livraison (paypal-shipping-modal.js — même formulaire que checkout.js,
//    adresse fournie par le CLIENT, pas par PayPal, pour arriver complète
//    chez Eprolo/CJ) puis crée la commande PayPal une fois validé.
// 2) Panier déjà rempli avant le clic (d'autres produits présents) : on
//    ajoute ce produit et on redirige vers le checkout classique, comme le
//    bouton Shop Now — un paiement PayPal direct ne concernerait alors
//    qu'un seul article et laisserait le reste du panier de côté.
  function buyWithPaypal(e) {
    const wasCartEmptyBefore = cart.length === 0;

    const added = addToCart(e); // valide couleur/taille (popup d'erreur sinon) puis ajoute au panier
    if (!added) return; // couleur/taille manquante : popup déjà affiché, on s'arrête ici

    if (!wasCartEmptyBefore) {
      checkout();
      return;
    }

    if (typeof window.openPaypalShippingModal === 'function') {
      window.openPaypalShippingModal();
    } else {
      showErrorPopup('PayPal checkout is not ready yet. Please try again in a moment.');
    }
  }

function showCheckoutBlockPopup() {
  let popup = document.getElementById('checkout-block-popup');
  if (popup) { popup.style.display = 'flex'; return; }

  popup = document.createElement('div');
  popup.id = 'checkout-block-popup';
  popup.innerHTML = `
    <div class="cbp-modal">
      <div class="cbp-icon">🚫</div>
      <h3 class="cbp-title">Action Required</h3>
      <p class="cbp-msg">
        Dear customer, your cart contains <strong>products that are not yet available</strong> on our site.<br><br>
        Please <strong>remove the "Request" products</strong> from your cart before proceeding to checkout, or submit a request for them.
      </p>
      <div class="cbp-actions">
        <button class="cbp-btn cbp-btn--close" id="cbp-close-btn">Got it, I'll remove them</button>
      </div>
    </div>`;
  document.body.appendChild(popup);

  document.getElementById('cbp-close-btn').addEventListener('click', () => {
    popup.style.display = 'none';
    openCartDrawer();
  });

  popup.addEventListener('click', e => {
    if (e.target === popup) popup.style.display = 'none';
  });
}

  function toggleWishlist(e) {
    const icon = e.target.closest('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon');
    if (!icon) return;
    const id = icon.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.productId;
    if (!id) return;
    const isMini = icon.classList.contains('mini-wishlist-icon');
    const toggleClass = isMini ? 'added' : 'active';
    const index = wishlist.indexOf(id);
    if (index === -1) { wishlist.push(id); icon.classList.add(toggleClass); }
    else { wishlist.splice(index, 1); icon.classList.remove(toggleClass); }
    saveWishlist(); updateBadges(); updateWishlistIcons();
    document.dispatchEvent(new Event('wishlist:change'));
  }

  function updateWishlistIcons() {
    document.querySelectorAll('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon').forEach(icon => {
      const id = icon.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.id || icon.closest('[data-id],[data-product-id]')?.dataset.productId;
      if (!id) return;
      const isInWishlist = wishlist.includes(id);
      const isMini = icon.classList.contains('mini-wishlist-icon');
      icon.classList.toggle(isMini ? 'added' : 'active', isInWishlist);
      icon.classList.toggle('fas', isInWishlist);
      icon.classList.toggle('far', !isInWishlist);
      const emptySvg  = icon.querySelector('.wishlist-icon-empty');
      const filledSvg = icon.querySelector('.wishlist-icon-filled');
      if (filledSvg && emptySvg) { filledSvg.style.display = isInWishlist ? 'block' : 'none'; emptySvg.style.display = isInWishlist ? 'none' : 'block'; }
    });
  }
  window.updateWishlistIcons = updateWishlistIcons;

  updateBadges();
  updateWishlistIcons();
  document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', addToCart));
  document.querySelectorAll('.buy-now').forEach(btn => { btn.addEventListener('click', (e) => { if (addToCart(e)) checkout(); }); });
  document.querySelectorAll('.buy-paypal').forEach(btn => { btn.addEventListener('click', buyWithPaypal); });
  document.querySelectorAll('.wishlist-toggle, .wishlist-icon-product, .mini-wishlist-icon').forEach(icon => { icon.addEventListener('click', toggleWishlist); });

const cartWrapper = document.querySelector('.icon-wrapper:has(.cart-icon)');
  if (cartWrapper) cartWrapper.addEventListener('click', openCartDrawer);
  const wishlistWrapper = document.querySelector('.icon-wrapper:has(.wishlist-icon)');
  if (wishlistWrapper) wishlistWrapper.addEventListener('click', openWishlistModal);

  if (overlay) overlay.addEventListener('click', () => { closeCartDrawer(); closeWishlistModal(); });
  const closeDrawerBtn = document.querySelector('.close-drawer');
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeCartDrawer);
  const closeModalBtn = document.querySelector('.close-modal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeWishlistModal);
  const checkoutBtn = cartDrawer ? cartDrawer.querySelector('.cart-drawer__footer .checkout') : document.querySelector('.checkout');
  if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);
  const addAllBtn = document.querySelector('.add-all-to-cart');
  if (addAllBtn) addAllBtn.addEventListener('click', addAllToCart);

  document.addEventListener('wishlist:change', () => { updateBadges(); updateWishlistIcons(); renderWishlist(); });


// ================================================================
//   WISHLIST SLUG MAP — déclaré UNE SEULE FOIS, partagé
// ================================================================
const BBW_WISHLIST_SLUG_MAP = {
  'Pdg-Francenel-product1':  'glam-heels-cross-strap-stiletto-sandals',
  'Pdg-Francenel-product2':  'retrorun-sneakers-chunky-sole-street-style',
  'Pdg-Francenel-product3':  'bohoflip-sandals-embroidered-boho-flip-flops',
  'Pdg-Francenel-product4':  'powerheels-12cm-stiletto-pumps',
  'Pdg-Francenel-product5':  'winterboost-boots-ankle-boots',
  'Pdg-Francenel-product6':  'colorstilettos-vibrant-stiletto-flip-flops',
  'Pdg-Francenel-product7':  'nightchic-dress-mock-neck-long-sleeve-printed',
  'Pdg-Francenel-product8':  'slitlux-dress-cutout-slit-round-neck',
  'Pdg-Francenel-product9':  'plaidoverall-dress-wide-strap-dungaree',
  'Pdg-Francenel-product10': 'floralflounce-dress-surplice-flounce-sleeve-maxi',
  'Pdg-Francenel-product11': 'vintagesquare-dress-printed-square-neck',
  'Pdg-Francenel-product12': 'paisleybelt-dress-orange-floral-print-belted',
  'Pdg-Francenel-product13': 'meshduo-set-sheer-mesh-long-dress-suit',
  'Pdg-Francenel-product14': 'meshglam-dress-solid-color-stitching-maxi',
  'Pdg-Francenel-product15': 'linenbreeze-dress-cotton-linen-button-down',
  'Pdg-Francenel-product16': 'stripedmini-dress-vneck-long-sleeve',
  'Pdg-Francenel-product17': 'loungerobe-loose-sleepwear-bathrobe',
  'Pdg-Francenel-product18': 'lacenight-dress-sexy-short-strap-lace-nightdress',
  'Pdg-Francenel-product19': 'lacethong-set-sheer-lace-skirt-lingerie',
  'Pdg-Francenel-product20': 'solidsexy-bikini-high-waist-hot-swimsuit',
  'Pdg-Francenel-product21': 'curvebikini-solid-color-high-waist-swimwear',
  'Pdg-Francenel-product22': 'leopardnight-set-mesh-pajama-lingerie-dress',
  'Pdg-Francenel-product23': 'supportbra-large-cup-breathable-mesh-bra',
  'Pdg-Francenel-product24': 'laceromper-jumpsuit-lace-splicing-thong',
  'Pdg-Francenel-product25': 'stripedbikini-print-striped-swimwear',
  'Pdg-Francenel-product26': 'tubebikinii-tube-top-swimsuit',
  'Pdg-Francenel-product27': 'ruffleone-bikini-vneck-ruffled-one-piece',
  'Pdg-Francenel-product28': 'bandagebikini-solid-color-bandage-swimsuit',
  'Pdg-Francenel-product29': 'contrastone-piece-contrasting-color-swimwear',
  'Pdg-Francenel-product30': 'premiumbikini-plus-size-swimsuit-collection',
  'Pdg-Francenel-product31': 'irregulartop-loose-round-neck-irregular-hem',
  'Pdg-Francenel-product32': 'christmassweat-casual-holiday-sweatshirt',
  'Pdg-Francenel-product33': 'dalmationshorts-high-waist-dalmatian-print',
  'Pdg-Francenel-product34': 'leopardshirt-irregular-collar-spliced-blouse',
  'Pdg-Francenel-product35': 'drawstringpants-casual-pants-with-pockets',
  'Pdg-Francenel-product36': 'cropslimpants-mens-drawstring-cropped-pants',
  'Pdg-Francenel-product37': 'haremprints-printed-harem-trousers-men',
  'Pdg-Francenel-product38': 'loosejeans-mens-relaxed-fit-denim',
  'Pdg-Francenel-product39': 'britishloafers-formal-tassel-party-shoes-men',
  'Pdg-Francenel-product40': 'airmesh-runners-professional-sports-sneakers-men',
  'Pdg-Francenel-product41': 'leathercasuals-mens-breathable-flat-sneakers',
  'Pdg-Francenel-product42': 'businessdress-shoes-classic-wedding-formal',
  'Pdg-Francenel-product43': 'hollowsneakers-mesh-big-size-fashion-shoes-men',
  'Pdg-Francenel-product44': 'tendtrainers-mens-outdoor-sport-sneakers',
  'Pdg-Francenel-product45': 'patentloafers-luxury-patent-leather-party-shoes',
  'Pdg-Francenel-product46': 'collarshirt-mens-plus-size-button-down',
  'Pdg-Francenel-product47': 'geopolo-shirt-geometric-print-men-polo',
  'Pdg-Francenel-product48': 'stripedcollar-sweater-mens-casual-knit',
  'Pdg-Francenel-product49': 'turtlenecklux-mens-plus-size-turtleneck-sweater',
  'Pdg-Francenel-product50': 'hikejacket-waterproof-outdoor-jacket',
  'Pdg-Francenel-product51': 'roundneck-sweatshirt-mens-plus-size-pullover',
  'Pdg-Francenel-product52': 'nailbond-glue-strong-uv-nail-tips-adhesive',
  'Pdg-Francenel-product53': 'bownails-manicure-long-almond-fake-nails',
  'Pdg-Francenel-product54': 'nailrepair-lotion-nourishing-nail-solution',
  'Pdg-Francenel-product55': 'browdye-pencil-waterproof-quick-dry-eyebrow',
  'Pdg-Francenel-product56': 'curl-volume-mascara-4d-waterproof-formula',
  'Pdg-Francenel-product57': 'browkit-pro-waterproof-eyebrow-stencil-cream',
  'Pdg-Francenel-product58': 'obsidian-lip-balm-warming-moisture-treatment',
  'Pdg-Francenel-product59': 'tearoff-lip-gloss-4-color-long-lasting-peel',
  'Pdg-Francenel-product60': 'gingerclean-pads-ginger-lemon-makeup-remover',
  'Pdg-Francenel-product61': 'deeprepair-hair-mask-moisturizing-smoothing',
  'Pdg-Francenel-product62': 'batanaglow-oil-moisturizing-hair-care',
  'Pdg-Francenel-product63': 'batanaboost-oil-120ml-hair-growth-conditioner',
  'Pdg-Francenel-product64': 'poreclean-gel-deep-exfoliating-anti-acne',
  'Pdg-Francenel-product65': 'knucklewhite-serum-hand-joint-skin-brightener',
  'Pdg-Francenel-product66': 'propolis-glow-essence-brightening-facial-serum',
  'Pdg-Francenel-product67': 'menglow-cream-concealing-brightening-lazy-cream',
  'Pdg-Francenel-product68': 'iceglow-grid-set-silicone-facial-cooling-tool',
  'Pdg-Francenel-product69': 'glamsatin-dress-black-halter-ruched-maxi',
  'Pdg-Francenel-product70': 'powersuit-ivory-structured-skirt-suit',
  'Pdg-Francenel-product71': 'bohofloral-maxi-wrap-floral-bishop-sleeve-dress',
  'Pdg-Francenel-product72': 'cozylounge-set-cream-tank-beige-wide-leg',
  'Pdg-Francenel-product73': 'blushlace-gown-lace-cap-sleeve-empire-maxi',
  'Pdg-Francenel-product74': 'tealempire-gown-sleeveless-vneck-formal-maxi',
  'Pdg-Francenel-product75': 'jacquardpower-suit-multicolor-floral-brocade',
  'Pdg-Francenel-product76': 'patchlace-flats-leisure-patchwork-shoelace-sneakers',
  'Pdg-Francenel-product77': 'warmstep-boots-padded-fur-lined-winter-sneakers',
  'Pdg-Francenel-product78': 'platformwalk-sneakers-vulcanized-plus-size-shoes',
  'Pdg-Francenel-product79': 'stripewrap-bodycon-short-sleeve-bandage-dress',
  'Pdg-Francenel-product80': 'flarefit-dress-spring-flared-sleeve-hip-hugging',
  'Pdg-Francenel-product81': 'officestripe-shirt-dress-patchwork-streetwear-midi',
  'Pdg-Francenel-product82': 'drawshirt-dress-drawstring-shirt-collar-streetwear',
  'Pdg-Francenel-product83': 'autumnvneck-maxi-high-waist-family-matching-dress',
  'Pdg-Francenel-product84': 'beltedbanquet-dress-long-sleeve-printed-high-waist',
  'Pdg-Francenel-product85': 'woventassel-bag-hand-crochet-shoulder-bag',
  'Pdg-Francenel-product86': 'koreantrend-bag-small-messenger-bag',
  'Pdg-Francenel-product87': 'blocksquare-bag-color-blocked-mini-bag',
  'Pdg-Francenel-product88': 'rattanring-tote-hand-knitted-beach-bag',
  'Pdg-Francenel-product89': 'commutercanvas-tote-multi-pocket-zipper-bag',
  'Pdg-Francenel-product90': 'embroidtote-bag-leather-top-handle-crossbody',
  'Pdg-Francenel-product91': 'texturedmini-bag-japanese-style-hand-bag',
  'Pdg-Francenel-product92': 'retroniche-bag-large-capacity-shoulder-messenger',
  'Pdg-Francenel-product93': 'leopardunderarm-bag-retro-drawstring-crossbody',
  'Pdg-Francenel-product94': 'metalchain-clutch-trendy-evening-party-bag',
  'Pdg-Francenel-product95': 'patterntote-bag-earring-decorated-shoulder-tote',
  'Pdg-Francenel-product96': 'pleatedtwo-piece-solid-color-skirt-set',
  'Pdg-Francenel-product97': 'onepiece-swim-plus-size-solid-swimsuit',
  'Pdg-Francenel-product98': 'gilded-gala-gown-sequin-bodice-tiered-tulle',
  'Pdg-Francenel-product99': 'midnightvelvet-sheath-three-quarter-sleeve-bodycon',
  'Pdg-Francenel-product100': 'velvetwrap-jumpsuit-gold-belt-wide-leg',
  'Pdg-Francenel-product101': 'savannahprint-sundress-tribal-tiered-mini',
  'Pdg-Francenel-product102': 'classictrench-coat-belted-double-breasted',
  'Pdg-Francenel-product103': 'tiefront-sheath-cap-sleeve-wrap-detail',
  'Pdg-Francenel-product104': 'slouchsuede-boots-knee-high-block-heel',
  'Pdg-Francenel-product105': 'velvettailored-blazer-peak-lapel-jacket',
  'Pdg-Francenel-product106': 'colorblockmidi-stripe-detail-sheath-dress',
  'Pdg-Francenel-product107': 'houndstoothtweed-set-button-front-skirt-dress',
  'Pdg-Francenel-product108': 'rufflecascade-sheath-draped-side-detail',
  'Pdg-Francenel-product109': 'tweedshift-dress-cuffed-sleeve-classic',
  'Pdg-Francenel-product110': 'polkadotblouse-set-wide-leg-belted-trouser',
};
// Exposé sur window : un `const` de niveau script n'est visible que dans
// CE fichier — un autre <script> classique séparé (ex: collections.js,
// qui réutilise cette même table pour generer des liens cart_share
// lisibles) ne peut pas résoudre l'identifiant `BBW_WISHLIST_SLUG_MAP`
// sans ce miroir explicite sur window.
window.BBW_WISHLIST_SLUG_MAP = BBW_WISHLIST_SLUG_MAP;

// ================================================================
//   WISHLIST SHARE SYSTEM
// ================================================================
(function initWishlistShare() {

    function buildProductUrl(id) {
        const slug = BBW_WISHLIST_SLUG_MAP[id];
        return slug
            ? window.location.origin + '/bbw4life/' + slug
            : window.location.origin + (typeof window.getProductUrl === 'function' ? window.getProductUrl(id) : '/collections/bbw4life-all-product.html');
    }

    function buildShareUrl() {
        if (!wishlist || wishlist.length === 0) return null;
        const slugs = wishlist.map(id => BBW_WISHLIST_SLUG_MAP[id] || id).join(',');
        return window.location.origin + '/collections/bbw4life-all-product?wishlist_share=' + encodeURIComponent(slugs);
    }

    function buildShareMessage(platform) {
        if (!wishlist || !wishlist.length || !products || !products.length) return null;

        const shareUrl = buildShareUrl();
        const items = wishlist.map(id => {
            const p = products.find(pr => pr.id === id);
            if (!p) return null;
            return { title: p.title, price: p.price, url: buildProductUrl(id) };
        }).filter(Boolean);

        if (!items.length) return null;

        const itemLines = items.map((i, idx) =>
            `(${idx + 1}) *${i.title}* — $${i.price.toFixed(2)}`
        ).join('\n');

        const messages = {
            whatsapp: `👋 Hey! I've been shopping on *BBW4LIFE* and I can't stop adding things to my wishlist 😍\n\nHere are the products I'm absolutely OBSESSED with:\n\n${itemLines}\n\n💫 Click any link to view — they'll be saved in your wishlist automatically!\n\n🛍️ Shop all: ${shareUrl}\n\nBBW4LIFE — Beauty Has No Sizes | bbw4life.com`,
            twitter:  `I just found my new favourite plus-size picks on BBW4LIFE 🔥\n\nCheck out my wishlist — these items are 🤌\n\n${shareUrl}\n\n#BBW4LIFE #CurvyFashion #WishlistGoals`,
            facebook: `💕 Ladies, I found some AMAZING pieces on BBW4LIFE that I need you to see!\n\nI've added them to my wishlist — tap the link to discover them all (they'll be saved for you automatically!) 👇\n\n${shareUrl}`,
            pinterest:`✨ My BBW4LIFE Wishlist — save these gorgeous plus-size picks before they're gone! 🛍️\n\n${shareUrl}`
        };
        // "Copy Link" copie exactement le même message formaté que WhatsApp
        // (liste des produits incluse), pas juste l'URL nue.
        messages.copy = messages.whatsapp;

        return messages[platform] || shareUrl;
    }

    function showShareToast(msg) {
        let toast = document.querySelector('.wishlist-share-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'wishlist-share-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function handleWishlistShare(platform) {
        if (!wishlist || wishlist.length === 0) {
            showShareToast('Your wishlist is empty!');
            return;
        }

        const shareUrl = buildShareUrl();
        const message  = buildShareMessage(platform);

        const urls = {
          whatsapp:  `https://wa.me/?text=${encodeURIComponent(message)}`,
          twitter:   `https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Check out my BBW4LIFE wishlist! 🛍️')}`,
          facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`,
          pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent('My BBW4LIFE wishlist')}`,
          instagram: null
      };

        if (platform === 'copy' || platform === 'instagram') {
        navigator.clipboard.writeText(platform === 'instagram' ? shareUrl : message)
            .then(() => showShareToast(platform === 'instagram' ? '🔗 Link copied! Paste it on Instagram.' : '✅ Link copied to clipboard!'))
            .catch(() => showShareToast('Could not copy. Please copy manually.'));
        return;
    }

        if (urls[platform]) {
            window.open(urls[platform], '_blank', 'noopener,noreferrer,width=600,height=500');
            showShareToast('Opening share window...');
        }
    }

    window.handleWishlistShare = handleWishlistShare;

    document.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-wishlist-share]');
        if (!btn) return;
        e.preventDefault();
        handleWishlistShare(btn.dataset.wishlistShare);
    });

})();

// ================================================================
//   WISHLIST SHARE RECEIVER — lit l'URL et ajoute les produits
// ================================================================
(function initWishlistShareReceiver() {
    const params = new URLSearchParams(window.location.search);
    const sharedSlugs = params.get('wishlist_share');
    if (!sharedSlugs) return;

    const reverseMap = {};
    Object.keys(BBW_WISHLIST_SLUG_MAP).forEach(k => { reverseMap[BBW_WISHLIST_SLUG_MAP[k]] = k; });

    let ids = decodeURIComponent(sharedSlugs).split(',').filter(Boolean);
    ids = ids.map(s => reverseMap[s] || s);

    function addSharedToWishlist() {
        // wishlist/saveWishlist/updateBadges/updateWishlistIcons/renderWishlist
        // vivent dans la closure DOMContentLoaded plus haut dans ce fichier —
        // inaccessibles ici directement (cette IIFE est top-level, hors de
        // cette closure). On écrit donc directement dans localStorage
        // (source de vérité partagée par les deux mondes), PUIS on demande à
        // la closure de relire localStorage et de tout re-render via le pont
        // window.__bbwReloadWishlist — sans ça, le badge peut sembler à jour
        // (mis à jour "à la main" sur une copie) mais la popup wishlist
        // (renderWishlist, qui lit la variable `wishlist` de la closure,
        // jamais synchronisée) reste vide, et un ajout ultérieur dans cette
        // même session écrase silencieusement ce que le lien avait ajouté.
        let wl = [];
        try { wl = JSON.parse(localStorage.getItem('wishlist')) || []; } catch (e) {}
        ids.forEach(id => {
            const exists = products.find(p => p.id === id);
            if (!exists) return;
            if (!wl.includes(id)) {
                wl.push(id);
            }
        });
        localStorage.setItem('wishlist', JSON.stringify(wl));
        if (typeof window.__bbwReloadWishlist === 'function') {
            window.__bbwReloadWishlist();
        } else {
            window.wishlist = wl;
            if (typeof window.updateBadges === 'function') window.updateBadges();
            if (typeof window.updateWishlistIcons === 'function') window.updateWishlistIcons();
        }

        const count = ids.length;
        setTimeout(() => {
            let toast = document.querySelector('.wishlist-share-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'wishlist-share-toast';
                document.body.appendChild(toast);
            }
            toast.innerHTML = `💕 ${count} item${count > 1 ? 's' : ''} added to your wishlist!`;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 4000);

            setTimeout(() => {
                if (typeof openWishlistModal === 'function') openWishlistModal();
            }, 800);
        }, 1200);

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }

    if (products && products.length > 0) {
        addSharedToWishlist();
    } else {
        let tries = 0;
        const wait = setInterval(() => {
            if (products && products.length > 0) {
                clearInterval(wait);
                addSharedToWishlist();
            } else if (++tries > 60) {
                clearInterval(wait);
            }
        }, 100);
    }
})();


  // Reviews carousel in cart
  const reviewsCarouselCart = document.querySelector('.reviews-carousel');
  if (reviewsCarouselCart) {
    const reviewItems = reviewsCarouselCart.querySelectorAll('.review-item');
    let currentReview = 0;
    if (reviewItems.length > 0) {
      reviewItems[currentReview].classList.add('active');
      setInterval(() => {
        reviewItems[currentReview].classList.remove('active');
        currentReview = (currentReview + 1) % reviewItems.length;
        reviewItems[currentReview].classList.add('active');
      }, 5000);
    }
  }

  // ====================== PAUL BANNER ======================
  const paulContainer = document.getElementById('paul-banner');
  if (paulContainer) {
    const paulVideoUrl    = '';
    const paulVideo       = paulContainer.querySelector('.paul-banner-video');
    const paulSoundBtn    = paulContainer.querySelector('.paul-video-sound-toggle');
    const paulVideoWrapper= paulContainer.querySelector('.paul-banner-video-wrapper');
    if (paulVideoUrl) {
      paulVideo.src = paulVideoUrl;
      paulVideoWrapper.style.display = 'block';
      document.querySelectorAll('.paul-banner-image').forEach(img => img.style.display = 'none');
    } else {
      paulVideoWrapper.style.display = 'none';
      paulContainer.classList.add('image-mode');
    }
    if (paulVideo && paulSoundBtn && paulVideoUrl) {
      paulSoundBtn.addEventListener('click', () => { paulVideo.muted = !paulVideo.muted; paulSoundBtn.classList.toggle('muted', paulVideo.muted); });
    }
    const paulSlides     = paulContainer.querySelectorAll('.paul-banner-slide');
    const paulIndicators = paulContainer.querySelectorAll('.paul-banner-indicator');
    if (paulSlides.length > 1) {
      let paulCurrentSlide = 0, paulSlideTimer;
      function paulShowSlide(index) {
        paulSlides.forEach((s, i) => s.classList.toggle('active', i === index));
        paulIndicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
        paulCurrentSlide = index;
      }
      function paulNextSlide() { paulShowSlide((paulCurrentSlide + 1) % paulSlides.length); }
      paulShowSlide(0);
      paulSlideTimer = setInterval(paulNextSlide, 5000);
      paulIndicators.forEach((ind, i) => { ind.addEventListener('click', () => { clearInterval(paulSlideTimer); paulShowSlide(i); paulSlideTimer = setInterval(paulNextSlide, 5000); }); });
      paulContainer.addEventListener('mouseenter', () => clearInterval(paulSlideTimer));
      paulContainer.addEventListener('mouseleave', () => { paulSlideTimer = setInterval(paulNextSlide, 5000); });
    }
  }

  // ====================== FRANCENEL BANNER ======================
  const francenelContainer = document.getElementById('francenel-milliadaire-banner');
  if (francenelContainer) {
    const francVideoUrl    = 'https://cdn.shopify.com/videos/c/o/v/c9fa100b503a449e9a8f120d106f8737.mp4';
    const francVideo       = francenelContainer.querySelector('.francenel-milliadaire-banner-video');
    const francSoundBtn    = francenelContainer.querySelector('.francenel-milliadaire-video-sound-toggle');
    const francVideoWrapper= francenelContainer.querySelector('.francenel-milliadaire-banner-video-wrapper');
    if (francVideoUrl) {
      francVideo.src = francVideoUrl;
      francVideoWrapper.style.display = 'block';
      document.querySelectorAll('.francenel-milliadaire-banner-image').forEach(img => img.style.display = 'none');
    } else {
      francVideoWrapper.style.display = 'none';
      francenelContainer.classList.add('image-mode');
    }
    if (francVideo && francSoundBtn && francVideoUrl) {
      francSoundBtn.addEventListener('click', () => { francVideo.muted = !francVideo.muted; francSoundBtn.classList.toggle('muted', francVideo.muted); });
    }
    const francSlides     = francenelContainer.querySelectorAll('.francenel-milliadaire-banner-slide');
    const francIndicators = francenelContainer.querySelectorAll('.francenel-milliadaire-banner-indicator');
    if (francSlides.length > 1) {
      let francCurrentSlide = 0, francSlideTimer;
      function francShowSlide(index) {
        francSlides.forEach((s, i) => s.classList.toggle('active', i === index));
        francIndicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
        francCurrentSlide = index;
      }
      function francNextSlide() { francShowSlide((francCurrentSlide + 1) % francSlides.length); }
      francShowSlide(0);
      francSlideTimer = setInterval(francNextSlide, 5000);
      francIndicators.forEach((ind, i) => { ind.addEventListener('click', () => { clearInterval(francSlideTimer); francShowSlide(i); francSlideTimer = setInterval(francNextSlide, 5000); }); });
      francenelContainer.addEventListener('mouseenter', () => clearInterval(francSlideTimer));
      francenelContainer.addEventListener('mouseleave', () => { francSlideTimer = setInterval(francNextSlide, 5000); });
    }
  }

  // ================================================================
  //   SHOP HERO BANNER
  // ================================================================
  (function() {
    const heroSlides = [
      'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/banner_1.png?v=1774377685',
      'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/banner_2.png?v=1774377685',
      'https://cdn.shopify.com/s/files/1/0978/0353/4627/files/banner_3.png?v=1774377686'
    ];
    const hero = document.querySelector('.hero-section');
    if (!hero) return;
    heroSlides.forEach((src, i) => {
      const div = document.createElement('div');
      div.className = 'hero-slide' + (i === 0 ? ' active' : '');
      div.style.backgroundImage = `url('${upgradeShopifyImageUrl(src)}')`;
      hero.appendChild(div);
    });
    const thumbsWrap = document.createElement('div');
    thumbsWrap.className = 'hero-thumbnails';
    heroSlides.forEach((src, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'hero-thumb' + (i === 0 ? ' active' : '');
      const img = document.createElement('img'); img.src = upgradeShopifyImageUrl(src); img.alt = 'Slide ' + (i + 1);
      thumb.appendChild(img);
      thumb.addEventListener('click', () => heroGoTo(i));
      thumbsWrap.appendChild(thumb);
    });
    function placeThumbs() {
      const isMobile = window.innerWidth <= 768;
      const bannerContent = document.querySelector('.shop-banner-section .banner-content');
      if (isMobile && bannerContent && !bannerContent.contains(thumbsWrap)) bannerContent.insertBefore(thumbsWrap, bannerContent.firstChild);
      else if (!isMobile && bannerContent && bannerContent.contains(thumbsWrap)) hero.appendChild(thumbsWrap);
      else if (!isMobile && !hero.contains(thumbsWrap)) hero.appendChild(thumbsWrap);
    }
    placeThumbs();
    window.addEventListener('resize', placeThumbs);
    let heroCurrentSlide = 0, heroTimer;
    function heroGoTo(index) {
      const allSlides = hero.querySelectorAll('.hero-slide'), allThumbs = thumbsWrap.querySelectorAll('.hero-thumb');
      allSlides[heroCurrentSlide].classList.remove('active'); allThumbs[heroCurrentSlide].classList.remove('active');
      heroCurrentSlide = index;
      allSlides[heroCurrentSlide].classList.add('active'); allThumbs[heroCurrentSlide].classList.add('active');
      clearInterval(heroTimer);
      heroTimer = setInterval(() => heroGoTo((heroCurrentSlide + 1) % heroSlides.length), 5000);
    }
    heroTimer = setInterval(() => heroGoTo((heroCurrentSlide + 1) % heroSlides.length), 5000);
  })();

  // ====================== ANNOUNCEMENT BAR ======================
  const announcementItems = document.querySelectorAll(".paul-announcement-item");
  let announcementCurrent = 0;
  function showAnnouncementItem(index) {
    announcementItems.forEach((item, i) => item.classList.toggle("active", i === index));
    announcementCurrent = index;
  }
  if (announcementItems.length > 0) setInterval(() => showAnnouncementItem((announcementCurrent + 1) % announcementItems.length), 4000);

  // ====================== AUTO OPEN CART ======================
  if ((window.location.pathname.toLowerCase().includes('bbw4life-all-product.html') || window.location.pathname.toLowerCase().includes('bbw4life-all-product.html')) && localStorage.getItem('autoOpenCart') === 'true') {
    localStorage.removeItem('autoOpenCart');
    setTimeout(() => { if (typeof openCartDrawer === 'function') openCartDrawer(); }, 1200);
  }


  // ====================== PUSH NOTIFICATION → OPEN CART ======================
  (function checkOpenCartFromPush() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openCart') === 'true') {
      setTimeout(() => {
        if (typeof openCartDrawer === 'function') openCartDrawer();
      }, 800);
      params.delete('openCart');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  })();

  (function initHeaderParticles() {
    function create() {
      const header = document.querySelector('.sticky-header');
      if (!header) return;
      const container = document.createElement('div');
      container.className = 'header-particles';
      header.appendChild(container);
      const types = ['type-rose', 'type-gold', 'type-plum', 'type-petal', 'type-star'];
      const count = 22;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'header-particle ' + types[i % types.length];
        const left     = Math.random() * 100;
        const duration = 4 + Math.random() * 6;
        const delay    = Math.random() * 6;
        p.style.cssText = `
          left: ${left}%;
          bottom: 0;
          animation-duration: ${duration}s;
          animation-delay: -${delay}s;
        `;
        container.appendChild(p);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', create);
    } else {
      create();
    }
  })();

});



// ====================== SWATCH SCROLL MOBILE ======================
document.addEventListener('click', function(e) {
  if (e.target.closest('.swatch')) {
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) {
      const settings = (window.__allProducts || []).find(p => p.type === 'settings') || {};
      const swatchScroll = (settings.swatch_scroll_mobile || 'yes').toLowerCase() === 'yes';
      if (swatchScroll) {
        const mediaSlider = document.getElementById('main-image-slider');
        if (mediaSlider) setTimeout(() => { mediaSlider.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
      }
    }
  }
});

// ====================== PAUL AUTH POPUP ======================
document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('paulTrigger');
  const paulPopupOverlay = document.getElementById('paulPopup');
  const closeBtn = document.querySelector('.paul-close');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const goToSignup = document.getElementById('goToSignup');
  const goToLogin  = document.getElementById('goToLogin');
  const goToForgot        = document.getElementById('goToForgot');
  const goToLoginFromForgot = document.getElementById('goToLoginFromForgot');
  const forgotForm        = document.getElementById('forgotForm');
  const paulForgotBtn     = document.getElementById('paul-forgot-btn');
  const pathname = window.location.pathname.toLowerCase();
  const isAccountPage = /account/i.test(pathname);

  // ── FORGOT PASSWORD — état du flux (token de reset reçu par email, si présent) ──
  let pendingResetToken = null;
  function setForgotStep(step) {
    const newPassWrap  = document.getElementById('forgot-new-password')?.closest('.password-input-wrapper');
    const confPassWrap = document.getElementById('forgot-confirm-password')?.closest('.password-input-wrapper');
    const emailInput   = document.getElementById('forgot-email');
    if (step === 'reset') {
      if (newPassWrap)  newPassWrap.style.display  = '';
      if (confPassWrap) confPassWrap.style.display = '';
      if (emailInput)   emailInput.readOnly = true;
    } else {
      if (newPassWrap)  newPassWrap.style.display  = 'none';
      if (confPassWrap) confPassWrap.style.display = 'none';
      if (emailInput)   emailInput.readOnly = false;
    }
  }

  window.showToast = (msg) => {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
  };





  /* ── DEVICE ACCOUNT FLAG — helpers ── */
  function bbwGetDeviceAccountEmail() {
    var fromLS = localStorage.getItem('bbw_device_account_email');
    if (fromLS) return fromLS;
    var match = document.cookie.match(/(?:^|;\s*)bbw_device_account=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  }

  function bbwSetDeviceAccountEmail(email) {
    try { localStorage.setItem('bbw_device_account_email', email); } catch (e) {}
    var expires = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = 'bbw_device_account=' + encodeURIComponent(email) + ';expires=' + expires + ';path=/;SameSite=Lax';
  }

  /* ── ACCOUNT BLOCK POPUP — CSS injecté une seule fois ── */
  (function injectAccountBlockPopupCSS() {
    if (document.getElementById('abp-styles')) return;
    var style = document.createElement('style');
    style.id = 'abp-styles';
    style.textContent = `
      #account-block-popup {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        background: rgba(20,10,15,0.60);
        backdrop-filter: blur(3px);
        opacity: 0; transition: opacity 0.3s ease;
        padding: 20px;
      }
      #account-block-popup.abp-visible { opacity: 1; }
      .abp-modal {
        position: relative;
        width: 100%;
        max-width: 360px;
        background: #fffdf9;
        border-radius: 18px;
        padding: 30px 26px 24px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(192,56,94,0.28);
        transform: scale(0.9) translateY(10px);
        transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        overflow: hidden;
      }
      #account-block-popup.abp-visible .abp-modal { transform: scale(1) translateY(0); }
      .abp-close {
        position: absolute; top: 12px; right: 12px;
        width: 28px; height: 28px; border-radius: 50%;
        background: #f5eaea; border: none; color: #7b3f6e;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: background 0.2s;
        z-index: 2;
      }
      .abp-close:hover { background: #eddede; }
      .abp-icon-wrap {
        width: 60px; height: 60px; margin: 0 auto 16px;
        border-radius: 50%;
        background: linear-gradient(135deg,#fff3e0,#fde3e3);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.8rem;
        border: 2px solid rgba(192,56,94,0.15);
      }
      .abp-title {
        font-size: 1.16rem; font-weight: 800; color: #7b3f6e;
        margin: 0 0 10px;
      }
      .abp-text {
        font-size: 0.88rem; color: #6b5560; line-height: 1.6;
        margin: 0 0 22px;
      }
      .abp-btn {
        display: inline-flex; align-items: center; justify-content: center;
        gap: 8px;
        width: 100%;
        background: linear-gradient(135deg,#c0385e,#7b3f6e);
        color: #fff; font-weight: 700; font-size: 0.90rem;
        padding: 13px 18px; border-radius: 30px;
        text-decoration: none;
        box-shadow: 0 6px 16px rgba(192,56,94,0.35);
        transition: transform 0.2s, box-shadow 0.2s;
        border: none; cursor: pointer;
        box-sizing: border-box;
      }
      .abp-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(192,56,94,0.45); }
      @media (max-width: 420px) {
        .abp-modal { max-width: 310px; padding: 26px 20px 20px; }
      }
    `;
    document.head.appendChild(style);
  })();

  /* ── ACCOUNT BLOCK POPUP — fonction d'affichage ── */
  window.showAccountBlockPopup = function (type) {
    var existing = document.getElementById('account-block-popup');
    if (existing) existing.remove();

    var CONTENT = {
      duplicate_email: {
        icon:  '⚠️',
        title: 'Account Already Exists',
        text:  'Dear customer, this email address already exists in our records. Please log in to access your account instead of creating a new one.',
        btn:   'Log In Now'
      },
      device_limit: {
        icon:  '⚠️',
        title: 'Account Limit Reached',
        text:  'Dear customer, an account has already been created from this device. For security reasons, only one account is allowed per device. Please log in with your existing account.',
        btn:   'Log In Now'
      }
    };

    var cfg = CONTENT[type] || CONTENT.duplicate_email;

    var overlay = document.createElement('div');
    overlay.id = 'account-block-popup';
    overlay.innerHTML =
      '<div class="abp-modal">' +
        '<button class="abp-close" id="abp-close-btn" aria-label="Close">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>' +
        '<div class="abp-icon-wrap">' + cfg.icon + '</div>' +
        '<h3 class="abp-title">' + cfg.title + '</h3>' +
        '<p class="abp-text">' + cfg.text + '</p>' +
        '<button type="button" class="abp-btn" id="abp-login-btn">' +
          '<i class="fi fi-rr-sign-in-alt"></i> ' + cfg.btn +
        '</button>' +
      '</div>';
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('abp-visible'); });
    });

    function closeAbp() {
      overlay.classList.remove('abp-visible');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }

    document.getElementById('abp-login-btn').addEventListener('click', function () {
      closeAbp();
      var signupForm = document.getElementById('signupForm');
      var loginForm  = document.getElementById('loginForm');
      if (signupForm) signupForm.style.display = 'none';
      if (loginForm)  loginForm.style.display  = 'block';
    });

    document.getElementById('abp-close-btn').addEventListener('click', closeAbp);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAbp();
    });
  };





  /* ── EMAIL CONFIRM POPUP — CSS injecté une seule fois ── */
  (function injectEmailConfirmPopupCSS() {
    if (document.getElementById('ecp-styles')) return;
    var style = document.createElement('style');
    style.id = 'ecp-styles';
    style.textContent = `
      #email-confirm-popup {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        background: rgba(20,10,15,0.55);
        backdrop-filter: blur(3px);
        opacity: 0; transition: opacity 0.3s ease;
        padding: 20px;
      }
      #email-confirm-popup.ecp-visible { opacity: 1; }
      .ecp-modal {
        position: relative;
        width: 100%;
        max-width: 340px;
        background: #fffdf9;
        border-radius: 18px;
        padding: 28px 24px 22px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(192,56,94,0.25);
        transform: scale(0.9) translateY(10px);
        transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        overflow: hidden;
      }
      #email-confirm-popup.ecp-visible .ecp-modal { transform: scale(1) translateY(0); }
      .ecp-close {
        position: absolute; top: 12px; right: 12px;
        width: 28px; height: 28px; border-radius: 50%;
        background: #f5eaea; border: none; color: #7b3f6e;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: background 0.2s;
        z-index: 2;
      }
      .ecp-close:hover { background: #eddede; }
      .ecp-icon-wrap {
        width: 56px; height: 56px; margin: 0 auto 14px;
        border-radius: 50%;
        background: linear-gradient(135deg,#fdf1e7,#fbe6ec);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.6rem;
      }
      .ecp-title {
        font-size: 1.12rem; font-weight: 800; color: #7b3f6e;
        margin: 0 0 8px;
      }
      .ecp-text {
        font-size: 0.86rem; color: #6b5560; line-height: 1.5;
        margin: 0 0 20px;
      }
      .ecp-btn {
        display: inline-flex; align-items: center; justify-content: center;
        gap: 8px;
        width: 100%;
        background: linear-gradient(135deg,#c0385e,#7b3f6e);
        color: #fff; font-weight: 700; font-size: 0.88rem;
        padding: 12px 18px; border-radius: 30px;
        text-decoration: none;
        box-shadow: 0 6px 16px rgba(192,56,94,0.35);
        transition: transform 0.2s, box-shadow 0.2s;
        border: none; cursor: pointer;
        box-sizing: border-box;
      }
      .ecp-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(192,56,94,0.45); }
      .ecp-progress {
        margin-top: 16px; height: 3px; width: 100%;
        background: #f1e6ea; border-radius: 3px; overflow: hidden;
      }
      .ecp-progress-fill {
        height: 100%; width: 100%;
        background: linear-gradient(90deg,#c9963e,#c0385e);
      }
      @media (max-width: 420px) {
        .ecp-modal { max-width: 300px; padding: 24px 18px 20px; }
      }
    `;
    document.head.appendChild(style);
  })();

  /* ── EMAIL CONFIRM POPUP — fonction d'affichage ── */
  window.showEmailConfirmPopup = function (email) {
    var existing = document.getElementById('email-confirm-popup');
    if (existing) existing.remove();

    function getWebmailUrl(mail) {
      if (!mail || mail.indexOf('@') === -1) return 'https://mail.google.com';
      var domain = mail.split('@')[1].toLowerCase();
      var map = {
        'gmail.com':      'https://mail.google.com',
        'googlemail.com': 'https://mail.google.com',
        'yahoo.com':      'https://mail.yahoo.com',
        'yahoo.fr':       'https://mail.yahoo.com',
        'outlook.com':    'https://outlook.live.com/mail/0/inbox',
        'hotmail.com':    'https://outlook.live.com/mail/0/inbox',
        'live.com':       'https://outlook.live.com/mail/0/inbox',
        'msn.com':        'https://outlook.live.com/mail/0/inbox',
        'icloud.com':     'https://www.icloud.com/mail',
        'me.com':         'https://www.icloud.com/mail',
        'aol.com':        'https://mail.aol.com'
      };
      return map[domain] || ('https://' + domain);
    }

    var webmailUrl = getWebmailUrl(email);

    var overlay = document.createElement('div');
    overlay.id = 'email-confirm-popup';
    overlay.innerHTML =
      '<div class="ecp-modal">' +
        '<button class="ecp-close" id="ecp-close-btn" aria-label="Close">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>' +
        '<div class="ecp-icon-wrap">📧</div>' +
        '<h3 class="ecp-title">Confirm Your Email</h3>' +
        '<p class="ecp-text">Please confirm your email before logging in.<br>Check your inbox for the confirmation link.</p>' +
        '<button type="button" class="ecp-btn" id="ecp-open-mail-btn">' +
          '<i class="fi fi-rr-envelope"></i> Go to My Email' +
        '</button>' +
        '<div class="ecp-progress"><div class="ecp-progress-fill" id="ecp-progress-fill"></div></div>' +
      '</div>';
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('ecp-visible'); });
    });

    var fill = document.getElementById('ecp-progress-fill');
    if (fill) {
      requestAnimationFrame(function () {
        fill.style.transition = 'width 10s linear';
        fill.style.width = '0%';
      });
    }

    var autoTimer = setTimeout(closeEcp, 10000);

    function closeEcp() {
      clearTimeout(autoTimer);
      overlay.classList.remove('ecp-visible');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }

    // Ouvre directement l'inbox (jamais un écran de rédaction), sur mobile comme sur desktop
    document.getElementById('ecp-open-mail-btn').addEventListener('click', function () {
      window.open(webmailUrl, '_blank', 'noopener,noreferrer');
    });

    document.getElementById('ecp-close-btn').addEventListener('click', closeEcp);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeEcp();
    });
  };

  /* ── PASSWORD RESET POPUP — CSS injecté une seule fois ──
     Réutilise les classes .ecp-modal / .ecp-icon-wrap / .ecp-title / .ecp-text / .ecp-btn /
     .ecp-progress / .ecp-progress-fill déjà injectées ci-dessus par injectEmailConfirmPopupCSS().
     Seules les règles propres à l'ID de cet overlay (position/fond/opacité) doivent être redéclarées. */
  (function injectPasswordResetPopupCSS() {
    if (document.getElementById('prp-styles')) return;
    var style = document.createElement('style');
    style.id = 'prp-styles';
    style.textContent = `
      #password-reset-popup {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        background: rgba(20,10,15,0.55);
        backdrop-filter: blur(3px);
        opacity: 0; transition: opacity 0.3s ease;
        padding: 20px;
      }
      #password-reset-popup.ecp-visible { opacity: 1; }
      #password-reset-popup.ecp-visible .ecp-modal { transform: scale(1) translateY(0); }
    `;
    document.head.appendChild(style);
  })();

  /* ── PASSWORD RESET POPUP — fonction d'affichage ──
     found === true  → email trouvé, lien envoyé.
     found === false → aucun compte trouvé pour cet email. */
  window.showPasswordResetPopup = function (found, email) {
    var existing = document.getElementById('password-reset-popup');
    if (existing) existing.remove();

    function getWebmailUrl(mail) {
      if (!mail || mail.indexOf('@') === -1) return 'https://mail.google.com';
      var domain = mail.split('@')[1].toLowerCase();
      var map = {
        'gmail.com':      'https://mail.google.com',
        'googlemail.com': 'https://mail.google.com',
        'yahoo.com':      'https://mail.yahoo.com',
        'yahoo.fr':       'https://mail.yahoo.com',
        'outlook.com':    'https://outlook.live.com/mail/0/inbox',
        'hotmail.com':    'https://outlook.live.com/mail/0/inbox',
        'live.com':       'https://outlook.live.com/mail/0/inbox',
        'msn.com':        'https://outlook.live.com/mail/0/inbox',
        'icloud.com':     'https://www.icloud.com/mail',
        'me.com':         'https://www.icloud.com/mail',
        'aol.com':        'https://mail.aol.com'
      };
      return map[domain] || ('https://' + domain);
    }

    var icon, title, text, actionBtnHTML;
    if (found) {
      icon  = '📩';
      title = 'Check Your Inbox';
      text  = "We've sent you a password reset link. Click it to choose a new password — it expires in 10 minutes.";
      actionBtnHTML =
        '<button type="button" class="ecp-btn" id="prp-open-mail-btn">' +
          '<i class="fi fi-rr-envelope"></i> Open My Email' +
        '</button>';
    } else {
      icon  = '🔍';
      title = 'No Account Found';
      text  = "We couldn't find a BBW4LIFE account with this email address. Please check the spelling, or sign up to join us.";
      actionBtnHTML =
        '<button type="button" class="ecp-btn" id="prp-ok-btn">Got It</button>';
    }

    var overlay = document.createElement('div');
    overlay.id = 'password-reset-popup';
    overlay.innerHTML =
      '<div class="ecp-modal">' +
        '<button class="ecp-close" id="prp-close-btn" aria-label="Close">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>' +
        '<div class="ecp-icon-wrap">' + icon + '</div>' +
        '<h3 class="ecp-title">' + title + '</h3>' +
        '<p class="ecp-text">' + text + '</p>' +
        actionBtnHTML +
        '<div class="ecp-progress"><div class="ecp-progress-fill" id="prp-progress-fill"></div></div>' +
      '</div>';
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('ecp-visible'); });
    });

    var fill = document.getElementById('prp-progress-fill');
    if (fill) {
      requestAnimationFrame(function () {
        fill.style.transition = 'width 8s linear';
        fill.style.width = '0%';
      });
    }

    var autoTimer = setTimeout(closePrp, 8000);

    function closePrp() {
      clearTimeout(autoTimer);
      overlay.classList.remove('ecp-visible');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }

    var openMailBtn = document.getElementById('prp-open-mail-btn');
    if (openMailBtn) {
      openMailBtn.addEventListener('click', function () {
        window.open(getWebmailUrl(email), '_blank', 'noopener,noreferrer');
      });
    }
    var okBtn = document.getElementById('prp-ok-btn');
    if (okBtn) okBtn.addEventListener('click', closePrp);

    document.getElementById('prp-close-btn').addEventListener('click', closePrp);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePrp();
    });
  };



  /* ── EMAIL CONFIRMATION HANDLER (lien reçu par email) ── */
  if (isAccountPage) {
    const urlParams   = new URLSearchParams(window.location.search);
    const confirmTok  = urlParams.get('confirm_token');
    const confirmMail = urlParams.get('email');
    if (confirmTok && confirmMail) {
      fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm-account', email: confirmMail, confirmToken: confirmTok })
      })
      .then(r => r.json())
      .then(data => {
        window.history.replaceState({}, '', '/account.html');
        if (data.success) {
          window.showToast("Your email has been confirmed! Please log in. ✅");
        } else {
          window.showToast("This confirmation link is invalid or expired.");
        }
      })
      .catch(() => {
        window.history.replaceState({}, '', '/account.html');
      });
    }
  }

  /* ── PASSWORD RESET LINK HANDLER (lien reçu par email) ── */
  if (isAccountPage) {
    const resetParams = new URLSearchParams(window.location.search);
    const resetTok  = resetParams.get('reset_token');
    const resetMail = resetParams.get('email');
    if (resetTok && resetMail) {
      pendingResetToken = resetTok;
      if (paulPopupOverlay) paulPopupOverlay.classList.add('active');
      if (loginForm)  loginForm.style.display  = 'none';
      if (signupForm) signupForm.style.display = 'none';
      if (forgotForm) forgotForm.style.display = 'block';
      setForgotStep('reset');
      const emailField = document.getElementById('forgot-email');
      if (emailField) emailField.value = resetMail;
      const errEl = document.getElementById('forgot-error-msg');
      const sucEl = document.getElementById('forgot-success-msg');
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      if (sucEl) { sucEl.textContent = ''; sucEl.style.display = 'none'; }
    }
  }

  window.openAccountPopup = (id) => {
    const popup = document.getElementById(id);
    if (popup) popup.classList.add('open');
    if (id === 'address-popup') {
      document.getElementById('addr-email').value = localStorage.getItem('userEmail') || '';
      document.getElementById('addr-first').value = localStorage.getItem('userFirstName') || '';
      document.getElementById('addr-last').value  = localStorage.getItem('userLastName') || '';
      document.getElementById('addr-line1').value = localStorage.getItem('userAddressLine1') || '';
      document.getElementById('addr-line2').value = localStorage.getItem('userLine2') || '';
      document.getElementById('addr-city').value  = localStorage.getItem('userCity') || '';
      document.getElementById('addr-state').value = localStorage.getItem('userState') || '';
      document.getElementById('addr-zip').value   = localStorage.getItem('userZip') || '';
    }

    if (id === 'password-popup') {
    const secEmail = document.getElementById('security-email');
    if (secEmail) secEmail.value = localStorage.getItem('userEmail') || '';
  }
  };
  window.closeAccountPopup = (id) => { const popup = document.getElementById(id); if (popup) popup.classList.remove('open'); };

  function openPaulPopup() {
    if (!paulPopupOverlay || !loginForm || !signupForm) return;
    paulPopupOverlay.classList.add('active');
    loginForm.style.display = 'block'; signupForm.style.display = 'none';
}
  function closePaulPopup() {
    if (isAccountPage) return;
    if (paulPopupOverlay) paulPopupOverlay.classList.remove('active');
  }

  if (trigger) { trigger.addEventListener('click', (e) => { e.preventDefault(); if (localStorage.getItem('isLoggedIn') === 'true') window.location.href = '/account.html'; else openPaulPopup(); }); }
  if (closeBtn) closeBtn.addEventListener('click', closePaulPopup);
  if (paulPopupOverlay) paulPopupOverlay.addEventListener('click', (e) => { if (e.target === paulPopupOverlay && !isAccountPage) closePaulPopup(); });
  if (goToSignup) goToSignup.addEventListener('click', () => { loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
  if (goToLogin)  goToLogin.addEventListener('click',  () => { signupForm.style.display = 'none'; loginForm.style.display = 'block'; });
  if (goToForgot) goToForgot.addEventListener('click', () => {
    loginForm.style.display  = 'none';
    signupForm.style.display = 'none';
    if (forgotForm) forgotForm.style.display = 'block';
    pendingResetToken = null;
    setForgotStep('request');
    const emailField = document.getElementById('forgot-email');
    if (emailField) emailField.value = '';
    const errEl = document.getElementById('forgot-error-msg');
    const sucEl = document.getElementById('forgot-success-msg');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (sucEl) { sucEl.textContent = ''; sucEl.style.display = 'none'; }
  });

  if (goToLoginFromForgot) goToLoginFromForgot.addEventListener('click', () => {
    if (forgotForm) forgotForm.style.display = 'none';
    loginForm.style.display = 'block';
    pendingResetToken = null;
    setForgotStep('request');
  });

  document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const input = document.getElementById(this.getAttribute('data-target'));
      if (!input) return;
      const icon = this.querySelector('i');
      if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fi-sr-eye', 'fi-sr-eye-crossed'); }
      else { input.type = 'password'; icon.classList.replace('fi-sr-eye-crossed', 'fi-sr-eye'); }
    });
  });

  // REGISTER
  const registerBtn = document.querySelector('.paul-btn-register');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const lastName   = signupForm.querySelector('input[placeholder="Last Name"]').value.trim();
      const firstName  = signupForm.querySelector('input[placeholder="First Name"]').value.trim();
      const email      = signupForm.querySelector('input[placeholder="Email"]').value.trim();
      const phone      = signupForm.querySelector('input[placeholder="Phone (optional)"]').value.trim();
      const password   = signupForm.querySelector('input[placeholder*="Password"], input[type="password"], #signup-password').value.trim();
      const newsletter = signupForm.querySelector('input[type="checkbox"]').checked ? "Yes" : "No";
      if (!password) return window.showToast("Password is required");

      // ── Restriction "un seul compte par appareil" ──
      const settingsNow   = (window.__allProducts || []).find(p => p.type === 'settings') || {};
      const allowMultiple = ((settingsNow.account_restrictions || {}).allow_multiple_accounts_per_device || 'yes').toLowerCase().trim();
      if (allowMultiple === 'no' && bbwGetDeviceAccountEmail()) {
        window.showAccountBlockPopup('device_limit');
        return;
      }

      const originalText = registerBtn.textContent;
      registerBtn.textContent = "Creating account..."; registerBtn.disabled = true;
      try {
        const res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastName, firstName, email, phone, password, newsletter }) });
        const data = await res.json();
        if (data.success) {
          registerBtn.textContent = "Account created!";
          window.showEmailConfirmPopup(email);
          if (allowMultiple === 'no') {
            bbwSetDeviceAccountEmail(email);
          }
          setTimeout(() => {
            if (paulPopupOverlay) paulPopupOverlay.classList.remove('active');
            if (signupForm) signupForm.reset();
            registerBtn.textContent = originalText;
            registerBtn.disabled = false;
          }, 1500);
        }
        else {
          registerBtn.textContent = originalText; registerBtn.disabled = false;
          if (data.error === 'EMAIL_ALREADY_EXISTS') {
            window.showAccountBlockPopup('duplicate_email');
          } else {
            window.showToast("Error: " + (data.error || "Unknown"));
          }
        }
      } catch (err) { registerBtn.textContent = originalText; registerBtn.disabled = false; window.showToast("Network error"); }
    });
  }


  // ── FORGOT PASSWORD LOGIC ──
  // Étape 1 (pendingResetToken absent) : demande d'envoi d'un lien de reset par email.
  // Étape 2 (pendingResetToken présent, via lien reçu par email) : finalise le nouveau mot de passe.
  if (paulForgotBtn) {
    paulForgotBtn.addEventListener('click', async () => {
      const errEl    = document.getElementById('forgot-error-msg');
      const sucEl    = document.getElementById('forgot-success-msg');
      const emailVal = (document.getElementById('forgot-email')?.value || '').trim();

      // Reset messages
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      if (sucEl) { sucEl.textContent = ''; sucEl.style.display = 'none'; }

      if (!emailVal) {
        if (errEl) { errEl.textContent = 'Please fill in your email.'; errEl.style.display = 'block'; }
        return;
      }
      if (!emailVal.includes('@') || !emailVal.includes('.')) {
        if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; }
        return;
      }

      // ══════════════ ÉTAPE 2 : finalisation avec le token reçu par email ══════════════
      if (pendingResetToken) {
        const newPass  = (document.getElementById('forgot-new-password')?.value || '').trim();
        const confPass = (document.getElementById('forgot-confirm-password')?.value || '').trim();

        if (!newPass || !confPass) {
          if (errEl) { errEl.textContent = 'Please fill in all fields.'; errEl.style.display = 'block'; }
          return;
        }
        if (newPass !== confPass) {
          if (errEl) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; }
          return;
        }
        if (newPass.length < 6) {
          if (errEl) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; }
          return;
        }

        const origText = paulForgotBtn.textContent;
        paulForgotBtn.textContent = 'Updating...';
        paulForgotBtn.disabled = true;

        try {
          const res  = await fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset-password', email: emailVal, newPassword: newPass, resetToken: pendingResetToken })
          });
          const data = await res.json();

          if (data.success) {
            pendingResetToken = null;
            if (window.history?.replaceState) window.history.replaceState({}, '', '/account.html');

            if (sucEl) {
              const ap2 = (window.__allProducts || []).find(p => p.type === 'settings')?.auth_popup || {};
              sucEl.textContent = ap2.forgot_success || 'Password updated! You can now log in.';
              sucEl.style.display = 'block';
            }
            ['forgot-email','forgot-new-password','forgot-confirm-password'].forEach(id => {
              const el = document.getElementById(id);
              if (el) el.value = '';
            });
            // Retour à l'écran de LOGIN après succès
            setTimeout(() => {
              if (forgotForm)  forgotForm.style.display  = 'none';
              if (loginForm)   loginForm.style.display   = 'block';
              if (sucEl) { sucEl.textContent = ''; sucEl.style.display = 'none'; }
              setForgotStep('request');
            }, 2000);
          } else {
            if (errEl) {
              errEl.textContent = data.error === 'INVALID_OR_EXPIRED_TOKEN'
                ? 'This reset link is invalid or has expired. Please request a new one.'
                : (data.error || 'An error occurred. Please try again.');
              errEl.style.display = 'block';
            }
          }
        } catch (err) {
          if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
        } finally {
          paulForgotBtn.textContent = origText;
          paulForgotBtn.disabled = false;
        }
        return;
      }

      // ══════════════ ÉTAPE 1 : demande d'un lien de reset (jamais d'accès direct au formulaire) ══════════════
      const origText = paulForgotBtn.textContent;
      paulForgotBtn.textContent = 'Sending...';
      paulForgotBtn.disabled = true;

      let found = false;
      let rateLimited = false;
      try {
        const res  = await fetch('/.netlify/functions/save-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'request-password-reset', email: emailVal })
        });
        if (res.status === 429) {
          rateLimited = true;
        } else {
          const data = await res.json().catch(() => ({}));
          found = !!data.found;
        }
      } catch (err) {
        // Network error — the popup below will show the "not found" message,
        // which is an acceptable fallback since we can't confirm either way.
      } finally {
        paulForgotBtn.textContent = origText;
        paulForgotBtn.disabled = false;
      }

      if (rateLimited) {
        if (errEl) {
          errEl.textContent = 'Too many attempts — please wait a few minutes and try again.';
          errEl.style.display = 'block';
        }
        return;
      }

      window.showPasswordResetPopup(found, emailVal);
      const emailField = document.getElementById('forgot-email');
      if (emailField) emailField.value = '';
    });
  }

  // LOGIN
  const loginBtn = document.getElementById('paul-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email         = loginForm.querySelector('input[type="email"]').value.trim();
      const passwordInput = loginForm.querySelector('input[placeholder*="Password"], input[type="password"], #login-password');
      const password      = passwordInput ? passwordInput.value.trim() : '';
      if (!email || !password) { window.showToast("Email and password required"); return; }
      const originalText = loginBtn.textContent;
      loginBtn.textContent = "Checking..."; loginBtn.disabled = true;
      try {
        const res  = await fetch('/.netlify/functions/verify-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (data.success) {
          loginBtn.textContent = "Your account Loading...";
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userAccountToken', data.token);
          localStorage.setItem('userFirstName', data.user.firstName);
          localStorage.setItem('userLastName',  data.user.lastName);
          localStorage.setItem('userAddressLine1', data.user.addressLine1 || '');
          localStorage.setItem('userLine2',  data.user.line2  || '');
          localStorage.setItem('userCity',   data.user.city   || '');
          localStorage.setItem('userState',  data.user.state  || '');
          localStorage.setItem('userZip',    data.user.zip    || '');
          const addressStr = [data.user.addressLine1, data.user.line2, data.user.city, data.user.state, data.user.zip].filter(Boolean).join(', ');
          localStorage.setItem('userAddress', addressStr || 'No default address set');

          await new Promise((resolve) => {
            let tries = 0;
            const waitForRestore = setInterval(() => {
              tries++;
              if (typeof window.__bbwRestoreSavedCart === 'function') {
                clearInterval(waitForRestore);
                window.__bbwRestoreSavedCart(email, data.token).then(resolve).catch(resolve);
              } else if (tries > 50) {
                clearInterval(waitForRestore);
                resolve();
              }
            }, 100);
          });

          // Force refresh badge items in cart après restore
          const _qty = (JSON.parse(localStorage.getItem('cart') || '[]')).reduce((s, i) => s + i.quantity, 0);
          const _el = document.querySelector('[data-wishlist-count]');
          if (_el) _el.textContent = _qty;

          window.showToast(`Welcome ${data.user.firstName} !`);
          paulPopupOverlay.classList.remove('active');
          if (isAccountPage) location.reload(); else window.location.href = '/account.html';
        } else {
          loginBtn.textContent = originalText;
          loginBtn.disabled = false;
          if (data.error === 'EMAIL_NOT_CONFIRMED') {
            window.showEmailConfirmPopup(email);
          } else {
            window.showToast("Incorrect email or password");
          }
        }
      } catch (err) { loginBtn.textContent = originalText; loginBtn.disabled = false; window.showToast("Network error"); }
    });
  }

  // ACCOUNT PAGE
  if (isAccountPage) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      const hideStyle = document.createElement('style');
      hideStyle.innerHTML = `
        body > *:not(#paulPopup):not(#password-reset-popup):not(#email-confirm-popup):not(#account-block-popup):not(#toast) { display: none !important; }
        #paulPopup { display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 999999 !important; }
      `;
      document.head.appendChild(hideStyle);
      setTimeout(() => {
        // Ne pas écraser l'écran reset-password déjà affiché par le handler
        // de lien email (pendingResetToken) — sinon loginForm et forgotForm
        // restent visibles en même temps, superposés.
        if (!pendingResetToken) openPaulPopup();
        if (paulPopupOverlay) paulPopupOverlay.classList.add('active');
        const closeBtnPopup = document.querySelector('.paul-close');
        if (closeBtnPopup) {
          closeBtnPopup.style.pointerEvents = 'none';
          closeBtnPopup.style.opacity = '0.3';
          closeBtnPopup.title = 'You must log in to access your account';
        }
      }, 100);
      return;
    }
    document.getElementById('user-full-name').textContent = `${localStorage.getItem('userFirstName') || ''} ${localStorage.getItem('userLastName') || ''}`;
    document.getElementById('user-email').textContent = localStorage.getItem('userEmail') || '';
    const firstName = localStorage.getItem('userFirstName') || '';
    document.getElementById('user-name').textContent = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    document.getElementById('user-address').textContent = localStorage.getItem('userAddress') || 'No default address set';
      // ── Charger la photo de profil
      loadProfilePhoto();
      setTimeout(loadAccountStats, 3000);
  }

  window.openSavedItems = () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
      showToast("Please log in to view your saved items");
      return;
    }
    localStorage.setItem('autoOpenCart', 'true');
    window.location.href = '/collections/bbw4life-all-product.html';
  };

  async function loadAccountStats() {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('userAccountToken');
    if (!email) return;
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats', email, token })
      });
      const data = await res.json();

      const memberSinceEl = document.getElementById('member-since');
      if (memberSinceEl) memberSinceEl.textContent = `Member since ${data.memberSince || 'January 2026'}`;
      const points = data.points || 0;
      let levelText = 'Basic Member';
      if (points >= 100 && points < 200) levelText = 'Member pro';
      else if (points >= 200) levelText = 'Member super pro';
      const levelEl = document.getElementById('membership-level');
      const pointsEl = document.getElementById('membership-points');
      if (levelEl) levelEl.textContent = levelText;
      if (pointsEl) pointsEl.textContent = `${points} pts`;
      // ── Afficher la photo de profil si présente
      if (data.profilePhoto) {
        localStorage.setItem('userProfilePhoto', data.profilePhoto);
        loadProfilePhoto();
      }

      if (data.addressLine1 !== undefined) localStorage.setItem('userAddressLine1', data.addressLine1 || '');
      if (data.line2  !== undefined) localStorage.setItem('userLine2',  data.line2  || '');
      if (data.city   !== undefined) localStorage.setItem('userCity',   data.city   || '');
      if (data.state  !== undefined) localStorage.setItem('userState',  data.state  || '');
      if (data.zip    !== undefined) localStorage.setItem('userZip',    data.zip    || '');

      const addressStr2 = [data.addressLine1, data.line2, data.city, data.state, data.zip].filter(Boolean).join(', ');
      if (addressStr2) {
        localStorage.setItem('userAddress', addressStr2);
        const addrEl = document.getElementById('user-address');
        if (addrEl) addrEl.textContent = addressStr2;
      }

      console.log(`✅ Stats loaded - Reviews Written = ${data.reviewsCount}`);

      const statValues = document.querySelectorAll('.membership-stats-grid .stat-value');
      if (statValues.length >= 3) {
        statValues[0].textContent = data.orders || 0;
        statValues[1].textContent = `$${(data.totalSpent || 0).toFixed(2)}`;
        statValues[3].textContent = data.reviewsCount || 0;
      }


      // ── Restaurer le cart sauvegardé depuis le sheet ──
        if (data.savedCart && data.savedCart !== '[]') {
          let savedCart = [];
          try { savedCart = JSON.parse(data.savedCart); } catch(e) {}
          if (Array.isArray(savedCart) && savedCart.length > 0) {
            let localCart = [];
            try { localCart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch(e) {}
            savedCart.forEach(function(savedItem) {
              const existing = localCart.find(i => i.id === savedItem.id && i.color === savedItem.color && i.size === savedItem.size);
              if (existing) {
                existing.quantity = Math.max(existing.quantity, savedItem.quantity);
              } else {
                localCart.push(savedItem);
              }
            });
            if (typeof window.__setCart === 'function') window.__setCart(localCart);
            else localStorage.setItem('cart', JSON.stringify(localCart));
            if (typeof window.updateBadges === 'function') window.updateBadges();
          }
        }
        const localCartQty = (JSON.parse(localStorage.getItem('cart') || '[]')).reduce((sum, i) => sum + i.quantity, 0);
        const cartCountEl = document.querySelector('[data-wishlist-count]');
        if (cartCountEl) cartCountEl.textContent = localCartQty;
     

      const historyContainer = document.querySelector('.order-history');
      if (!historyContainer) {
        console.warn("⚠️ .order-history not found in DOM");
        return;
      }

      if (data.history && Array.isArray(data.history) && data.history.length > 0) {

        function resolveColor(item, prods) {
          if (item.color && item.color !== 'N/A' && item.color.trim() !== '') return item.color.trim();
          if (item.description && typeof item.description === 'string') {
            const part = item.description.split('|')[0].trim();
            if (part && part !== 'N/A' && part !== '') return part;
          }
          const vidToFind = item.sku || item.cj_variant_id || item.vid || '';
          const productId = item.id || item.product_id || '';
          if (vidToFind && prods && prods.length > 0) {
            const product = prods.find(p => String(p.id) === String(productId));
            if (product && product.variants) {
              const variant = product.variants.find(v => String(v.vid) === String(vidToFind));
              if (variant && variant.color) return variant.color;
            }
          }
          const fallback = item.variant_color || item.variant_name || '';
          if (fallback && fallback !== 'N/A') return fallback;
          return '';
        }

       function getUrlFromId(productId) {
          if (!productId) return null;
          const prods = (window.__allProducts || []).filter(p => !p.type);
          const idx = prods.findIndex(p => 
            String(p.id).trim() === String(productId).trim()
          );
          if (idx === -1) return null;
          return `/products/product${idx + 1}.html`;
        }

        historyContainer.innerHTML = '<h2>Order History</h2>';
        const sorted = [...data.history].reverse();

        sorted.forEach(order => {
          const entry = document.createElement('div');
          entry.className = 'order-entry';

          const orderHeader = document.createElement('div');
          orderHeader.className = 'order-header';
          orderHeader.innerHTML = `<strong>Date: ${order.date}</strong><strong>Total: $${parseFloat(order.total || 0).toFixed(2)}</strong>`;
          entry.appendChild(orderHeader);

          const orderQty = document.createElement('p');
          orderQty.innerHTML = `<strong>Total quantity:</strong> ${order.totalQuantity || 0} item(s)`;
          entry.appendChild(orderQty);

          const orderItemsDiv = document.createElement('div');
          orderItemsDiv.className = 'order-items';

          order.items.forEach(item => {
            const itemId = item.product_id || item.id || item.cj_product_id || '';
            const prods = window.__allProducts || [];
            const resolvedColor = resolveColor(item, prods);

            const itemEl = document.createElement('div');
            itemEl.className = 'order-item-clickable';
            itemEl.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #eee;';

            if (item.image_variant) {
              const img = document.createElement('img');
              img.src = item.image_variant;
              img.className = 'order-item-image';
              img.style.cursor = 'pointer';
              itemEl.appendChild(img);
            }

            const infoDiv = document.createElement('div');

            const titleEl = document.createElement('strong');
            titleEl.className = 'order-item-title';
            titleEl.style.cursor = 'pointer';
            titleEl.textContent = item.title;
            infoDiv.appendChild(titleEl);
            infoDiv.appendChild(document.createElement('br'));

            const colorSpan = document.createElement('span');
            colorSpan.className = 'item-color-line';
            colorSpan.dataset.itemId = itemId;
            colorSpan.dataset.sku = item.sku || '';
            colorSpan.dataset.variantId = item.cj_variant_id || item.vid || '';
            colorSpan.dataset.description = item.description || '';
            colorSpan.dataset.directColor = item.color || '';

            if (resolvedColor) {
              colorSpan.innerHTML = `Color: <strong>${resolvedColor}</strong>`;
            }
            infoDiv.appendChild(colorSpan);
            infoDiv.appendChild(document.createElement('br'));

            const priceSpan = document.createElement('span');
            priceSpan.textContent = `Price: $${parseFloat(item.price || 0).toFixed(2)} × ${item.quantity}`;
            infoDiv.appendChild(priceSpan);

            itemEl.appendChild(infoDiv);
            orderItemsDiv.appendChild(itemEl);

            itemEl.style.cursor = 'pointer';
            itemEl.querySelectorAll('*').forEach(function(child) {
              child.style.pointerEvents = 'none';
            });
            itemEl.addEventListener('click', function () {
              if (!itemId) return;
              const url = getUrlFromId(itemId);
              if (url) {
                window.open(url, '_self');
              }
            });
          });

          entry.appendChild(orderItemsDiv);
          historyContainer.appendChild(entry);
        });

        function fillPendingColors() {
          const prods = window.__allProducts || [];
          historyContainer.querySelectorAll('.item-color-line').forEach(span => {
            if (span.innerHTML !== '') return;
            const fakeItem = {
              id:            span.dataset.itemId,
              sku:           span.dataset.sku,
              cj_variant_id: span.dataset.variantId,
              description:   span.dataset.description,
              color:         span.dataset.directColor
            };
            const color = resolveColor(fakeItem, prods);
            if (color) span.innerHTML = `Color: <strong>${color}</strong>`;
          });
        }

        if (window.__allProducts && window.__allProducts.length > 0) {
          fillPendingColors();
        } else {
          let tries = 0;
          const wait = setInterval(() => {
            tries++;
            if (window.__allProducts && window.__allProducts.length > 0) {
              clearInterval(wait);
              fillPendingColors();
            } else if (tries > 50) {
              clearInterval(wait);
            }
          }, 100);
        }

      } else {
        historyContainer.innerHTML = `<h2>Order History</h2><p>No orders yet</p>`;
      }
    } catch (e) {
      console.error("Stats load error", e);
    }
  }

  window.saveAddress = async () => {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('userAccountToken');
    const line1 = document.getElementById('addr-line1').value.trim();
    const line2 = document.getElementById('addr-line2').value.trim();
    const city = document.getElementById('addr-city').value.trim();
    const state = document.getElementById('addr-state').value.trim();
    const zip = document.getElementById('addr-zip').value.trim();
    const addressStr = [line1, line2, city, state, zip].filter(Boolean).join(', ');
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-address', email, line1, line2, city, state, zip, token })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('userAddress', addressStr || 'No default address set');
        localStorage.setItem('userAddressLine1', line1);
        localStorage.setItem('userLine2',        line2);
        localStorage.setItem('userCity',         city);
        localStorage.setItem('userState',        state);
        localStorage.setItem('userZip',          zip);
        document.getElementById('user-address').textContent = addressStr || 'No default address set';
        showToast("Address saved successfully!");
        closeAccountPopup('address-popup');
      } else {
        showToast("Error: " + data.error);
      }
    } catch (err) {
      showToast("Network error while saving address");
    }
  };

  window.updatePassword = async () => {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('userAccountToken');
    const newPassword = document.getElementById('new-password').value.trim();
    if (!email || !newPassword) return showToast("Email and new password are required");
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-password', email, newPassword, token })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Password updated successfully!");
        closeAccountPopup('password-popup');
      } else {
        showToast("Error: " + data.error);
      }
    } catch (err) {
      showToast("Network error while updating password");
    }
  };

  window.trackOrder = () => {
    const num = document.getElementById('tracking-number').value.trim();
    const result = document.getElementById('track-result');
    if (!num) {
      result.textContent = "Please enter a tracking number";
      return;
    }
    result.textContent = `✅ Order ${num} tracked - Estimated arrival: 3-5 days`;
    setTimeout(() => closeAccountPopup('track-popup'), 4000);
  };

  // ── PROFILE PHOTO ──
function loadProfilePhoto() {
  const photo    = localStorage.getItem('userProfilePhoto') || '';
  const firstName = localStorage.getItem('userFirstName') || '';
  const lastName  = localStorage.getItem('userLastName') || '';
  const img       = document.getElementById('profile-photo-img');
  const initials  = document.getElementById('profile-photo-initials');
  if (!img || !initials) return;

  if (photo) {
    img.src = photo;
    img.style.display = 'block';
    initials.style.display = 'none';
  } else {
    img.style.display = 'none';
    initials.style.display = 'flex';
    initials.textContent = (
      (firstName.charAt(0) || '') + (lastName.charAt(0) || '')
    ).toUpperCase() || '?';
  }
}

(function initProfilePhotoUpload() {
  const input = document.getElementById('profile-photo-input');
  if (!input) return;
  input.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) return;
    const MAX_PX = 300, QUALITY = 0.75;
    const base64 = await new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const i   = new Image();
      i.onload  = () => {
        let w = i.width, h = i.height;
        if (w > h) { if (w > MAX_PX) { h = Math.round(h * MAX_PX / w); w = MAX_PX; } }
        else        { if (h > MAX_PX) { w = Math.round(w * MAX_PX / h); h = MAX_PX; } }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(i, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', QUALITY));
      };
      i.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      i.src = url;
    });
    if (!base64) return;

    localStorage.setItem('userProfilePhoto', base64);
    loadProfilePhoto();

    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-profile-photo', email, photoBase64: base64, token: localStorage.getItem('userAccountToken') })
      });
      window.showToast && window.showToast('Profile photo updated!');
    } catch (e) {
      window.showToast && window.showToast('Could not save photo. Try again.');
    }
  });
})();


/* ── PROFILE BIRTHDAY ── */
(function initProfileBirthday() {
  var bdayInput   = document.getElementById('profile-birthday-input');
  var bdaySaveBtn = document.getElementById('profile-birthday-save-btn');
  var bdayMsg     = document.getElementById('profile-birthday-msg');
  if (!bdayInput || !bdaySaveBtn) return;

  function showBdayMsg(text, type) {
    bdayMsg.textContent = text;
    bdayMsg.className   = 'profile-birthday-msg' + (type ? ' ' + type : '');
  }

  async function loadBirthday() {
    var email = localStorage.getItem('userEmail');
    var token = localStorage.getItem('userAccountToken');
    if (!email) return;
    try {
      var res  = await fetch('/.netlify/functions/save-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'get-stats', email: email, token: token })
      });
      var data = await res.json();
      // Le CSS masque le placeholder "dd/mm/yyyy" via un sélecteur
      // [value]:not([value=""]) — celui-ci lit l'ATTRIBUT HTML, jamais la
      // propriété .value modifiée par script, donc il faut aussi poser
      // l'attribut explicitement pour que le placeholder disparaisse.
      if (data.birthday) {
        bdayInput.value = data.birthday;
        bdayInput.setAttribute('value', data.birthday);
      }
    } catch (e) {}
  }

  // Même correctif que loadBirthday() : quand le client choisit une date
  // dans le picker natif, .value change mais pas l'attribut HTML — sans
  // ça le faux placeholder CSS "dd/mm/yyyy" resterait affiché par-dessus.
  bdayInput.addEventListener('change', function () {
    if (bdayInput.value) {
      bdayInput.setAttribute('value', bdayInput.value);
    } else {
      bdayInput.removeAttribute('value');
    }
  });

  bdaySaveBtn.addEventListener('click', async function () {
    var email = localStorage.getItem('userEmail');
    if (!email) { showBdayMsg('Please log in first.', 'error'); return; }

    var birthday = bdayInput.value;
    if (!birthday) { showBdayMsg('Please select a date.', 'error'); return; }

    bdaySaveBtn.disabled = true;
    showBdayMsg('Saving...', '');

    try {
      var res  = await fetch('/.netlify/functions/save-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'newsletter-subscribe', email: email, birthday: birthday })
      });
      var data = await res.json();
      if (data.success) {
        showBdayMsg('Birthday saved! 🎂', 'success');
      } else {
        showBdayMsg(data.error || 'Something went wrong.', 'error');
      }
    } catch (e) {
      showBdayMsg('Network error.', 'error');
    } finally {
      bdaySaveBtn.disabled = false;
    }
  });

  loadBirthday();
})();



/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — BIRTHDAY GIFT ICON
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  function parseBirthday(raw) {
    if (!raw || typeof raw !== 'string') return null;
    raw = raw.trim();

    // Format ISO yyyy-mm-dd
    var isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return { month: parseInt(isoMatch[2], 10), day: parseInt(isoMatch[3], 10) };
    }

    // Format dd/mm/yy ou dd/mm/yyyy
    var parts = raw.split('/');
    if (parts.length >= 2) {
      var d = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10);
      if (!isNaN(d) && !isNaN(m) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return { day: d, month: m };
      }
    }

    // Format mm/dd/yyyy (US)
    var usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
      var m2 = parseInt(usMatch[1], 10);
      var d2 = parseInt(usMatch[2], 10);
      if (m2 <= 12 && d2 <= 31) {
        return { day: d2, month: m2 };
      }
    }

    return null;
  }

  /** Vérifie si une date { day, month } correspond à aujourd'hui */
  function isTodayBirthday(bdayObj) {
    if (!bdayObj) return false;
    var now = new Date();
    return bdayObj.day === now.getDate() && bdayObj.month === (now.getMonth() + 1);
  }

  /** Génère initiales depuis prénom / nom */
  function getInitials(firstName, lastName) {
    var f = (firstName || '').trim().charAt(0).toUpperCase();
    var l = (lastName  || '').trim().charAt(0).toUpperCase();
    return (f + l) || '?';
  }

  /** Capitalise la première lettre */
  function cap(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /* ────────────────────────────────────────────────────────────
     DOM REFS
  ────────────────────────────────────────────────────────────── */
  var giftBtn      = document.getElementById('bbwBdayGiftBtn');
  var overlay      = document.getElementById('bbwBdayOverlay');
  var closeBtn     = document.getElementById('bbwBdayClose');
  var carousel     = document.getElementById('bbwBdayCarousel');
  var dotsEl       = document.getElementById('bbwBdayDots');
  var prevBtn      = document.getElementById('bbwBdayPrev');
  var nextBtn      = document.getElementById('bbwBdayNext');
  var marqueeTrack = document.getElementById('bbwBdayMarquee');
  var subBtn       = document.getElementById('bbwBdaySubscribeBtn');
  var dotNotif     = document.getElementById('bbwBdayDot');
  var subBtnText   = document.getElementById('bbwBdaySubBtnText');
  var canvas       = document.getElementById('bbw-bday-canvas');

  if (!giftBtn || !overlay) return;

  /* ────────────────────────────────────────────────────────────
     SETTINGS
  ────────────────────────────────────────────────────────────── */
  var CFG = {
    show:              'yes',
    promo_code:        'MYBIRTHDAY',
    promo_discount:    '20%',
    marquee_texts: [
      '🎂 Happy Birthday Dear Customer!',
      '🎉 Today Is All For You!',
      '💝 Special Discount Just For You!',
      '👑 Beauty Has No Size!',
      '✨ Celebrate You Today!'
    ],
    birthday_message_template: "Today is your day — enjoy every moment and don't let life's challenges dim your shine.",
    subscribe_btn_text: 'My Birthday Is Coming — Subscribe!',
    copy_label:   'Copy Code',
    copied_label: 'Copied!'
  };

  /** Applique les settings depuis products.data.json */
  function applySettings(allProducts) {
    var settings = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
    var bg = settings.birthday_gift || {};
    if (bg.show              !== undefined) CFG.show              = bg.show;
    if (bg.promo_code        !== undefined) CFG.promo_code        = bg.promo_code;
    if (bg.promo_discount    !== undefined) CFG.promo_discount    = bg.promo_discount;
    if (bg.marquee_texts     !== undefined) CFG.marquee_texts     = bg.marquee_texts;
    if (bg.birthday_message_template !== undefined) CFG.birthday_message_template = bg.birthday_message_template;
    if (bg.default_customers !== undefined) CFG.defaultCustomers = bg.default_customers;
    if (bg.subscribe_btn_text !== undefined) {
      CFG.subscribe_btn_text = bg.subscribe_btn_text;
      if (subBtnText) subBtnText.textContent = CFG.subscribe_btn_text;
    }
    if (bg.copy_label   !== undefined) CFG.copy_label   = bg.copy_label;
    if (bg.copied_label !== undefined) CFG.copied_label = bg.copied_label;
  }
  /* ────────────────────────────────────────────────────────────
     POSITION DU BOUTON
     Le bouton vit maintenant dans le widgets dock (widgets-loader.js,
     #bbw-widgets-dock), qui impose sa propre position (colonne collée
     à droite) — ce n'est plus configurable par setting individuellement.
     Fonction gardée en no-op pour ne pas casser ses appelants existants.
  ────────────────────────────────────────────────────────────── */
  function applyPosition() {}

  /* ────────────────────────────────────────────────────────────
     MARQUEE
  ────────────────────────────────────────────────────────────── */
  function buildMarquee() {
    if (!marqueeTrack) return;
    marqueeTrack.innerHTML = '';

    var texts = CFG.marquee_texts;
    if (!texts || !texts.length) return;

    // Double pour boucle infinie
    var fragment = '';
    for (var r = 0; r < 2; r++) {
      texts.forEach(function (txt) {
        fragment +=
          '<span class="bbw-bday-marquee-item">' + txt + '</span>' +
          '<span class="bbw-bday-marquee-sep" aria-hidden="true">✦</span>';
      });
    }
    marqueeTrack.innerHTML = fragment;
  }

  /* ────────────────────────────────────────────────────────────
     FETCH CLIENTS AVEC BIRTHDAY AUJOURD'HUI
  ────────────────────────────────────────────────────────────── */
 async function fetchTodayBirthdays() {
    try {
      var res  = await fetch('/.netlify/functions/save-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ 
          action: 'get-today-birthdays',
          clientDay: new Date().getDate(),
          clientMonth: new Date().getMonth() + 1
        })
      });
      var data = await res.json();
      if (data.success && Array.isArray(data.customers)) {
        return data.customers;
      }
    } catch (e) {
      console.warn('[BdayGift] fetchTodayBirthdays failed:', e.message);
    }
    return [];
  }

  /* ────────────────────────────────────────────────────────────
     BUILD BIRTHDAY CARD
  ────────────────────────────────────────────────────────────── */
  function buildCard(customer) {
    var firstName = cap(customer.firstName || '');
    var lastName  = cap(customer.lastName  || '');
    var initials  = getInitials(firstName, lastName);
    var fullName  = [firstName, lastName].filter(Boolean).join(' ');

    var message = CFG.birthday_message_template
      .replace('[NAME]', firstName)
      .replace('{name}', firstName);

    var card = document.createElement('div');
    card.className = 'bbw-bday-card';

    // Avatar wrap (pour la couronne)
    var avatarWrap = document.createElement('div');
    avatarWrap.style.position = 'relative';
    avatarWrap.style.display  = 'inline-block';

    var crown = document.createElement('span');
    crown.className   = 'bbw-bday-crown';
    crown.textContent = '👑';

    var avatar = document.createElement('div');
    avatar.className   = 'bbw-bday-avatar';
    avatar.textContent = initials;

    avatarWrap.appendChild(crown);
    avatarWrap.appendChild(avatar);
    card.appendChild(avatarWrap);

    // Nom
    var nameEl = document.createElement('p');
    nameEl.className   = 'bbw-bday-name';
    nameEl.textContent = fullName || 'Customer';
    card.appendChild(nameEl);

    // Badge
    var badge = document.createElement('span');
    badge.className   = 'bbw-bday-age-badge';
    badge.innerHTML   = '🎂 &nbsp;Birthday Today!';
    card.appendChild(badge);

    // Étoiles
    var starsEl = document.createElement('div');
    starsEl.className = 'bbw-bday-stars';
    starsEl.innerHTML = '<span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>';
    card.appendChild(starsEl);

    // Dédicace personnalisée
    var msgWrap = document.createElement('div');
    msgWrap.style.textAlign = 'center';

    var salute = document.createElement('p');
    salute.className   = 'bbw-bday-message';
    salute.style.fontWeight = '700';
    salute.style.color = '#FFD700';
    salute.style.fontSize  = '0.95rem';
    salute.textContent = '🎉 Happy Birthday, ' + (firstName || 'Beautiful') + '!';
    msgWrap.appendChild(salute);

    var msgEl = document.createElement('p');
    msgEl.className   = 'bbw-bday-message';
    msgEl.style.marginTop = '4px';
    msgEl.textContent = message;
    msgWrap.appendChild(msgEl);
    card.appendChild(msgWrap);

    // Divider
    var hr = document.createElement('hr');
    hr.className = 'bbw-bday-divider';
    card.appendChild(hr);

    // Promo code
    var promoWrap = document.createElement('div');
    promoWrap.className = 'bbw-bday-promo-wrap';

    var promoLeft = document.createElement('div');
    promoLeft.className = 'bbw-bday-promo-left';

    var promoLabel = document.createElement('span');
    promoLabel.className   = 'bbw-bday-promo-label';
    promoLabel.textContent = '🎁 Your exclusive promo code';

    var promoCode = document.createElement('span');
    promoCode.className   = 'bbw-bday-promo-code';
    promoCode.textContent = CFG.promo_code;

    var promoDisc = document.createElement('span');
    promoDisc.className   = 'bbw-bday-promo-discount';
    promoDisc.textContent = '✓ Save ' + CFG.promo_discount + ' on your next order';

    promoLeft.appendChild(promoLabel);
    promoLeft.appendChild(promoCode);
    promoLeft.appendChild(promoDisc);
    promoWrap.appendChild(promoLeft);

    // Bouton copier
    var copyBtn = document.createElement('button');
    copyBtn.className = 'bbw-bday-copy-btn';
    copyBtn.setAttribute('aria-label', 'Copy promo code');
    copyBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" width="14" height="14">' +
      '<rect width="14" height="14" x="8" y="8" rx="2"/>' +
      '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>' +
      '</svg>' +
      '<span>' + CFG.copy_label + '</span>';

    copyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      navigator.clipboard.writeText(CFG.promo_code).then(function () {
        copyBtn.classList.add('bbw-bday--copied');
        copyBtn.querySelector('span').textContent = CFG.copied_label;
        setTimeout(function () {
          copyBtn.classList.remove('bbw-bday--copied');
          copyBtn.querySelector('span').textContent = CFG.copy_label;
        }, 2200);
      }).catch(function () {
        /* fallback select */
        var range = document.createRange();
        range.selectNode(promoCode);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
    });

    promoWrap.appendChild(copyBtn);
    card.appendChild(promoWrap);

    return card;
  }

  /* ────────────────────────────────────────────────────────────
     CAROUSEL LOGIC
  ────────────────────────────────────────────────────────────── */
  var _cardCount    = 0;
  var _currentCard  = 0;
  var _autoTimer    = null;

  function buildCarousel(customers) {
    if (!carousel) return;
    if (!customers || customers.length === 0) return;
    carousel.innerHTML = '';

    // Enlever le placeholder
    var placeholder = document.getElementById('bbwBdayPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    if (!customers || customers.length === 0) {
      if (placeholder) placeholder.style.display = '';
      _cardCount = 0;
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      if (dotsEl)  dotsEl.style.display  = 'none';
      return;
    }

    _cardCount   = customers.length;
    _currentCard = 0;

    customers.forEach(function (customer) {
      carousel.appendChild(buildCard(customer));
    });

    buildDots();
    updateDots(0);
    startAutoSlide();

    // Afficher/masquer flèches
    var showNav = _cardCount > 1;
    if (prevBtn) prevBtn.style.display = showNav ? '' : 'none';
    if (nextBtn) nextBtn.style.display = showNav ? '' : 'none';
  }

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    if (_cardCount <= 1) { dotsEl.style.display = 'none'; return; }
    dotsEl.style.display = 'flex';

    for (var i = 0; i < _cardCount; i++) {
      (function (idx) {
        var dot = document.createElement('button');
        dot.className = 'bbw-bday-dot';
        dot.setAttribute('aria-label', 'Customer ' + (idx + 1));
        dot.addEventListener('click', function () {
          goToCard(idx, 'left');
          resetAutoSlide();
        });
        dotsEl.appendChild(dot);
      })(i);
    }
  }

  function updateDots(idx) {
    if (!dotsEl) return;
    dotsEl.querySelectorAll('.bbw-bday-dot').forEach(function (d, i) {
      d.classList.toggle('bbw-bday--dot-active', i === idx);
    });
  }

  function goToCard(idx, dir) {
    if (_cardCount <= 1) return;
    _currentCard = ((idx % _cardCount) + _cardCount) % _cardCount;

    carousel.classList.remove('bbw-bday--slide-left', 'bbw-bday--slide-right');
    void carousel.offsetHeight;
    carousel.classList.add(dir === 'right' ? 'bbw-bday--slide-right' : 'bbw-bday--slide-left');

    var cards = carousel.querySelectorAll('.bbw-bday-card');
    cards.forEach(function (c) { c.style.display = 'none'; });
    if (cards[_currentCard]) cards[_currentCard].style.display = '';

    updateDots(_currentCard);
  }

  function startAutoSlide() {
    if (_cardCount <= 1) return;
    stopAutoSlide();
    _autoTimer = setInterval(function () {
      goToCard(_currentCard + 1, 'left');
    }, 5000);
  }

  function stopAutoSlide() {
    clearInterval(_autoTimer);
    _autoTimer = null;
  }

  function resetAutoSlide() {
    stopAutoSlide();
    startAutoSlide();
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      goToCard(_currentCard - 1, 'right');
      resetAutoSlide();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      goToCard(_currentCard + 1, 'left');
      resetAutoSlide();
    });
  }

  /* ────────────────────────────────────────────────────────────
     PETAL / CONFETTI CANVAS BURST
  ────────────────────────────────────────────────────────────── */
  var _petalParticles = [];
  var _petalRAF       = null;
  var _petalDone      = false;

  function firePetalBurst() {
    if (!canvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    _petalDone = false;

    var ctx     = canvas.getContext('2d');
    var cx      = giftBtn.getBoundingClientRect().left + giftBtn.offsetWidth / 2;
    var cy      = giftBtn.getBoundingClientRect().top  + giftBtn.offsetHeight / 2;
    var colors  = [
      '#c0385e','#FFD700','#7b3f6e','#e8bc6a',
      '#ff6b9d','#fff','#c9963e','#d4506e',
      '#f0d080','#a855f7'
    ];
    var shapes  = ['circle','rect','petal'];
    var COUNT   = 90;

    _petalParticles = [];
    for (var i = 0; i < COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 5 + Math.random() * 12;
      _petalParticles.push({
        x:      cx,
        y:      cy,
        vx:     Math.cos(angle) * speed,
        vy:     Math.sin(angle) * speed - (Math.random() * 6 + 2),
        gravity: 0.28 + Math.random() * 0.18,
        size:   4 + Math.random() * 8,
        color:  colors[Math.floor(Math.random() * colors.length)],
        shape:  shapes[Math.floor(Math.random() * shapes.length)],
        rot:    Math.random() * 360,
        rotV:   (Math.random() - 0.5) * 12,
        alpha:  1,
        alphaD: 0.012 + Math.random() * 0.012
      });
    }

    function drawPetal(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        /* petal = ellipse */
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size / 2, p.size / 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function animate() {
      if (_petalDone) { canvas.style.display = 'none'; return; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var alive = false;

      _petalParticles.forEach(function (p) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += p.gravity;
        p.vx  *= 0.99;
        p.rot += p.rotV;
        p.alpha -= p.alphaD;

        if (p.alpha > 0) {
          alive = true;
          drawPetal(ctx, p);
        }
      });

      if (!alive) {
        _petalDone = true;
        canvas.style.display = 'none';
        return;
      }
      _petalRAF = requestAnimationFrame(animate);
    }

    if (_petalRAF) cancelAnimationFrame(_petalRAF);
    animate();
  }

  /* ────────────────────────────────────────────────────────────
     CONFETTIS INTERNES (dans la modal)
  ────────────────────────────────────────────────────────────── */
  function fireModalConfetti() {
    var wrap = document.getElementById('bbwBdayConfetti');
    if (!wrap) return;
    wrap.innerHTML = '';

    var colors = [
      '#c9963e','#c0385e','#e8bc6a','#7b3f6e',
      '#FFD700','#fff','#d4506e','#f0d080','#a855f7'
    ];

    for (var i = 0; i < 50; i++) {
      var piece = document.createElement('div');
      piece.className = 'bbw-bday-confetti-piece';
      var sz   = 5 + Math.random() * 9;
      var dur  = 0.9 + Math.random() * 1.4;
      var del  = Math.random() * 0.8;
      var left = Math.random() * 100;
      piece.style.cssText =
        'left:' + left + '%;' +
        'width:' + sz + 'px;' +
        'height:' + sz + 'px;' +
        'background:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
        'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
        'animation-duration:' + dur + 's;' +
        'animation-delay:' + del + 's;';
      wrap.appendChild(piece);
    }

    setTimeout(function () { if (wrap) wrap.innerHTML = ''; }, 3000);
  }

  /* ────────────────────────────────────────────────────────────
     PARTICULES INTERNES AMBIANT
  ────────────────────────────────────────────────────────────── */
  function spawnModalParticles() {
    var container = document.getElementById('bbwBdayModalPtcl');
    if (!container) return;
    container.innerHTML = '';

    var colors = [
      'rgba(192,56,94,0.65)',
      'rgba(201,150,62,0.5)',
      'rgba(123,63,110,0.55)',
      'rgba(255,215,0,0.45)'
    ];

    for (var i = 0; i < 20; i++) {
      var p    = document.createElement('div');
      p.className = 'bbw-bday-modal-ptcl';
      var sz   = 3 + Math.random() * 5;
      var dur  = 4 + Math.random() * 5;
      var del  = Math.random() * 6;
      var left = 5 + Math.random() * 90;
      p.style.cssText =
        'width:' + sz + 'px;' +
        'height:' + sz + 'px;' +
        'left:' + left + '%;' +
        'bottom:-10px;' +
        'background:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
        'animation-duration:' + dur + 's;' +
        'animation-delay:' + del + 's;';
      container.appendChild(p);
    }
  }

  /* ────────────────────────────────────────────────────────────
     OPEN / CLOSE POPUP
  ────────────────────────────────────────────────────────────── */
  function openPopup() {
    overlay.style.display = 'flex';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('bbw-bday--open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Animations
        fireModalConfetti();
        spawnModalParticles();
        stopAutoSlide();
        if (_cardCount > 0) startAutoSlide();
      });
    });
}

  function closePopup() {
    overlay.classList.remove('bbw-bday--open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    stopAutoSlide();

    setTimeout(function () {
      overlay.style.display = 'none';
    }, 400);
  }

  /* ────────────────────────────────────────────────────────────
     WIGGLE PÉRIODIQUE DU BOUTON
  ────────────────────────────────────────────────────────────── */
  function scheduleWiggle() {
    setTimeout(function () {
      giftBtn.classList.add('bbw-bday--wiggle');
      setTimeout(function () {
        giftBtn.classList.remove('bbw-bday--wiggle');
        scheduleWiggle();
      }, 700);
    }, 6000 + Math.random() * 4000);
  }

  /* ────────────────────────────────────────────────────────────
     EVENTS
  ────────────────────────────────────────────────────────────── */
  giftBtn.addEventListener('click', function () {
    firePetalBurst();
    setTimeout(openPopup, 300);
  });

  if (closeBtn) closeBtn.addEventListener('click', closePopup);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePopup();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('bbw-bday--open')) closePopup();
  });

  /* Bouton subscribe → ouvre newsletter popup + ferme birthday popup */
  if (subBtn) {
    subBtn.addEventListener('click', function () {
      /* Animation de fermeture */
      overlay.querySelector('.bbw-bday-modal').style.transform =
        'scale(1.06) translateY(-10px)';
      setTimeout(function () {
        closePopup();
        /* Ouvrir le popup newsletter existant */
        if (typeof window.openNewsletterPopup === 'function') {
          window.openNewsletterPopup();
        } else {
          /* Fallback : trouver le déclencheur newsletter */
          var nlTrigger = document.querySelector('[data-open-newsletter]');
          if (nlTrigger) nlTrigger.click();
          else {
            var nlOverlay = document.getElementById('bbwNlOverlay');
            if (nlOverlay) nlOverlay.classList.add('bbwnl-active');
          }
        }
      }, 320);
    });
  }

  /* ────────────────────────────────────────────────────────────
     RESIZE
  ────────────────────────────────────────────────────────────── */
  window.addEventListener('resize', function () {
    applyPosition();
    if (canvas) {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });

  

  /* ────────────────────────────────────────────────────────────
     INIT PRINCIPAL
  ────────────────────────────────────────────────────────────── */
  async function init(allProducts) {
    applySettings(allProducts);

    if (CFG.show.toLowerCase().trim() !== 'yes') {
      giftBtn.style.display = 'none';
      return;
    }

    applyPosition();
    buildMarquee();
    scheduleWiggle();

    const defaults = (CFG.defaultCustomers || []);

    function getDefaultsForToday() {
      if (!defaults.length) return [];
      const today = new Date();
      const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      function seededRandom(seed) {
        var x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      }
      var shuffled = defaults.slice();
      for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(seededRandom(daySeed + i) * (i + 1));
        var temp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = temp;
      }
      return shuffled.slice(0, 3);
    }

    const picked = getDefaultsForToday();
    if (picked.length) {
      buildCarousel(picked);
    }

    try {
      const customers = await fetchTodayBirthdays();
      if (customers && customers.length > 0) {
        buildCarousel(customers);
        if (dotNotif) dotNotif.classList.add('bbw-bday--visible');
      }
    } catch(e) {
      console.warn('[BdayGift] fetchTodayBirthdays error:', e.message);
    }
  }

  /* ────────────────────────────────────────────────────────────
     ATTENTE DU CHARGEMENT DES PRODUCTS
  ────────────────────────────────────────────────────────────── */
  if (window.__allProducts && window.__allProducts.length) {
    init(window.__allProducts);
  } else {
    var tries = 0;
    var poll  = setInterval(function () {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll);
        init(window.__allProducts);
      } else if (tries > 80) {
        clearInterval(poll);
        applyPosition();
        buildMarquee();
        scheduleWiggle();
        fetchTodayBirthdays().then(function (customers) {
          if (customers && customers.length > 0) {
            buildCarousel(customers);
            if (dotNotif) dotNotif.classList.add('bbw-bday--visible');
          }
        });
      }
    }, 100);
  }

})();





/* ════════════════════════════════════════════════════════════════
   BBW4LIFE — ABANDONED CART CARD (à côté du champ Birthday)
════════════════════════════════════════════════════════════════ */
(function initAbandonedCartCard() {
  'use strict';

  if (!/\/account\.html/i.test(location.pathname)) return; // widget account.html uniquement (son CSS n'est chargé que là)

  var userEmail = localStorage.getItem('userEmail') || '';
  var userToken = localStorage.getItem('userAccountToken') || '';
  if (!userEmail || !userToken) return; // client non connecté

  /* ── Card ── */
  var card = document.createElement('button');
  card.id = 'bbwAcCard';
  card.type = 'button';
  card.setAttribute('aria-label', 'Your abandoned carts');
  card.innerHTML =
    '<span class="bbw-ac-card-icon">' +
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
      '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' +
      '</svg>' +
      '<span class="bbw-ac-card-badge" id="bbwAcBadge">0</span>' +
    '</span>' +
    '<span class="bbw-ac-card-text">' +
      '<strong class="bbw-ac-card-title">You left something beautiful behind</strong>' +
      '<span class="bbw-ac-card-sub" id="bbwAcSub">Tap to resume your order</span>' +
    '</span>' +
    '<svg class="bbw-ac-card-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>';

  /* ── Modal (paniers multiples) ── */
  var overlay = document.createElement('div');
  overlay.id = 'bbwAcOverlay';
  overlay.innerHTML =
    '<div class="bbw-ac-modal">' +
      '<h3>Your Abandoned Carts</h3>' +
      '<p class="bbw-ac-sub">Pick a cart to resume checkout instantly</p>' +
      '<div id="bbwAcList"></div>' +
      '<button class="bbw-ac-close" id="bbwAcCloseBtn">Close</button>' +
    '</div>';
  document.body.appendChild(overlay);

  var carts = [];

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
             ' — ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function goToCheckout(orderId) {
    window.location.href = '/checkout/checkout.html?restore=' + encodeURIComponent(orderId);
  }

  function renderList() {
    var listEl = document.getElementById('bbwAcList');
    if (!listEl) return;
    listEl.innerHTML = '';
    carts.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'bbw-ac-item';
      item.innerHTML =
        '<div class="bbw-ac-item-icon">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
          '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' +
          '</svg></div>' +
        '<div class="bbw-ac-item-info">' +
          '<p class="bbw-ac-item-date">' + formatDate(c.createdAt) + '</p>' +
          '<p class="bbw-ac-item-count">' + c.itemCount + ' item' + (c.itemCount > 1 ? 's' : '') + ' waiting</p>' +
        '</div>' +
        '<span class="bbw-ac-item-arrow">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>' +
        '</span>';
      item.addEventListener('click', function () { goToCheckout(c.orderId); });
      listEl.appendChild(item);
    });
  }

  function openModal()  { renderList(); overlay.classList.add('bbw-ac--visible'); }
  function closeModal() { overlay.classList.remove('bbw-ac--visible'); }

  var closeBtn = document.getElementById('bbwAcCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

  card.addEventListener('click', function () {
    if (!carts.length) return;
    if (carts.length === 1) {
      goToCheckout(carts[0].orderId);
    } else {
      openModal();
    }
  });

  /* ── Insertion à côté du champ Birthday (dans la même ligne flex) ── */
  function insertCard() {
    var row = document.querySelector('.profile-birthday-row');
    if (!row) return false;
    row.appendChild(card);
    return true;
  }

  var tries = 0;
  var waitDom = setInterval(function () {
    tries++;
    if (insertCard() || tries > 60) clearInterval(waitDom);
  }, 150);

  /* ── Charger les paniers abandonnés ── */
  fetch('/.netlify/functions/save-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get-abandoned-carts', email: userEmail, token: userToken })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      console.log('[AbandonedCartCard] réponse:', data);
      if (!data.success || !data.carts || !data.carts.length) return;
      carts = data.carts;
      var badge = document.getElementById('bbwAcBadge');
      var sub   = document.getElementById('bbwAcSub');
      if (badge) badge.textContent = carts.length;
      if (sub) {
        sub.textContent = carts.length === 1
          ? 'Tap to resume your order'
          : carts.length + ' orders waiting for you';
      }
      card.style.display = 'inline-flex';
    })
    .catch(function (e) { console.warn('[AbandonedCartCard] fetch failed:', e.message); });

})();




  window.logout = () => {
    localStorage.clear();
    window.location.href = 'index.html';
  };


 (function initAffiliationSystem() {
  const usernameInput  = document.getElementById('aff-username-input');
  const createBtn      = document.getElementById('aff-create-btn');
  const createError    = document.getElementById('aff-create-error');
  const tableCard      = document.getElementById('aff-table-card');
  const tableBody      = document.getElementById('aff-table-body');
  const historyCard    = document.getElementById('aff-history-card');
  const historyList    = document.getElementById('aff-history-list');
  const cleanBtn       = document.getElementById('aff-clean-btn');
  const rewardCard     = document.getElementById('aff-reward-card');
  const promoCodeVal   = document.getElementById('aff-promo-code-val');
  const copyPromoBtn   = document.getElementById('aff-copy-promo-btn');
  const withdrawForm   = document.getElementById('aff-withdraw-form');
  const withdrawStatus = document.getElementById('aff-withdraw-status');
  const withdrawBtn    = document.getElementById('aff-withdraw-btn');
  const withdrawError  = document.getElementById('aff-withdraw-error');
  const statusBadge    = document.getElementById('aff-status-badge');
  const statusMsg      = document.getElementById('aff-status-msg');

  if (!createBtn) return;

  const userEmail = localStorage.getItem('userEmail') || '';
  if (!userEmail) return;

  let affiliatesFromSheet = [];

  function getAffCfg() {
    const allProds = window.__allProducts || [];
    const settings = allProds.find(function(p) { return p.type === 'settings'; }) || {};
    const affCfg   = settings.affiliation || {};
    return {
      commPct:        parseFloat(affCfg.commission_percent)          || 5,
      jackpotQty:     parseInt(affCfg.jackpot_orders_threshold)      || 50,
      jackpotAmt:     parseFloat(affCfg.jackpot_reward_amount)       || 100,
      unlockPct:      parseFloat(affCfg.promo_code_unlock_percent)   || 50,
      promoPrefix:    affCfg.promo_code_prefix                       || 'AFF',
      promoDisc:      parseFloat(affCfg.promo_code_discount_percent) || 50,
      payPerClick:    affCfg.pay_per_click                           || 'no',
      clicksPerReward: parseInt(affCfg.clicks_per_reward)            || 1000,
      clickRewardAmt:  parseFloat(affCfg.click_reward_amount)        || 2
    };
  }

  function buildAffLink(username) {
    return window.location.origin + '/?ref=' + encodeURIComponent(username);
  }

  function validateUsername(name) {
    if (!name || name.length < 3) return 'Minimum 3 characters required.';
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return 'Letters, numbers, hyphens and _ only.';
    if (name.length > 30) return 'Maximum 30 characters.';
    return null;
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Affiche un toast temporaire ──
  function showToastAff(message, color) {
    let toast = document.getElementById('aff-choice-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aff-choice-toast';
      toast.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
        'color:#fff;padding:10px 22px;border-radius:30px;font-size:0.85rem;' +
        'font-weight:600;z-index:99999;box-shadow:0 4px 18px rgba(0,0,0,.18);' +
        'transition:opacity 0.3s ease;display:none;';
      document.body.appendChild(toast);
    }
    toast.style.background = color || '#22a06b';
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.style.display = 'none'; }, 300);
    }, 3500);
  }

  // ── Injecte ou récupère le message d'exclusivité ──
  function getOrCreateExclusiveMsg() {
    let msg = document.getElementById('aff-exclusive-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.id = 'aff-exclusive-msg';
      msg.style.cssText =
        'text-align:center;font-size:0.82rem;color:#7b3f6e;font-weight:600;' +
        'background:#f9f0fb;border:1px dashed #c0385e;border-radius:8px;' +
        'padding:8px 14px;margin:0 0 14px 0;';
      msg.textContent = '⚠️ You can only choose one option — promo code OR PayPal withdrawal.';
      const rewardInner = rewardCard ? rewardCard.querySelector('.aff-reward-inner') : null;
      if (rewardInner) rewardInner.insertBefore(msg, rewardInner.firstChild);
    }
    return msg;
  }

  function renderTable(affiliates) {
    if (!affiliates || !affiliates.length) {
      tableCard.style.display = 'none';
      return;
    }

    const cfg        = getAffCfg();
    const commPct    = cfg.commPct;
    const jackpotQty = cfg.jackpotQty;
    const unlockPct  = cfg.unlockPct;

    tableCard.style.display = 'block';
    tableBody.innerHTML = '';

    affiliates.forEach(function(aff) {
      const totalOrders    = parseInt(aff.totalOrders || 0);
      const earnedPct      = totalOrders * commPct;
      const jackpotReached = totalOrders >= jackpotQty;
      const promoReached   = earnedPct >= unlockPct;

      const payPerClick2     = (cfg.payPerClick || 'no').toLowerCase() === 'yes';
      const clicksPerReward2 = parseInt(cfg.clicksPerReward)  || 1000;
      const clickRewardAmt2  = parseFloat(cfg.clickRewardAmt) || 2;
      const totalClicks2     = parseInt(aff.clicks || 0);
      const tranchesEarned2  = Math.floor(totalClicks2 / clicksPerReward2);
      const clickEarned2     = tranchesEarned2 * clickRewardAmt2;
      const progressIn2      = totalClicks2 % clicksPerReward2;

      const clickProgressHTML = payPerClick2
        ? '<td>' +
            '<div class="aff-progress-wrap">' +
              '<div class="aff-progress-bar">' +
                '<div class="aff-progress-fill" style="width:' +
                  Math.min((progressIn2 / clicksPerReward2) * 100, 100).toFixed(1) + '%"></div>' +
              '</div>' +
              '<span class="aff-progress-label">' +
                progressIn2.toLocaleString() + ' / ' + clicksPerReward2.toLocaleString() +
              '</span>' +
            '</div>' +
          '</td>'
        : '';

      const clickRewardHTML = payPerClick2
        ? '<td style="font-weight:700;color:' + (clickEarned2 > 0 ? '#c9963e' : '#888') + ';">' +
            (clickEarned2 > 0 ? '$' + clickEarned2.toFixed(2) : '—') +
          '</td>'
        : '';

      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="aff-td-username">' + escHtml(aff.username) + '</td>' +
        '<td>' + (aff.clicks || 0) + '</td>' +
        '<td>' + totalOrders + '</td>' +
        '<td><strong style="color:#1a6b3c;">$' + parseFloat(aff.totalOrderValue || 0).toFixed(2) + '</strong></td>' +
        '<td><span class="aff-badge-pct' + (promoReached ? ' jackpot' : '') + '">'
          + earnedPct.toFixed(0) + '%</span></td>' +
        '<td>' + totalOrders + ' / ' + jackpotQty + '</td>' +
        '<td class="aff-td-jackpot">'
          + (jackpotReached ? '🏆 $' + cfg.jackpotAmt.toFixed(0) : '—')
          + '</td>' +
        clickProgressHTML +
        clickRewardHTML;
      tableBody.appendChild(tr);

      if (jackpotReached || promoReached) {
        showReward(aff);
      }
    });
  }

  function renderHistory(affiliates) {
    if (!affiliates || !affiliates.length) {
      historyCard.style.display = 'none';
      return;
    }
    historyCard.style.display = 'block';
    historyList.innerHTML = '';

    affiliates.forEach(function(aff) {
      const link = buildAffLink(aff.username);
      const div  = document.createElement('div');
      div.className = 'aff-history-item';
      div.innerHTML =
        '<span class="aff-history-user">@' + escHtml(aff.username) + '</span>' +
        '<span class="aff-history-link">' + escHtml(link) + '</span>' +
        '<span class="aff-history-date">' + escHtml(aff.createdAt || '') + '</span>' +
        '<button class="aff-copy-link-btn" data-link="' + escHtml(link) + '">' +
          '<i class="fi fi-rr-copy"></i> Copy' +
        '</button>';
      historyList.appendChild(div);
    });

    historyList.querySelectorAll('.aff-copy-link-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(btn.dataset.link).then(function() {
          const orig = btn.innerHTML;
          btn.innerHTML = '<i class="fi fi-rr-check"></i> Copied!';
          setTimeout(function() { btn.innerHTML = orig; }, 1800);
        });
      });
    });
  }

  function showReward(aff) {
    if (!rewardCard) return;

    const cfg         = getAffCfg();
    const jackpotQty  = cfg.jackpotQty;
    const jackpotAmt  = cfg.jackpotAmt;
    const unlockPct   = cfg.unlockPct;
    const promoPrefix = cfg.promoPrefix;
    const promoDisc   = cfg.promoDisc;
    const commPct     = cfg.commPct;

    const totalOrders    = parseInt(aff.totalOrders || 0);
    const earnedPct      = totalOrders * commPct;
    const jackpotReached = totalOrders >= jackpotQty;
    const promoReached   = earnedPct >= unlockPct;

    if (!jackpotReached && !promoReached) return;
    rewardCard.style.display = 'block';

    // ── Clé unique par username dans localStorage ──
    const storageKey   = 'aff_chosen_option_' + (aff.username || '');
    const chosenOption = localStorage.getItem(storageKey); // 'promo' | 'withdraw' | null

    // ── Message d'exclusivité (affiché seulement si aucun choix encore fait) ──
    const exclusiveMsg = getOrCreateExclusiveMsg();
    exclusiveMsg.style.display = (!chosenOption && promoReached) ? '' : 'none';

    // ── Jackpot block ──
    let jackpotBlock = document.getElementById('aff-jackpot-block');
    if (jackpotReached) {
      if (!jackpotBlock) {
        jackpotBlock = document.createElement('div');
        jackpotBlock.id        = 'aff-jackpot-block';
        jackpotBlock.className = 'aff-jackpot-block';
        jackpotBlock.style.cssText =
          'background:linear-gradient(135deg,#fff8e1,#fff3cd);border:2px solid #f59e0b;' +
          'border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;';
        jackpotBlock.innerHTML =
          '<div style="font-size:2.5rem;">🏆</div>' +
          '<h4 style="color:#b45309;margin:8px 0;">JACKPOT REACHED!</h4>' +
          '<p style="color:#92400e;">You have reached <strong>' + jackpotQty + ' orders</strong>.</p>' +
          '<p style="color:#92400e;font-size:1.2rem;font-weight:700;">Your reward: <strong>$'
            + jackpotAmt.toFixed(2) + '</strong></p>';

        const rewardInner = rewardCard.querySelector('.aff-reward-inner');
        if (rewardInner) {
          const divider      = rewardInner.querySelector('.aff-reward-divider');
          const withdrawWrap = rewardInner.querySelector('#aff-withdraw-wrap');
          const ref          = divider || withdrawWrap || null;
          if (ref) rewardInner.insertBefore(jackpotBlock, ref);
          else rewardInner.appendChild(jackpotBlock);
        }
      }
      jackpotBlock.style.display = '';
    } else {
      if (jackpotBlock) jackpotBlock.style.display = 'none';
    }

    // ── Divider OR (entre promo et withdraw) ──
    const dividerOr = document.getElementById('aff-reward-divider-or');

    // ── Promo code ──
    const rewardPromo = document.getElementById('aff-reward-promo');
    if (rewardPromo) {
      // Visible si : promo atteint ET (pas de choix OU choix = promo)
      if (promoReached && chosenOption !== 'withdraw') {
        rewardPromo.style.display = '';

       // Générer un code unique par affilié
        const uniqueCode = promoPrefix + '-' + (aff.username || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (promoCodeVal) promoCodeVal.textContent = uniqueCode;

        const promoNote = rewardPromo.querySelector('.aff-promo-note');
        if (promoNote) {
          promoNote.textContent = 'Use this code on your next order for -' + promoDisc + '%';
        }

        // ── Bind copie → lock sur promo, cacher withdraw ──
        if (copyPromoBtn && !copyPromoBtn.dataset.boundChoice) {
  copyPromoBtn.dataset.boundChoice = '1';
  copyPromoBtn.addEventListener('click', async function () {
    const code = promoCodeVal ? promoCodeVal.textContent.trim() : '';
    if (!code) return;
 
    // Copier dans le presse-papiers
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      const range = document.createRange();
      if (promoCodeVal) {
        range.selectNode(promoCodeVal);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    }
 
    // Feedback bouton
    const orig = copyPromoBtn.innerHTML;
    copyPromoBtn.innerHTML = '<i class="fi fi-rr-check"></i> Copied!';
    setTimeout(function () { copyPromoBtn.innerHTML = orig; }, 2000);
 
    // Enregistrer dans Google Sheets (une seule fois)
    if (!localStorage.getItem('bbw_promo_registered_' + code)) {
      try {
        await fetch('/.netlify/functions/validate-promo-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:           'register',
            code:             code,
            username:         aff.username || '',
            discount_percent: cfg.promoDisc || 50
          })
        });
        localStorage.setItem('bbw_promo_registered_' + code, '1');
      } catch (e) {
        console.warn('[PromoCode] Registration failed:', e.message);
      }
    }
 
    // Afficher le popup premium single-use
    bbwShowPromoWarningPopup(code, cfg.promoDisc || 50);
 
    // Enregistrer le choix seulement si pas encore fait
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, 'promo');
 
      // Masquer withdraw et divider
      const withdrawWrap = document.getElementById('aff-withdraw-wrap');
      if (withdrawWrap)  withdrawWrap.style.display  = 'none';
      if (dividerOr)     dividerOr.style.display     = 'none';
      if (exclusiveMsg)  exclusiveMsg.style.display  = 'none';
 
      showToastAff('✅ Promo code chosen — PayPal withdrawal option hidden.', '#22a06b');
    }
  });
}

      } else {
        // Choix withdraw déjà fait → cacher la promo
        rewardPromo.style.display = 'none';
      }
    }

    // ── Divider OR ──
    if (dividerOr) {
      // Visible seulement si promo atteint ET aucun choix encore fait
      dividerOr.style.display = (promoReached && !chosenOption) ? '' : 'none';
    }

    // ── Withdraw wrap / status ──
    const withdrawWrap = document.getElementById('aff-withdraw-wrap');

    if (aff.withdrawStatus && aff.withdrawStatus !== 'none') {
      // Withdraw déjà envoyé → figer sur withdraw
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, 'withdraw');
      }
      if (withdrawForm)   withdrawForm.style.display   = 'none';
      if (withdrawStatus) withdrawStatus.style.display = 'block';
      if (withdrawWrap)   withdrawWrap.style.display   = '';

      const approved = aff.withdrawStatus === 'approved';
      if (statusBadge) {
        statusBadge.textContent = approved ? '✅ Approved' : '⏳ Pending';
        statusBadge.className   = 'aff-status-badge' + (approved ? ' approved' : '');
      }
     if (statusMsg) {
        statusMsg.textContent = approved
          ? 'Withdrawal approved — payment sent to your PayPal. If you haven\'t received it within 24h, please verify your email address or contact our support team.'
          : 'Your withdrawal request is being processed by our team.';
      }
      // Cacher promo et divider puisque withdraw est choisi
      if (rewardPromo) rewardPromo.style.display = 'none';
      if (dividerOr)   dividerOr.style.display   = 'none';
      if (exclusiveMsg) exclusiveMsg.style.display = 'none';

    } else {
      // Pas encore de withdraw envoyé
      if (chosenOption === 'promo') {
        // Promo déjà choisi → cacher tout le withdraw wrap
        if (withdrawWrap) withdrawWrap.style.display = 'none';
        if (dividerOr)    dividerOr.style.display    = 'none';
      } else {
        // Aucun choix ou choix = withdraw → montrer le formulaire
        if (withdrawWrap)  withdrawWrap.style.display  = '';
        if (withdrawForm)  withdrawForm.style.display  = '';
        if (withdrawStatus) withdrawStatus.style.display = 'none';
      }
    }
  }

  // ── Popup "username déjà pris" avec suggestions cliquables ──
  function showUsernameTakenPopup(suggestions) {
    let overlay = document.getElementById('aff-username-taken-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'aff-username-taken-overlay';
      overlay.className = 'aff-ut-overlay';
      overlay.innerHTML =
        '<div class="aff-ut-modal">' +
          '<button type="button" class="aff-ut-close" id="aff-ut-close" aria-label="Close">' +
            '<i class="fi fi-rr-cross"></i>' +
          '</button>' +
          '<span class="aff-ut-icon"><i class="fi fi-rr-triangle-warning"></i></span>' +
          '<h3 class="aff-ut-title">Username Already Taken</h3>' +
          '<p class="aff-ut-msg">We\'re sorry, this username is already chosen by someone else. Please choose another one!</p>' +
          '<div class="aff-ut-suggestions" id="aff-ut-suggestions"></div>' +
        '</div>';
      document.body.appendChild(overlay);

      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.classList.remove('aff-ut-active');
      });
      document.getElementById('aff-ut-close').addEventListener('click', function() {
        overlay.classList.remove('aff-ut-active');
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('aff-ut-active')) {
          overlay.classList.remove('aff-ut-active');
        }
      });
    }

    const suggWrap = document.getElementById('aff-ut-suggestions');
    suggWrap.innerHTML = (suggestions || []).map(function(s) {
      return '<button type="button" class="aff-ut-suggestion-btn" data-username="' + escHtml(s) + '">' +
        '<i class="fi fi-rr-add"></i> ' + escHtml(s) +
      '</button>';
    }).join('');

    suggWrap.querySelectorAll('.aff-ut-suggestion-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (usernameInput) usernameInput.value = btn.dataset.username;
        overlay.classList.remove('aff-ut-active');
      });
    });

    overlay.classList.add('aff-ut-active');
  }

  // ── Créer un affilié ──
  if (createBtn) {
    createBtn.addEventListener('click', async function() {
      if (!usernameInput) return;
      const username = usernameInput.value.trim().toLowerCase();
      const err = validateUsername(username);
      if (err) { createError.textContent = err; createError.style.display = 'block'; return; }
      createError.style.display = 'none';

      const existing = affiliatesFromSheet.find(function(a) { return a.username === username; });
      if (!existing) {
        const newAff = {
          username,
          clicks: 0,
          totalMoney: 0,
          totalOrders: 0,
          totalOrderValue: 0,
          withdrawStatus: 'none',
          createdAt: new Date().toLocaleDateString('en-US')
        };
        affiliatesFromSheet.push(newAff);

        try {
          const res = await fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'aff-create', email: userEmail, allAffiliates: affiliatesFromSheet, token: localStorage.getItem('userAccountToken') })
          });
          const data = await res.json();
          if (data && data.success === false && data.error === 'USERNAME_TAKEN') {
            affiliatesFromSheet.pop(); // annule l'ajout local optimiste
            showUsernameTakenPopup(data.suggestions);
            return;
          }
        } catch(e) { console.warn('[Affiliation] save failed:', e.message); }
      }

      const link = buildAffLink(username);
      usernameInput.value = '';

      navigator.clipboard.writeText(link).then(function() {
        const orig = createBtn.innerHTML;
        createBtn.innerHTML = '<i class="fi fi-rr-check"></i> Link copied!';
        setTimeout(function() { createBtn.innerHTML = orig; }, 2500);
      }).catch(function() {});

      renderTable(affiliatesFromSheet);
      renderHistory(affiliatesFromSheet);
    });
  }

  // ── Withdraw ──
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', async function() {
      const paypalName  = document.getElementById('aff-paypal-name')?.value.trim()  || '';
      const paypalEmail = document.getElementById('aff-paypal-email')?.value.trim() || '';
      if (!paypalName || !paypalEmail) {
        withdrawError.textContent = 'Please fill in all PayPal fields.';
        withdrawError.style.display = 'block';
        return;
      }
      if (!paypalEmail.includes('@')) {
        withdrawError.textContent = 'Invalid PayPal email.';
        withdrawError.style.display = 'block';
        return;
      }
      withdrawError.style.display = 'none';
      withdrawBtn.disabled = true;
      withdrawBtn.innerHTML = '<div class="plan-spinner"></div> Sending...';

      try {
        const res  = await fetch('/.netlify/functions/save-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'aff-withdraw-request', email: userEmail, paypalName, paypalEmail, token: localStorage.getItem('userAccountToken') })
        });
        const data = await res.json();

        if (data.success) {
          // Marquer le choix withdraw dans localStorage
          const currentAff = affiliatesFromSheet[0];
          if (currentAff) {
            const storageKey = 'aff_chosen_option_' + (currentAff.username || '');
            localStorage.setItem(storageKey, 'withdraw');
          }

          affiliatesFromSheet.forEach(function(a) { a.withdrawStatus = 'pending'; });

          // Masquer promo + divider + message exclusivité
          const rewardPromo  = document.getElementById('aff-reward-promo');
          const dividerOr    = document.getElementById('aff-reward-divider-or');
          const exclusiveMsg = document.getElementById('aff-exclusive-msg');
          if (rewardPromo)  rewardPromo.style.display  = 'none';
          if (dividerOr)    dividerOr.style.display    = 'none';
          if (exclusiveMsg) exclusiveMsg.style.display = 'none';

          // Afficher le statut pending
          if (withdrawForm)   withdrawForm.style.display   = 'none';
          if (withdrawStatus) {
            withdrawStatus.style.display = 'block';
            if (statusBadge) { statusBadge.textContent = '⏳ Pending'; statusBadge.className = 'aff-status-badge'; }
            if (statusMsg)   statusMsg.textContent = 'Your request is being processed by our team.';
          }

          showToastAff('✅ Withdrawal request sent — promo code option hidden.', '#7b3f6e');

        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch(err) {
        withdrawError.textContent = 'Error: ' + err.message;
        withdrawError.style.display = 'block';
        withdrawBtn.disabled = false;
        withdrawBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Send request';
      }
    });
  }

  // ── Sync depuis le sheet au chargement ──
  async function syncFromSheet() {
    if (!userEmail) return;
    const token = localStorage.getItem('userAccountToken');
    try {
      const res  = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aff-get-stats', email: userEmail, token })
      });
      const data = await res.json();
      if (data.success && data.affiliates && data.affiliates.length) {
        affiliatesFromSheet = data.affiliates;

        const cfg = getAffCfg();
        const el  = (id) => document.getElementById(id);

        if (el('aff-txt-commission'))  el('aff-txt-commission').textContent  = cfg.commPct + '%';
        if (el('aff-txt-commission2')) el('aff-txt-commission2').textContent = cfg.commPct + '%';
        if (el('aff-txt-unlock'))      el('aff-txt-unlock').textContent      = cfg.unlockPct + '%';
        if (el('aff-txt-promo-disc'))  el('aff-txt-promo-disc').textContent  = '-' + cfg.promoDisc + '%';
        if (el('aff-th-commission'))   el('aff-th-commission').textContent   = cfg.commPct;
        if (el('aff-txt-jackpot-qty')) el('aff-txt-jackpot-qty').textContent = cfg.jackpotQty;
        if (el('aff-txt-jackpot-amt')) el('aff-txt-jackpot-amt').textContent = '$' + cfg.jackpotAmt.toFixed(2);
        if (el('aff-txt-promo-badge')) el('aff-txt-promo-badge').textContent = '-' + cfg.promoDisc + '%';
        if (el('aff-promo-note'))      el('aff-promo-note').textContent      = 'Use this code on your next order for -' + cfg.promoDisc + '%';
        // ── Pay-per-click config ──
        const payPerClick      = (cfg.payPerClick || 'no').toLowerCase() === 'yes';
        const clicksPerReward  = parseInt(cfg.clicksPerReward)  || 1000;
        const clickRewardAmt   = parseFloat(cfg.clickRewardAmt) || 2;

        // Colonnes click reward dans le tableau
        const thClickCol = el('aff-th-clicks-col');
        const thClickRew = el('aff-th-click-reward-col');
        if (thClickCol) thClickCol.style.display = payPerClick ? '' : 'none';
        if (thClickRew) thClickRew.style.display = payPerClick ? '' : 'none';

        // Bloc KPI click reward
        const clickRewardBlock = el('aff-click-reward-block');
        if (clickRewardBlock) clickRewardBlock.style.display = payPerClick ? '' : 'none';

        if (data.affiliates[0]) {
          const aff    = data.affiliates[0];
          const earned = parseFloat(aff.totalOrderValue || 0) * (cfg.commPct / 100);
          if (el('aff-kpi-clicks'))     el('aff-kpi-clicks').textContent     = aff.clicks || 0;
          if (el('aff-kpi-orders'))     el('aff-kpi-orders').textContent     = aff.totalOrders || 0;
          if (el('aff-kpi-earned'))     el('aff-kpi-earned').textContent     = '$' + earned.toFixed(2);
          if (el('aff-kpi-commission')) el('aff-kpi-commission').textContent = cfg.commPct + '%';

          // ── Click reward logic ──
          if (payPerClick) {
            const totalClicks     = parseInt(aff.clicks || 0);
            const tranchesEarned  = Math.floor(totalClicks / clicksPerReward);
            const clickEarned     = tranchesEarned * clickRewardAmt;
            const progressInTranche = totalClicks % clicksPerReward;
            const pct             = Math.min((progressInTranche / clicksPerReward) * 100, 100);

            // Barre de progression
            const fillEl   = el('aff-click-reward-bar-fill');
            const labelEl  = el('aff-click-reward-progress-label');
            const earnedEl = el('aff-click-reward-earned-val');
            const badgeEl  = el('aff-click-reward-badge');
            const titleEl  = el('aff-click-reward-title');

            if (fillEl)   fillEl.style.width = pct.toFixed(1) + '%';
            if (labelEl)  labelEl.textContent = progressInTranche.toLocaleString() + ' / ' + clicksPerReward.toLocaleString() + ' clicks';
            if (earnedEl) earnedEl.textContent = '$' + clickEarned.toFixed(2);
            if (badgeEl)  badgeEl.textContent  = '$' + clickRewardAmt.toFixed(2) + ' per ' + clicksPerReward.toLocaleString() + ' clicks';
            if (titleEl)  titleEl.textContent  = 'Click reward — ' + totalClicks.toLocaleString() + ' total clicks';

            // Stocker dans le sheet si la valeur a changé
            fetch('/.netlify/functions/save-account', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action:             'aff-update-click-reward',
                email:              userEmail,
                token:              localStorage.getItem('userAccountToken'),
                clickRewardEarned:  clickEarned,
                clicksPerReward:    progressInTranche + ' / ' + clicksPerReward
              })
            }).catch(function() {});
          }
        }

        renderTable(affiliatesFromSheet);
        renderHistory(affiliatesFromSheet);
      }
    } catch(e) { console.warn('[Affiliation] sync failed:', e.message); }
  }

setTimeout(syncFromSheet, 5000);
setInterval(syncFromSheet, 60000);

})();
});

window.addEventListener('load', () => {
  const pathname = window.location.pathname.toLowerCase();
  const isAccountPage = /account/i.test(pathname);
  if (isAccountPage && localStorage.getItem('isLoggedIn') !== 'true') {
    const hideStyle = document.createElement('style');
    hideStyle.innerHTML = `
      body > *:not(#paulPopup):not(#password-reset-popup):not(#email-confirm-popup):not(#account-block-popup):not(#toast) { display: none !important; }
      #paulPopup { display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 999999 !important; }
    `;
    document.head.appendChild(hideStyle);
    setTimeout(() => {
      const overlay = document.getElementById('paulPopup');
      if (overlay) overlay.classList.add('active');
    }, 150);
  }

  window.handleOrderItemClick = function(id) {
    if (!id) return;
    const url = window.getProductUrl ? window.getProductUrl(id) : '/collections/bbw4life-all-product.html';
    console.log(`🖱️ Order History click → ID=${id} | URL=${url}`);
    if (!url || url === '/collections/bbw4life-all-product.html') {
      console.error(`❌ Product ID=${id} not found`);
      return;
    }
    window.location.href = url;
  };
});


/* ================================================================
   FAQ SMART SEARCH
================================================================ */

(function () {

  const searchInput = document.getElementById('faq-search-input');
  if (!searchInput) return;

  let faqData = [];
  let selectedIndex = -1;
  let dropdown = null;

  function createDropdown() {
    dropdown = document.createElement('div');
    dropdown.id = 'faq-suggestions-dropdown';
    dropdown.setAttribute('role', 'listbox');
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(dropdown);
  }

  fetch('faq-data.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      faqData = data;
      createDropdown();
      bindEvents();
    })
    .catch(function () {
      console.warn('CurvaFit FAQ: faq-data.json not found, smart search disabled.');
    });

  function filterData(query) {
    if (!query || query.length < 2) return [];
    var q = query.toLowerCase();
    return faqData.filter(function (item) {
      return item.question.toLowerCase().includes(q) ||
             item.category.toLowerCase().includes(q);
    }).slice(0, 7);
  }

  function highlight(text, query) {
    if (!query) return text;
    var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function showSuggestions(results, query) {
    dropdown.innerHTML = '';
    selectedIndex = -1;

    if (results.length === 0) {
      dropdown.classList.remove('faq-dd--open');
      return;
    }

    results.forEach(function (item, index) {
      var li = document.createElement('div');
      li.className = 'faq-dd-item';
      li.setAttribute('role', 'option');
      li.setAttribute('data-index', index);
      li.setAttribute('data-section', item.section);
      li.setAttribute('data-id', item.id);

      li.innerHTML =
        '<span class="faq-dd-cat">' + item.category + '</span>' +
        '<span class="faq-dd-text">' + highlight(item.question, query) + '</span>' +
        '<span class="faq-dd-arrow">↓</span>';

      li.addEventListener('mousedown', function (e) {
        e.preventDefault();
        goToQuestion(item);
      });

      dropdown.appendChild(li);
    });

    dropdown.classList.add('faq-dd--open');
  }

  function closeDropdown() {
    if (dropdown) {
      dropdown.classList.remove('faq-dd--open');
      selectedIndex = -1;
    }
  }

  function goToQuestion(item) {
    closeDropdown();
    searchInput.value = item.question;

    var section = document.getElementById(item.section);
    if (!section) return;

    var accordionItems = section.querySelectorAll('.accordion-item');
    var targetItem = null;

    accordionItems.forEach(function (acc) {
      var btn = acc.querySelector('.accordion-header');
      if (btn && btn.textContent.trim().toLowerCase().includes(
        item.question.toLowerCase().substring(0, 30)
      )) {
        targetItem = acc;
      }
    });

    if (!targetItem && accordionItems.length > 0) {
      var idx = faqData.filter(function(d){ return d.section === item.section; })
                       .findIndex(function(d){ return d.id === item.id; });
      targetItem = accordionItems[idx] || accordionItems[0];
    }

    if (targetItem) {
      section.querySelectorAll('.accordion-item.active').forEach(function (a) {
        a.classList.remove('active');
        var content = a.querySelector('.accordion-content');
        if (content) content.style.display = 'none';
      });

      targetItem.classList.add('active');
      var content = targetItem.querySelector('.accordion-content');
      if (content) content.style.display = 'block';

      setTimeout(function () {
        var offset = 120;
        var top = targetItem.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });

        targetItem.classList.add('faq-item--highlight');
        setTimeout(function () {
          targetItem.classList.remove('faq-item--highlight');
        }, 2000);
      }, 100);
    }
  }

  function navigateDropdown(direction) {
    var items = dropdown.querySelectorAll('.faq-dd-item');
    if (!items.length) return;

    if (selectedIndex >= 0) {
      items[selectedIndex].classList.remove('faq-dd-item--active');
    }

    selectedIndex += direction;

    if (selectedIndex < 0) selectedIndex = items.length - 1;
    if (selectedIndex >= items.length) selectedIndex = 0;

    items[selectedIndex].classList.add('faq-dd-item--active');
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }

  function bindEvents() {

    searchInput.addEventListener('input', function () {
      var query = this.value.trim();
      var results = filterData(query);
      showSuggestions(results, query);

      var clearBtn = document.getElementById('faq-search-clear');
      if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
    });

    searchInput.addEventListener('keydown', function (e) {
      if (!dropdown.classList.contains('faq-dd--open')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateDropdown(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateDropdown(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0) {
          var items = dropdown.querySelectorAll('.faq-dd-item');
          if (items[selectedIndex]) {
            var id = items[selectedIndex].getAttribute('data-id');
            var item = faqData.find(function (d) { return d.id === id; });
            if (item) goToQuestion(item);
          }
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#faq-search-input') &&
          !e.target.closest('#faq-suggestions-dropdown')) {
        closeDropdown();
      }
    });

    var clearBtn = document.getElementById('faq-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        this.style.display = 'none';
        closeDropdown();
        var countEl = document.getElementById('faq-search-count');
        if (countEl) countEl.style.display = 'none';
        document.querySelectorAll('.accordion-item').forEach(function (i) {
          i.style.display = '';
        });
        document.querySelectorAll('.faq-category').forEach(function (c) {
          c.style.display = '';
        });
      });
    }
  }

})();







const storyForm = document.getElementById('story-form');
if (storyForm) {

  const ratingStars = document.querySelectorAll('#story-rating i');
  const ratingInput = document.getElementById('story-rating-value');
  if (ratingStars.length) {
    ratingStars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.val);
        ratingInput.value = val;
        ratingStars.forEach((s, i) => {
          s.className = i < val ? 'fi fi-sr-star' : 'fi fi-rr-star';
        });
      });
      star.addEventListener('mouseover', () => {
        const val = parseInt(star.dataset.val);
        ratingStars.forEach((s, i) => {
          s.className = i < val ? 'fi fi-sr-star' : 'fi fi-rr-star';
        });
      });
      star.addEventListener('mouseout', () => {
        const val = parseInt(ratingInput.value);
        ratingStars.forEach((s, i) => {
          s.className = i < val ? 'fi fi-sr-star' : 'fi fi-rr-star';
        });
      });
    });
  }

  storyForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = storyForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    const fileInput = storyForm.querySelector('input[type="file"]');

    let photoBase64 = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      photoBase64 = await new Promise((resolve) => {
        const file = fileInput.files[0];
        const img  = new Image();
        const url  = URL.createObjectURL(file);
        img.onload = () => {
          const MAX = 200;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
          else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
          const canvas  = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          URL.revokeObjectURL(url);
          resolve(compressed);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
        img.src = url;
      });
    }

    const nameAgeRaw = storyForm.querySelector('[name="firstName"]').value.trim();
    const commaIdx   = nameAgeRaw.indexOf(',');
    const firstName  = commaIdx !== -1 ? nameAgeRaw.slice(0, commaIdx).trim() : nameAgeRaw;
    const age        = commaIdx !== -1 ? nameAgeRaw.slice(commaIdx + 1).trim() : '';

    const getData = (name) => {
      const el = storyForm.querySelector(`[name="${name}"]`);
      return el ? el.value.trim() : '';
    };

    const payload = {
      firstName,
      age,
      email:               getData('email'),
      country:             getData('country'),
      bodyPressureDuration: getData('bodyPressureDuration'),
      bbwHelped:           getData('bbwHelped'),
      discoveredWhen:      getData('discoveredWhen'),
      selfChange:          getData('selfChange'),
      wordToday:           getData('wordToday'),
      toldBefore:          getData('toldBefore'),
      story:               getData('story'),
      mentalQuote:         document.getElementById('mental-quote-input')?.value.trim() || '',
      rating:              document.getElementById('story-rating-value')?.value || '5',
      photo:               photoBase64,
      anonymous:           document.getElementById('anonymous-checkbox')?.checked ? 'true' : 'false'
    };

    try {
      const res  = await fetch('/.netlify/functions/story-share', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        btn.textContent = '✅ Story sent!';
        storyForm.reset();
        ratingStars.forEach(s => s.className = 'fi fi-rr-star');
        if (ratingInput) ratingInput.value = '5';

        // ── Show success popup ──
        const overlay = document.createElement('div');
        overlay.id = 'story-success-overlay';
        overlay.innerHTML = `
          <div id="story-success-popup">
            <div class="ssp-top-line"></div>
            <div class="ssp-orb-1"></div>
            <div class="ssp-orb-2"></div>
            <div class="ssp-icon-wrap">💌</div>
            <span class="ssp-label">Story Received</span>
            <h2 class="ssp-title">
              Thank You for<br>
              <em>Sharing Your Story</em>
            </h2>
            <div class="ssp-stars">
              <i class="fi fi-sr-star"></i>
              <i class="fi fi-sr-star"></i>
              <i class="fi fi-sr-star"></i>
              <i class="fi fi-sr-star"></i>
              <i class="fi fi-sr-star"></i>
            </div>
            <div class="ssp-divider">
              <span></span>
              <i class="fi fi-rr-heart"></i>
              <span></span>
            </div>
            <p class="ssp-text">
              Your story is <strong>powerful</strong>, and it matters more than you know.<br>
              Every word you shared has the potential to change a woman's life.
            </p>
            <div class="ssp-note">
              ✨ Your story will be <strong>reviewed by our team</strong> and published on the BBW4LIFE page once approved — so other women can read it, feel seen, and find the courage they need.
            </div>
            <button class="ssp-close-btn" id="ssp-close">
              <i class="fi fi-rr-heart"></i>
              Beautiful — I Can't Wait!
            </button>
          </div>`;

        document.body.appendChild(overlay);

        document.getElementById('ssp-close').addEventListener('click', () => {
          overlay.style.transition = 'opacity 0.35s ease';
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 350);
        });

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            overlay.style.transition = 'opacity 0.35s ease';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 350);
          }
        });

        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 4000);

      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      btn.textContent = '❌ Error — try again';
      btn.disabled = false;
      console.error(err);
    }
  });
}

// ── LOAD COMMUNITY STORIES ──
async function loadCommunityStories() {
  const grid = document.querySelector('#detailed-testimonials .dt-grid');
  if (!grid) return;

  try {
    const res  = await fetch('/.netlify/functions/story-share');
    const data = await res.json();

    if (!data.success || !data.stories.length) return;

    data.stories.forEach(s => {
      const country      = s.country ? ` — ${s.country}` : '';
      const nameStr      = s.age ? `${s.firstName}, ${s.age}${country}` : `${s.firstName}${country}`;
      const discoveredWhen = s.discoveredWhen ? ` · ${s.discoveredWhen}` : '';
      const ratingInt    = parseInt(s.rating || 5);

      const avatarHTML = s.photo
        ? `<div class="dt-avatar-wrap">
            <img src="${s.photo}" alt="${s.firstName}">
            <div class="dt-avatar-ring"></div>
           </div>`
        : `<div class="dt-avatar-wrap">
            <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#c0385e,#7b3f6e);display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;color:#fff;">
              ${s.firstName ? s.firstName.charAt(0).toUpperCase() : '?'}
            </div>
            <div class="dt-avatar-ring"></div>
           </div>`;

      const numbersHTML = s.bodyPressureDuration
        ? `<div class="dt-numbers">
            <div class="dt-num"><span>${s.bodyPressureDuration}</span><small>Body pressure started</small></div>
            <div class="dt-arrow-wrap">
              <div class="dt-arrow-line"></div>
              <svg class="dt-arrow-svg" viewBox="0 0 36 14" fill="none"><path d="M0 7 H30 M23 1 L30 7 L23 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="dt-num dt-num--result"><span>Today</span><small>Fully herself</small></div>
            <div class="dt-num dt-num--waist"><span>${s.wordToday || ''}</span><small>One word today</small></div>
           </div>`
        : '';

      const progressPct  = Math.min(95, 60 + (ratingInt * 7));

      const toldBeforeHTML = s.toldBefore
        ? `<div class="dt-prev">
            <span class="dt-prev-label">What she was told before:</span>
            ${s.toldBefore}
           </div>`
        : '';

      const mentalHTML = s.mentalQuote
        ? `<div class="dt-mental"><i class="fi fi-rr-heart"></i><span>"${s.mentalQuote}"</span></div>`
        : '';

      const starsHTML = [1,2,3,4,5].map(i =>
        `<i class="${i <= ratingInt ? 'fi fi-sr-star' : 'fi fi-rr-star'}"></i>`
      ).join('');

      const card = document.createElement('div');
      card.className = 'dt-card';
      // ← PAS de data-os-reveal pour éviter opacity:0 bloqué
      card.style.opacity = '1';
      card.style.transform = 'none';

      card.innerHTML = `
        <div class="dt-shine"></div>
        <div class="dt-header">
          ${avatarHTML}
          <div>
            <h3>${nameStr}</h3>
            <span class="dt-tag dt-tag--beginner"><i class="fi fi-rr-seedling"></i> Discovered BBW4LIFE${discoveredWhen}</span>
          </div>
        </div>
        ${numbersHTML}
        <div class="dt-progress-wrap">
          <div class="dt-progress-label">
            <span>Self-acceptance journey</span>
            <span class="dt-progress-pct">${s.selfChange || 'Growing'} ✦</span>
          </div>
          <div class="dt-progress-bar">
            <div class="dt-progress-fill" style="--fill-w: ${progressPct}%;"></div>
          </div>
        </div>
        ${toldBeforeHTML}
        <p class="dt-quote">"${s.story}"</p>
        ${mentalHTML}
        <div class="dt-footer">
          <div class="rating">${starsHTML}</div>
          <span class="dt-verified"><i class="fi fi-rr-shield-check"></i> Verified</span>
        </div>
        ${s.date ? `<small style="font-size:0.72rem;color:var(--os-muted);display:block;margin-top:8px;">Shared on ${s.date}</small>` : ''}`;

      grid.appendChild(card);
    });

  } catch (err) {
    console.warn('Community stories could not load:', err);
  }
}

loadCommunityStories();



function capDisplayStock(realStock) {
  if (realStock <= 50)      return realStock;
  if (realStock <= 200)     return Math.round(realStock * 0.60);
  if (realStock <= 1000)    return Math.round(realStock * 0.35);
  if (realStock <= 5000)    return Math.round(realStock * 0.15);
  if (realStock <= 20000)   return Math.round(realStock * 0.06);
  if (realStock <= 100000)  return Math.round(realStock * 0.025);
  if (realStock <= 500000)  return Math.round(realStock * 0.008);
  if (realStock <= 1000000) return Math.round(realStock * 0.003);
  return Math.round(realStock * 0.001);
}



function initStockBar(cjId) {
    const block = document.getElementById('pp-stock-block');
    const label = document.getElementById('pp-stock-label');
    const fill  = document.getElementById('pp-stock-bar-fill');
    const hint  = document.getElementById('pp-stock-hint');
    const imgBadge = document.querySelector('.pp-stock-image-badge');
    if (!block || !label || !fill || !hint) return;

    fetch(`/.netlify/functions/get-product-stock?cj_id=${cjId}`)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            block.classList.remove('loading');

            if (!data.success || data.totalStock === null) {
                block.classList.add('error');
                if (imgBadge) imgBadge.style.display = 'none';
                return;
            }

            const settings_stock = (window.__allProducts || []).find(p => p.type === 'settings') || {};
              const inventoryMode = (settings_stock.inventory_display_mode || 'anderson').toLowerCase().trim();
              const stock = inventoryMode === 'francenel' ? data.totalStock : capDisplayStock(data.totalStock);
              let level, pct, hintText;

              if (inventoryMode === 'francenel') {
                  // Comportement original intact
                  if (stock > 200) {
                      level    = 'high';
                      pct      = 100;
                      hintText = 'High demand — order yours before it sells out!';
                  } else if (stock > 100) {
                      level    = 'medium';
                      pct      = Math.round((stock / 200) * 100);
                      hintText = 'Selling fast — grab yours while you can!';
                  } else {
                      level    = 'low';
                      pct      = Math.max(8, Math.round((stock / 100) * 50));
                      hintText = '⚠️ Almost gone — don\'t miss out!';
                  }
              } else {
                  // Mode anderson — barre proportionnelle au stock affiché
                  if (stock > 1000) {
                      level    = 'high';
                      pct      = 100;
                      hintText = 'High demand — order yours before it sells out!';
                  } else if (stock > 400) {
                      level    = 'medium';
                      pct      = Math.round((stock / 1000) * 100);
                      hintText = 'Selling fast — grab yours while you can!';
                  } else if (stock > 200) {
                      level    = 'medium-low';
                      pct      = Math.round((stock / 400) * 60);
                      hintText = 'Limited stock — order soon!';
                  } else if (stock > 100) {
                      level    = 'low';
                      pct      = Math.round((stock / 200) * 40);
                      hintText = '⚠️ Almost gone — don\'t miss out!';
                  } else {
                      level    = 'critical';
                      pct      = Math.max(8, Math.round((stock / 100) * 25));
                      hintText = '🔴 Last units — order now!';
                  }
              }

            // Label
            label.className = 'pp-stock-label stock--' + level;
            label.innerHTML =
                '<span>Only </span>' +
                '<span class="pp-stock-qty">' + stock + '</span>' +
                '<span> units left</span>';

            // Barre
            fill.className   = 'pp-stock-bar-fill stock--' + level;
            fill.style.width = pct + '%';

            // Hint
            hint.textContent = hintText;

            // Badge (coin superieur droit de l'image) — meme palier "level"
            // que la barre de stock ci-dessus, juste un texte plus court.
            if (imgBadge) {
                const showBadge = (settings_stock.show_stock_image_badge || 'yes').toLowerCase().trim() === 'yes';
                if (showBadge) {
                    imgBadge.className = 'pp-stock-image-badge stock--' + level;
                    imgBadge.textContent = 'In stock';
                    imgBadge.style.display = '';
                } else {
                    imgBadge.style.display = 'none';
                }
            }
        })
        .catch(function(err) {
            console.warn('[StockBar] Could not load stock:', err);
            block.classList.add('error');
            if (imgBadge) imgBadge.style.display = 'none';
        });
}


/* ================================================================
   BBW4LIFE AI CHATBOT — FRONTEND JS
================================================================ */
document.addEventListener('DOMContentLoaded', function () {
  (function () {
    'use strict';

    /* ── DOM refs ── */
    const widget   = document.getElementById('cf-chat-widget');
    const toggle   = document.getElementById('cf-chat-toggle');
    const window_  = document.getElementById('cf-chat-window');
    const messages = document.getElementById('cf-messages');
    const input    = document.getElementById('cf-input');
    const sendBtn  = document.getElementById('cf-send-btn');
    const typing   = document.getElementById('cf-typing');
    const closeBtn = document.getElementById('cf-close-btn');
    const chips    = document.querySelectorAll('.cf-chip');
    const iconOpen  = toggle ? toggle.querySelector('.cf-icon-open')  : null;
    const iconClose = toggle ? toggle.querySelector('.cf-icon-close') : null;
    const notifDot  = toggle ? toggle.querySelector('.cf-notif-dot')  : null;

    const imageBtn       = document.getElementById('cf-image-btn');
    const imageInput     = document.getElementById('cf-image-input');
    const imagePreview   = document.getElementById('cf-image-preview');
    const imagePreviewImg= document.getElementById('cf-image-preview-img');
    const imageRemoveBtn = document.getElementById('cf-image-remove-btn');

    const subscribeRow = document.getElementById('cf-subscribe-row');
    const subscribeBtn = document.getElementById('cf-subscribe-btn');

    if (!widget || !toggle || !window_ || !messages || !input || !sendBtn) return;

    /* ── Position par défaut mobile : à droite (au lieu de gauche), sans
       toucher au système de drag existant. La classe .cf-right doit être
       posée dès le départ pour que .cf-chat-window s'ouvre vers la gauche
       et reste bien dans l'écran, cf. #cf-chat-widget.cf-right en CSS.
       #cf-chat-toggle est un FRÈRE de #cf-chat-widget dans le DOM (pas un
       enfant) — la classe doit donc aussi être posée sur le bouton
       lui-même pour que les règles CSS #cf-chat-widget.cf-right
       #cf-chat-toggle... puissent s'appliquer. Un drag utilisateur écrase
       ensuite naturellement cette classe via updateWindowPos(), donc le
       déplacement libre reste inchangé. ── */
    if (window.innerWidth <= 480) {
      widget.classList.add('cf-right');
      toggle.classList.add('cf-right');
    }

    /* ── State ── */
    let isOpen    = false;
    let isLoading = false;
    let notifShown = false;
    let pendingImageBase64 = null;

    /* Persistance sessionStorage */
    let conversationHistory = [];
    try { conversationHistory = JSON.parse(sessionStorage.getItem('cf_history') || '[]'); } catch(e) {}

    /* ── Client-side language detection ── */
    function detectUILanguage(text) {
      const t = (text || '').toLowerCase().trim();

      const frWords = ['je','tu','il','elle','nous','vous','les','des','une','est','sont','avec','dans','pour','sur','très','bien','aussi','mais','comment','quand','bonjour','merci','oui','salut','bonsoir','pourquoi','quoi','quel','quelle','cette','ce','mon','ma','mes','leur','leurs'];
      const esWords = ['yo','tú','él','ella','nosotros','los','las','con','por','para','sobre','más','también','pero','porque','qué','cómo','cuándo','dónde','hola','gracias','sí','señor','señora','buenas','buenos','tiene','tengo','quiero','necesito','puedo','comprar','precio','envío','producto'];
      const enWords = ['i','you','he','she','it','we','they','the','and','for','with','this','that','what','how','when','where','why','who','which','have','your','want','need','does','can','would','could','should','hello','hi','hey','thank','please'];

      const words = t.split(/\s+/);
      let frScore = 0, esScore = 0, enScore = 0;

      words.forEach(w => {
        const clean = w.replace(/[^a-záàâçèêëéíîïóôùûüñú]/gi, '');
        if (frWords.includes(clean)) frScore += 2;
        if (esWords.includes(clean)) esScore += 2;
        if (enWords.includes(clean)) enScore += 1;
      });

      if (/[áéíóúüñ¿¡]/.test(t)) esScore += 3;
      if (/[àâçèêëîïôùûü]/.test(t)) frScore += 3;

      if (frScore === 0 && esScore === 0 && enScore === 0) return 'en';
      if (frScore >= esScore && frScore >= enScore) return 'fr';
      if (esScore > frScore && esScore >= enScore) return 'es';
      return 'en';
    }

    /* Welcome messages per language — Berline / BBW4LIFE */
    const welcomeMessages = {
      fr: `Salut ! 👋 Je suis **Berline**, ta styliste personnelle BBW4LIFE !\n\nJe suis là pour t'aider avec :\n- 👗 Mode & style plus size\n- 💄 Beauté & soins\n- 👟 Chaussures & accessoires\n- 🛍️ Recommandations de produits\n\nComment puis-je t'aider aujourd'hui ? 😊`,
      es: `¡Hola! 👋 Soy **Berline**, tu estilista personal de BBW4LIFE!\n\nEstoy aquí para ayudarte con:\n- 👗 Moda & estilo plus size\n- 💄 Belleza & cuidado personal\n- 👟 Zapatos & accesorios\n- 🛍️ Recomendaciones de productos\n\n¿En qué puedo ayudarte hoy? 😊`,
      en: `Hi! 👋 I'm **Berline**, your personal BBW4LIFE stylist!\n\nI'm here to help you with:\n- 👗 Plus size fashion & style\n- 💄 Beauty & skincare\n- 👟 Shoes & accessories\n- 🛍️ Product recommendations\n\nWhat can I help you with today? 😊`
    };

    /* ══════════════════════════════════════
       DRAG — inchangé
    ══════════════════════════════════════ */
    (function initDrag() {
      let isDragging = false;
      let startX, startY, origLeft, origBottom, hasMoved;

      function applyPosition(left, bottom) {
        toggle.style.left   = left   + 'px';
        toggle.style.bottom = bottom + 'px';
        toggle.style.right  = 'auto';
        toggle.style.top    = 'auto';
        widget.style.left   = left   + 'px';
        widget.style.bottom = bottom + 'px';
        widget.style.right  = 'auto';
        widget.style.top    = 'auto';
        updateWindowPos(left, bottom);
      }

      // Exposé pour le widgets dock (widgets-loader.js) : quand le dock
      // s'ouvre, #cf-chat-toggle change de place à l'écran (il sort du
      // dock collé à droite) mais #cf-chat-widget (la fenêtre de chat)
      // garde sa position CSS par défaut, indépendante — sans ceci, le
      // chat s'ouvrirait visuellement déconnecté du bouton qui l'a ouvert.
      window.__cfSyncToTogglePosition = function () {
        const rect = toggle.getBoundingClientRect();
        applyPosition(rect.left, window.innerHeight - rect.bottom);
      };

      function startDrag(clientX, clientY) {
        isDragging = true;
        hasMoved   = false;
        startX     = clientX;
        startY     = clientY;
        const rect = toggle.getBoundingClientRect();
        origLeft   = rect.left;
        origBottom = window.innerHeight - rect.bottom;
        widget.classList.add('cf-dragging');
        // Ne fige PAS la position ici : un simple tap (ouvrir/fermer le
        // chat, jamais déplacé) ne doit jamais convertir la position CSS
        // par défaut (ex: right:4px en mobile) en left:Xpx inline — ça
        // cassait l'alignement à droite dès le premier tap. La position
        // n'est appliquée que si un vrai mouvement est détecté, dans moveDrag().
      }

      function moveDrag(clientX, clientY) {
        if (!isDragging) return;
        const dx = clientX - startX;
        const dy = clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
        if (!hasMoved) return;
        const bW = toggle.offsetWidth;
        const bH = toggle.offsetHeight;
        const nl = Math.max(8, Math.min(window.innerWidth  - bW - 8, origLeft + dx));
        const nb = Math.max(8, Math.min(window.innerHeight - bH - 8, origBottom - dy));
        applyPosition(nl, nb);
      }

      /* Mouse */
      toggle.addEventListener('mousedown', (e) => {
        startDrag(e.clientX, e.clientY);
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
      document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        widget.classList.remove('cf-dragging');
        if (!hasMoved) { isOpen ? closeChat() : openChat(); }
      });

      /* Touch */
      toggle.addEventListener('touchstart', (e) => {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false });

      toggle.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false });

      toggle.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        isDragging = false;
        widget.classList.remove('cf-dragging');
        if (!hasMoved) { isOpen ? closeChat() : openChat(); }
      }, { passive: false });

    })();

    function updateWindowPos(left, bottom) {
      const isRight = left > window.innerWidth / 2;
      widget.classList.toggle('cf-right', isRight);
      toggle.classList.toggle('cf-right', isRight);
      widget.classList.toggle('cf-top',   bottom > window.innerHeight / 2);
    }

    /* ── Open / Close ── */
    function openChat() {
      // Le bouton peut avoir changé de place sans passer par le drag
      // (ex: sorti du widgets dock — cf. widgets-loader.js) : on
      // resynchronise la position de la fenêtre juste avant de l'ouvrir,
      // plutôt qu'en permanence (sinon la fenêtre, même invisible côté
      // opacity, se retrouve positionnée dans la zone du dock fermé).
      // applyPosition() vit dans la closure initDrag ci-dessus, inaccessible
      // ici directement — on repasse donc par le miroir global déjà exposé.
      if (typeof window.__cfSyncToTogglePosition === 'function') {
        window.__cfSyncToTogglePosition();
      }

      isOpen = true;
      window_.classList.add('cf-open');
      window_.setAttribute('aria-hidden', 'false');
      if (iconOpen)  iconOpen.style.display  = 'none';
      if (iconClose) iconClose.style.display = '';
      if (notifDot)  notifDot.style.display  = 'none';
      input.focus();

      if (messages.children.length === 0) {
        const savedHTML = sessionStorage.getItem('cf_messages_html') || '';
        if (savedHTML) {
          messages.innerHTML = savedHTML;
          reattachCardEvents();
          scrollToBottom();
          const chipsEl = document.getElementById('cf-quick-chips');
          if (chipsEl && conversationHistory.length > 0) chipsEl.style.display = 'none';
        } else {
          addWelcomeMessage();
        }
      }
    }

    function closeChat() {
      isOpen = false;
      window_.classList.remove('cf-open');
      window_.setAttribute('aria-hidden', 'true');
      if (iconOpen)  iconOpen.style.display  = '';
      if (iconClose) iconClose.style.display = 'none';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeChat);

    /* Notif dot after 3s */
    setTimeout(() => {
      if (!isOpen && !notifShown && notifDot) {
        notifDot.style.display = 'block';
        notifShown = true;
      }
    }, 3000);

    /* ── Welcome ── */
    function addWelcomeMessage() {
      addMessage(welcomeMessages['en'], 'ai', [], null, [], null);
    }

    /* ══════════════════════════════════════
       FORMAT MARKDOWN + Promo Code Highlighting
    ══════════════════════════════════════ */
    function formatMarkdown(text) {
      /* Strip any raw internal product IDs that might leak */
      const internalIds = [
        'Pdg-Francenel-product1','Pdg-Francenel-product2','Pdg-Francenel-product3',
        'Pdg-Francenel-product4','Pdg-Francenel-product5','Pdg-Francenel-product6',
        'Pdg-Francenel-product7','Pdg-Francenel-product8','Pdg-Francenel-product9',
        'Pdg-Francenel-product10','Pdg-Francenel-product11','Pdg-Francenel-product12',
        'Pdg-Francenel-product13','Pdg-Francenel-product14','Pdg-Francenel-product15',
        'Pdg-Francenel-product16','Pdg-Francenel-product17','Pdg-Francenel-product18',
        'Pdg-Francenel-product19','Pdg-Francenel-product20','Pdg-Francenel-product21',
        'Pdg-Francenel-product22','Pdg-Francenel-product23','Pdg-Francenel-product24',
        'Pdg-Francenel-product25','Pdg-Francenel-product26','Pdg-Francenel-product27',
        'Pdg-Francenel-product28','Pdg-Francenel-product29','Pdg-Francenel-product30',
        'Pdg-Francenel-product31','Pdg-Francenel-product32','Pdg-Francenel-product33',
        'Pdg-Francenel-product34','Pdg-Francenel-product35','Pdg-Francenel-product36',
        'Pdg-Francenel-product37','Pdg-Francenel-product38','Pdg-Francenel-product39',
        'Pdg-Francenel-product40','Pdg-Francenel-product41','Pdg-Francenel-product42',
        'Pdg-Francenel-product43','Pdg-Francenel-product44','Pdg-Francenel-product45',
        'Pdg-Francenel-product46','Pdg-Francenel-product47','Pdg-Francenel-product48',
        'Pdg-Francenel-product49','Pdg-Francenel-product50','Pdg-Francenel-product51',
        'Pdg-Francenel-product52','Pdg-Francenel-product53','Pdg-Francenel-product54',
        'Pdg-Francenel-product55','Pdg-Francenel-product56','Pdg-Francenel-product57',
        'Pdg-Francenel-product58','Pdg-Francenel-product59','Pdg-Francenel-product60',
        'Pdg-Francenel-product61','Pdg-Francenel-product62','Pdg-Francenel-product63',
        'Pdg-Francenel-product64','Pdg-Francenel-product65','Pdg-Francenel-product66',
        'Pdg-Francenel-product67','Pdg-Francenel-product68',
        'Pdg-Francenel-product69','Pdg-Francenel-product70','Pdg-Francenel-product71',
        'Pdg-Francenel-product72','Pdg-Francenel-product73','Pdg-Francenel-product74',
        'Pdg-Francenel-product75',
        'Pdg-Francenel-product98','Pdg-Francenel-product99','Pdg-Francenel-product100',
        'Pdg-Francenel-product101','Pdg-Francenel-product102','Pdg-Francenel-product103',
        'Pdg-Francenel-product104','Pdg-Francenel-product105','Pdg-Francenel-product106',
        'Pdg-Francenel-product107','Pdg-Francenel-product108','Pdg-Francenel-product109',
        'Pdg-Francenel-product110'
      ];
      let out = text;
      internalIds.forEach(id => {
        out = out.replace(new RegExp('\\b' + id + '\\b', 'gi'), '');
      });

      /* Render [[CODE]] as a highlighted promo badge */
      out = out.replace(/\[\[([A-Z0-9_-]+)\]\]/g, (match, code) => {
        return `<span class="cf-promo-code" data-code="${code}" title="Click to copy">${code}<svg class="cf-promo-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></span>`;
      });

      out = out.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (match, label, url) => {
          if (url.startsWith('/') || url.startsWith('http')) {
            return `<a href="${url}" class="cf-link-btn" target="${url.startsWith('http') ? '_blank' : '_self'}">${label} →</a>`;
          }
          return `<strong>${label}</strong>`;
        }
      );

      /* Auto-linkify known BBW4LIFE page paths */
      out = out.replace(
        /(\/products\/product\d+\.html|\/page\/contact\.html|\/collections\/bbw4life-all-product\.html|\/page\/about\.html|\/account\.html|\/page\/order-tracking\.html)/g,
        (url) => {
          const labels = {
            '/page/contact.html':                      'Contact us',
            '/collections/bbw4life-all-product.html':  'Shop All',
            '/page/about.html':                        'About Us',
            '/account.html':                           'My Account',
            '/page/order-tracking.html':               'Order Tracking',
          };
          const label = labels[url] || 'View';
          return `<a href="${url}" class="cf-link-btn">${label} →</a>`;
        }
      );

     out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (match, alt, src) => {
      return `<img src="${src}" alt="${alt}" class="cf-founder-img" style="width:100%;max-width:220px;border-radius:12px;display:block;margin:8px auto;border:2px solid rgba(201,150,62,0.40);">`;
    });

    return out
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<strong>$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       '<code>$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g,   '<br>');
    }

    function getTime() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* Copy promo code on click */
    function attachPromoCodeCopyEvents(container) {
      container.querySelectorAll('.cf-promo-code').forEach(el => {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          const code = this.dataset.code;
          if (!code) return;
          navigator.clipboard.writeText(code).then(() => {
            this.classList.add('cf-promo-code--copied');
            const originalHTML = this.innerHTML;
            this.innerHTML = code + ' ✓ Copied!';
            setTimeout(() => {
              this.classList.remove('cf-promo-code--copied');
              this.innerHTML = originalHTML;
            }, 2000);
          }).catch(() => {
            const range = document.createRange();
            range.selectNode(this);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
          });
        });
      });
    }

    /* Reattach events on cards restored from sessionStorage */
    function reattachCardEvents() {
      document.querySelectorAll('.cf-product-card').forEach(card => {
        const mainImg    = card.querySelector('.cf-pc-img');
        const swatches   = card.querySelectorAll('.cf-pc-swatch');
        const colorLabel = card.querySelector('.cf-pc-color-label');
        const productUrl = card.dataset.productUrl;

        if (mainImg && productUrl) {
          mainImg.style.cursor = 'pointer';
          mainImg.onclick = () => window.location.href = productUrl;
        }

        swatches.forEach(sw => {
          const activate = () => {
            swatches.forEach(s => s.classList.remove('cf-pc-swatch--active'));
            sw.classList.add('cf-pc-swatch--active');
            if (colorLabel) colorLabel.textContent = sw.dataset.name;
            if (mainImg && sw.dataset.img && sw.dataset.img !== 'undefined' && sw.dataset.img !== '') {
              mainImg.src = sw.dataset.img;
            }
          };
          sw.addEventListener('mouseenter', activate);
          sw.addEventListener('click',      activate);
        });
      });

      attachPromoCodeCopyEvents(messages);
    }

    /* ══════════════════════════════════════
       ADD MESSAGE
       pageButtons: array of { url, label, icon }
    ══════════════════════════════════════ */
    function addMessage(text, role, products, contactInfo, pageButtons, founderPhoto, attachedImage) {
      const msgEl  = document.createElement('div');
      msgEl.className = `cf-message cf-message--${role}`;

      if (role === 'user' && attachedImage) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'cf-msg-image-wrap';
        imgWrap.innerHTML = `<img src="${attachedImage}" alt="Attached image" class="cf-msg-image">`;
        msgEl.appendChild(imgWrap);
      }

      const bubble = document.createElement('div');
      bubble.className = 'cf-msg-bubble';
      bubble.innerHTML = formatMarkdown(text);
      msgEl.appendChild(bubble);

      attachPromoCodeCopyEvents(bubble);

      /* ── Founder photo ── */
      if (role === 'ai' && founderPhoto && founderPhoto.url && (!products || products.length === 0)) {
        const photoWrap = document.createElement('div');
        photoWrap.className = 'cf-founder-photo-wrap';
        photoWrap.innerHTML = `
          <img
            src="${founderPhoto.url}"
            alt="${founderPhoto.name}"
            class="cf-founder-img"
            loading="lazy"
            onerror="this.closest('.cf-founder-photo-wrap').style.display='none'"
          >
          <p class="cf-founder-caption">${founderPhoto.name} — ${founderPhoto.title}</p>
        `;
        msgEl.appendChild(photoWrap);
      }

      /* ── Product cards ── */
      if (role === 'ai' && Array.isArray(products) && products.length > 0) {
        const cardsWrap = document.createElement('div');
        cardsWrap.className = 'cf-product-cards';

        products.forEach(p => {
          const card = document.createElement('div');
          card.className = 'cf-product-card';
          card.dataset.productUrl = p.url;

          let imgHTML = '';
          if (p.image) {
            imgHTML = `
              <div class="cf-pc-img-wrap">
                <img class="cf-pc-img" src="${p.image}" alt="${p.title}" loading="lazy"
                     onerror="this.closest('.cf-pc-img-wrap').style.display='none'">
              </div>`;
          }

          const ratingHTML = p.rating
            ? `<div class="cf-pc-rating">⭐ ${p.rating}/5</div>`
            : '';

          const priceHTML = `
            <div class="cf-pc-price">
              <span class="cf-pc-price-current">$${Number(p.price).toFixed(2)}</span>
              <span class="cf-pc-price-compare">$${Number(p.compare_price).toFixed(2)}</span>
            </div>`;

          let colorsHTML = '';
          if (p.colors && p.colors.length > 0) {
            const swatchesHTML = p.colors.slice(0, 6).map(c => {
              let variantImg = c.image || '';
              if (!variantImg && p.variants) {
                const v = p.variants.find(vv => vv.color === c.name);
                if (v && v.image) variantImg = v.image;
              }
              return `<span
                class="cf-pc-swatch"
                title="${c.name}"
                style="background:${c.hex || '#ccc'}"
                data-img="${variantImg}"
                data-name="${c.name}"
              ></span>`;
            }).join('');
            const moreHTML = p.colors.length > 6
              ? `<span class="cf-pc-swatch-more">+${p.colors.length - 6}</span>` : '';
            colorsHTML = `
              <div class="cf-pc-colors">${swatchesHTML}${moreHTML}</div>
              <div class="cf-pc-color-label"></div>`;
          }

          const sizesHTML = (p.sizes && p.sizes.length > 0)
            ? `<div class="cf-pc-sizes"><strong>Sizes:</strong> ${p.sizes.join(' · ')}</div>` : '';

          const deliveryHTML = (p.delivery)
            ? `<div class="cf-pc-delivery">🚚 ${p.delivery}</div>` : '';

          const ctaHTML = `
            <a href="${p.url}" class="cf-pc-btn" onclick="event.stopPropagation()">
              View Product
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </a>`;

          card.innerHTML = `
            ${imgHTML}
            <div class="cf-pc-info">
              <div class="cf-pc-title">${p.title}</div>
              ${ratingHTML}
              ${priceHTML}
              ${colorsHTML}
              ${sizesHTML}
              ${deliveryHTML}
              ${ctaHTML}
            </div>`;

          const imgEl = card.querySelector('.cf-pc-img');
          if (imgEl) {
            imgEl.style.cursor = 'pointer';
            imgEl.addEventListener('click', (e) => {
              e.stopPropagation();
              window.location.href = p.url;
            });
          }

          const swatches   = card.querySelectorAll('.cf-pc-swatch');
          const colorLabel = card.querySelector('.cf-pc-color-label');
          const mainImg    = card.querySelector('.cf-pc-img');

          swatches.forEach(sw => {
            const activate = () => {
              swatches.forEach(s => s.classList.remove('cf-pc-swatch--active'));
              sw.classList.add('cf-pc-swatch--active');
              if (colorLabel) colorLabel.textContent = sw.dataset.name;
              if (mainImg && sw.dataset.img && sw.dataset.img !== 'undefined' && sw.dataset.img !== '') {
                mainImg.src = sw.dataset.img;
              }
            };
            sw.addEventListener('mouseenter', activate);
            sw.addEventListener('click',      activate);
          });

          cardsWrap.appendChild(card);
        });

        msgEl.appendChild(cardsWrap);
      }

      /* ── Contact buttons ── */
      if (role === 'ai' && contactInfo) {
        const btnsWrap = document.createElement('div');
        btnsWrap.className = 'cf-contact-btns';

        if (contactInfo.whatsapp) {
          const waBtn = document.createElement('a');
          waBtn.href      = contactInfo.whatsapp;
          waBtn.target    = '_blank';
          waBtn.rel       = 'noopener noreferrer';
          waBtn.className = 'cf-contact-btn cf-contact-btn--whatsapp';
          waBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> WhatsApp';
          btnsWrap.appendChild(waBtn);
        }

        if (contactInfo.telegram) {
          const tgBtn = document.createElement('a');
          tgBtn.href      = contactInfo.telegram;
          tgBtn.target    = '_blank';
          tgBtn.rel       = 'noopener noreferrer';
          tgBtn.className = 'cf-contact-btn cf-contact-btn--telegram';
          tgBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> Telegram';
          btnsWrap.appendChild(tgBtn);
        }

        if (contactInfo.page) {
          const pgBtn = document.createElement('a');
          pgBtn.href      = contactInfo.page;
          pgBtn.className = 'cf-contact-btn cf-contact-btn--page';
          pgBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> Contact Page';
          btnsWrap.appendChild(pgBtn);
        }

        if (btnsWrap.children.length > 0) {
          msgEl.appendChild(btnsWrap);
        }
      }

      /* ── PAGE NAVIGATION BUTTONS ── */
      if (role === 'ai' && Array.isArray(pageButtons) && pageButtons.length > 0) {
        const pageWrap = document.createElement('div');
        pageWrap.className = 'cf-page-btns';

        pageButtons.forEach(pb => {
          const btn = document.createElement('a');
          btn.href      = pb.url;
          btn.className = 'cf-page-btn';
          btn.innerHTML = `<span class="cf-page-btn-icon">${pb.icon}</span><span class="cf-page-btn-label">${pb.label}</span><svg class="cf-page-btn-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
          pageWrap.appendChild(btn);
        });

        msgEl.appendChild(pageWrap);
      }

      const time = document.createElement('span');
      time.className  = 'cf-msg-time';
      time.textContent = getTime();
      msgEl.appendChild(time);

      messages.appendChild(msgEl);
      scrollToBottom();

      try { sessionStorage.setItem('cf_messages_html', messages.innerHTML); } catch(e) {}
    }

    function scrollToBottom() {
      messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
    }

    function showTyping() { if (typing) { typing.style.display = 'flex'; scrollToBottom(); } }
    function hideTyping()  { if (typing) typing.style.display = 'none'; }

    /* ── Human escalation inline form ── */
    function addEscalationForm() {
      const msgEl = document.createElement('div');
      msgEl.className = 'cf-message cf-message--ai';

      const bubble = document.createElement('div');
      bubble.className = 'cf-msg-bubble';
      bubble.innerHTML = 'Laisse-moi te connecter à notre équipe — donne-moi juste quelques minutes. Peux-tu me laisser tes coordonnées ? 🙏';
      msgEl.appendChild(bubble);

      const form = document.createElement('form');
      form.className = 'cf-escalation-form';
      form.innerHTML = `
        <input type="text"  name="firstName" placeholder="First name *" required>
        <input type="text"  name="lastName"  placeholder="Last name">
        <input type="email" name="email"     placeholder="Email *" required>
        <input type="tel"   name="phone"     placeholder="WhatsApp (optional)">
        <button type="submit" class="cf-escalation-submit">Send to the team</button>
      `;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('.cf-escalation-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';

        const payload = {
          action:    'human_escalation',
          firstName: form.firstName.value.trim(),
          lastName:  form.lastName.value.trim(),
          email:     form.email.value.trim(),
          phone:     form.phone.value.trim()
        };

        try {
          const res = await fetch('/.netlify/functions/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          try { sessionStorage.setItem('cf_escalated', 'true'); } catch(e) {}
          form.remove();
          addMessage("Merci ! 🙏 J'ai prévenu notre équipe, ils te contactent très bientôt.", 'ai', [], null, []);
        } catch (err) {
          console.error('Escalation error:', err);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send to the team';
          addMessage("Désolée, un petit souci technique. Réessaie dans un instant ! 🙏", 'ai', [], null, []);
        }
      });

      msgEl.appendChild(form);

      const time = document.createElement('span');
      time.className  = 'cf-msg-time';
      time.textContent = getTime();
      msgEl.appendChild(time);

      messages.appendChild(msgEl);
      scrollToBottom();
      try { sessionStorage.setItem('cf_messages_html', messages.innerHTML); } catch(e) {}
    }

    /* ── Send message ── */
    async function sendMessage(userText) {
      const hasImage = !!pendingImageBase64;
      if ((!userText || !userText.trim()) && !hasImage) return;
      if (isLoading) return;
      const text = (userText || '').trim() || (hasImage ? 'What do you think of this?' : '');

      const userLang = detectUILanguage(text);

      const chipsEl = document.getElementById('cf-quick-chips');
      if (chipsEl) chipsEl.style.display = 'none';

      const imageToSend = pendingImageBase64;
      addMessage(text, 'user', [], null, [], null, imageToSend);
      conversationHistory.push({ role: 'user', content: text });
      try { sessionStorage.setItem('cf_history', JSON.stringify(conversationHistory.slice(-20))); } catch(e) {}

      input.value      = '';
      input.style.height = 'auto';
      sendBtn.disabled = true;
      isLoading        = true;
      clearPendingImage();

      showTyping();

      const errorMessages = {
        fr: "Désolée, j'ai un petit problème technique. Réessayez dans un instant! 🙏",
        es: "Lo siento, tengo un pequeño problema técnico. ¡Inténtalo de nuevo en un momento! 🙏",
        en: "Sorry, I'm having a little trouble right now. Please try again in a moment! 🙏"
      };

      try {
        const response = await fetch('/.netlify/functions/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            message: text,
            history: conversationHistory.slice(-8),
            image:   imageToSend || null
          })
        });

        hideTyping();

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const aiReply     = data.reply       || errorMessages[userLang] || errorMessages['en'];
        const products    = data.products    || [];
        const showContact = data.showContact || false;
        const contactInfo = data.contactInfo || null;
        const pageButtons = data.pageButtons || [];

        let escalate = false;
        if (showContact) {
          let count = parseInt(sessionStorage.getItem('cf_contact_count') || '0', 10) + 1;
          try { sessionStorage.setItem('cf_contact_count', String(count)); } catch(e) {}
          escalate = count >= 2 && sessionStorage.getItem('cf_escalated') !== 'true';
        }

        addMessage(aiReply, 'ai', products, showContact ? contactInfo : null, pageButtons, data.founderPhoto || null);
        if (escalate) addEscalationForm();
        conversationHistory.push({ role: 'assistant', content: aiReply });
        try { sessionStorage.setItem('cf_history', JSON.stringify(conversationHistory.slice(-20))); } catch(e) {}

        if (conversationHistory.length > 20) {
          conversationHistory = conversationHistory.slice(-16);
        }

      } catch (err) {
        hideTyping();
        console.error('Chat error:', err);
        addMessage(errorMessages[userLang] || errorMessages['en'], 'ai', [], null, []);
      } finally {
        isLoading        = false;
        sendBtn.disabled = input.value.trim().length === 0 && !pendingImageBase64;
      }
    }

    window.__cfSendMessage = sendMessage;

    /* ── Image attachment ── */
    function clearPendingImage() {
      pendingImageBase64 = null;
      if (imageInput) imageInput.value = '';
      if (imagePreview) imagePreview.style.display = 'none';
      if (imagePreviewImg) imagePreviewImg.src = '';
      sendBtn.disabled = input.value.trim().length === 0;
    }

    if (imageBtn && imageInput) {
      imageBtn.addEventListener('click', () => imageInput.click());

      imageInput.addEventListener('change', () => {
        const file = imageInput.files && imageInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        if (file.size > 5 * 1024 * 1024) {
          alert('Image too large (max 5MB).');
          imageInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          pendingImageBase64 = reader.result;
          if (imagePreviewImg) imagePreviewImg.src = reader.result;
          if (imagePreview) imagePreview.style.display = 'flex';
          sendBtn.disabled = false;
        };
        reader.readAsDataURL(file);
      });
    }

    if (imageRemoveBtn) {
      imageRemoveBtn.addEventListener('click', clearPendingImage);
    }

    /* ── Input handlers ── */
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      sendBtn.disabled  = this.value.trim().length === 0 && !pendingImageBase64;
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage(this.value);
      }
    });

    sendBtn.addEventListener('click', () => {
      if (!sendBtn.disabled) sendMessage(input.value);
    });

    /* ── Quick chips ── */
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const msg = chip.dataset.msg;
        if (msg) {
          input.value      = msg;
          sendBtn.disabled = false;
          sendMessage(msg);
        }
      });
    });

    /* ── Subscribe button (uses existing newsletter popup system) ── */
    function updateSubscribeVisibility() {
      if (!subscribeRow) return;
      const isLoggedIn  = localStorage.getItem('isLoggedIn') === 'true';
      const isSubscribed = localStorage.getItem('bbwnl_subscribed') === 'yes';
      subscribeRow.style.display = (isLoggedIn || isSubscribed) ? 'none' : 'flex';
    }
    updateSubscribeVisibility();
    document.addEventListener('bbwnl:subscribed', updateSubscribeVisibility);

    if (subscribeBtn) {
      subscribeBtn.addEventListener('click', () => {
        if (typeof window.openNewsletterPopup !== 'function') return;
        window.openNewsletterPopup();

        const overlay = document.getElementById('bbwNlOverlay');
        if (!overlay) return;

        let autoCloseTimer = null;
        const observer = new MutationObserver(() => {
          const successEl = document.getElementById('bbwNlSuccess');
          if (successEl && successEl.style.display === 'block' && !autoCloseTimer) {
            observer.disconnect();
            autoCloseTimer = setTimeout(() => {
              if (overlay.classList.contains('bbwnl-active') && typeof window.closeNewsletterPopup === 'function') {
                window.closeNewsletterPopup();
              }
            }, 7000);
          }
        });
        observer.observe(overlay, { attributes: true, childList: true, subtree: true });
      });
    }

    /* ── Keyboard & outside click ── */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) closeChat();
    });

    document.addEventListener('click', e => {
      if (isOpen && !widget.contains(e.target) && !toggle.contains(e.target)) closeChat();
    });

    console.log('✅ BBW4LIFE Chatbot ready — Berline is online (EN/FR/ES + multilingual)');
  })();
});



/* ══════════════════════════════════════════════════════
   BBW4LIFE — COOKIE CONSENT POPUP
   Inject this entire block into script.js
══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const COOKIE_KEY = 'cf_cookie_consent';
  const COOKIE_DAYS = 365;

  /* ── Save consent to localStorage ── */
  function saveConsent(preferences) {
    const payload = {
      date: new Date().toISOString(),
      analytics: preferences.analytics,
      marketing: preferences.marketing,
      necessary: true
    };
    localStorage.setItem(COOKIE_KEY, JSON.stringify(payload));
  }

  /* ── Check if consent already given ── */
  function hasConsent() {
    try {
      const saved = localStorage.getItem(COOKIE_KEY);
      return saved !== null;
    } catch (e) { return false; }
  }

  /* ── Build the popup HTML ── */
  function buildPopup() {
    const el = document.createElement('div');
    el.id = 'cf-cookie-popup';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Cookie preferences');
    el.innerHTML = `
      <div id="cf-cookie-bar">

        <div class="cfck-bar-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10"/>
            <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="8.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="11.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
            <path d="M17 2a5 5 0 0 0 5 5"/>
          </svg>
        </div>

        <p class="cfck-bar-text">
          We use cookies to improve your experience and — with your permission — personalize content. Read our
          <a href="/policies/privacy.html" class="cfck-link">Privacy Policy</a>.
        </p>

        <div class="cfck-bar-actions">
          <button class="cfck-btn cfck-btn--ghost" id="cfck-reject">Reject all</button>
          <button class="cfck-btn cfck-btn--outline" id="cfck-customize">Customize</button>
          <button class="cfck-btn cfck-btn--primary" id="cfck-accept">Accept all</button>
        </div>

        <button class="cfck-close-x" id="cfck-close-x" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div class="cfck-confirm" id="cfck-confirm" aria-live="polite">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="cfck-confirm-text">Preferences saved!</span>
        </div>
      </div>

      <div id="cf-cookie-overlay"></div>
      <div id="cf-cookie-modal">

        <div class="cfck-header">
          <div class="cfck-header-left">
            <div class="cfck-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10"/>
                <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="8.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="11.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
                <path d="M17 2a5 5 0 0 0 5 5"/>
              </svg>
            </div>
            <div>
              <h2 class="cfck-title">Cookie preferences</h2>
              <p class="cfck-subtitle">Choose what you're comfortable sharing</p>
            </div>
          </div>
          <button class="cfck-modal-close-x" id="cfck-modal-close-x" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="cfck-body">
          <div class="cfck-panels" id="cfck-panels">

            <div class="cfck-panel cfck-panel--required">
              <div class="cfck-panel-left">
                <div class="cfck-panel-icon cfck-panel-icon--shield">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <span class="cfck-panel-name">Necessary</span>
                  <span class="cfck-panel-desc">Login, cart, checkout — the site cannot function without these.</span>
                </div>
              </div>
              <span class="cfck-always-badge">Always on</span>
            </div>

            <div class="cfck-panel">
              <div class="cfck-panel-left">
                <div class="cfck-panel-icon cfck-panel-icon--chart">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                </div>
                <div>
                  <span class="cfck-panel-name">Analytics</span>
                  <span class="cfck-panel-desc">Google Analytics — anonymized traffic data to improve our site.</span>
                </div>
              </div>
              <label class="cfck-toggle" aria-label="Toggle analytics cookies">
                <input type="checkbox" id="cfck-analytics" checked>
                <span class="cfck-toggle-track"><span class="cfck-toggle-thumb"></span></span>
              </label>
            </div>

            <div class="cfck-panel">
              <div class="cfck-panel-left">
                <div class="cfck-panel-icon cfck-panel-icon--target">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                </div>
                <div>
                  <span class="cfck-panel-name">Marketing</span>
                  <span class="cfck-panel-desc">Personalized content and relevant offers based on your interests.</span>
                </div>
              </div>
              <label class="cfck-toggle" aria-label="Toggle marketing cookies">
                <input type="checkbox" id="cfck-marketing">
                <span class="cfck-toggle-track"><span class="cfck-toggle-thumb"></span></span>
              </label>
            </div>

          </div>
        </div>

        <div class="cfck-footer">
          <button class="cfck-btn cfck-btn--ghost" id="cfck-reject-modal">Reject all</button>
          <button class="cfck-btn cfck-btn--outline" id="cfck-save">Save preferences</button>
          <button class="cfck-btn cfck-btn--primary" id="cfck-accept-modal">Accept all</button>
        </div>

      </div>
    `;
    return el;
  }

  /* ── Show confirmation then close ── */
  function showConfirmAndClose(msg) {
    const confirm = document.getElementById('cfck-confirm');
    const confirmText = document.getElementById('cfck-confirm-text');
    if (confirm && confirmText) {
      confirmText.textContent = msg;
      confirm.classList.add('cfck-confirm--visible');
      setTimeout(() => {
        closePopup();
      }, 1400);
    } else {
      closePopup();
    }
  }

  /* ── Close popup ── */
  function closePopup() {
    const popup = document.getElementById('cf-cookie-popup');
    if (popup) {
      popup.classList.add('cfck-hiding');
      setTimeout(() => {
        if (popup.parentNode) popup.parentNode.removeChild(popup);
      }, 400);
    }
  }

  /* ── Open the detailed preferences modal ── */
  function openModal() {
    const popup = document.getElementById('cf-cookie-popup');
    if (popup) popup.classList.add('cfck-modal-open');
  }

  /* ── Close the detailed preferences modal (back to the bar) ── */
  function closeModal() {
    const popup = document.getElementById('cf-cookie-popup');
    if (popup) popup.classList.remove('cfck-modal-open');
  }

  /* ── Init ── */
  function init() {
    if (hasConsent()) return;

    const popup = buildPopup();
    document.body.appendChild(popup);

    /* Animate in */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        popup.classList.add('cfck-visible');
      });
    });

    /* Bar: close X → reject and dismiss */
    document.getElementById('cfck-close-x').addEventListener('click', () => {
      saveConsent({ analytics: false, marketing: false });
      showConfirmAndClose('Preferences saved!');
    });

    /* Bar: reject all */
    document.getElementById('cfck-reject').addEventListener('click', () => {
      saveConsent({ analytics: false, marketing: false });
      showConfirmAndClose('All optional cookies rejected.');
    });

    /* Bar: customize → open detailed modal */
    document.getElementById('cfck-customize').addEventListener('click', openModal);

    /* Bar: accept all */
    document.getElementById('cfck-accept').addEventListener('click', () => {
      saveConsent({ analytics: true, marketing: true });
      if (typeof bbwSubscribeGeneral === 'function') bbwSubscribeGeneral();
      showConfirmAndClose('All cookies accepted. Thank you! 🎉');
    });

    /* Modal: close X → back to bar (no consent saved yet) */
    document.getElementById('cfck-modal-close-x').addEventListener('click', closeModal);

    /* Modal overlay click → back to bar */
    document.getElementById('cf-cookie-overlay').addEventListener('click', closeModal);

    /* Modal: reject all */
    document.getElementById('cfck-reject-modal').addEventListener('click', () => {
      const analyticsEl = document.getElementById('cfck-analytics');
      const marketingEl = document.getElementById('cfck-marketing');
      if (analyticsEl) analyticsEl.checked = false;
      if (marketingEl) marketingEl.checked = false;
      saveConsent({ analytics: false, marketing: false });
      showConfirmAndClose('All optional cookies rejected.');
    });

    /* Modal: save preferences */
    document.getElementById('cfck-save').addEventListener('click', () => {
      const analytics = document.getElementById('cfck-analytics')?.checked ?? true;
      const marketing = document.getElementById('cfck-marketing')?.checked ?? false;
      saveConsent({ analytics, marketing });
      if (marketing && typeof bbwSubscribeGeneral === 'function') bbwSubscribeGeneral();
      showConfirmAndClose('Your preferences have been saved!');
    });

    /* Modal: accept all */
    document.getElementById('cfck-accept-modal').addEventListener('click', () => {
      const analyticsEl = document.getElementById('cfck-analytics');
      const marketingEl = document.getElementById('cfck-marketing');
      if (analyticsEl) analyticsEl.checked = true;
      if (marketingEl) marketingEl.checked = true;
      saveConsent({ analytics: true, marketing: true });
      if (typeof bbwSubscribeGeneral === 'function') bbwSubscribeGeneral();
      showConfirmAndClose('All cookies accepted. Thank you! 🎉');
    });

    /* Escape key: close modal if open, else reject and dismiss */
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key !== 'Escape') return;
      const popupEl = document.getElementById('cf-cookie-popup');
      if (popupEl && popupEl.classList.contains('cfck-modal-open')) {
        closeModal();
      } else {
        saveConsent({ analytics: false, marketing: false });
        closePopup();
        document.removeEventListener('keydown', onEsc);
      }
    });
  }

  /* ── Run after DOM ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 600);
  }

})();


/* ══════════════════════════════════════════════════════
   PLAN PROGRAM POPUP  —  plan-popup.js.
══════════════════════════════════════════════════════ */

(function initPlanProgramPopup() {
    'use strict';
    const PLAN_CONFIG = {
        beginner: {
            label:    'Beginner — Soft Start',
            badge:    'Beginner Program',
            icon:     'fi fi-rr-seedling',
            priceKey: 'program_price_beginner',        // key in settings JSON
            priceFallback: '$99',
            stripePriceId:  '',   // fill after creating in Stripe dashboard
            paypalPlanId:   '',   // fill after creating in PayPal dashboard
        },
        intermediate: {
            label:    'Intermediate — Deeper Refiner',
            badge:    'Intermediate Program',
            icon:     'fi fi-sr-dumbbell-ray',
            priceKey: 'program_price_intermediate',
            priceFallback: '$149',
            stripePriceId:  '',
            paypalPlanId:   '',
        },
        maintenance: {
            label:    'Maintenance — Forever Fit',
            badge:    'Maintenance Program',
            icon:     'fi fi-rr-shield-check',
            priceKey: 'program_price_maintenance',
            priceFallback: '$79',
            stripePriceId:  '',
            paypalPlanId:   '',
        },
    };

    /* cached settings */
    let _settings = null;

    async function getSettings() {
        if (_settings) return _settings;
        try {
            const r = await fetch('/products.data.json');
            const data = await r.json();
            _settings = (Array.isArray(data) ? data : []).find(p => p.type === 'settings') || {};
        } catch (e) {
            _settings = {};
        }
        return _settings;
    }

    function getPriceFromSettings(settings, key, fallback) {
        if (settings[key]) return settings[key];
        if (settings.programs && settings.programs[key.replace('program_price_', '')] && settings.programs[key.replace('program_price_', '')].price) {
            return settings.programs[key.replace('program_price_', '')].price;
        }
        return fallback;
    }

    /* ── DOM refs ── */
    const overlay       = document.getElementById('plan-program-overlay');
    const modal         = overlay ? overlay.querySelector('.pp-modal') : null;
    const closeBtn      = document.getElementById('pp-close');
    const stepForm      = document.getElementById('pp-step-form');
    const stepPayment   = document.getElementById('pp-step-payment');
    const stepThanks    = document.getElementById('pp-step-thanks');
    const continueBtn   = document.getElementById('pp-continue-btn');
    const payBtn        = document.getElementById('pp-pay-btn');
    const backBtn       = document.getElementById('pp-back-btn');
    const closeThanks   = document.getElementById('pp-close-thanks');

    if (!overlay || !modal) return;

    /* ── State ── */
    let currentPlanKey  = '';
    let currentPlanData = null;
    let clientData      = {};

    /* ──────────────────────────────────────────────────
       OPEN POPUP
    ────────────────────────────────────────────────── */
    async function openPopup(planKey) {
        currentPlanKey  = planKey;
        currentPlanData = PLAN_CONFIG[planKey];
        if (!currentPlanData) return;

        const settings  = await getSettings();
        const price     = getPriceFromSettings(settings, currentPlanData.priceKey, currentPlanData.priceFallback);
        const priceLabel = price.toString().startsWith('$') ? price + ' / month' : '$' + price + ' / month';

        // Update badge & labels
        setText('pp-badge-text',          currentPlanData.badge);
        setText('pp-plan-name-display',   currentPlanData.label);
        setText('pp-plan-price-display',  priceLabel);
        setText('pp-pay-plan-name',       currentPlanData.label);
        setText('pp-pay-plan-price',      priceLabel);
        setText('pp-thanks-plan-text',    currentPlanData.label);

        // Update badge icon
        const badgeIcon = overlay.querySelector('.pp-badge > i');
        if (badgeIcon) { badgeIcon.className = currentPlanData.icon; }

        // Reset to step 1
        showStep('form');
        clearErrors();
        clearFields();

        // Show
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closePopup() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    /* ──────────────────────────────────────────────────
       STEP NAVIGATION
    ────────────────────────────────────────────────── */
    function showStep(step) {
        stepForm.style.display    = step === 'form'    ? '' : 'none';
        stepPayment.style.display = step === 'payment' ? '' : 'none';
        stepThanks.style.display  = step === 'thanks'  ? '' : 'none';
    }

    /* ──────────────────────────────────────────────────
       STEP 1 → validate form → go to payment
    ────────────────────────────────────────────────── */
    continueBtn.addEventListener('click', () => {
        clearErrors();

        const firstName = val('pp-firstname');
        const lastName  = val('pp-lastname');
        const email     = val('pp-email');
        const phone     = val('pp-phone');
        const consent   = document.getElementById('pp-consent').checked;

        if (!firstName || !lastName || !email) {
            showError('pp-error', 'Please fill in all required fields.');
            return;
        }
        if (!email.includes('@') || !email.includes('.')) {
            showError('pp-error', 'Please enter a valid email address.');
            return;
        }
        if (!consent) {
            showError('pp-error', 'Please check the consent box to continue.');
            return;
        }

        // Save for later
        clientData = { firstName, lastName, email, phone, consent: 'Yes' };

        showStep('payment');
    });

    /* ──────────────────────────────────────────────────
       BACK BUTTON
    ────────────────────────────────────────────────── */
    backBtn.addEventListener('click', () => showStep('form'));

    /* ──────────────────────────────────────────────────
       STEP 2 → Pay Now
    ────────────────────────────────────────────────── */
    payBtn.addEventListener('click', async () => {
        clearErrors();

        const method = document.querySelector('input[name="pp-payment"]:checked')?.value;
        if (!method) {
            showError('pp-pay-error', 'Please choose a payment method.');
            return;
        }

        const settings = await getSettings();

        // Get subscription IDs (from settings or PLAN_CONFIG)
        const progSettings  = settings.programs?.[currentPlanKey] || {};
        const stripePriceId = progSettings.stripe_price_id || currentPlanData.stripePriceId;
        const paypalPlanId  = progSettings.paypal_plan_id  || currentPlanData.paypalPlanId;

        setBtnLoading(payBtn, true);

        try {
            if (method === 'stripe') {
                await handleStripe(stripePriceId, settings);
            } else {
                await handlePayPal(paypalPlanId, settings);
            }
        } catch (err) {
            showError('pp-pay-error', err.message || 'Payment failed. Please try again.');
            setBtnLoading(payBtn, false);
        }
    });

    /* ──────────────────────────────────────────────────
       STRIPE — redirect to Stripe Checkout (subscription)
    ────────────────────────────────────────────────── */
    async function handleStripe(priceId, settings) {
        if (!priceId) {
            // No subscription ID yet → alert developer
            throw new Error('Stripe subscription price ID not configured yet. Please set it in your dashboard.');
        }

        const res  = await fetch('/.netlify/functions/create-plan-stripe-session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                priceId,
                planKey:   currentPlanKey,
                planLabel: currentPlanData.label,
                customer:  clientData,
            }),
        });
        const data = await res.json();
        if (!data.success || !data.sessionId) {
            throw new Error(data.error || 'Stripe session failed.');
        }

        // Save pending info in sessionStorage so thankyou step can pick it up
        sessionStorage.setItem('pp_pending_client',   JSON.stringify(clientData));
        sessionStorage.setItem('pp_pending_plan_key', currentPlanKey);
        sessionStorage.setItem('pp_pending_plan',     currentPlanData.label);

        const STRIPE_PUBLIC_KEY = window.STRIPE_PUBLIC_KEY || settings.stripe_public_key || '';
        const stripe = Stripe(STRIPE_PUBLIC_KEY);
        await stripe.redirectToCheckout({ sessionId: data.sessionId });
        // After redirect back, thankyou.html handles the rest.
        // But we also handle inline below for PayPal which stays in popup.
    }

    /* ──────────────────────────────────────────────────
       PAYPAL — redirect to PayPal subscription approval
    ────────────────────────────────────────────────── */
    async function handlePayPal(planId, settings) {
        if (!planId) {
            throw new Error('PayPal plan ID not configured yet. Please set it in your dashboard.');
        }

        const res  = await fetch('/.netlify/functions/create-plan-paypal-subscription', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                planId,
                planKey:   currentPlanKey,
                planLabel: currentPlanData.label,
                customer:  clientData,
            }),
        });
        const data = await res.json();
        if (!data.success || !data.approvalUrl) {
            throw new Error(data.error || 'PayPal subscription failed.');
        }

        sessionStorage.setItem('pp_pending_client',   JSON.stringify(clientData));
        sessionStorage.setItem('pp_pending_plan_key', currentPlanKey);
        sessionStorage.setItem('pp_pending_plan',     currentPlanData.label);

        window.location.href = data.approvalUrl;
    }

    /* ──────────────────────────────────────────────────
       AFTER REDIRECT BACK — check URL params
       Called on page load if returning from Stripe/PayPal
    ────────────────────────────────────────────────── */
    async function checkReturnFromPayment() {
        const params      = new URLSearchParams(window.location.search);
        const sessionId   = params.get('pp_session_id');   // Stripe subscription
        const subId       = params.get('subscription_id'); // PayPal subscription
        const ppToken     = params.get('token');            // PayPal approval token

        if (!sessionId && !subId && !ppToken) return;

        const pendingClient  = JSON.parse(sessionStorage.getItem('pp_pending_client')  || 'null');
        const pendingPlanKey = sessionStorage.getItem('pp_pending_plan_key');
        const pendingPlan    = sessionStorage.getItem('pp_pending_plan');

        if (!pendingClient || !pendingPlanKey) return;

        // Re-open the popup in thanks step immediately (good UX)
        currentPlanKey  = pendingPlanKey;
        currentPlanData = PLAN_CONFIG[pendingPlanKey];

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        showStep('thanks');
        setText('pp-thanks-name',      `Welcome, ${pendingClient.firstName}!`);
        setText('pp-thanks-plan-text', pendingPlan || '');

        // Verify payment server-side THEN save to sheet
        try {
            const provider = sessionId ? 'stripe' : 'paypal';
            const paymentId = sessionId || subId || ppToken;

            const verifyRes  = await fetch('/.netlify/functions/verify-plan-payment', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ provider, paymentId, planKey: pendingPlanKey }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
                // Payment failed — hide thanks, show error in payment step
                showStep('payment');
                showError('pp-pay-error', verifyData.error || 'Payment verification failed. Please contact support.');
                return;
            }

            // Payment verified → save to sheet
            await savePlanRequest({
                ...pendingClient,
                program: pendingPlan,
                planKey: pendingPlanKey,
            });

            // Clear session
            sessionStorage.removeItem('pp_pending_client');
            sessionStorage.removeItem('pp_pending_plan_key');
            sessionStorage.removeItem('pp_pending_plan');

            // Clean URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);

        } catch (err) {
            console.error('[PlanPopup] Verification error:', err.message);
        }
    }

    /* ──────────────────────────────────────────────────
       SAVE TO SHEET via save-plan-request.js
    ────────────────────────────────────────────────── */
    async function savePlanRequest(payload) {
        try {
            await fetch('/.netlify/functions/save-plan-request', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    firstName: payload.firstName,
                    lastName:  payload.lastName,
                    email:     payload.email,
                    phone:     payload.phone || '',
                    program:   payload.program,
                    consent:   payload.consent || 'Yes',
                }),
            });
        } catch (e) {
            console.warn('[PlanPopup] savePlanRequest failed:', e.message);
        }
    }

    /* ──────────────────────────────────────────────────
       CLOSE ACTIONS
    ────────────────────────────────────────────────── */
    closeBtn.addEventListener('click', closePopup);
    closeThanks.addEventListener('click', closePopup);
    overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });

    /* ──────────────────────────────────────────────────
       BIND OPEN BUTTONS on program cards
    ────────────────────────────────────────────────── */
    document.querySelectorAll('.open-plan-program-popup').forEach(btn => {
        btn.addEventListener('click', () => {
            const planKey = btn.dataset.planKey;
            if (planKey) openPopup(planKey);
        });
    });

    /* ──────────────────────────────────────────────────
       HELPERS
    ────────────────────────────────────────────────── */
    function val(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
    function showError(id, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }
    function clearErrors() {
        ['pp-error', 'pp-pay-error'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.textContent = ''; el.style.display = 'none'; }
        });
    }
    function clearFields() {
        ['pp-firstname','pp-lastname','pp-email','pp-phone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const cb = document.getElementById('pp-consent');
        if (cb) cb.checked = false;
        // Reset payment radio to stripe
        const stripeRadio = document.querySelector('input[name="pp-payment"][value="stripe"]');
        if (stripeRadio) stripeRadio.checked = true;
    }
    function setBtnLoading(btn, loading) {
        if (loading) {
            btn.disabled = true;
            btn.innerHTML = '<div class="pp-spinner"></div> Processing...';
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i class="fi fi-rr-lock"></i> Pay Now';
        }
    }

    /* ──────────────────────────────────────────────────
       ON PAGE LOAD — check if returning from payment
    ────────────────────────────────────────────────── */
    checkReturnFromPayment();

})();



/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — HERO BANNER JS
   src/components/hero-banner.js
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function waitForProducts(cb) {
    if (window.__allProducts && window.__allProducts.length) {
      cb(window.__allProducts);
    } else {
      var tries = 0;
      var poll = setInterval(function () {
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(poll);
          cb(window.__allProducts);
        } else if (++tries > 80) {
          clearInterval(poll);
          cb([]);
        }
      }, 100);
    }
  }

  var $ = function (id) { return document.getElementById(id); };


  waitForProducts(function (allProducts) {

    var settings = (allProducts.find(function (p) { return p.type === 'settings'; }) || {});
    var cfg = settings.hero_banner || {};

    var mediaEl    = $('bbwHeroMedia');
    var thumbsEl   = $('bbwHeroThumbs');
    var dotsEl     = $('bbwHeroDots');
    var titleEl    = $('bbwHeroTitle');
    var subtitleEl = $('bbwHeroSubtitle');
    var textEl     = $('bbwHeroText');
    var cdWrap     = $('bbwHeroCountdown');
    var btnWrap    = $('bbwHeroBtnWrap');
    var btnMain    = $('bbwHeroBtnMain');
    var btnSlide1  = $('bbwHeroBtn1');
    var btnSlide2  = $('bbwHeroBtn2');
    var btnSlide3  = $('bbwHeroBtn3');

    if (!mediaEl) return;

    var videoUrl         = cfg.video_url            || '';
    var images           = cfg.images               || [];
    var showThumbs       = (cfg.show_thumbnails      || 'yes').toLowerCase() === 'yes';
    var thumbPosDesktop  = (cfg.thumbnails_position_desktop || 'right').toLowerCase();
    var thumbPosMobile   = (cfg.thumbnails_position_mobile  || 'bottom').toLowerCase();
    var showIndivBtns    = (cfg.show_individual_buttons || 'no').toLowerCase() === 'yes';
    var slides           = cfg.slides               || [];
    var interval         = ((cfg.rotation_interval_seconds || 4) * 1000);
    var showCountdown    = (cfg.show_countdown       || 'yes').toLowerCase() === 'yes';
    var countdownEnd     = cfg.countdown_end_date   || '';
    var mainBtnCfg       = cfg.main_button           || {};
    var btn1Cfg          = cfg.button_1              || {};
    var btn2Cfg          = cfg.button_2              || {};
    var btn3Cfg          = cfg.button_3              || {};

    var root = document.documentElement;
    if (cfg.button_color)      root.style.setProperty('--hero-btn-bg',    cfg.button_color);
    if (cfg.button_text_color) root.style.setProperty('--hero-btn-color',  cfg.button_text_color);
    if (cfg.text_color)        root.style.setProperty('--hero-text-color', cfg.text_color);

   
    var slideCount;
    if (videoUrl) {
      slideCount = slides.length > 0 ? slides.length : 1;
    } else {
      slideCount = Math.min(
        images.length > 0 ? images.length : 999,
        slides.length  > 0 ? slides.length  : 999
      );
      if (slideCount === 999) slideCount = 1;
    }

    var currentIdx = 0;
    var autoTimer  = null;

    /* ════════════════════════════════════════════════════════
       1. INJECTION MÉDIAS
    ════════════════════════════════════════════════════════ */
    if (videoUrl) {
      /* Mode vidéo — placeholder visible jusqu'à ce que la vidéo soit prête */
      var placeholderEl = document.getElementById('bbwHeroVideoPlaceholder');

      // Affiche le placeholder immédiatement (qu'il vienne du setting ou du HTML)
      if (placeholderEl) {
        var placeholderSrc = cfg.video_placeholder_image || '';
        if (placeholderSrc) placeholderEl.src = placeholderSrc; // surcharge si défini dans settings
        placeholderEl.style.cssText = 'display:block; width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:3;';
      }

      var vid = document.createElement('video');
      vid.autoplay    = true;
      vid.muted       = true;
      vid.loop        = true;
      vid.playsInline = true;
      vid.setAttribute('playsinline', '');
      vid.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:1; opacity:0; transition:opacity 0.5s ease;';

      vid.addEventListener('canplay', function () {
        // Vidéo prête — monte son opacité et cache le placeholder en fondu
        vid.style.opacity = '1';
        vid.style.zIndex  = '2';
        if (placeholderEl) {
          placeholderEl.style.transition = 'opacity 0.5s ease';
          placeholderEl.style.opacity    = '0';
          setTimeout(function () {
            placeholderEl.style.display = 'none';
          }, 500);
        }
      });

      var src = document.createElement('source');
      src.src  = videoUrl;
      src.type = 'video/mp4';
      vid.appendChild(src);
      mediaEl.appendChild(vid);

      // Thumbs et dots cachés en mode vidéo
      if (thumbsEl) thumbsEl.style.display = 'none';
      if (dotsEl)   dotsEl.style.display   = 'none';
      } else {
        var placeholderEl = document.getElementById('bbwHeroVideoPlaceholder');
        if (placeholderEl && placeholderEl.parentNode) {
          placeholderEl.parentNode.removeChild(placeholderEl);
        }

        // Le placeholder image reste visible tant que LES 3 vraies images
        // de la rotation n'ont pas fini de charger — sinon, dès que le
        // carrousel avance sur un slide pas encore chargé (loading="lazy"
        // le retardait), on retombe sur un flash noir.
        var imagesPlaceholderEl = document.getElementById('bbwHeroImagesPlaceholder');
        var heroImgEls = [];
        var loadedCount = 0;

        /* Mode images */
        images.forEach(function (src, i) {
          var img = document.createElement('img');
          img.src      = (typeof upgradeShopifyImageUrl === 'function') ? upgradeShopifyImageUrl(src, 1600) : src;
          img.alt      = (slides[i] && slides[i].title) ? slides[i].title : 'BBW4LIFE banner ' + (i + 1);
          img.loading  = 'eager';
          img.decoding = 'async';
          if (i === 0) img.fetchPriority = 'high';
          heroImgEls.push(img);
          /* pas de bbw-hero--active tout de suite pour le slide 0 —
             on l'ajoute seulement une fois toutes les images chargées */
          mediaEl.appendChild(img);
        });

        function bbwHeroRevealImages() {
          if (heroImgEls[0]) heroImgEls[0].classList.add('bbw-hero--active');
          if (imagesPlaceholderEl) {
            imagesPlaceholderEl.style.transition = 'opacity 0.5s ease';
            imagesPlaceholderEl.style.opacity = '0';
            setTimeout(function () {
              if (imagesPlaceholderEl && imagesPlaceholderEl.parentNode) {
                imagesPlaceholderEl.parentNode.removeChild(imagesPlaceholderEl);
              }
            }, 500);
          }
        }

        function bbwHeroOnOneImageSettled() {
          loadedCount++;
          if (loadedCount >= heroImgEls.length) bbwHeroRevealImages();
        }

        if (heroImgEls.length) {
          heroImgEls.forEach(function (img) {
            if (img.complete && img.naturalWidth > 0) {
              bbwHeroOnOneImageSettled();
            } else {
              img.addEventListener('load',  bbwHeroOnOneImageSettled, { once: true });
              img.addEventListener('error', bbwHeroOnOneImageSettled, { once: true });
            }
          });
        } else if (imagesPlaceholderEl && imagesPlaceholderEl.parentNode) {
          /* aucune image configurée → pas de raison de garder le placeholder */
          imagesPlaceholderEl.parentNode.removeChild(imagesPlaceholderEl);
        }
      }

    /* ════════════════════════════════════════════════════════
       2. THUMBNAILS
    ════════════════════════════════════════════════════════ */
    if (showThumbs && thumbsEl && !videoUrl && images.length > 1) {
      thumbsEl.classList.add('bbw-thumbs--' + thumbPosDesktop);
      thumbsEl.classList.add('bbw-thumbs--mobile-' + thumbPosMobile);

      images.forEach(function (src, i) {
        var thumb = document.createElement('div');
        thumb.className = 'bbw-hero__thumb' + (i === 0 ? ' bbw-hero--active' : '');
        thumb.dataset.index = i;

        var img = document.createElement('img');
        img.src     = (typeof upgradeShopifyImageUrl === 'function') ? upgradeShopifyImageUrl(src, 200) : src;
        img.alt     = 'Thumbnail ' + (i + 1);
        img.loading = 'lazy';
        img.decoding = 'async';
        thumb.appendChild(img);

        thumb.addEventListener('click', function () {
          goToSlide(parseInt(this.dataset.index));
          resetAutoPlay();
        });

        thumbsEl.appendChild(thumb);
      });
    } else if (thumbsEl && !videoUrl) {
      thumbsEl.style.display = 'none';
    }

    /* ════════════════════════════════════════════════════════
       3. DOTS
    ════════════════════════════════════════════════════════ */
    if (dotsEl && !videoUrl && slideCount > 1) {
      for (var d = 0; d < slideCount; d++) {
        (function (idx) {
          var dot = document.createElement('button');
          dot.className = 'bbw-hero__dot' + (idx === 0 ? ' bbw-hero--active' : '');
          dot.setAttribute('aria-label', 'Slide ' + (idx + 1));
          dot.dataset.index = idx;
          dot.addEventListener('click', function () {
            goToSlide(idx);
            resetAutoPlay();
          });
          dotsEl.appendChild(dot);
        })(d);
      }
    } else if (dotsEl && (videoUrl || slideCount <= 1)) {
      dotsEl.style.display = 'none';
    }

    /* ════════════════════════════════════════════════════════
       4. CONTENU TEXTUEL
    ════════════════════════════════════════════════════════ */
    var _heroFirstRender = true;

    function updateContent(idx) {
      var slide = slides[idx] || {};
      var els = [titleEl, subtitleEl, textEl, cdWrap, btnWrap].filter(Boolean);

      // Premier rendu : pas de fondu, on affiche direct
      if (_heroFirstRender) {
        if (titleEl)    titleEl.textContent    = slide.title    || '';
        if (subtitleEl) subtitleEl.textContent = slide.subtitle || '';
        if (textEl)     textEl.textContent     = slide.text     || '';
        _heroFirstRender = false;
        return;
      }

      // Crossfade doux : fondu sortant → changement de texte → fondu entrant
      els.forEach(function (el) {
        el.style.transition = 'opacity 0.4s ease';
        el.style.opacity = '0';
      });

      setTimeout(function () {
        if (titleEl)    titleEl.textContent    = slide.title    || '';
        if (subtitleEl) subtitleEl.textContent = slide.subtitle || '';
        if (textEl)     textEl.textContent     = slide.text     || '';

        els.forEach(function (el) {
          el.style.opacity = '1';
        });
      }, 400);
    }

    updateContent(0);

    /* ════════════════════════════════════════════════════════
       5. COMPTE À REBOURS
    ════════════════════════════════════════════════════════ */
    if (showCountdown && cdWrap && countdownEnd) {
      cdWrap.style.display = 'flex';

      var lblDays    = cfg.countdown_label_days    || 'DAYS';
      var lblHours   = cfg.countdown_label_hours   || 'HOURS';
      var lblMinutes = cfg.countdown_label_minutes || 'MIN';
      var lblSeconds = cfg.countdown_label_seconds || 'SEC';

      var cdDays  = $('bbwCdDays');
      var cdHours = $('bbwCdHours');
      var cdMins  = $('bbwCdMinutes');
      var cdSecs  = $('bbwCdSeconds');
      var cdLabelDays    = $('bbwCdLabelDays');
      var cdLabelHours   = $('bbwCdLabelHours');
      var cdLabelMinutes = $('bbwCdLabelMinutes');
      var cdLabelSeconds = $('bbwCdLabelSeconds');

      if (cdLabelDays)    cdLabelDays.textContent    = lblDays;
      if (cdLabelHours)   cdLabelHours.textContent   = lblHours;
      if (cdLabelMinutes) cdLabelMinutes.textContent = lblMinutes;
      if (cdLabelSeconds) cdLabelSeconds.textContent = lblSeconds;

      var endTime = new Date(countdownEnd).getTime();

      /* ── NOUVEAU : boucle automatique + style cercle ── */
      var autoLoop   = (cfg.countdown_auto_loop || 'no').toLowerCase().trim() === 'yes';
      var cycleDays  = parseFloat(cfg.countdown_cycle_days)       || 5;
      var pauseHours = parseFloat(cfg.countdown_loop_pause_hours) || 24;
      var cycleMs    = cycleDays  * 86400000;
      var pauseMs    = pauseHours * 3600000;
      var periodMs   = cycleMs + pauseMs;
      var showCircle = (cfg.countdown_style_circle || 'no').toLowerCase().trim() === 'yes';

      var ringFg = null;
      var RING_CIRC = 2 * Math.PI * 54;

      if (showCircle && !cdWrap.querySelector('.bbw-cd-ring-svg')) {
        cdWrap.classList.add('bbw-cd--circle-mode');
        var ringWrap = document.createElement('div');
        ringWrap.className = 'bbw-cd-ring-wrap';
        ringWrap.style.cssText = 'position:relative;width:100%;display:flex;justify-content:center;margin-bottom:8px;';
        ringWrap.innerHTML =
          '<svg class="bbw-cd-ring-svg" width="120" height="120" viewBox="0 0 120 120">' +
            '<circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="8"/>' +
            '<circle class="bbw-cd-ring-fg" cx="60" cy="60" r="54" fill="none" stroke="#c9963e" stroke-width="8" ' +
              'stroke-linecap="round" transform="rotate(-90 60 60)" ' +
              'style="stroke-dasharray:' + RING_CIRC.toFixed(2) + ';stroke-dashoffset:0;transition:stroke-dashoffset 0.9s linear;"/>' +
          '</svg>';
        cdWrap.insertBefore(ringWrap, cdWrap.firstChild);
        ringFg = ringWrap.querySelector('.bbw-cd-ring-fg');
      }

      function pad(n) { return String(n).padStart(2, '0'); }

      function tickCountdown() {
        var now = Date.now();
        var diffSec;
        var pctElapsed = 0;

        if (!autoLoop || now <= endTime) {
          /* Compte à rebours normal jusqu'à la date définie */
          diffSec = Math.max(0, Math.floor((endTime - now) / 1000));
          if (showCircle) {
            var remainingMs = Math.max(0, endTime - now);
            pctElapsed = 1 - (remainingMs / cycleMs);
          }
        } else {
          /* Date dépassée → boucle automatique */
          var elapsed = (now - endTime) % periodMs;
          if (elapsed < pauseMs) {
            diffSec    = 0;
            pctElapsed = 1;
          } else {
            var remainingMs = periodMs - elapsed;
            diffSec    = Math.floor(remainingMs / 1000);
            pctElapsed = 1 - (remainingMs / cycleMs);
          }
        }

        var dd = Math.floor(diffSec / 86400);
        var hh = Math.floor((diffSec % 86400) / 3600);
        var mm = Math.floor((diffSec % 3600) / 60);
        var ss = diffSec % 60;

        if (cdDays)  cdDays.textContent  = pad(dd);
        if (cdHours) cdHours.textContent = pad(hh);
        if (cdMins)  cdMins.textContent  = pad(mm);
        if (cdSecs)  cdSecs.textContent  = pad(ss);

        if (showCircle && ringFg) {
          var clamped = Math.max(0, Math.min(1, pctElapsed));
          ringFg.style.strokeDashoffset = (RING_CIRC * clamped).toFixed(2);
        }
      }

      tickCountdown();
      setInterval(tickCountdown, 1000);
    }

    /* ════════════════════════════════════════════════════════
       6. BOUTONS
    ════════════════════════════════════════════════════════ */
    if (showIndivBtns) {
      /* Mode : 1 bouton par slide — valable vidéo ET images */
      [
        { el: btnSlide1, cfg: btn1Cfg, idx: 0 },
        { el: btnSlide2, cfg: btn2Cfg, idx: 1 },
        { el: btnSlide3, cfg: btn3Cfg, idx: 2 }
      ].forEach(function (item) {
        if (!item.el) return;
        item.el.textContent = item.cfg.text || 'Shop Now';
        item.el.href        = item.cfg.url  || '#';
        /* Afficher uniquement le bouton du slide courant */
        item.el.style.display = (item.idx === currentIdx) ? 'inline-block' : 'none';
      });
      if (btnMain) btnMain.style.display = 'none';

    } else {
      /* Mode : bouton principal unique */
      if (btnMain) {
        btnMain.textContent = mainBtnCfg.text || 'Add pack to cart';
        btnMain.style.display = 'inline-block';
        btnMain.addEventListener('click', handlePackClick);
      }
      [btnSlide1, btnSlide2, btnSlide3].forEach(function (b) {
        if (b) b.style.display = 'none';
      });
    }

    /* ── Handler bouton principal pack ── */
    function handlePackClick() {
      var productIds = mainBtnCfg.product_ids || [];
      if (!productIds.length) { window.location.href = '/checkout/checkout.html'; return; }

      var cart = (typeof window.__getCart === 'function') ? window.__getCart() : [];

      productIds.forEach(function (pid) {
        var prod = allProducts.find(function (p) { return p.id === pid; });
        if (!prod) return;

        var variant = (prod.variants && prod.variants.length) ? prod.variants[0] : null;
        var price   = variant ? parseFloat(variant.price) : parseFloat(prod.price);
        var color   = variant ? (variant.color || null) : null;
        var size    = variant ? (variant.size  || null) : null;

        var colorObj = (color && prod.colors)
          ? prod.colors.find(function (c) { return c.name === color; })
          : null;
        var image = colorObj ? (colorObj.image || prod.image) : prod.image;

        var existing = cart.find(function (i) {
          return i.id === pid && i.color === color && i.size === size;
        });

        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({
            id:            prod.id,
            title:         prod.title,
            price:         price,
            compare_price: parseFloat(prod.compare_price) || price,
            image:         (typeof upgradeShopifyImageUrl === 'function')
                             ? upgradeShopifyImageUrl(image || prod.image)
                             : (image || prod.image),
            size:          size  || null,
            color:         color || null,
            quantity:      1,
            fromHeroPack:  true,
            cj_product_id: prod.cj_id,
            cj_variant_id: variant ? variant.vid : null
          });
        }
      });

      if (typeof window.__setCart === 'function') window.__setCart(cart);
      localStorage.setItem('cart', JSON.stringify(cart));
      localStorage.setItem('checkoutCart', JSON.stringify(cart));

      if (typeof window.updateBadges === 'function')              window.updateBadges();
      if (typeof window.updateCartQuantityInSheet === 'function') window.updateCartQuantityInSheet();

      if (btnMain) {
        btnMain.classList.add('bbw-hero__btn--added');
        btnMain.textContent = 'Adding to cart… redirecting';
        setTimeout(function () { window.location.href = '/checkout/checkout.html'; }, 800);
      } else {
        window.location.href = '/checkout/checkout.html';
      }
    }

    /* ════════════════════════════════════════════════════════
       7. NAVIGATION ENTRE SLIDES
    ════════════════════════════════════════════════════════ */
    function goToSlide(idx) {
      if (idx < 0) idx = slideCount - 1;
      if (idx >= slideCount) idx = 0;
      if (idx === currentIdx && slideCount > 1) return;

      currentIdx = idx;

      /* ── Images + Thumbs + Dots — seulement en mode image ── */
      if (!videoUrl) {
        var imgs = mediaEl.querySelectorAll('img:not(#bbwHeroImagesPlaceholder)');
        imgs.forEach(function (img, i) {
          img.classList.toggle('bbw-hero--active', i === idx);
        });

        if (thumbsEl) {
          var thumbItems = thumbsEl.querySelectorAll('.bbw-hero__thumb');
          thumbItems.forEach(function (t, i) {
            t.classList.toggle('bbw-hero--active', i === idx);
          });
        }

        if (dotsEl) {
          var dotItems = dotsEl.querySelectorAll('.bbw-hero__dot');
          dotItems.forEach(function (d, i) {
            d.classList.toggle('bbw-hero--active', i === idx);
          });
        }
      }

      /* ── Contenu texte — toujours, vidéo ou images ── */
      updateContent(idx);

      /* ── Boutons individuels — toujours, vidéo ou images ── */
      if (showIndivBtns) {
        [btnSlide1, btnSlide2, btnSlide3].forEach(function (b, i) {
          if (b) b.style.display = (i === idx) ? 'inline-block' : 'none';
        });
      }
    }

    /* ── Autoplay ── */
    function startAutoPlay() {
      if (slideCount <= 1) return;
      autoTimer = setInterval(function () {
        goToSlide(currentIdx + 1);
      }, interval);
    }

    function resetAutoPlay() {
      clearInterval(autoTimer);
      startAutoPlay();
    }

    startAutoPlay();

    /* ── Swipe tactile ── */
    var touchStartX = 0;
    var section = document.getElementById('hero-banner-section');
    if (section) {
      section.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });

      section.addEventListener('touchend', function (e) {
        var diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 44) {
          diff > 0 ? goToSlide(currentIdx + 1) : goToSlide(currentIdx - 1);
          resetAutoPlay();
        }
        touchStartX = 0;
      }, { passive: true });
    }

  }); /* fin waitForProducts */

})();




(function () {
  'use strict';

  function bssInit() {
    const section = document.getElementById('bbw-stories-section');
    if (!section) return;

    /* ════════════════════════════════
       1. SOUND TOGGLE
    ════════════════════════════════ */
    section.querySelectorAll('.bss-sound-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const inner       = btn.closest('.bss-video-inner');
        const video       = inner ? inner.querySelector('.bss-video') : null;
        if (!video) return;

        const isMuted     = btn.getAttribute('data-muted') === 'true';
        video.muted       = !isMuted;
        btn.setAttribute('data-muted', String(!isMuted));

        const iconMuted   = btn.querySelector('.bss-icon-muted');
        const iconUnmuted = btn.querySelector('.bss-icon-unmuted');
        if (iconMuted)   iconMuted.style.display   = isMuted ? 'none'  : 'block';
        if (iconUnmuted) iconUnmuted.style.display = isMuted ? 'block' : 'none';

        if (!isMuted && video.paused) video.play();
      });
    });

    /* ════════════════════════════════
       2. VIDEO SLIDER NAVIGATION
    ════════════════════════════════ */
    const videosTrack = document.getElementById('bssVideosTrack');
    const navPrev     = document.getElementById('bssNavPrev');
    const navNext     = document.getElementById('bssNavNext');
    const dotsWrap    = document.getElementById('bssDots');

    if (!videosTrack || !navPrev || !navNext) return;

    const items     = videosTrack.querySelectorAll('.bss-video-item');
    const itemCount = items.length;
    let   current   = 0;

    /* ── Créer les dots ── */
    if (dotsWrap && itemCount > 0) {
      dotsWrap.innerHTML = '';
      items.forEach(function (_, i) {
        const dot = document.createElement('button');
        dot.className = 'bss-dot' + (i === 0 ? ' bss-dot--active' : '');
        dot.setAttribute('aria-label', 'Slide ' + (i + 1));
        dot.addEventListener('click', function () { goTo(i); });
        dotsWrap.appendChild(dot);
      });
    }

    function updateDots(idx) {
      if (!dotsWrap) return;
      dotsWrap.querySelectorAll('.bss-dot').forEach(function (d, i) {
        d.classList.toggle('bss-dot--active', i === idx);
      });
    }

    function getItemWidth() {
      if (!items[0]) return 0;
      const gap = parseInt(getComputedStyle(videosTrack).gap) || 0;
      return items[0].offsetWidth + gap;
    }

    function goTo(idx) {
      current = Math.max(0, Math.min(idx, itemCount - 1));
      videosTrack.scrollTo({ left: current * getItemWidth(), behavior: 'smooth' });
      updateDots(current);
    }

    navPrev.addEventListener('click', function () { goTo(current - 1); });
    navNext.addEventListener('click', function () { goTo(current + 1); });

    /* ── Sync dots sur scroll manuel ── */
    let scrollTimer = null;
    videosTrack.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        const w   = getItemWidth();
        if (!w) return;
        const idx = Math.round(videosTrack.scrollLeft / w);
        if (idx !== current) {
          current = idx;
          updateDots(current);
        }
      }, 80);
    }, { passive: true });

    /* ── Swipe tactile ── */
    let touchStartX = 0;
    videosTrack.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    videosTrack.addEventListener('touchend', function (e) {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? goTo(current + 1) : goTo(current - 1);
      }
    }, { passive: true });

    /* ════════════════════════════════
       3. STORIES TRACK — auto scroll
    ════════════════════════════════ */
    const storiesTrack = document.getElementById('bssStoriesTrack');
    if (storiesTrack) {
      let storyIndex = 0;
      const stories  = storiesTrack.querySelectorAll('.bss-story');

      setInterval(function () {
        if (stories.length === 0) return;
        storyIndex = (storyIndex + 1) % stories.length;
        const story = stories[storyIndex];
        storiesTrack.scrollTo({
          left: story.offsetLeft - storiesTrack.offsetWidth / 2 + story.offsetWidth / 2,
          behavior: 'smooth'
        });
      }, 3000);
    }

    /* ════════════════════════════════
       4. LAZY-LOAD VIDÉOS
    ════════════════════════════════ */
    const videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;

        const item        = e.target;
        const video       = item.querySelector('.bss-video');
        const placeholder = item.querySelector('.bss-video-placeholder');

        if (!video) return;

        /* Charge la vidéo seulement si data-src est présent */
        const src = video.getAttribute('data-src');
        if (src && !video.src) {
          video.src = src;
          video.load();
        }

        /* Quand la vidéo est prête, joue et cache le placeholder */
        video.addEventListener('canplay', function () {
          video.play().catch(function () {});
          if (placeholder) {
            placeholder.classList.add('hidden');
            setTimeout(function () {
              placeholder.style.display = 'none';
            }, 500);
          }
        }, { once: true });

        /* Une fois chargée, ne plus observer cet item */
        videoObserver.unobserve(item);
      });
    }, {
      threshold:  0.15,
      rootMargin: '100px'
    });

    items.forEach(function (item) {
      videoObserver.observe(item);
    });

  }

  /* ── Lancer après le DOM ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bssInit);
  } else {
    bssInit();
  }

})();

/* ═══════════════════════════════════════════════════════════════════
   COLLECTION SLIDER — collection-slider.js
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function fmt(price) {
    return '$' + parseFloat(price).toFixed(2);
  }

  function getImg(url) {
    return typeof upgradeShopifyImageUrl === 'function'
      ? upgradeShopifyImageUrl(url, 600)
      : url;
  }

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); }
    catch (e) { return []; }
  }

  function toggleWishlistItem(handle) {
    let wl = getWishlist();
    if (!Array.isArray(wl)) wl = [];
    const idx = wl.indexOf(handle);
    if (idx === -1) wl.push(handle);
    else wl.splice(idx, 1);
    localStorage.setItem('wishlist', JSON.stringify(wl));
    if (typeof window.__setWishlist === 'function') window.__setWishlist(wl);
    document.dispatchEvent(new Event('wishlist:change'));
    if (typeof window.updateWishlistIcons === 'function') window.updateWishlistIcons();
    if (typeof window.updateBadges === 'function') window.updateBadges();
  }

  function isWishlisted(handle) {
    const wl = getWishlist();
    return Array.isArray(wl) && wl.includes(handle);
  }

  function addToCartFromWidget(prod, variantOverride) {
    const variant = variantOverride || (prod.variants && prod.variants[0]) || null;
    const color  = variant ? variant.color  || null : null;
    const size   = variant ? variant.size   || null : null;
    const price  = variant ? variant.price  : prod.price;
    const vid    = variant ? variant.vid    : null;

    const colorObj = (color && prod.colors)
      ? prod.colors.find(c => c.name === color)
      : null;
    const image = getImg(colorObj ? colorObj.image || prod.image : prod.image);

    let cart = (typeof window.__getCart === 'function')
      ? window.__getCart()
      : JSON.parse(localStorage.getItem('cart') || '[]');

    const existing = cart.find(
      i => i.id === prod.id && i.color === color && i.size === size
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id:            prod.id,
        title:         prod.title,
        price:         price,
        compare_price: prod.compare_price,
        image:         image,
        size:          size,
        color:         color,
        quantity:      1,
        cj_product_id: prod.cj_id,
        cj_variant_id: vid
      });
    }

    if (typeof window.__setCart === 'function') window.__setCart(cart);
    if (typeof window.saveCart                  === 'function') window.saveCart();
    if (typeof window.updateCartQuantityInSheet === 'function') window.updateCartQuantityInSheet();
    if (typeof window.updateBadges              === 'function') window.updateBadges();
    if (typeof window.renderCart                === 'function') window.renderCart();
    if (typeof window.openCartDrawer            === 'function') window.openCartDrawer();
  }

  function buildCard(prod, addToCartLabel) {
    const card = document.createElement('div');
    card.className = 'cs-card';
    card.dataset.productId = prod.id;

    let currentMediaIndex = 0;
    let selectedVariant   = prod.variants && prod.variants.length ? prod.variants[0] : null;
    const MAX_VISIBLE_VARIANTS = 4;
    let variantsExpanded  = false;

    let discountPct = 0;
    if (prod.compare_price > prod.price) {
      discountPct = Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100);
    }

    const discountBadge = document.createElement('span');
    discountBadge.className = 'cs-discount-badge';
    discountBadge.style.display = discountPct > 0 ? '' : 'none';
    discountBadge.textContent = '-' + discountPct + '%';
    card.appendChild(discountBadge);

    const wishBtn = document.createElement('button');
    wishBtn.className = 'cs-wishlist-btn' + (isWishlisted(prod.handle || prod.id) ? ' cs-in-wishlist' : '');
    wishBtn.setAttribute('aria-label', 'Wishlist');
    wishBtn.innerHTML = `
      <svg class="cs-heart-empty" viewBox="0 0 24 24" fill="none" stroke="#c0385e" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <svg class="cs-heart-filled" viewBox="0 0 24 24" fill="#c0385e" stroke="#c0385e" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>`;
    wishBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const key = prod.handle || prod.id;
      toggleWishlistItem(key);
      wishBtn.classList.toggle('cs-in-wishlist', isWishlisted(key));
    });
    card.appendChild(wishBtn);

    const mediaEl = document.createElement('div');
    mediaEl.className = 'cs-media';

    const mediaLink = document.createElement('a');
    mediaLink.href = typeof getProductUrl === 'function' ? getProductUrl(prod.id) : (prod.url || '#');

    const inner = document.createElement('div');
    inner.className = 'cs-media-inner';

    const slides = prod.media && prod.media.length ? prod.media : [prod.image];
    slides.forEach((src, i) => {
      const slide = document.createElement('div');
      slide.className = 'cs-media-slide';
      const img = document.createElement('img');
      img.src     = getImg(src);
      img.alt     = prod.title + ' image ' + (i + 1);
      img.loading = i === 0 ? 'eager' : 'lazy';
      slide.appendChild(img);
      inner.appendChild(slide);
    });

    mediaLink.appendChild(inner);
    mediaEl.appendChild(mediaLink);

    function goToMediaSlide(idx) {
      currentMediaIndex = Math.max(0, Math.min(slides.length - 1, idx));
      inner.style.transform = 'translateX(-' + (currentMediaIndex * 100) + '%)';
    }

    if (slides.length > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'cs-media-arrow cs-media-arrow--prev';
      prevBtn.setAttribute('aria-label', 'Image précédente');
      prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>`;
    prevBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        goToMediaSlide(currentMediaIndex - 1);
      });
      prevBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        goToMediaSlide(currentMediaIndex - 1);
      }, { passive: false });

      const nextBtn = document.createElement('button');
      nextBtn.className = 'cs-media-arrow cs-media-arrow--next';
      nextBtn.setAttribute('aria-label', 'Image suivante');
      nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>`;
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        goToMediaSlide(currentMediaIndex + 1);
      });
      nextBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        goToMediaSlide(currentMediaIndex + 1);
      }, { passive: false });

      mediaEl.appendChild(prevBtn);
      mediaEl.appendChild(nextBtn);
    }

    card.appendChild(mediaEl);

    const body = document.createElement('div');
    body.className = 'cs-body';

    const titleLink = document.createElement('a');
    titleLink.className = 'cs-title';
    titleLink.href  = typeof getProductUrl === 'function' ? getProductUrl(prod.id) : (prod.url || '#');
    titleLink.title = prod.title;
    titleLink.textContent = prod.title;
    body.appendChild(titleLink);

    const variantsWrap = document.createElement('div');
    variantsWrap.className = 'cs-variants';

    const priceEl = document.createElement('span');
    priceEl.className = 'cs-price';
    priceEl.textContent = fmt(prod.price);

    const compareEl = document.createElement('span');
    compareEl.className = 'cs-compare-price';
    if (prod.compare_price > prod.price) {
      compareEl.textContent = fmt(prod.compare_price);
    } else {
      compareEl.style.display = 'none';
    }

    function updateVariantState(colorName, variantThumb) {
      variantsWrap.querySelectorAll('.cs-variant-thumb').forEach(t => t.classList.remove('cs-active'));
      if (variantThumb) variantThumb.classList.add('cs-active');

      if (prod.variants && colorName) {
        const found = prod.variants.find(v => v.color === colorName);
        if (found) selectedVariant = found;
      }

      const colorObj = (colorName && prod.colors)
        ? prod.colors.find(c => c.name === colorName)
        : null;
      if (colorObj && colorObj.image) {
        inner.querySelectorAll('.cs-media-slide img').forEach((img, i) => {
          if (i === 0) img.src = getImg(colorObj.image);
        });
        currentMediaIndex = 0;
        inner.style.transform = 'translateX(0)';
      }

      if (selectedVariant) {
        priceEl.textContent = fmt(selectedVariant.price);
        const compareVal = prod.compare_price || 0;
        if (compareVal > selectedVariant.price) {
          compareEl.textContent = fmt(compareVal);
          compareEl.style.display = '';
          const pct = Math.round(((compareVal - selectedVariant.price) / compareVal) * 100);
          discountBadge.textContent   = '-' + pct + '%';
          discountBadge.style.display = '';
        } else {
          compareEl.style.display    = 'none';
          discountBadge.style.display = 'none';
        }
      }
    }

    const allColors = prod.colors && prod.colors.length
      ? prod.colors.filter(c => c.active !== false)
      : [];

    allColors.forEach((color, idx) => {
      const thumb = document.createElement('img');
      thumb.className = 'cs-variant-thumb' + (idx >= MAX_VISIBLE_VARIANTS ? ' cs-variant-hidden' : '');
      thumb.src     = getImg(color.image || prod.image);
      thumb.alt     = color.name;
      thumb.title   = color.name;
      thumb.loading = 'lazy';
      if (idx >= MAX_VISIBLE_VARIANTS) thumb.style.display = 'none';
      if (idx === 0) thumb.classList.add('cs-active');

      thumb.addEventListener('click', function (e) {
        e.stopPropagation();
        updateVariantState(color.name, thumb);
      });
      variantsWrap.appendChild(thumb);
    });

    if (allColors.length > MAX_VISIBLE_VARIANTS) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'cs-variants-toggle';
      toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5V19M5 12H19"/></svg>`;

      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        variantsExpanded = !variantsExpanded;
        variantsWrap.querySelectorAll('.cs-variant-hidden').forEach(t => {
          t.style.display = variantsExpanded ? 'block' : 'none';
        });
        toggleBtn.innerHTML = variantsExpanded
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12H19"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5V19M5 12H19"/></svg>`;
      });

      variantsWrap.appendChild(toggleBtn);
    }

    if (allColors.length > 0) body.appendChild(variantsWrap);

    const priceRow = document.createElement('div');
    priceRow.className = 'cs-price-row';
    priceRow.appendChild(priceEl);
    priceRow.appendChild(compareEl);
    body.appendChild(priceRow);

    const atcBtn = document.createElement('button');
    atcBtn.className = 'cs-atc-btn';
    atcBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      <span>${addToCartLabel || 'Add to Cart'}</span>`;

    atcBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      atcBtn.classList.add('cs-adding');
      addToCartFromWidget(prod, selectedVariant);
      setTimeout(() => {
        atcBtn.classList.remove('cs-adding');
        atcBtn.classList.add('cs-added');
        setTimeout(() => atcBtn.classList.remove('cs-added'), 1800);
      }, 400);
    });

    body.appendChild(atcBtn);
    card.appendChild(body);

    return card;
  }

  function initCollectionSlider(allProducts) {
    const track   = document.getElementById('csTrack');
    const dotsEl  = document.getElementById('csDots');
    const prevBtn = document.getElementById('csNavPrev');
    const nextBtn = document.getElementById('csNavNext');

    if (!track) return;

    const settings      = allProducts.find(p => p.type === 'settings') || {};
    const colSetting    = settings.collection_slider || {};
    const ids           = colSetting.product_ids || [];
    const addToCartLabel = (settings.button_labels && settings.button_labels.add_to_cart) || 'Add to Cart';

    if (!ids.length) {
      console.warn('[CollectionSlider] Aucun product_id dans settings.collection_slider');
      return;
    }

    const realProducts = allProducts.filter(p => !p.type);
    const sliderProds  = ids
      .map(id => realProducts.find(p => p.id === id))
      .filter(Boolean);

    if (!sliderProds.length) {
      console.warn('[CollectionSlider] Aucun produit trouvé pour les IDs fournis');
      return;
    }

    track.innerHTML = '';
    sliderProds.forEach(prod => {
      const card = buildCard(prod, addToCartLabel);
      track.appendChild(card);
    });

    if (dotsEl) {
      dotsEl.innerHTML = '';
      sliderProds.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'cs-dot' + (i === 0 ? ' cs-active' : '');
        dot.setAttribute('aria-label', 'Go to product ' + (i + 1));
        dot.addEventListener('click', () => {
          autoSlideIndex = i;
          scrollToCard(i);
          resetAutoSlide();
        });
        dotsEl.appendChild(dot);
      });
    }

    function scrollToCard(index) {
      const cards = track.querySelectorAll('.cs-card');
      if (!cards.length) return;
      const card = cards[index];
      if (!card) return;
      track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
      updateDots(index);
    }

    function updateDots(activeIdx) {
      if (!dotsEl) return;
      dotsEl.querySelectorAll('.cs-dot').forEach((d, i) => {
        d.classList.toggle('cs-active', i === activeIdx);
      });
    }

   /* ── Variables auto-slide ── */
let autoSlideIndex  = 0;
let autoSlideTimer  = null;
let isHovered       = false;
let isUserScrolling = false;
let scrollSyncTimer = null;
let manualPauseTimer = null;  // ← NOUVEAU

/* ── Scroll listener — sync dots + autoSlideIndex ── */
track.addEventListener('scroll', function () {
    isUserScrolling = true;
    clearTimeout(scrollSyncTimer);
    clearTimeout(manualPauseTimer);   // ← stop reprise immédiate
    clearInterval(autoSlideTimer);    // ← stop auto pendant scroll
    autoSlideTimer = null;

    scrollSyncTimer = setTimeout(function () {
        const cards = track.querySelectorAll('.cs-card');
        let closest = 0, minDist = Infinity;
        cards.forEach(function (c, i) {
            const dist = Math.abs(c.getBoundingClientRect().left - track.getBoundingClientRect().left);
            if (dist < minDist) { minDist = dist; closest = i; }
        });
        autoSlideIndex  = closest;
        isUserScrolling = false;
        updateDots(closest);

        // Reprendre l'auto-slide 4s après la fin du scroll manuel
        manualPauseTimer = setTimeout(startAutoSlide, 4000);
    }, 150);
});

/* ── Flèches prev/next ── */
const CARDS_TO_SCROLL = window.innerWidth >= 768 ? 4 : 1;

function scrollByDir(dir) {
    const cards = track.querySelectorAll('.cs-card');
    const cardW = cards[0] ? cards[0].offsetWidth + 20 : 220;
    track.scrollBy({ left: dir * CARDS_TO_SCROLL * cardW, behavior: 'smooth' });
}

if (prevBtn) prevBtn.addEventListener('click', function () {
    scrollByDir(-1);
    resetAutoSlide();
});
if (nextBtn) nextBtn.addEventListener('click', function () {
    scrollByDir(1);
    resetAutoSlide();
});

/* ── Auto-slide ── */
function startAutoSlide() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
    autoSlideTimer = setInterval(function () {
        if (isHovered || isUserScrolling) return;
        const cards = track.querySelectorAll('.cs-card');
        if (!cards.length) return;
        autoSlideIndex = (autoSlideIndex + 1) % cards.length;
        scrollToCard(autoSlideIndex);
    }, 5000);
}

function resetAutoSlide() {
    clearInterval(autoSlideTimer);
    clearTimeout(manualPauseTimer);
    autoSlideTimer = null;
    manualPauseTimer = setTimeout(startAutoSlide, 4000); // reprend 4s après
}

/* ── Pause sur hover ── */
track.addEventListener('mouseenter', function () { isHovered = true; });
track.addEventListener('mouseleave', function () { isHovered = false; });

/* ── Touch manuel — pause + reprise 4s après ── */
track.addEventListener('touchstart', function () {
    isHovered = true;
    clearInterval(autoSlideTimer);
    clearTimeout(manualPauseTimer);
    autoSlideTimer = null;
}, { passive: true });

track.addEventListener('touchend', function () {
    isHovered = false;
    manualPauseTimer = setTimeout(function () {
        startAutoSlide();
    }, 4000);
}, { passive: true });

/* ── Démarrage ── */
startAutoSlide();

    /* ── Synchro wishlist ── */
    document.addEventListener('wishlist:change', function () {
      track.querySelectorAll('.cs-card').forEach(function (card) {
        const pid  = card.dataset.productId;
        const prod = sliderProds.find(p => p.id === pid);
        if (!prod) return;
        const key = prod.handle || prod.id;
        const btn = card.querySelector('.cs-wishlist-btn');
        if (btn) btn.classList.toggle('cs-in-wishlist', isWishlisted(key));
      });
    });
  }

  if (window.__allProducts && Array.isArray(window.__allProducts)) {
    initCollectionSlider(window.__allProducts);
  } else {
    const origFetch = window.fetch;
    window.fetch = function (url, opts) {
      return origFetch.call(this, url, opts).then(function (res) {
        if (typeof url === 'string' && url.includes('products.data.json')) {
          res.clone().json().then(function (data) {
            if (Array.isArray(data)) initCollectionSlider(data);
          }).catch(() => {});
        }
        return res;
      });
    };

    let attempts = 0;
    const poll = setInterval(function () {
      attempts++;
      if (window.__allProducts && Array.isArray(window.__allProducts)) {
        clearInterval(poll);
        initCollectionSlider(window.__allProducts);
      }
      if (attempts > 25) clearInterval(poll);
    }, 200);
  }

})();
/* ── Newsletter particles ── */
(function () {
  var c = document.getElementById('nl-particles');
  if (!c) return;
  var cols = ['rgba(192,56,94,0.7)','rgba(232,188,106,0.55)','rgba(123,63,110,0.55)','rgba(255,255,255,0.12)'];
  for (var i = 0; i < 22; i++) {
    var p = document.createElement('div');
    p.className = 'nl-ptcl';
    var sz = Math.random() * 3 + 2, dur = Math.random() * 5 + 4, del = Math.random() * 7;
    p.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;left:' + (Math.random() * 100) + '%;bottom:' + (Math.random() * 20) + 'px;background:' + cols[i % cols.length] + ';animation-duration:' + dur + 's;animation-delay:' + del + 's;';
    c.appendChild(p);
  }
})();





(function() {
  'use strict';

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  function init() {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(function(el) {
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();



/* ═══════════════════════════════════════════════════════
   BBW4LIFE — IMAGE MARQUEE DOUBLE — INJECT FROM SETTINGS
═══════════════════════════════════════════════════════ */
(function initImageMarquee() {

  /* IDs des 20 produits : 10 gauche, 10 droite
     Modifiez librement l'ordre */
  var LEFT_IDS = [
    'Pdg-Francenel-product84',
    'Pdg-Francenel-product78',
    'Pdg-Francenel-product12',
    'Pdg-Francenel-product96',
    'Pdg-Francenel-product80',
    'Pdg-Francenel-product91',
    'Pdg-Francenel-product22',
    'Pdg-Francenel-product83',
    'Pdg-Francenel-product39',
    'Pdg-Francenel-product56'
  ];

  var RIGHT_IDS = [
    'Pdg-Francenel-product109',
    'Pdg-Francenel-product8',
    'Pdg-Francenel-product13',
    'Pdg-Francenel-product98',
    'Pdg-Francenel-product107',
    'Pdg-Francenel-product20',
    'Pdg-Francenel-product85',
    'Pdg-Francenel-product101',
    'Pdg-Francenel-product64',
    'Pdg-Francenel-product58'
  ];

  function getImg(url, size) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('cdn.shopify.com')) return url;
    url = url.replace(/[?&]width=\d+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
    var sep = url.includes('?') ? '&' : '?';
    return url + sep + 'width=' + (size || 600) + '&quality=90';
  }

  function buildCard(prod) {
    if (!prod) return null;

    var imgSrc      = getImg(prod.image, 600);
    var imgHoverSrc = prod.image_hover ? getImg(prod.image_hover, 600) : '';
    var title       = prod.title || '';
    var price       = prod.price != null ? '$' + parseFloat(prod.price).toFixed(2) : '';
    var badge       = (prod.badge && prod.badge.text) ? prod.badge.text : '';
    var url         = prod.url || '#';

    var card = document.createElement('a');
    card.className = 'imq-card';
    card.href      = url;

    var badgeHTML = badge
      ? '<span class="imq-card-badge">' + badge + '</span>'
      : '';

    var hoverHTML = imgHoverSrc
      ? '<img class="imq-card-img-hover" src="' + imgHoverSrc + '" alt="" loading="lazy" aria-hidden="true">'
      : '';

    card.innerHTML =
      badgeHTML +
      '<img class="imq-card-img" src="' + imgSrc + '" alt="' + title + '" loading="lazy">' +
      hoverHTML +
      '<div class="imq-card-overlay"></div>' +
      '<div class="imq-card-info">' +
        '<span class="imq-card-title">' + title + '</span>' +
        '<span class="imq-card-price">' + price + '</span>' +
      '</div>';

    return card;
  }

  function fillTrack(trackEl, ids, products) {
    if (!trackEl) return;

    var prods = ids
      .map(function(id) { return products.find(function(p) { return p.id === id; }); })
      .filter(Boolean);

    if (!prods.length) return;

    /* Clone double pour boucle sans fin */
    var fragment1 = document.createDocumentFragment();
    var fragment2 = document.createDocumentFragment();

    prods.forEach(function(prod) {
      var c1 = buildCard(prod);
      var c2 = buildCard(prod);
      if (c1) fragment1.appendChild(c1);
      if (c2) fragment2.appendChild(c2);
    });

    trackEl.appendChild(fragment1);
    trackEl.appendChild(fragment2);
  }

  function run(products) {
    var realProducts = products.filter(function(p) { return !p.type; });

    var trackLeft  = document.getElementById('imqTrackLeft');
    var trackRight = document.getElementById('imqTrackRight');

    fillTrack(trackLeft,  LEFT_IDS,  realProducts);
    fillTrack(trackRight, RIGHT_IDS, realProducts);
  }

  /* ── Attendre que products soit chargé ── */
  if (window.__allProducts && window.__allProducts.length) {
    run(window.__allProducts);
  } else {
    var tries = 0;
    var poll  = setInterval(function() {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll);
        run(window.__allProducts);
      } else if (tries > 80) {
        clearInterval(poll);
      }
    }, 100);
  }

})();




/* ════════════════════════════════════════════════════════════
   BBW4LIFE — VERIFY BADGE AFTER PRODUCT TITLE
════════════════════════════════════════════════════════════ */

(function initProductTitleBadge() {
  'use strict';

  function run() {
    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(function(p) { return p.type === 'settings'; }) || {};

    /* ── Lire le setting ── */
    const showBadge = (settings.product_title_badge || 'no').toLowerCase().trim() === 'yes';
    if (!showBadge) return;

    /* ── Le SVG du badge ── */
    const BADGE_SVG = `<svg class="bbw-title-badge-svg" id="Layer_1" data-name="Layer 1"
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 116.87"
      aria-label="Verified" role="img">
      <defs><style>.cls-1{fill-rule:evenodd;}</style></defs>
      <title>Verified</title>
      <path class="cls-1" d="M61.37,8.24,80.43,0,90.88,17.78l20.27,4.54-2,20.53,13.73,
        15.58L109.2,73.87l2,20.68L91,99,80.43,116.87l-18.92-8.25-19.06,8.25L32,
        99.08,11.73,94.55l2-20.54L0,58.43,13.68,43,11.73,22.32l20.15-4.45L42.45,
        0,61.37,8.24ZM37.44,64.55c-6.07-6.53,3.25-16.26,10-10.1,2.38,2.17,5.84,
        5.34,8.24,7.49L74.18,39.18C80.62,32.53,90.79,42.3,84.43,49L61.2,76.72a7.13,
        7.13,0,0,1-9.91.44C47.35,73.41,41.57,68,37.44,64.55Z"/>
    </svg>`;
    const titleBlocks = document.querySelectorAll('.paul-title-block');

    titleBlocks.forEach(function(block) {
      /* Éviter le doublon si déjà injecté */
      if (block.querySelector('.bbw-title-badge')) return;

      const titleEl = block.querySelector('.paul-main-title');
      if (!titleEl) return;

      /* Créer le wrapper badge */
      const badgeWrap = document.createElement('span');
      badgeWrap.className = 'bbw-title-badge';
      badgeWrap.setAttribute('aria-label', 'Verified');
      badgeWrap.setAttribute('title', 'Verified – Authentic Product');
      badgeWrap.innerHTML = BADGE_SVG;

      /* Insérer APRÈS le titre (avant paul-title-underline) */
      const underline = block.querySelector('.paul-title-underline');
      if (underline) {
        block.insertBefore(badgeWrap, underline);
      } else {
        block.appendChild(badgeWrap);
      }
    });
  }

  /* ── Lancer quand products est prêt ── */
  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    var tries = 0;
    var poll = setInterval(function() {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll);
        run();
      } else if (tries > 80) {
        clearInterval(poll);
      }
    }, 100);
  }

})();

/* ══════════════════════════════════════════════════════
   READING PROGRESS BAR — global (toutes les pages)
══════════════════════════════════════════════════════ */
(function() {
  var bar = document.getElementById('reading-progress-bar');
  if (!bar) return;
  window.addEventListener('scroll', function() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0).toFixed(1) + '%';
  }, { passive: true });
})();


/* ════════════════════════════════════════════════════════
   BBW4LIFE — CONTENT PROTECTION
════════════════════════════════════════════════════════ */
(function initContentProtection() {
  'use strict';

  /* ── CSS injecté dynamiquement ── */
  const style = document.createElement('style');
  style.id = 'bbw-content-protection-css';
  style.textContent = `
    body.bbw-no-select,
    body.bbw-no-select * {
      -webkit-user-select: none;
      -moz-user-select:    none;
      -ms-user-select:     none;
      user-select:         none;
    }
  `;
  document.head.appendChild(style);

  function run() {
    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(function(p) { return p.type === 'settings'; }) || {};
    const cp          = settings.content_protection || {};

    if ((cp.disable_right_click || 'no').toLowerCase() === 'yes') {
      document.addEventListener('contextmenu', function(e) {
        // Exception ciblée : sur la page checkout, laisse le clic droit
        // natif fonctionner dans les champs de saisie (coller une
        // adresse, un code promo, etc.) — le reste du site et le reste
        // de la page checkout restent protégés normalement.
        const onCheckout = location.pathname.includes('/checkout/');
        const isFormField = e.target.closest('input, textarea, select');
        if (onCheckout && isFormField) return;
        e.preventDefault();
      });
    }

    if ((cp.disable_text_selection || 'no').toLowerCase() === 'yes') {
      document.addEventListener('selectstart', function(e) { e.preventDefault(); });
      document.body.classList.add('bbw-no-select');
    }

    if ((cp.disable_image_download || 'no').toLowerCase() === 'yes') {
      document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'IMG') e.preventDefault();
      });
    }

    if ((cp.disable_video_download || 'no').toLowerCase() === 'yes') {
      document.addEventListener('contextmenu', function(e) {
        if (e.target.tagName === 'VIDEO') e.preventDefault();
      });
    }

    if ((cp.disable_copy || 'no').toLowerCase() === 'yes') {
      document.addEventListener('copy', function(e) { e.preventDefault(); });
    }

    if ((cp.disable_devtools_key || 'no').toLowerCase() === 'yes') {
      document.addEventListener('keydown', function(e) {
        if (e.keyCode === 123) { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
          e.preventDefault(); return false;
        }
        if (e.ctrlKey && e.keyCode === 85) { e.preventDefault(); return false; }
      });
    }
  }

  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    let tries = 0;
    const wait = setInterval(function() {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (tries > 80) clearInterval(wait);
    }, 100);
  }

})();


/* ================================================================
   BBW4LIFE — MINI WISHLIST ICONS INJECTOR
================================================================ */
(function initMiniWishlistIcons() {
  'use strict';

  var HEART_EMPTY  = '<svg class="bbw-mw-empty"  viewBox="0 0 24 24" fill="none" stroke="#e4b722" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  var HEART_FILLED = '<svg class="bbw-mw-filled" viewBox="0 0 24 24" fill="#e4b722" stroke="#e4b722" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  /* ── Helpers wishlist ── */
  function getWishlist() {
    if (typeof window.__getWishlist === 'function') return window.__getWishlist();
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); } catch(e) { return []; }
  }

  function setWishlist(wl) {
    if (typeof window.__setWishlist === 'function') window.__setWishlist(wl);
    localStorage.setItem('wishlist', JSON.stringify(wl));
  }

  function isWishlisted(id) {
    return getWishlist().indexOf(id) !== -1;
  }

  function toggleItem(id) {
    var wl  = getWishlist();
    var idx = wl.indexOf(id);
    if (idx === -1) wl.push(id);
    else wl.splice(idx, 1);
    setWishlist(wl);
    if (typeof window.updateBadges              === 'function') window.updateBadges();
    if (typeof window.updateWishlistIcons       === 'function') window.updateWishlistIcons();
    if (typeof window.renderWishlist            === 'function') window.renderWishlist();
    document.dispatchEvent(new Event('wishlist:change'));
  }

  /* ── Crée un bouton mini wishlist ── */
  function makeBtn(productId) {
    var btn = document.createElement('button');
    btn.className          = 'bbw-mini-wish' + (isWishlisted(productId) ? ' bbw-mw-active' : '');
    btn.setAttribute('aria-label', 'Toggle wishlist');
    btn.dataset.wishId     = productId;
    btn.innerHTML          = HEART_EMPTY + HEART_FILLED;

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleItem(productId);
      btn.classList.toggle('bbw-mw-active', isWishlisted(productId));
    });

    return btn;
  }

  /* ── Sync tous les boutons mini wishlist ── */
  function syncAll() {
    document.querySelectorAll('.bbw-mini-wish[data-wish-id]').forEach(function(btn) {
      btn.classList.toggle('bbw-mw-active', isWishlisted(btn.dataset.wishId));
    });
  }

  /* ────────────────────────────────────────────────────────
     1a. CART DRAWER — .cart-item .cart-item-img-wrap
  ────────────────────────────────────────────────────────── */
  function injectCartDrawerItems() {
    document.querySelectorAll('.cart-item').forEach(function(item) {
      var wrap = item.querySelector('.cart-item-img-wrap');
      if (!wrap || wrap.querySelector('.bbw-mini-wish')) return;
      var productId = item.dataset.id;
      if (!productId) return;
      wrap.appendChild(makeBtn(productId));
    });
  }

  /* ────────────────────────────────────────────────────────
     1b. CART PAGE — .cart-item .cart-item-img-wrap
  ────────────────────────────────────────────────────────── */
  function injectCartPageItems() {
    document.querySelectorAll('.cart-item, .cp-cart-item').forEach(function(item) {
      var wrap = item.querySelector('.cart-item-img-wrap, .cp-item-img-wrap');
      if (!wrap || wrap.querySelector('.bbw-mini-wish')) return;
      var productId = item.dataset.id;
      if (!productId) return;
      wrap.appendChild(makeBtn(productId));
    });
  }
  window.injectCartPageWishlistIcons = injectCartPageItems;

  /* ────────────────────────────────────────────────────────
     2. DRAWER EXTRA SECTION — coin inférieur gauche de l'image
  ────────────────────────────────────────────────────────── */
  function injectDrawerExtra() {
    ['drawer-extra-track', 'cp-extra-track'].forEach(function(trackId) {
      var track = document.getElementById(trackId);
      if (!track) return;

      track.querySelectorAll('.drawer-extra-card, .cp-extra-card').forEach(function(card) {
        var imgWrap = card.querySelector('.drawer-extra-card__img-wrap, .cp-extra-card__img-wrap');
        if (!imgWrap || imgWrap.querySelector('.bbw-mini-wish')) return;
        var productId = card.dataset.id;
        if (!productId) return;
        imgWrap.appendChild(makeBtn(productId));
      });
    });
  }

  /* ────────────────────────────────────────────────────────
     3. BBW PRODUCT GRID FEATURED — coin inférieur droit de l'image
  ────────────────────────────────────────────────────────── */
  function injectProductGrid() {
  var track = document.getElementById('bbwpg-track');
  if (!track) return;

  track.querySelectorAll('.bbwpg-card').forEach(function(card) {
    var imgWrap = card.querySelector('.bbwpg-card__img-wrap');
    if (!imgWrap || imgWrap.querySelector('.bbw-mini-wish')) return;

    var productId = null;

    /* Extraire l'ID depuis le href du lien image */
    var link = card.querySelector('.bbwpg-card__img-link');
    if (link && link.href) {
      var match = link.href.match(/product(\d+)\.html/);
      if (match && window.__allProducts) {
        var idx = parseInt(match[1]) - 1;
        var realProds = window.__allProducts.filter(function(p) { return !p.type; });
        if (realProds[idx]) productId = realProds[idx].id;
      }
    }

    if (!productId) return;
    imgWrap.appendChild(makeBtn(productId));
  });
}

/* ────────────────────────────────────────────────────────
   4. FEATURED SPOTLIGHT — coin supérieur droit de l'image
────────────────────────────────────────────────────────── */
function injectFeaturedSpotlight() {
  var section = document.getElementById('featured-spotlight');
  if (!section) return;

  var imgFrame = section.querySelector('.fs-img-frame');
  if (!imgFrame || imgFrame.querySelector('.bbw-mini-wish')) return;

  var productId = null;

  /* Récupérer l'ID depuis le lien du bouton "View Product" */
  var viewBtn = section.querySelector('.fs-btn-primary');
  if (viewBtn && viewBtn.href) {
    var match = viewBtn.href.match(/product(\d+)\.html/);
    if (match && window.__allProducts) {
      var idx = parseInt(match[1]) - 1;
      var realProds = window.__allProducts.filter(function(p) { return !p.type; });
      if (realProds[idx]) productId = realProds[idx].id;
    }
  }

  if (!productId) return;
  imgFrame.appendChild(makeBtn(productId));
}

/* ────────────────────────────────────────────────────────
   5. RECENTLY VIEWED — coin inférieur droit de l'image
────────────────────────────────────────────────────────── */
function injectRecentlyViewed() {
  var track = document.getElementById('rv-track');
  if (!track) return;

  track.querySelectorAll('.rv-card').forEach(function(card) {
    var imgWrap = card.querySelector('.rv-card__img-wrap');
    if (!imgWrap || imgWrap.querySelector('.bbw-mini-wish')) return;

    var url = card.href || '';
    var match = url.match(/product(\d+)\.html/);
    if (!match || !window.__allProducts) return;

    var idx = parseInt(match[1]) - 1;
    var realProds = window.__allProducts.filter(function(p) { return !p.type; });
    if (!realProds[idx]) return;

    imgWrap.appendChild(makeBtn(realProds[idx].id));
  });
}

/* ────────────────────────────────────────────────────────
   6. COL RECENTLY VIEWED — coin inférieur droit de l'image
────────────────────────────────────────────────────────── */
function injectColRecentlyViewed() {
  var grid = document.getElementById('colRvGrid');
  if (!grid) return;

  grid.querySelectorAll('.col-rv-card').forEach(function(card) {
    var img = card.querySelector('.col-rv-card__img');
    if (!img || card.querySelector('.bbw-mini-wish')) return;

    var productId = null;
    var allProds = window.__allProducts || [];
    var realProds = allProds.filter(function(p) { return !p.type; });

    // Retrouver le produit par correspondance d'image ou titre
    var titleEl = card.querySelector('.col-rv-card__title');
    var title = titleEl ? titleEl.textContent.trim() : '';
    var found = realProds.find(function(p) { return p.title === title; });
    if (found) productId = found.id;

    if (!productId) return;

    // Wrapper relatif
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:contents';
    img.style.display = 'block';

    card.style.position = 'relative';
    card.appendChild(makeBtn(productId));
  });
}

/* ────────────────────────────────────────────────────────
   7. COL FBT — coin inférieur droit de l'image
────────────────────────────────────────────────────────── */
function injectColFbt() {
  var inner = document.getElementById('colFbtInner');
  if (!inner) return;

  inner.querySelectorAll('.col-fbt-card').forEach(function(card) {
    if (card.querySelector('.bbw-mini-wish')) return;

    var productId = null;
    var allProds = window.__allProducts || [];
    var realProds = allProds.filter(function(p) { return !p.type; });

    var titleEl = card.querySelector('.col-fbt-card__title');
    var title = titleEl ? titleEl.textContent.trim() : '';
    var found = realProds.find(function(p) { return p.title === title; });
    if (found) productId = found.id;

    if (!productId) return;

    card.style.position = 'relative';
    card.appendChild(makeBtn(productId));
  });
}

  /* ────────────────────────────────────────────────────────
     RUN ALL
  ────────────────────────────────────────────────────────── */
  function runAll() {
    injectCartDrawerItems();
    injectCartPageItems();
    injectDrawerExtra();
    injectProductGrid();
    injectFeaturedSpotlight();
    injectRecentlyViewed();
    injectColRecentlyViewed();
    injectColFbt();
    syncAll();
  }

  /* Lancer après chargement */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll);
  } else {
    setTimeout(runAll, 400);
  }

  /* Observer les mutations DOM */
  var observer = new MutationObserver(function(mutations) {
    var relevant = mutations.some(function(m) { return m.addedNodes.length > 0; });
    if (relevant) runAll();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  /* Events système */
  document.addEventListener('cart:update',     runAll);
  document.addEventListener('wishlist:change', syncAll);

})();




/* ================================================================
   BBW4LIFE — IMAGE WATERMARK INJECTOR
   Injecte "bbw4life.com" en pâle sur toutes les images produit
================================================================ */
(function initImageWatermark() {
  'use strict';

  function run() {
    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(function(p) { return p.type === 'settings'; }) || {};
    const wm          = settings.watermark || {};

    if ((wm.show || 'no').toLowerCase().trim() !== 'yes') return;

    const TEXT = wm.text || 'bbw4life.com';

    function makeWatermark() {
      const el = document.createElement('span');
      el.className    = 'bbw-watermark';
      el.textContent  = TEXT;
      el.setAttribute('aria-hidden', 'true');
      return el;
    }

    function inject(wrap) {
      if (!wrap || wrap.querySelector('.bbw-watermark')) return;
      const pos = getComputedStyle(wrap).position;
      if (pos === 'static') wrap.style.position = 'relative';
      wrap.appendChild(makeWatermark());
    }

    function injectOnImg(img) {
      if (!img) return;
      const wrap = img.parentElement;
      if (wrap) inject(wrap);
    }

    /* ── 1. Page produit — sur le slider entier, pas sur chaque .main-image :
       la pile de cartes affiche plusieurs images simultanément et l'image
       active change dynamiquement (next/prev), donc un watermark unique
       fixé au conteneur évite les doublons et reste toujours visible. ── */
    inject(document.getElementById('main-image-slider'));

    /* ── 2. Collection grid cards ── */
    document.querySelectorAll('.col-card__media').forEach(inject);

    /* ── 3. BBW Product Grid Featured ── */
    document.querySelectorAll('.bbwpg-card__img-wrap').forEach(inject);

    /* ── 4. Collection Slider ── */
    document.querySelectorAll('.cs-media').forEach(inject);

    /* ── 5. Recently Viewed ── */
    document.querySelectorAll('.rv-card__img-wrap').forEach(inject);

    /* ── 5b. Recently Viewed — col-rv-card (collections page) ── */
    document.querySelectorAll('.col-rv-card__img').forEach(injectOnImg);

    /* ── 6. Featured Spotlight ── */
    const fsFrame = document.querySelector('.fs-img-frame');
    if (fsFrame) inject(fsFrame);

    /* ── 7. Mini product slider ── */
    document.querySelectorAll('.mini-media-slider').forEach(inject);

    /* ── 8. Cart items (drawer + page) ── */
    document.querySelectorAll('.cart-item-img-wrap, .cp-item-img-wrap').forEach(inject);

    /* ── 9. Cart extra + Drawer extra ── */
    document.querySelectorAll(
      '.drawer-extra-card__img-wrap, .cp-extra-card__img-wrap'
    ).forEach(inject);

    /* ── 10. Wishlist modal ── */
    document.querySelectorAll('.wishlist-item img').forEach(function(img) {
      const wrap = img.parentElement;
      if (wrap) inject(wrap);
    });

    /* ── 11. Shop Highlight cards ── */
    document.querySelectorAll('.highlight-product-card').forEach(inject);

    /* ── 12. Product cards génériques ── */
    document.querySelectorAll('.product-card').forEach(function(card) {
      const img = card.querySelector('img');
      if (img) inject(img.parentElement || card);
    });

    /* ── 13. FBT cards (collections page) ── */
    document.querySelectorAll('.col-fbt-card__img').forEach(injectOnImg);
  }

  /* ── Lancer quand products est prêt ── */
  if (window.__allProducts && window.__allProducts.length) {
    run();
  } else {
    let tries = 0;
    const wait = setInterval(function() {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        run();
      } else if (tries > 80) {
        clearInterval(wait);
      }
    }, 100);
  }

  /* ── Observer les mutations DOM (cards chargées dynamiquement) ── */
  const observer = new MutationObserver(function(mutations) {
    const relevant = mutations.some(function(m) { return m.addedNodes.length > 0; });
    if (!relevant) return;

    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(function(p) { return p.type === 'settings'; }) || {};
    const wm          = settings.watermark || {};
    if ((wm.show || 'no').toLowerCase().trim() !== 'yes') return;

    const TEXT = wm.text || 'bbw4life.com';

    function makeWatermark() {
      const el = document.createElement('span');
      el.className   = 'bbw-watermark';
      el.textContent = TEXT;
      el.setAttribute('aria-hidden', 'true');
      return el;
    }

    function inject(wrap) {
      if (!wrap || wrap.querySelector('.bbw-watermark')) return;
      const pos = getComputedStyle(wrap).position;
      if (pos === 'static') wrap.style.position = 'relative';
      wrap.appendChild(makeWatermark());
    }

    function injectOnImg(img) {
      if (!img) return;
      const wrap = img.parentElement;
      if (wrap) inject(wrap);
    }

    /* #main-image-slider lui-même (pas chaque .main-image) : la pile de
       cartes affiche plusieurs images simultanément, un seul watermark
       fixé au conteneur évite les doublons — cf. injection initiale plus haut. */
    inject(document.getElementById('main-image-slider'));

    document.querySelectorAll(
      '.col-card__media, .bbwpg-card__img-wrap, ' +
      '.cs-media, .rv-card__img-wrap, .fs-img-frame, .mini-media-slider, ' +
      '.cart-item-img-wrap, .cp-item-img-wrap, .drawer-extra-card__img-wrap, .cp-extra-card__img-wrap, ' +
      '.highlight-product-card'
    ).forEach(inject);

    document.querySelectorAll('.col-rv-card__img, .col-fbt-card__img').forEach(injectOnImg);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();


/* ================================================================
   BBW4LIFE — CARD PRELOAD LOGO
   Affiche le logo BBW4LIFE (sur fond légèrement teinté) dans toutes les
   cards produit tant que leur image réelle n'est pas encore chargée,
   pour éviter un flash de fond vide pendant le chargement — sur home,
   cart drawer, cart page, collections, story circles. Réutilise les
   mêmes conteneurs que le watermark (cf. initImageWatermark ci-dessus).
================================================================ */
(function initCardPreloadLogo() {
  'use strict';

  /* Conteneurs dédiés à l'image (occupent toute la zone image) : le logo
     peut couvrir tout le wrap en position:absolute sans recouvrir de texte. */
  const CARD_SELECTORS =
    '.col-card__media, .bbwpg-card__img-wrap, ' +
    '.cs-media, .rv-card__img-wrap, .fs-img-frame, .mini-media-slider, ' +
    '.cart-item-img-wrap, .cp-item-img-wrap, .drawer-extra-card__img-wrap, .cp-extra-card__img-wrap, ' +
    '.highlight-product-card, .product-card, ' +
    '.bbw-nb-card__media, .jrgq-gal-img-wrap, .imq-card, ' +
    '.col-hero__media';
  const IMG_WRAP_SELECTORS = '.col-rv-card__img, .col-fbt-card__img';
  /* Conteneurs mixtes (image + texte côte à côte, ex: flex) : on entoure
     seulement l'<img> d'un wrapper dédié, pour ne pas recouvrir le texte. */
  const IMG_ONLY_SELECTORS = '.bd-product-item img, .fs-thumb';

  function getSettings() {
    const allProducts = window.__allProducts || [];
    return (allProducts.find(function(p) { return p.type === 'settings'; }) || {}).card_preload_logo || {};
  }

  function attachToWrap(wrap, circular) {
    if (!wrap || wrap.dataset.bbwPreloadDone) return;
    const img = wrap.querySelector('img');
    if (!img) return;
    wrap.dataset.bbwPreloadDone = '1';

    const pos = getComputedStyle(wrap).position;
    if (pos === 'static') wrap.style.position = 'relative';

    const cfg = getSettings();
    const logoEl = document.createElement('img');
    logoEl.className = 'bbw-card-preload-logo' + (circular ? ' bbw-card-preload-logo--circular' : '');
    logoEl.src = cfg.logo_url || '/public/vrlogo%20bbw4life.png';
    logoEl.alt = '';
    logoEl.setAttribute('aria-hidden', 'true');
    if (cfg.bg_color) logoEl.style.setProperty('--bbw-preload-bg', cfg.bg_color);
    wrap.appendChild(logoEl);

    function reveal() {
      logoEl.classList.add('is-loaded');
      setTimeout(function() { if (logoEl.parentNode) logoEl.parentNode.removeChild(logoEl); }, 400);
    }
    if (img.complete && img.naturalWidth > 0) {
      reveal();
    } else {
      img.addEventListener('load', reveal, { once: true });
      img.addEventListener('error', reveal, { once: true });
    }
  }

  /* Enveloppe l'<img> d'un <span> dédié (même taille, inline-block) pour
     pouvoir y superposer le logo sans recouvrir le reste de la card. */
  function attachToImgOnly(img) {
    if (!img || img.dataset.bbwPreloadDone) return;
    if (img.parentElement && img.parentElement.classList.contains('bbw-preload-img-wrap')) return;
    img.dataset.bbwPreloadDone = '1';

    const wrap = document.createElement('span');
    wrap.className = 'bbw-preload-img-wrap';
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    attachToWrap(wrap, false);
  }

  function scan() {
    const cfg = getSettings();
    if ((cfg.show || 'no').toLowerCase().trim() !== 'yes') return;

    document.querySelectorAll(CARD_SELECTORS).forEach(function(wrap) { attachToWrap(wrap, false); });
    document.querySelectorAll(IMG_WRAP_SELECTORS).forEach(function(img) { attachToWrap(img.parentElement, false); });
    document.querySelectorAll(IMG_ONLY_SELECTORS).forEach(attachToImgOnly);
    /* Story circles : avatars ronds, logo en version circulaire. */
    document.querySelectorAll('.story-circle-ring').forEach(function(wrap) { attachToWrap(wrap, true); });
  }

  if (window.__allProducts && window.__allProducts.length) {
    scan();
  } else {
    let tries = 0;
    const wait = setInterval(function() {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(wait);
        scan();
      } else if (tries > 80) {
        clearInterval(wait);
      }
    }, 100);
  }

  const observer = new MutationObserver(function(mutations) {
    const relevant = mutations.some(function(m) { return m.addedNodes.length > 0; });
    if (!relevant) return;
    scan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();


/* ════════════════════════════════════════════════════════════
   BBW COLLAPSIBLE INFO BLOCKS
   Generic accordion behavior for any product-page info block
   marked up with class="bbw-collapsible" on its wrapper and
   class="bbw-collapsible__toggle" on its existing *__header
   element. Injects a chevron icon into the header, wraps every
   sibling after the header into a .bbw-collapsible__body, and
   toggles open/closed on click. Blocks start closed.
════════════════════════════════════════════════════════════ */
(function initCollapsibleInfoBlocks() {
  document.querySelectorAll('.bbw-collapsible').forEach(function (block) {
    if (block.dataset.collapsibleReady) return;
    const toggle = block.querySelector(':scope > .bbw-collapsible__toggle');
    if (!toggle) return;

    const chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-down bbw-collapsible__chevron';
    toggle.appendChild(chevron);

    const body = document.createElement('div');
    body.className = 'bbw-collapsible__body';
    let sibling = toggle.nextSibling;
    while (sibling) {
      const next = sibling.nextSibling;
      body.appendChild(sibling);
      sibling = next;
    }
    block.appendChild(body);

    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-expanded', 'false');

    function toggleBlock() {
      const isOpen = block.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    toggle.addEventListener('click', toggleBlock);
    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleBlock();
      }
    });

    block.dataset.collapsibleReady = '1';
  });
})();


/* ════════════════════════════════════════════════════════════
   P2 UPSELL COLLAPSIBLE — dédié au bloc "Complete Your Queen Look"
   uniquement, indépendant du système générique .bbw-collapsible.
   Le HTML porte déjà .p2-upsell-body (pas de réorganisation DOM à
   faire ici) : ce script gère seulement le toggle ouvert/fermé.
   Fermé par défaut, le client l'ouvre lui-même.
════════════════════════════════════════════════════════════ */
(function initP2UpsellCollapsible() {
  document.querySelectorAll('.p2-upsell-collapsible').forEach(function (block) {
    if (block.dataset.p2UpsellReady) return;
    const toggle = block.querySelector(':scope > .p2-upsell-toggle');
    if (!toggle) return;

    function toggleBlock() {
      const isOpen = block.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    toggle.addEventListener('click', toggleBlock);
    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleBlock();
      }
    });

    block.dataset.p2UpsellReady = '1';
  });
})();