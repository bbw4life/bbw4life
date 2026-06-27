(function initCartPage() {
  'use strict';

  
  if (!document.getElementById('cart-page-main')) return;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function waitReady(fn) {
    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      if (typeof window.__getCart === 'function' && window.__allProducts && window.__allProducts.length > 0) {
        clearInterval(poll);
        fn();
      } else if (tries > 120) {
        clearInterval(poll);
        fn();
      }
    }, 100);
  }

  /* ════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════ */
  function getCart() {
    if (typeof window.__getCart === 'function') return window.__getCart();
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { return []; }
  }

  function setCart(c) {
    if (typeof window.__setCart === 'function') window.__setCart(c);
    localStorage.setItem('cart', JSON.stringify(c));
  }

  function saveCartAndSync() {
    if (typeof window.saveCart === 'function') window.saveCart();
    else localStorage.setItem('cart', JSON.stringify(getCart()));
    if (typeof window.updateCartQuantityInSheet === 'function') window.updateCartQuantityInSheet();
    if (typeof window.updateBadges === 'function') window.updateBadges();
  }

  function showToast(msg) {
    const toast = document.getElementById('cp-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 3500);
  }

  function normalizeVal(v) {
    if (v === undefined || v === '' || v === 'null' || v === 'undefined') return null;
    return v;
  }

  function getProductUrl(id) {
    if (typeof window.getProductUrl === 'function') return window.getProductUrl(id);
    const prods = window.__allProducts || [];
    const idx = prods.findIndex(function (p) { return String(p.id) === String(id); });
    if (idx === -1) return '/collections/bbw4life-all-product.html';
    return '/products/product' + (idx + 1) + '.html';
  }

  function upgradeImg(url, size) {
    if (typeof upgradeShopifyImageUrl === 'function') return upgradeShopifyImageUrl(url, size || 200);
    return url;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ════════════════════════════════════════════════════
     CART SHARE — SLUG MAP (partagé entre share + receiver)
  ════════════════════════════════════════════════════ */
  const CART_SLUG_MAP = {
    'Pdg-Francenel-product1':  'glam-heels',
    'Pdg-Francenel-product2':  'retrorun-sneakers',
    'Pdg-Francenel-product3':  'bohoflip-sandals',
    'Pdg-Francenel-product4':  'powerheels',
    'Pdg-Francenel-product5':  'winterboost-boots',
    'Pdg-Francenel-product6':  'colorstilettos',
    'Pdg-Francenel-product7':  'nightchic-dress',
    'Pdg-Francenel-product8':  'slitlux-dress',
    'Pdg-Francenel-product9':  'plaidoverall-dress',
    'Pdg-Francenel-product10': 'floralflounce-dress',
    'Pdg-Francenel-product11': 'vintagesquare-dress',
    'Pdg-Francenel-product12': 'paisleybelt-dress',
    'Pdg-Francenel-product13': 'meshduo-set',
    'Pdg-Francenel-product14': 'meshglam-dress',
    'Pdg-Francenel-product15': 'linenbreeze-dress',
    'Pdg-Francenel-product16': 'stripedmini-dress',
    'Pdg-Francenel-product17': 'loungerobe',
    'Pdg-Francenel-product18': 'lacenight-dress',
    'Pdg-Francenel-product19': 'lacethong-set',
    'Pdg-Francenel-product20': 'solidsexy-bikini',
    'Pdg-Francenel-product21': 'curvebikini',
    'Pdg-Francenel-product22': 'leopardnight-set',
    'Pdg-Francenel-product23': 'supportbra',
    'Pdg-Francenel-product24': 'laceromper',
    'Pdg-Francenel-product25': 'stripedbikini',
    'Pdg-Francenel-product26': 'tubebikinii',
    'Pdg-Francenel-product27': 'ruffleone-bikini',
    'Pdg-Francenel-product28': 'bandagebikini',
    'Pdg-Francenel-product29': 'contrastone-piece',
    'Pdg-Francenel-product30': 'premiumbikini',
    'Pdg-Francenel-product31': 'irregulartop',
    'Pdg-Francenel-product32': 'christmassweat',
    'Pdg-Francenel-product33': 'dalmationshorts',
    'Pdg-Francenel-product34': 'leopardshirt',
    'Pdg-Francenel-product35': 'drawstringpants',
    'Pdg-Francenel-product36': 'cropslimpants',
    'Pdg-Francenel-product37': 'haremprints',
    'Pdg-Francenel-product38': 'loosejeans',
    'Pdg-Francenel-product39': 'britishloafers',
    'Pdg-Francenel-product40': 'airmesh-runners',
    'Pdg-Francenel-product41': 'leathercasuals',
    'Pdg-Francenel-product42': 'businessdress-shoes',
    'Pdg-Francenel-product43': 'hollowsneakers',
    'Pdg-Francenel-product44': 'tendtrainers',
    'Pdg-Francenel-product45': 'patentloafers',
    'Pdg-Francenel-product46': 'collarshirt',
    'Pdg-Francenel-product47': 'geopolo-shirt',
    'Pdg-Francenel-product48': 'stripedcollar-sweater',
    'Pdg-Francenel-product49': 'turtlenecklux',
    'Pdg-Francenel-product50': 'hikejacket',
    'Pdg-Francenel-product51': 'roundneck-sweatshirt',
    'Pdg-Francenel-product52': 'nailbond-glue',
    'Pdg-Francenel-product53': 'bownails',
    'Pdg-Francenel-product54': 'nailrepair-lotion',
    'Pdg-Francenel-product55': 'browdye-pencil',
    'Pdg-Francenel-product56': 'curl-volume-mascara',
    'Pdg-Francenel-product57': 'browkit-pro',
    'Pdg-Francenel-product58': 'obsidian-lip-balm',
    'Pdg-Francenel-product59': 'tearoff-lip-gloss',
    'Pdg-Francenel-product60': 'gingerclean-pads',
    'Pdg-Francenel-product61': 'deeprepair-hair-mask',
    'Pdg-Francenel-product62': 'batanaglow-oil',
    'Pdg-Francenel-product63': 'batanaboost-oil',
    'Pdg-Francenel-product64': 'poreclean-gel',
    'Pdg-Francenel-product65': 'knucklewhite-serum',
    'Pdg-Francenel-product66': 'propolis-glow-essence',
    'Pdg-Francenel-product67': 'menglow-cream',
    'Pdg-Francenel-product68': 'iceglow-grid-set',
    'Pdg-Francenel-product69': 'glamsatin-dress',
    'Pdg-Francenel-product70': 'powersuit',
    'Pdg-Francenel-product71': 'bohofloral-maxi',
    'Pdg-Francenel-product72': 'cozylounge-set',
    'Pdg-Francenel-product73': 'blushlace-gown',
    'Pdg-Francenel-product74': 'tealempire-gown',
    'Pdg-Francenel-product75': 'jacquardpower-suit',
  };

  /* ════════════════════════════════════════════════════
     RENDER ITEMS
  ════════════════════════════════════════════════════ */
  function renderPageCart() {
    const cart = getCart();
    const container = document.getElementById('cp-cart-items-container');
    const layout    = document.getElementById('cp-layout');
    const emptyEl   = document.getElementById('cp-empty');

    if (!container) return;

    
    const skeleton = document.getElementById('cp-skeleton-1');
    if (skeleton) skeleton.remove();

    container.innerHTML = '';

    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const plansOn  = (settings.plans_available || 'no').toLowerCase().trim() === 'yes';

    const BBW_FEATURED_IDS = [
      'Pdg-Francenel-product69','Pdg-Francenel-product70','Pdg-Francenel-product71',
      'Pdg-Francenel-product72','Pdg-Francenel-product73','Pdg-Francenel-product74',
      'Pdg-Francenel-product75'
    ];

    if (cart.length === 0) {
      if (layout)  layout.style.display  = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      hideDynamicSections();
      // Masquer le banner du drawer
      var drawerBanner = document.querySelector('.cart-drawer .cart-drawer__paul-banner');
      if (drawerBanner) drawerBanner.style.display = 'none';
      updateSummary();
      updateHeader();
      return;
    }

    if (layout)  layout.style.display  = '';
    if (emptyEl) emptyEl.style.display = 'none';
    showDynamicSections();

    
    const cpUpsellEl    = document.getElementById('cp-upsell-section');
    const upsellCfgCheck = settings.cart_page_upsell || {};
    const hasUpsellConfig = Array.isArray(upsellCfgCheck.items) && upsellCfgCheck.items.length > 0;
    if (cpUpsellEl) cpUpsellEl.style.display = hasUpsellConfig ? '' : 'none';

    cart.forEach(function (item) {
      const cartItem = document.createElement('div');
      cartItem.className   = 'cp-cart-item';
      cartItem.dataset.id  = item.id;
      if (item.size  != null) cartItem.dataset.size  = item.size;
      if (item.color != null) cartItem.dataset.color = item.color;

      const isFeaturedWarning = BBW_FEATURED_IDS.includes(item.id) && !plansOn;
      const lineTotal = (parseFloat(item.price) * item.quantity).toFixed(2);

      const freeTag = item.isFreePromo
        ? '<span class="free-badge"><i class="fas fa-gift"></i> Free $0.00</span>'
        : '';

      const warningDot = isFeaturedWarning
        ? '<div class="cart-item-warning-dot"><span class="cart-item-warning-tooltip"><i class="fas fa-exclamation-triangle"></i> Product not yet validated. Please submit a request.</span></div>'
        : '';

      const requestBtn = isFeaturedWarning
        ? '<button class="cart-item-request-btn" data-product-id="' + item.id + '"><i class="fi fi-rr-shopping-bag"></i> Request this product</button>'
        : '';

      cartItem.innerHTML = [
        '<div class="cp-item-img-wrap">',
        '  <img src="' + item.image + '" alt="' + item.title + '" loading="lazy">',
        '  ' + warningDot,
        '</div>',
        '<div class="cp-item-meta">',
        '  <h4>' + item.title + ' ' + freeTag + '</h4>',
        item.size  ? '<p class="item-variant"><i class="fi fi-rr-layers"></i> Size: '  + item.size  + '</p>' : '',
        item.color ? '<p class="item-variant"><i class="fi fi-rr-palette"></i> Color: ' + item.color + '</p>' : '',
        requestBtn,
        '  <div class="cp-qty-row">',
        '    <div class="cp-qty-ctrl">',
        '      <button class="cp-qty-minus">&#8722;</button>',
        '      <span>' + item.quantity + '</span>',
        '      <button class="cp-qty-plus">+</button>',
        '    </div>',
        '    <button class="cp-remove-item"><i class="fi fi-sr-trash"></i></button>',
        '  </div>',
        '</div>',
        '<div class="cp-item-price-col">$' + parseFloat(item.price).toFixed(2) + '</div>',
        '<div class="cp-item-line-total">$' + lineTotal + '</div>'
      ].join('');

      
      const img   = cartItem.querySelector('img');
      const title = cartItem.querySelector('h4');
      const url   = getProductUrl(item.id);
      if (img)   { img.style.cursor = 'pointer';   img.addEventListener('click', function () { window.location.href = url; }); }
      if (title) { title.style.cursor = 'pointer'; title.addEventListener('click', function () { window.location.href = url; }); }

      
      const rBtn = cartItem.querySelector('.cart-item-request-btn');
      if (rBtn) {
        rBtn.addEventListener('click', function () {
          const pid = rBtn.dataset.productId;
          if (typeof window.openProductRequestPopup === 'function') window.openProductRequestPopup(pid);
          else if (typeof window.openPlanPopup === 'function') window.openPlanPopup(pid);
        });
      }

      container.appendChild(cartItem);
    });

    
    container.querySelectorAll('.cp-qty-plus, .cp-qty-minus').forEach(function (btn) {
      btn.addEventListener('click', handleQty);
    });
    container.querySelectorAll('.cp-remove-item').forEach(function (btn) {
      btn.addEventListener('click', handleRemove);
    });

   updateSummary();
    updateHeader();
    updateProgressBar();
    updatePromoMessage();

    if (typeof window.convertPricesForCountry === 'function') {
      var _activeCountry = localStorage.getItem('bbw_country');
      if (_activeCountry) window.convertPricesForCountry(_activeCountry);
    }
  }

  
  function handleQty(e) {
    const btn  = e.target.closest('.cp-qty-plus, .cp-qty-minus');
    const item = btn ? btn.closest('.cp-cart-item') : null;
    if (!item) return;

    const id    = item.dataset.id;
    const size  = normalizeVal(item.dataset.size);
    const color = normalizeVal(item.dataset.color);
    let cart = getCart();
    const entry = cart.find(function (i) {
      return i.id === id && normalizeVal(i.size) === size && normalizeVal(i.color) === color;
    });
    if (!entry) return;

    if (btn.classList.contains('cp-qty-plus')) {
      entry.quantity++;
    } else if (btn.classList.contains('cp-qty-minus')) {
      entry.quantity--;
      if (entry.quantity <= 0) {
        cart = cart.filter(function (i) {
          return !(i.id === id && normalizeVal(i.size) === size && normalizeVal(i.color) === color);
        });
      }
    }

    setCart(cart);
    saveCartAndSync();
    renderPageCart();
  }

  
  function handleRemove(e) {
    const item  = e.target.closest('.cp-cart-item');
    if (!item) return;
    const id    = item.dataset.id;
    const size  = normalizeVal(item.dataset.size);
    const color = normalizeVal(item.dataset.color);
    let cart = getCart();
    cart = cart.filter(function (i) {
      return !(i.id === id && normalizeVal(i.size) === size && normalizeVal(i.color) === color);
    });
    setCart(cart);
    saveCartAndSync();
    renderPageCart();
  }

  /* ════════════════════════════════════════════════════
     ORDER SUMMARY
  ════════════════════════════════════════════════════ */
  function updateSummary() {
    const cart     = getCart();
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const threshold = parseFloat(cd.free_shipping_threshold) || 350;

    const subtotal = cart.reduce(function (sum, i) {
      return sum + parseFloat(i.price) * i.quantity;
    }, 0);
    const totalQty = cart.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    const savings  = cart.reduce(function (sum, i) {
      if (i.compare_price && parseFloat(i.compare_price) > parseFloat(i.price)) {
        return sum + (parseFloat(i.compare_price) - parseFloat(i.price)) * i.quantity;
      }
      return sum;
    }, 0);
    const points = Math.floor(subtotal);
    const shippingFree = subtotal >= threshold;

    const shippingEl = document.getElementById('cp-shipping-val');
    if (shippingEl) {
      shippingEl.textContent = shippingFree ? 'FREE' : 'Calculated at checkout';
      shippingEl.className   = shippingFree ? 'cp-free-tag' : '';
    }

    setText('cp-subtotal-val', '$' + subtotal.toFixed(2));
    setText('cp-tax-val',      '$0.00');
    setText('cp-total-val',    '$' + subtotal.toFixed(2));
    setText('cp-qty-label',    totalQty + (totalQty === 1 ? ' item' : ' items'));
    setText('cp-loyalty-points', points.toLocaleString());

    const savingsLine = document.getElementById('cp-savings-line');
    const savingsVal  = document.getElementById('cp-savings-val');
    if (savingsLine) {
      savingsLine.style.display = savings > 0 ? '' : 'none';
      if (savingsVal && savings > 0) savingsVal.textContent = '-$' + savings.toFixed(2);
    }

    setText('cp-sticky-qty',   totalQty + (totalQty === 1 ? ' item' : ' items'));
    setText('cp-sticky-total', '$' + subtotal.toFixed(2));
  }

  function updateHeader() {
    const cart = getCart();
    const qty  = cart.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    setText('cp-item-count', qty + (qty === 1 ? ' item' : ' items'));
  }

  /* ════════════════════════════════════════════════════
     PROGRESS BAR
  ════════════════════════════════════════════════════ */
  function updateProgressBar() {
    const products  = window.__allProducts || [];
    const settings  = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd        = settings.cart_drawer || {};
    const threshold = parseFloat(cd.free_shipping_threshold) || 350;
    const showBar   = (cd.show_free_shipping_bar || 'Yes').toLowerCase() === 'yes';
    const bar       = document.getElementById('cp-progress-container');
    if (!bar) return;

    const cart = getCart();
    if (!showBar || cart.length === 0) { bar.style.display = 'none'; return; }

    const subtotal  = cart.reduce(function (sum, i) { return sum + parseFloat(i.price) * i.quantity; }, 0);
    const remaining = Math.max(0, threshold - subtotal);
    const pct       = Math.min(100, (subtotal / threshold) * 100);

    const msgEl   = document.getElementById('cp-progress-message');
    const fillEl  = document.getElementById('cp-progress-fill');
    const truckEl = document.getElementById('cp-progress-truck');

    if (subtotal >= threshold) {
      if (msgEl)  { msgEl.textContent = cd.progress_success_message || 'You have free shipping!'; msgEl.style.color = '#22a06b'; }
      if (fillEl) fillEl.style.width = '100%';
    } else {
      const rawMsg = cd.progress_message || 'Add ${remaining} more for FREE shipping!';
      const msg = rawMsg.replace('${remaining}', '$' + remaining.toFixed(2));
      if (msgEl)  { msgEl.textContent = msg; msgEl.style.color = ''; }
      if (fillEl) fillEl.style.width = pct + '%';
    }

    if (truckEl && fillEl) {
      const trackEl = fillEl.parentElement;
      if (trackEl) {
        const trackW = trackEl.offsetWidth;
        const truckW = truckEl.offsetWidth || 26;
        const pos    = Math.max(0, Math.min((pct / 100) * trackW - truckW / 2, trackW - truckW));
        truckEl.style.left  = pos + 'px';
        truckEl.style.right = 'auto';
      }
    }

    bar.style.display = '';
  }

  /* ════════════════════════════════════════════════════
     PROMO MESSAGE
  ════════════════════════════════════════════════════ */
  function updatePromoMessage() {
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const showPromo = (cd.show_promo_message || 'Yes').toLowerCase() === 'yes';
    const wrap      = document.getElementById('cp-promo-message-wrap');
    const span      = document.getElementById('cp-promo-text-span');
    if (!wrap || !span) return;

    const cart = getCart();
    if (!showPromo || cart.length === 0) { wrap.style.display = 'none'; return; }

    const buyQty = parseInt(cd.promo_buy_quantity) || 3;
    const getQty = parseInt(cd.promo_get_quantity) || 1;
    const count  = cart.reduce(function (s, i) { return s + i.quantity; }, 0);

    let msg = '', cls = '';
    if (count >= buyQty) {
      msg = (cd.promo_complete_message || 'You get {get} FREE item(s)!').replace('{get}', '<strong class="promo-number">' + getQty + '</strong>');
      cls = 'complete';
    } else if (count > 0) {
      const rem = buyQty - count;
      msg = (cd.promo_progress_message || 'Add {remaining} more, get {get} FREE!')
        .replace('{remaining}', '<strong class="promo-number">' + rem + '</strong>')
        .replace('{get}', '<strong class="promo-number">' + getQty + '</strong>');
      cls = 'progress';
    } else {
      msg = (cd.promo_initial_message || 'Buy {buy} items, get {get} FREE!')
        .replace('{buy}', '<strong class="promo-number">' + buyQty + '</strong>')
        .replace('{get}', '<strong class="promo-number">' + getQty + '</strong>');
      cls = 'initial';
    }

    span.innerHTML  = msg;
    span.className  = 'promo-text ' + cls;
    wrap.style.display = '';
  }

  /* ════════════════════════════════════════════════════
     COUNTDOWN
  ════════════════════════════════════════════════════ */
  function initCountdown() {
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const el       = document.getElementById('cp-countdown');
    if (!el) return;

    const textEl = document.getElementById('cp-countdown-text');
    const timeEl = document.getElementById('cp-countdown-time');
    if (textEl) textEl.textContent = cd.countdown_text || 'Offer expires in:';

    const totalSeconds = (parseInt(cd.countdown_minutes) || 10) * 60;
    const suffix       = cd.countdown_suffix || '';
    const STORAGE_KEY  = 'drawerCountdownEnd';

    const cart = getCart();
    if (cart.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'flex';

    const savedEnd = localStorage.getItem(STORAGE_KEY);
    const now      = Date.now();
    let endTime;
    if (savedEnd && parseInt(savedEnd) > now) {
      endTime = parseInt(savedEnd);
    } else {
      endTime = now + totalSeconds * 1000;
      localStorage.setItem(STORAGE_KEY, endTime);
    }

    setInterval(function () {
      const rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      if (rem === 0) {
        endTime = Date.now() + totalSeconds * 1000;
        localStorage.setItem(STORAGE_KEY, endTime);
      }
      if (timeEl) {
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s + (suffix ? ' ' + suffix : '');
      }
    }, 1000);
  }

  /* ════════════════════════════════════════════════════
     PAUL BANNER
  ════════════════════════════════════════════════════ */
  function initPageBanner() {
    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const cd       = settings.cart_drawer || {};
    const slides   = cd.banner_slides || [];
    const duration = cd.banner_slide_duration_ms || 5000;
    const videoUrl = cd.banner_video_url || '';
    const banner   = document.getElementById('cp-paul-banner');
    if (!banner) return;

    if (!videoUrl && !slides.length) return;

    // ── MODE VIDÉO ──
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
        playPromise.catch(function () {
          document.addEventListener('click', function tryPlay() {
            video.play().catch(function () {});
            document.removeEventListener('click', tryPlay);
          }, { once: true });
        });
      }

      // ── Textes rotatifs + dots par-dessus ──
      if (slides.length) {
        const textsHTML = slides.map(function (s, i) {
          return '<div class="paul-banner-video-text' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' + s.text + '</div>';
        }).join('');

        const dotsHTML = slides.map(function (s, i) {
          return '<span class="paul-banner-indicator' + (i === 0 ? ' active' : '') + '" data-slide="' + i + '"></span>';
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'paul-banner-video-overlay';
        overlay.innerHTML =
          '<div class="paul-banner-video-texts">' + textsHTML + '</div>' +
          '<div class="paul-banner-indicators dots">' + dotsHTML + '</div>';
        banner.appendChild(overlay);

        let current = 0;
        function goTo(idx) {
          overlay.querySelectorAll('.paul-banner-video-text').forEach(function (t, i) { t.classList.toggle('active', i === idx); });
          overlay.querySelectorAll('.paul-banner-indicator').forEach(function (d, i) { d.classList.toggle('active', i === idx); });
          current = idx;
        }

        overlay.querySelectorAll('.paul-banner-indicator').forEach(function (dot) {
          dot.addEventListener('click', function () { goTo(parseInt(dot.dataset.slide)); });
        });

        setInterval(function () {
          goTo((current + 1) % slides.length);
        }, duration);
      }

      return;
    }

    // ── MODE IMAGES ──
    const slidesHTML = slides.map(function (s, i) {
      return '<div class="paul-banner-slide' + (i === 0 ? ' active' : '') + '">' +
        '<img src="' + (typeof upgradeShopifyImageUrl === 'function' ? upgradeShopifyImageUrl(s.image) : s.image) + '" alt="' + s.text + '" class="paul-banner-image" loading="lazy">' +
        '<h2 class="paul-banner-title">' + s.text + '</h2>' +
        '</div>';
    }).join('');

    const dotsHTML = slides.map(function (s, i) {
      return '<span class="paul-banner-indicator' + (i === 0 ? ' active' : '') + '" data-slide="' + i + '"></span>';
    }).join('');

    banner.innerHTML =
      '<div class="paul-banner-slider-container">' + slidesHTML + '</div>' +
      '<div class="paul-banner-indicators dots">' + dotsHTML + '</div>';

    let timer;
    function goTo(idx) {
      banner.querySelectorAll('.paul-banner-slide').forEach(function (s, i) { s.classList.toggle('active', i === idx); });
      banner.querySelectorAll('.paul-banner-indicator').forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    }

    banner.querySelectorAll('.paul-banner-indicator').forEach(function (dot) {
      dot.addEventListener('click', function () {
        clearInterval(timer);
        goTo(parseInt(dot.dataset.slide));
        timer = setInterval(function () {
          const active = Array.from(banner.querySelectorAll('.paul-banner-slide')).findIndex(function (s) { return s.classList.contains('active'); });
          goTo((active + 1) % slides.length);
        }, duration);
      });
    });

    timer = setInterval(function () {
      const active = Array.from(banner.querySelectorAll('.paul-banner-slide')).findIndex(function (s) { return s.classList.contains('active'); });
      goTo((active + 1) % slides.length);
    }, duration);
  }

  /* ════════════════════════════════════════════════════
     UPSELL
     ── Lit settings.cart_page_upsell (nouveau setting dédié)
     ── Visible uniquement si cart non vide ET config présente
  ════════════════════════════════════════════════════ */
  function initPageUpsell() {
    const container  = document.getElementById('cp-upsell-items-container');
    const addBtn     = document.getElementById('cp-upsell-add-btn');
    const totalEl    = document.getElementById('cp-upsell-total-display');
    const badgeEl    = document.getElementById('cp-upsell-badge');
    const cpUpsell   = document.getElementById('cp-upsell-section');
    if (!container || !addBtn) return;

    const allProducts = window.__allProducts || [];
    const settings    = allProducts.find(function (p) { return p.type === 'settings'; }) || {};

    
    const upsellCfg   = settings.cart_page_upsell || {};
    const discountPct = parseFloat(upsellCfg.discount_percent) || 0;
    const itemsCfg    = upsellCfg.items || [];

    
    if (!itemsCfg.length) {
      if (cpUpsell) cpUpsell.style.display = 'none';
      return;
    }

    
    const cart = getCart();
    if (cart.length === 0) {
      if (cpUpsell) cpUpsell.style.display = 'none';
      return;
    }

    
    if (cpUpsell) cpUpsell.style.display = '';

    if (badgeEl && discountPct > 0) badgeEl.textContent = 'Save ' + discountPct + '%';
    container.innerHTML = '';
    const upsellProducts = itemsCfg
      .map(function (cfg) { return allProducts.find(function (p) { return p.id === cfg.product_id; }); })
      .filter(Boolean);

    if (!upsellProducts.length) {
      if (cpUpsell) cpUpsell.style.display = 'none';
      return;
    }

    upsellProducts.forEach(function (prod) {
      const firstVariant    = prod.variants && prod.variants.length ? prod.variants[0] : null;
      const originalPrice   = firstVariant ? parseFloat(firstVariant.price) : parseFloat(prod.price);
      const comparePrice    = parseFloat(prod.compare_price) || originalPrice;
      const discountedPrice = parseFloat((originalPrice * (1 - discountPct / 100)).toFixed(2));

      const item = document.createElement('div');
      item.className          = 'p2-upsell-item';
      item.dataset.id         = prod.id;
      item.dataset.original   = originalPrice;
      item.dataset.discounted = discountedPrice;
      item.dataset.compare    = comparePrice;

      item.innerHTML =
        '<div class="p2-upsell-check-wrap">' +
          '<input type="checkbox" id="cp-check-upsell-' + prod.id + '" class="p2-upsell-check" data-id="' + prod.id + '">' +
          '<label for="cp-check-upsell-' + prod.id + '" class="p2-upsell-check-label"></label>' +
        '</div>' +
        '<div class="p2-upsell-img-wrap">' +
          '<img src="' + upgradeImg(prod.image, 120) + '" alt="' + prod.title + '" loading="lazy">' +
        '</div>' +
        '<div class="p2-upsell-info">' +
          '<strong>' + prod.title + '</strong>' +
          '<span>' + (prod.description ? prod.description.substring(0, 55) + '...' : '') + '</span>' +
        '</div>' +
        '<div class="p2-upsell-price-col">' +
          '<span class="p2-upsell-old">$' + comparePrice.toFixed(2) + '</span>' +
          '<span class="p2-upsell-new">+$' + discountedPrice.toFixed(2) + '</span>' +
        '</div>';

      container.appendChild(item);
      item.querySelector('.p2-upsell-check').addEventListener('change', updateUpsellTotal);
    });

    function updateUpsellTotal() {
      let total = 0, anyChecked = false;
      container.querySelectorAll('.p2-upsell-check').forEach(function (cb) {
        if (cb.checked) {
          anyChecked = true;
          const itemEl = cb.closest('.p2-upsell-item');
          total += parseFloat(itemEl.dataset.discounted || 0);
        }
      });
      if (totalEl) totalEl.textContent = anyChecked ? '+ $' + total.toFixed(2) : '+ $0.00';
      addBtn.disabled = !anyChecked;
    }

    addBtn.addEventListener('click', function () {
      let added = 0;
      container.querySelectorAll('.p2-upsell-check').forEach(function (cb) {
        if (!cb.checked) return;
        const prodId = cb.dataset.id;
        const prod   = allProducts.find(function (p) { return p.id === prodId; });
        if (!prod) return;

        const firstVariant = prod.variants && prod.variants.length ? prod.variants[0] : null;
        const itemEl       = cb.closest('.p2-upsell-item');
        const price        = parseFloat(itemEl.dataset.discounted || prod.price);
        const comparePrice = parseFloat(itemEl.dataset.compare   || prod.compare_price);
        const color        = firstVariant ? (firstVariant.color || null) : null;
        const size         = firstVariant ? (firstVariant.size  || null) : null;
        const cjVariantId  = firstVariant ? firstVariant.vid : null;
        const colorObj     = (color && prod.colors) ? prod.colors.find(function (c) { return c.name === color; }) : null;
        const image        = upgradeImg(colorObj ? (colorObj.image || prod.image) : prod.image);

        let cart = getCart();
        const existing = cart.find(function (i) { return i.id === prodId && i.color === color && i.size === size; });
        if (existing) { existing.quantity += 1; }
        else {
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
        setCart(cart);
        added++;
      });

      if (added > 0) {
        saveCartAndSync();
        renderPageCart();
        addBtn.classList.add('added');
        addBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
        setTimeout(function () {
          addBtn.classList.remove('added');
          addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Selected to Cart';
        }, 2500);
      }
    });
  }

  /* ════════════════════════════════════════════════════
     REVIEWS
  ════════════════════════════════════════════════════ */
  function initPageReviews() {
    const container = document.getElementById('cp-reviews-carousel');
    if (!container) return;

    const products = window.__allProducts || [];
    const settings = products.find(function (p) { return p.type === 'settings'; }) || {};
    const reviews  = settings.cart_reviews || [];
    if (!reviews.length) {
      const sp = document.getElementById('cp-social-proof');
      if (sp) sp.style.display = 'none';
      return;
    }

    const googleSVG = '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

    reviews.forEach(function (r) {
      const stars = '&#9733;'.repeat(Math.min(5, Math.max(1, r.stars || 5)));
      const item = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML =
        '<div class="review-item-inner">' +
          '<div class="review-top">' +
            '<img src="' + r.avatar + '" alt="' + r.name + '" class="review-avatar">' +
            '<div class="review-meta"><h4>' + r.name + '</h4><div class="review-stars">' + stars + '</div></div>' +
            '<span class="verified-badge">' + googleSVG + '</span>' +
          '</div>' +
          '<p class="review-text">"' + r.text + '"</p>' +
          '<span class="review-date">' + r.date + '</span>' +
        '</div>';
      container.appendChild(item);
    });

    const items = container.querySelectorAll('.review-item');
    if (items.length > 1) {
      let current = 0;
      items[current].classList.add('active');
      setInterval(function () {
        items[current].classList.remove('active');
        current = (current + 1) % items.length;
        items[current].classList.add('active');
      }, 5000);
    } else if (items.length === 1) {
      items[0].classList.add('active');
    }
  }

  /* ════════════════════════════════════════════════════
     PROMO CODE SLIDER
  ════════════════════════════════════════════════════ */
  function initPagePromoSlider() {
    const products  = window.__allProducts || [];
    const settings  = products.find(function (p) { return p.type === 'settings'; }) || {};
    const promos    = settings.promos || [];
    const container = document.getElementById('cp-promo-codes-container');
    if (!container || !promos.length) return;

    const slidesHTML = promos.map(function (p, i) {
      return '<div class="cart-drawer__promo-slide' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' +
        '<div class="cart-drawer__promo-content">' +
        '<h3 class="cart-drawer__promo-title"><i class="fas fa-ticket-alt"></i> Exclusive Code</h3>' +
        '<p class="cart-drawer__promo-text">Use on <strong>' + p.items + '+</strong> items — Save <strong>' + p.percent + '%</strong></p>' +
        '<div class="cart-drawer__promo-code-row">' +
        '<span class="cart-drawer__promo-code" id="cp-code-' + i + '">' + p.code + '</span>' +
        '<button class="cart-drawer__promo-copy-btn" data-target="cp-code-' + i + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
        '</button></div></div></div>';
    }).join('');

    const dotsHTML = promos.map(function (p, i) {
      return '<span class="cart-drawer__promo-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i + '"></span>';
    }).join('');

    container.innerHTML =
      '<div class="cart-drawer__promo-slider">' + slidesHTML + '</div>' +
      '<div class="cart-drawer__promo-indicators dots">' + dotsHTML + '</div>';

    function promoGoTo(idx) {
      container.querySelectorAll('.cart-drawer__promo-slide').forEach(function (s, i) { s.classList.toggle('active', i === idx); });
      container.querySelectorAll('.cart-drawer__promo-dot').forEach(function (d, i)   { d.classList.toggle('active', i === idx); });
    }

    container.querySelectorAll('.cart-drawer__promo-dot').forEach(function (dot) {
      dot.addEventListener('click', function () { promoGoTo(parseInt(dot.dataset.index)); });
    });

    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.cart-drawer__promo-copy-btn');
      if (!btn) return;
      const target = container.querySelector('#' + btn.dataset.target);
      if (!target) return;
      navigator.clipboard.writeText(target.textContent.trim()).then(function () {
        btn.classList.add('copied');
        setTimeout(function () { btn.classList.remove('copied'); }, 1500);
        showToast('Code copied!');
      });
    });

    if (promos.length > 1) {
      setInterval(function () {
        const active = container.querySelector('.cart-drawer__promo-slide.active');
        const idx    = active ? parseInt(active.dataset.index) : 0;
        promoGoTo((idx + 1) % promos.length);
      }, 6000);
    }
  }

  /* ════════════════════════════════════════════════════
     SHOW / HIDE DYNAMIC SECTIONS
  ════════════════════════════════════════════════════ */
  function showDynamicSections() {
    ['cp-countdown','cp-progress-container','cp-promo-message-wrap',
     'cp-paul-banner','cp-promo-codes-container','cp-social-proof','bbw-order-timeline-page',
     'cp-share-section',
     'cp-extra-section',
     'cp-marquee-strip'
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
}

  function hideDynamicSections() {
    ['cp-countdown','cp-progress-container','cp-promo-message-wrap',
     'cp-paul-banner','cp-promo-codes-container','cp-social-proof',
     'cp-share-section','cp-upsell-section','bbw-order-timeline-page',
     'cp-extra-section',
     'cp-marquee-strip'
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
}

  /* ════════════════════════════════════════════════════
     CHECKOUT BUTTON
  ════════════════════════════════════════════════════ */
  function bindCheckoutButtons() {
    ['cp-checkout-btn', 'cp-sticky-checkout'].forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (typeof window.checkout === 'function') {
          window.checkout();
        } else {
          localStorage.setItem('checkoutCart', JSON.stringify(getCart()));
          window.location.href = '/checkout/checkout.html';
        }
      });
    });
  }

  /* ════════════════════════════════════════════════════
     STICKY BAR — mobile
  ════════════════════════════════════════════════════ */
  function initStickyBar() {
    const stickyBar = document.getElementById('cp-sticky-bar');
    if (!stickyBar) return;
    function checkSticky() {
      if (window.innerWidth > 768) { stickyBar.style.display = 'none'; return; }
      stickyBar.style.display = getCart().length > 0 ? '' : 'none';
    }
    window.addEventListener('scroll', checkSticky, { passive: true });
    window.addEventListener('resize', checkSticky, { passive: true });
    checkSticky();
  }

  /* ════════════════════════════════════════════════════════════════
     SHARE CART — système propre et indépendant
     URL générée : /cart.html?cart_share=ID1,ID2,ID3
     PAS de wishlist_share — PAS de all-product — JAMAIS
  ════════════════════════════════════════════════════════════════ */
  function initShareCart() {
    const shareModal    = document.getElementById('cp-share-modal');
    const shareBackdrop = document.getElementById('cp-share-modal-backdrop');
    const shareClose    = document.getElementById('cp-share-modal-close');
    const shareLinkEl   = document.getElementById('cp-share-link-input');
    const shareCopyBtn  = document.getElementById('cp-share-modal-copy');
    const shareBtn      = document.getElementById('cpShareCartBtn');
    const copyLinkBtn   = document.getElementById('cp-copy-link');

    function buildCartShareUrl() {
      var cart = getCart();
      if (!cart.length) return null;
      var slugs = cart.map(function (i) {
        return CART_SLUG_MAP[i.id] || i.id;
      }).join(',');
      return window.location.origin + '/cart.html?cart_share=' + encodeURIComponent(slugs);
    }

    function buildProductLines() {
      var cart = getCart();
      return cart.map(function (i, idx) {
        var qty  = i.quantity > 1 ? ' x' + i.quantity : '';
        var vars = '';
        if (i.color) vars += ' - ' + i.color;
        if (i.size)  vars += ' / ' + i.size;
        return '(' + (idx + 1) + ') ' + i.title + vars + qty + ' — $' + parseFloat(i.price).toFixed(2);
      }).join('\n');
    }

    function getRandomPromo() {
      var allProducts = window.__allProducts || [];
      var settings    = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
      var promos      = settings.promos || [];
      if (!promos.length) return null;
      return promos[Math.floor(Math.random() * promos.length)];
    }

    function buildShareMessage(platform) {
      var cart = getCart();
      if (!cart.length) return null;

      var shareUrl     = buildCartShareUrl();
      var productLines = buildProductLines();
      var count        = cart.reduce(function (s, i) { return s + i.quantity; }, 0);
      var subtotal     = cart.reduce(function (s, i) { return s + parseFloat(i.price) * i.quantity; }, 0);
      var promo        = getRandomPromo();

      var titleLine = 'MY CART (' + count + ' ITEM' + (count > 1 ? 'S' : '') + ' — $' + subtotal.toFixed(2) + '):';

      var promoLine = promo
        ? '🎁 *PROMO CODE: ' + promo.code + '* — Buy ' + promo.items + '+ items and get ' + promo.percent + '% OFF!\n\n'
        : '';

      var intro =
        'Hey my friend! I am on bbw4life.com and I put these ' + count +
        ' beautiful product' + (count > 1 ? 's' : '') + ' in my cart!\n' +
        'I am sharing them with you — click the link and they will be automatically added to your cart!\n\n' +
        '*' + titleLine + '*\n' +
        productLines + '\n\n' +
        promoLine +
        'Click here to see my cart:\n' + shareUrl + '\n\n' +
        'BBW4LIFE — Beauty Has No Sizes | bbw4life.com';

      var twitterMsg =
        'Check out my BBW4LIFE cart! ' + count + ' amazing item' + (count > 1 ? 's' : '') + ' I\'m loving.\n\n' +
        (promo ? 'Use code ' + promo.code + ' for ' + promo.percent + '% OFF (min. ' + promo.items + ' items)!\n\n' : '') +
        shareUrl + '\n\n' +
        '#BBW4LIFE #CurvyFashion #PlusSize';

      var pinterestMsg =
        'My BBW4LIFE shopping cart — ' + count + ' beautiful item' + (count > 1 ? 's' : '') + '!\n\n' +
        productLines + '\n\n' +
        promoLine +
        shareUrl;

      if (platform === 'twitter')   return twitterMsg;
      if (platform === 'pinterest') return pinterestMsg;
      return intro;
    }

    function showShareToast(msg) {
      showToast(msg);
    }

    function handleCartShare(platform) {
      var cart = getCart();
      if (!cart.length) {
        showShareToast('Your cart is empty!');
        return;
      }

      var shareUrl = buildCartShareUrl();
      var message  = buildShareMessage(platform);

      var platformUrls = {
        whatsapp:  'https://wa.me/?text=' + encodeURIComponent(message),
        facebook:  'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl) + '&quote=' + encodeURIComponent(message),
        twitter:   'https://x.com/intent/tweet?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent('Check out my BBW4LIFE cart!'),
        pinterest: 'https://pinterest.com/pin/create/button/?url=' + encodeURIComponent(shareUrl) + '&media=' + encodeURIComponent(window.__allProducts && window.__allProducts.length ? (function(){ var cart = getCart(); var first = cart[0]; if (!first) return ''; var prod = (window.__allProducts||[]).find(function(p){return p.id===first.id;}); return prod ? prod.image : ''; })() : '') + '&description=' + encodeURIComponent(buildShareMessage('pinterest') || message)
      };
      if (platform === 'copy') {
          var fullMessage = buildShareMessage('whatsapp');
          var textToCopy = fullMessage || shareUrl;
          navigator.clipboard.writeText(textToCopy).then(function () {
              showShareToast('Message copied to clipboard!');
              if (shareLinkEl) shareLinkEl.value = shareUrl;
          }).catch(function () {
              showShareToast('Could not copy. Please copy manually.');
          });
          return;
      }

      if (platformUrls[platform]) {
        window.open(platformUrls[platform], '_blank', 'noopener,noreferrer,width=640,height=520');
        showShareToast('Opening share window...');
      }
    }

    window.handleCartShare = handleCartShare;

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cart-share]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      handleCartShare(btn.dataset.cartShare);
    });

    function openModal() {
      var cart = getCart();
      if (!cart.length) { showShareToast('Your cart is empty!'); return; }
      var url = buildCartShareUrl();
      if (shareLinkEl) shareLinkEl.value = url || '';
      if (shareModal) { shareModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    }

    function closeModal() {
      if (shareModal) { shareModal.style.display = 'none'; document.body.style.overflow = ''; }
    }

    if (shareBtn)      shareBtn.addEventListener('click', openModal);
    if (shareClose)    shareClose.addEventListener('click', closeModal);
    if (shareBackdrop) shareBackdrop.addEventListener('click', closeModal);

    if (shareCopyBtn) {
      shareCopyBtn.addEventListener('click', function () {
        var url = buildCartShareUrl();
        if (!url) { showShareToast('Your cart is empty!'); return; }
        navigator.clipboard.writeText(url).then(function () {
          showShareToast('Link copied!');
          if (shareLinkEl) shareLinkEl.value = url;
        });
      });
    }

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', function () {
        handleCartShare('copy');
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && shareModal && shareModal.style.display !== 'none') closeModal();
    });
  }

  /* ════════════════════════════════════════════════════════════════
     RÉCEPTEUR : Lire ?cart_share=ID1,ID2 et ajouter au panier
  ════════════════════════════════════════════════════════════════ */
  function initCartShareReceiver() {
    var params    = new URLSearchParams(window.location.search);
    var sharedIds = params.get('cart_share') || params.get('items');

    if (!sharedIds) return;

    var ids = decodeURIComponent(sharedIds).split(',').filter(Boolean);
    if (!ids.length) return;

    var reverseMap = {};
    Object.keys(CART_SLUG_MAP).forEach(function(k) { reverseMap[CART_SLUG_MAP[k]] = k; });
    ids = ids.map(function(s) { return reverseMap[s] || s; });

    function addSharedToCart() {
      var allProducts = window.__allProducts || [];
      var added = 0;

      ids.forEach(function (id) {
        var prod = allProducts.find(function (p) { return p.id === id; });
        if (!prod || prod.type) return;

        var cart     = getCart();
        var existing = cart.find(function (i) { return i.id === id; });

        if (existing) {
          existing.quantity += 1;
          setCart(cart);
        } else {
          var variant  = (prod.variants && prod.variants.length) ? prod.variants[0] : null;
          var price    = variant ? parseFloat(variant.price) : parseFloat(prod.price);
          var color    = variant ? (variant.color || null) : null;
          var size     = variant ? (variant.size  || null) : null;
          var colorObj = (color && prod.colors) ? prod.colors.find(function (c) { return c.name === color; }) : null;
          var image    = upgradeImg(colorObj ? (colorObj.image || prod.image) : prod.image);

          cart = getCart();
          cart.push({
            id:             prod.id,
            title:          prod.title,
            price:          price,
            compare_price:  parseFloat(prod.compare_price) || price,
            image:          image,
            size:           size  || null,
            color:          color || null,
            quantity:       1,
            fromSharedCart: true,
            cj_product_id:  prod.cj_id,
            cj_variant_id:  variant ? variant.vid : null
          });
          setCart(cart);
        }

        added++;
      });

      if (added > 0) {
        saveCartAndSync();
        renderPageCart();
        setTimeout(function () {
          showToast(
            added + ' item' + (added > 1 ? 's' : '') +
            ' added from shared cart!'
          );
        }, 700);
      }

      var cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }

    if (window.__allProducts && window.__allProducts.length) {
      addSharedToCart();
    } else {
      var tries = 0;
      var wait = setInterval(function () {
        tries++;
        if (window.__allProducts && window.__allProducts.length) {
          clearInterval(wait);
          addSharedToCart();
        } else if (tries > 80) {
          clearInterval(wait);
        }
      }, 100);
    }
  }

  /* ════════════════════════════════════════════════════
     ÉCOUTER LES MISES À JOUR DU CART
  ════════════════════════════════════════════════════ */
  function listenCartUpdates() {
    document.addEventListener('cart:update', function () {
      renderPageCart();
      updateProgressBar();
      updatePromoMessage();
    });
  }

  /* ════════════════════════════════════════════════════
     MARQUER QU'ON EST SUR LA CART PAGE
  ════════════════════════════════════════════════════ */
  window.__isCartPage = true;

  /* ════════════════════════════════════════════════════
     INIT PRINCIPALE
  ════════════════════════════════════════════════════ */
  ready(function () {
    waitReady(function () {
      renderPageCart();
      initCountdown();
      initPageBanner();
      initPageUpsell();
      initPageReviews();
      initPagePromoSlider();
      updateProgressBar();
      updatePromoMessage();
      bindCheckoutButtons();
      initStickyBar();
      initShareCart();
      initCartShareReceiver();
      listenCartUpdates();
      setTimeout(updateProgressBar, 100);

      // Fix cart.html : forcer initCartDrawerExtras dans le drawer au chargement
      if (getCart().length > 0) {
        setTimeout(function () {
          if (typeof initCartDrawerExtras === 'function') initCartDrawerExtras();
        }, 500);
      }
    });
  });

})();