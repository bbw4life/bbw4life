(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════════════
     SKELETON SCREENS — placeholders qui imitent la structure réelle
     de chaque zone injectée en JS, pour combler le court instant entre
     la disparition du preloader global (script.js, IIFE "BBW4LIFE
     PRELOADER") et l'injection du vrai contenu (script.js, products.js,
     etc.). Le preloader plein écran n'est pas touché — ce module ne
     gère que ce qui se passe APRÈS sa disparition.

     Principe : chaque skeleton réutilise les VRAIES classes CSS du
     composant final (ex: .bbw-nb-card, .story-circle-ring,
     .bbwpg-card) pour que ses dimensions (aspect-ratio, largeur,
     hauteur) soient garanties identiques au contenu réel — pas de
     valeurs pixel dupliquées à la main qui risqueraient de désynchro-
     niser skeleton et design réel si celui-ci change plus tard. Seul
     le contenu interne (image, texte) est remplacé par un bloc
     shimmer (.skel-shimmer), et une classe .is-skeleton désactive les
     interactions/animations du composant réel le temps du placeholder.

     Retrait : chaque skeleton disparaît par simple écrasement de
     innerHTML au moment où le vrai contenu est injecté (aucun retrait
     manuel séparé nécessaire) — donc aucun setTimeout arbitraire.
  ════════════════════════════════════════════════════════════════ */

  var SKEL_ATTR = 'data-skel';

  /** Construit N nœuds `count` fois via `builder(i)` et les ajoute à `container`, seulement si container est vide (évite d'empiler un skeleton par-dessus un vrai contenu déjà là — utile si ce script s'exécute après coup sur une page déjà en cache). */
  function fillIfEmpty(container, count, builder) {
    if (!container) return;
    if (container.children.length > 0) return;
    container.setAttribute(SKEL_ATTR, 'yes');
    for (var i = 0; i < count; i++) {
      container.appendChild(builder(i));
    }
  }

  function shimmerDiv(extraClass) {
    var d = document.createElement('div');
    d.className = 'skel-shimmer' + (extraClass ? ' ' + extraClass : '');
    return d;
  }

  /* ── Story circles / story rows (cercles produits/collections) ── */
  function buildStoryCircleSkeleton() {
    var a = document.createElement('div');
    a.className = 'story-circle-item is-skeleton';
    var ring = document.createElement('div');
    ring.className = 'story-circle-ring';
    ring.style.background = 'transparent';
    ring.appendChild(shimmerDiv('skel-circle'));
    var label = shimmerDiv('skel-line skel-line--xs');
    a.appendChild(ring);
    a.appendChild(label);
    return a;
  }

  function initStoryTrackSkeletons() {
    ['storyCirclesTrack', 'storyRowWomenTrack', 'storyRowMenTrack'].forEach(function (id) {
      var el = document.getElementById(id);
      fillIfEmpty(el, 8, buildStoryCircleSkeleton);
    });
  }

  /* ── BBW Featured grid (.bbw-nb-grid, cartes 1:1) ── */
  function buildNbCardSkeleton() {
    var card = document.createElement('div');
    card.className = 'bbw-nb-card is-skeleton';
    var media = document.createElement('div');
    media.className = 'bbw-nb-card__media';
    media.appendChild(shimmerDiv());
    card.appendChild(media);
    return card;
  }

  function initNbGridSkeleton() {
    fillIfEmpty(document.getElementById('bbw-nb-grid'), 4, buildNbCardSkeleton);
  }

  /* ── Carrousel produit (.bbwpg-track, ratio 138% type "padding-top") ── */
  function buildPgCardSkeleton() {
    var card = document.createElement('div');
    card.className = 'bbwpg-card is-skeleton';
    var imgWrap = document.createElement('div');
    imgWrap.className = 'bbwpg-card__img-wrap';
    imgWrap.appendChild(shimmerDiv('skel-abs-fill'));
    var body = document.createElement('div');
    body.className = 'bbwpg-card__body skel-card-body';
    body.appendChild(shimmerDiv('skel-line'));
    body.appendChild(shimmerDiv('skel-line skel-line--sm'));
    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  function initPgTrackSkeleton() {
    fillIfEmpty(document.getElementById('bbwpg-track'), 4, buildPgCardSkeleton);
  }

  /* ── Collection slider best-sellers (#csTrack, cartes .cs-card) ── */
  function buildCsCardSkeleton() {
    var card = document.createElement('div');
    card.className = 'cs-card is-skeleton';
    var media = document.createElement('div');
    media.className = 'cs-media';
    media.appendChild(shimmerDiv('skel-abs-fill'));
    var body = document.createElement('div');
    body.className = 'skel-card-body';
    body.appendChild(shimmerDiv('skel-line'));
    body.appendChild(shimmerDiv('skel-line skel-line--sm'));
    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function initCsTrackSkeleton() {
    fillIfEmpty(document.getElementById('csTrack'), 4, buildCsCardSkeleton);
  }

  /* ── Galerie collections (.jrgq-gallery-mosaic) — hauteur déjà réservée par grid-template-rows, on ajoute juste un shimmer par cellule ── */
  function buildGalItemSkeleton(i) {
    var item = document.createElement('div');
    item.className = 'jrgq-gal-item jrgq-gal-item--' + (i + 1) + ' is-skeleton';
    item.appendChild(shimmerDiv('skel-abs-fill'));
    return item;
  }

  function initGalleryMosaicSkeleton() {
    fillIfEmpty(document.getElementById('jrgq-gallery-mosaic'), 5, buildGalItemSkeleton);
  }

  /* ── Hero banner : le HTML statique a déjà une image de fallback
     (#bbwHeroImagesPlaceholder) donc pas de vide à combler pour le
     média ; seuls les textes (#bbwHeroContent, remplis en JS) peuvent
     être vides un court instant. On shimmer ces lignes de texte
     seulement si elles sont encore vides. Retrait automatique dès que
     le texte réel est posé (MutationObserver sur le contenu), sans
     dépendre d'un event dédié par page à faire dispatcher partout où
     du texte est rempli en JS. ── */
  // Filet de sécurité : si un élément reste vide indéfiniment (donnée
  // absente par design, ou échec silencieux), on ne laisse pas le
  // shimmer tourner pour toujours — cf. règle "ne pas masquer les
  // erreurs indéfiniment" de la mission.
  var TEXT_FILL_TIMEOUT_MS = 4000;

  function watchTextFillEl(el, extraClass) {
    if (!el || el.textContent.trim() !== '') return;
    el.classList.add('skel-text-loading');
    if (extraClass) el.classList.add(extraClass);
    var done = false;
    function clear() {
      if (done) return;
      done = true;
      el.classList.remove('skel-text-loading');
      if (extraClass) el.classList.remove(extraClass);
      obs.disconnect();
    }
    var obs = new MutationObserver(function () {
      if (el.textContent.trim() !== '') clear();
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    setTimeout(clear, TEXT_FILL_TIMEOUT_MS);
  }

  function watchTextFill(id) {
    watchTextFillEl(document.getElementById(id));
  }

  function initHeroTextSkeleton() {
    ['bbwHeroEyebrow', 'bbwHeroTitle', 'bbwHeroSubtitle', 'bbwHeroText'].forEach(watchTextFill);
  }

  /* ── Featured spotlight (.fs-main-img / .fs-thumb) — images vides ──
     Ces <img> existent déjà dans le HTML statique (pas recréées par le
     JS, qui se contente de poser .src dessus) : le skeleton doit donc
     être retiré via l'event load/error de l'image elle-même, pas par
     un écrasement d'innerHTML qui n'arrive jamais ici. */
  function initFeaturedSpotlightSkeleton() {
    var frame = document.querySelector('.fs-img-frame');
    if (frame && !frame.querySelector('.skel-shimmer')) {
      var mainImg = frame.querySelector('.fs-main-img');
      if (mainImg && !mainImg.getAttribute('src')) {
        frame.classList.add('is-skeleton');
        var shim = shimmerDiv('skel-abs-fill');
        frame.appendChild(shim);
        var clear = function () {
          frame.classList.remove('is-skeleton');
          if (shim.parentNode) shim.parentNode.removeChild(shim);
        };
        mainImg.addEventListener('load', clear, { once: true });
        mainImg.addEventListener('error', clear, { once: true });
      }
    }
    document.querySelectorAll('.fs-mini-gallery .fs-thumb').forEach(function (thumb) {
      if (!thumb.getAttribute('src') && thumb.parentElement) {
        var wrap = thumb.parentElement;
        wrap.classList.add('is-skeleton-thumb');
        var clearThumb = function () { wrap.classList.remove('is-skeleton-thumb'); };
        thumb.addEventListener('load', clearThumb, { once: true });
        thumb.addEventListener('error', clearThumb, { once: true });
      }
    });
  }

  /* ── Product page : galerie image principale + miniatures ── */
  function initProductGallerySkeleton() {
    var mainSlider = document.getElementById('main-image-slider');
    fillIfEmpty(mainSlider, 1, function () {
      var d = document.createElement('div');
      d.className = 'skel-abs-fill skel-shimmer is-skeleton';
      return d;
    });
    var thumbs = document.getElementById('product-thumbnails');
    fillIfEmpty(thumbs, 4, function () {
      var d = document.createElement('div');
      d.className = 'skel-thumb-placeholder skel-shimmer is-skeleton';
      return d;
    });
  }

  /* ── Collections (.col-hero image + #colGrid cartes .col-product-card) ── */
  function buildColCardSkeleton() {
    var card = document.createElement('div');
    card.className = 'col-product-card is-skeleton';
    var media = document.createElement('div');
    media.className = 'col-card__media';
    media.appendChild(shimmerDiv('skel-abs-fill'));
    var info = document.createElement('div');
    info.className = 'skel-card-body';
    info.appendChild(shimmerDiv('skel-line'));
    info.appendChild(shimmerDiv('skel-line skel-line--sm'));
    card.appendChild(media);
    card.appendChild(info);
    return card;
  }

  function initCollectionsSkeleton() {
    fillIfEmpty(document.getElementById('colGrid'), 9, buildColCardSkeleton);

    var heroImg = document.getElementById('colHeroImage');
    if (heroImg && !heroImg.getAttribute('src')) {
      var wrap = heroImg.parentElement; // .col-hero__media, déjà position:relative en CSS
      if (wrap) {
        var shim = shimmerDiv('skel-abs-fill');
        wrap.appendChild(shim);
        var clear = function () { if (shim.parentNode) shim.parentNode.removeChild(shim); };
        heroImg.addEventListener('load', clear, { once: true });
        heroImg.addEventListener('error', clear, { once: true });
      }
    }

    ['colHeroEyebrow', 'colHeroTitle', 'colHeroSubtitle'].forEach(watchTextFill);
  }

  /* ── Blog hub (blog/blog.html) : #blog-grid-container, cartes
     .blog-card. Le HTML des vraies cartes n'existe qu'en template JS
     (blog.js), donc contrairement aux autres skeletons on ne peut pas
     réutiliser une classe déjà stylée pour l'image — on reproduit ici
     .blog-card-img-wrap (aspect-ratio 4/4 défini dans blog.css) pour
     garder la bonne proportion. ── */
  function buildBlogCardSkeleton() {
    var card = document.createElement('article');
    card.className = 'blog-card is-skeleton';
    var imgWrap = document.createElement('div');
    imgWrap.className = 'blog-card-img-wrap';
    imgWrap.appendChild(shimmerDiv('skel-abs-fill'));
    var body = document.createElement('div');
    body.className = 'blog-card-body skel-card-body';
    body.appendChild(shimmerDiv('skel-line'));
    body.appendChild(shimmerDiv('skel-line skel-line--sm'));
    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  function initBlogHubSkeleton() {
    fillIfEmpty(document.getElementById('blog-grid-container'), 6, buildBlogCardSkeleton);
  }

  /* ── Article individuel (blog/articleN.html) : #related-grid, cartes
     .related-card (classe partagée par tous les articles via
     article-featured.css, aspect-ratio 4/4). Le corps de l'article
     lui-même est statique (pas de skeleton nécessaire — cf. rapport
     d'analyse), seul ce bloc "articles liés" est injecté en JS. ── */
  function buildRelatedCardSkeleton() {
    var card = document.createElement('div');
    card.className = 'related-card is-skeleton';
    var imgWrap = document.createElement('div');
    imgWrap.className = 'related-card__img-wrap';
    imgWrap.appendChild(shimmerDiv('skel-abs-fill'));
    var body = document.createElement('div');
    body.className = 'related-card__body skel-card-body';
    body.appendChild(shimmerDiv('skel-line'));
    body.appendChild(shimmerDiv('skel-line skel-line--sm'));
    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  function initArticleSkeleton() {
    fillIfEmpty(document.getElementById('related-grid'), 3, buildRelatedCardSkeleton);
  }

  /* ── Compteurs statistiques génériques (data-stat-text), présents sur
     de nombreuses pages statiques (about, our-story, contact, index
     via .jrgq-gstat, etc.), remplis par script.js. Pas de risque de
     layout shift ici (chiffre en ligne dans une phrase), mais on évite
     quand même d'afficher un vide sec pendant l'attente. ── */
  function initStatTextSkeletons() {
    document.querySelectorAll('[data-stat-text]').forEach(function (el) {
      watchTextFillEl(el, 'skel-text-loading--inline');
    });
  }

  /* ── Init global : à appeler après la disparition du preloader (ou
     immédiatement si le preloader est déjà absent — page revisitée
     avec cache, ou preloader désactivé dans les settings). ── */
  function initSkeletons() {
    initStoryTrackSkeletons();
    initNbGridSkeleton();
    initPgTrackSkeleton();
    initCsTrackSkeleton();
    initGalleryMosaicSkeleton();
    initHeroTextSkeleton();
    initFeaturedSpotlightSkeleton();
    initProductGallerySkeleton();
    initCollectionsSkeleton();
    initBlogHubSkeleton();
    initArticleSkeleton();
    initStatTextSkeletons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkeletons);
  } else {
    initSkeletons();
  }

  window.BBW_SKELETON = { init: initSkeletons };
})();
