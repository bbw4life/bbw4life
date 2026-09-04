/* ============================================================
   BBW4LIFE — 404-extra.js
   ============================================================ */

'use strict';


(function () {
  fetch('/products.data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var settings    = (Array.isArray(data) ? data : []).find(function (p) { return p.type === 'settings'; }) || {};
      var socialLinks = settings.social_links || {};

      
      var socialMap = {
        facebook:  socialLinks.facebook,
        instagram: socialLinks.instagram,
        tiktok:    socialLinks.tiktok,
        youtube:   socialLinks.youtube,
        pinterest: socialLinks.pinterest,
        whatsapp:  socialLinks.whatsapp,
        twitter:   socialLinks.twitter
      };

      
      document.querySelectorAll('[data-social]').forEach(function (el) {
        var key = el.dataset.social;
        if (socialMap[key]) el.href = socialMap[key];
      });

      
      var threshold = (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold) || 140;
      document.querySelectorAll('.hdr-free-shipping-threshold').forEach(function (el) {
        el.textContent = threshold;
      });
    })
    .catch(function () {
      
    });
})();