/* ================================================================
   CURVAFIT — article-featured.js
================================================================ */

document.addEventListener('DOMContentLoaded', function () {

  // Guard: only run on the featured article page
  var isFeaturedPage =
    document.body.classList.contains('article-featured-page') ||
    window.location.pathname.includes('article-featured');

  if (!isFeaturedPage) return;

  fetch('/blog/blog-articles.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {

      var f = data.featured;
      if (!f) {
        console.warn('article-featured.js: no "featured" key found in blog-articles.json');
        return;
      }

      /* ── Meta / <head> tags ─────────────────────────────── */

      var pageTitle = document.getElementById('page-title');
      if (pageTitle) pageTitle.textContent = f.title + ' | CurvaFit Journal';

      var metaDesc = document.getElementById('meta-description');
      if (metaDesc) metaDesc.setAttribute('content', f.excerpt);

      var metaOgTitle = document.getElementById('meta-og-title');
      if (metaOgTitle) metaOgTitle.setAttribute('content', f.title + ' — CurvaFit Journal');

      var metaOgDesc = document.getElementById('meta-og-desc');
      if (metaOgDesc) metaOgDesc.setAttribute('content', f.excerpt);

      var metaOgImage = document.getElementById('meta-og-image');
      if (metaOgImage) metaOgImage.setAttribute('content', f.image);

      /* ── JSON-LD ────────────────────────────────────────── */

      var jsonLd = document.getElementById('json-ld');
      if (jsonLd) {
        jsonLd.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          'headline': f.title,
          'description': f.excerpt,
          'image': f.image,
          'author': {
            '@type': 'Person',
            'name': f.author.name
          },
          'publisher': {
            '@type': 'Organization',
            'name': 'CurvaFit',
            'logo': {
              '@type': 'ImageObject',
              'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png'
            }
          },
          'datePublished': f.date,
          'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': 'https://www.curva-fit.com' + (f.url || '/blog/article-featured.html')
          }
        });
      }

      /* ── Hero image ─────────────────────────────────────── */

      var heroImage = document.getElementById('hero-image');
      if (heroImage) {
        heroImage.src   = f.image;
        heroImage.alt   = f.imageAlt || f.title;
        heroImage.style.display = 'block';
      }

      /* ── Hero text fields ───────────────────────────────── */

      setText('hero-badge',        f.badge);
      setText('hero-readtime',     f.readTime);
      setText('hero-title',        f.title);
      setText('hero-excerpt',      f.excerpt);
      setText('hero-date',         f.date);
      setText('hero-views',        f.views);
      setText('hero-readtime-stat', f.readTime);
      setText('breadcrumb-category', f.badge);

      /* ── Author chip (hero) ─────────────────────────────── */

      var heroAuthorImg = document.getElementById('hero-author-img');
      if (heroAuthorImg) {
        heroAuthorImg.src = f.author.image;
        heroAuthorImg.alt = f.author.name;
      }
      setText('hero-author-name', f.author.name);
      setText('hero-author-role', f.author.role || '');

      /* ── Author bio section ─────────────────────────────── */

      var bioAuthorImg = document.getElementById('bio-author-img');
      if (bioAuthorImg) {
        bioAuthorImg.src = f.author.image;
        bioAuthorImg.alt = f.author.name;
      }
      setText('bio-author-name',       f.author.name);
      setText('bio-author-role',       f.author.role || '');
      setText('conclusion-author-name', f.author.name);

      /* ── Related articles ───────────────────────────────── */

      injectRelated(data.cards, f.badge, null);

    })
    .catch(function (err) {
      console.error('article-featured.js: error loading blog-articles.json:', err);
    });


  /* ════════════════════════════════════════════════════════
     RELATED ARTICLES
  ════════════════════════════════════════════════════════ */
  function injectRelated(cards, currentBadge, currentId) {
    var relatedGrid = document.getElementById('related-grid');
    if (!relatedGrid || !cards || !cards.length) return;

    var same   = cards.filter(function (c) { return c.badge === currentBadge && c.id !== currentId; });
    var others = cards.filter(function (c) { return c.badge !== currentBadge && c.id !== currentId; });

    shuffle(same);
    shuffle(others);

    var picks = same.slice(0, 3);
    if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

    relatedGrid.innerHTML = picks.map(function (card) {
      return (
        '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + escHtml(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + escHtml(card.badge) + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + escHtml(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + escHtml(card.excerpt) + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + escHtml(card.readTime) + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + escHtml(card.views) + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>'
      );
    }).join('');
  }


  /* ════════════════════════════════════════════════════════
     TABLE OF CONTENTS (auto-built from h2s)
  ════════════════════════════════════════════════════════ */
  function buildTOC() {
    var tocNav   = document.getElementById('toc-nav');
    if (!tocNav) return;
    var headings = document.querySelectorAll('.article-content h2');
    if (!headings.length) return;

    var links = [];

    headings.forEach(function (h2, i) {
      if (!h2.id) h2.id = 'af-heading-' + i;
      var a = document.createElement('a');
      a.href        = '#' + h2.id;
      a.textContent = h2.textContent;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(h2.id);
        if (target) {
          var top = target.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
      tocNav.appendChild(a);
      links.push({ el: h2, link: a });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var found = links.find(function (l) { return l.el === entry.target; });
        if (found) found.link.classList.toggle('active', entry.isIntersecting);
      });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    links.forEach(function (l) { observer.observe(l.el); });
  }


  /* ════════════════════════════════════════════════════════
     READING PROGRESS BAR
  ════════════════════════════════════════════════════════ */
  function initProgressBar() {
    var bar = document.getElementById('reading-progress-bar');
    if (!bar) return;

    function updateProgress() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress  = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      bar.style.width = progress.toFixed(1) + '%';
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }


  /* ════════════════════════════════════════════════════════
     STICKY SIDEBAR SHARE
  ════════════════════════════════════════════════════════ */
  function initSidebarShare() {
    var stickyShare = document.getElementById('sidebar-share-sticky');
    var hero        = document.getElementById('article-hero');
    if (!stickyShare || !hero) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        stickyShare.classList.toggle('visible', !entry.isIntersecting);
      });
    }, { threshold: 0 });

    observer.observe(hero);
  }


  /* ════════════════════════════════════════════════════════
     SHARE BUTTONS
  ════════════════════════════════════════════════════════ */
  function initShareButtons() {
    var url   = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {

      // Copy link
      if (btn.classList.contains('art-share-btn--copy') ||
          btn.id === 'hero-copy-link' ||
          btn.id === 'bottom-copy-link') {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          navigator.clipboard.writeText(window.location.href).then(function () {
            btn.classList.add('copied');
            var icon = btn.querySelector('i');
            var orig = icon ? icon.className : '';
            if (icon) icon.className = 'fi fi-rr-check';
            setTimeout(function () {
              btn.classList.remove('copied');
              if (icon) icon.className = orig;
            }, 2200);
          }).catch(function () {
            var ta = document.createElement('textarea');
            ta.value = window.location.href;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          });
        });
        return;
      }

      // Social share
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var shareUrl = '#';

        if (btn.classList.contains('art-share-btn--fb')) {
          shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
        } else if (btn.classList.contains('art-share-btn--pi')) {
          var imgEl = document.getElementById('hero-image');
          var img   = encodeURIComponent(imgEl ? imgEl.src : '');
          shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
        } else if (btn.classList.contains('art-share-btn--wa')) {
          shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
        } else if (btn.classList.contains('art-share-btn--tw')) {
          shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
        }

        if (shareUrl !== '#') {
          window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        }
      });
    });
  }


  /* ════════════════════════════════════════════════════════
     REACTIONS
  ════════════════════════════════════════════════════════ */
  function initReactions() {
    var STORAGE_KEY = 'cf_article_reactions_featured';

    function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
    function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

    var reacted = getReacted();

    document.querySelectorAll('.reaction-btn').forEach(function (btn) {
      var type    = btn.getAttribute('data-reaction');
      var countEl = btn.querySelector('.reaction-btn__count');

      if (reacted === type) btn.classList.add('active');

      btn.addEventListener('click', function () {
        if (reacted && reacted !== type) return;
        var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          if (countEl) countEl.textContent = Math.max(0, current - 1);
          reacted = ''; saveReacted('');
        } else {
          btn.classList.add('active');
          if (countEl) countEl.textContent = current + 1;
          reacted = type; saveReacted(type);
        }
      });
    });
  }


  /* ════════════════════════════════════════════════════════
     REVIEW SYSTEM
  ════════════════════════════════════════════════════════ */
  (function () {
    var ARTICLE_ID       = 'article-featured';
    var API              = '/.netlify/functions/reviews-article';
    var REVIEWS_PER_PAGE = 5;
    var allReviews       = [];
    var shownCount       = 0;
    var likeGranted      = false;

    /* Load stats */
    async function loadStats() {
      try {
        var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
        var data = await res.json();
        if (!data.success) return;

        setCount('count-helpful',  data.likes);
        setCount('count-inspired', data.reviewsCount);
        setCount('count-more',     data.shares);

        allReviews = data.reviews || [];
        renderReviews(true);
      } catch (e) {
        console.warn('[featured reviews] loadStats failed:', e.message);
      }
    }

    function setCount(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    /* Like */
    var btnHelpful = document.getElementById('btn-helpful');
    if (btnHelpful) {
      btnHelpful.addEventListener('click', async function () {
        if (likeGranted) return;
        likeGranted = true;
        btnHelpful.classList.add('active');
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) setCount('count-helpful', data.likes);
        } catch (e) { console.warn('[featured] like failed:', e.message); }
      });
    }

    /* Share counter */
    async function recordShare() {
      try {
        var res  = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
        });
        var data = await res.json();
        if (data.success) setCount('count-more', data.shares);
      } catch (e) { console.warn('[featured] share failed:', e.message); }
    }

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {
      btn.addEventListener('click', recordShare);
    });

    var btnMore = document.getElementById('btn-more');
    if (btnMore) {
      btnMore.addEventListener('click', function () {
        recordShare();
        var fw = document.getElementById('art-review-form-wrap');
        if (fw) fw.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    /* Avatar */
    var avatarBase64 = '';

    function compressAvatar(file) {
      return new Promise(function (resolve) {
        if (!file) { resolve(''); return; }
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var MAX = 150, w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
          else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
        img.src = url;
      });
    }

    var avatarInput  = document.getElementById('art-rv-avatar-input');
    var avatarWrap   = document.getElementById('art-rv-avatar-wrap');
    var avatarPrev   = document.getElementById('art-rv-avatar-preview');
    var avatarPlaceh = document.getElementById('art-rv-avatar-placeholder');

    if (avatarWrap && avatarInput) {
      avatarWrap.addEventListener('click', function () { avatarInput.click(); });
      avatarInput.addEventListener('change', async function () {
        var file = avatarInput.files[0];
        if (!file) return;
        avatarBase64 = await compressAvatar(file);
        if (avatarBase64 && avatarPrev && avatarPlaceh) {
          avatarPrev.src = avatarBase64;
          avatarPrev.style.display = 'block';
          avatarPlaceh.style.display = 'none';
        }
      });
    }

    /* Stars */
    var stars          = document.querySelectorAll('.art-rv-star');
    var ratingInput    = document.getElementById('art-rv-rating');
    var selectedRating = 0;

    function paintStars(upTo) {
      stars.forEach(function (s, i) {
        s.classList.toggle('fi-sr-star', i < upTo);
        s.classList.toggle('fi-rr-star', i >= upTo);
        s.classList.toggle('selected',   i < upTo);
      });
    }

    stars.forEach(function (star) {
      star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
      star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
      star.addEventListener('click',     function () {
        selectedRating = parseInt(star.dataset.val);
        if (ratingInput) ratingInput.value = selectedRating;
        paintStars(selectedRating);
      });
    });

    /* Char counter */
    var textarea = document.getElementById('art-rv-text');
    var charNum  = document.getElementById('art-rv-char-num');
    if (textarea && charNum) {
      textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
    }

    /* Submit review */
    var reviewForm = document.getElementById('art-review-form');
    var submitBtn  = document.getElementById('art-rv-submit');
    var errorEl    = document.getElementById('art-rv-error');
    var successEl  = document.getElementById('art-rv-success');

    if (reviewForm) {
      reviewForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        var firstName = document.getElementById('art-rv-firstname').value.trim();
        var lastName  = document.getElementById('art-rv-lastname').value.trim();
        var text      = document.getElementById('art-rv-text').value.trim();
        var rating    = parseInt(ratingInput ? ratingInput.value : '0');

        if (errorEl)   errorEl.style.display   = 'none';
        if (successEl) successEl.style.display = 'none';

        if (!firstName || !lastName)     { showError('Please enter your first and last name.'); return; }
        if (rating === 0)                { showError('Please select a star rating.'); return; }
        if (!text || text.length < 10)   { showError('Please write at least 10 characters in your review.'); return; }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add-review', articleId: ARTICLE_ID,
              firstName, lastName, avatar: avatarBase64, text, rating
            })
          });
          var data = await res.json();

          if (data.success) {
            if (successEl) successEl.style.display = 'flex';
            setCount('count-inspired', data.reviewsCount);

            allReviews.unshift({
              firstName, lastName, avatar: avatarBase64, text, rating,
              date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            });
            renderReviews(true);

            reviewForm.reset();
            selectedRating = 0; paintStars(0);
            avatarBase64 = '';
            if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
            if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
            if (charNum)      charNum.textContent = '0';

            submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
            setTimeout(function () {
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
              if (successEl) successEl.style.display = 'none';
            }, 4000);

          } else {
            showError('Error: ' + (data.error || 'Unknown error'));
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
          }
        } catch (err) {
          showError('Network error. Please try again.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
        }
      });
    }

    function showError(msg) {
      if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
    }

    /* Render reviews */
    var listWrap    = document.getElementById('art-reviews-list-wrap');
    var listEl      = document.getElementById('art-reviews-list');
    var countLabel  = document.getElementById('art-rv-count-label');
    var loadMoreBtn = document.getElementById('art-rv-load-more');

    function renderReviews(reset) {
      if (!listEl) return;
      if (reset) { shownCount = 0; listEl.innerHTML = ''; }
      if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }

      if (listWrap) listWrap.style.display = 'block';
      if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

      var slice = allReviews.slice(shownCount, shownCount + REVIEWS_PER_PAGE);
      slice.forEach(function (rv) { listEl.appendChild(buildReviewCard(rv)); });
      shownCount += slice.length;

      if (loadMoreBtn) loadMoreBtn.style.display = shownCount < allReviews.length ? 'block' : 'none';
    }

    if (loadMoreBtn) loadMoreBtn.addEventListener('click', function () { renderReviews(false); });

    function buildReviewCard(rv) {
      var card = document.createElement('div');
      card.className = 'art-rv-card';

      var avatarHTML = rv.avatar
        ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + rv.firstName + '" loading="lazy">'
        : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

      var rating = parseInt(rv.rating) || 5;
      var starsHTML = '';
      for (var i = 1; i <= 5; i++) {
        starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
      }

      card.innerHTML = avatarHTML +
        '<div class="art-rv-card__body">' +
          '<div class="art-rv-card__top">' +
            '<span class="art-rv-card__name">' + escHtml(rv.firstName) + ' ' + escHtml(rv.lastName) + '</span>' +
            '<span class="art-rv-card__date">' + escHtml(rv.date || '') + '</span>' +
          '</div>' +
          '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
          '<p class="art-rv-card__text">' + escHtml(rv.text) + '</p>' +
        '</div>';

      return card;
    }

    /* Inspired btn */
    var btnInspired = document.getElementById('btn-inspired');
    if (btnInspired) {
      btnInspired.addEventListener('click', function () {
        btnInspired.classList.toggle('active');
        var target = allReviews.length > 0
          ? document.getElementById('art-reviews-list-wrap')
          : document.getElementById('art-review-form-wrap');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    loadStats();
  })();


  /* ════════════════════════════════════════════════════════
     NEWSLETTER FORMS
  ════════════════════════════════════════════════════════ */
  function initNewsletterForms() {
    var nlForm  = document.getElementById('article-nl-form');
    var nlEmail = document.getElementById('article-nl-email');

    if (nlForm && nlEmail) {
      nlForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var val = nlEmail.value.trim();
        if (!val || !val.includes('@')) return;

        var btn  = nlForm.querySelector('button');
        var orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }

        try {
          var res  = await fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
          });
          var data = await res.json();
          if (data.success) {
            nlEmail.value = '';
            if (btn) {
              btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
              setTimeout(function () { btn.disabled = false; btn.innerHTML = orig; }, 4000);
            }
            showNewsletterPopup();
          } else {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
          }
        } catch (err) {
          if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
      });
    }

    /* Footer newsletter */
    var footerForm  = document.getElementById('newsletter-form-footer');
    var footerEmail = document.getElementById('newsletter-email-footer');

    if (footerForm && footerEmail) {
      footerForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var val = footerEmail.value.trim();
        if (!val || !val.includes('@')) return;

        var btn  = footerForm.querySelector('button');
        var orig = btn ? btn.textContent : '';
        if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

        try {
          var res  = await fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
          });
          var data = await res.json();
          if (data.success) { footerEmail.value = ''; showNewsletterPopup(); }
        } catch (err) { console.error(err); }
        finally {
          if (btn) { btn.textContent = orig; btn.disabled = false; }
        }
      });
    }
  }

  function showNewsletterPopup() {
    var popup = document.getElementById('newsletter-popup');
    if (popup) {
      popup.classList.add('show');
      setTimeout(function () { popup.classList.remove('show'); }, 8000);
      var closeBtn = document.getElementById('popup-close-btn');
      if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
    }
  }


  /* ════════════════════════════════════════════════════════
     HERO PARALLAX
  ════════════════════════════════════════════════════════ */
  function initHeroParallax() {
    var heroImg = document.getElementById('hero-image');
    if (!heroImg || window.innerWidth < 768) return;

    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY;
      var heroEl  = document.getElementById('article-hero');
      if (!heroEl || scrollY > heroEl.offsetHeight) return;
      heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.30) + 'px)';
    }, { passive: true });
  }


  /* ════════════════════════════════════════════════════════
     SCROLL REVEAL
  ════════════════════════════════════════════════════════ */
  function initScrollReveal() {
    var revealEls = document.querySelectorAll(
      '.article-section, .article-takeaways, .article-mid-cta, ' +
      '.article-results, .article-author-bio, .article-reactions, ' +
      '.article-share-bottom, .article-newsletter, .related-card, ' +
      '.article-roadmap, .article-habits-grid, .a1-infographic, ' +
      '.habit-card, .roadmap-week, .result-item'
    );

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07 });

    revealEls.forEach(function (el) {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(22px)';
      el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
      observer.observe(el);
    });
  }


  /* ════════════════════════════════════════════════════════
     UTILITIES
  ════════════════════════════════════════════════════════ */
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '';
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j   = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }


  /* ════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════ */
  initProgressBar();
  initSidebarShare();
  initShareButtons();
  initReactions();
  initNewsletterForms();
  initHeroParallax();
  setTimeout(function () {
    buildTOC();
    initScrollReveal();
  }, 200);

});