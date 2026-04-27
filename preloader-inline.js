(function(){
  // Lecture SYNCHRONE du setting avant tout injection
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/products.data.json', false); // false = synchrone
    xhr.send();
    var data = JSON.parse(xhr.responseText);
    var arr      = Array.isArray(data) ? data : [];
    var settings = arr.find(function(p){ return p.type === 'settings'; }) || {};
    var cfg      = settings.preloader || {};
    var show     = (cfg.show || 'yes').trim().toLowerCase();
    if (show !== 'yes') return; // ← stop total, rien n'est injecté
  } catch(e) {
    // Si erreur réseau ou JSON invalide → on affiche quand même (fail-safe)
  }

  // ── CSS ──────────────────────────────────────────────
  var s = document.createElement('style');
  s.id = 'cf-pre-style';
  s.textContent =
    '#cf-preloader{position:fixed;inset:0;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;background:linear-gradient(160deg,#1e1a1c 0%,#2e1828 50%,#1a1020 100%);opacity:1;visibility:visible;pointer-events:all;overflow:hidden;transition:opacity .55s cubic-bezier(.4,0,.2,1),visibility .55s cubic-bezier(.4,0,.2,1);}' +
    '#cf-preloader.cf-pre--hidden{opacity:0;visibility:hidden;pointer-events:none;}' +
    '#cf-preloader::before{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;background:radial-gradient(ellipse at center,rgba(192,56,94,.18) 0%,rgba(123,63,110,.10) 40%,transparent 70%);pointer-events:none;animation:cfPreGlowPulse 3s ease-in-out infinite;}' +
    '@keyframes cfPreGlowPulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.7}50%{transform:translate(-50%,-50%) scale(1.2);opacity:1}}' +
    '.cf-pre-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;}' +
    '.cf-pre-particle{position:absolute;border-radius:50%;animation:cfPreParticleFloat linear infinite;opacity:0;}' +
    '@keyframes cfPreParticleFloat{0%{transform:translateY(100vh) scale(0);opacity:0}10%{opacity:.7}90%{opacity:.3}100%{transform:translateY(-10vh) scale(1);opacity:0}}' +
    '.cf-pre-logo-wrap{position:relative;display:flex;align-items:center;justify-content:center;}' +
    '.cf-pre-logo-ring{position:absolute;width:110px;height:110px;border-radius:50%;border:1.5px solid rgba(192,56,94,.25);animation:cfPreRingRotate 6s linear infinite;}' +
    '.cf-pre-logo-ring::before{content:"";position:absolute;top:-3px;left:50%;width:6px;height:6px;background:#c0385e;border-radius:50%;transform:translateX(-50%);box-shadow:0 0 10px 3px rgba(192,56,94,.6);}' +
    '@keyframes cfPreRingRotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
    '.cf-pre-logo{width:80px;height:80px;object-fit:contain;position:relative;z-index:1;filter:drop-shadow(0 4px 20px rgba(192,56,94,.45));animation:cfPreLogoBreath 2.5s ease-in-out infinite;}' +
    '@keyframes cfPreLogoBreath{0%,100%{transform:scale(1);filter:drop-shadow(0 4px 20px rgba(192,56,94,.45))}50%{transform:scale(1.05);filter:drop-shadow(0 6px 28px rgba(192,56,94,.65))}}' +
    '.cf-pre-brand{text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;}' +
    '.cf-pre-brand-name{font-family:"Cormorant Garamond",Georgia,serif;font-size:2.4rem;font-weight:700;letter-spacing:-.02em;line-height:1;background:linear-gradient(135deg,#fff 40%,rgba(232,188,106,.85) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;opacity:0;transform:translateY(12px);animation:cfPreFadeUp .7s cubic-bezier(.34,1.56,.64,1) .25s forwards;}' +
    '.cf-pre-tagline{font-family:"DM Sans",system-ui,sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.45);opacity:0;transform:translateY(8px);animation:cfPreFadeUp .6s ease .5s forwards;}' +
    '@keyframes cfPreFadeUp{to{opacity:1;transform:translateY(0)}}' +
    '.cf-pre-progress-wrap{display:none;flex-direction:column;align-items:center;gap:8px;width:260px;}' +
    '#cf-preloader.style-progress-bar .cf-pre-progress-wrap{display:flex;}' +
    '.cf-pre-progress-track{width:100%;height:3px;background:rgba(255,255,255,.08);border-radius:100px;overflow:hidden;}' +
    '.cf-pre-progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#c0385e,#e8bc6a,#c0385e);background-size:200% 100%;border-radius:100px;transition:width .3s ease;animation:cfPreProgressShimmer 2s linear infinite;}' +
    '@keyframes cfPreProgressShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}' +
    '.cf-pre-progress-pct{font-family:"DM Sans",sans-serif;font-size:.72rem;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:.1em;}' +
    '.cf-pre-spinner-wrap{display:none;position:relative;width:56px;height:56px;}' +
    '#cf-preloader.style-spinner-ring .cf-pre-spinner-wrap{display:flex;align-items:center;justify-content:center;}' +
    '.cf-pre-spinner{position:absolute;inset:0;border-radius:50%;border:2.5px solid transparent;}' +
    '.cf-pre-spinner:nth-child(1){border-top-color:#c0385e;animation:cfPreSpinCW 1s linear infinite;}' +
    '.cf-pre-spinner:nth-child(2){inset:8px;border-right-color:#e8bc6a;animation:cfPreSpinCCW .75s linear infinite;}' +
    '.cf-pre-spinner:nth-child(3){inset:16px;border-bottom-color:rgba(255,255,255,.5);animation:cfPreSpinCW .5s linear infinite;}' +
    '@keyframes cfPreSpinCW{to{transform:rotate(360deg)}}' +
    '@keyframes cfPreSpinCCW{to{transform:rotate(-360deg)}}' +
    '.cf-pre-dots-wrap{display:none;align-items:flex-end;gap:6px;height:28px;}' +
    '#cf-preloader.style-dots-wave .cf-pre-dots-wrap{display:flex;}' +
    '.cf-pre-dot{width:8px;height:8px;border-radius:50%;animation:cfPreDotWave 1.4s ease-in-out infinite;}' +
    '.cf-pre-dot:nth-child(1){background:#c0385e;animation-delay:0s}' +
    '.cf-pre-dot:nth-child(2){background:#d4506e;animation-delay:.16s}' +
    '.cf-pre-dot:nth-child(3){background:#e8bc6a;animation-delay:.32s}' +
    '.cf-pre-dot:nth-child(4){background:#d4506e;animation-delay:.48s}' +
    '.cf-pre-dot:nth-child(5){background:#c0385e;animation-delay:.64s}' +
    '@keyframes cfPreDotWave{0%,80%,100%{transform:scaleY(.4);opacity:.4}40%{transform:scaleY(1.4);opacity:1}}' +
    '.cf-pre-morph-wrap{display:none;position:relative;height:22px;overflow:hidden;min-width:200px;text-align:center;}' +
    '#cf-preloader.style-morph-text .cf-pre-morph-wrap{display:block;}' +
    '.cf-pre-morph-text{position:absolute;width:100%;font-family:"DM Sans",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);transition:all .4s cubic-bezier(.4,0,.2,1);}' +
    '.cf-pre-morph-text.cf-morph-enter{transform:translateY(20px);opacity:0;}' +
    '.cf-pre-morph-text.cf-morph-active{transform:translateY(0);opacity:1;}' +
    '.cf-pre-morph-text.cf-morph-exit{transform:translateY(-20px);opacity:0;}' +
    '#cf-preloader.style-pulse-logo .cf-pre-logo{animation:cfPrePulseLogo 1.2s ease-in-out infinite;}' +
    '@keyframes cfPrePulseLogo{0%,100%{transform:scale(1);filter:drop-shadow(0 0 12px rgba(192,56,94,.5))}50%{transform:scale(1.15);filter:drop-shadow(0 0 32px rgba(192,56,94,.9))}}' +
    '#cf-preloader.style-pulse-logo .cf-pre-logo-ring{animation:cfPreRingPulse 1.2s ease-in-out infinite;}' +
    '@keyframes cfPreRingPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.25);opacity:.9}}';
  document.head.appendChild(s);

  // ── HTML ─────────────────────────────────────────────
  document.documentElement.insertAdjacentHTML('afterbegin',
    '<div id="cf-preloader" aria-hidden="true" role="status" aria-label="Loading CurvaFit">' +
      '<div class="cf-pre-particles" id="cf-pre-particles"></div>' +
      '<div class="cf-pre-logo-wrap">' +
        '<div class="cf-pre-logo-ring"></div>' +
        '<img class="cf-pre-logo" src="/public/vrlogo bbw4life.png" alt="CurvaFit" draggable="false">' +
      '</div>' +
      '<div class="cf-pre-brand">' +
        '<span class="cf-pre-brand-name">CurvaFit</span>' +
        '<span class="cf-pre-tagline">Your Transformation Starts Here</span>' +
      '</div>' +
      '<div class="cf-pre-progress-wrap">' +
        '<div class="cf-pre-progress-track">' +
          '<div class="cf-pre-progress-fill" id="cf-pre-progress-fill"></div>' +
        '</div>' +
        '<span class="cf-pre-progress-pct" id="cf-pre-progress-pct">0%</span>' +
      '</div>' +
      '<div class="cf-pre-spinner-wrap">' +
        '<div class="cf-pre-spinner"></div>' +
        '<div class="cf-pre-spinner"></div>' +
        '<div class="cf-pre-spinner"></div>' +
      '</div>' +
      '<div class="cf-pre-dots-wrap">' +
        '<div class="cf-pre-dot"></div>' +
        '<div class="cf-pre-dot"></div>' +
        '<div class="cf-pre-dot"></div>' +
        '<div class="cf-pre-dot"></div>' +
        '<div class="cf-pre-dot"></div>' +
      '</div>' +
      '<div class="cf-pre-morph-wrap">' +
        '<span class="cf-pre-morph-text cf-morph-active" id="cf-pre-morph-text">Loading</span>' +
      '</div>' +
    '</div>'
  );
})();
