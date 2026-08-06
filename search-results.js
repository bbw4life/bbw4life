(function BBW4LIFESearchResultsPage() {
  'use strict';

  const form   = document.getElementById('srSearchForm');
  const input  = document.getElementById('srSearchInput');
  if (!form || !input) return;

  /* ── Pré-remplir avec la query actuelle ── */
  const currentQuery = new URLSearchParams(window.location.search).get('q') || '';
  if (currentQuery) input.value = currentQuery;

  function goToQuery(query) {
    const q = (query || '').trim();
    const url = q ? `/search-results.html?q=${encodeURIComponent(q)}` : '/search-results.html';
    window.location.href = url;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    goToQuery(input.value);
  });

  /* ── Chargement initial des résultats — attend que script.js (produits +
     bridge __srResolveResults) et search.js (index de recherche) soient
     prêts avant de lancer la première recherche. ── */
  (function waitAndLoad() {
    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      const ready = typeof window.__srResolveResults === 'function'
        && typeof window.__srLoadResults === 'function'
        && window.bbwSearch && typeof window.bbwSearch.isReady === 'function'
        && window.bbwSearch.isReady();
      if (ready) {
        clearInterval(poll);
        window.__srLoadResults(currentQuery.trim());
      } else if (tries > 100) {
        clearInterval(poll);
        // Après ~10s, tente quand même un chargement (mieux qu'un silence
        // total si l'index search.js a échoué à charger pour une raison X).
        if (typeof window.__srLoadResults === 'function') window.__srLoadResults(currentQuery.trim());
      }
    }, 100);
  })();

  /* ──────────────────────────────────────────────────────────────
     VOICE SEARCH — Web Speech API (SpeechRecognition)
  ────────────────────────────────────────────────────────────── */
  const micBtn    = document.getElementById('srMicBtn');
  const micStatus = document.getElementById('srMicStatus');
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (micBtn && SpeechRecognitionCtor) {
    micBtn.style.display = '';

    const recognition = new SpeechRecognitionCtor();
    recognition.lang            = 'en-US';
    recognition.continuous      = false;
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;

    let listening = false;

    function setListening(on) {
      listening = on;
      micBtn.classList.toggle('is-listening', on);
      if (micStatus) micStatus.textContent = on ? 'Listening… speak now' : '';
    }

    micBtn.addEventListener('click', function () {
      if (listening) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
        setListening(true);
      } catch (err) {
        console.warn('[VoiceSearch] start failed:', err.message);
      }
    });

    recognition.addEventListener('result', function (event) {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      if (micStatus) micStatus.textContent = `Heard: "${transcript}"`;
    });

    recognition.addEventListener('end', function () {
      setListening(false);
      if (input.value.trim()) goToQuery(input.value);
    });

    recognition.addEventListener('error', function (event) {
      setListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        if (micStatus) micStatus.textContent = 'Microphone access denied.';
      } else if (event.error === 'no-speech') {
        if (micStatus) micStatus.textContent = "Didn't catch that — try again.";
      } else {
        if (micStatus) micStatus.textContent = '';
        console.warn('[VoiceSearch] error:', event.error);
      }
    });
  } else if (micBtn) {
    // Navigateur sans support Web Speech (ex: Firefox) — bouton déjà caché
    // par défaut en HTML (style="display:none"), rien de plus à faire.
  }

  /* ──────────────────────────────────────────────────────────────
     ANIMATED PLACEHOLDER — même effet machine à écrire que le header
     (type → pause → delete → mot suivant), avec de vrais titres produit.
  ────────────────────────────────────────────────────────────── */
  function initAnimatedPlaceholder(el, words) {
    if (!el || !words || !words.length) return;
    if (el.dataset.bbwPlaceholderAnim) return;
    el.dataset.bbwPlaceholderAnim = '1';

    const TYPE_SPEED   = 45;
    const DELETE_SPEED = 25;
    const HOLD_MS       = 1500;
    const GAP_MS         = 300;

    let wordIdx = 0;
    let timer   = null;
    let paused  = false;

    function step(charIdx, deleting) {
      if (paused) return;
      const word = words[wordIdx];
      if (!deleting) {
        el.placeholder = word.slice(0, charIdx);
        if (charIdx < word.length) timer = setTimeout(() => step(charIdx + 1, false), TYPE_SPEED);
        else timer = setTimeout(() => step(word.length, true), HOLD_MS);
      } else {
        el.placeholder = word.slice(0, charIdx);
        if (charIdx > 0) timer = setTimeout(() => step(charIdx - 1, true), DELETE_SPEED);
        else { wordIdx = (wordIdx + 1) % words.length; timer = setTimeout(() => step(0, false), GAP_MS); }
      }
    }

    el.addEventListener('focus', () => { paused = true; clearTimeout(timer); });
    el.addEventListener('blur', () => {
      if (el.value.trim()) return;
      paused = false;
      step(0, false);
    });

    step(0, false);
  }

  (function waitAndInitPlaceholder() {
    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      const ready = window.__allProducts && window.__allProducts.length;
      if (ready || tries > 100) {
        clearInterval(poll);
        const realProducts = (window.__allProducts || []).filter(p => !p.type).map(p => p.title).filter(Boolean);
        const sampleTitles = realProducts.slice().sort(() => Math.random() - 0.5).slice(0, 5);
        const words = ['Search products…', 'Search collections…', ...sampleTitles];
        if (words.length > 2) initAnimatedPlaceholder(input, words);
      }
    }, 100);
  })();

})();
