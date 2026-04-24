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
   CURVAFIT PRELOADER
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

  var MORPH_TEXTS  = ['Loading', 'Preparing your journey', 'Almost there', 'Welcome ✨'];
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
        // Masquage instantané — pas de transition, pas de délai
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
      'rgba(192,56,94,0.6)',
      'rgba(232,188,106,0.5)',
      'rgba(123,63,110,0.5)',
      'rgba(255,255,255,0.25)'
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

  url = url.replace(
    /_(pico|icon|thumb|small|compact|medium|large|grande|original|master|1024x1024|2048x2048|\d+x\d+|\d+x|x\d+)(\.(?:jpg|jpeg|png|webp|gif|avif))(\?|$)/gi,
    '$2$3'
  );

  const w = size || 1000;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + `width=${w}&quality=100`;
}


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
      '/index.html',
      '/method.html',
      '/programs.html',
      '/nutrition.html',
      '/shop.html',
      '/success.html',
      '/community.html',
      '/about.html',
      '/contact.html',
      '/blog/blog.html',
      '/faq.html',
      '/account.html'
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
      height: auto;
    }
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
    const popup = document.getElementById('error-popup');
    const popupText = document.getElementById('popup-message');
    const closeBtn = document.getElementById('popup-close');
    if (!popup || !popupText || !closeBtn) { console.error("Popup HTML manquant !"); return; }
    popupText.textContent = message;
    popup.classList.add('show');
    closeBtn.onclick = () => popup.classList.remove('show');
    setTimeout(() => { if (popup.classList.contains('show')) popup.classList.remove('show'); }, 10000);
  }

  // ====================== GET PRODUCT URL ======================
  function getProductUrl(id) {
    if (!products || !Array.isArray(products) || products.length === 0) { console.warn("Products pas encore chargés → fallback shop.html"); return 'shop.html'; }
    const productIndex = products.findIndex(p => String(p.id) === String(id));
    if (productIndex === -1) { console.warn(`Produit ID ${id} non trouvé dans products.data.json`); return 'shop.html'; }
    const currentPath = window.location.pathname;
    const isInsideProductsFolder = currentPath.includes('/products/') || /product\d+\.html$/.test(currentPath);
    return isInsideProductsFolder ? `product${productIndex + 1}.html` : `products/product${productIndex + 1}.html`;
  }

  // ====================== PRODUCT MEDIA ======================
  function populateMainProductMedia(media) {
    const thumbsContainer = document.getElementById('product-thumbnails');
    const mainSlider = document.getElementById('main-image-slider');
    if (!thumbsContainer || !mainSlider) return;
    thumbsContainer.innerHTML = '';
    mainSlider.querySelectorAll('.main-image').forEach(el => el.remove());
    media.forEach((src, index) => {
      const thumb = document.createElement('div');
      thumb.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
      const sharpSrc = upgradeShopifyImageUrl(src);
      thumb.innerHTML = `<img src="${sharpSrc}" alt="Thumbnail ${index+1}" loading="lazy">`;
      thumb.addEventListener('click', () => changeMainImage(index));
      thumbsContainer.appendChild(thumb);
      const mainDiv = document.createElement('div');
      mainDiv.className = `main-image ${index === 0 ? 'active' : ''}`;
      mainDiv.dataset.originalSrc = sharpSrc;
      mainDiv.innerHTML = `<img src="${sharpSrc}" alt="Main Image" loading="lazy">`;
      mainSlider.insertBefore(mainDiv, mainSlider.querySelector('.slider-arrow.next'));
    });
    mainSlider.querySelector('.prev').onclick = () => changeMainImage('prev');
    mainSlider.querySelector('.next').onclick = () => changeMainImage('next');
  }

  let currentMainIndex = 0;
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
  }

  function populateMiniSlider(slider, media) {
    if (!slider || !media) return;
    slider.innerHTML = '';
    media.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = upgradeShopifyImageUrl(src);
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


      // ══════════════════════════════════════════
      //  WIDGET VISIBILITY PER PAGE
      // ══════════════════════════════════════════
      (function applyWidgetVisibility() {
        const settings = products.find(p => p.type === 'settings') || {};
        const wv = settings.widget_visibility;
        if (!wv) return;

        const currentPath = window.location.pathname;
        const pages = wv.pages || [];

        // Only apply on listed pages
        if (!pages.some(p => currentPath.endsWith(p) || currentPath === p)) return;

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
      el.textContent = s[key];
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

        banner.querySelectorAll('.sanaica-banner-paul-image').forEach((img, i) => {
          const slide = sb.slides && sb.slides[i];
          if (slide) { img.src = slide.image; img.alt = slide.alt; }
        });
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
                  const s = stockData.totalStock;
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

            item.innerHTML = `
              <img src="${upgradeShopifyImageUrl(prod.image)}" alt="${prod.title}" loading="lazy">
              <div class="bd-product-info">
                <strong>${prod.title}</strong>
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
            window.location.href = '/checkout.html';
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

        // SVG wishlist définis une seule fois
        const WISHLIST_SVG = `
          <svg class="wishlist-icon-empty" width="30px" height="30px" viewBox="0 0 24 24" fill="none" stroke="#c0385e" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <svg class="wishlist-icon-filled" width="30px" height="30px" viewBox="0 0 24 24" fill="#c0385e" stroke="#c0385e" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>`;

        const sliderTrack = miniSliderEl.querySelector('.product-slider');

        document.querySelectorAll('#mini-product-slider .product-item').forEach(item => {
          const pid  = item.dataset.productId;
          const prod = products.find(p => p.id === pid);

          // Injecter SVG wishlist
          const wishlistIcon = item.querySelector('.mini-wishlist-icon');
          if (wishlistIcon) {
            wishlistIcon.dataset.id = pid;
            wishlistIcon.innerHTML  = WISHLIST_SVG;
          }

          // URL depuis JSON
          const link = item.querySelector('.mini-product-link');
          if (link && prod && prod.url) link.href = prod.url;

          // Prix + badge
          if (prod) {
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
          }
        });

        // Auto-slide toutes les 7 secondes
        if (sliderTrack) {
          const items = sliderTrack.querySelectorAll('.product-item');
          if (items.length > 1) {
            let currentSlide = 0, isHovered = false, isPaused = false, pauseTimer = null;

            const resumeAfterDelay = () => {
              clearTimeout(pauseTimer);
              isPaused = true;
              pauseTimer = setTimeout(() => { isPaused = false; }, 4000);
            };

            miniSliderEl.addEventListener('mouseenter', () => { isHovered = true;  });
            miniSliderEl.addEventListener('mouseleave', () => { isHovered = false; });
            sliderTrack.addEventListener('scroll',     resumeAfterDelay, { passive: true });
            sliderTrack.addEventListener('touchstart', resumeAfterDelay, { passive: true });

            setInterval(() => {
              if (isHovered || isPaused) return;
              currentSlide = (currentSlide + 1) % items.length;
              const itemWidth = items[0].offsetWidth + parseInt(getComputedStyle(sliderTrack).gap || 0);
              sliderTrack.scrollTo({ left: currentSlide * itemWidth, behavior: 'smooth' });
            }, 7000);
          }
        }
      }

      function populateMiniSlider(slider, media) {
        if (!slider || !media) return;
        slider.innerHTML = '';
        media.forEach((src, i) => {
          const img     = document.createElement('img');
          img.src       = upgradeShopifyImageUrl(src);
          img.className = `mini-media-image ${i === 0 ? 'active' : ''}`;
          img.loading   = 'lazy';
          slider.appendChild(img);
        });
        const prev = document.createElement('div');
        const next = document.createElement('div');
        prev.className = 'mini-media-slider-prev';
        next.className = 'mini-media-slider-next';
        prev.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); slideMini(slider, 'prev'); });
        next.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); slideMini(slider, 'next'); });
        slider.appendChild(prev);
        slider.appendChild(next);
        if (media.length > 1) {
          setInterval(() => slideMini(slider, 'next'), 4000);
        }
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
          populateMainProductMedia(prod.media);
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
                if (mainImg) mainImg.src = colorObj.image;
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
          function updateTransform(smooth = true) {
            modalImg.style.transition = smooth ? 'transform 0.25s ease' : 'none';
            modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
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
          mainImages.forEach(container => {
            const img = container.querySelector('img');
            if (!img) return;
            if (!isTouchDevice) {
              container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                img.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
              });
              container.addEventListener('mouseleave', () => { img.style.transformOrigin = 'center center'; });
            }
            if (isTouchDevice) {
              container.style.cursor = 'pointer';
              container.addEventListener('click', (e) => {
                e.stopImmediatePropagation();
                modalImg.src = img.src;
                modal.classList.add('active');
                scale = 1; translateX = 0; translateY = 0;
                updateTransform(false);
                if (modalImg.complete) calculateBounds();
                else modalImg.onload = calculateBounds;
              });
            }
          });
          if (closeBtn && modal) {
            const closeModal = () => {
              modal.classList.remove('active');
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

      window.getProductUrl = getProductUrl;

// Ces lignes existaient déjà — NE PAS SUPPRIMER
window.openCartDrawer = openCartDrawer;
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

    // Détecte automatiquement la page courante (product1, product2, etc.)
    var pageMatch  = window.location.pathname.match(/product(\d+)\.html/);
    var pageKey    = pageMatch ? 'product' + pageMatch[1] : '';
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
window.__setCart = (c) => { cart = c; };
window.__getWishlist = () => wishlist;
window.__setWishlist = (w) => { wishlist = w; };

(function() {
  var badge = document.getElementById('p2-upsell-badge');
  if (!badge) return;
  var pageMatch   = window.location.pathname.match(/product(\d+)\.html/);
  var pageKey     = pageMatch ? 'product' + pageMatch[1] : '';
  var upsellCfg   = (settings.product_upsell || {})[pageKey] || {};
  var discountPct = parseFloat(upsellCfg.discount_percent) || 0;
  if (discountPct > 0) badge.textContent = 'Save ' + discountPct + '%';
})();
initAnnouncementBar();


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


// ══════════════════════════════════════════════════════
//   PLAN REQUEST RESERVATION POPUP
// ══════════════════════════════════════════════════════
(function initPlanReservationPopup() {
    'use strict';

    const overlay     = document.getElementById('plan-popup-overlay');
    const modal       = overlay ? overlay.querySelector('.plan-popup-modal') : null;
    const closeBtn    = document.getElementById('plan-popup-close');
    const openBtn     = document.getElementById('open-plan-popup');
    const stepForm    = document.getElementById('plan-step-form');
    const stepPayment = document.getElementById('plan-step-payment');
    const stepThanks  = document.getElementById('plan-step-thanks');
    const submitBtn   = document.getElementById('plan-submit-btn');
    const payBtn      = document.getElementById('plan-pay-btn');
    const backBtn     = document.getElementById('plan-back-btn');
    const closeThanks = document.getElementById('plan-close-thanks');
    const spotsCount  = document.getElementById('plan-spots-count');

    if (!overlay || !modal) return;

    let clientData      = {};
    let selectedProgram = '';
    let reservationPrice = 10;

    // ── Inject price labels ──
    function injectPriceLabels(price) {
        document.querySelectorAll('.plan-reservation-price-label').forEach(el => {
            el.textContent = '$' + price;
        });
    }

    // ── Load price from settings ──
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

    // ── Spots ──
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

    // ── Open / Close ──
    function openPopup() {
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
        if (stepForm)    stepForm.style.display    = step === 'form'    ? '' : 'none';
        if (stepPayment) stepPayment.style.display = step === 'payment' ? '' : 'none';
        if (stepThanks)  stepThanks.style.display  = step === 'thanks'  ? '' : 'none';
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
        window.history.replaceState({}, '', window.location.pathname);
    }

    if (openBtn)     openBtn.addEventListener('click', openPopup);
    document.querySelectorAll('.open-plan-popup-extra').forEach(btn => {
      btn.addEventListener('click', openPopup);
    });
    if (closeBtn)    closeBtn.addEventListener('click', closePopup);
    if (closeThanks) closeThanks.addEventListener('click', closePopup);
    overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });
    if (backBtn) backBtn.addEventListener('click', () => showStep('form'));

    // ── Helpers ──
    function showError(id, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }
    function clearErrors() {
        ['plan-popup-error', 'plan-pay-error'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.textContent = ''; el.style.display = 'none'; }
        });
    }
    function val(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }
    function setBtnLoading(btn, loading) {
        if (!btn) return;
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<div class="plan-spinner"></div> Processing...'
            : '<i class="fi fi-rr-lock"></i> Pay $' + reservationPrice + ' — Reserve My Spot';
    }

    // ── STEP 1 ──
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            clearErrors();
            const firstName = val('plan-firstname');
            const lastName  = val('plan-lastname');
            const email     = val('plan-email');
            const phone     = val('plan-phone');
            const program   = val('plan-program');
            const consent   = document.getElementById('plan-consent') && document.getElementById('plan-consent').checked;

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

            clientData      = { firstName, lastName, email, phone, program, consent: 'Yes' };
            selectedProgram = program;

            const payProgramName = document.getElementById('plan-pay-program-name');
            if (payProgramName) payProgramName.textContent = program;

            showStep('payment');
        });
    }

    // ── STEP 2 → Pay ──
    if (payBtn) {
        payBtn.addEventListener('click', async () => {
            clearErrors();
            const method = document.querySelector('input[name="plan-payment"]:checked');
            if (!method) {
                showError('plan-pay-error', 'Please choose a payment method.');
                return;
            }
            setBtnLoading(payBtn, true);
            try {
                if (method.value === 'stripe') {
                    await handleStripe();
                } else {
                    await handlePaypal();
                }
            } catch (err) {
                showError('plan-pay-error', err.message || 'Payment failed. Please try again.');
                setBtnLoading(payBtn, false);
            }
        });
    }

    // ── Stripe : crée la session et redirige ──
    async function handleStripe() {
        const res  = await fetch('/.netlify/functions/create-reservation-stripe-session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                action:   'create',
                amount:   reservationPrice,
                program:  selectedProgram,
                customer: clientData,
            }),
        });
        const data = await res.json();
        if (!data.success || !data.sessionId) throw new Error(data.error || 'Stripe session failed.');

        sessionStorage.setItem('plan_res_client',  JSON.stringify(clientData));
        sessionStorage.setItem('plan_res_program', selectedProgram);

        const settings  = (window.__allProducts || []).find(p => p.type === 'settings') || {};
        const stripeKey = window.STRIPE_PUBLIC_KEY || settings.stripe_public_key || '';
        const stripe    = Stripe(stripeKey);
        await stripe.redirectToCheckout({ sessionId: data.sessionId });
    }

    // ── PayPal : crée l'ordre et redirige ──
    async function handlePaypal() {
        const res  = await fetch('/.netlify/functions/create-reservation-paypal', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                action:   'create',
                amount:   reservationPrice,
                program:  selectedProgram,
                customer: clientData,
            }),
        });
        const data = await res.json();
        if (!data.success || !data.approvalUrl) throw new Error(data.error || 'PayPal failed.');

        sessionStorage.setItem('plan_res_client',  JSON.stringify(clientData));
        sessionStorage.setItem('plan_res_program', selectedProgram);

        window.location.href = data.approvalUrl;
    }

    // ══════════════════════════════════════════
    //  RETOUR STRIPE — res_session_id dans l'URL
    // ══════════════════════════════════════════
    async function checkReturnFromStripe() {
        const params    = new URLSearchParams(window.location.search);
        const sessionId = params.get('res_session_id');
        if (!sessionId) return false;

        const pendingClient  = JSON.parse(sessionStorage.getItem('plan_res_client')  || 'null');
        const pendingProgram = sessionStorage.getItem('plan_res_program') || '';

        // Afficher popup remerciements immédiatement
        const firstName = pendingClient ? pendingClient.firstName : '';
        showThanksStep(firstName, pendingProgram);

        // Vérifier paiement + sauvegarder dans le sheet (dans la même function)
        try {
            const res  = await fetch('/.netlify/functions/create-reservation-stripe-session', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ action: 'verify', sessionId }),
            });
            const data = await res.json();
            if (!data.success) {
                console.warn('[ReservationPopup] Stripe verify:', data.error);
            }
        } catch (err) {
            console.error('[ReservationPopup] Stripe verify error:', err.message);
        }

        sessionStorage.removeItem('plan_res_client');
        sessionStorage.removeItem('plan_res_program');
        return true;
    }

    // ══════════════════════════════════════════
    //  RETOUR PAYPAL — res_paypal=1&token=XXX dans l'URL
    //  PayPal ajoute automatiquement ?token=ORDERID&PayerID=XXXX
    // ══════════════════════════════════════════
    async function checkReturnFromPaypal() {
        const params    = new URLSearchParams(window.location.search);
        const resPaypal = params.get('res_paypal');
        const orderID   = params.get('token'); // PayPal passe l'orderID comme "token"

        if (!resPaypal || !orderID) return false;

        const pendingClient  = JSON.parse(sessionStorage.getItem('plan_res_client')  || 'null');
        const pendingProgram = sessionStorage.getItem('plan_res_program') || '';

        // Afficher popup remerciements immédiatement
        const firstName = pendingClient ? pendingClient.firstName : '';
        showThanksStep(firstName, pendingProgram);

        // Capturer paiement + sauvegarder dans le sheet (dans la même function)
        try {
            const res  = await fetch('/.netlify/functions/create-reservation-paypal', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    action:     'capture',
                    orderID:    orderID,
                    clientData: pendingClient,
                    program:    pendingProgram,
                    amount:     reservationPrice,
                }),
            });
            const data = await res.json();
            if (!data.success) {
                console.warn('[ReservationPopup] PayPal capture:', data.error);
            }
        } catch (err) {
            console.error('[ReservationPopup] PayPal capture error:', err.message);
        }

        sessionStorage.removeItem('plan_res_client');
        sessionStorage.removeItem('plan_res_program');
        return true;
    }

    // ── Init ──
    async function init() {
        const stripeHandled = await checkReturnFromStripe();
        if (!stripeHandled) await checkReturnFromPaypal();
    }

    init();

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
(function initBreadcrumbs() {
  const settings = (products.find(p => p.type === 'settings') || {});
  const bc = settings.breadcrumbs || {};

  if ((bc.show || 'yes').toLowerCase() !== 'yes') return;

  const nav  = document.getElementById('bc-nav');
  const list = document.getElementById('bc-list');
  if (!nav || !list) return;

  // ── Séparateur : lit les 7 clés, active celle qui a "yes"
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

  // ── Page courante
  const currentPath  = window.location.pathname;
  const currentTitle = document.title.split('|')[0].trim() || document.title;

  // ── Historique localStorage (6 dernières pages)
  const BC_KEY = 'bc_visited';
  const BC_MAX = 6;

  let visited = [];
  try { visited = JSON.parse(localStorage.getItem(BC_KEY) || '[]'); } catch(e) {}

  visited = visited.filter(p => p.url !== currentPath);

  if (currentPath !== '/' && currentPath !== '/index.html') {
    visited.unshift({ url: currentPath, title: currentTitle });
  }

  if (visited.length > BC_MAX) visited = visited.slice(0, BC_MAX);

  try { localStorage.setItem(BC_KEY, JSON.stringify(visited)); } catch(e) {}

  // ── Construire la liste
  list.innerHTML = `
    <li class="bc-item">
      <a href="/index.html">
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
    const isActive = page.url === currentPath;
    const li = document.createElement('li');
    li.className = 'bc-item' + (isActive ? ' bc-active' : '');
    li.innerHTML = `<a href="${page.url}">${page.title}</a>`;
    list.appendChild(li);
  });

  nav.style.display = 'block';

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

  // ── Position : lit les 4 clés, active celle qui a "yes"
  const positionMap = {
    'position_bottom_right': 'rc-pos-bottom-right',
    'position_bottom_left':  'rc-pos-bottom-left',
    'position_top_right':    'rc-pos-top-right',
    'position_top_left':     'rc-pos-top-left'
  };

  let activePos = 'rc-pos-bottom-right';
  for (const [key, cls] of Object.entries(positionMap)) {
    if ((rc[key] || 'no').toLowerCase() === 'yes') {
      activePos = cls;
      break;
    }
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

  // ── Texts fixes
  subtitleEl.textContent = rc.subtitle_text    || "Don't forget!";
  descEl.textContent     = rc.description_text || "Complete your order before it's gone!";
  btnText.textContent    = rc.button_text      || "Complete My Purchase";

  const initialDelay = parseInt(rc.initial_delay_ms)    || 8000;
  const displayTime  = parseInt(rc.display_duration_ms) || 6000;
  const interval     = parseInt(rc.interval_ms)         || 30000;

  let hideTimer  = null;
  let cycleTimer = null;
  let visible    = false;

  // ── Calcule la quantité totale dans le cart (free inclus)
  function getCartQty() {
    return cart.reduce((sum, i) => sum + i.quantity, 0);
  }

  // ── Met à jour le titre + badge + barre urgence
  function updateTitle() {
    const qty = getCartQty();
    const raw = rc.title_text || 'You have [COUNT] item(s) in your cart';
    const label = qty > 1 ? 'items' : 'item';
    titleEl.textContent = raw
      .replace('[COUNT]', qty)
      .replace('item(s)', label);

    // Badge count
    if (countText) {
      countText.textContent = qty + (qty > 1 ? ' items waiting' : ' item waiting');
    }

    // Barre urgence — repart à 100% à chaque affichage
    if (fill) {
      fill.style.animation = 'none';
      fill.offsetHeight; // force reflow
      fill.style.animationDuration = displayTime + 'ms';
      fill.style.animation = `rc-urgency-drain ${displayTime}ms linear forwards`;
    }
  }

  function showPopup() {
    const qty = getCartQty();
    if (qty === 0) return;

    updateTitle();
    container.style.display = 'block';
    popup.classList.remove('rc-hiding');
    visible = true;

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

  function scheduleCycle() {
    clearInterval(cycleTimer);
    cycleTimer = setInterval(() => {
      if (!visible && getCartQty() > 0) showPopup();
    }, interval);
  }

  // ── Fermeture manuelle
  closeBtn.addEventListener('click', () => {
    if (hideTimer) clearTimeout(hideTimer);
    hidePopup();
  });

  // ── Premier affichage après le délai initial
  setTimeout(() => {
    if (getCartQty() > 0) showPopup();
    scheduleCycle();
  }, initialDelay);

  // ── Fonction globale appelée par saveCart() à chaque changement
  window.__rcRefresh = function() {
    const qty = getCartQty();
    updateTitle();
    if (qty === 0) {
      hidePopup();
    } else if (!visible) {
      if (hideTimer) clearTimeout(hideTimer);
      showPopup();
    }
  };

})();

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


// ══════════════════════════════════════════
//  STORY CIRCLES — dynamique depuis settings
// ══════════════════════════════════════════
(function initStoryCircles() {
  const section = document.getElementById('story-circles');
  const track   = document.getElementById('storyCirclesTrack');
  if (!section || !track) return;

  const settings = products.find(p => p.type === 'settings') || {};
  const sc       = settings.story_circles || {};
  const ids      = sc.product_ids || [];

  // Lecture du format multi-animation
  const animations = sc.animations || { marquee: 'yes' };
  const animType = Object.keys(animations).find(
    k => (animations[k] || '').toLowerCase() === 'yes'
  ) || 'marquee';

  if (!ids.length) { section.style.display = 'none'; return; }

  // Classe animation sur la section
  section.classList.add('anim--' + animType);

  // Filtre les produits dans l'ordre des ids
  const realProducts = ids
    .map(id => products.find(p => p.id === id))
    .filter(Boolean);

  if (!realProducts.length) { section.style.display = 'none'; return; }

  // Crée un item cercle
  function makeItem(prod) {
    const url   = getProductUrl(prod.id);
    const label = prod.title.split('—')[0].split('-')[0].trim();
    const img   = upgradeShopifyImageUrl(prod.image, 300);
    const a = document.createElement('a');
    a.href      = url;
    a.className = 'story-circle-item';
    a.setAttribute('aria-label', prod.title);
    a.innerHTML = `
      <div class="story-circle-ring">
        <img class="story-circle-img"
             src="${img}"
             alt="${prod.title}"
             loading="lazy"
             onerror="this.src='${prod.image}'">
      </div>
      <span class="story-circle-label">${label}</span>`;
    return a;
  }

  if (animType === 'marquee') {
    // Calcule combien de fois répéter pour dépasser largement la largeur de l'écran
    const screenW = window.innerWidth;
    const itemW   = 90 + 18; // width + gap
    const totalW  = realProducts.length * itemW;
    const repeats = Math.ceil((screenW * 3) / totalW) + 1;

    const group1 = document.createElement('div');
    const group2 = document.createElement('div');
    group1.className = 'story-circles-marquee-inner';
    group2.className = 'story-circles-marquee-inner';

    for (let i = 0; i < repeats; i++) {
      realProducts.forEach(prod => {
        group1.appendChild(makeItem(prod));
        group2.appendChild(makeItem(prod));
      });
    }

    track.appendChild(group1);
    track.appendChild(group2);

  } else {
    // Animations statiques : items directs dans le track
    realProducts.forEach(prod => track.appendChild(makeItem(prod)));
  }
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

        if (!bar || !satcImg) return;

        // ── État interne ──
        let satcQty          = 1;
        let satcSelectedColor = null;
        let satcSelectedSize  = null;

        const hasColors = product.colors && product.colors.length > 0;
        const hasSizes  = product.sizes  && product.sizes.length  > 0;

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

        // ── Add to Cart ──
        satcAddBtn.addEventListener('click', () => {
            // Vérifications
            if (hasColors && !satcSelectedColor) {
                showErrorPopup('Please select a color.');
                return;
            }
            if (hasSizes && !satcSelectedSize) {
                showErrorPopup('Please select a size.');
                return;
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
            openCartDrawer();

            // Feedback visuel
            satcAddBtn.classList.add('added');
            satcAddBtn.querySelector('span').textContent = 'Added!';
            setTimeout(() => {
                satcAddBtn.classList.remove('added');
                satcAddBtn.querySelector('span').textContent = 'Add to Cart';
            }, 2000);
        });

        // ── Trigger : afficher la barre quand on approche du footer ──
        const footer = document.querySelector('footer.footer');
        const addToCartMainBtn = document.querySelector('.product-content .add-to-cart');

        function checkStickyVisibility() {
        if (!footer) return;

        const footerTop      = footer.getBoundingClientRect().top;
        const footerHeight   = footer.offsetHeight;
        const windowHeight   = window.innerHeight;

        // Afficher seulement quand on est à 50% dans le footer
        const footerMidpoint = footerTop + (footerHeight * 0.7);
        const atFooterMid    = footerMidpoint < windowHeight;

        // Cacher si le bouton principal ATC est visible à l'écran
        let mainBtnVisible = false;
        if (addToCartMainBtn) {
            const rect = addToCartMainBtn.getBoundingClientRect();
            mainBtnVisible = rect.top >= 0 && rect.bottom <= windowHeight;
        }

        if (atFooterMid && !mainBtnVisible) {
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
        // Filter out current product
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
                           : 'shop.html';
          const img      = upgradeShopifyImageUrl(prod.image, 400);
          const imgHover = prod.image_hover
                           ? upgradeShopifyImageUrl(prod.image_hover, 400)
                           : img;
          const discount = prod.compare_price > prod.price
                           ? Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100)
                           : 0;
          const badge    = (prod.badge && prod.badge.text) ? prod.badge.text : '';

          const card = document.createElement('a');
          card.className  = 'rv-card';
          card.href       = url;
          card.style.animationDelay = (idx * 0.06) + 's';

          card.innerHTML =
            '<div class="rv-card__img-wrap">' +
              '<img class="rv-card__img" src="' + img + '" alt="' + prod.title + '" loading="lazy">' +
              (imgHover !== img
                ? '<img class="rv-card__img-hover" src="' + imgHover + '" alt="' + prod.title + '" loading="lazy">'
                : '') +
              (badge
                ? '<span class="rv-card__badge">' + badge + '</span>'
                : '') +
            '</div>' +
            '<div class="rv-card__body">' +
              '<div class="rv-card__title">' + prod.title + '</div>' +
              (prod.rating
                ? '<div class="rv-card__stars">' + buildStars(prod.rating) + '</div>'
                : '') +
              '<div class="rv-card__prices">' +
                '<span class="rv-card__price">$' + prod.price.toFixed(2) + '</span>' +
                (prod.compare_price > prod.price
                  ? '<span class="rv-card__compare">$' + prod.compare_price.toFixed(2) + '</span>' +
                    '<span class="rv-card__discount">-' + discount + '%</span>'
                  : '') +
              '</div>' +
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
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('newsletter-email');
      const email = emailInput.value.trim();
      if (!email || !email.includes('@')) { showErrorPopup("Please enter a valid email"); return; }
      const submitBtn = newsletterForm.querySelector('button');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Saving..."; submitBtn.disabled = true;
      try {
        const res = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email }) });
        const data = await res.json();
        if (data.success) {
          const popup = document.getElementById('newsletter-popup');
          popup.classList.add('show');
          setTimeout(() => { popup.classList.remove('show'); }, 10000);
          document.getElementById('popup-close-btn').onclick = () => { popup.classList.remove('show'); };
          emailInput.value = '';
        } else { showErrorPopup("Error: " + (data.error || "Unknown")); }
      } catch (err) { showErrorPopup("Network error. Please try again."); }
      finally { submitBtn.textContent = originalText; submitBtn.disabled = false; }
    });
  }

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
  const cartItemsContainer = document.querySelector('.cart-items');
  const wishlistItemsContainer = document.querySelector('.wishlist-items');
  const cartBadge = document.querySelector('.cart-badge');
  const wishlistBadge = document.querySelector('.wishlist-badge');
  const cartIcon = document.querySelector('.cart-icon');

  function saveCart() { 
  localStorage.setItem('cart', JSON.stringify(cart));
  if (typeof window.__rcRefresh === 'function') window.__rcRefresh();
}
function saveWishlist() { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }

  function updateBadges() {
    const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartBadge) { cartBadge.textContent = cartQuantity; cartBadge.classList.toggle('active', cartQuantity > 0); }
    if (wishlistBadge) { wishlistBadge.textContent = wishlist.length; wishlistBadge.classList.toggle('active', wishlist.length > 0); }
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

      cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');
        cartItem.dataset.id = item.id;
        if (item.size  != null) cartItem.dataset.size  = item.size;
        if (item.color != null) cartItem.dataset.color = item.color;
       const freeTag = item.isFreePromo
        ? `<span class="free-badge">🎁 Free 0.00$</span>`
        : '';
        cartItem.innerHTML = `
          <img src="${item.image}" alt="${item.title}">
          <div class="item-meta">
            <h4>${item.title.replace('', '')} ${freeTag}</h4>
            <p>${item.isFreePromo ? '' : '$' + parseFloat(item.price).toFixed(2)}</p>
            ${item.size  ? `<p class="item-variant">Size: ${item.size}</p>`   : ''}
            ${item.color ? `<p class="item-variant">Color: ${item.color}</p>` : ''}
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
  }

  function handleQuantityChange(e) {
    const btn = e.target, itemElement = btn.closest('.cart-item');
    const id = itemElement.dataset.id;
    const size  = itemElement.dataset.size  !== undefined ? itemElement.dataset.size  : null;
    const color = itemElement.dataset.color !== undefined ? itemElement.dataset.color : null;
    const item = cart.find(i => i.id === id && i.size === size && i.color === color);
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
    const id = itemElement.dataset.id;
    const size  = itemElement.dataset.size  !== undefined ? itemElement.dataset.size  : null;
    const color = itemElement.dataset.color !== undefined ? itemElement.dataset.color : null;
    cart = cart.filter(i => !(i.id === id && i.size === size && i.color === color));
    saveCart(); updateCartQuantityInSheet(); updateSubtotal(); updateBadges(); renderCart();
  }

  function updateSubtotal() {
    const el = cartDrawer ? cartDrawer.querySelector('.cart-drawer__footer .subtotal') : document.querySelector('.subtotal');
    if (el) el.textContent = `Subtotal: $${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}`;
  }

  function addToCart(e) {
    e.stopPropagation();
    const container = e.target.closest('.product-card') || e.target.closest('.product-section');
    if (!container) return;
    const id = container.dataset.id || container.dataset.productId;
    const product = products.find(p => p.id === id);
    if (!product) return;
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
        showErrorPopup("Please select a color first."); return;
      }
      if (selectedColor) { const colorObj = product.colors.find(c => c.name === selectedColor); if (colorObj && colorObj.image) itemImage = upgradeShopifyImageUrl(colorObj.image); }
    } else {
      if (product.colors && product.colors.length > 0) {
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
    if (cartIcon) { cartIcon.classList.add('added'); setTimeout(() => cartIcon.classList.remove('added'), 500); }
    renderCart();
    openCartDrawer();
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
      if (product) {
        let cartItem = cart.find(i => i.id === id);
        if (cartItem) cartItem.quantity++;
        else cart.push({ id: product.id, title: product.title, price: product.price, image: product.image, quantity: 1 });
      }
    });
    saveCart(); updateCartQuantityInSheet(); updateBadges(); closeWishlistModal(); openCartDrawer();
  }

  async function updateCartQuantityInSheet() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    const qty = cart.reduce((sum, item) => sum + item.quantity, 0);
    await fetch('/.netlify/functions/save-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-cart-quantity', email: userEmail, currentCartQuantity: qty })
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

            if (countdown)   countdown.style.display   = 'none';
            if (progressBar) progressBar.style.display = 'none';
            if (promoMsg)    promoMsg.style.display     = 'none';
            if (banner)      banner.style.display       = 'none';
            if (promoCodes)  promoCodes.style.display   = 'none';
        }, 150); // après initCartDrawerExtras (100ms)
    } else {
        setTimeout(() => initCartDrawerExtras(), 100);
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
    if (!slides.length) return;
    let banner = body.querySelector('.cart-drawer__paul-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'cart-drawer__paul-banner';
      const itemsDiv = body.querySelector('.cart-items');
      if (itemsDiv) itemsDiv.insertAdjacentElement('beforebegin', banner);
      else body.insertAdjacentElement('afterbegin', banner);
    }
    if (!banner.dataset.built) {
      banner.dataset.built = '1';
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
        dot.addEventListener('click', () => { bannerGoTo(banner, parseInt(dot.dataset.slide)); restartBannerTimer(banner, duration); });
      });
    }
    if (_bannerTimer) clearInterval(_bannerTimer);
    _bannerTimer = setInterval(() => {
      const allSlides = banner.querySelectorAll('.paul-banner-slide');
      const active = Array.from(allSlides).findIndex(s => s.classList.contains('active'));
      bannerGoTo(banner, (active + 1) % allSlides.length);
    }, duration);
  }

  function bannerGoTo(banner, idx) {
    banner.querySelectorAll('.paul-banner-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    banner.querySelectorAll('.paul-banner-indicator').forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  function restartBannerTimer(banner, duration) {
    if (_bannerTimer) clearInterval(_bannerTimer);
    _bannerTimer = setInterval(() => {
      const allSlides = banner.querySelectorAll('.paul-banner-slide');
      const active = Array.from(allSlides).findIndex(s => s.classList.contains('active'));
      bannerGoTo(banner, (active + 1) % allSlides.length);
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
  function checkout() { localStorage.setItem('checkoutCart', JSON.stringify(cart)); window.location.href = '/checkout.html'; }

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

  updateBadges();
  updateWishlistIcons();
  document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', addToCart));
  document.querySelectorAll('.buy-now').forEach(btn => { btn.addEventListener('click', (e) => { addToCart(e); checkout(); }); });
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
//   WISHLIST SHARE SYSTEM
// ================================================================
(function initWishlistShare() {

    // ── Génère le lien de partage avec tous les IDs de la wishlist ──
    function buildShareUrl() {
        if (!wishlist || wishlist.length === 0) return null;
        const base = window.location.origin;
        const ids  = wishlist.join(',');
        return `${base}/collection.html?wishlist_share=${encodeURIComponent(ids)}`;
    }

    // ── Génère le message marketing pour chaque plateforme ──
    function buildShareMessage(platform) {
        if (!wishlist || !wishlist.length || !products || !products.length) return null;

        const shareUrl = buildShareUrl();
        const items = wishlist.map(id => {
            const p = products.find(pr => pr.id === id);
            if (!p) return null;
            const productUrl = typeof window.getProductUrl === 'function'
                ? window.location.origin + '/' + window.getProductUrl(id)
                : window.location.origin + '/shop.html';
            return { title: p.title, price: p.price, url: productUrl };
        }).filter(Boolean);

        if (!items.length) return null;

        const itemLines = items.map(i =>
            `✨ ${i.title} — $${i.price.toFixed(2)}\n🔗 ${i.url}`
        ).join('\n\n');

        const messages = {
            whatsapp: `👋 Hey! I've been shopping on *CurvaFit* and I can't stop adding things to my wishlist 😍\n\nHere are the products I'm absolutely OBSESSED with:\n\n${itemLines}\n\n💫 Click any link to view — they'll be saved in your wishlist automatically!\n\n🛍️ Shop all: ${shareUrl}`,
            twitter:  `I just found my new favourite fitness picks on @CurvaFit 🔥\n\nCheck out my wishlist — these items are 🤌\n\n${shareUrl}\n\n#CurvaFit #FitnessStyle #WishlistGoals`,
            facebook: `💕 Ladies, I found some AMAZING pieces on CurvaFit that I need you to see!\n\nI've added them to my wishlist — tap the link to discover them all (they'll be saved for you automatically!) 👇\n\n${shareUrl}`,
            pinterest:`✨ My CurvaFit Wishlist — save these gorgeous fitness picks before they're gone! 🛍️\n\n${shareUrl}`,
            copy:     shareUrl
        };

        return messages[platform] || shareUrl;
    }

    // ── Toast notification ──
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

    // ── Handler principal de partage ──
    function handleWishlistShare(platform) {
        if (!wishlist || wishlist.length === 0) {
            showShareToast('Your wishlist is empty!');
            return;
        }

        const shareUrl = buildShareUrl();
        const message  = buildShareMessage(platform);

        const urls = {
          whatsapp:  `https://wa.me/?text=${encodeURIComponent(message)}`,
         twitter: `https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Check out my CurvaFit wishlist! 🛍️')}`,
          facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`,
          pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent('My CurvaFit wishlist')}`,
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

    // ── Expose globalement pour les boutons HTML ──
    window.handleWishlistShare = handleWishlistShare;

    // ── Écoute les clics sur les boutons de partage ──
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
    const sharedIds = params.get('wishlist_share');
    if (!sharedIds) return;

    const ids = decodeURIComponent(sharedIds).split(',').filter(Boolean);
    if (!ids.length) return;

    // Attendre que products soit chargé
    function addSharedToWishlist() {
        ids.forEach(id => {
            const exists = products.find(p => p.id === id);
            if (!exists) return;
            if (!wishlist.includes(id)) {
                wishlist.push(id);
            }
        });
        saveWishlist();
        updateBadges();
        updateWishlistIcons();

        // Notification visuelle
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

            // Ouvrir la wishlist automatiquement
            setTimeout(() => {
                if (typeof openWishlistModal === 'function') openWishlistModal();
            }, 800);
        }, 1200);

        // Nettoyer l'URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }

    // Si products déjà chargé → immédiatement, sinon attendre
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
  if (window.location.pathname.toLowerCase().includes('shop.html') && localStorage.getItem('autoOpenCart') === 'true') {
    localStorage.removeItem('autoOpenCart');
    setTimeout(() => { if (typeof openCartDrawer === 'function') openCartDrawer(); }, 1200);
  }

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
      const mediaSlider = document.getElementById('main-image-slider');
      if (mediaSlider) setTimeout(() => { mediaSlider.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
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
  const pathname = window.location.pathname.toLowerCase();
  const isAccountPage = /account/i.test(pathname);

  window.showToast = (msg) => {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
  };

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
      const originalText = registerBtn.textContent;
      registerBtn.textContent = "Creating account..."; registerBtn.disabled = true;
      try {
        const res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastName, firstName, email, phone, password, newsletter }) });
        const data = await res.json();
        if (data.success) { registerBtn.textContent = "Your profil is ready..."; window.showToast("Account created successfully!"); setTimeout(() => goToLogin.click(), 800); }
        else { registerBtn.textContent = originalText; registerBtn.disabled = false; window.showToast("Error: " + (data.error || "Unknown")); }
      } catch (err) { registerBtn.textContent = originalText; registerBtn.disabled = false; window.showToast("Network error"); }
    });
  }

  // LOGIN
  const loginBtn = document.querySelector('.paul-btn-login');
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
          localStorage.setItem('userFirstName', data.user.firstName);
          localStorage.setItem('userLastName',  data.user.lastName);
          localStorage.setItem('userAddressLine1', data.user.addressLine1 || '');
          localStorage.setItem('userLine2',  data.user.line2  || '');
          localStorage.setItem('userCity',   data.user.city   || '');
          localStorage.setItem('userState',  data.user.state  || '');
          localStorage.setItem('userZip',    data.user.zip    || '');
          const addressStr = [data.user.addressLine1, data.user.line2, data.user.city, data.user.state, data.user.zip].filter(Boolean).join(', ');
          localStorage.setItem('userAddress', addressStr || 'No default address set');
          window.showToast(`Welcome ${data.user.firstName} !`);
          paulPopupOverlay.classList.remove('active');
          if (isAccountPage) location.reload(); else window.location.href = '/account.html';
        } else { loginBtn.textContent = originalText; loginBtn.disabled = false; window.showToast("Incorrect email or password"); }
      } catch (err) { loginBtn.textContent = originalText; loginBtn.disabled = false; window.showToast("Network error"); }
    });
  }

  // ACCOUNT PAGE
  if (isAccountPage) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      const hideStyle = document.createElement('style');
      hideStyle.innerHTML = `
        body > *:not(#paulPopup) { display: none !important; }
        #paulPopup { display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 999999 !important; }
      `;
      document.head.appendChild(hideStyle);
      setTimeout(() => {
        openPaulPopup();
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
    loadAccountStats();
  }

  window.openSavedItems = () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
      showToast("Please log in to view your saved items");
      return;
    }
    localStorage.setItem('autoOpenCart', 'true');
    window.location.href = 'shop.html';
  };

  async function loadAccountStats() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats', email })
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
      console.log(`✅ Stats loaded - Reviews Written = ${data.reviewsCount}`);

      const statValues = document.querySelectorAll('.membership-stats-grid .stat-value');
      if (statValues.length >= 3) {
        statValues[0].textContent = data.orders || 0;
        statValues[1].textContent = `$${(data.totalSpent || 0).toFixed(2)}`;
        statValues[3].textContent = data.reviewsCount || 0;
      }
      document.querySelector('[data-wishlist-count]').textContent = data.quantityInCart || 0;

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
          const prods = window.__allProducts || [];
          const idx = prods.findIndex(p => String(p.id) === String(productId));
          if (idx === -1) return null;
          const currentPath = window.location.pathname;
          const isInside = currentPath.includes('/products/') || /product\d+\.html$/.test(currentPath);
          return isInside ? `product${idx + 1}.html` : `products/product${idx + 1}.html`;
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
            const itemId = item.id || item.product_id || '';
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

            itemEl.addEventListener('click', function () {
              if (!itemId) return;
              const url = getUrlFromId(itemId);
              if (url) {
                window.location.href = url;
              } else {
                console.warn(`Product ID="${itemId}" not found in products.data.json`);
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
        body: JSON.stringify({ action: 'update-address', email, line1, line2, city, state, zip })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('userAddress', addressStr || 'No default address set');
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
    const email = document.getElementById('security-email').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    if (!email || !newPassword) return showToast("Email and new password are required");
    try {
      const res = await fetch('/.netlify/functions/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-password', email, newPassword })
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
        body: JSON.stringify({ action: 'update-profile-photo', email, photoBase64: base64 })
      });
      window.showToast && window.showToast('Profile photo updated!');
    } catch (e) {
      window.showToast && window.showToast('Could not save photo. Try again.');
    }
  });
})();

  window.logout = () => {
    localStorage.clear();
    window.location.href = 'index.html';
  };
});

window.addEventListener('load', () => {
  const pathname = window.location.pathname.toLowerCase();
  const isAccountPage = /account/i.test(pathname);
  if (isAccountPage && localStorage.getItem('isLoggedIn') !== 'true') {
    const hideStyle = document.createElement('style');
    hideStyle.innerHTML = `
      body > *:not(#paulPopup) { display: none !important; }
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
    const url = window.getProductUrl ? window.getProductUrl(id) : 'shop.html';
    console.log(`🖱️ Order History click → ID=${id} | URL=${url}`);
    if (!url || url === 'shop.html') {
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

    const fields    = storyForm.querySelectorAll('input, select, textarea');
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

    // ── Parsing firstName + age ──────────────────────────────────────
    const nameAgeRaw = fields[0].value.trim();
    const commaIdx   = nameAgeRaw.indexOf(',');
    const firstName  = commaIdx !== -1
      ? nameAgeRaw.slice(0, commaIdx).trim()
      : nameAgeRaw;
    const age        = commaIdx !== -1
      ? nameAgeRaw.slice(commaIdx + 1).trim()
      : '';

    const email        = fields[1].value.trim();
    const country      = fields[2].value.trim();
    const startWeight  = fields[3].value.trim();
    const program      = fields[4].value;
    const duration     = fields[5].value.trim();
    const result       = fields[6].value.trim();
    const waist        = fields[7].value.trim();
    const failedBefore = fields[8].value.trim();
    const story        = fields[9].value.trim();

    // ── Champ mental quote dédié ─────────────────────────────────────
    const mentalQuote  = document.getElementById('mental-quote-input')?.value.trim() || '';

    const rating       = document.getElementById('story-rating-value')?.value || '5';
    const anonymous    = document.getElementById('anonymous-checkbox')?.checked ? 'true' : 'false';

    const payload = {
      firstName,
      age,
      email,
      country,
      startWeight,
      program,
      duration,
      result,
      waist,
      failedBefore,
      story,
      mentalQuote,
      rating,
      photo: photoBase64,
      anonymous
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

const PROGRAM_TAG = {
  'Beginner — Soft Start':         { cls: 'dt-tag--beginner',     icon: '🌱' },
  'Intermediate — Deeper Refiner': { cls: 'dt-tag--intermediate', icon: '🔥' },
  'Maintenance — Forever Fit':     { cls: 'dt-tag--maintenance',  icon: '🌟' }
};

// ── Helper : ajoute une unité si absente ────────────────────────────
function addUnit(value, unit) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (v.toLowerCase().includes(unit.toLowerCase())) return v;
  return `${v} ${unit}`;
}

function buildStoryCard(s) {
  const tag     = PROGRAM_TAG[s.program] || { cls: 'dt-tag--beginner', icon: '🌱' };
  const country = s.country ? ` — ${s.country}` : '';
  const nameStr = s.age ? `${s.firstName}, ${s.age}${country}` : `${s.firstName}${country}`;

  const avatarHTML = s.photo
    ? `<img src="${s.photo}" alt="${s.firstName}" class="dt-header-img">`
    : `<div class="dt-avatar-placeholder"><i class="fi fi-rr-user"></i></div>`;

  const startWeightDisplay = addUnit(s.startWeight, 'kg');
  const resultDisplay      = addUnit(s.result, 'kg');

  const dur = String(s.duration || '').trim();
  const durationDisplay = dur
    ? (/^\d+$/.test(dur) ? `${dur} months` : dur)
    : '';

  const waistHTML = s.waist
    ? `<div class="dt-num dt-num--waist"><span>${addUnit(s.waist, 'cm')}</span><small>Waist</small></div>`
    : '';

  const failedHTML = s.failedBefore
    ? `<div class="dt-prev">
        <span class="dt-prev-label">Failed before:</span>
        ${s.failedBefore}
       </div>`
    : '';

  // ── Bloc vert avec icône cœur — champ dédié mentalQuote ─────────
  const mentalHTML = s.mentalQuote
    ? `<div class="dt-mental"><i class="fi fi-rr-heart"></i><span>"${s.mentalQuote}"</span></div>`
    : '';

  return `
    <div class="dt-card">
      <div class="dt-header">
        ${avatarHTML}
        <div>
          <h3>${nameStr}</h3>
          <span class="dt-tag ${tag.cls}">${tag.icon} ${s.program}</span>
        </div>
      </div>
      ${startWeightDisplay ? `
      <div class="dt-numbers">
        <div class="dt-num"><span>${startWeightDisplay}</span><small>Start</small></div>
        ${resultDisplay ? `
        <div class="dt-arrow">→</div>
        <div class="dt-num dt-num--result"><span>${resultDisplay}</span><small>${durationDisplay}</small></div>` : ''}
        ${waistHTML}
      </div>` : ''}
      ${failedHTML}
      <p class="dt-quote">"${s.story}"</p>
      ${mentalHTML}
      <div class="rating">
        ${[1,2,3,4,5].map(i =>
          `<i class="${i <= parseInt(s.rating || 5) ? 'fi fi-sr-star' : 'fi fi-rr-star'}"></i>`
        ).join('')}
      </div>
      ${s.date ? `<small class="dt-date">Shared on ${s.date}</small>` : ''}
    </div>`;
}

async function loadCommunityStories() {
  const grid = document.querySelector('#detailed-testimonials .dt-grid');
  if (!grid) return;

  try {
    const res  = await fetch('/.netlify/functions/story-share');
    const data = await res.json();

    if (!data.success || !data.stories.length) return;

    data.stories.forEach(s => {
      const temp = document.createElement('div');
      temp.innerHTML = buildStoryCard(s);
      grid.appendChild(temp.firstElementChild);
    });

  } catch (err) {
    console.warn('Community stories could not load:', err);
  }
}

loadCommunityStories();



function initStockBar(cjId) {
    const block = document.getElementById('pp-stock-block');
    const label = document.getElementById('pp-stock-label');
    const fill  = document.getElementById('pp-stock-bar-fill');
    const hint  = document.getElementById('pp-stock-hint');
    if (!block || !label || !fill || !hint) return;

    fetch(`/.netlify/functions/get-product-stock?cj_id=${cjId}`)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            block.classList.remove('loading');

            if (!data.success || data.totalStock === null) {
                block.classList.add('error');
                return;
            }

            const stock = data.totalStock;
            let level, pct, hintText;

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
        })
        .catch(function(err) {
            console.warn('[StockBar] Could not load stock:', err);
            block.classList.add('error');
        });
}


/* ================================================================
   CURVAFIT AI CHATBOT — FRONTEND JS
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

    if (!widget || !toggle || !window_ || !messages || !input || !sendBtn) return;

    /* ── State ── */
    let isOpen    = false;
    let isLoading = false;
    let notifShown = false;

    /* Persistance sessionStorage */
    let conversationHistory = [];
    try { conversationHistory = JSON.parse(sessionStorage.getItem('cf_history') || '[]'); } catch(e) {}

    /* ── Client-side language detection (mirrors server) ── */
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

    /* Welcome messages per language */
    const welcomeMessages = {
      fr: `Salut ! 👋 Je suis **Curva**, ta coach personnelle CurvaFit !\n\nJe suis là pour t'aider avec :\n- 🔥 Conseils minceur & perte de poids\n- 🥗 Nutrition et alimentation\n- 💪 Recommandations de produits\n- 📋 Programmes & plans de coaching\n\nComment puis-je t'aider aujourd'hui ? 😊`,
      es: `¡Hola! 👋 Soy **Curva**, tu coach personal de CurvaFit!\n\nEstoy aquí para ayudarte con:\n- 🔥 Consejos para perder peso\n- 🥗 Orientación nutricional\n- 💪 Recomendaciones de productos\n- 📋 Programas & planes de coaching\n\n¿En qué puedo ayudarte hoy? 😊`,
      en: `Hi! 👋 I'm **Curva**, your personal CurvaFit coach!\n\nI'm here to help you with:\n- 🔥 Weight loss tips & advice\n- 🥗 Nutrition guidance\n- 💪 Product recommendations\n- 📋 Programs & coaching plans\n\nWhat can I help you with today? 😊`
    };

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

      function startDrag(clientX, clientY) {
        isDragging = true;
        hasMoved   = false;
        startX     = clientX;
        startY     = clientY;
        const rect = toggle.getBoundingClientRect();
        origLeft   = rect.left;
        origBottom = window.innerHeight - rect.bottom;
        widget.classList.add('cf-dragging');
        applyPosition(origLeft, origBottom);
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

      // ── Mouse ──
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

      // ── Touch ──
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
      widget.classList.toggle('cf-right', left   > window.innerWidth  / 2);
      widget.classList.toggle('cf-top',   bottom > window.innerHeight / 2);
    }

    /* ── Open / Close ── */
    function openChat() {
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
      addMessage(welcomeMessages['en'], 'ai', [], null, []);
    }

    /* ══════════════════════════════════════
       IMPROVEMENT #2: Format Markdown + Promo Code Highlighting
    ══════════════════════════════════════ */
    function formatMarkdown(text) {
      const internalIds = [
        'Pdg-Francenel-product1','Pdg-Francenel-product2','Pdg-Francenel-product3',
        'Pdg-Francenel-product4','Pdg-Francenel-product5','Pdg-Francenel-product6',
        'Pdg-Francenel-product7','Pdg-Francenel-product8','Pdg-Francenel-product9',
        'Pdg-Francenel-product10','Pdg-Francenel-product11','Pdg-Francenel-product12',
        'Pdg-Francenel-product13','Pdg-Francenel-product14','Pdg-Francenel-product15',
        'Pdg-Francenel-product16'
      ];
      let out = text;
      internalIds.forEach(id => {
        out = out.replace(new RegExp('\\b' + id + '\\b', 'gi'), '');
      });

      /* ── IMPROVEMENT #2: Render [[CODE]] as a highlighted promo badge ── */
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

      out = out.replace(
        /(\/products\/product\d+\.html|\/contact\.html|\/shop\.html|\/programs\.html|\/checkout\.html|\/account\.html)/g,
        (url) => {
          const labels = {
            '/contact.html':  'Contact us',
            '/shop.html':     'Visit shop',
            '/programs.html': 'See programs',
            '/checkout.html': 'Checkout',
            '/account.html':  'My Account'
          };
          const label = labels[url] || 'View';
          return `<a href="${url}" class="cf-link-btn">${label} →</a>`;
        }
      );

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

    /* ── IMPROVEMENT #2: Copy promo code on click ── */
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
       pageButtons: array of { url, label, icon } — NEW param
    ══════════════════════════════════════ */
    function addMessage(text, role, products, contactInfo, pageButtons) {
      const msgEl  = document.createElement('div');
      msgEl.className = `cf-message cf-message--${role}`;

      const bubble = document.createElement('div');
      bubble.className = 'cf-msg-bubble';
      bubble.innerHTML = formatMarkdown(text);
      msgEl.appendChild(bubble);

      attachPromoCodeCopyEvents(bubble);

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
                <path d="M5 12H19M13 6L19 12L13 18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
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

      /* ── PAGE NAVIGATION BUTTONS — NEW ── */
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

    /* ── Send message ── */
    async function sendMessage(userText) {
      if (!userText || !userText.trim() || isLoading) return;
      const text = userText.trim();

      const userLang = detectUILanguage(text);

      const chipsEl = document.getElementById('cf-quick-chips');
      if (chipsEl) chipsEl.style.display = 'none';

      addMessage(text, 'user', [], null, []);
      conversationHistory.push({ role: 'user', content: text });
      try { sessionStorage.setItem('cf_history', JSON.stringify(conversationHistory.slice(-20))); } catch(e) {}

      input.value      = '';
      input.style.height = 'auto';
      sendBtn.disabled = true;
      isLoading        = true;

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
            history: conversationHistory.slice(-8)
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
        const pageButtons = data.pageButtons || []; /* ← NEW */

        addMessage(aiReply, 'ai', products, showContact ? contactInfo : null, pageButtons);
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
        sendBtn.disabled = input.value.trim().length === 0;
      }
    }

    window.__cfSendMessage = sendMessage;

    /* ── Input handlers ── */
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      sendBtn.disabled  = this.value.trim().length === 0;
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

    /* ── Keyboard & outside click ── */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) closeChat();
    });

    document.addEventListener('click', e => {
      if (isOpen && !widget.contains(e.target) && !toggle.contains(e.target)) closeChat();
    });

    console.log('✅ CurvaFit Chatbot ready — trilingual (EN/FR/ES)');
  })();
});



/* ══════════════════════════════════════════════════════
   CURVAFIT — COOKIE CONSENT POPUP
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
      <div id="cf-cookie-overlay"></div>
      <div id="cf-cookie-modal">

        <!-- ── Header ── -->
        <div class="cfck-header">
          <div class="cfck-header-left">
            <div class="cfck-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10"/>
                <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="8.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="11.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
                <path d="M17 2a5 5 0 0 0 5 5"/>
              </svg>
            </div>
            <div>
              <h2 class="cfck-title">We use cookies 🍪</h2>
              <p class="cfck-subtitle">Customize your privacy preferences</p>
            </div>
          </div>
          <button class="cfck-close-x" id="cfck-close-x" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- ── Body ── -->
        <div class="cfck-body">
          <p class="cfck-desc">
            CurvaFit uses cookies to improve your experience, analyze traffic, and — with your permission — personalize content. Your data is never sold. Read our
            <a href="/policies/privacy.html" class="cfck-link">Privacy Policy</a> for full details.
          </p>

          <!-- ── Panels (default view) ── -->
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

          </div><!-- /cfck-panels -->
        </div><!-- /cfck-body -->

        <!-- ── Footer buttons ── -->
        <div class="cfck-footer">
          <button class="cfck-btn cfck-btn--ghost" id="cfck-reject">Reject all</button>
          <button class="cfck-btn cfck-btn--outline" id="cfck-save">Save preferences</button>
          <button class="cfck-btn cfck-btn--primary" id="cfck-accept">Accept all</button>
        </div>

        <!-- ── Confirmation banner (shown after action) ── -->
        <div class="cfck-confirm" id="cfck-confirm" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="cfck-confirm-text">Preferences saved!</span>
        </div>

      </div><!-- /cf-cookie-modal -->
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

    /* Close X */
    document.getElementById('cfck-close-x').addEventListener('click', () => {
      saveConsent({ analytics: false, marketing: false });
      showConfirmAndClose('Preferences saved!');
    });

    /* Overlay click → reject */
    document.getElementById('cf-cookie-overlay').addEventListener('click', () => {
      saveConsent({ analytics: false, marketing: false });
      closePopup();
    });

    /* Reject all */
    document.getElementById('cfck-reject').addEventListener('click', () => {
      const analyticsEl = document.getElementById('cfck-analytics');
      const marketingEl = document.getElementById('cfck-marketing');
      if (analyticsEl) analyticsEl.checked = false;
      if (marketingEl) marketingEl.checked = false;
      saveConsent({ analytics: false, marketing: false });
      showConfirmAndClose('All optional cookies rejected.');
    });

    /* Save preferences */
    document.getElementById('cfck-save').addEventListener('click', () => {
      const analytics = document.getElementById('cfck-analytics')?.checked ?? true;
      const marketing = document.getElementById('cfck-marketing')?.checked ?? false;
      saveConsent({ analytics, marketing });
      showConfirmAndClose('Your preferences have been saved!');
    });

    /* Accept all */
    document.getElementById('cfck-accept').addEventListener('click', () => {
      const analyticsEl = document.getElementById('cfck-analytics');
      const marketingEl = document.getElementById('cfck-marketing');
      if (analyticsEl) analyticsEl.checked = true;
      if (marketingEl) marketingEl.checked = true;
      saveConsent({ analytics: true, marketing: true });
      showConfirmAndClose('All cookies accepted. Thank you! 🎉');
    });

    /* Escape key */
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
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

  /* ──────────────────────────────────────────────────────────
     ATTENDRE QUE products.data.json SOIT CHARGÉ
     (window.__allProducts est rempli par script.js)
  ────────────────────────────────────────────────────────── */
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
          cb([]); /* fallback sans données */
        }
      }, 100);
    }
  }

  /* ──────────────────────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };

  function setStyle(el, prop, val) {
    if (el) el.style[prop] = val;
  }

  /* Redéclenche l'animation CSS d'un élément */
  function reAnimate(els, delayMs) {
    delayMs = delayMs || 0;
    els.forEach(function (el) {
      if (!el) return;
      el.style.animation = 'none';
      el.style.opacity   = '0';
      el.style.transform = 'translateY(16px)';
      /* Force reflow */
      void el.offsetHeight;
      setTimeout(function () {
        el.style.animation = '';
        el.classList.remove('bbw-hero--anim-reset');
        el.classList.add('bbw-hero--anim-play');
        setTimeout(function () {
          el.classList.remove('bbw-hero--anim-play');
        }, 700);
      }, delayMs);
    });
  }

  /* ──────────────────────────────────────────────────────────
     INIT PRINCIPAL
  ────────────────────────────────────────────────────────── */
  waitForProducts(function (allProducts) {

    /* Récupère le settings */
    var settings = (allProducts.find(function (p) { return p.type === 'settings'; }) || {});
    var cfg = settings.hero_banner || {};

    /* ── Éléments DOM ────────────────────────────────────── */
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

    if (!mediaEl) return; /* Section absente de la page */

    /* ── Paramètres issus du settings ───────────────────── */
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

    /* Couleurs CSS custom depuis settings */
    var root = document.documentElement;
    if (cfg.button_color)      root.style.setProperty('--hero-btn-bg',    cfg.button_color);
    if (cfg.button_text_color) root.style.setProperty('--hero-btn-color',  cfg.button_text_color);
    if (cfg.text_color)        root.style.setProperty('--hero-text-color', cfg.text_color);

    /* ── Nombre de slides effectifs ─────────────────────── */
    var slideCount = videoUrl ? 1 : Math.min(images.length, slides.length, 3);
    var currentIdx = 0;
    var autoTimer  = null;

    /* ════════════════════════════════════════════════════════
       1. INJECTION MÉDIAS
    ════════════════════════════════════════════════════════ */
    if (videoUrl) {
      /* Mode vidéo → une seule vidéo, thumbs cachées, dots cachés */
      var vid = document.createElement('video');
      vid.autoplay  = true;
      vid.muted     = true;
      vid.loop      = true;
      vid.playsInline = true;
      vid.setAttribute('playsinline', '');
      var src = document.createElement('source');
      src.src  = videoUrl;
      src.type = 'video/mp4';
      vid.appendChild(src);
      mediaEl.appendChild(vid);

      /* Cacher thumbs et dots */
      if (thumbsEl) thumbsEl.style.display = 'none';
      if (dotsEl)   dotsEl.style.display   = 'none';
      slideCount = 1;

    } else {
      /* Mode images */
      images.forEach(function (src, i) {
        var img = document.createElement('img');
        img.src     = src;
        img.alt     = (slides[i] && slides[i].title) ? slides[i].title : 'BBW4LIFE banner ' + (i + 1);
        img.loading = i === 0 ? 'eager' : 'lazy';
        if (i === 0) img.classList.add('bbw-hero--active');
        mediaEl.appendChild(img);
      });
    }

    /* ════════════════════════════════════════════════════════
       2. THUMBNAILS
    ════════════════════════════════════════════════════════ */
    if (showThumbs && thumbsEl && !videoUrl && images.length > 1) {
      /* Classes de positionnement desktop / mobile */
      thumbsEl.classList.add('bbw-thumbs--' + thumbPosDesktop);
      thumbsEl.classList.add('bbw-thumbs--mobile-' + thumbPosMobile);

      images.forEach(function (src, i) {
        var thumb = document.createElement('div');
        thumb.className = 'bbw-hero__thumb' + (i === 0 ? ' bbw-hero--active' : '');
        thumb.dataset.index = i;

        var img = document.createElement('img');
        img.src     = src;
        img.alt     = 'Thumbnail ' + (i + 1);
        img.loading = 'lazy';
        thumb.appendChild(img);

        thumb.addEventListener('click', function () {
          goToSlide(parseInt(this.dataset.index));
          resetAutoPlay();
        });

        thumbsEl.appendChild(thumb);
      });
    } else if (thumbsEl) {
      /* Pas de thumbs → cacher le conteneur */
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
       4. CONTENU TEXTUEL — initialise le premier slide
    ════════════════════════════════════════════════════════ */
    function updateContent(idx) {
      var slide = slides[idx] || {};
      if (titleEl)    titleEl.textContent    = slide.title    || '';
      if (subtitleEl) subtitleEl.textContent = slide.subtitle || '';
      if (textEl)     textEl.textContent     = slide.text     || '';

      /* Ré-anime les éléments */
      reAnimate([titleEl, subtitleEl, textEl, cdWrap, btnWrap], 0);
    }

    updateContent(0);

    /* ════════════════════════════════════════════════════════
       5. COMPTE À REBOURS
    ════════════════════════════════════════════════════════ */
    if (showCountdown && cdWrap && countdownEnd) {
      cdWrap.style.display = 'flex';

      /* Labels depuis settings */
      var lblDays    = cfg.countdown_label_days    || 'JOURS';
      var lblHours   = cfg.countdown_label_hours   || 'HEURES';
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

      function pad(n) { return String(n).padStart(2, '0'); }

      function tickCountdown() {
        var now  = Date.now();
        var diff = Math.max(0, Math.floor((endTime - now) / 1000));
        var dd   = Math.floor(diff / 86400);
        var hh   = Math.floor((diff % 86400) / 3600);
        var mm   = Math.floor((diff % 3600) / 60);
        var ss   = diff % 60;

        if (cdDays)  cdDays.textContent  = pad(dd);
        if (cdHours) cdHours.textContent = pad(hh);
        if (cdMins)  cdMins.textContent  = pad(mm);
        if (cdSecs)  cdSecs.textContent  = pad(ss);
      }

      tickCountdown();
      setInterval(tickCountdown, 1000);
    }

    /* ════════════════════════════════════════════════════════
       6. BOUTONS
    ════════════════════════════════════════════════════════ */
    if (showIndivBtns) {
      /* Mode : 1 bouton par slide */
      [
        { el: btnSlide1, cfg: btn1Cfg, idx: 0 },
        { el: btnSlide2, cfg: btn2Cfg, idx: 1 },
        { el: btnSlide3, cfg: btn3Cfg, idx: 2 }
      ].forEach(function (item) {
        if (!item.el) return;
        item.el.textContent = item.cfg.text || 'Shop Now';
        item.el.href        = item.cfg.url  || '#';
        /* Afficher uniquement le bouton du slide courant */
        item.el.style.display = (item.idx === 0) ? 'inline-block' : 'none';
      });
      if (btnMain) btnMain.style.display = 'none';

    } else {
      /* Mode : bouton principal unique → ajoute les produits du pack */
      if (btnMain) {
        btnMain.textContent = mainBtnCfg.text || 'Ajouter le pack au panier';
        btnMain.style.display = 'inline-block';
        btnMain.addEventListener('click', handlePackClick);
      }
      [btnSlide1, btnSlide2, btnSlide3].forEach(function (b) {
        if (b) b.style.display = 'none';
      });
    }

    /* ──────────────────────────────────────────────────────
       Handler : bouton principal → ajoute les variants au
       cart (via window.__allProducts + cart de script.js)
       puis redirige vers /checkout.html
    ────────────────────────────────────────────────────── */
    function handlePackClick() {
      var productIds = mainBtnCfg.product_ids || [];
      if (!productIds.length) { window.location.href = '/checkout.html'; return; }

      /* Récupère cart depuis script.js (exposé via window.__getCart) */
      var cart = (typeof window.__getCart === 'function') ? window.__getCart() : [];

      productIds.forEach(function (pid) {
        var prod = allProducts.find(function (p) { return p.id === pid; });
        if (!prod) return;

        /* Premier variant disponible */
        var variant = (prod.variants && prod.variants.length) ? prod.variants[0] : null;
        var price   = variant ? parseFloat(variant.price) : parseFloat(prod.price);
        var color   = variant ? (variant.color || null) : null;
        var size    = variant ? (variant.size  || null) : null;

        var colorObj = (color && prod.colors)
          ? prod.colors.find(function (c) { return c.name === color; })
          : null;
        var image = colorObj ? (colorObj.image || prod.image) : prod.image;

        /* Vérifie si déjà dans le cart */
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

      /* Sauvegarde et synchronise */
      if (typeof window.__setCart === 'function') window.__setCart(cart);
      localStorage.setItem('cart', JSON.stringify(cart));
      localStorage.setItem('checkoutCart', JSON.stringify(cart));

      if (typeof window.updateBadges === 'function')             window.updateBadges();
      if (typeof window.updateCartQuantityInSheet === 'function') window.updateCartQuantityInSheet();

      /* Feedback visuel */
      if (btnMain) {
        btnMain.classList.add('bbw-hero__btn--added');
        btnMain.textContent = '✓ Ajouté au panier…';
        setTimeout(function () { window.location.href = '/checkout.html'; }, 800);
      } else {
        window.location.href = '/checkout.html';
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

      /* ── Images ── */
      var imgs = mediaEl.querySelectorAll('img');
      imgs.forEach(function (img, i) {
        img.classList.toggle('bbw-hero--active', i === idx);
      });

      /* ── Thumbnails ── */
      if (thumbsEl) {
        var thumbItems = thumbsEl.querySelectorAll('.bbw-hero__thumb');
        thumbItems.forEach(function (t, i) {
          t.classList.toggle('bbw-hero--active', i === idx);
        });
      }

      /* ── Dots ── */
      if (dotsEl) {
        var dotItems = dotsEl.querySelectorAll('.bbw-hero__dot');
        dotItems.forEach(function (d, i) {
          d.classList.toggle('bbw-hero--active', i === idx);
        });
      }

      /* ── Contenu texte ── */
      updateContent(idx);

      /* ── Boutons individuels ── */
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




// ── Announcement Bar ──
(function() {
  const slides = document.querySelectorAll('.ann-bar__slide');
  const dots   = document.querySelectorAll('.ann-bar__dot');
  let current  = 0;
  let timer;

  function goTo(next, dir) {
    if (next === current) return;
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (next + slides.length) % slides.length;
    slides[current].style.transform = dir > 0 ? 'translateY(100%)' : 'translateY(-100%)';
    slides[current].style.opacity = '0';
    slides[current].classList.add('active');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slides[current].style.transform = '';
      slides[current].style.opacity = '';
    }));
    dots[current].classList.add('active');
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo((current + 1) % slides.length, 1), 5000);
  }

  const btnNext = document.getElementById('annNext');
  const btnPrev = document.getElementById('annPrev');
  if (btnNext) btnNext.addEventListener('click', () => { goTo((current+1)%slides.length, 1); startTimer(); });
  if (btnPrev) btnPrev.addEventListener('click', () => { goTo((current-1+slides.length)%slides.length, -1); startTimer(); });

  startTimer();
})();

