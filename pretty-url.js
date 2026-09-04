(function () {
  var SLUGS = {
    // ── PRODUCTS ──────────────────────────────────────────
    '/products/product1.html':  '/bbw4life/glam-heels-cross-strap-stiletto-sandals',
    '/products/product2.html':  '/bbw4life/retrorun-sneakers-chunky-sole-street-style',
    '/products/product3.html':  '/bbw4life/bohoflip-sandals-embroidered-boho-flip-flops',
    '/products/product4.html':  '/bbw4life/powerheels-12cm-stiletto-pumps',
    '/products/product5.html':  '/bbw4life/winterboost-boots-ankle-boots',
    '/products/product6.html':  '/bbw4life/colorstilettos-vibrant-stiletto-flip-flops',
    '/products/product7.html':  '/bbw4life/nightchic-dress-mock-neck-long-sleeve-printed',
    '/products/product8.html':  '/bbw4life/slitlux-dress-cutout-slit-round-neck',
    '/products/product9.html':  '/bbw4life/plaidoverall-dress-wide-strap-dungaree',
    '/products/product10.html': '/bbw4life/floralflounce-dress-surplice-flounce-sleeve-maxi',
    '/products/product11.html': '/bbw4life/vintagesquare-dress-printed-square-neck',
    '/products/product12.html': '/bbw4life/paisleybelt-dress-orange-floral-print-belted',
    '/products/product13.html': '/bbw4life/meshduo-set-sheer-mesh-long-dress-suit',
    '/products/product14.html': '/bbw4life/meshglam-dress-solid-color-stitching-maxi',
    '/products/product15.html': '/bbw4life/linenbreeze-dress-cotton-linen-button-down',
    '/products/product16.html': '/bbw4life/stripedmini-dress-vneck-long-sleeve',
    '/products/product17.html': '/bbw4life/loungerobe-loose-sleepwear-bathrobe',
    '/products/product18.html': '/bbw4life/lacenight-dress-sexy-short-strap-lace-nightdress',
    '/products/product19.html': '/bbw4life/lacethong-set-sheer-lace-skirt-lingerie',
    '/products/product20.html': '/bbw4life/solidsexy-bikini-high-waist-hot-swimsuit',
    '/products/product21.html': '/bbw4life/curvebikini-solid-color-high-waist-swimwear',
    '/products/product22.html': '/bbw4life/leopardnight-set-mesh-pajama-lingerie-dress',
    '/products/product23.html': '/bbw4life/supportbra-large-cup-breathable-mesh-bra',
    '/products/product24.html': '/bbw4life/laceromper-jumpsuit-lace-splicing-thong',
    '/products/product25.html': '/bbw4life/stripedbikini-print-striped-swimwear',
    '/products/product26.html': '/bbw4life/tubebikinii-tube-top-swimsuit',
    '/products/product27.html': '/bbw4life/ruffleone-bikini-vneck-ruffled-one-piece',
    '/products/product28.html': '/bbw4life/bandagebikini-solid-color-bandage-swimsuit',
    '/products/product29.html': '/bbw4life/contrastone-piece-contrasting-color-swimwear',
    '/products/product30.html': '/bbw4life/premiumbikini-plus-size-swimsuit-collection',
    '/products/product31.html': '/bbw4life/irregulartop-loose-round-neck-irregular-hem',
    '/products/product32.html': '/bbw4life/christmassweat-casual-holiday-sweatshirt',
    '/products/product33.html': '/bbw4life/dalmationshorts-high-waist-dalmatian-print',
    '/products/product34.html': '/bbw4life/leopardshirt-irregular-collar-spliced-blouse',
    '/products/product35.html': '/bbw4life/drawstringpants-casual-pants-with-pockets',
    '/products/product36.html': '/bbw4life/cropslimpants-mens-drawstring-cropped-pants',
    '/products/product37.html': '/bbw4life/haremprints-printed-harem-trousers-men',
    '/products/product38.html': '/bbw4life/loosejeans-mens-relaxed-fit-denim',
    '/products/product39.html': '/bbw4life/britishloafers-formal-tassel-party-shoes-men',
    '/products/product40.html': '/bbw4life/airmesh-runners-professional-sports-sneakers-men',
    '/products/product41.html': '/bbw4life/leathercasuals-mens-breathable-flat-sneakers',
    '/products/product42.html': '/bbw4life/businessdress-shoes-classic-wedding-formal',
    '/products/product43.html': '/bbw4life/hollowsneakers-mesh-big-size-fashion-shoes-men',
    '/products/product44.html': '/bbw4life/tendtrainers-mens-outdoor-sport-sneakers',
    '/products/product45.html': '/bbw4life/patentloafers-luxury-patent-leather-party-shoes',
    '/products/product46.html': '/bbw4life/collarshirt-mens-plus-size-button-down',
    '/products/product47.html': '/bbw4life/geopolo-shirt-geometric-print-men-polo',
    '/products/product48.html': '/bbw4life/stripedcollar-sweater-mens-casual-knit',
    '/products/product49.html': '/bbw4life/turtlenecklux-mens-plus-size-turtleneck-sweater',
    '/products/product50.html': '/bbw4life/hikejacket-waterproof-outdoor-jacket',
    '/products/product51.html': '/bbw4life/roundneck-sweatshirt-mens-plus-size-pullover',
    '/products/product52.html': '/bbw4life/nailbond-glue-strong-uv-nail-tips-adhesive',
    '/products/product53.html': '/bbw4life/bownails-manicure-long-almond-fake-nails',
    '/products/product54.html': '/bbw4life/nailrepair-lotion-nourishing-nail-solution',
    '/products/product55.html': '/bbw4life/browdye-pencil-waterproof-quick-dry-eyebrow',
    '/products/product56.html': '/bbw4life/curl-volume-mascara-4d-waterproof-formula',
    '/products/product57.html': '/bbw4life/browkit-pro-waterproof-eyebrow-stencil-cream',
    '/products/product58.html': '/bbw4life/obsidian-lip-balm-warming-moisture-treatment',
    '/products/product59.html': '/bbw4life/tearoff-lip-gloss-4-color-long-lasting-peel',
    '/products/product60.html': '/bbw4life/gingerclean-pads-ginger-lemon-makeup-remover',
    '/products/product61.html': '/bbw4life/deeprepair-hair-mask-moisturizing-smoothing',
    '/products/product62.html': '/bbw4life/batanaglow-oil-moisturizing-hair-care',
    '/products/product63.html': '/bbw4life/batanaboost-oil-120ml-hair-growth-conditioner',
    '/products/product64.html': '/bbw4life/poreclean-gel-deep-exfoliating-anti-acne',
    '/products/product65.html': '/bbw4life/knucklewhite-serum-hand-joint-skin-brightener',
    '/products/product66.html': '/bbw4life/propolis-glow-essence-brightening-facial-serum',
    '/products/product67.html': '/bbw4life/menglow-cream-concealing-brightening-lazy-cream',
    '/products/product68.html': '/bbw4life/iceglow-grid-set-silicone-facial-cooling-tool',
    '/products/product69.html': '/bbw4life/glamsatin-dress-black-halter-ruched-maxi',
    '/products/product70.html': '/bbw4life/powersuit-ivory-structured-skirt-suit',
    '/products/product71.html': '/bbw4life/bohofloral-maxi-wrap-floral-bishop-sleeve-dress',
    '/products/product72.html': '/bbw4life/cozylounge-set-cream-tank-beige-wide-leg',
    '/products/product73.html': '/bbw4life/blushlace-gown-lace-cap-sleeve-empire-maxi',
    '/products/product74.html': '/bbw4life/tealempire-gown-sleeveless-vneck-formal-maxi',
    '/products/product75.html': '/bbw4life/jacquardpower-suit-multicolor-floral-brocade',
    '/products/product76.html': '/bbw4life/patchlace-flats-leisure-patchwork-shoelace-sneakers',
    '/products/product77.html': '/bbw4life/warmstep-boots-padded-fur-lined-winter-sneakers',
    '/products/product78.html': '/bbw4life/platformwalk-sneakers-vulcanized-plus-size-shoes',
    '/products/product79.html': '/bbw4life/stripewrap-bodycon-short-sleeve-bandage-dress',
    '/products/product80.html': '/bbw4life/flarefit-dress-spring-flared-sleeve-hip-hugging',
    '/products/product81.html': '/bbw4life/officestripe-shirt-dress-patchwork-streetwear-midi',
    '/products/product82.html': '/bbw4life/drawshirt-dress-drawstring-shirt-collar-streetwear',
    '/products/product83.html': '/bbw4life/autumnvneck-maxi-high-waist-family-matching-dress',
    '/products/product84.html': '/bbw4life/beltedbanquet-dress-long-sleeve-printed-high-waist',
    '/products/product85.html': '/bbw4life/woventassel-bag-hand-crochet-shoulder-bag',
    '/products/product86.html': '/bbw4life/koreantrend-bag-small-messenger-bag',
    '/products/product87.html': '/bbw4life/blocksquare-bag-color-blocked-mini-bag',
    '/products/product88.html': '/bbw4life/rattanring-tote-hand-knitted-beach-bag',
    '/products/product89.html': '/bbw4life/commutercanvas-tote-multi-pocket-zipper-bag',
    '/products/product90.html': '/bbw4life/embroidtote-bag-leather-top-handle-crossbody',
    '/products/product91.html': '/bbw4life/texturedmini-bag-japanese-style-hand-bag',
    '/products/product92.html': '/bbw4life/retroniche-bag-large-capacity-shoulder-messenger',
    '/products/product93.html': '/bbw4life/leopardunderarm-bag-retro-drawstring-crossbody',
    '/products/product94.html': '/bbw4life/metalchain-clutch-trendy-evening-party-bag',
    '/products/product95.html': '/bbw4life/patterntote-bag-earring-decorated-shoulder-tote',
    '/products/product96.html': '/bbw4life/pleatedtwo-piece-solid-color-skirt-set',
    '/products/product97.html': '/bbw4life/onepiece-swim-plus-size-solid-swimsuit',
    '/products/product98.html': '/bbw4life/gilded-gala-gown-sequin-bodice-tiered-tulle',
    '/products/product99.html': '/bbw4life/midnightvelvet-sheath-three-quarter-sleeve-bodycon',
    '/products/product100.html': '/bbw4life/velvetwrap-jumpsuit-gold-belt-wide-leg',
    '/products/product101.html': '/bbw4life/savannahprint-sundress-tribal-tiered-mini',
    '/products/product102.html': '/bbw4life/classictrench-coat-belted-double-breasted',
    '/products/product103.html': '/bbw4life/tiefront-sheath-cap-sleeve-wrap-detail',
    '/products/product104.html': '/bbw4life/slouchsuede-boots-knee-high-block-heel',
    '/products/product105.html': '/bbw4life/velvettailored-blazer-peak-lapel-jacket',
    '/products/product106.html': '/bbw4life/colorblockmidi-stripe-detail-sheath-dress',
    '/products/product107.html': '/bbw4life/houndstoothtweed-set-button-front-skirt-dress',
    '/products/product108.html': '/bbw4life/rufflecascade-sheath-draped-side-detail',
    '/products/product109.html': '/bbw4life/tweedshift-dress-cuffed-sleeve-classic',
    '/products/product110.html': '/bbw4life/polkadotblouse-set-wide-leg-belted-trouser',
    '/products/product111.html': '/bbw4life/autumn-canvas-high-top-boots-mens-workwear',
    '/products/product112.html': '/bbw4life/no-tie-leather-sneakers-mens-slip-on',
    '/products/product113.html': '/bbw4life/high-top-martin-boots-mens-outdoor-workwear',
    '/products/product114.html': '/bbw4life/breathable-mesh-sneakers-mens-casual-dad-shoes',
    '/products/product115.html': '/bbw4life/eva-sole-house-slippers-mens-slides',
    '/products/product116.html': '/bbw4life/solid-color-short-sleeve-tshirt-mens-slim-fit',
    '/products/product117.html': '/bbw4life/v-neck-ice-silk-tshirt-mens-quick-dry-fitness-top',
    '/products/product118.html': '/bbw4life/classic-v-neck-tee-multipack-mens-casual-white-black',

    // ── BLOG ARTICLES ─────────────────────────────────────
    '/blog/article-featured.html': '/bbw4life/journal/beauty-has-no-sizes-movement-redefining-beauty',
    '/blog/article1.html':  '/bbw4life/journal/stop-dieting-how-bbw-women-take-care-of-themselves',
    '/blog/article2.html':  '/bbw4life/journal/nutrition-curvy-women-eat-to-feel-amazing-not-to-shrink',
    '/blog/article3.html':  '/bbw4life/journal/7-body-positive-affirmations-that-change-how-you-see-yourself',
    '/blog/article4.html':  '/bbw4life/journal/stop-letting-opinions-destroy-your-body-confidence',
    '/blog/article5.html':  '/bbw4life/journal/pcos-plus-size-body-understanding-your-hormones',
    '/blog/article6.html':  '/bbw4life/journal/gentle-home-exercises-plus-size-women-move-without-injury',
    '/blog/article7.html':  '/bbw4life/journal/plus-size-fashion-2026-outfits-that-turn-heads',
    '/blog/article8.html':  '/bbw4life/journal/how-i-stopped-being-ashamed-of-my-body-and-started-loving-it',
    '/blog/article9.html':  '/bbw4life/journal/10-must-have-wardrobe-pieces-plus-size-women',
    '/blog/article10.html': '/bbw4life/journal/bbw-style-guide-dress-confidently-for-every-occasion',
    '/blog/article11.html': '/bbw4life/journal/plus-size-dresses-find-the-model-that-flatters-every-curve',
    '/blog/article12.html': '/bbw4life/journal/bbw-and-seduction-your-body-is-a-gift-not-an-obstacle',
    '/blog/article13.html': '/bbw4life/journal/how-to-dress-as-bbw-and-feel-beautiful-not-just-covered',
    '/blog/article14.html': '/bbw4life/journal/bbw-and-seduction-your-body-is-a-power-not-a-problem',
    '/blog/article15.html': '/bbw4life/journal/bbw4life-big-beautiful-woman-lifestyle-pride-family',
  };

  window.BBW_SLUGS = SLUGS;
  var path = window.location.pathname;
  var pretty = SLUGS[path];

  // ── Setting settings.use_pretty_urls (products.data.json) ──────────
  // "yes" (défaut) → comportement actuel, URL réécrite en jolie URL.
  // "no" → on n'y touche pas, la barre d'adresse garde le .html brut.
  // Ce script s'exécute tôt et de façon synchrone (avant même que le body
  // existe) : on ne peut pas attendre un fetch réseau ici sans retarder
  // l'affichage. Fast-path : dernière valeur connue en localStorage.
  // Confirmation asynchrone en fond pour rester à jour si le setting
  // change côté products.data.json (même mécanisme que preloader-inline.js).
  var PRETTY_URL_CACHE_KEY = 'bbw_use_pretty_urls';
  var prettyUrlsEnabled = true;
  try {
    var cachedSetting = localStorage.getItem(PRETTY_URL_CACHE_KEY);
    if (cachedSetting === 'no') prettyUrlsEnabled = false;
  } catch (e) {}

  function applyPrettyUrl() {
    if (!prettyUrlsEnabled) return;
    if (pretty && window.location.pathname === path && path !== pretty) {
      // Préserve la query string (ex: ?openCart=true venant d'une notification
      // push) et le hash — sinon ils sont perdus avant que le reste du site
      // (ex: checkOpenCartFromPush dans script.js) ne puisse les lire.
      var newUrl = pretty + window.location.search + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }

  applyPrettyUrl();

  fetch('/products.data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var arr = Array.isArray(data) ? data : [];
      var settings = arr.find(function (p) { return p.type === 'settings'; }) || {};
      var setting = (settings.use_pretty_urls || 'yes').trim().toLowerCase();
      try { localStorage.setItem(PRETTY_URL_CACHE_KEY, setting === 'no' ? 'no' : 'yes'); } catch (e) {}
      // Si le cache disait "yes" (ou rien) mais la vraie valeur est "no",
      // et qu'on avait déjà réécrit l'URL en jolie URL par erreur : on
      // restaure le .html d'origine pour rester cohérent avec le setting.
      if (setting === 'no' && prettyUrlsEnabled && window.location.pathname === pretty) {
        window.history.replaceState({}, document.title, path + window.location.search + window.location.hash);
      }
      // Si le cache disait "no" mais la vraie valeur est "yes" : applique
      // la jolie URL maintenant qu'on sait qu'elle doit l'être.
      if (setting !== 'no' && !prettyUrlsEnabled) {
        prettyUrlsEnabled = true;
        applyPrettyUrl();
      }
    })
    .catch(function () {});
})();