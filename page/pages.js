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

