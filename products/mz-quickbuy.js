/* ================================================================
   MEDIA ZOOM — QUICK BUY MOBILE (mz-quickbuy)
   Panneau quantité + add-to-cart + taille + couleur affiché sous
   l'image du zoom plein écran mobile (#media-zoom-modal). Ne contient
   AUCUNE logique panier propre : chaque interaction pilote les VRAIS
   champs de .product-section (input quantité, #size-select, .swatch),
   puis déclenche le vrai bouton .add-to-cart existant (script.js) —
   c'est ce bouton réel qui ajoute au panier, avec sa logique inchangée.

   Swipe entre images : glisser horizontalement sur l'image du modal
   change d'image (comme les points/miniatures du slider principal),
   MAIS seulement quand l'image n'est pas zoomée (scale === 1) — sinon
   le geste déplace l'image zoomée, comportement déjà existant dans
   script.js (touchmove sur #modal-zoom-image quand scale > 1).
================================================================ */
(function () {
  'use strict';

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const modal      = document.getElementById('media-zoom-modal');
    const modalImg    = document.getElementById('modal-zoom-image');
    const quickbuy    = document.getElementById('mzQuickbuy');
    if (!modal || !modalImg || !quickbuy) return;

    const realQtyInput   = document.querySelector('.quantity-add-wrapper .quantity input');
    const realSizeSelect = document.getElementById('size-select');
    const realAddBtn     = document.querySelector('.quantity-add-wrapper .add-to-cart');
    const mainSlider     = document.getElementById('main-image-slider');

    const mzQtyInput   = document.getElementById('mzQtyInput');
    const mzQtyMinus    = document.getElementById('mzQtyMinus');
    const mzQtyPlus     = document.getElementById('mzQtyPlus');
    const mzAddBtn      = document.getElementById('mzAddToCart');
    const mzSizeSelect  = document.getElementById('mzSizeSelect');
    const mzColorSelect = document.getElementById('mzColorSelect');
    const mzColorPreview= document.getElementById('mzColorPreview');

    /* ── Quantité : reflète et pilote le vrai champ ── */
    function syncQtyFromReal() {
      if (realQtyInput && mzQtyInput) mzQtyInput.value = realQtyInput.value || '1';
    }
    function pushQtyToReal(value) {
      if (!realQtyInput) return;
      realQtyInput.value = value;
      realQtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      realQtyInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (mzQtyInput) {
      mzQtyInput.addEventListener('change', function () {
        let v = parseInt(mzQtyInput.value, 10);
        if (!v || v < 1) v = 1;
        mzQtyInput.value = v;
        pushQtyToReal(v);
      });
    }
    if (mzQtyMinus) {
      mzQtyMinus.addEventListener('click', function () {
        let v = Math.max(1, (parseInt(mzQtyInput.value, 10) || 1) - 1);
        mzQtyInput.value = v;
        pushQtyToReal(v);
      });
    }
    if (mzQtyPlus) {
      mzQtyPlus.addEventListener('click', function () {
        let v = (parseInt(mzQtyInput.value, 10) || 1) + 1;
        mzQtyInput.value = v;
        pushQtyToReal(v);
      });
    }

    /* ── Taille : reflète et pilote le vrai <select> — masqué si le
       produit n'a aucune taille (select réel vide, cf. products.js qui
       ne remplit l'option que si product.sizes existe). ── */
    function syncSizeOptionsFromReal() {
      if (!realSizeSelect || !mzSizeSelect) return;
      const mzSizeField = mzSizeSelect.closest('.mz-quickbuy__field');
      if (!realSizeSelect.options.length) {
        if (mzSizeField) mzSizeField.style.display = 'none';
        return;
      }
      if (mzSizeField) mzSizeField.style.display = '';
      mzSizeSelect.innerHTML = realSizeSelect.innerHTML;
      mzSizeSelect.value = realSizeSelect.value;
    }
    if (mzSizeSelect) {
      mzSizeSelect.addEventListener('change', function () {
        if (!realSizeSelect) return;
        realSizeSelect.value = mzSizeSelect.value;
        realSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    // Le vrai select est rempli de façon asynchrone (fetch products.data.json
    // dans products.js) — on observe son remplissage pour copier les options
    // dès qu'elles existent, sans dépendre d'un timing arbitraire.
    if (realSizeSelect) {
      const sizeObserver = new MutationObserver(syncSizeOptionsFromReal);
      sizeObserver.observe(realSizeSelect, { childList: true });
      realSizeSelect.addEventListener('change', syncSizeOptionsFromReal);
    }

    /* ── Couleur : liste construite depuis les vrais .swatch, sélection
       déclenche un vrai clic sur la swatch correspondante (réutilise
       intégralement setupColorListeners() de products.js — aucune
       logique de couleur dupliquée ici). ── */
    function syncColorOptionsFromReal() {
      if (!mzColorSelect) return;
      const mzColorField = mzColorSelect.closest('.mz-quickbuy__field');
      const swatches = document.querySelectorAll('.color-swatches .swatch');
      if (!swatches.length) {
        if (mzColorField) mzColorField.style.display = 'none';
        return;
      }
      if (mzColorField) mzColorField.style.display = '';
      mzColorSelect.innerHTML = '';
      swatches.forEach(function (sw) {
        const opt = document.createElement('option');
        opt.value = sw.dataset.color || '';
        opt.textContent = sw.dataset.color || '';
        if (sw.classList.contains('active')) opt.selected = true;
        mzColorSelect.appendChild(opt);
      });
      updateColorPreview();
    }
    function updateColorPreview() {
      if (!mzColorSelect || !mzColorPreview) return;
      const swatches = document.querySelectorAll('.color-swatches .swatch');
      let match = null;
      swatches.forEach(function (sw) {
        if (sw.dataset.color === mzColorSelect.value) match = sw;
      });
      const img = match ? match.dataset.image : '';
      if (img) {
        mzColorPreview.src = img;
        mzColorPreview.classList.add('is-visible');
      } else {
        mzColorPreview.classList.remove('is-visible');
      }
    }
    if (mzColorSelect) {
      mzColorSelect.addEventListener('change', function () {
        const swatches = document.querySelectorAll('.color-swatches .swatch');
        swatches.forEach(function (sw) {
          if (sw.dataset.color === mzColorSelect.value) sw.click();
        });
        updateColorPreview();
      });
    }
    const colorContainer = document.querySelector('.color-swatches');
    if (colorContainer) {
      const colorObserver = new MutationObserver(syncColorOptionsFromReal);
      colorObserver.observe(colorContainer, { childList: true, attributes: true, subtree: true, attributeFilter: ['class'] });
    }

    /* ── Add to cart : déclenche le vrai bouton (déjà synchronisé via
       les champs ci-dessus au moment du clic). ── */
    if (mzAddBtn) {
      mzAddBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (realAddBtn) realAddBtn.click();
      });
    }

    /* ── Ouverture du modal : resynchronise tout depuis les vrais champs ── */
    const modalObserver = new MutationObserver(function () {
      if (modal.classList.contains('active') && isMobile()) {
        syncQtyFromReal();
        syncSizeOptionsFromReal();
        syncColorOptionsFromReal();
        modal.classList.remove('mz-gesture-active');
      }
    });
    modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });

    /* ── Icône loupe : indique qu'on peut recliquer pour zoomer davantage ;
       cliquer dessus déclenche exactement le même zoom qu'un clic sur
       l'image (réutilise le handler 'click' déjà posé sur modalImg par
       script.js — aucune logique de zoom dupliquée ici). ── */
    const zoomHintBtn = document.getElementById('mzZoomHintBtn');
    if (zoomHintBtn) {
      zoomHintBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        modalImg.click();
      });
    }

    /* ── Swipe entre images (uniquement si scale === 1, cf. en-tête) ──
       On lit la transform actuelle de #modal-zoom-image pour savoir si
       elle est zoomée, plutôt que de dupliquer la variable `scale`
       interne à script.js (fermée dans une IIFE, non exposée). ── */
    function isZoomed() {
      const t = modalImg.style.transform || '';
      const m = t.match(/scale\(([\d.]+)\)/);
      return m ? parseFloat(m[1]) > 1.01 : false;
    }

    let swipeStartX = 0, swipeStartY = 0, swiping = false;

    /* ── Masquage du panneau + icône loupe dès que l'image passe en état
       ZOOMÉ (scale > 1). On ne réagit qu'aux transitions réelles début/fin
       de geste (touchstart/touchend) plutôt qu'à chaque frame de pan via
       MutationObserver sur le style inline — celui-ci se déclenchait à
       haute fréquence pendant le drag (script.js réécrit style.transform
       à chaque touchmove) et ralentissait l'interaction. ── */
    modalImg.addEventListener('touchstart', function () {
      if (isZoomed()) modal.classList.add('mz-gesture-active');
    }, { passive: true });
    modalImg.addEventListener('touchend', function () {
      modal.classList.remove('mz-gesture-active');
    }, { passive: true });
    modalImg.addEventListener('touchcancel', function () {
      modal.classList.remove('mz-gesture-active');
    }, { passive: true });
    modalImg.addEventListener('click', function () {
      // Un clic simple (sans drag) bascule directement scale 1 <-> 2.5
      // dans script.js — resynchronise l'état juste après ce toggle.
      setTimeout(function () {
        modal.classList.toggle('mz-gesture-active', isZoomed());
      }, 0);
    });

    modalImg.addEventListener('touchstart', function (e) {
      if (isZoomed() || e.touches.length > 1) { swiping = false; return; }
      swiping = true;
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
    }, { passive: true });

    modalImg.addEventListener('touchend', function (e) {
      if (!swiping) return;
      swiping = false;
      const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : swipeStartX;
      const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : swipeStartY;
      const dx = endX - swipeStartX;
      const dy = endY - swipeStartY;
      const SWIPE_THRESHOLD = 40;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      if (typeof window.changeMainImage !== 'function') return;
      // Réutilise intégralement la navigation du slider principal (gère
      // miniatures, compteur, vidéos) — swipe gauche = image suivante,
      // droite = précédente, comme un carrousel classique.
      window.changeMainImage(dx < 0 ? 'next' : 'prev');
      if (!mainSlider) return;
      const activeContainer = mainSlider.querySelector('.main-image.active');
      const activeImg = activeContainer ? activeContainer.querySelector('img') : null;
      if (!activeImg) return;
      const rawSrc = activeImg.currentSrc || activeImg.src;
      modalImg.src = typeof upgradeShopifyImageUrl === 'function' ? upgradeShopifyImageUrl(rawSrc, 1400) : rawSrc;
    }, { passive: true });
  });
})();
