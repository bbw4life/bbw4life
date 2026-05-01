/* ═══════════════════════════════════════════════════
   JS À AJOUTER DANS pages.js — Our Story Page
   ═══════════════════════════════════════════════════ */
function initOurStoryPage() {
  if (!document.querySelector('.os-origin-section')) return;

  osInitReveal();
  osInitParticles();
  osInitTrustBannerKenBurns();
  osInitCounterAnim();
}

/* ─────────────────────────────────────────────────────
   1. SCROLL REVEAL — IntersectionObserver
───────────────────────────────────────────────────── */
function osInitReveal() {
  const els = document.querySelectorAll('[data-os-reveal]');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // délai cascadé par index dans le parent
        const siblings = [...entry.target.parentElement.querySelectorAll('[data-os-reveal]')];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => {
          entry.target.classList.add('os-revealed');
        }, idx * 120);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
}

/* ─────────────────────────────────────────────────────
   2. PARTICLES — Section Turning Point
───────────────────────────────────────────────────── */
function osInitParticles() {
  const container = document.getElementById('osTurningParticles');
  if (!container) return;

  const colors = [
    'rgba(192,56,94,0.55)',
    'rgba(201,150,62,0.50)',
    'rgba(212,80,110,0.45)',
    'rgba(232,188,106,0.50)',
    'rgba(123,63,110,0.45)',
    'rgba(255,255,255,0.25)'
  ];

  function createParticle() {
    const p = document.createElement('span');
    const size = Math.random() * 5 + 2;
    const x = Math.random() * 100;
    const duration = Math.random() * 8 + 5;
    const delay = Math.random() * 4;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const drift = (Math.random() - 0.5) * 80;

    p.style.cssText = `
      position: absolute;
      left: ${x}%;
      bottom: -10px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      pointer-events: none;
      animation: osPtclFloat ${duration}s ${delay}s ease-in-out infinite;
      --drift: ${drift}px;
    `;
    container.appendChild(p);
  }

  // Injecter le keyframe dynamique
  if (!document.getElementById('os-ptcl-style')) {
    const style = document.createElement('style');
    style.id = 'os-ptcl-style';
    style.textContent = `
      @keyframes osPtclFloat {
        0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
        15%  { opacity: 1; }
        85%  { opacity: 0.5; }
        100% { transform: translateY(-120px) translateX(var(--drift)) scale(0.4); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  for (let i = 0; i < 22; i++) createParticle();
}

/* ─────────────────────────────────────────────────────
   3. TRUST BANNER — Ken Burns photo zoom
───────────────────────────────────────────────────── */
function osInitTrustBannerKenBurns() {
  const photo = document.querySelector('.trust-banner-photo');
  if (!photo) return;

  // Léger mouvement parallaxe au scroll
  function onScroll() {
    const rect = photo.closest('.trust-banner-wrap');
    if (!rect) return;
    const wrapRect = rect.getBoundingClientRect();
    const progress = -wrapRect.top / (window.innerHeight + wrapRect.height);
    const y = Math.max(-15, Math.min(15, progress * 40));
    photo.style.transform = `scale(1.08) translateY(${y}px)`;
  }

  // Ken Burns initial animation
  photo.style.transition = 'transform 12s ease-out';
  photo.style.transform = 'scale(1.08) translateY(0)';

  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ─────────────────────────────────────────────────────
   4. COUNTER ANIMATION — Stats row
───────────────────────────────────────────────────── */
function osInitCounterAnim() {
  const statNums = document.querySelectorAll('.os-stat-num');
  if (!statNums.length) return;

  function animateCounter(el) {
    const raw = el.textContent.trim();
    // Extraire nombre et suffixe (ex: "12,000+" → 12000, "+")
    const numMatch = raw.replace(/,/g, '').match(/^[\d.]+/);
    if (!numMatch) return;

    const target = parseFloat(numMatch[0]);
    const suffix = raw.replace(/^[\d,\.]+/, '');
    const isFloat = raw.includes('.');
    const decimals = isFloat ? (raw.split('.')[1] || '').replace(/[^0-9]/g,'').length : 0;
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (isFloat) {
        el.textContent = current.toFixed(decimals) + suffix;
      } else {
        // Format avec virgule si > 999
        const int = Math.floor(current);
        el.textContent = (int >= 1000 ? int.toLocaleString('en-US') : int) + suffix;
      }

      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNums.forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', initOurStoryPage);









/* ═══════════════════════════════════════════════════════════════════
   BBW4LIFE — ABOUT US — pages.js script
   Scroll reveal · Counter animation · Mission particles
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ──────────────────────────────────────
     1. SCROLL REVEAL
  ────────────────────────────────────── */
  function initAuReveal() {
    const els = document.querySelectorAll('[data-au-reveal]');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('au-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -40px 0px' }
    );

    els.forEach((el) => observer.observe(el));
  }

  /* ──────────────────────────────────────
     2. COUNTER ANIMATION
  ────────────────────────────────────── */
  function animateCounter(el, target, isDecimal, duration) {
    let start = null;
    const startVal = 0;

    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = startVal + (target - startVal) * ease;
      el.textContent = isDecimal ? val.toFixed(1) : Math.floor(val).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = isDecimal ? target.toFixed(1) : Math.floor(target).toLocaleString();
    }
    requestAnimationFrame(step);
  }

  function initAuCounters() {
    const nums = document.querySelectorAll('.au-nc-num[data-target]');
    if (!nums.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.dataset.target);
          const isDecimal = el.dataset.decimal === 'true';
          animateCounter(el, target, isDecimal, 2000);
          observer.unobserve(el);
        });
      },
      { threshold: 0.50 }
    );

    nums.forEach((el) => observer.observe(el));
  }

  /* ──────────────────────────────────────
     3. MISSION PARTICLES
  ────────────────────────────────────── */
  function initAuMissionParticles() {
    const container = document.getElementById('auMissionParticles');
    if (!container) return;

    const colors = [
      'rgba(201,150,62,0.65)',
      'rgba(232,188,106,0.50)',
      'rgba(192,56,94,0.45)',
      'rgba(123,63,110,0.45)',
      'rgba(255,255,255,0.30)',
    ];

    function createParticle() {
      const p = document.createElement('span');
      p.className = 'au-mq-particle';
      const size = Math.random() * 5 + 2;
      const leftPct = Math.random() * 100;
      const duration = Math.random() * 8 + 5;
      const delay = Math.random() * 6;
      const color = colors[Math.floor(Math.random() * colors.length)];

      Object.assign(p.style, {
        width: size + 'px',
        height: size + 'px',
        left: leftPct + '%',
        bottom: '0',
        background: color,
        animationDuration: duration + 's',
        animationDelay: delay + 's',
        filter: 'blur(' + (size > 4 ? '1px' : '0px') + ')',
      });

      container.appendChild(p);
      // Remove after animation ends to avoid DOM bloat
      setTimeout(() => p.remove(), (duration + delay) * 1000 + 500);
    }

    // Spawn particles continuously
    let interval = setInterval(createParticle, 450);

    // Pause when section out of view
    const section = document.querySelector('.au-mission-section');
    if (section) {
      const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          if (!interval) interval = setInterval(createParticle, 450);
        } else {
          clearInterval(interval);
          interval = null;
        }
      }, { threshold: 0.05 });
      obs.observe(section);
    }
  }

  /* ──────────────────────────────────────
     4. HERO PARALLAX (subtle)
  ────────────────────────────────────── */
  function initAuHeroParallax() {
    const orbs = document.querySelectorAll('.au-hero-orb');
    const lines = document.querySelectorAll('.au-hl');
    if (!orbs.length) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        orbs.forEach((orb, i) => {
          const factor = i === 0 ? 0.08 : i === 1 ? 0.05 : 0.12;
          orb.style.transform = `translateY(${y * factor}px)`;
        });
        lines.forEach((line, i) => {
          const f = (i + 1) * 0.04;
          line.style.transform = `translate(-50%,-50%) scale(${1 + y * f * 0.0003})`;
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ──────────────────────────────────────
     5. OFFER CARDS HOVER TILT
  ────────────────────────────────────── */
  function initAuCardTilt() {
    document.querySelectorAll('.au-offer-card, .au-value-item, .au-num-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2);
        const dy = (e.clientY - cy) / (rect.height / 2);
        card.style.transform = `translateY(-6px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        setTimeout(() => (card.style.transition = ''), 500);
      });
    });
  }

  /* ──────────────────────────────────────
     6. MARQUEE DUPLICATION
  ────────────────────────────────────── */
  function initAuMarquees() {
    document.querySelectorAll('.au-marquee-inner').forEach((inner) => {
      // Clone content for seamless loop if not already done
      if (!inner.dataset.duped) {
        inner.innerHTML += inner.innerHTML;
        inner.dataset.duped = '1';
      }
    });
  }

  /* ──────────────────────────────────────
     INIT ALL
  ────────────────────────────────────── */
  function initAboutPage() {
    // Only run on pages that have the about sections
    if (!document.querySelector('.au-hero-section, .au-who-section')) return;

    initAuReveal();
    initAuCounters();
    initAuMissionParticles();
    initAuHeroParallax();
    initAuCardTilt();
    initAuMarquees();
  }

  // Run on DOMContentLoaded or immediately if already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAboutPage);
  } else {
    initAboutPage();
  }

})();












/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — FAQ PAGE — JavaScript
   faq.js  — Accordion · Category Filter · Search · Suggestions · Particles
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────
     1. ACCORDION
  ────────────────────────────────────────── */
  function initAccordion() {
    const items = document.querySelectorAll('.faq-item');

    items.forEach(item => {
      const btn    = item.querySelector('.faq-question');
      const answer = item.querySelector('.faq-answer');
      if (!btn || !answer) return;

      btn.addEventListener('click', () => {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';

        // Fermer tous les autres
        items.forEach(other => {
          if (other !== item) {
            const ob = other.querySelector('.faq-question');
            const oa = other.querySelector('.faq-answer');
            if (ob) ob.setAttribute('aria-expanded', 'false');
            if (oa) oa.classList.remove('faq-answer--open');
          }
        });

        // Toggle current
        btn.setAttribute('aria-expanded', !isOpen);
        answer.classList.toggle('faq-answer--open', !isOpen);

        // Scroll léger si nécessaire
        if (!isOpen) {
          setTimeout(() => {
            const top = item.getBoundingClientRect().top + window.scrollY - 120;
            if (item.getBoundingClientRect().top < 80) {
              window.scrollTo({ top, behavior: 'smooth' });
            }
          }, 100);
        }
      });
    });
  }

  /* ──────────────────────────────────────────
     2. CATEGORY FILTER
  ────────────────────────────────────────── */
  function initCategoryFilter() {
    const tabs   = document.querySelectorAll('.faq-tab');
    const groups = document.querySelectorAll('.faq-group');
    const items  = document.querySelectorAll('.faq-item');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const cat = tab.dataset.cat;

        // Active tab style
        tabs.forEach(t => t.classList.remove('faq-tab--active'));
        tab.classList.add('faq-tab--active');

        // Close all open answers
        closeAllAnswers();

        if (cat === 'all') {
          groups.forEach(g => {
            g.style.display = '';
            g.style.animation = 'faqFadeUp 0.45s ease both';
          });
          items.forEach(i => i.classList.remove('faq-item--hidden'));
        } else {
          groups.forEach(g => {
            const show = g.dataset.group === cat;
            g.style.display = show ? '' : 'none';
            if (show) g.style.animation = 'faqFadeUp 0.45s ease both';
          });
          items.forEach(i => {
            i.classList.toggle('faq-item--hidden', i.dataset.cat !== cat);
          });
        }

        // Reset search
        const input = document.getElementById('faqSearchInput');
        if (input && input.value) {
          input.value = '';
          handleSearch('');
        }

        updateNoResults();
      });
    });
  }

  /* ──────────────────────────────────────────
     3. SEARCH + SUGGESTIONS
  ────────────────────────────────────────── */

  /* Libellé de catégorie lisible */
  const CAT_LABELS = {
    movement:  'BBW4LIFE & Movement',
    style:     'Style & Fashion',
    beauty:    'Beauty & Care',
    community: 'Community',
    orders:    'Orders & Payments',
    support:   'Support & Contact'
  };

  /* Icône par catégorie */
  const CAT_ICONS = {
    movement:  'fi fi-rr-heart',
    style:     'fi fi-rr-vest',
    beauty:    'fi fi-rr-sparkles',
    community: 'fi fi-rr-users',
    orders:    'fi fi-rr-shopping-cart',
    support:   'fi fi-rr-life-ring'
  };

  function initSearch() {
    const input    = document.getElementById('faqSearchInput');
    const clearBtn = document.getElementById('faqSearchClear');
    const sugBox   = document.getElementById('faqSuggestions');

    if (!input) return;

    input.addEventListener('input', () => {
      const val = input.value.trim();
      handleSearch(val);
      renderSuggestions(val);

      if (clearBtn) {
        clearBtn.classList.toggle('visible', val.length > 0);
      }
    });

    input.addEventListener('focus', () => {
      const val = input.value.trim();
      if (val.length >= 1) renderSuggestions(val);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        handleSearch('');
        hideSuggestions();
        if (clearBtn) clearBtn.classList.remove('visible');
        input.blur();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        handleSearch('');
        hideSuggestions();
        clearBtn.classList.remove('visible');
        input.focus();
      });
    }

    // Hide suggestions on outside click
    document.addEventListener('click', e => {
      if (!input.contains(e.target) && sugBox && !sugBox.contains(e.target)) {
        hideSuggestions();
      }
    });
  }

  function hideSuggestions() {
    const sugBox = document.getElementById('faqSuggestions');
    if (sugBox) sugBox.classList.remove('faq-suggestions--visible');
  }

  function renderSuggestions(query) {
    const sugBox = document.getElementById('faqSuggestions');
    if (!sugBox) return;

    if (!query || query.length < 1) {
      hideSuggestions();
      return;
    }

    const q     = query.toLowerCase();
    const items = document.querySelectorAll('.faq-item');
    const matches = [];

    items.forEach(item => {
      const keywords = (item.dataset.keywords || '').toLowerCase();
      const qText    = item.querySelector('.faq-question span:first-child');
      const qStr     = qText ? qText.textContent.toLowerCase() : '';
      const cat      = item.dataset.cat || '';

      if (qStr.includes(q) || keywords.includes(q)) {
        matches.push({
          text: qText ? qText.textContent : '',
          cat:  cat,
          item: item
        });
      }
    });

    if (matches.length === 0) {
      hideSuggestions();
      return;
    }

    // Clear existing items (keep header)
    const header = sugBox.querySelector('.faq-suggestions-header');
    sugBox.innerHTML = '';
    if (header) sugBox.appendChild(header);
    else {
      const h = document.createElement('div');
      h.className = 'faq-suggestions-header';
      h.textContent = 'Suggestions';
      sugBox.appendChild(h);
    }

    // Render up to 6 suggestions
    matches.slice(0, 6).forEach(match => {
      const btn = document.createElement('button');
      btn.className = 'faq-suggestion-item';
      btn.setAttribute('role', 'option');
      btn.setAttribute('type', 'button');

      const iconClass  = CAT_ICONS[match.cat] || 'fi fi-rr-question';
      const catLabel   = CAT_LABELS[match.cat] || match.cat;
      const highlighted = highlightSuggestion(match.text, query);

      btn.innerHTML = `
        <span class="faq-sug-icon"><i class="${iconClass}"></i></span>
        <span class="faq-sug-text">${highlighted}</span>
        <span class="faq-sug-cat">${catLabel}</span>
      `;

      btn.addEventListener('click', () => {
        // Fill input with the question text
        const input = document.getElementById('faqSearchInput');
        if (input) {
          input.value = match.text;
          const clearBtn = document.getElementById('faqSearchClear');
          if (clearBtn) clearBtn.classList.add('visible');
        }
        hideSuggestions();

        // Navigate to the question: show its group, open it, scroll
        scrollToFaqItem(match.item);
      });

      sugBox.appendChild(btn);
    });

    sugBox.classList.add('faq-suggestions--visible');
  }

  /* Highlight matching chars in suggestion text */
  function highlightSuggestion(text, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /* Navigate to a specific faq-item */
  function scrollToFaqItem(item) {
    if (!item) return;

    // 1. Reset category filter to "all"
    const tabs = document.querySelectorAll('.faq-tab');
    tabs.forEach(t => t.classList.remove('faq-tab--active'));
    const allTab = document.querySelector('.faq-tab[data-cat="all"]');
    if (allTab) allTab.classList.add('faq-tab--active');

    // 2. Show all groups
    document.querySelectorAll('.faq-group').forEach(g => g.style.display = '');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('faq-item--hidden'));

    // 3. Close all answers
    closeAllAnswers();

    // 4. Open the target item
    const btn = item.querySelector('.faq-question');
    const ans = item.querySelector('.faq-answer');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (ans) ans.classList.add('faq-answer--open');

    // 5. Highlight briefly
    item.classList.add('faq-highlight');
    setTimeout(() => item.classList.remove('faq-highlight'), 2800);

    // 6. Scroll smoothly to the item
    setTimeout(() => {
      const top = item.getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 80);

    updateNoResults();
  }

  function handleSearch(query) {
    const hint   = document.getElementById('faqSearchHint');
    const items  = document.querySelectorAll('.faq-item');
    const groups = document.querySelectorAll('.faq-group');

    // Reset active tab to "All"
    const tabs = document.querySelectorAll('.faq-tab');
    tabs.forEach(t => t.classList.remove('faq-tab--active'));
    const allTab = document.querySelector('.faq-tab[data-cat="all"]');
    if (allTab) allTab.classList.add('faq-tab--active');

    if (!query || query.length < 2) {
      // Reset
      items.forEach(item => {
        item.classList.remove('faq-item--hidden', 'faq-highlight');
        restoreText(item);
      });
      groups.forEach(g => g.style.display = '');
      closeAllAnswers();
      if (hint) {
        hint.textContent = '';
        hint.className = 'faq-search-hint';
      }
      updateNoResults();
      return;
    }

    const q   = query.toLowerCase();
    let found = 0;

    items.forEach(item => {
      const keywords = (item.dataset.keywords || '').toLowerCase();
      const qText    = item.querySelector('.faq-question span:first-child');
      const aText    = item.querySelector('.faq-answer-inner');
      const qStr     = qText ? qText.textContent.toLowerCase() : '';
      const aStr     = aText ? aText.textContent.toLowerCase() : '';
      const match    = qStr.includes(q) || aStr.includes(q) || keywords.includes(q);

      if (match) {
        item.classList.remove('faq-item--hidden');
        item.classList.add('faq-highlight');
        highlightText(item, query);
        found++;

        // Auto-open if only 1-2 results
        if (found <= 2) {
          const btn = item.querySelector('.faq-question');
          const ans = item.querySelector('.faq-answer');
          if (btn && ans) {
            btn.setAttribute('aria-expanded', 'true');
            ans.classList.add('faq-answer--open');
          }
        }
      } else {
        item.classList.add('faq-item--hidden');
        item.classList.remove('faq-highlight');
        restoreText(item);
        // Close
        const btn = item.querySelector('.faq-question');
        const ans = item.querySelector('.faq-answer');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (ans) ans.classList.remove('faq-answer--open');
      }
    });

    // Show/hide groups that have visible items
    groups.forEach(g => {
      const visibleItems = g.querySelectorAll('.faq-item:not(.faq-item--hidden)');
      g.style.display = visibleItems.length > 0 ? '' : 'none';
    });

    // Hint message
    if (hint) {
      if (found === 0) {
        hint.textContent = `No result for "${query}"`;
        hint.className = 'faq-search-hint no-results';
      } else {
        hint.textContent = `${found} question${found > 1 ? 's' : ''} found for "${query}"`;
        hint.className = 'faq-search-hint has-results';
      }
    }

    updateNoResults();
  }

  /* ── Highlight match in question text ── */
  function highlightText(item, query) {
    const btn = item.querySelector('.faq-question span:first-child');
    if (!btn) return;

    // Store original if not already stored
    if (!btn.dataset.original) {
      btn.dataset.original = btn.textContent;
    }

    const original = btn.dataset.original;
    const regex    = new RegExp(`(${escapeRegex(query)})`, 'gi');
    btn.innerHTML  = original.replace(regex, '<mark class="faq-mark">$1</mark>');
  }

  function restoreText(item) {
    const btn = item.querySelector('.faq-question span:first-child');
    if (!btn || !btn.dataset.original) return;
    btn.textContent = btn.dataset.original;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ──────────────────────────────────────────
     4. NO RESULTS STATE
  ────────────────────────────────────────── */
  function updateNoResults() {
    const noResults = document.getElementById('faqNoResults');
    const groups    = document.querySelectorAll('.faq-group');
    const visible   = [...groups].some(g => g.style.display !== 'none');
    if (noResults) noResults.style.display = visible ? 'none' : 'block';
  }

  /* ──────────────────────────────────────────
     5. CLOSE ALL ANSWERS
  ────────────────────────────────────────── */
  function closeAllAnswers() {
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.faq-answer').forEach(ans => {
      ans.classList.remove('faq-answer--open');
    });
  }

  /* ──────────────────────────────────────────
     6. HERO PARTICLES
  ────────────────────────────────────────── */
  function initHeroParticles() {
    const container = document.getElementById('faqHeroParticles');
    if (!container) return;

    const colors = [
      'rgba(192, 56, 94, 0.50)',
      'rgba(201, 150, 62, 0.55)',
      'rgba(212, 80, 110, 0.40)',
      'rgba(232, 188, 106, 0.50)',
      'rgba(123, 63, 110, 0.40)',
      'rgba(253, 240, 226, 0.60)'
    ];

    // Inject keyframes
    if (!document.getElementById('faq-ptcl-style')) {
      const style = document.createElement('style');
      style.id = 'faq-ptcl-style';
      style.textContent = `
        @keyframes faqPtclFloat {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          15%  { opacity: 0.90; }
          85%  { opacity: 0.45; }
          100% { transform: translateY(var(--fy)) translateX(var(--fx)) scale(0.35); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    function createParticle() {
      const p = document.createElement('span');
      const size = Math.random() * 6 + 2;
      const x    = Math.random() * 100;
      const dur  = Math.random() * 10 + 6;
      const del  = Math.random() * 5;
      const col  = colors[Math.floor(Math.random() * colors.length)];
      const fx   = (Math.random() - 0.5) * 100 + 'px';
      const fy   = -(Math.random() * 140 + 60) + 'px';

      p.style.cssText = `
        position: absolute;
        left: ${x}%;
        bottom: 10%;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${col};
        pointer-events: none;
        --fx: ${fx};
        --fy: ${fy};
        animation: faqPtclFloat ${dur}s ${del}s ease-in-out infinite;
      `;
      container.appendChild(p);
    }

    for (let i = 0; i < 26; i++) createParticle();
  }

  /* ──────────────────────────────────────────
     7. SCROLL REVEAL — groups & tabs
  ────────────────────────────────────────── */
  function initScrollReveal() {
    const targets = document.querySelectorAll('.faq-group, .faq-tabs-wrap, .faq-cta-inner');
    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = el.classList.contains('faq-group')
            ? ([...document.querySelectorAll('.faq-group')].indexOf(el)) * 80
            : 0;
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, delay);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    targets.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(32px)';
      el.style.transition = 'opacity 0.70s ease, transform 0.70s ease';
      observer.observe(el);
    });
  }

  /* ──────────────────────────────────────────
     8. EMOTIONAL TOUCH — floating hearts on answers open
  ────────────────────────────────────────── */
  function initEmotionalTouch() {
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const isOpening = btn.getAttribute('aria-expanded') === 'false';
        if (!isOpening) return;

        // Burst of tiny hearts
        const rect = btn.getBoundingClientRect();
        for (let i = 0; i < 5; i++) {
          spawnHeart(rect.left + Math.random() * rect.width, rect.top + window.scrollY);
        }
      });
    });
  }

  function spawnHeart(x, y) {
    const heart = document.createElement('span');
    const size  = Math.random() * 14 + 8;
    const dx    = (Math.random() - 0.5) * 70;
    const dur   = Math.random() * 0.8 + 0.7;
    const emojis = ['❤️', '💖', '✨', '💕', '🌸'];
    heart.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    Object.assign(heart.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      fontSize: size + 'px',
      pointerEvents: 'none',
      zIndex: '9999',
      transition: `transform ${dur}s ease, opacity ${dur}s ease`,
      opacity: '1',
      userSelect: 'none'
    });
    document.body.appendChild(heart);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        heart.style.transform = `translate(${dx}px, -80px) scale(0.3)`;
        heart.style.opacity   = '0';
      });
    });

    setTimeout(() => heart.remove(), dur * 1000 + 100);
  }

  /* ──────────────────────────────────────────
     9. INIT ALL
  ────────────────────────────────────────── */
  function init() {
    if (!document.querySelector('.faq-hero-section')) return;

    initAccordion();
    initCategoryFilter();
    initSearch();
    initHeroParticles();
    initScrollReveal();
    initEmotionalTouch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

