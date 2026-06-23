(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     1. HTML DES WIDGETS — injecté directement dans le DOM
        (pas de fetch = pas de problème de timing)
  ────────────────────────────────────────────────────────── */
  var WIDGETS_HTML = `

<div class="overlay"></div>
<div class="cart-drawer">
  <div class="drawer-header">

    <h3>Your Cart</h3>
    <button class="close-drawer">✕</button>
  </div>

  <!-- ORDER TIMELINE — insert after .drawer-header in cart drawer, and after .cp-cart-header in cart page -->
<div class="bbw-order-timeline" id="bbw-order-timeline-drawer" style="display:none;">
  <div class="bbw-ot-line"></div>
  <div class="bbw-ot-step">
    <div class="bbw-ot-icon bbw-ot-icon--order animate-svg-order">
      <svg viewBox="0 0 122.88 112.75" xmlns="http://www.w3.org/2000/svg"><path d="M19.78,16.38h47.97c-0.64,2.13-1.05,4.35-1.22,6.65l-4.71-0.01h0l4.81,19.99h5.34c1.28,1.85,2.76,3.55,4.4,5.08h-8.51l4.08,16.99l11.76-1.6h0l-2.86-11.92c2.39,1.52,5,2.73,7.77,3.56l1.79,7.44l0.85-0.12c5.31-0.76,4.95,0.45,5.37-4.55l0.12-1.48c0.27,0.01,0.55,0.01,0.83,0.01c2,0,3.95-0.19,5.84-0.55l-0.53,6.82c-0.52,6.16-0.08,4.67-6.61,5.6l-59.96,7.63l3.17,9.21c26.01,0,38.59,0,64.59,0c0.88,3.27,2.06,8.59,2.94,12.24H96.26l-1.03-3.73c-21.67,0-29.93,0-51.61,0c-11.84-0.2-10.65,3-13.49-7.22L9.77,12.46H0V5.37h17.13C17.93,8.35,19.04,13.37,19.78,16.38L19.78,16.38z M97.56,0c13.98,0,25.32,11.34,25.32,25.32c0,13.98-11.34,25.32-25.32,25.32c-13.98,0-25.32-11.34-25.32-25.32C72.24,11.34,83.58,0,97.56,0L97.56,0z M86.36,25.99c0.34-1.97,2.59-3.07,4.36-2c0.16,0.1,0.31,0.21,0.46,0.34l0.01,0.01c0.8,0.76,1.69,1.56,2.57,2.34l0.76,0.68l9-9.44c0.54-0.56,0.93-0.93,1.74-1.11c2.76-0.61,4.7,2.77,2.75,4.83L96.79,33.43c-1.06,1.13-2.95,1.23-4.08,0.15c-0.65-0.6-1.36-1.22-2.07-1.84c-1.24-1.08-2.5-2.18-3.53-3.26C86.48,27.86,86.21,26.84,86.36,25.99L86.36,25.99L86.36,25.99z M46.92,96.19c4.57,0,8.28,3.71,8.28,8.29c0,4.58-3.71,8.28-8.28,8.28c-4.58,0-8.29-3.71-8.29-8.28C38.63,99.9,42.34,96.19,46.92,96.19L46.92,96.19z M81.09,96.19c4.57,0,8.28,3.71,8.28,8.29c0,4.58-3.71,8.28-8.28,8.28c-4.58,0-8.29-3.71-8.29-8.28C72.8,99.9,76.51,96.19,81.09,96.19L81.09,96.19z M26.92,43.01h13.19l-4.79-20.02c-4.71,0-9.37-0.01-13.92-0.01l1.61,5.99l0.05-0.01L26.92,43.01L26.92,43.01z M42.22,23l4.79,20.01h12.71l-4.81-20L42.22,23z M65.24,66l-4.3-17.9l-12.71,0l4.69,19.59L65.24,66z M46.22,68.59l-4.9-20.5H28.32l6.08,22.11L46.22,68.59z"/></svg>
    </div>
    <span class="bbw-ot-label">Order Today</span>
  </div>
  <div class="bbw-ot-step">
    <div class="bbw-ot-icon bbw-ot-icon--ship animate-svg-truck">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
    </div>
    <span class="bbw-ot-label">Order Shipped</span>
  </div>
  <div class="bbw-ot-step">
    <div class="bbw-ot-icon bbw-ot-icon--deliver animate-svg-deliver">
      <svg viewBox="0 0 505 511.62" xmlns="http://www.w3.org/2000/svg"><path d="m336.11 39.84-115.38 68.94 135.38 18.4 111.32-69.44-131.32-17.9zm26.72 204.57c73.79 0 133.6 59.82 133.6 133.61 0 73.78-59.81 133.6-133.6 133.6-73.79 0-133.6-59.82-133.6-133.6 0-73.79 59.81-133.61 133.6-133.61zm-34.4 114.76 19.91 18.66 45.73-46.46c4.46-4.53 7.28-8.18 12.79-2.51l17.88 18.33c5.88 5.81 5.58 9.22.04 14.62l-66.23 65.01c-11.66 11.46-9.64 12.15-21.48.41l-38.75-38.52c-2.47-2.68-2.19-5.37.51-8.06l20.75-21.52c3.15-3.3 5.64-3.02 8.85.04zm-123.6-233.04-.09 141.71-51.45-35.04-51.46 29.07 6.1-148.91-88.54-12.03v312.98l178.95 23.14c2.52 7.09 5.47 13.98 8.85 20.62L9.3 432.08c-5.17-.21-9.3-4.48-9.3-9.69V89.86c.27-4.05 1.89-6.89 5.72-8.81L182.48.85c1.58-.72 3.52-1.01 5.25-.77l308.18 42.04c5.09.59 8.58 4.77 8.58 9.99v.02L505 280.9c-5.72-8.46-15.57-20.29-19.93-27.77V69.56l-115.81 74.93v59.81a174.846 174.846 0 0 0-19.39.36v-58.82l-145.04-19.71zm-81.52-30.58 112.17-69.44-47.58-6.49L44.24 84.8l79.07 10.75z"/></svg>
    </div>
    <span class="bbw-ot-label">Delivered</span>
  </div>
</div>

  <div class="cart-drawer__body">
    <div class="cart-items"></div>
    <div class="empty-cart" style="display:none;">
      <div class="empty-cart__icon">🛒</div>
      <h3>Your cart is empty</h3>
      <p>Add products to start shopping.</p>
      <a href="/collections/bbw4life-all-product.html" class="cta button-3d">Shop Now</a>
    </div>
    <div class="reviews-carousel" id="cart-reviews-carousel"></div>
    <div class="marquee-container cart-marquee">
      <div class="marquee-content">
        <span>Free Shipping on Orders Over $350!</span>
        <span>Secure Checkout Guaranteed!</span>
        <span>30-Day Money Back Guarantee!</span>
        <span>Shop Now and Save Big!</span>
      </div>
    </div>
    <div class="payment-icons">
      <i class="fab fa-cc-visa"></i>
      <i class="fab fa-cc-mastercard"></i>
      <i class="fab fa-cc-paypal"></i>
      <i class="fab fa-cc-amex"></i>
      <i class="fab fa-cc-discover"></i>
      <i class="fab fa-cc-apple-pay"></i>
      <i class="fab fa-google-pay"></i>
      <i class="fab fa-cc-stripe"></i>
    </div>

    
    <div class="drawer-extra-section" id="drawer-extra-section" style="display:none;">
      <div class="drawer-extra-header">
        <span>You May Also Like</span>
      </div>
      <div class="drawer-extra-slider-wrap">
        <button class="drawer-extra-arrow drawer-extra-arrow--prev" id="drawer-extra-prev" aria-label="Previous">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div class="drawer-extra-viewport" id="drawer-extra-viewport">
          <div class="drawer-extra-track" id="drawer-extra-track"></div>
        </div>
        <button class="drawer-extra-arrow drawer-extra-arrow--next" id="drawer-extra-next" aria-label="Next">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div class="drawer-extra-dots" id="drawer-extra-dots"></div>
    </div>

  </div>

  <div class="cart-drawer__footer">
    <p class="subtotal">Subtotal: $0.00</p>
    <button class="checkout">Checkout</button>
  </div>

</div>



<div class="wishlist-modal">
  <div class="wishlist-modal-backdrop"></div>
  <div class="modal-content">
    <div class="wishlist-modal-shimmer"></div>
    <div class="drawer-header">
      <div class="wishlist-header-left">
        <div class="wishlist-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--rose)" stroke="var(--rose)" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <div>
          <h3>Your Wishlist</h3>
          <span class="wishlist-subtitle">Items you love</span>
        </div>
      </div>
      <button class="close-modal">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="wishlist-bar-row">
      <div class="wishlist-bar"><div class="wishlist-bar-fill"></div></div>
      <div class="wishlist-bar"><div class="wishlist-bar-fill"></div></div>
      <div class="wishlist-bar"><div class="wishlist-bar-fill"></div></div>
    </div>
    <div class="wishlist-items"></div>
    <div class="wishlist-footer">
      <button class="add-all-to-cart">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        Add All to Cart
      </button>
    </div>
    <div class="wishlist-share-footer">
      <span class="wishlist-share-label">Share your wishlist</span>
      <div class="wishlist-share-icons">
        <button class="wishlist-share-btn wishlist-share-btn--wa" data-wishlist-share="whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>
        <button class="wishlist-share-btn wishlist-share-btn--fb" data-wishlist-share="facebook" title="Share on Facebook"><i class="fab fa-facebook-f"></i></button>
        <button class="wishlist-share-btn wishlist-share-btn--tw" data-wishlist-share="twitter" title="Share on X / Twitter"><i class="fab fa-x-twitter"></i></button>
        <button class="wishlist-share-btn wishlist-share-btn--ig" data-wishlist-share="instagram" title="Copy link for Instagram"><i class="fab fa-instagram"></i></button>
        <button class="wishlist-share-btn wishlist-share-btn--pi" data-wishlist-share="pinterest" title="Share on Pinterest"><i class="fab fa-pinterest-p"></i></button>
      </div>
    </div>
  </div>
</div>


<div class="paul-indicator-wrapper">
  <a href="#" class="paul-indicator" id="paulTrigger">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
    <span class="paul-tooltip" id="paul-tooltip-text"></span>
  </a>
</div>


<div class="paul-popup-overlay" id="paulPopup">
  <div class="paul-popup">
    <span class="paul-close">×</span>
    <h2 class="paul-offer-title" id="paul-offer-title"></h2>
    <p class="paul-offer-subtitle" id="paul-offer-subtitle"></p>
    <div id="authContainer">
      <div id="loginForm" class="auth-form">
        <h3 id="paul-login-title"></h3>
        <input type="email" id="login-email" name="email" autocomplete="email" placeholder="Email" required>
        <div class="password-input-wrapper" style="position:relative !important;">
          <input type="password" id="login-password" name="password" autocomplete="current-password" placeholder="Password" required>
          <span class="password-toggle" data-target="login-password"><i class="fi fi-sr-eye"></i></span>
        </div>
        <label><input type="checkbox"> <span id="paul-remember-label"></span></label>
        <button type="button" class="paul-btn paul-btn-login" id="paul-login-btn"></button>
        <p class="switch-link"><span id="paul-login-switch"></span> <span id="goToSignup" style="cursor:pointer;"></span></p>
        <p class="switch-link" style="text-align:right; margin-top:6px;"><span id="goToForgot" style="cursor:pointer;"></span></p>
        <p class="paul-policy-link"><a href="/policies/privacy.html" target="_blank"><i class="fi fi-rr-shield-check"></i> Privacy Policy</a></p>
      </div>
      <div id="signupForm" class="auth-form" style="display:none;">
        <h3 id="paul-signup-title"></h3>
        <input type="text" placeholder="Last Name" autocomplete="family-name" required>
        <input type="text" placeholder="First Name" autocomplete="given-name" required>
        <input type="email" placeholder="Email" name="email" autocomplete="email" required>
        <input type="tel" placeholder="Phone (optional)" autocomplete="tel">
        <div class="password-input-wrapper" style="position:relative !important;">
          <input type="password" id="signup-password" name="password" autocomplete="new-password" placeholder="Password" required>
          <span class="password-toggle" data-target="signup-password"><i class="fi fi-sr-eye"></i></span>
        </div>
        <label><input type="checkbox"> <span id="paul-newsletter-label"></span></label>
        <button type="button" class="paul-btn paul-btn-register" id="paul-signup-btn"></button>
        <p class="switch-link"><span id="paul-signup-switch"></span> <span id="goToLogin" style="cursor:pointer;"></span></p>
        <p class="paul-policy-link"><a href="/policies/privacy.html" target="_blank"><i class="fi fi-rr-shield-check"></i> Privacy Policy</a></p>
      </div>
      <div id="forgotForm" class="auth-form" style="display:none;">
        <h3 id="paul-forgot-title"></h3>
        <input type="email" id="forgot-email" name="email" autocomplete="email" placeholder="" required>
        <div class="password-input-wrapper" style="position:relative !important;">
          <input type="password" id="forgot-new-password" name="new-password" autocomplete="new-password" placeholder="" required>
          <span class="password-toggle" data-target="forgot-new-password"><i class="fi fi-sr-eye"></i></span>
        </div>
        <div class="password-input-wrapper" style="position:relative !important;">
          <input type="password" id="forgot-confirm-password" name="confirm-password" autocomplete="new-password" placeholder="" required>
          <span class="password-toggle" data-target="forgot-confirm-password"><i class="fi fi-sr-eye"></i></span>
        </div>
        <p id="forgot-error-msg" style="color:#e74c3c; font-size:0.82rem; display:none; margin:6px 0;"></p>
        <p id="forgot-success-msg" style="color:#22a06b; font-size:0.82rem; display:none; margin:6px 0;"></p>
        <button type="button" class="paul-btn paul-btn-login" id="paul-forgot-btn"></button>
        <p class="switch-link" style="margin-top:10px;">
          <span id="goToLoginFromForgot" style="cursor:pointer; color:#e8bc6a; font-weight:600; border-bottom:1px solid rgba(232,188,106,0.35);">← Back to Login</span>
        </p>
      </div>
    </div>
  </div>
</div>


<div id="error-popup" class="error-popup hidden">
  <div class="popup-content">
    <p id="popup-message" class="popup-text"></p>
    <button id="popup-close" class="popup-btn">OK</button>
  </div>
</div>


<div id="floating-nav">
  <button class="fnav-toggle" id="fnav-toggle">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  </button>
  <div class="fnav-wheel" id="fnav-wheel">
    <button class="fnav-btn fnav-top" title="Scroll to top">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
    <button class="fnav-btn fnav-right" title="Next page" id="fnav-next">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
    <button class="fnav-btn fnav-bottom" title="Scroll to bottom">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <button class="fnav-btn fnav-left" title="Previous page">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <button class="fnav-btn fnav-refresh" title="Refresh">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    </button>
  </div>
</div>


<button id="cf-chat-toggle" aria-label="Open Curva Support Chat">
  <div class="cf-toggle-inner">
    <span class="cf-toggle-icon cf-icon-open">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="8.5" cy="10" r="1" fill="white"/>
        <circle cx="12" cy="10" r="1" fill="white"/>
        <circle cx="15.5" cy="10" r="1" fill="white"/>
      </svg>
    </span>
    <span class="cf-toggle-icon cf-icon-close" style="display:none">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </span>
  </div>
  <span class="cf-toggle-label">Curva Support</span>
  <span class="cf-notif-dot"></span>
</button>

<div id="cf-chat-widget">
  <div id="cf-chat-window" class="cf-chat-window" aria-hidden="true">
    <div class="cf-chat-header">
      <div class="cf-header-avatar">
        <img id="cf-agent-logo" src="" alt="Curva Support">
        <div class="cf-avatar-fallback">C</div>
        <span class="cf-online-dot"></span>
      </div>
      <div class="cf-header-info">
        <h3 id="cf-agent-name"></h3>
        <p id="cf-agent-title"></p>
      </div>
      <button class="cf-header-close" id="cf-close-btn" aria-label="Close chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="cf-quick-chips" id="cf-quick-chips"></div>
    <div class="cf-messages" id="cf-messages" role="log" aria-live="polite"></div>
    <div class="cf-typing" id="cf-typing" style="display:none">
      <div class="cf-typing-bubble"><span></span><span></span><span></span></div>
      <p id="cf-typing-label"></p>
    </div>
    <div class="cf-input-area">
      <div class="cf-input-wrapper">
        <textarea id="cf-input" rows="1" maxlength="500" aria-label="Chat message"></textarea>
        <button id="cf-send-btn" class="cf-send-btn" aria-label="Send message" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <p class="cf-input-hint" id="cf-powered-by"></p>
    </div>
  </div>
</div>


<div id="rc-popup-container" style="display:none;" aria-live="polite">
  <div id="rc-popup">
    <button id="rc-close" aria-label="Close">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>
    <div id="rc-popup-body">
      <div id="rc-avatar-wrap">
        <img id="rc-avatar-img" src="" alt="Support" style="display:none;">
        <video id="rc-avatar-video" autoplay muted loop playsinline style="display:none;"></video>
      </div>
      <div id="rc-content">
        <p id="rc-subtitle"></p>
        <p id="rc-title"></p>
        <p id="rc-description"></p>
      </div>
    </div>
    <div id="rc-count-badge">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span id="rc-count-text">3 items waiting</span>
    </div>
    <a href="/checkout/checkout.html" id="rc-checkout-btn">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M5 12H19M13 6L19 12L13 18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <span id="rc-btn-text">Complete My Purchase</span>
    </a>
    <div id="rc-urgency-bar"><div id="rc-urgency-fill"></div></div>
  </div>
</div>


<div id="snow-container" aria-hidden="true"></div>


<!-- ═══════════════════════════════════════════════════════
     BBW4LIFE — BIRTHDAY GIFT ICON + POPUP
     À insérer juste avant </body>
═══════════════════════════════════════════════════════ -->

<!-- PETAL BURST CANVAS (animation déclenchée au clic sur le bouton) -->
<canvas id="bbw-bday-canvas" aria-hidden="true"></canvas>

<!-- GIFT ICON FLOATING BUTTON -->
<button
  id="bbwBdayGiftBtn"
  class="bbw-bday-gift-btn"
  aria-label="Birthday surprise"
  title="A surprise for you 🎁"
>
  <!-- Badge notification -->
  <span class="bbw-bday-gift-dot" id="bbwBdayDot" aria-hidden="true"></span>

  <!-- Gift SVG -->
  <svg class="bbw-bday-gift-svg" viewBox="0 0 64 64" fill="none"
       xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- Boîte -->
    <rect x="8" y="28" width="48" height="30" rx="4"
          fill="url(#bday-box)" stroke="#b8871f" stroke-width="1.5"/>
    <!-- Couvercle -->
    <rect x="6" y="20" width="52" height="12" rx="4"
          fill="url(#bday-lid)" stroke="#b8871f" stroke-width="1.5"/>
    <!-- Ruban vertical -->
    <rect x="29" y="20" width="6" height="38" rx="2"
          fill="url(#bday-ribbon)"/>
    <!-- Ruban horizontal (sur couvercle) -->
    <rect x="6" y="24" width="52" height="4" rx="2"
          fill="url(#bday-ribbon)"/>
    <!-- Nœud gauche -->
    <ellipse cx="24" cy="20" rx="9" ry="5" transform="rotate(-30 24 20)"
             fill="url(#bday-bow)" stroke="#b8871f" stroke-width="1"/>
    <!-- Nœud droit -->
    <ellipse cx="40" cy="20" rx="9" ry="5" transform="rotate(30 40 20)"
             fill="url(#bday-bow)" stroke="#b8871f" stroke-width="1"/>
    <!-- Centre nœud -->
    <circle cx="32" cy="20" r="4" fill="#c0385e" stroke="#b8871f" stroke-width="1"/>
    <!-- Étoiles décoratives -->
    <circle cx="18" cy="38" r="1.8" fill="rgba(255,255,255,0.45)"/>
    <circle cx="46" cy="44" r="1.4" fill="rgba(255,255,255,0.35)"/>
    <circle cx="22" cy="50" r="1.2" fill="rgba(255,255,255,0.30)"/>
    <!-- Dégradés -->
    <defs>
      <linearGradient id="bday-box" x1="8" y1="28" x2="56" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="#c0385e"/>
        <stop offset="100%" stop-color="#7b3f6e"/>
      </linearGradient>
      <linearGradient id="bday-lid" x1="6" y1="20" x2="58" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="#d4506e"/>
        <stop offset="100%" stop-color="#9b4f7e"/>
      </linearGradient>
      <linearGradient id="bday-ribbon" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#e8bc6a"/>
        <stop offset="100%" stop-color="#c9963e"/>
      </linearGradient>
      <linearGradient id="bday-bow" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#f0d080"/>
        <stop offset="100%" stop-color="#c9963e"/>
      </linearGradient>
    </defs>
  </svg>

  <!-- Pulse ring -->
  <span class="bbw-bday-gift-ring" aria-hidden="true"></span>
</button>


<!-- ═══════════════════════════════════════════
     BIRTHDAY POPUP OVERLAY
═══════════════════════════════════════════ -->
<div id="bbwBdayOverlay"
     class="bbw-bday-overlay"
     role="dialog"
     aria-modal="true"
     aria-label="Birthday surprise"
     aria-hidden="true">

  <!-- Modal -->
  <div class="bbw-bday-modal" id="bbwBdayModal">

    <!-- Particules internes -->
    <div class="bbw-bday-modal-particles" id="bbwBdayModalPtcl" aria-hidden="true"></div>

    <!-- Confettis internes -->
    <div class="bbw-bday-confetti-wrap" id="bbwBdayConfetti" aria-hidden="true"></div>

    <!-- Bouton fermer -->
    <button class="bbw-bday-close" id="bbwBdayClose" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" width="16" height="16">
        <line x1="18" y1="6"  x2="6"  y2="18"/>
        <line x1="6"  y1="6"  x2="18" y2="18"/>
      </svg>
    </button>

    <!-- ── HEADER : Marquee ── -->
    <div class="bbw-bday-marquee-wrap" aria-hidden="true">
      <div class="bbw-bday-marquee-track" id="bbwBdayMarquee">
        <!-- Injecté par JS depuis settings -->
      </div>
    </div>

    <!-- ── Ballons décoratifs ── -->
    <div class="bbw-bday-balloons" aria-hidden="true">
      <span class="bbw-bday-balloon bbw-bday-balloon--1">🎈</span>
      <span class="bbw-bday-balloon bbw-bday-balloon--2">🎉</span>
      <span class="bbw-bday-balloon bbw-bday-balloon--3">🎂</span>
      <span class="bbw-bday-balloon bbw-bday-balloon--4">🎈</span>
      <span class="bbw-bday-balloon bbw-bday-balloon--5">✨</span>
    </div>

    <!-- ── BODY : Carousel de cards clients ── -->
    <div class="bbw-bday-body">

      <!-- Titre principal -->
      <div class="bbw-bday-title-wrap">
        <span class="bbw-bday-cake-icon" aria-hidden="true">🎂</span>
        <h2 class="bbw-bday-main-title">Happy Birthday!</h2>
        <span class="bbw-bday-cake-icon" aria-hidden="true">🎂</span>
      </div>

      <!-- Carousel -->
      <div class="bbw-bday-carousel-wrap">
        <div class="bbw-bday-carousel" id="bbwBdayCarousel">
          <!-- Cards injectées par JS -->
          <!-- Placeholder si aucun anniversaire aujourd'hui -->
          <div class="bbw-bday-card bbw-bday-card--placeholder" id="bbwBdayPlaceholder">
            <div class="bbw-bday-avatar bbw-bday-avatar--placeholder">🎁</div>
            <p class="bbw-bday-no-bday">
              No birthdays today — but yours could be next!
            </p>
          </div>
        </div>

        <!-- Dots navigation (injectés par JS si > 1 carte) -->
        <div class="bbw-bday-dots" id="bbwBdayDots" aria-label="Birthday cards navigation"></div>

        <!-- Flèches (injectées si > 1 carte) -->
        <button class="bbw-bday-arrow bbw-bday-arrow--prev" id="bbwBdayPrev" aria-label="Previous">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="16" height="16">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button class="bbw-bday-arrow bbw-bday-arrow--next" id="bbwBdayNext" aria-label="Next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="16" height="16">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

    </div>

    <!-- ── FOOTER : Bouton subscribe ── -->
    <div class="bbw-bday-footer">
      <button class="bbw-bday-subscribe-btn" id="bbwBdaySubscribeBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" width="16" height="16">
          <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        <span id="bbwBdaySubBtnText">My Birthday Is Coming — Subscribe!</span>
      </button>
      <p class="bbw-bday-footer-note">
        Subscribe with your birthday and get an exclusive discount 🎁
      </p>
    </div>

  </div>
</div>
<!-- ═══ END BIRTHDAY GIFT ═══ -->


`;

  /* ──────────────────────────────────────────────────────────
     2. INJECTION SYNCHRONE dans le DOM
        → les éléments existent AVANT que script.js soit lu
  ────────────────────────────────────────────────────────── */
  var container = document.createElement('div');
  container.id  = 'bbw-widgets-root';
  container.innerHTML = WIDGETS_HTML;

  // Injecte juste avant </body> — synchrone, pas de fetch
  document.body.appendChild(container);

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