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
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  const SUGGESTION_BANK = [
    // Movement
    { text: "What exactly is BBW4LIFE?", cat: "movement", catLabel: "Movement", keywords: ["bbw4life", "what is", "born", "founded", "mission"] },
    { text: "Is BBW4LIFE only for plus-size women?", cat: "movement", catLabel: "Movement", keywords: ["plus size", "women", "who can join"] },
    { text: "What values does BBW4LIFE stand for?", cat: "movement", catLabel: "Movement", keywords: ["values", "mission", "believe", "stand for"] },
    { text: "Is joining the BBW4LIFE movement free?", cat: "movement", catLabel: "Movement", keywords: ["free", "cost", "join", "price"] },
    { text: "Is BBW4LIFE available worldwide?", cat: "movement", catLabel: "Movement", keywords: ["worldwide", "countries", "global", "international"] },
    { text: "Who is the founder of BBW4LIFE?", cat: "movement", catLabel: "Movement", keywords: ["founder", "who created", "pdg", "francenel"] },
    { text: "Where can I follow BBW4LIFE on social media?", cat: "movement", catLabel: "Movement", keywords: ["social media", "instagram", "tiktok", "facebook", "follow"] },
    { text: "Can brands or influencers collaborate with BBW4LIFE?", cat: "movement", catLabel: "Movement", keywords: ["collaborate", "partner", "brand", "ambassador", "influencer"] },

    // Style
    { text: "What kind of style advice does BBW4LIFE offer?", cat: "style", catLabel: "Style", keywords: ["style", "fashion", "clothes", "advice", "tips"] },
    { text: "Do you recommend specific fashion brands?", cat: "style", catLabel: "Style", keywords: ["brands", "recommend", "clothing", "stores"] },
    { text: "Can I get a personalized style consultation?", cat: "style", catLabel: "Style", keywords: ["consultation", "personal", "stylist", "one on one"] },
    { text: "How can fashion help me feel more confident?", cat: "style", catLabel: "Style", keywords: ["confidence", "feel", "beautiful", "body", "feel good"] },
    { text: "Do you have swimwear recommendations for plus-size women?", cat: "style", catLabel: "Style", keywords: ["swimwear", "swimsuit", "beach", "summer", "pool"] },
    { text: "Does BBW4LIFE cover accessories and shoes too?", cat: "style", catLabel: "Style", keywords: ["accessories", "shoes", "jewelry", "handbag", "complete look"] },

    // Beauty
    { text: "What beauty recommendations does BBW4LIFE provide?", cat: "beauty", catLabel: "Beauty", keywords: ["beauty", "skincare", "care", "recommendations"] },
    { text: "Are there specific skincare routines for plus-size women?", cat: "beauty", catLabel: "Beauty", keywords: ["skincare", "routine", "skin", "lotion", "body care"] },
    { text: "Do you share makeup tips adapted to plus-size faces?", cat: "beauty", catLabel: "Beauty", keywords: ["makeup", "tips", "face", "curvy"] },
    { text: "Does BBW4LIFE address emotional well-being and self-image?", cat: "beauty", catLabel: "Beauty", keywords: ["mental health", "wellbeing", "self love", "confidence", "emotional"] },
    { text: "Does BBW4LIFE cover hair care and natural hair tips?", cat: "beauty", catLabel: "Beauty", keywords: ["hair", "natural", "curly", "afro", "haircare"] },
    { text: "Do you recommend fragrances and body products?", cat: "beauty", catLabel: "Beauty", keywords: ["fragrance", "perfume", "scent", "body spray"] },

    // Community
    { text: "How do I join the BBW4LIFE community?", cat: "community", catLabel: "Community", keywords: ["join", "community", "member", "sign up"] },
    { text: "Can I share my personal story with the community?", cat: "community", catLabel: "Community", keywords: ["share", "story", "testimonial", "experience"] },
    { text: "Can I participate anonymously in the community?", cat: "community", catLabel: "Community", keywords: ["anonymous", "privacy", "private", "identity"] },
    { text: "How do you ensure the community stays safe and kind?", cat: "community", catLabel: "Community", keywords: ["safe", "judgment", "toxic", "harassment", "moderation"] },
    { text: "Does BBW4LIFE organize events or meetups?", cat: "community", catLabel: "Community", keywords: ["events", "meetup", "gathering", "online", "workshop"] },

    // Orders
    { text: "What payment methods do you accept?", cat: "orders", catLabel: "Orders", keywords: ["payment", "visa", "mastercard", "paypal", "apple pay"] },
    { text: "What is your refund and cancellation policy?", cat: "orders", catLabel: "Orders", keywords: ["refund", "cancel", "money back", "return", "guarantee"] },
    { text: "How do I apply a promo code or discount?", cat: "orders", catLabel: "Orders", keywords: ["promo code", "discount", "coupon", "reduction"] },
    { text: "Will I receive an invoice after my purchase?", cat: "orders", catLabel: "Orders", keywords: ["invoice", "receipt", "billing", "email", "confirmation"] },
    { text: "Do you offer international shipping?", cat: "orders", catLabel: "Orders", keywords: ["shipping", "delivery", "international", "worldwide"] },
    { text: "How do I manage or cancel my premium subscription?", cat: "orders", catLabel: "Orders", keywords: ["subscription", "premium", "cancel", "membership", "upgrade"] },

    // Support
    { text: "How can I contact the BBW4LIFE team?", cat: "support", catLabel: "Support", keywords: ["contact", "reach", "team", "email", "chat"] },
    { text: "How long does it take to get a response?", cat: "support", catLabel: "Support", keywords: ["response time", "reply", "how long", "wait", "hours"] },
    { text: "What are your support hours?", cat: "support", catLabel: "Support", keywords: ["hours", "open", "available", "schedule"] },
    { text: "I have a technical issue on the website. What should I do?", cat: "support", catLabel: "Support", keywords: ["technical issue", "bug", "problem", "error", "website"] },
    { text: "I forgot my password. How do I recover my account?", cat: "support", catLabel: "Support", keywords: ["password", "forgot", "reset", "account", "login", "access"] },
  ];

  /* Icônes catégories */
  const CAT_ICONS = {
    movement:  'fi fi-rr-heart',
    style:     'fi fi-rr-vest',
    beauty:    'fi fi-rr-sparkles',
    community: 'fi fi-rr-users',
    orders:    'fi fi-rr-shopping-cart',
    support:   'fi fi-rr-life-ring',
  };

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
  function initSearch() {
    const input      = document.getElementById('faqSearchInput');
    const clearBtn   = document.getElementById('faqSearchClear');
    const suggestBox = document.getElementById('faqSuggestions');

    if (!input) return;

    input.addEventListener('input', () => {
      const val = input.value.trim();
      handleSearch(val);
      renderSuggestions(val);

      if (val.length > 0) {
        clearBtn && clearBtn.classList.add('visible');
      } else {
        clearBtn && clearBtn.classList.remove('visible');
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
        clearBtn && clearBtn.classList.remove('visible');
        hideSuggestions();
        input.blur();
        return;
      }
      // Navigation clavier dans les suggestions
      if (suggestBox && suggestBox.classList.contains('visible')) {
        const items = suggestBox.querySelectorAll('.faq-suggestion-item');
        let activeIdx = [...items].findIndex(i => i.classList.contains('faq-suggestion--active'));

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIdx = Math.min(activeIdx + 1, items.length - 1);
          items.forEach((item, idx) => item.classList.toggle('faq-suggestion--active', idx === activeIdx));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIdx = Math.max(activeIdx - 1, 0);
          items.forEach((item, idx) => item.classList.toggle('faq-suggestion--active', idx === activeIdx));
        } else if (e.key === 'Enter') {
          if (activeIdx >= 0) {
            e.preventDefault();
            items[activeIdx].click();
          }
        }
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        handleSearch('');
        clearBtn.classList.remove('visible');
        hideSuggestions();
        input.focus();
      });
    }

    // Fermer suggestions en cliquant dehors
    document.addEventListener('click', e => {
      if (!e.target.closest('.faq-search-wrap')) {
        hideSuggestions();
      }
    });
  }

  /* ── RENDER SUGGESTIONS ── */
  function renderSuggestions(query) {
    const suggestBox = document.getElementById('faqSuggestions');
    if (!suggestBox) return;

    if (!query || query.length < 1) {
      hideSuggestions();
      return;
    }

    const q = query.toLowerCase();

    // Score chaque suggestion
    const scored = SUGGESTION_BANK
      .map(entry => {
        let score = 0;
        const textLow = entry.text.toLowerCase();

        if (textLow.startsWith(q)) score += 10;
        else if (textLow.includes(q)) score += 6;

        entry.keywords.forEach(kw => {
          if (kw.includes(q)) score += 3;
          if (kw.startsWith(q)) score += 2;
        });

        return { ...entry, score };
      })
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7); // max 7 suggestions

    if (scored.length === 0) {
      hideSuggestions();
      return;
    }

    // Build HTML
    suggestBox.innerHTML = `
      <div class="faq-suggestions-title">Suggestions</div>
      ${scored.map(entry => {
        const highlighted = highlightSuggestion(entry.text, query);
        const icon = CAT_ICONS[entry.cat] || 'fi fi-rr-question';
        return `
          <button class="faq-suggestion-item" data-cat="${entry.cat}" data-text="${escapeAttr(entry.text)}">
            <span class="faq-suggestion-icon"><i class="${icon}"></i></span>
            <span class="faq-suggestion-text">${highlighted}</span>
            <span class="faq-suggestion-cat">${entry.catLabel}</span>
            <span class="faq-suggestion-arrow"><i class="fi fi-rr-arrow-small-right"></i></span>
          </button>
        `;
      }).join('')}
    `;

    // Attacher les events clicks
    suggestBox.querySelectorAll('.faq-suggestion-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const questionText = btn.dataset.text;
        const cat          = btn.dataset.cat;

        // Fermer suggestions
        hideSuggestions();

        // Vider search input
        const input = document.getElementById('faqSearchInput');
        if (input) {
          input.value = '';
          const clearBtn = document.getElementById('faqSearchClear');
          clearBtn && clearBtn.classList.remove('visible');
        }

        // Reset search results
        handleSearch('');

        // Naviguer vers la question
        navigateToQuestion(questionText, cat);
      });
    });

    suggestBox.classList.add('visible');
  }

  function hideSuggestions() {
    const suggestBox = document.getElementById('faqSuggestions');
    if (suggestBox) suggestBox.classList.remove('visible');
  }

  /* ── Highlight le query dans le texte de suggestion ── */
  function highlightSuggestion(text, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /* ── Naviguer vers une question spécifique ── */
  function navigateToQuestion(questionText, cat) {
    // 1. Afficher tous les groupes si besoin
    const groups = document.querySelectorAll('.faq-group');
    const allItems = document.querySelectorAll('.faq-item');

    // Réinitialiser les tabs
    document.querySelectorAll('.faq-tab').forEach(t => t.classList.remove('faq-tab--active'));
    const allTab = document.querySelector('.faq-tab[data-cat="all"]');
    if (allTab) allTab.classList.add('faq-tab--active');

    // Afficher tous les groupes
    groups.forEach(g => {
      g.style.display = '';
      g.style.animation = '';
    });
    allItems.forEach(i => i.classList.remove('faq-item--hidden'));

    // 2. Trouver l'item correspondant
    let targetItem = null;
    allItems.forEach(item => {
      const questionSpan = item.querySelector('.faq-question span:first-child');
      if (!questionSpan) return;

      // Comparaison flexible (case-insensitive, trailing ?)
      const normalize = s => s.toLowerCase().replace(/[?!.]/g, '').trim();
      if (normalize(questionSpan.textContent) === normalize(questionText)) {
        targetItem = item;
      }
    });

    if (!targetItem) {
      // Fallback: chercher par cat + partial match
      allItems.forEach(item => {
        if (item.dataset.cat === cat && !targetItem) {
          const qSpan = item.querySelector('.faq-question span:first-child');
          if (qSpan) {
            const partialMatch = questionText.toLowerCase().split(' ').slice(0, 4).join(' ');
            if (qSpan.textContent.toLowerCase().includes(partialMatch)) {
              targetItem = item;
            }
          }
        }
      });
    }

    if (!targetItem) return;

    // 3. Fermer tous les autres et ouvrir celui-ci
    closeAllAnswers();

    const btn = targetItem.querySelector('.faq-question');
    const ans = targetItem.querySelector('.faq-answer');
    if (btn && ans) {
      btn.setAttribute('aria-expanded', 'true');
      ans.classList.add('faq-answer--open');
    }

    // 4. Highlight visuel temporaire
    targetItem.classList.add('faq-highlight');
    setTimeout(() => targetItem.classList.remove('faq-highlight'), 3000);

    // 5. Scroll vers la question
    setTimeout(() => {
      const offset = 120;
      const top = targetItem.getBoundingClientRect().top + window.scrollY - offset;
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

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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










/* ═══════════════════════════════════════════════════════════════
   BBW4LIFE — DISCLAIMER PAGE JS
   disclaimer.js
═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Floating Hearts Background ── */
  const bg = document.getElementById('discHeartsBg');
  if (bg) {
    const hearts = ['♥', '❤', '♡'];
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('span');
      el.className = 'disc-heart-float';
      el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      const size = 8 + Math.random() * 14;
      el.style.cssText = `
        left: ${Math.random() * 100}%;
        bottom: -20px;
        font-size: ${size}px;
        animation-duration: ${14 + Math.random() * 20}s;
        animation-delay: ${Math.random() * 18}s;
        opacity: 0;
        color: ${Math.random() > 0.5
          ? 'rgba(192,56,94,0.18)'
          : 'rgba(201,150,62,0.14)'};
      `;
      bg.appendChild(el);
    }
  }

  /* ── 2. Scroll Reveal for Cards ── */
  const cards = document.querySelectorAll('.disc-card');
  if (cards.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = Array.from(cards).indexOf(entry.target);
          setTimeout(() => {
            entry.target.classList.add('disc-card--visible');
          }, idx * 80);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    cards.forEach(card => observer.observe(card));
  }

  /* ── 3. Active TOC link on scroll ── */
  const sectionIds = [
    'disc-mission',
    'disc-products',
    'disc-brand',
    'disc-style',
    'disc-legal',
    'disc-ip',
    'disc-changes'
  ];
  const tocLinks = document.querySelectorAll('.disc-toc-list li a');

  const updateActiveToc = () => {
    let current = '';
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 140) current = id;
    });
    tocLinks.forEach(a => {
      a.classList.remove('active');
      if (a.getAttribute('href') === '#' + current) {
        a.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', updateActiveToc, { passive: true });
  updateActiveToc(); // run once on load

  /* ── 4. Smooth scroll on TOC click ── */
  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        window.scrollTo({
          top: target.offsetTop - 110,
          behavior: 'smooth'
        });
      }
    });
  });

});

