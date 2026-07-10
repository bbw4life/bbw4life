/* ============================================================
   BBW4LIFE — 404-page.js
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────
   1. GO BACK BUTTON
──────────────────────────────────────────────────── */
(function () {
  var goBack   = document.getElementById('goBack');
  var hdrBack  = document.getElementById('hdr404Back');

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/index.html';
    }
  }

  if (goBack)  goBack.addEventListener('click', handleBack);
  if (hdrBack) hdrBack.addEventListener('click', handleBack);
})();


/* ──────────────────────────────────────────────────
   2. ANNOUNCEMENT BAR ROTATION
──────────────────────────────────────────────────── */
(function () {
  var slides   = document.querySelectorAll('.ann404-bar__slide');
  var prevBtn  = document.getElementById('ann404Prev');
  var nextBtn  = document.getElementById('ann404Next');
  var current  = 0;
  var timer    = null;

  if (!slides.length) return;

  function show(index) {
    slides[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
  }

  function next() { show(current + 1); }
  function prev() { show(current - 1); }

  function start() {
    timer = setInterval(next, 4000);
  }
  function reset() {
    clearInterval(timer);
    start();
  }

  if (nextBtn) nextBtn.addEventListener('click', function () { next(); reset(); });
  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); reset(); });

  start();
})();


/* ──────────────────────────────────────────────────
   3. PARTICLE CANVAS
──────────────────────────────────────────────────── */
(function () {
  var canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  var ctx    = canvas.getContext('2d');
  var W, H;
  var particles = [];
  var NUM = 55;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function Particle() {
    this.reset();
  }

  Particle.prototype.reset = function () {
    this.x    = rand(0, W);
    this.y    = rand(0, H);
    this.vx   = rand(-0.25, 0.25);
    this.vy   = rand(-0.5, -0.12);
    this.size = rand(1, 3.5);
    this.alpha = rand(0.08, 0.55);
    var colors = [
      'rgba(201,150,62,' + this.alpha + ')',
      'rgba(232,188,106,' + this.alpha + ')',
      'rgba(245,230,196,' + (this.alpha * 0.6) + ')',
      'rgba(255,255,255,' + (this.alpha * 0.25) + ')'
    ];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.life  = 0;
    this.maxLife = rand(180, 420);
  };

  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;
    this.life++;
    if (this.life > this.maxLife || this.y < -10) this.reset();
  };

  Particle.prototype.draw = function () {
    var fade = Math.min(this.life / 40, 1) * Math.min((this.maxLife - this.life) / 40, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  function init() {
    resize();
    for (var i = 0; i < NUM; i++) {
      var p = new Particle();
      p.life = Math.floor(Math.random() * p.maxLife); // stagger starts
      particles.push(p);
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  init();
  loop();
})();


/* ──────────────────────────────────────────────────
   4. CROWN ANIMATION INIT
   (crown-wrap opacity fix — ensure it animates in)
──────────────────────────────────────────────────── */
(function () {
  var crown = document.querySelector('.crown-wrap');
  if (!crown) return;
  // Force animation replay after fonts load
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      crown.style.animationPlayState = 'running';
    });
  }
})();



/* ──────────────────────────────────────────────────
   5. FREE SHIPPING THRESHOLD — header injection
──────────────────────────────────────────────────── */
(function () {
  var els = document.querySelectorAll('.hdr-free-shipping-threshold');
  if (!els.length) return;

  fetch('/products.data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var arr      = Array.isArray(data) ? data : [];
      var settings = arr.find(function (p) { return p.type === 'settings'; }) || {};
      var threshold = (settings.cart_drawer && settings.cart_drawer.free_shipping_threshold)
        ? settings.cart_drawer.free_shipping_threshold
        : 75;
      els.forEach(function (el) { el.textContent = threshold; });
    })
    .catch(function () {
      els.forEach(function (el) { el.textContent = 75; });
    });
})();