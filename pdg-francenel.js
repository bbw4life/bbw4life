
(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     1. HTML Pdg Francenel — injecté directement dans le DOM
  ────────────────────────────────────────────────────────── */
  var WIDGETS_HTML = `


<div id="plan-popup-overlay" class="plan-popup-overlay" aria-hidden="true">
  <div class="plan-popup-modal" role="dialog" aria-modal="true" aria-labelledby="plan-popup-title">

    <button class="plan-popup-close" id="plan-popup-close" aria-label="Close">
      <i class="fi fi-rr-cross"></i>
    </button>

    
    <div class="plan-popup-step" id="plan-step-form">

      <div class="plan-popup-urgency-bar">
        <div class="plan-popup-urgency-fill" id="plan-urgency-fill"></div>
      </div>

      <div class="plan-popup-header">
        <div class="plan-popup-badge">
          <i class="fi fi-rr-heart"></i> BBW4LIFE Originals — Custom Request
        </div>
        <div class="plan-popup-spots-row">
          <span class="plan-popup-spots-count" id="plan-spots-count">27</span>
          <span class="plan-popup-spots-label">requests open this week</span>
        </div>
        <h2 id="plan-popup-title">Request Your Custom Product</h2>
        <p>Tell us what you want — our team prepares your order within 24–48h and contacts you with confirmation.</p>
      </div>

      <div class="plan-popup-body">

        
        <div class="plan-popup-social-proof">
          <div class="plan-popup-avatars">
            <img src="https://cdn.shopify.com/s/files/1/0978/0353/4627/files/Customer_plan_1.png?v=1776041141" alt="">
            <img src="https://cdn.shopify.com/s/files/1/0978/0353/4627/files/Customer_plan_2.png?v=1776041141" alt="">
            <img src="https://cdn.shopify.com/s/files/1/0978/0353/4627/files/Customer_plan_3.png?v=1776041141" alt="">
            <img src="https://cdn.shopify.com/s/files/1/0978/0353/4627/files/Customer_plan_4.png?v=1776041171" alt="">
            <img src="https://cdn.shopify.com/s/files/1/0978/0353/4627/files/Customer_plan_5.png?v=1776041141" alt="">
          </div>
          <span><strong>8 women</strong> submitted a request in the last 24h</span>
        </div>

        
        <div class="plan-popup-price-block">
          <div class="plan-popup-price-inner">
            <div class="plan-popup-price-left">
              <span class="plan-popup-price-label">Reservation fee</span>
              <span class="plan-popup-price-value plan-reservation-price-label">...</span>
              <span class="plan-popup-price-note">Deducted from your product price</span>
            </div>
            <div class="plan-popup-price-badge">
              <i class="fi fi-rr-shield-check"></i>
              Refundable
            </div>
          </div>
        </div>

        
        <div class="plan-form-row">
          <div class="plan-form-group">
            <label for="plan-firstname">First Name *</label>
            <input type="text" id="plan-firstname" placeholder="Maria" autocomplete="given-name">
          </div>
          <div class="plan-form-group">
            <label for="plan-lastname">Last Name *</label>
            <input type="text" id="plan-lastname" placeholder="Doe" autocomplete="family-name">
          </div>
          <div class="plan-form-group">
            <label for="plan-email">Email *</label>
            <input type="email" id="plan-email" placeholder="maria@email.com" autocomplete="email">
          </div>
          <div class="plan-form-group">
            <label for="plan-phone">Phone</label>
            <input type="tel" id="plan-phone" placeholder="+1 000 000 0000" autocomplete="tel">
          </div>

          
          <div class="plan-form-group plan-form-group--full">
            <label for="plan-program">Desired Product *</label>
            <select id="plan-program">
              <option value="" disabled selected>Choose a product...</option>
              
            </select>
          </div>

          
         <div class="plan-form-group plan-form-group--half" id="plan-size-group">
          <label for="plan-size">Preferred Size *</label>
          <input type="text" id="plan-size" placeholder="e.g. 1XL, 2XL, 3XL…" autocomplete="off">
        </div>

          
          <div class="plan-form-group plan-form-group--half" id="plan-color-group">
          <label for="plan-color">Preferred Color *</label>
          <input type="text" id="plan-color" placeholder="e.g. Black, Blush Pink, Teal…" autocomplete="off">
        </div>

          
          <div class="plan-form-group plan-form-group--full" id="plan-color-preview-wrap" style="display:none;">
            <div class="plan-color-swatches-preview" id="plan-color-swatches-preview"></div>
          </div>

        </div>

        <div class="plan-checkbox-wrap">
          <input type="checkbox" id="plan-consent">
          <label for="plan-consent">
            <strong>I want to reserve this product at BBW4LIFE.</strong>
            I agree to be contacted by the team within 24–48h. The <span class="plan-reservation-price-label">...</span> reservation fee will be deducted from my total.
          </label>
        </div>

        <div class="plan-popup-error" id="plan-popup-error" style="display:none;"></div>

        <button class="plan-submit-btn" id="plan-submit-btn">
          <i class="fi fi-rr-credit-card"></i>
          Continue to Payment
        </button>

        <p class="plan-privacy-note">
          <i class="fi fi-rr-shield-check"></i>
          Secure · 100% refundable · No hidden fees
        </p>
      </div>
    </div>

    
    <div class="plan-popup-step" id="plan-step-payment" style="display:none;">

      <div class="plan-popup-urgency-bar">
        <div class="plan-popup-urgency-fill" id="plan-urgency-fill-2"></div>
      </div>

      <div class="plan-popup-header plan-popup-header--payment">
        <i class="fi fi-rr-lock plan-lock-icon"></i>
        <h2>Choose Payment Method</h2>
        <p>Secure <span class="plan-reservation-price-label">...</span> reservation — processed via your chosen provider.</p>
      </div>

      <div class="plan-popup-body">

        
        <div class="plan-popup-summary-strip">
          <i class="fi fi-rr-check-circle"></i>
          <div>
            <strong id="plan-pay-program-name">Product</strong>
            <span id="plan-pay-variant-summary"></span>
            <span>Reservation: <span class="plan-reservation-price-label">...</span> · Deducted from price</span>
          </div>
        </div>

        
        <div class="plan-pay-options">
          <label class="plan-pay-option" id="plan-opt-stripe">
            <input type="radio" name="plan-payment" value="stripe" checked>
            <div class="plan-pay-option-inner">
              <i class="fi fi-rr-credit-card"></i>
              <div>
                <strong>Credit / Debit Card</strong>
                <small>Powered by Stripe · Secure</small>
              </div>
            </div>
            <div class="plan-pay-check"></div>
          </label>

          <label class="plan-pay-option" id="plan-opt-paypal">
            <input type="radio" name="plan-payment" value="paypal">
            <div class="plan-pay-option-inner">
              <i class="fi fi-brands-paypal" style="color:#003087;font-size:1.3rem;"></i>
              <div>
                <strong>PayPal</strong>
                <small>Fast &amp; secure checkout</small>
              </div>
            </div>
            <div class="plan-pay-check"></div>
          </label>
        </div>

        <div class="plan-popup-error" id="plan-pay-error" style="display:none;"></div>

        <button class="plan-submit-btn" id="plan-pay-btn">
          <i class="fi fi-rr-lock"></i>
          Pay <span class="plan-reservation-price-label">...</span> — Reserve My Product
        </button>

        <button class="plan-back-btn" id="plan-back-btn">
          <i class="fi fi-rr-arrow-left"></i> Back
        </button>

        <p class="plan-privacy-note">
          <i class="fi fi-rr-shield-check"></i>
          256-bit SSL · PCI compliant · 100% refundable
        </p>
      </div>
    </div>

    
    <div class="plan-popup-step" id="plan-step-thanks" style="display:none;">
      <div class="plan-thanks-wrap">
        <div class="plan-thanks-ring">
          <div class="plan-thanks-icon">
            <i class="fi fi-rr-check"></i>
          </div>
        </div>
        <h2 class="plan-thanks-title">Your request is confirmed! 🌸</h2>
        <p class="plan-thanks-sub" id="plan-thanks-name">Welcome, Maria!</p>
        <p class="plan-thanks-msg">
          Your <span class="plan-reservation-price-label">...</span> reservation is confirmed and will be deducted from your product price.
          A BBW4LIFE team member will contact you within <strong>24–48 hours</strong> to finalize your custom order.
        </p>
        <div class="plan-thanks-program-badge" id="plan-thanks-program-badge">
          <i class="fi fi-rr-shopping-bag"></i>
          <span id="plan-thanks-program-text">Your Product</span>
        </div>
        <div class="plan-thanks-details">
          <div class="plan-thanks-detail-item">
            <i class="fi fi-rr-envelope"></i>
            <span>Confirmation sent to your inbox</span>
          </div>
          <div class="plan-thanks-detail-item">
            <i class="fi fi-rr-headset"></i>
            <span>Our team contacts you within 24–48h</span>
          </div>
          <div class="plan-thanks-detail-item">
            <i class="fi fi-rr-dollar"></i>
            <span><span class="plan-reservation-price-label">...</span> deducted from your product total</span>
          </div>
        </div>
        <p class="plan-thanks-marketing-msg">
          <i class="fi fi-rr-sparkles"></i>
          Discover our full BBW4LIFE collection — fashion, beauty and swimwear designed for every beautiful curve.
        </p>
        <a href="/collections/bbw4life-all-product.html" class="plan-close-thanks-btn" id="plan-close-thanks">
          <i class="fi fi-rr-heart"></i>
          Explore All Products
        </a>
      </div>
    </div>

  </div>
</div>



  <div id="colQvOverlay" class="col-qv-overlay" style="display:none">
    <div class="col-qv-modal">
      <button class="col-qv-close" id="colQvClose"><i class="fas fa-times"></i></button>
      <div class="col-qv-inner" id="colQvInner"></div>
    </div>
  </div>

  
  <div id="colCompareOverlay" class="col-compare-overlay" style="display:none">
    <div class="col-compare-modal">
      <div class="col-compare-modal__head">
        <h2>Compare Products</h2>
        <button class="col-compare-modal__close" id="colCompareClose"><i class="fas fa-times"></i></button>
      </div>
      <div class="col-compare-modal__body" id="colCompareBody"></div>
    </div>
  </div>

  
  <div class="col-sticky-bar" id="colStickyBar" style="display:none">
    <div class="col-sticky-bar__inner">
      <span class="col-sticky-bar__label">
        <span id="colSelectedCount">0</span> selected
      </span>
      <div class="col-sticky-bar__actions">
        <button class="col-sticky-btn col-sticky-btn--cart" id="colStickyAddCart">
          <i class="fas fa-cart-plus"></i> Add All to Cart
        </button>
        <button class="col-sticky-btn col-sticky-btn--compare" id="colCompareBtn">
          <i class="fas fa-columns"></i> Compare
        </button>
        <button class="col-sticky-btn col-sticky-btn--clear" id="colStickyBarClear">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  </div>

 
<div id="colExitOverlay" class="col-exit-overlay" style="display:none">
  <div class="col-exit-popup">
    <button class="col-exit-close" id="colExitClose"><i class="fas fa-times"></i></button>
    <div class="col-exit-emoji"><i class="fas fa-tag"></i></div>
    <h2 class="col-exit-title">Wait — before you go!</h2>
    <p class="col-exit-sub">Use code <strong id="colExitPromoCode"></strong> for <span id="colExitPromoPct"></span>% off your order today.</p>
    <div class="col-exit-code">
      <span id="colExitCodeSpan"></span>
      <button class="col-exit-copy" id="colExitCopy">Copy</button>
    </div>
    <button class="col-exit-cta" id="colExitCta">Shop Now &amp; Save <span id="colExitCtaPct"></span>%</button>
    <p class="col-exit-skip" id="colExitSkip">No thanks, I'll pay full price</p>
  </div>
</div>

  <!-- ══════════════════════════════════════════
       POPUP — MY PERSONALIZED PRODUCT
  ══════════════════════════════════════════ -->
  <div class="mpp-overlay" id="mppOverlay">
    <div class="mpp-popup-wrap">
      <div class="mpp-border-ring"></div>
      <div class="mpp-popup" id="mppPopup">
        <button class="mpp-close" id="mppClose">✕</button>

        <div class="mpp-header">
          <div class="mpp-crown">👑</div>
          <h2>Your Dream Product, Made Real</h2>
          <p>You inspire every piece we create. Tell us exactly what you need — your style, your size, your color — and we'll build it just for you.</p>
          <div class="mpp-header-bar"><div class="mpp-header-bar-fill"></div></div>
        </div>

        <form class="mpp-form" id="mppForm">

          <div class="mpp-section-label">About you</div>
          <div class="mpp-row">
            <div class="mpp-field">
              <label>First Name</label>
              <input type="text" name="firstname" placeholder="Maria" required>
            </div>
            <div class="mpp-field">
              <label>Last Name</label>
              <input type="text" name="lastname" placeholder="Johnson" required>
            </div>
          </div>
          <div class="mpp-row">
            <div class="mpp-field">
              <label>Email</label>
              <input type="email" name="email" placeholder="maria@example.com" required>
            </div>
            <div class="mpp-field">
              <label>Phone <span class="mpp-optional">(optional)</span></label>
              <input type="tel" name="phone" placeholder="+1 234 567 8900">
            </div>
          </div>

          <div class="mpp-section-label">Your style preferences</div>
          <div class="mpp-row">
            <div class="mpp-field">
              <label>Your Size</label>
              <select name="size" required>
                <option value="" disabled selected>Select your size</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="2XL">2XL</option>
                <option value="3XL">3XL</option>
                <option value="4XL">4XL</option>
                <option value="5XL">5XL</option>
                <option value="6XL">6XL</option>
              </select>
            </div>
            <div class="mpp-field">
              <label>Preferred Color <span class="mpp-optional">(name or describe)</span></label>
              <input type="text" name="color" placeholder="e.g. Dusty Rose, Deep Navy…">
            </div>
          </div>

          <div class="mpp-section-label">Your dream product</div>
          <div class="mpp-field">
            <label>Product name / title</label>
            <input type="text" name="product_title" placeholder="e.g. Wrap maxi dress with pockets, plus size" required>
          </div>
          <div class="mpp-field">
            <label>Describe it — what does it do for you?</label>
            <textarea name="product_desc" rows="3" placeholder="I'd love a dress that flatters my waist, has pockets, and comes in deep burgundy for evening occasions…"></textarea>
          </div>

          <div class="mpp-section-label">Inspiration images <span class="mpp-optional">(optional — max 2)</span></div>
          <div class="mpp-upload-row">
            <label class="mpp-upload-box" id="uploadBox1">
              <input type="file" accept="image/*" id="imgInput1" hidden>
              <div class="mpp-upload-inner" id="uploadInner1">
                <span class="mpp-upload-icon"><i class="fas fa-image"></i></span>
                <span>Image 1</span>
              </div>
            </label>
            <label class="mpp-upload-box" id="uploadBox2">
              <input type="file" accept="image/*" id="imgInput2" hidden>
              <div class="mpp-upload-inner" id="uploadInner2">
                <span class="mpp-upload-icon"><i class="fas fa-image"></i></span>
                <span>Image 2</span>
              </div>
            </label>
          </div>

          <button type="submit" class="mpp-send-btn">
            <i class="fas fa-paper-plane"></i> Send My Dream Product
          </button>

        </form>

        <div class="mpp-success" id="mppSuccess" style="display:none;">
          <div class="mpp-success-icon">🎉</div>
          <h3>We received your dream!</h3>
          <p>Thank you so much. You're helping us build a brand that truly serves women like you. We'll review your request and be in touch soon!</p>
          <button class="mpp-close-success" id="mppCloseSuccess">Close</button>
        </div>

      </div>
    </div>
  </div>

`;

  /* ──────────────────────────────────────────────────────────
     2. INJECTION SYNCHRONE dans le DOM
        → les éléments existent AVANT que script.js soit lu
  ────────────────────────────────────────────────────────── */

  // 1. Le bouton → injecté au bon endroit via placeholder
  var btnContainer = document.createElement('div');
  btnContainer.innerHTML = `
  <div class="plan-request-trigger-wrap" id="plan-request-trigger-wrap">
    <button id="open-plan-popup" class="plan-request-trigger-btn">
      <span class="plan-btn-icon">
        <i class="fi fi-rr-shopping-bag"></i>
      </span>
      <span class="plan-btn-text">
        <strong>Request This Product — Custom Order</strong>
        <small>Choose your style, size & color · We handle the rest</small>
      </span>
      <span class="plan-btn-arrow"><i class="fi fi-rr-arrow-right"></i></span>
    </button>
  </div>`;

  var placeholder = document.getElementById('plan-request-trigger-placeholder');
  if (placeholder) {
    placeholder.replaceWith(btnContainer.firstElementChild);
  }

  // 2. Tous les modals/popups → restent dans le body
  var modalsContainer = document.createElement('div');
  modalsContainer.id  = 'bbw-widgets-root';
  modalsContainer.innerHTML = WIDGETS_HTML;
  document.body.appendChild(modalsContainer);

  /* ──────────────────────────────────────────────────────────
     3. DÉLÉGATION D'ÉVÉNEMENTS
  ────────────────────────────────────────────────────────── */

  document.addEventListener('click', function (e) {

    
    if (e.target.classList.contains('overlay')) {
      closeCartDrawer();
      closeWishlistModal();
    }

    
    var cartWrapper = e.target.closest('.icon-wrapper');
    if (cartWrapper) {
      if (cartWrapper.querySelector('.cart-icon'))     { openCartDrawer();    return; }
      if (cartWrapper.querySelector('.wishlist-icon')) { openWishlistModal(); return; }
    }

    
    if (e.target.closest('.close-drawer')) {
      closeCartDrawer();
      return;
    }

    
    if (e.target.closest('.close-modal') || e.target.classList.contains('wishlist-modal-backdrop')) {
      closeWishlistModal();
      return;
    }

    
    if (e.target.closest('.cart-drawer__footer .checkout')) {
      if (typeof checkout === 'function') checkout();
      return;
    }

    
    if (e.target.closest('#paulTrigger')) {
      e.preventDefault();
      if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = '/account.html';
      } else {
        var popup = document.getElementById('paulPopup');
        var loginForm = document.getElementById('loginForm');
        var signupForm = document.getElementById('signupForm');
        if (popup)      popup.classList.add('active');
        if (loginForm)  loginForm.style.display = 'block';
        if (signupForm) signupForm.style.display = 'none';
      }
      return;
    }

    
    if (e.target.id === 'paulPopup') {
      var pp = document.getElementById('paulPopup');
      if (pp && !window.location.pathname.toLowerCase().includes('account')) {
        pp.classList.remove('active');
      }
      return;
    }

    
    if (e.target.closest('.paul-close')) {
      var pp2 = document.getElementById('paulPopup');
      if (pp2 && !window.location.pathname.toLowerCase().includes('account')) {
        pp2.classList.remove('active');
      }
      return;
    }

    
    if (e.target.id === 'goToSignup') {
      var lf = document.getElementById('loginForm');
      var sf = document.getElementById('signupForm');
      if (lf) lf.style.display = 'none';
      if (sf) sf.style.display = 'block';
      return;
    }
    if (e.target.id === 'goToLogin') {
      var lf2 = document.getElementById('loginForm');
      var sf2 = document.getElementById('signupForm');
      if (lf2) lf2.style.display = 'block';
      if (sf2) sf2.style.display = 'none';
      return;
    }
    if (e.target.id === 'goToForgot') {
      var lf3 = document.getElementById('loginForm');
      var ff  = document.getElementById('forgotForm');
      if (lf3) lf3.style.display = 'none';
      if (ff)  ff.style.display  = 'block';
      return;
    }
    if (e.target.id === 'goToLoginFromForgot') {
      var ff2 = document.getElementById('forgotForm');
      var lf4 = document.getElementById('loginForm');
      if (ff2) ff2.style.display = 'none';
      if (lf4) lf4.style.display = 'block';
      return;
    }

    
    if (e.target.id === 'popup-close') {
      var ep = document.getElementById('error-popup');
      if (ep) ep.classList.remove('show');
      return;
    }

    
    if (e.target.closest('#fnav-toggle')) {
      var wheel  = document.getElementById('fnav-wheel');
      var toggle = document.getElementById('fnav-toggle');
      if (wheel)  wheel.classList.toggle('open');
      if (toggle) toggle.classList.toggle('open');
      return;
    }

    
    if (!e.target.closest('#floating-nav')) {
      var wheel2 = document.getElementById('fnav-wheel');
      var toggle2 = document.getElementById('fnav-toggle');
      if (wheel2)  wheel2.classList.remove('open');
      if (toggle2) toggle2.classList.remove('open');
    }

    
    if (e.target.closest('#rc-close')) {
      var rc = document.getElementById('rc-popup-container');
      if (rc) rc.style.display = 'none';
      return;
    }

    
    var shareBtn = e.target.closest('[data-wishlist-share]');
    if (shareBtn) {
      e.preventDefault();
      if (typeof window.handleWishlistShare === 'function') {
        window.handleWishlistShare(shareBtn.dataset.wishlistShare);
      }
      return;
    }

    
    if (e.target.closest('.add-all-to-cart')) {
      if (typeof addAllToCart === 'function') addAllToCart();
      return;
    }

  });

  /* ──────────────────────────────────────────────────────────
     4. HELPERS OUVRIR/FERMER
        Exposés globalement pour que script.js puisse les appeler
  ────────────────────────────────────────────────────────── */
  function openCartDrawer() {
    var drawer  = document.querySelector('.cart-drawer');
    var overlay = document.querySelector('.overlay');
    if (drawer)  drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    if (typeof window.renderCart === 'function') window.renderCart();
    if (typeof initCartDrawerExtras === 'function') setTimeout(initCartDrawerExtras, 100);
  }

  function closeCartDrawer() {
    var drawer  = document.querySelector('.cart-drawer');
    var overlay = document.querySelector('.overlay');
    if (drawer)  drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  function openWishlistModal() {
    var modal   = document.querySelector('.wishlist-modal');
    var overlay = document.querySelector('.overlay');
    if (modal)   modal.classList.add('active');
    if (overlay) overlay.classList.add('active');
    if (typeof window.renderWishlist === 'function') window.renderWishlist();
  }

  function closeWishlistModal() {
    var modal   = document.querySelector('.wishlist-modal');
    var overlay = document.querySelector('.overlay');
    if (modal)   modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  
  window.openCartDrawer    = openCartDrawer;
  window.closeCartDrawer   = closeCartDrawer;
  window.openWishlistModal = openWishlistModal;
  window.closeWishlistModal= closeWishlistModal;

  /* ──────────────────────────────────────────────────────────
     5. FNAV — scroll boutons haut/bas
  ────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.fnav-btn');
    if (!btn) return;

    if (btn.classList.contains('fnav-top')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (btn.classList.contains('fnav-bottom')) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else if (btn.classList.contains('fnav-left')) {
      history.back();
    } else if (btn.classList.contains('fnav-refresh')) {
      location.reload();
    }
    // fnav-right (next page) géré par script.js via #fnav-next
  });

  /* ──────────────────────────────────────────────────────────
     6. SIGNAL — widgets prêts
  ────────────────────────────────────────────────────────── */
  document.dispatchEvent(new CustomEvent('widgets:ready'));

  console.log('[BBW4LIFE] widgets-loader.js — widgets injectés de manière synchrone ✓');

})();




/* ══════════════════════════════════════════════════════
   BBW4LIFE — NEWSLETTER AUTO POPUP
══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SEEN_KEY       = 'bbwnl_auto_seen';
  var SUBSCRIBED_KEY = 'bbwnl_subscribed';
  var DISMISSED_KEY  = 'bbwnl_dismissed';
  var autoTimer      = null;
  var hideTimer      = null;

  
  if (
    localStorage.getItem(SUBSCRIBED_KEY) === 'yes' ||
    localStorage.getItem(DISMISSED_KEY)  === 'yes'
  ) return;

  
  if (sessionStorage.getItem(SEEN_KEY) === 'yes') return;

  
  function waitAndRun() {
    var allProducts = window.__allProducts || [];
    var settings    = allProducts.find(function (p) { return p.type === 'settings'; }) || {};
    var cfg         = settings.newsletter_auto_popup || {};

    var show     = (cfg.show || 'no').toLowerCase().trim() === 'yes';
    var delay    = parseInt(cfg.delay_seconds)   || 20;
    var duration = parseInt(cfg.duration_seconds) || 10;

    if (!show) return;

    
    sessionStorage.setItem(SEEN_KEY, 'yes');

    
    autoTimer = setTimeout(function () {
      if (typeof window.openNewsletterPopup !== 'function') return;

      
      if (
        localStorage.getItem(SUBSCRIBED_KEY) === 'yes' ||
        localStorage.getItem(DISMISSED_KEY)  === 'yes'
      ) return;

      window.openNewsletterPopup();

      
      hideTimer = setTimeout(function () {
        if (typeof window.closeNewsletterPopup === 'function') {
          window.closeNewsletterPopup();
        }
      }, duration * 1000);

    }, delay * 1000);
  }

  
  document.addEventListener('click', function (e) {
    var el = e.target.closest('#bbwNlClose, #bbwNlSuccessClose');
    if (!el) return;
    localStorage.setItem(DISMISSED_KEY, 'yes');
    if (hideTimer) clearTimeout(hideTimer);
  });

  
  var _origOpen = window.openNewsletterPopup;
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'bbwNlForm') {
      
      var check = setInterval(function () {
        var success = document.getElementById('bbwNlSuccess');
        if (success && success.style.display !== 'none') {
          localStorage.setItem(SUBSCRIBED_KEY, 'yes');
          localStorage.setItem(DISMISSED_KEY,  'yes');
          if (hideTimer) clearTimeout(hideTimer);
          clearInterval(check);
        }
      }, 300);
      setTimeout(function () { clearInterval(check); }, 10000);
    }
  });

  
  if (window.__allProducts && window.__allProducts.length) {
    waitAndRun();
  } else {
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (window.__allProducts && window.__allProducts.length) {
        clearInterval(poll);
        waitAndRun();
      } else if (tries > 80) {
        clearInterval(poll);
      }
    }, 100);
  }

})();