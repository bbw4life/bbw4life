/* ================================================================
   CURVAFIT — article1.js
================================================================ */

document.addEventListener('DOMContentLoaded', function () {
  // Ajoute cette ligne au tout début :
  if (!document.body.classList.contains('a1-page')) return;

  fetch('/blog/blog-articles.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {

      // ── Find card-1 in the cards array ───────────────────────
      var cardData = null;
      if (data.cards) {
        data.cards.forEach(function (c) {
          if (c.id === 'card-1') cardData = c;
        });
      }

      if (!cardData) {
        console.warn('article1.js: card-1 not found in blog-articles.json');
        return;
      }

      // ── Inject meta tags dynamically ────────────────────────
      var pageTitle = document.getElementById('page-title');
      if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

      var metaDesc = document.getElementById('meta-description');
      if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

      var metaOgTitle = document.getElementById('meta-og-title');
      if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

      var metaOgDesc = document.getElementById('meta-og-desc');
      if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

      var metaOgImage = document.getElementById('meta-og-image');
      if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

      var jsonLd = document.getElementById('json-ld');
      if (jsonLd) {
        var schema = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          'headline': cardData.title,
          'description': cardData.excerpt,
          'image': cardData.image,
          'author': {
            '@type': 'Person',
            'name': cardData.author.name
          },
          'publisher': {
            '@type': 'Organization',
            'name': 'CurvaFit',
            'logo': {
              '@type': 'ImageObject',
              'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png'
            }
          },
          'datePublished': cardData.date,
          'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': 'https://www.curva-fit.com/blog/article1.html'
          }
        };
        jsonLd.textContent = JSON.stringify(schema);
      }

      // ── Hero image ──────────────────────────────────────────
      var heroImg = document.getElementById('hero-image');
      if (heroImg) {
        heroImg.src = cardData.image;
        heroImg.alt = cardData.imageAlt;
        heroImg.style.display = 'block';
      }

      // ── Hero text fields ────────────────────────────────────
      setText('hero-badge',        cardData.badge);
      setText('hero-readtime',     cardData.readTime);
      setText('hero-title',        cardData.title);
      setText('hero-excerpt',      cardData.excerpt);
      setText('hero-date',         cardData.date);
      setText('hero-views',        cardData.views);
      setText('hero-readtime-stat',cardData.readTime);
      setText('breadcrumb-category', cardData.badge);

      // ── Author chip ─────────────────────────────────────────
      var authorImg = document.getElementById('hero-author-img');
      if (authorImg) {
        authorImg.src = cardData.author.image;
        authorImg.alt = cardData.author.name;
      }
      setText('hero-author-name', cardData.author.name);

      // ── Bio section ─────────────────────────────────────────
      var bioImg = document.getElementById('bio-author-img');
      if (bioImg) {
        bioImg.src = cardData.author.image;
        bioImg.alt = cardData.author.name;
      }
      setText('bio-author-name', cardData.author.name);
      setText('conclusion-author-name', cardData.author.name);

      // ── Quick stats strip ───────────────────────────────────
      setText('strip-readtime', cardData.readTime);
      setText('strip-views',    cardData.views + ' reads');
      setText('strip-date',     cardData.date);

      // ── Inject related articles ─────────────────────────────
      injectRelated(data.cards, cardData.category, 'card-1');

    })
    .catch(function (err) {
      console.error('article1.js: error loading blog-articles.json:', err);
    });


  /* ════════════════════════════════════════════════════════════
     2.  RELATED ARTICLES
  ════════════════════════════════════════════════════════════ */
  function injectRelated(cards, currentCategory, currentId) {
    var relatedGrid = document.getElementById('related-grid');
    if (!relatedGrid || !cards || !cards.length) return;

    // Filter out current article, prefer same category
    var sameCategory = cards.filter(function (c) {
      return c.category === currentCategory && c.id !== currentId;
    });
    var others = cards.filter(function (c) {
      return c.category !== currentCategory && c.id !== currentId;
    });

    shuffle(sameCategory);
    shuffle(others);

    var picks = sameCategory.slice(0, 3);
    if (picks.length < 3) {
      picks = picks.concat(others.slice(0, 3 - picks.length));
    }

    relatedGrid.innerHTML = picks.map(function (card) {
      return '<a href="' + card.url + '" class="related-card">' +
        '<div class="related-card__img-wrap">' +
          '<img src="' + card.image + '" alt="' + card.imageAlt + '" loading="lazy">' +
          '<span class="related-card__badge">' + card.badge + '</span>' +
        '</div>' +
        '<div class="related-card__body">' +
          '<h3 class="related-card__title">' + card.title + '</h3>' +
          '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
          '<div class="related-card__meta">' +
            '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
            '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
            '<span class="related-card__cta">Read Article →</span>' +
          '</div>' +
        '</div>' +
      '</a>';
    }).join('');
  }


  /* ════════════════════════════════════════════════════════════
     3.  TABLE OF CONTENTS (auto-built from h2s)
  ════════════════════════════════════════════════════════════ */
  function buildTOC() {
    var tocNav   = document.getElementById('toc-nav');
    if (!tocNav) return;
    var headings = document.querySelectorAll('.article-content h2');
    if (!headings.length) return;

    var links = [];

    headings.forEach(function (h2, i) {
      if (!h2.id) h2.id = 'toc-heading-' + i;
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

    // Highlight active section
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var found = links.find(function (l) { return l.el === entry.target; });
        if (found) found.link.classList.toggle('active', entry.isIntersecting);
      });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    links.forEach(function (l) { observer.observe(l.el); });
  }


  /* ════════════════════════════════════════════════════════════
     4.  READING PROGRESS BAR
  ════════════════════════════════════════════════════════════ */
  function initProgressBar() {
    var bar = document.getElementById('reading-progress-bar'); 
    if (!bar) return;

    function updateProgress() {
      var scrollTop  = window.scrollY || document.documentElement.scrollTop;
      var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
      var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      bar.style.width = progress.toFixed(1) + '%';
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }


  /* ════════════════════════════════════════════════════════════
     5.  STICKY SIDEBAR SHARE (appears after hero)
  ════════════════════════════════════════════════════════════ */
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


  /* ════════════════════════════════════════════════════════════
     6.  SHARE BUTTONS (all share btn groups)
  ════════════════════════════════════════════════════════════ */
  function initShareButtons() {
    var url   = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {

      // Copy link
      if (btn.id === 'hero-copy-link' || btn.id === 'bottom-copy-link' ||
          btn.classList.contains('art-share-btn--copy')) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          navigator.clipboard.writeText(window.location.href).then(function () {
            btn.classList.add('copied');
            var icon = btn.querySelector('i');
            var originalClass = icon ? icon.className : '';
            if (icon) icon.className = 'fi fi-rr-check';
            setTimeout(function () {
              btn.classList.remove('copied');
              if (icon) icon.className = originalClass;
            }, 2200);
          }).catch(function () {
            // Fallback
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


  /* ════════════════════════════════════════════════════════════
     7.  REACTIONS (like / inspired / more)
  ════════════════════════════════════════════════════════════ */
  function initReactions() {
    var STORAGE_KEY = 'cf_article_reactions_article1';

    function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
    function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

    var reacted = getReacted();

    document.querySelectorAll('.reaction-btn').forEach(function (btn) {
      var type    = btn.getAttribute('data-reaction');
      var countEl = btn.querySelector('.reaction-btn__count');

      if (reacted === type) btn.classList.add('active');

      btn.addEventListener('click', function () {
        if (reacted && reacted !== type) return;
        var current = parseInt((countEl.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;

        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          if (countEl) countEl.textContent = Math.max(0, current - 1);
          reacted = '';
          saveReacted('');
        } else {
          btn.classList.add('active');
          if (countEl) countEl.textContent = current + 1;
          reacted = type;
          saveReacted(type);
        }
      });
    });
  }


  /* ════════════════════════════════════════════════════════════
     8.  REVIEW SYSTEM (article1)
  ════════════════════════════════════════════════════════════ */
  (function () {
    var ARTICLE_ID       = 'article1';
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
        console.warn('[article1 reviews] loadStats failed:', e.message);
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
        } catch (e) { console.warn('[article1] like failed:', e.message); }
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
      } catch (e) { console.warn('[article1] share failed:', e.message); }
    }

    document.querySelectorAll('.art-share-btn').forEach(function (btn) {
      btn.addEventListener('click', recordShare);
    });

    var btnMore = document.getElementById('btn-more');
    if (btnMore) {
      btnMore.addEventListener('click', function () {
        recordShare();
        var formWrap = document.getElementById('art-review-form-wrap');
        if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          var MAX = 150;
          var w   = img.width, h = img.height;
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
    var stars         = document.querySelectorAll('.art-rv-star');
    var ratingInput   = document.getElementById('art-rv-rating');
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
      textarea.addEventListener('input', function () {
        charNum.textContent = textarea.value.length;
      });
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

        if (!firstName || !lastName) { showError('Please enter your first and last name.'); return; }
        if (rating === 0)            { showError('Please select a star rating.'); return; }
        if (!text || text.length < 10) { showError('Please write at least 10 characters in your review.'); return; }

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

    function escHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* Inspired btn — scroll to form */
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


  /* ════════════════════════════════════════════════════════════
     9.  NEWSLETTER FORMS
  ════════════════════════════════════════════════════════════ */
  function initNewsletterForms() {
    // Mid-article newsletter
    var nlForm  = document.getElementById('article-nl-form');
    var nlEmail = document.getElementById('article-nl-email');

    if (nlForm && nlEmail) {
      nlForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var val = nlEmail.value.trim();
        if (!val || !val.includes('@')) return;

        var btn          = nlForm.querySelector('button');
        var originalHTML = btn ? btn.innerHTML : '';
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
              setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
            }
            showNewsletterPopup();
          } else {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        } catch (err) {
          if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          console.error('Newsletter error:', err);
        }
      });
    }

    // Footer newsletter
    var footerForm  = document.getElementById('newsletter-form-footer');
    var footerEmail = document.getElementById('newsletter-email-footer');

    if (footerForm && footerEmail) {
      footerForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var val = footerEmail.value.trim();
        if (!val || !val.includes('@')) return;

        var btn          = footerForm.querySelector('button');
        var originalText = btn ? btn.textContent : '';
        if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

        try {
          var res  = await fetch('/.netlify/functions/save-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
          });
          var data = await res.json();
          if (data.success) {
            footerEmail.value = '';
            showNewsletterPopup();
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (btn) { btn.textContent = originalText; btn.disabled = false; }
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


  /* ════════════════════════════════════════════════════════════
     10. HERO PARALLAX
  ════════════════════════════════════════════════════════════ */
  function initHeroParallax() {
    var heroImg = document.getElementById('hero-image');
    if (!heroImg || window.innerWidth < 768) return;

    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY;
      var heroEl  = document.getElementById('article-hero');
      if (!heroEl) return;
      if (scrollY > heroEl.offsetHeight) return;
      heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.30) + 'px)';
    }, { passive: true });
  }


  /* ════════════════════════════════════════════════════════════
     11. SCROLL REVEAL ANIMATIONS
  ════════════════════════════════════════════════════════════ */
  function initScrollReveal() {
    var revealEls = document.querySelectorAll(
      '.article-section, .article-takeaways, .article-mid-cta, ' +
      '.article-results, .article-author-bio, .article-reactions, ' +
      '.article-share-bottom, .article-newsletter, .related-card, ' +
      '.a1-infographic, .a1-hormone-card, .a1-framework-pillar'
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


  /* ════════════════════════════════════════════════════════════
     UTILS
  ════════════════════════════════════════════════════════════ */
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j   = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }


  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */
  initProgressBar();
  initSidebarShare();
  initShareButtons();
  initReactions();
  initNewsletterForms();
  initHeroParallax();

  // Delayed to allow DOM injection from blog-articles.json
  setTimeout(function () {
    buildTOC();
    initScrollReveal();
  }, 200);

});


/* ================================================================
   ARTICLE 2 — "Nourishing Meals That Honor Your Curves"
================================================================ */

(function () {

  // Only run on article2
  if (!document.body.classList.contains('a2-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-2
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-2') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a2]: card-2 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article2.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a2-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a2setText('a2-hero-badge',    cardData.badge);
        a2setText('a2-hero-readtime', cardData.readTime);
        a2setText('a2-hero-title',    cardData.title);
        a2setText('a2-hero-excerpt',  cardData.excerpt);
        a2setText('a2-hero-date',     cardData.date);
        a2setText('a2-hero-views',    cardData.views + ' reads');
        a2setText('a2-breadcrumb-cat', cardData.badge);

        var authorImg = document.getElementById('a2-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }
        a2setText('a2-hero-author-name', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a2-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a2setText('a2-bio-name',         cardData.author.name);
        a2setText('a2-conclusion-author', cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a2setText('a2-ribbon-readtime', cardData.readTime);
        a2setText('a2-ribbon-views',    cardData.views + ' reads');
        a2setText('a2-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a2InjectRelated(data.cards, cardData.category, 'card-2');

      })
      .catch(function (err) {
        console.error('articles.js [a2]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a2InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a2-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a2Shuffle(sameCategory);
      a2Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a2BuildTOC() {
      var tocNav   = document.getElementById('a2-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a2-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a2-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a2InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a2InitSidebarShare() {
      var stickyShare = document.getElementById('a2-sticky-share');
      var hero        = document.getElementById('a2-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a2InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a2-share-btn').forEach(function (btn) {

        // Copy link
        if (btn.id === 'a2-hero-copy' || btn.id === 'a2-bottom-copy' ||
            btn.classList.contains('a2-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a2-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a2-share-btn--pi')) {
            var imgEl = document.getElementById('a2-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a2-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a2-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a2InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article2';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a2-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article2';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a2setCount('a2-count-helpful',  data.likes);
          a2setCount('a2-count-inspired', data.reviewsCount);
          a2setCount('a2-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a2 reviews] loadStats failed:', e.message);
        }
      }

      function a2setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a2-btn-helpful');
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
            if (data.success) a2setCount('a2-count-helpful', data.likes);
          } catch (e) { console.warn('[a2] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a2setCount('a2-count-more', data.shares);
        } catch (e) { console.warn('[a2] share failed:', e.message); }
      }

      document.querySelectorAll('.a2-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a2-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a2-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a2-rv-avatar-input');
      var avatarWrap   = document.getElementById('a2-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a2-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a2-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a2-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a2-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a2-rv-text');
      var charNum  = document.getElementById('a2-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a2-art-review-form');
      var submitBtn  = document.getElementById('a2-rv-submit');
      var errorEl    = document.getElementById('a2-rv-error');
      var successEl  = document.getElementById('a2-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a2-rv-firstname').value.trim();
          var lastName  = document.getElementById('a2-rv-lastname').value.trim();
          var text      = document.getElementById('a2-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)        { showError('Please enter your first and last name.'); return; }
          if (rating === 0)                   { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)      { showError('Please write at least 10 characters.'); return; }

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
              a2setCount('a2-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a2-art-reviews-list-wrap');
      var listEl      = document.getElementById('a2-art-reviews-list');
      var countLabel  = document.getElementById('a2-rv-count-label');
      var loadMoreBtn = document.getElementById('a2-rv-load-more');

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
              '<span class="art-rv-card__name">' + a2EscHtml(rv.firstName) + ' ' + a2EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a2EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a2EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // Inspired btn scroll to reviews/form
      var btnInspired = document.getElementById('a2-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a2-art-reviews-list-wrap')
            : document.getElementById('a2-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a2InitNewsletterForms() {
      // Mid-article
      var nlForm  = document.getElementById('a2-article-nl-form');
      var nlEmail = document.getElementById('a2-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a2ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer (shared across all articles — only attach if not already attached)
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a2Bound) {
        footerForm.dataset.a2Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a2ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a2ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX (image panel)
    ════════════════════════════════════════════════════════════ */
    function a2InitHeroParallax() {
      var heroImg = document.getElementById('a2-hero-img');
      if (!heroImg || window.innerWidth < 900) return;

      var hero = document.getElementById('a2-hero');
      window.addEventListener('scroll', function () {
        if (!hero) return;
        var scrollY = window.scrollY;
        if (scrollY > hero.offsetHeight) return;
        heroImg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.20) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a2InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a2-section, .a2-takeaways, .a2-pullquote, .a2-mid-cta, ' +
        '.a2-author-bio, .a2-reactions, .a2-food-card, ' +
        '.a2-pitfall, .a2-pillar-card, .a2-day-card, .a2-plate-visual, ' +
        '.a2-timing-card, .a2-figure, .a2-callout, .a2-hunger-scale, ' +
        '#a2-article-reactions, #a2-article-share-bottom, #a2-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING CARDS ENTRANCE ANIMATION
    ════════════════════════════════════════════════════════════ */
    function a2AnimateFloatCards() {
      var cards = document.querySelectorAll('.a2-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.9)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 800 + i * 300);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a2setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a2Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a2EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a2InitProgressBar();
    a2InitSidebarShare();
    a2InitShareButtons();
    a2InitReactions();
    a2InitNewsletterForms();
    a2InitHeroParallax();
    a2AnimateFloatCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a2BuildTOC();
      a2InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE



/* ================================================================
   CURVAFIT — ARTICLE 3 script
================================================================ */

(function () {
  'use strict';

  /* Run only on article3 page */
  if (!document.getElementById('a3-affirmation-strip') && !document.getElementById('a3-affirmation-track')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-3 specific
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-3') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [article3]: card-3 not found in blog-articles.json');
          return;
        }

        /* ── Meta tags ───────────────────────────────────────── */
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article3.html' }
          });
        }

        /* ── Hero image ──────────────────────────────────────── */
        var heroImg = document.getElementById('hero-image');
        if (heroImg) {
          heroImg.src = cardData.image;
          heroImg.alt = cardData.imageAlt;
          heroImg.style.display = 'block';
        }

        /* ── Hero text ───────────────────────────────────────── */
        setText('hero-badge',           cardData.badge);
        setText('hero-readtime',        cardData.readTime);
        setText('hero-title',           cardData.title);
        setText('hero-excerpt',         cardData.excerpt);
        setText('hero-date',            cardData.date);
        setText('hero-views',           cardData.views);
        setText('hero-readtime-stat',   cardData.readTime);
        setText('breadcrumb-category',  cardData.badge);

        /* ── Author chip ─────────────────────────────────────── */
        var heroAuthorImg = document.getElementById('hero-author-img');
        if (heroAuthorImg) {
          heroAuthorImg.src = cardData.author.image;
          heroAuthorImg.alt = cardData.author.name;
        }
        setText('hero-author-name', cardData.author.name);

        /* ── Bio section ─────────────────────────────────────── */
        var bioImg = document.getElementById('bio-author-img');
        if (bioImg) {
          bioImg.src = cardData.author.image;
          bioImg.alt = cardData.author.name;
        }
        setText('bio-author-name',       cardData.author.name);
        setText('conclusion-author-name', cardData.author.name);

        /* ── Related articles ────────────────────────────────── */
        injectRelated(data.cards, cardData.category, 'card-3');

      })
      .catch(function (err) {
        console.error('articles.js [article3]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function injectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var same   = cards.filter(function (c) { return c.category === currentCategory && c.id !== currentId; });
      var others = cards.filter(function (c) { return c.category !== currentCategory && c.id !== currentId; });

      shuffle(same);
      shuffle(others);

      var picks = same.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + card.imageAlt + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function buildTOC() {
      var tocNav   = document.getElementById('toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.article-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a3-heading-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
        a.textContent = h2.textContent;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var target = document.getElementById(h2.id);
          if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function initProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function update() {
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0).toFixed(1) + '%';
      }
      window.addEventListener('scroll', update, { passive: true });
      update();
    }


    /* ════════════════════════════════════════════════════════════
       5.  SIDEBAR SHARE STICKY
    ════════════════════════════════════════════════════════════ */
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


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function initShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.art-share-btn').forEach(function (btn) {

        /* Copy link */
        if (btn.classList.contains('art-share-btn--copy')) {
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
              document.body.appendChild(ta); ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
            });
          });
          return;
        }

        /* Social */
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('art-share-btn--fb'))
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          else if (btn.classList.contains('art-share-btn--pi')) {
            var imgEl = document.getElementById('hero-image');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + encodeURIComponent(imgEl ? imgEl.src : '');
          } else if (btn.classList.contains('art-share-btn--wa'))
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          else if (btn.classList.contains('art-share-btn--tw'))
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;

          if (shareUrl !== '#') window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  DAILY AFFIRMATION ROTATOR (Sidebar)
    ════════════════════════════════════════════════════════════ */
    function initDailyAffirmation() {
      var affirmations = [
        '"I am worthy of love exactly as I am."',
        '"My body carries me through every beautiful day."',
        '"I celebrate every step of my journey."',
        '"My curves tell a story of strength."',
        '"I am allowed to take up space in every room."',
        '"Today I choose compassion over criticism."',
        '"I am more than what I weigh or what I look like."',
        '"My beauty already exists — it is not a project."',
        '"I treat my body as the partner it truly is."',
        '"Every day of practice is a gift I give my future self."',
        '"I forgive myself and begin again with gentleness."',
        '"I am exactly where my journey needs me to be."'
      ];

      var quoteEl = document.getElementById('a3-daily-quote');
      var nextBtn = document.getElementById('a3-next-affirmation');
      if (!quoteEl || !nextBtn) return;

      /* Pick today's default by date index */
      var today   = new Date();
      var dayIdx  = (today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate()) % affirmations.length;
      var current = dayIdx;

      quoteEl.textContent = affirmations[current];

      nextBtn.addEventListener('click', function () {
        current = (current + 1) % affirmations.length;
        quoteEl.style.opacity = '0';
        quoteEl.style.transform = 'translateY(6px)';
        setTimeout(function () {
          quoteEl.textContent = affirmations[current];
          quoteEl.style.opacity = '1';
          quoteEl.style.transform = 'translateY(0)';
        }, 250);
      });

      quoteEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    }


    /* ════════════════════════════════════════════════════════════
       8.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function initReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article3';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('.reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;

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


    /* ════════════════════════════════════════════════════════════
       9.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article3';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

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
        } catch (e) { console.warn('[article3 reviews] loadStats failed:', e.message); }
      }

      function setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      var btnHelpful = document.getElementById('btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID }) });
            var data = await res.json();
            if (data.success) setCount('count-helpful', data.likes);
          } catch (e) { console.warn('[article3] like failed:', e.message); }
        });
      }

      async function recordShare() {
        try {
          var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID }) });
          var data = await res.json();
          if (data.success) setCount('count-more', data.shares);
        } catch (e) { console.warn('[article3] share failed:', e.message); }
      }

      document.querySelectorAll('.art-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var target = allReviews.length > 0
            ? document.getElementById('art-reviews-list-wrap')
            : document.getElementById('art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

      /* Submit */
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

          if (!firstName || !lastName) { showError('Please enter your first and last name.'); return; }
          if (rating === 0)            { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters in your review.'); return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'add-review', articleId: ARTICLE_ID, firstName, lastName, avatar: avatarBase64, text, rating })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              setCount('count-inspired', data.reviewsCount);
              allReviews.unshift({ firstName, lastName, avatar: avatarBase64, text, rating, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) });
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
        for (var i = 1; i <= 5; i++) starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        card.innerHTML = avatarHTML + '<div class="art-rv-card__body"><div class="art-rv-card__top"><span class="art-rv-card__name">' + escHtml(rv.firstName) + ' ' + escHtml(rv.lastName) + '</span><span class="art-rv-card__date">' + escHtml(rv.date || '') + '</span></div><div class="art-rv-card__stars">' + starsHTML + '</div><p class="art-rv-card__text">' + escHtml(rv.text) + '</p></div>';
        return card;
      }

      function escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      var btnInspired = document.getElementById('btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0 ? document.getElementById('art-reviews-list-wrap') : document.getElementById('art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       10. NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function initNewsletterForms() {
      var nlForm  = document.getElementById('article-nl-form');
      var nlEmail = document.getElementById('article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = nlForm.querySelector('button');
          var orig = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) {
              nlEmail.value = '';
              if (btn) { btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!'; setTimeout(function () { btn.disabled = false; btn.innerHTML = orig; }, 4000); }
              showNewsletterPopup();
            } else { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
          } catch (err) { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
        });
      }

      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');
      if (footerForm && footerEmail) {
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = footerForm.querySelector('button');
          var orig = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; showNewsletterPopup(); }
          } catch (err) { console.error(err); } finally { if (btn) { btn.textContent = orig; btn.disabled = false; } }
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


    /* ════════════════════════════════════════════════════════════
       11. HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function initHeroParallax() {
      var heroImg = document.getElementById('hero-image');
      if (!heroImg || window.innerWidth < 768) return;
      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        var heroEl  = document.getElementById('article-hero');
        if (!heroEl || scrollY > heroEl.offsetHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.28) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       12. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function initScrollReveal() {
      var els = document.querySelectorAll(
        '.article-section, .article-takeaways, .article-mid-cta, ' +
        '.article-results, .article-author-bio, .article-reactions, ' +
        '.article-share-bottom, .article-newsletter, .related-card, ' +
        '.a3-confidence-model, .a3-aff-block, .a3-ritual-day, .a3-compare-card'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      els.forEach(function (el) {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       13. AFFIRMATION LIST — click-to-highlight
    ════════════════════════════════════════════════════════════ */
    function initAffirmationHighlight() {
      document.querySelectorAll('.a3-aff-list li').forEach(function (li) {
        li.addEventListener('click', function () {
          var wasSelected = li.classList.contains('a3-aff-selected');
          /* Clear all */
          document.querySelectorAll('.a3-aff-list li').forEach(function (l) {
            l.classList.remove('a3-aff-selected');
            l.style.background = '';
          });
          if (!wasSelected) {
            li.classList.add('a3-aff-selected');
            li.style.background = 'rgba(192, 56, 94, 0.10)';
            li.style.borderLeft = '3px solid #c0385e';
            li.style.paddingLeft = '11px';
          }
        });
        li.style.cursor = 'pointer';
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    initProgressBar();
    initSidebarShare();
    initShareButtons();
    initReactions();
    initNewsletterForms();
    initHeroParallax();
    initDailyAffirmation();

    setTimeout(function () {
      buildTOC();
      initScrollReveal();
      initAffirmationHighlight();
    }, 200);

  });

})();


/* ================================================================
   ARTICLE 4 — "Understanding and Overcoming Emotional Eating Triggers"
================================================================ */

(function () {

  // Only run on article4
  if (!document.body.classList.contains('a4-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-4
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-4') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a4]: card-4 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article4.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroBgImg = document.getElementById('a4-hero-bg-img');
        if (heroBgImg) { heroBgImg.src = cardData.image; heroBgImg.alt = cardData.imageAlt || cardData.title; }

        var heroImg = document.getElementById('a4-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a4setText('a4-hero-badge',    cardData.badge);
        a4setText('a4-hero-readtime', cardData.readTime);
        a4setText('a4-hero-views',    cardData.views + ' reads');
        a4setText('a4-hero-date',     cardData.date);
        a4setText('a4-hero-author-name',  cardData.author.name);
        a4setText('a4-hero-author-name2', cardData.author.name);
        a4setText('a4-hero-excerpt',  cardData.excerpt);
        a4setText('a4-breadcrumb-cat', cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a4-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        var authorImg = document.getElementById('a4-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar author name ────────────────────────────────
        a4setText('a4-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a4-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a4setText('a4-bio-name',          cardData.author.name);
        a4setText('a4-conclusion-author', cardData.author.name);
        a4setText('a4-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a4setText('a4-ribbon-readtime', cardData.readTime);
        a4setText('a4-ribbon-views',    cardData.views + ' reads');
        a4setText('a4-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a4InjectRelated(data.cards, cardData.category, 'card-4');

      })
      .catch(function (err) {
        console.error('articles.js [a4]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a4InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a4-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a4Shuffle(sameCategory);
      a4Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a4BuildTOC() {
      var tocNav   = document.getElementById('a4-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a4-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a4-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a4InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a4InitSidebarShare() {
      var stickyShare = document.getElementById('a4-sticky-share');
      var hero        = document.getElementById('a4-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a4InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a4-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a4-hero-copy' || btn.id === 'a4-bottom-copy' ||
            btn.classList.contains('a4-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a4-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a4-share-btn--pi')) {
            var imgEl = document.getElementById('a4-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a4-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a4-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a4InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article4';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a4-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article4';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a4setCount('a4-count-helpful',  data.likes);
          a4setCount('a4-count-inspired', data.reviewsCount);
          a4setCount('a4-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a4 reviews] loadStats failed:', e.message);
        }
      }

      function a4setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a4-btn-helpful');
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
            if (data.success) a4setCount('a4-count-helpful', data.likes);
          } catch (e) { console.warn('[a4] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a4setCount('a4-count-more', data.shares);
        } catch (e) { console.warn('[a4] share failed:', e.message); }
      }

      document.querySelectorAll('.a4-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a4-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a4-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a4-rv-avatar-input');
      var avatarWrap   = document.getElementById('a4-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a4-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a4-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a4-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a4-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a4-rv-text');
      var charNum  = document.getElementById('a4-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a4-art-review-form');
      var submitBtn  = document.getElementById('a4-rv-submit');
      var errorEl    = document.getElementById('a4-rv-error');
      var successEl  = document.getElementById('a4-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a4-rv-firstname').value.trim();
          var lastName  = document.getElementById('a4-rv-lastname').value.trim();
          var text      = document.getElementById('a4-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)        { showError('Please enter your first and last name.'); return; }
          if (rating === 0)                   { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)      { showError('Please write at least 10 characters.'); return; }

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
              a4setCount('a4-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a4-art-reviews-list-wrap');
      var listEl      = document.getElementById('a4-art-reviews-list');
      var countLabel  = document.getElementById('a4-rv-count-label');
      var loadMoreBtn = document.getElementById('a4-rv-load-more');

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
              '<span class="art-rv-card__name">' + a4EscHtml(rv.firstName) + ' ' + a4EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a4EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a4EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I feel seen" btn — scroll to reviews or form
      var btnInspired = document.getElementById('a4-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a4-art-reviews-list-wrap')
            : document.getElementById('a4-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a4InitNewsletterForms() {
      var nlForm  = document.getElementById('a4-article-nl-form');
      var nlEmail = document.getElementById('a4-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a4ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a4Bound) {
        footerForm.dataset.a4Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a4ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a4ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a4InitHeroParallax() {
      var heroBg = document.querySelector('.a4-hero__bg img');
      if (!heroBg || window.innerWidth < 900) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroBg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.15) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a4InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a4-section, .a4-discover, .a4-pullquote, .a4-mid-cta, ' +
        '.a4-author-bio, .a4-trigger-card, .a4-compare-card, ' +
        '.a4-method-step, .a4-toolkit-group, .a4-compassion-item, ' +
        '.a4-week-card, .a4-cycle-visual, .a4-pause-card, ' +
        '.a4-callout, .a4-figure, ' +
        '#a4-article-reactions, #a4-article-share-bottom, #a4-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a4AnimateFloatCards() {
      var cards = document.querySelectorAll('.a4-float-insight');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 1000 + i * 400);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a4setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      // Also try single element by id (for backwards compat)
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a4Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a4EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a4InitProgressBar();
    a4InitSidebarShare();
    a4InitShareButtons();
    a4InitReactions();
    a4InitNewsletterForms();
    a4InitHeroParallax();
    a4AnimateFloatCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a4BuildTOC();
      a4InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE


/* ================================================================
   ARTICLE 5 — "Managing PCOS Symptoms with Gentle Lifestyle Changes"
================================================================ */

(function () {

  // Only run on article5
  if (!document.body.classList.contains('a5-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-5
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-5') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a5]: card-5 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article5.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a5-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a5setText('a5-hero-badge',       cardData.badge);
        a5setText('a5-hero-readtime',    cardData.readTime);
        a5setText('a5-hero-views',       cardData.views + ' reads');
        a5setText('a5-hero-date',        cardData.date);
        a5setText('a5-hero-author-name', cardData.author.name);
        a5setText('a5-hero-excerpt',     cardData.excerpt);
        a5setText('a5-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a5-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a5-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar author name ────────────────────────────────
        a5setText('a5-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a5-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a5setText('a5-bio-name',          cardData.author.name);
        a5setText('a5-conclusion-author', cardData.author.name);
        a5setText('a5-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a5setText('a5-ribbon-readtime', cardData.readTime);
        a5setText('a5-ribbon-views',    cardData.views + ' reads');
        a5setText('a5-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a5InjectRelated(data.cards, cardData.category, 'card-5');

      })
      .catch(function (err) {
        console.error('articles.js [a5]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a5InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a5-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a5Shuffle(sameCategory);
      a5Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a5BuildTOC() {
      var tocNav   = document.getElementById('a5-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a5-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a5-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a5InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a5InitSidebarShare() {
      var stickyShare = document.getElementById('a5-sticky-share');
      var hero        = document.getElementById('a5-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a5InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a5-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a5-hero-copy' || btn.id === 'a5-bottom-copy' ||
            btn.classList.contains('a5-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a5-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a5-share-btn--pi')) {
            var imgEl = document.getElementById('a5-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a5-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a5-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a5InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article5';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a5-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article5';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a5setCount('a5-count-helpful',  data.likes);
          a5setCount('a5-count-inspired', data.reviewsCount);
          a5setCount('a5-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a5 reviews] loadStats failed:', e.message);
        }
      }

      function a5setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a5-btn-helpful');
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
            if (data.success) a5setCount('a5-count-helpful', data.likes);
          } catch (e) { console.warn('[a5] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a5setCount('a5-count-more', data.shares);
        } catch (e) { console.warn('[a5] share failed:', e.message); }
      }

      document.querySelectorAll('.a5-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a5-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a5-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a5-rv-avatar-input');
      var avatarWrap   = document.getElementById('a5-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a5-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a5-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a5-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a5-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a5-rv-text');
      var charNum  = document.getElementById('a5-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a5-art-review-form');
      var submitBtn  = document.getElementById('a5-rv-submit');
      var errorEl    = document.getElementById('a5-rv-error');
      var successEl  = document.getElementById('a5-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a5-rv-firstname').value.trim();
          var lastName  = document.getElementById('a5-rv-lastname').value.trim();
          var text      = document.getElementById('a5-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

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
              a5setCount('a5-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a5-art-reviews-list-wrap');
      var listEl      = document.getElementById('a5-art-reviews-list');
      var countLabel  = document.getElementById('a5-rv-count-label');
      var loadMoreBtn = document.getElementById('a5-rv-load-more');

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
              '<span class="art-rv-card__name">' + a5EscHtml(rv.firstName) + ' ' + a5EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a5EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a5EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I feel seen" btn
      var btnInspired = document.getElementById('a5-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a5-art-reviews-list-wrap')
            : document.getElementById('a5-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a5InitNewsletterForms() {
      var nlForm  = document.getElementById('a5-article-nl-form');
      var nlEmail = document.getElementById('a5-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a5ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a5Bound) {
        footerForm.dataset.a5Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a5ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a5ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO IMAGE PARALLAX (right panel)
    ════════════════════════════════════════════════════════════ */
    function a5InitHeroParallax() {
      var heroImg = document.querySelector('.a5-hero__img');
      if (!heroImg || window.innerWidth < 960) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a5InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a5-section, .a5-discover, .a5-pullquote, .a5-mid-cta, ' +
        '.a5-author-bio, .a5-mechanism-card, .a5-foods-card, ' +
        '.a5-exercise-card, .a5-pillar-card, .a5-supp-card, ' +
        '.a5-proto-week, .a5-cascade-visual, .a5-callout, .a5-figure, ' +
        '#a5-article-reactions, #a5-article-share-bottom, #a5-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a5AnimateFloatCards() {
      var cards = document.querySelectorAll('.a5-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 1000 + i * 400);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a5setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a5Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a5EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a5InitProgressBar();
    a5InitSidebarShare();
    a5InitShareButtons();
    a5InitReactions();
    a5InitNewsletterForms();
    a5InitHeroParallax();
    a5AnimateFloatCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a5BuildTOC();
      a5InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE



/* ================================================================
   ARTICLE 6 — "Understanding and Overcoming Emotional Eating Triggers"
================================================================ */

(function () {

  // Only run on article6
  if (!document.body.classList.contains('a6-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-4
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-6') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a6]: card-4 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article6.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a6-hero-img');
        if (heroImg) {
          heroImg.src = cardData.image;
          heroImg.alt = cardData.imageAlt || cardData.title;
        }

        a6setText('a6-hero-badge',       cardData.badge);
        a6setText('a6-hero-readtime',    cardData.readTime);
        a6setText('a6-hero-views',       cardData.views + ' reads');
        a6setText('a6-hero-date',        cardData.date);
        a6setText('a6-hero-author-name', cardData.author.name);
        a6setText('a6-hero-excerpt',     cardData.excerpt);
        a6setText('a6-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a6-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a6-hero-author-img');
        if (authorImg) {
          authorImg.src = cardData.author.image;
          authorImg.alt = cardData.author.name;
        }

        // ── Sidebar author ─────────────────────────────────────
        a6setText('a6-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a6-bio-img');
        if (bioImg) {
          bioImg.src = cardData.author.image;
          bioImg.alt = cardData.author.name;
        }
        a6setText('a6-bio-name',          cardData.author.name);
        a6setText('a6-conclusion-author', cardData.author.name);
        a6setText('a6-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a6setText('a6-ribbon-readtime', cardData.readTime);
        a6setText('a6-ribbon-views',    cardData.views + ' reads');
        a6setText('a6-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a6InjectRelated(data.cards, cardData.category, 'card-4');

      })
      .catch(function (err) {
        console.error('articles.js [a6]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a6InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a6-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a6Shuffle(sameCategory);
      a6Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a6BuildTOC() {
      var tocNav = document.getElementById('a6-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a6-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a6-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a6InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a6InitSidebarShare() {
      var stickyShare = document.getElementById('a6-sticky-share');
      var hero        = document.getElementById('a6-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a6InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a6-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a6-hero-copy' || btn.id === 'a6-bottom-copy' ||
            btn.classList.contains('a6-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a6-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a6-share-btn--pi')) {
            var imgEl = document.getElementById('a6-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a6-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a6-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a6InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article6';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a6-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article6';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a6setCount('a6-count-helpful',  data.likes);
          a6setCount('a6-count-inspired', data.reviewsCount);
          a6setCount('a6-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a6 reviews] loadStats failed:', e.message);
        }
      }

      function a6setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a6-btn-helpful');
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
            if (data.success) a6setCount('a6-count-helpful', data.likes);
          } catch (e) { console.warn('[a6] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a6setCount('a6-count-more', data.shares);
        } catch (e) { console.warn('[a6] share failed:', e.message); }
      }

      document.querySelectorAll('.a6-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a6-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a6-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a6-rv-avatar-input');
      var avatarWrap   = document.getElementById('a6-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a6-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a6-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a6-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a6-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a6-rv-text');
      var charNum  = document.getElementById('a6-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a6-art-review-form');
      var submitBtn  = document.getElementById('a6-rv-submit');
      var errorEl    = document.getElementById('a6-rv-error');
      var successEl  = document.getElementById('a6-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a6-rv-firstname').value.trim();
          var lastName  = document.getElementById('a6-rv-lastname').value.trim();
          var text      = document.getElementById('a6-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

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
              a6setCount('a6-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a6-art-reviews-list-wrap');
      var listEl      = document.getElementById('a6-art-reviews-list');
      var countLabel  = document.getElementById('a6-rv-count-label');
      var loadMoreBtn = document.getElementById('a6-rv-load-more');

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
              '<span class="art-rv-card__name">' + a6EscHtml(rv.firstName) + ' ' + a6EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a6EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a6EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I feel seen" btn → scroll to reviews
      var btnInspired = document.getElementById('a6-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a6-art-reviews-list-wrap')
            : document.getElementById('a6-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a6InitNewsletterForms() {
      var nlForm  = document.getElementById('a6-article-nl-form');
      var nlEmail = document.getElementById('a6-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a6ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a6Bound) {
        footerForm.dataset.a6Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a6ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a6ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX — subtle on scroll
    ════════════════════════════════════════════════════════════ */
    function a6InitHeroParallax() {
      var heroImg = document.querySelector('.a6-hero__img');
      if (!heroImg || window.innerWidth < 960) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.10) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a6InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a6-section, .a6-discover, .a6-pullquote, .a6-mid-cta, ' +
        '.a6-author-bio, .a6-two-col__card, .a6-hunger-card, ' +
        '.a6-mindful-card, .a6-trigger-card, .a6-reset-week, ' +
        '.a6-loop-visual, .a6-callout, .a6-check-steps, ' +
        '#a6-article-reactions, #a6-article-share-bottom, #a6-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(28px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOAT CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a6AnimateEmotionCards() {
      var cards = document.querySelectorAll('.a6-emotion-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.90)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 380);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a6setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a6Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a6EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a6InitProgressBar();
    a6InitSidebarShare();
    a6InitShareButtons();
    a6InitReactions();
    a6InitNewsletterForms();
    a6InitHeroParallax();
    a6AnimateEmotionCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a6BuildTOC();
      a6InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE


/* ================================================================
   ARTICLE 7 — "Effective Home Workouts Tailored for Curvy Figures"
================================================================ */

(function () {

  // Only run on article7
  if (!document.body.classList.contains('a7-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1. LOAD DATA FROM blog-articles.json — card-7
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-7') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a7]: card-7 not found in blog-articles.json');
          return;
        }

        /* ── Meta tags ─────────────────────────────────────── */
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        /* ── JSON-LD ───────────────────────────────────────── */
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article7.html' }
          });
        }

        /* ── Hero fields ───────────────────────────────────── */
        var heroImg = document.getElementById('a7-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a7setText('a7-hero-badge',       cardData.badge);
        a7setText('a7-hero-readtime',    cardData.readTime);
        a7setText('a7-hero-views',       cardData.views + ' reads');
        a7setText('a7-hero-date',        cardData.date);
        a7setText('a7-hero-author-name', cardData.author.name);
        a7setText('a7-hero-excerpt',     cardData.excerpt);
        a7setText('a7-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a7-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        var authorImg = document.getElementById('a7-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        /* ── Sidebar author ────────────────────────────────── */
        a7setText('a7-sidebar-author', cardData.author.name);

        /* ── Quote attribution ─────────────────────────────── */
        a7setText('a7-quote-author-1', '— ' + cardData.author.name + ', Fitness Coach');

        /* ── Conclusion ────────────────────────────────────── */
        var conclusionImg = document.getElementById('a7-conclusion-author-img');
        if (conclusionImg) { conclusionImg.src = cardData.author.image; conclusionImg.alt = cardData.author.name; }
        a7setText('a7-conclusion-author-name', cardData.author.name);

        /* ── Author bio ────────────────────────────────────── */
        var bioImg = document.getElementById('a7-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a7setText('a7-bio-name', cardData.author.name);

        /* ── Related articles ──────────────────────────────── */
        a7InjectRelated(data.cards, cardData.category, 'card-7');
      })
      .catch(function (err) {
        console.error('articles.js [a7]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2. RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a7InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a7-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a7Shuffle(sameCategory);
      a7Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3. TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a7BuildTOC() {
      var tocNav   = document.getElementById('a7-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a7-body h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a7-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4. READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a7InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop  = window.scrollY || document.documentElement.scrollTop;
        var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
        var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
        bar.style.background = 'linear-gradient(90deg, #1e5c36, #c9903a)';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5. STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a7InitSidebarShare() {
      var stickyShare = document.getElementById('a7-sticky-share');
      var hero        = document.getElementById('a7-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6. SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a7InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a7-share-btn').forEach(function (btn) {

        // Copy link
        if (btn.id === 'a7-hero-copy' || btn.id === 'a7-bottom-copy' ||
            (btn.classList.contains('a7-share-btn--copy') && btn.tagName === 'BUTTON')) {

          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a7-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a7-share-btn--pi')) {
            var imgEl = document.getElementById('a7-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a7-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a7-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7. HERO IMAGE PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a7InitParallax() {
      var heroImg = document.querySelector('.a7-hero__img');
      if (!heroImg || window.innerWidth < 900) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       8. TICKER PAUSE ON HOVER (already CSS, JS for accessibility)
    ════════════════════════════════════════════════════════════ */
    function a7InitTicker() {
      var ticker = document.querySelector('.a7-ticker');
      if (!ticker) return;
      ticker.setAttribute('role', 'marquee');
      ticker.setAttribute('aria-label', 'Article topics');
    }


    /* ════════════════════════════════════════════════════════════
       9. FLOAT CARD ENTRANCE ANIMATION
    ════════════════════════════════════════════════════════════ */
    function a7AnimateFloatCards() {
      var cards = document.querySelectorAll('.a7-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(18px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 350);
      });
    }


    /* ════════════════════════════════════════════════════════════
       10. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a7InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a7-section, .a7-lede-block, .a7-editorial-quote, ' +
        '.a7-principle, .a7-workout-card, .a7-timeline-body, ' +
        '.a7-obstacle, .a7-mid-cta, .a7-nutrition-card, ' +
        '.a7-conclusion, .a7-author-bio, ' +
        '#a7-article-reactions, #a7-article-share-bottom, #a7-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       11. REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a7InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article7';

      function getReacted()       { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type)  { try { localStorage.setItem(STORAGE_KEY, type); }         catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a7-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article7';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a7setCount('a7-count-helpful',  data.likes);
          a7setCount('a7-count-inspired', data.reviewsCount);
          a7setCount('a7-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a7 reviews] loadStats failed:', e.message);
        }
      }

      function a7setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a7-btn-helpful');
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
            if (data.success) a7setCount('a7-count-helpful', data.likes);
          } catch (e) { console.warn('[a7] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a7setCount('a7-count-more', data.shares);
        } catch (e) { console.warn('[a7] share failed:', e.message); }
      }

      document.querySelectorAll('.a7-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a7-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a7-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a7-rv-avatar-input');
      var avatarWrap   = document.getElementById('a7-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a7-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a7-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a7-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a7-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a7-rv-text');
      var charNum  = document.getElementById('a7-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a7-art-review-form');
      var submitBtn  = document.getElementById('a7-rv-submit');
      var errorEl    = document.getElementById('a7-rv-error');
      var successEl  = document.getElementById('a7-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a7-rv-firstname').value.trim();
          var lastName  = document.getElementById('a7-rv-lastname').value.trim();
          var text      = document.getElementById('a7-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)    { showError('Please enter your first and last name.'); return; }
          if (rating === 0)               { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)  { showError('Please write at least 10 characters.'); return; }

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
              a7setCount('a7-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a7-art-reviews-list-wrap');
      var listEl      = document.getElementById('a7-art-reviews-list');
      var countLabel  = document.getElementById('a7-rv-count-label');
      var loadMoreBtn = document.getElementById('a7-rv-load-more');

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
              '<span class="art-rv-card__name">' + a7EscHtml(rv.firstName) + ' ' + a7EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a7EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a7EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I'm starting today" btn
      var btnInspired = document.getElementById('a7-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a7-art-reviews-list-wrap')
            : document.getElementById('a7-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       13. NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a7InitNewsletterForms() {
      var nlForm  = document.getElementById('a7-article-nl-form');
      var nlEmail = document.getElementById('a7-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a7ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a7Bound) {
        footerForm.dataset.a7Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a7ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a7ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       UTILITIES
    ════════════════════════════════════════════════════════════ */
    function a7setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a7Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a7EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a7InitProgressBar();
    a7InitSidebarShare();
    a7InitShareButtons();
    a7InitReactions();
    a7InitNewsletterForms();
    a7InitParallax();
    a7InitTicker();
    a7AnimateFloatCards();

    // Delayed to allow JSON injection
    setTimeout(function () {
      a7BuildTOC();
      a7InitScrollReveal();
    }, 220);

  }); // end DOMContentLoaded

})(); // end IIFE


/* ================================================================
   ARTICLE 8 — "Real Journeys: How One Curvy Woman Found Balance"
================================================================ */

(function () {

  // Only run on article8
  if (!document.body.classList.contains('a8-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1. LOAD DATA FROM blog-articles.json — card-8
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-8') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a8]: card-8 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article8.html' }
          });
        }

        // ── Hero images ────────────────────────────────────────
        var heroBg = document.getElementById('a8-hero-bg');
        if (heroBg) { heroBg.src = cardData.image; heroBg.alt = cardData.imageAlt || cardData.title; }

        var heroPortrait = document.getElementById('a8-hero-portrait');
        if (heroPortrait) { heroPortrait.src = cardData.image; heroPortrait.alt = cardData.imageAlt || cardData.title; }

        // Figure inside article
        var figureImg     = document.getElementById('a8-figure-img');
        var figureCaption = document.getElementById('a8-figure-caption');
        if (figureImg) { figureImg.src = cardData.image; figureImg.alt = cardData.imageAlt || cardData.title; }
        if (figureCaption) figureCaption.textContent = (cardData.imageAlt || 'Her story is proof that balance is not the absence of hard days — it\'s the presence of self-compassion on those days.');

        // ── Hero text fields ───────────────────────────────────
        a8setText('a8-hero-badge',       cardData.badge);
        a8setText('a8-hero-badge-bc',    cardData.badge);
        a8setText('a8-hero-readtime',    cardData.readTime);
        a8setText('a8-hero-views',       cardData.views + ' reads');
        a8setText('a8-hero-date',        cardData.date);
        a8setText('a8-hero-author-chip', cardData.author.name);
        a8setText('a8-hero-author-name', cardData.author.name);
        a8setText('a8-hero-excerpt',     cardData.excerpt);

        // ── Hero title — inject author-driven title ────────────
        var heroTitle = document.getElementById('a8-hero-title');
        if (heroTitle) {
          heroTitle.innerHTML =
            'Real Journeys:<br>' +
            '<em>How One Curvy Woman</em><br>' +
            'Found Balance';
        }

        // New badge
        var newBadge = document.getElementById('a8-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a8-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar ────────────────────────────────────────────
        a8setText('a8-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a8-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a8setText('a8-bio-name',  cardData.author.name);
        a8setText('a8-bio-name2', cardData.author.name);

        // ── Pullquote cite ─────────────────────────────────────
        a8setText('a8-pullquote-author', cardData.author.name);

        // ── Final message author ───────────────────────────────
        var msgAuthorImg = document.getElementById('a8-msg-author-img');
        if (msgAuthorImg) { msgAuthorImg.src = cardData.author.image; msgAuthorImg.alt = cardData.author.name; }
        a8setText('a8-msg-author-name', cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a8setText('a8-ribbon-readtime', cardData.readTime);
        a8setText('a8-ribbon-views',    cardData.views + ' reads');
        a8setText('a8-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a8InjectRelated(data.cards, cardData.category, 'card-8');

      })
      .catch(function (err) {
        console.error('articles.js [a8]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2. RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a8InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a8-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a8Shuffle(sameCategory);
      a8Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + a8EscHtml(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + a8EscHtml(card.badge) + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + a8EscHtml(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + a8EscHtml(card.excerpt) + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + a8EscHtml(card.readTime) + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + a8EscHtml(card.views) + '</span>' +
              '<span class="related-card__cta">Read Story →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3. TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a8BuildTOC() {
      var tocNav   = document.getElementById('a8-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a8-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a8-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4. READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a8InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop  = window.scrollY || document.documentElement.scrollTop;
        var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
        var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5. STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a8InitSidebarShare() {
      var stickyShare = document.getElementById('a8-sticky-share');
      var hero        = document.getElementById('a8-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6. SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a8InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a8-share-btn').forEach(function (btn) {

        // Copy buttons
        if (btn.id === 'a8-hero-copy' || btn.id === 'a8-bottom-copy' ||
            btn.classList.contains('a8-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a8-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a8-share-btn--pi')) {
            var imgEl = document.getElementById('a8-hero-portrait');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a8-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a8-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7. QUOTES SLIDER
    ════════════════════════════════════════════════════════════ */
    function a8InitQuotesSlider() {
      var quotes  = document.querySelectorAll('.a8-quotes-band__quote');
      var dots    = document.querySelectorAll('.a8-q-dot');
      var btnPrev = document.getElementById('a8-q-prev');
      var btnNext = document.getElementById('a8-q-next');
      if (!quotes.length) return;

      var current = 0;

      function goTo(idx) {
        quotes[current].classList.remove('active');
        dots[current] && dots[current].classList.remove('active');
        current = (idx + quotes.length) % quotes.length;
        quotes[current].classList.add('active');
        dots[current] && dots[current].classList.add('active');
      }

      if (btnPrev) btnPrev.addEventListener('click', function () { goTo(current - 1); });
      if (btnNext) btnNext.addEventListener('click', function () { goTo(current + 1); });

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          goTo(parseInt(dot.getAttribute('data-q'), 10));
        });
      });

      // Auto-advance every 5 seconds
      var autoSlide = setInterval(function () { goTo(current + 1); }, 5000);

      // Pause on hover
      var band = document.querySelector('.a8-quotes-band');
      if (band) {
        band.addEventListener('mouseenter', function () { clearInterval(autoSlide); });
        band.addEventListener('mouseleave', function () {
          autoSlide = setInterval(function () { goTo(current + 1); }, 5000);
        });
      }
    }


    /* ════════════════════════════════════════════════════════════
       8. REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a8InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article8';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a8-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       9. REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article8';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a8setCount('a8-count-helpful',  data.likes);
          a8setCount('a8-count-inspired', data.reviewsCount);
          a8setCount('a8-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a8 reviews] loadStats failed:', e.message);
        }
      }

      function a8setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a8-btn-helpful');
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
            if (data.success) a8setCount('a8-count-helpful', data.likes);
          } catch (e) { console.warn('[a8] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a8setCount('a8-count-more', data.shares);
        } catch (e) { console.warn('[a8] share failed:', e.message); }
      }

      document.querySelectorAll('.a8-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a8-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a8-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // I feel seen button
      var btnInspired = document.getElementById('a8-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a8-art-reviews-list-wrap')
            : document.getElementById('a8-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar compression
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

      var avatarInput  = document.getElementById('a8-rv-avatar-input');
      var avatarWrap   = document.getElementById('a8-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a8-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a8-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a8-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a8-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a8-rv-text');
      var charNum  = document.getElementById('a8-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a8-art-review-form');
      var submitBtn  = document.getElementById('a8-rv-submit');
      var errorEl    = document.getElementById('a8-rv-error');
      var successEl  = document.getElementById('a8-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a8-rv-firstname').value.trim();
          var lastName  = document.getElementById('a8-rv-lastname').value.trim();
          var text      = document.getElementById('a8-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

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
              a8setCount('a8-count-inspired', data.reviewsCount);

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

              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Response submitted!';
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

      // Reviews list
      var listWrap    = document.getElementById('a8-art-reviews-list-wrap');
      var listEl      = document.getElementById('a8-art-reviews-list');
      var countLabel  = document.getElementById('a8-rv-count-label');
      var loadMoreBtn = document.getElementById('a8-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (allReviews.length === 0) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' response' + (allReviews.length > 1 ? 's' : '');

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
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + a8EscHtml(rv.firstName) + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';

        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }

        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a8EscHtml(rv.firstName) + ' ' + a8EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a8EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a8EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       10. NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a8InitNewsletterForms() {
      var nlForm  = document.getElementById('a8-article-nl-form');
      var nlEmail = document.getElementById('a8-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a8ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');
      if (footerForm && footerEmail && !footerForm.dataset.a8Bound) {
        footerForm.dataset.a8Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a8ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a8ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       11. HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a8InitHeroParallax() {
      var heroBg = document.querySelector('.a8-hero__backdrop img');
      if (!heroBg || window.innerWidth < 900) return;
      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroBg.style.transform = 'scale(1.06) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       12. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a8InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a8-section, .a8-discover, .a8-pullquote, .a8-mid-cta,' +
        '.a8-author-bio, .a8-ritual-card, .a8-setback-card,' +
        '.a8-timeline, .a8-quotes-band, .a8-community-visual,' +
        '.a8-final-message, .a8-story-callout, .a8-figure,' +
        '#a8-article-reactions, #a8-article-share-bottom, #a8-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(28px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       13. FLOATING CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a8AnimateFloatCards() {
      var cards = document.querySelectorAll('.a8-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 1000 + i * 400);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a8setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a8Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a8EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a8InitProgressBar();
    a8InitSidebarShare();
    a8InitShareButtons();
    a8InitReactions();
    a8InitNewsletterForms();
    a8InitHeroParallax();
    a8InitQuotesSlider();
    a8AnimateFloatCards();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a8BuildTOC();
      a8InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE


/* ================================================================
   ARTICLE 9 — "Creating Routines That Last: Habits for Lifelong Wellness"
================================================================ */

(function () {

  // Only run on article9
  if (!document.body.classList.contains('a9-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-9
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-9') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a9]: card-9 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article9.html' }
          });
        }

        // ── Hero ───────────────────────────────────────────────
        var heroImg = document.getElementById('a9-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a9setText('a9-hero-badge',       cardData.badge);
        a9setText('a9-hero-readtime',    cardData.readTime);
        a9setText('a9-hero-views',       cardData.views + ' reads');
        a9setText('a9-hero-date',        cardData.date);
        a9setText('a9-hero-excerpt',     cardData.excerpt);
        a9setText('a9-breadcrumb-cat',   cardData.badge);

        // Show/hide "New" badge
        var newBadge = document.getElementById('a9-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author
        var authorImg = document.getElementById('a9-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }
        a9setText('a9-hero-author-name', cardData.author.name);

        // ── Sidebar ────────────────────────────────────────────
        a9setText('a9-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a9-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a9setText('a9-bio-name',          cardData.author.name);
        a9setText('a9-conclusion-author', cardData.author.name);
        a9setText('a9-pullquote-author',  cardData.author.name);

        // ── Bar ────────────────────────────────────────────────
        a9setText('a9-bar-readtime', cardData.readTime);
        a9setText('a9-bar-views',    cardData.views + ' reads');
        a9setText('a9-bar-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a9InjectRelated(data.cards, cardData.category, 'card-9');

      })
      .catch(function (err) {
        console.error('articles.js [a9]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a9InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a9-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a9Shuffle(sameCategory);
      a9Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a9BuildTOC() {
      var tocNav   = document.getElementById('a9-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a9-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a9-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a9InitProgressBar() {
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


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a9InitSidebarShare() {
      var stickyShare = document.getElementById('a9-sticky-share');
      var hero        = document.getElementById('a9-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a9InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a9-share-btn').forEach(function (btn) {

        // Copy link buttons
        if (btn.id === 'a9-hero-copy' || btn.id === 'a9-bottom-copy' ||
            btn.classList.contains('a9-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a9-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a9-share-btn--pi')) {
            var imgEl = document.getElementById('a9-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a9-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a9-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  INTERACTIVE HABIT TRACKER (Sidebar)
    ════════════════════════════════════════════════════════════ */
    function a9InitHabitTracker() {
      var checkboxes = document.querySelectorAll('.a9-tracker-item input[type="checkbox"]');
      var fill       = document.getElementById('a9-tracker-fill');
      var label      = document.getElementById('a9-tracker-label');
      if (!checkboxes.length || !fill || !label) return;

      var STORAGE_KEY = 'cf_a9_habit_tracker_' + new Date().toDateString();
      var saved = [];
      try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) {}

      // Restore from localStorage
      checkboxes.forEach(function (cb, i) {
        if (saved.indexOf(i) !== -1) {
          cb.checked = true;
          cb.closest('label').style.textDecoration = 'line-through';
          cb.closest('label').style.opacity = '0.6';
        }
      });

      function updateTracker() {
        var done = 0;
        checkboxes.forEach(function (cb) { if (cb.checked) done++; });
        var pct = Math.round((done / checkboxes.length) * 100);
        fill.style.width = pct + '%';
        label.textContent = done + ' / ' + checkboxes.length + ' today';
        // Save
        var checkedIds = [];
        checkboxes.forEach(function (cb, i) { if (cb.checked) checkedIds.push(i); });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedIds)); } catch (e) {}
      }

      checkboxes.forEach(function (cb) {
        cb.addEventListener('change', function () {
          var lbl = cb.closest('label');
          if (cb.checked) {
            lbl.style.textDecoration = 'line-through';
            lbl.style.opacity = '0.6';
          } else {
            lbl.style.textDecoration = '';
            lbl.style.opacity = '';
          }
          updateTracker();
        });
      });

      updateTracker();
    }


    /* ════════════════════════════════════════════════════════════
       8.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a9InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article9';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a9-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       9.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article9';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a9setCount('a9-count-helpful',  data.likes);
          a9setCount('a9-count-inspired', data.reviewsCount);
          a9setCount('a9-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a9 reviews] loadStats failed:', e.message);
        }
      }

      function a9setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a9-btn-helpful');
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
            if (data.success) a9setCount('a9-count-helpful', data.likes);
          } catch (e) { console.warn('[a9] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a9setCount('a9-count-more', data.shares);
        } catch (e) { console.warn('[a9] share failed:', e.message); }
      }

      document.querySelectorAll('.a9-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a9-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a9-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a9-rv-avatar-input');
      var avatarWrap   = document.getElementById('a9-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a9-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a9-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a9-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a9-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a9-rv-text');
      var charNum  = document.getElementById('a9-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a9-art-review-form');
      var submitBtn  = document.getElementById('a9-rv-submit');
      var errorEl    = document.getElementById('a9-rv-error');
      var successEl  = document.getElementById('a9-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a9-rv-firstname').value.trim();
          var lastName  = document.getElementById('a9-rv-lastname').value.trim();
          var text      = document.getElementById('a9-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)        { showError('Please enter your first and last name.'); return; }
          if (rating === 0)                   { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)      { showError('Please write at least 10 characters.'); return; }

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
              a9setCount('a9-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a9-art-reviews-list-wrap');
      var listEl      = document.getElementById('a9-art-reviews-list');
      var countLabel  = document.getElementById('a9-rv-count-label');
      var loadMoreBtn = document.getElementById('a9-rv-load-more');

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
              '<span class="art-rv-card__name">' + a9EscHtml(rv.firstName) + ' ' + a9EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a9EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a9EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // "I'm inspired" btn
      var btnInspired = document.getElementById('a9-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a9-art-reviews-list-wrap')
            : document.getElementById('a9-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       10.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a9InitNewsletterForms() {
      var nlForm  = document.getElementById('a9-article-nl-form');
      var nlEmail = document.getElementById('a9-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a9ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a9Bound) {
        footerForm.dataset.a9Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a9ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a9ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       11.  HERO PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a9InitHeroParallax() {
      var heroImg = document.querySelector('.a9-hero__img-wrap img');
      if (!heroImg || window.innerWidth < 960) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.12) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       12.  SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a9InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a9-section, .a9-discover, .a9-pullquote, .a9-mid-cta, ' +
        '.a9-author-bio, .a9-seed-card, .a9-layer, .a9-routine-card, ' +
        '.a9-recovery-step, .a9-killer-card, .a9-blueprint-phase, ' +
        '.a9-loop-visual, ' +
        '#a9-article-reactions, #a9-article-share-bottom, #a9-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a9setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a9Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a9EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a9InitProgressBar();
    a9InitSidebarShare();
    a9InitShareButtons();
    a9InitHabitTracker();
    a9InitReactions();
    a9InitNewsletterForms();
    a9InitHeroParallax();

    // Delayed to let JSON injection settle
    setTimeout(function () {
      a9BuildTOC();
      a9InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE


/* ================================================================
   ARTICLE 10 — "Caloric Deficit Without Deprivation"
================================================================ */

(function () {

  if (!document.body.classList.contains('a10-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-10
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-10') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a10]: card-10 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article10.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a10-hero-img');
        if (heroImg) { heroImg.src = cardData.image; heroImg.alt = cardData.imageAlt || cardData.title; }

        a10setText('a10-hero-badge',       cardData.badge);
        a10setText('a10-hero-readtime',    cardData.readTime);
        a10setText('a10-hero-views',       cardData.views + ' reads');
        a10setText('a10-hero-date',        cardData.date);
        a10setText('a10-hero-author-name', cardData.author.name);
        a10setText('a10-hero-excerpt',     cardData.excerpt);
        a10setText('a10-breadcrumb-cat',   cardData.badge);

        // New badge visibility
        var newBadge = document.getElementById('a10-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a10-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar ────────────────────────────────────────────
        a10setText('a10-sidebar-author-name', cardData.author.name);
        var sidebarAuthorImg = document.getElementById('a10-sidebar-author-img');
        if (sidebarAuthorImg) { sidebarAuthorImg.src = cardData.author.image; sidebarAuthorImg.alt = cardData.author.name; }

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a10-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }
        a10setText('a10-bio-name',          cardData.author.name);
        a10setText('a10-conclusion-author', cardData.author.name);
        a10setText('a10-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a10setText('a10-ribbon-readtime', cardData.readTime);
        a10setText('a10-ribbon-views',    cardData.views + ' reads');
        a10setText('a10-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a10InjectRelated(data.cards, cardData.category, 'card-10');

      })
      .catch(function (err) {
        console.error('articles.js [a10]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a10InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a10-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a10Shuffle(sameCategory);
      a10Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + a10EscHtml(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + a10EscHtml(card.badge) + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + a10EscHtml(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + a10EscHtml(card.excerpt) + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + a10EscHtml(card.readTime) + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + a10EscHtml(card.views) + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a10BuildTOC() {
      var tocNav   = document.getElementById('a10-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a10-article h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a10-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a10InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop  = window.scrollY || document.documentElement.scrollTop;
        var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
        var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a10InitSidebarShare() {
      var stickyShare = document.getElementById('a10-sticky-share');
      var hero        = document.getElementById('a10-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a10InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a10-share-btn').forEach(function (btn) {

        if (btn.id === 'a10-hero-copy' || btn.id === 'a10-bottom-copy' ||
            btn.classList.contains('a10-share-btn--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a10-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a10-share-btn--pi')) {
            var imgEl = document.getElementById('a10-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a10-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a10-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a10InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article10';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); } catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a10-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article10';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a10setCount('a10-count-helpful',  data.likes);
          a10setCount('a10-count-inspired', data.reviewsCount);
          a10setCount('a10-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a10 reviews] loadStats failed:', e.message);
        }
      }

      function a10setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      var btnHelpful = document.getElementById('a10-btn-helpful');
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
            if (data.success) a10setCount('a10-count-helpful', data.likes);
          } catch (e) { console.warn('[a10] like failed:', e.message); }
        });
      }

      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a10setCount('a10-count-more', data.shares);
        } catch (e) { console.warn('[a10] share failed:', e.message); }
      }

      document.querySelectorAll('.a10-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a10-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a10-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

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

      var avatarInput  = document.getElementById('a10-rv-avatar-input');
      var avatarWrap   = document.getElementById('a10-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a10-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a10-rv-avatar-placeholder');

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

      var stars          = document.querySelectorAll('#a10-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a10-rv-rating');
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

      var textarea = document.getElementById('a10-rv-text');
      var charNum  = document.getElementById('a10-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      var reviewForm = document.getElementById('a10-art-review-form');
      var submitBtn  = document.getElementById('a10-rv-submit');
      var errorEl    = document.getElementById('a10-rv-error');
      var successEl  = document.getElementById('a10-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a10-rv-firstname').value.trim();
          var lastName  = document.getElementById('a10-rv-lastname').value.trim();
          var text      = document.getElementById('a10-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

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
              a10setCount('a10-count-inspired', data.reviewsCount);

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

      var listWrap    = document.getElementById('a10-art-reviews-list-wrap');
      var listEl      = document.getElementById('a10-art-reviews-list');
      var countLabel  = document.getElementById('a10-rv-count-label');
      var loadMoreBtn = document.getElementById('a10-rv-load-more');

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
          ? '<img class="art-rv-card__avatar" src="' + rv.avatar + '" alt="' + a10EscHtml(rv.firstName) + '" loading="lazy">'
          : '<div class="art-rv-card__avatar-placeholder">' + (rv.firstName || '?').charAt(0).toUpperCase() + '</div>';
        var rating = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) {
          starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        }
        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a10EscHtml(rv.firstName) + ' ' + a10EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a10EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a10EscHtml(rv.text) + '</p>' +
          '</div>';
        return card;
      }

      var btnInspired = document.getElementById('a10-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a10-art-reviews-list-wrap')
            : document.getElementById('a10-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a10InitNewsletterForms() {
      var nlForm  = document.getElementById('a10-article-nl-form');
      var nlEmail = document.getElementById('a10-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a10ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a10Bound) {
        footerForm.dataset.a10Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a10ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a10ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX (background image)
    ════════════════════════════════════════════════════════════ */
    function a10InitHeroParallax() {
      var heroImg = document.querySelector('.a10-hero__bg-img');
      if (!heroImg || window.innerWidth < 960) return;
      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.08) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. TDEE BAR ANIMATION (animate widths on scroll)
    ════════════════════════════════════════════════════════════ */
    function a10InitTDEEBars() {
      var bars = document.querySelectorAll('.a10-tdee-bar__fill');
      if (!bars.length) return;

      var animated = false;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !animated) {
            animated = true;
            bars.forEach(function (bar) {
              var targetWidth = bar.style.width;
              bar.style.width = '0';
              setTimeout(function () { bar.style.width = targetWidth; }, 100);
            });
            observer.disconnect();
          }
        });
      }, { threshold: 0.3 });

      var tdeeVisual = document.querySelector('.a10-tdee-visual');
      if (tdeeVisual) observer.observe(tdeeVisual);
    }


    /* ════════════════════════════════════════════════════════════
       12. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a10InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a10-section, .a10-learn-box, .a10-pullquote, .a10-mid-cta, ' +
        '.a10-author-bio, .a10-cascade, .a10-tdee-visual, .a10-callout, ' +
        '.a10-figure, .a10-cycle-visual, .a10-zones-grid, .a10-muscle-card, ' +
        '.a10-strategy, .a10-reverse-step, .a10-protocol-week, ' +
        '#a10-article-reactions, #a10-article-share-bottom, #a10-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a10setText(id, text) {
      var els = document.querySelectorAll('#' + id);
      els.forEach(function (el) { el.textContent = text; });
    }

    function a10Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a10EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a10InitProgressBar();
    a10InitSidebarShare();
    a10InitShareButtons();
    a10InitReactions();
    a10InitNewsletterForms();
    a10InitHeroParallax();
    a10InitTDEEBars();

    setTimeout(function () {
      a10BuildTOC();
      a10InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE


/* ================================================================
   ARTICLE 11 — "Why Protein and Fiber Are Your Two Most Powerful Allies"
================================================================ */

(function () {

  if (!document.body.classList.contains('a11-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-11
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-11') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a11]: card-11 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article11.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroBg = document.getElementById('a11-hero-bg');
        if (heroBg) { heroBg.src = cardData.image; heroBg.alt = cardData.imageAlt || cardData.title; }

        a11setText('a11-hero-badge',       cardData.badge);
        a11setText('a11-hero-readtime',    cardData.readTime);
        a11setText('a11-hero-views',       cardData.views + ' reads');
        a11setText('a11-hero-date',        cardData.date);
        a11setText('a11-hero-author-name', cardData.author.name);
        a11setText('a11-hero-excerpt',     cardData.excerpt);
        a11setText('a11-breadcrumb-cat',   cardData.badge);

        var newBadge = document.getElementById('a11-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        var authorImg = document.getElementById('a11-hero-author-img');
        if (authorImg) { authorImg.src = cardData.author.image; authorImg.alt = cardData.author.name; }

        // ── Sidebar & bio ──────────────────────────────────────
        a11setText('a11-sidebar-author',    cardData.author.name);
        a11setText('a11-pullquote-author',  cardData.author.name);
        a11setText('a11-conclusion-author', cardData.author.name);
        a11setText('a11-bio-name',          cardData.author.name);

        var bioImg = document.getElementById('a11-bio-img');
        if (bioImg) { bioImg.src = cardData.author.image; bioImg.alt = cardData.author.name; }

        // ── Ribbon ─────────────────────────────────────────────
        a11setText('a11-ribbon-readtime', cardData.readTime);
        a11setText('a11-ribbon-views',    cardData.views + ' reads');
        a11setText('a11-ribbon-date',     cardData.date);

        // ── Related ────────────────────────────────────────────
        a11InjectRelated(data.cards, cardData.category, 'card-11');

      })
      .catch(function (err) {
        console.error('articles.js [a11]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a11InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a11-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a11Shuffle(sameCategory);
      a11Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a11BuildTOC() {
      var tocNav   = document.getElementById('a11-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a11-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a11-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a11InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function update() {
        var s = window.scrollY || document.documentElement.scrollTop;
        var d = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (d > 0 ? Math.min((s / d) * 100, 100) : 0).toFixed(1) + '%';
      }
      window.addEventListener('scroll', update, { passive: true });
      update();
    }


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a11InitSidebarShare() {
      var stickyShare = document.getElementById('a11-sticky-share');
      var hero        = document.getElementById('a11-hero');
      if (!stickyShare || !hero) return;

      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { stickyShare.classList.toggle('visible', !e.isIntersecting); });
      }, { threshold: 0 }).observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a11InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a11-share-btn').forEach(function (btn) {

        if (btn.classList.contains('a11-share-btn--copy') ||
            btn.id === 'a11-hero-copy' || btn.id === 'a11-bottom-copy') {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              var icon = btn.querySelector('i');
              var orig = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () { if (icon) icon.className = orig; }, 2200);
            }).catch(function () {
              var ta = document.createElement('textarea');
              ta.value = window.location.href;
              document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            });
          });
          return;
        }

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a11-share-btn--fb'))   shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          else if (btn.classList.contains('a11-share-btn--pi')) {
            var img = encodeURIComponent((document.getElementById('a11-hero-bg') || {}).src || '');
            shareUrl = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          }
          else if (btn.classList.contains('a11-share-btn--wa')) shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          else if (btn.classList.contains('a11-share-btn--tw')) shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          if (shareUrl !== '#') window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a11InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article11';
      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch(e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); } catch(e) {} }
      var reacted = getReacted();

      document.querySelectorAll('#a11-article-reactions .reaction-btn').forEach(function (btn) {
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


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article11';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;
          a11setCount('a11-count-helpful',  data.likes);
          a11setCount('a11-count-inspired', data.reviewsCount);
          a11setCount('a11-count-more',     data.shares);
          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) { console.warn('[a11 reviews] loadStats failed:', e.message); }
      }

      function a11setCount(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }

      var btnHelpful = document.getElementById('a11-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID }) });
            var data = await res.json();
            if (data.success) a11setCount('a11-count-helpful', data.likes);
          } catch (e) { console.warn('[a11] like failed:', e.message); }
        });
      }

      async function recordShare() {
        try {
          var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID }) });
          var data = await res.json();
          if (data.success) a11setCount('a11-count-more', data.shares);
        } catch (e) {}
      }

      document.querySelectorAll('.a11-share-btn').forEach(function (btn) { btn.addEventListener('click', recordShare); });

      var btnMore = document.getElementById('a11-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var fw = document.getElementById('a11-art-review-form-wrap');
          if (fw) fw.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

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

      var avatarInput  = document.getElementById('a11-rv-avatar-input');
      var avatarWrap   = document.getElementById('a11-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a11-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a11-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64; avatarPrev.style.display = 'block'; avatarPlaceh.style.display = 'none';
          }
        });
      }

      var stars          = document.querySelectorAll('#a11-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a11-rv-rating');
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
        star.addEventListener('click',     function () { selectedRating = parseInt(star.dataset.val); if (ratingInput) ratingInput.value = selectedRating; paintStars(selectedRating); });
      });

      var textarea = document.getElementById('a11-rv-text');
      var charNum  = document.getElementById('a11-rv-char-num');
      if (textarea && charNum) textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });

      var reviewForm = document.getElementById('a11-art-review-form');
      var submitBtn  = document.getElementById('a11-rv-submit');
      var errorEl    = document.getElementById('a11-rv-error');
      var successEl  = document.getElementById('a11-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var firstName = document.getElementById('a11-rv-firstname').value.trim();
          var lastName  = document.getElementById('a11-rv-lastname').value.trim();
          var text      = document.getElementById('a11-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');
          if (errorEl) errorEl.style.display = 'none';
          if (successEl) successEl.style.display = 'none';
          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';
          try {
            var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-review', articleId: ARTICLE_ID, firstName, lastName, avatar: avatarBase64, text, rating }) });
            var data = await res.json();
            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a11setCount('a11-count-inspired', data.reviewsCount);
              allReviews.unshift({ firstName, lastName, avatar: avatarBase64, text, rating, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) });
              renderReviews(true);
              reviewForm.reset(); selectedRating = 0; paintStars(0); avatarBase64 = '';
              if (avatarPrev)   { avatarPrev.style.display = 'none'; avatarPrev.src = ''; }
              if (avatarPlaceh) avatarPlaceh.style.display = 'flex';
              if (charNum)      charNum.textContent = '0';
              submitBtn.innerHTML = '<i class="fi fi-rr-check-circle"></i> Review submitted!';
              setTimeout(function () { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review'; if (successEl) successEl.style.display = 'none'; }, 4000);
            } else {
              showError('Error: ' + (data.error || 'Unknown error'));
              submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
            }
          } catch (err) {
            showError('Network error. Please try again.');
            submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Submit Review';
          }
        });
      }

      function showError(msg) { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } }

      var listWrap    = document.getElementById('a11-art-reviews-list-wrap');
      var listEl      = document.getElementById('a11-art-reviews-list');
      var countLabel  = document.getElementById('a11-rv-count-label');
      var loadMoreBtn = document.getElementById('a11-rv-load-more');

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
        for (var i = 1; i <= 5; i++) starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        card.innerHTML = avatarHTML + '<div class="art-rv-card__body"><div class="art-rv-card__top"><span class="art-rv-card__name">' + a11EscHtml(rv.firstName) + ' ' + a11EscHtml(rv.lastName) + '</span><span class="art-rv-card__date">' + a11EscHtml(rv.date || '') + '</span></div><div class="art-rv-card__stars">' + starsHTML + '</div><p class="art-rv-card__text">' + a11EscHtml(rv.text) + '</p></div>';
        return card;
      }

      var btnInspired = document.getElementById('a11-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0 ? document.getElementById('a11-art-reviews-list-wrap') : document.getElementById('a11-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a11InitNewsletterForms() {
      var nlForm  = document.getElementById('a11-article-nl-form');
      var nlEmail = document.getElementById('a11-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = nlForm.querySelector('button');
          var orig = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing...'; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) {
              nlEmail.value = '';
              if (btn) { btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!'; setTimeout(function () { btn.disabled = false; btn.innerHTML = orig; }, 4000); }
              a11ShowNlPopup();
            } else { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
          } catch (err) { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
        });
      }

      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');
      if (footerForm && footerEmail && !footerForm.dataset.a11Bound) {
        footerForm.dataset.a11Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = footerForm.querySelector('button');
          var orig = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a11ShowNlPopup(); }
          } catch (err) {}
          finally { if (btn) { btn.textContent = orig; btn.disabled = false; } }
        });
      }
    }

    function a11ShowNlPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO BG PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a11InitParallax() {
      var bg = document.querySelector('.a11-hero__bg img');
      if (!bg || window.innerWidth < 900) return;
      window.addEventListener('scroll', function () {
        if (window.scrollY > window.innerHeight) return;
        bg.style.transform = 'scale(1.06) translateY(' + (window.scrollY * 0.10) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a11InitScrollReveal() {
      var els = document.querySelectorAll(
        '.a11-section, .a11-discover, .a11-pullquote, .a11-mid-cta, ' +
        '.a11-author-bio, .a11-failure-card, .a11-science-track, ' +
        '.a11-target-card, .a11-sources-card, .a11-plate-visual, ' +
        '.a11-meal-card, .a11-callout, .a11-figure, .a11-day-totals, ' +
        '#a11-article-reactions, #a11-article-share-bottom, #a11-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      els.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.62s ease, transform 0.62s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING SCIENCE CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a11AnimateSciCards() {
      document.querySelectorAll('.a11-sci-card').forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(20px) scale(0.92)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 350);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a11setText(id, text) {
      document.querySelectorAll('#' + id).forEach(function (el) { el.textContent = text; });
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a11Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    function a11EscHtml(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a11InitProgressBar();
    a11InitSidebarShare();
    a11InitShareButtons();
    a11InitReactions();
    a11InitNewsletterForms();
    a11InitParallax();
    a11AnimateSciCards();

    setTimeout(function () {
      a11BuildTOC();
      a11InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE

/* ================================================================
   ARTICLE 12 — "Resistance Training for Plus-Size Women"
================================================================ */

(function () {

  // Guard: only run on article12
  if (!document.body.classList.contains('a12-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-12
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;
        if (data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-12') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a12]: card-12 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author.name },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article12.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a12-hero-img');
        if (heroImg) {
          heroImg.src = cardData.image;
          heroImg.alt = cardData.imageAlt || cardData.title;
        }

        a12setText('a12-hero-badge',       cardData.badge);
        a12setText('a12-hero-readtime',    cardData.readTime);
        a12setText('a12-hero-views',       cardData.views + ' reads');
        a12setText('a12-hero-date',        cardData.date);
        a12setText('a12-hero-author-name', cardData.author.name);
        a12setText('a12-hero-excerpt',     cardData.excerpt);
        a12setText('a12-breadcrumb-cat',   cardData.badge);

        // "New" badge
        var newBadge = document.getElementById('a12-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // Author image
        var authorImg = document.getElementById('a12-hero-author-img');
        if (authorImg) {
          authorImg.src = cardData.author.image;
          authorImg.alt = cardData.author.name;
        }

        // ── Sidebar author ─────────────────────────────────────
        a12setText('a12-sidebar-author', cardData.author.name);

        // ── Bio ────────────────────────────────────────────────
        var bioImg = document.getElementById('a12-bio-img');
        if (bioImg) {
          bioImg.src = cardData.author.image;
          bioImg.alt = cardData.author.name;
        }
        a12setText('a12-bio-name',          cardData.author.name);
        a12setText('a12-conclusion-author', cardData.author.name);
        a12setText('a12-pullquote-author',  cardData.author.name);

        // ── Ribbon ─────────────────────────────────────────────
        a12setText('a12-ribbon-readtime', cardData.readTime);
        a12setText('a12-ribbon-views',    cardData.views + ' reads');
        a12setText('a12-ribbon-date',     cardData.date);

        // ── Related articles ───────────────────────────────────
        a12InjectRelated(data.cards, cardData.category, 'card-12');

      })
      .catch(function (err) {
        console.error('articles.js [a12]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a12InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a12-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a12Shuffle(sameCategory);
      a12Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + card.readTime + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + card.views + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a12BuildTOC() {
      var tocNav = document.getElementById('a12-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a12-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a12-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a12InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop  = window.scrollY || document.documentElement.scrollTop;
        var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
        var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a12InitSidebarShare() {
      var stickyShare = document.getElementById('a12-sticky-share');
      var hero        = document.getElementById('a12-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a12InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a12-share-btn').forEach(function (btn) {

        if (btn.id === 'a12-hero-copy' || btn.id === 'a12-bottom-copy' ||
            btn.classList.contains('a12-share-btn--copy')) {
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a12-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a12-share-btn--pi')) {
            var imgEl = document.getElementById('a12-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a12-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a12-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a12InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article12';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a12-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article12';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a12setCount('a12-count-helpful',  data.likes);
          a12setCount('a12-count-inspired', data.reviewsCount);
          a12setCount('a12-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a12 reviews] loadStats failed:', e.message);
        }
      }

      function a12setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a12-btn-helpful');
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
            if (data.success) a12setCount('a12-count-helpful', data.likes);
          } catch (e) { console.warn('[a12] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a12setCount('a12-count-more', data.shares);
        } catch (e) { console.warn('[a12] share failed:', e.message); }
      }

      document.querySelectorAll('.a12-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a12-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a12-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a12-rv-avatar-input');
      var avatarWrap   = document.getElementById('a12-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a12-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a12-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a12-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a12-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a12-rv-text');
      var charNum  = document.getElementById('a12-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a12-art-review-form');
      var submitBtn  = document.getElementById('a12-rv-submit');
      var errorEl    = document.getElementById('a12-rv-error');
      var successEl  = document.getElementById('a12-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a12-rv-firstname').value.trim();
          var lastName  = document.getElementById('a12-rv-lastname').value.trim();
          var text      = document.getElementById('a12-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

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
              a12setCount('a12-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a12-art-reviews-list-wrap');
      var listEl      = document.getElementById('a12-art-reviews-list');
      var countLabel  = document.getElementById('a12-rv-count-label');
      var loadMoreBtn = document.getElementById('a12-rv-load-more');

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
              '<span class="art-rv-card__name">' + a12EscHtml(rv.firstName) + ' ' + a12EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a12EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a12EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // Inspired btn → scroll to reviews/form
      var btnInspired = document.getElementById('a12-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a12-art-reviews-list-wrap')
            : document.getElementById('a12-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a12InitNewsletterForms() {
      var nlForm  = document.getElementById('a12-article-nl-form');
      var nlEmail = document.getElementById('a12-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a12ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a12Bound) {
        footerForm.dataset.a12Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a12ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a12ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. HERO PARALLAX — title lines on scroll
    ════════════════════════════════════════════════════════════ */
    function a12InitHeroParallax() {
      if (window.innerWidth < 960) return;
      var heroInner = document.querySelector('.a12-hero__inner');
      if (!heroInner) return;

      var lines = document.querySelectorAll('.a12-title-line');
      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        lines.forEach(function (line, i) {
          var speed = 0.04 + i * 0.015;
          line.style.transform = 'translateY(' + (-scrollY * speed) + 'px)';
        });
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       11. BAR CHART ANIMATION — triggered on scroll
    ════════════════════════════════════════════════════════════ */
    function a12InitBarChart() {
      var visual = document.querySelector('.a12-compare-visual');
      if (!visual) return;

      var bars = visual.querySelectorAll('.a12-compare-bar');

      // Initially set width to 0 (CSS handles animation once class is added)
      bars.forEach(function (bar) {
        bar.style.width = '0';
        bar.style.opacity = '0';
      });

      var triggered = false;
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !triggered) {
          triggered = true;
          // Stagger the bar animations
          bars.forEach(function (bar, i) {
            setTimeout(function () {
              bar.style.transition = 'width 1.1s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease';
              bar.style.width = bar.style.getPropertyValue('--w') || getComputedStyle(bar).getPropertyValue('--w') || '50%';
              bar.style.opacity = '1';
            }, i * 140);
          });
          observer.disconnect();
        }
      }, { threshold: 0.25 });

      observer.observe(visual);
    }


    /* ════════════════════════════════════════════════════════════
       12. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a12InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a12-section, .a12-discover, .a12-pullquote, .a12-mid-cta, ' +
        '.a12-author-bio, .a12-safety-card, .a12-exercise-card, ' +
        '.a12-overload-card, .a12-nutrition-card, .a12-program-phase, ' +
        '.a12-compare-visual, .a12-callout, ' +
        '#a12-article-reactions, #a12-article-share-bottom, #a12-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(28px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       13. STAT CHIPS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a12AnimateStatChips() {
      var chips = document.querySelectorAll('.a12-stat-chip');
      chips.forEach(function (chip, i) {
        chip.style.opacity    = '0';
        chip.style.transform  = 'scale(0.85) translateY(12px)';
        chip.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
        setTimeout(function () {
          chip.style.opacity   = '1';
          chip.style.transform = 'scale(1) translateY(0)';
        }, 1100 + i * 350);
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a12setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function a12Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a12EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a12InitProgressBar();
    a12InitSidebarShare();
    a12InitShareButtons();
    a12InitReactions();
    a12InitNewsletterForms();
    a12InitHeroParallax();
    a12AnimateStatChips();
    a12InitBarChart();

    // Delayed for JSON injection to settle
    setTimeout(function () {
      a12BuildTOC();
      a12InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE


/* ================================================================
   ARTICLE 13 — "Cute Workout Clothes for Curvy Gals"
================================================================ */

(function () {

  // Guard: only run on article13
  if (!document.body.classList.contains('a13-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — editorsPicks card-13
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        var cardData = null;

        // Search in editorsPicks
        if (data.editorsPicks) {
          data.editorsPicks.forEach(function (c) {
            if (c.id === 'card-13') cardData = c;
          });
        }

        // Fallback: search in cards array too (just in case)
        if (!cardData && data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-13') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a13]: card-13 not found in blog-articles.json (editorsPicks)');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author ? cardData.author.name : 'CurvaFit' },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date || '',
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article13.html' }
          });
        }

        // ── Hero fields ────────────────────────────────────────
        var heroImg = document.getElementById('a13-hero-img');
        if (heroImg) {
          heroImg.src = cardData.image;
          heroImg.alt = cardData.imageAlt || cardData.title;
        }

        a13setText('a13-hero-badge',    cardData.category || cardData.badge || 'Style & Fitness');
        a13setText('a13-breadcrumb-cat', cardData.category || cardData.badge || 'Style & Fitness');
        a13setText('a13-hero-title',    ''); // title is built via HTML spans; only inject if needed
        a13setText('a13-hero-excerpt',  cardData.excerpt);

        // Date / views / readtime (editorsPicks may not have all fields — fallback gracefully)
        a13setText('a13-hero-date',     cardData.date     || '');
        a13setText('a13-hero-readtime', cardData.readTime || '');
        a13setText('a13-hero-views',    cardData.views    ? cardData.views + ' reads' : '');

        // Ribbon
        a13setText('a13-ribbon-readtime', cardData.readTime || '—');
        a13setText('a13-ribbon-views',    cardData.views    ? cardData.views + ' reads' : '—');

        // Author (editorsPicks items may not have author object — use blog authors array or a sensible fallback)
        var authorName  = '';
        var authorImage = '';
        var authorRole  = '';

        if (cardData.author) {
          authorName  = cardData.author.name  || '';
          authorImage = cardData.author.image || '';
        }

        // If editorsPick has no author, look in data.authors for a matching name or use first author
        if (!authorName && data.authors && data.authors.length > 0) {
          authorName  = data.authors[0].name;
          authorImage = data.authors[0].image;
          authorRole  = data.authors[0].title || '';
        }

        a13setText('a13-hero-author-name',  authorName);
        a13setText('a13-sidebar-author',    authorName);
        a13setText('a13-bio-name',          authorName);
        a13setText('a13-conclusion-author', authorName);
        a13setText('a13-pullquote-author',  authorName);

        var heroAuthorImg = document.getElementById('a13-hero-author-img');
        if (heroAuthorImg && authorImage) {
          heroAuthorImg.src = authorImage;
          heroAuthorImg.alt = authorName;
        }

        var bioImg = document.getElementById('a13-bio-img');
        if (bioImg && authorImage) {
          bioImg.src = authorImage;
          bioImg.alt = authorName;
        }

        // ── Related articles — pull from cards + editorsPicks ──
        var allItems = [];
        if (data.cards)        allItems = allItems.concat(data.cards);
        if (data.editorsPicks) allItems = allItems.concat(data.editorsPicks);

        a13InjectRelated(allItems, cardData.category || 'Style & Fitness', 'card-13');
      })
      .catch(function (err) {
        console.error('articles.js [a13]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a13InjectRelated(items, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a13-related-grid');
      if (!relatedGrid || !items || !items.length) return;

      var sameCategory = items.filter(function (c) {
        return (c.category === currentCategory || c.badge === currentCategory) && c.id !== currentId;
      });
      var others = items.filter(function (c) {
        return c.category !== currentCategory && c.badge !== currentCategory && c.id !== currentId;
      });

      a13Shuffle(sameCategory);
      a13Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        var badge = card.badge || card.category || '';
        return '<a href="' + card.url + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + a13EscHtml(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + a13EscHtml(badge) + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + a13EscHtml(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + a13EscHtml(card.excerpt) + '</p>' +
            '<div class="related-card__meta">' +
              (card.readTime ? '<span><i class="fi fi-rr-clock"></i> ' + a13EscHtml(card.readTime) + '</span>' : '') +
              (card.views    ? '<span><i class="fi fi-rr-eye"></i> '   + a13EscHtml(card.views)    + '</span>' : '') +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a13BuildTOC() {
      var tocNav = document.getElementById('a13-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a13-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a13-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a13InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop = window.scrollY || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var progress  = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
        bar.style.background = 'linear-gradient(90deg, #c0385e, #8e4f72, #f7a08a)';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a13InitSidebarShare() {
      var stickyShare = document.getElementById('a13-sticky-share');
      var hero        = document.getElementById('a13-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a13InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a13-share-btn').forEach(function (btn) {

        if (btn.classList.contains('a13-share-btn--copy') ||
            btn.id === 'a13-hero-copy' ||
            btn.id === 'a13-bottom-copy') {
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a13-share-btn--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a13-share-btn--pi')) {
            var imgEl = document.getElementById('a13-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a13-share-btn--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a13-share-btn--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a13InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article13';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a13-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');

        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var current = parseInt((countEl ? countEl.textContent : '0').replace(/[^0-9]/g, ''), 10) || 0;

          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, current - 1);
            reacted = '';
            saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = current + 1;
            reacted = type;
            saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article13';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a13setCount('a13-count-helpful',  data.likes);
          a13setCount('a13-count-inspired', data.reviewsCount);
          a13setCount('a13-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a13 reviews] loadStats failed:', e.message);
        }
      }

      function a13setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like
      var btnHelpful = document.getElementById('a13-btn-helpful');
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
            if (data.success) a13setCount('a13-count-helpful', data.likes);
          } catch (e) { console.warn('[a13] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a13setCount('a13-count-more', data.shares);
        } catch (e) { console.warn('[a13] share failed:', e.message); }
      }

      document.querySelectorAll('.a13-share-btn').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a13-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var target = allReviews.length > 0
            ? document.getElementById('a13-art-reviews-list-wrap')
            : document.getElementById('a13-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a13-rv-avatar-input');
      var avatarWrap   = document.getElementById('a13-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a13-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a13-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a13-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a13-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a13-rv-text');
      var charNum  = document.getElementById('a13-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a13-art-review-form');
      var submitBtn  = document.getElementById('a13-rv-submit');
      var errorEl    = document.getElementById('a13-rv-error');
      var successEl  = document.getElementById('a13-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a13-rv-firstname').value.trim();
          var lastName  = document.getElementById('a13-rv-lastname').value.trim();
          var text      = document.getElementById('a13-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)   { showError('Please enter your first and last name.'); return; }
          if (rating === 0)              { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10) { showError('Please write at least 10 characters.'); return; }

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
              a13setCount('a13-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a13-art-reviews-list-wrap');
      var listEl      = document.getElementById('a13-art-reviews-list');
      var countLabel  = document.getElementById('a13-rv-count-label');
      var loadMoreBtn = document.getElementById('a13-rv-load-more');

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
              '<span class="art-rv-card__name">' + a13EscHtml(rv.firstName) + ' ' + a13EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a13EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a13EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      // Inspired btn
      var btnInspired = document.getElementById('a13-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a13-art-reviews-list-wrap')
            : document.getElementById('a13-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a13InitNewsletterForms() {
      var nlForm  = document.getElementById('a13-article-nl-form');
      var nlEmail = document.getElementById('a13-article-nl-email');

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
              a13ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = orig; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
          }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a13Bound) {
        footerForm.dataset.a13Bound = '1';
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
            if (data.success) { footerEmail.value = ''; a13ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally { if (btn) { btn.textContent = orig; btn.disabled = false; } }
        });
      }
    }

    function a13ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a13InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a13-section, .a13-discover, .a13-pullquote, .a13-mid-cta, ' +
        '.a13-author-bio, .a13-psych-card, .a13-support-card, ' +
        '.a13-legging-card, .a13-manifesto-card, .a13-pick-card, ' +
        '.a13-care-item, .a13-callout, ' +
        '#a13-article-reactions, #a13-article-share-bottom, #a13-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(26px)';
        el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       11. HERO IMAGE PARALLAX
    ════════════════════════════════════════════════════════════ */
    function a13InitHeroParallax() {
      if (window.innerWidth < 960) return;
      var heroImg = document.querySelector('.a13-hero__img');
      if (!heroImg) return;

      window.addEventListener('scroll', function () {
        var scrollY = window.scrollY;
        if (scrollY > window.innerHeight) return;
        heroImg.style.transform = 'scale(1.04) translateY(' + (scrollY * 0.06) + 'px)';
      }, { passive: true });
    }


    /* ════════════════════════════════════════════════════════════
       12. FABRIC TABLE ROW HIGHLIGHT
    ════════════════════════════════════════════════════════════ */
    function a13InitFabricTable() {
      var rows = document.querySelectorAll('.a13-fabric-row');
      rows.forEach(function (row) {
        row.addEventListener('mouseenter', function () {
          rows.forEach(function (r) { r.style.opacity = r === row ? '1' : '0.55'; });
        });
        row.addEventListener('mouseleave', function () {
          rows.forEach(function (r) { r.style.opacity = '1'; });
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a13setText(id, text) {
      var el = document.getElementById(id);
      if (el && text) el.textContent = text;
    }

    function a13Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a13EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT ALL
    ════════════════════════════════════════════════════════════ */
    a13InitProgressBar();
    a13InitSidebarShare();
    a13InitShareButtons();
    a13InitReactions();
    a13InitNewsletterForms();
    a13InitHeroParallax();
    a13InitFabricTable();

    // Delayed for JSON data to settle
    setTimeout(function () {
      a13BuildTOC();
      a13InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE

/* ================================================================
   ARTICLE 14 — "Pilates for Plus-Size Beginners"
================================================================ */

(function () {

  // Only run on article14
  if (!document.body.classList.contains('a14-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1.  LOAD DATA FROM blog-articles.json — card-14
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        // Find card-14 in editorsPicks (it lives there in the JSON)
        var cardData = null;

        // Search editorsPicks first
        if (data.editorsPicks) {
          data.editorsPicks.forEach(function (c) {
            if (c.id === 'card-14') cardData = c;
          });
        }
        // Fallback: search cards array too
        if (!cardData && data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-14') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a14]: card-14 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author ? cardData.author.name || '' : '' },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date || '',
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article14.html' }
          });
        }

        // ── Hero images ────────────────────────────────────────
        var heroImg = document.getElementById('a14-hero-img');
        if (heroImg) {
          heroImg.src = cardData.image;
          heroImg.alt = cardData.imageAlt || cardData.title;
        }

        // ── Hero text fields ───────────────────────────────────
        a14setText('a14-hero-badge',   cardData.badge || cardData.category || '');
        a14setText('a14-breadcrumb-cat', cardData.badge || cardData.category || '');
        a14setText('a14-hero-excerpt', cardData.excerpt);

        // Handle author (editorsPicks cards may not have full author obj)
        var authorName  = '';
        var authorImage = '';
        if (cardData.author) {
          authorName  = cardData.author.name  || '';
          authorImage = cardData.author.image || '';
        }

        a14setText('a14-hero-author-name',   authorName);
        a14setText('a14-hero-readtime',      cardData.readTime || '');
        a14setText('a14-hero-date',          cardData.date     || '');
        a14setText('a14-hero-views',         cardData.views    ? cardData.views + ' reads' : '');
        a14setText('a14-ribbon-readtime',    cardData.readTime || '');
        a14setText('a14-ribbon-views',       cardData.views    ? cardData.views + ' reads' : '');
        a14setText('a14-ribbon-date',        cardData.date     || '');

        // Author image in meta chip
        var metaAuthorImg = document.getElementById('a14-hero-author-img');
        if (metaAuthorImg && authorImage) {
          metaAuthorImg.src = authorImage;
          metaAuthorImg.alt = authorName;
        }

        // Show/hide New badge
        var newBadge = document.getElementById('a14-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // ── Sidebar ────────────────────────────────────────────
        a14setText('a14-sidebar-author', authorName);

        // ── Author Bio ─────────────────────────────────────────
        var bioImg = document.getElementById('a14-bio-img');
        if (bioImg && authorImage) { bioImg.src = authorImage; bioImg.alt = authorName; }
        a14setText('a14-bio-name',          authorName);
        a14setText('a14-conclusion-author', authorName);
        a14setText('a14-pullquote-author',  authorName);

        // ── Related articles (from all cards) ──────────────────
        a14InjectRelated(data.cards || [], cardData.category || '', 'card-14');

      })
      .catch(function (err) {
        console.error('articles.js [a14]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2.  RELATED ARTICLES INJECTION
    ════════════════════════════════════════════════════════════ */
    function a14InjectRelated(cards, currentCategory, currentId) {
      var relatedGrid = document.getElementById('a14-related-grid');
      if (!relatedGrid || !cards || !cards.length) return;

      var sameCategory = cards.filter(function (c) {
        return c.category === currentCategory && c.id !== currentId;
      });
      var others = cards.filter(function (c) {
        return c.category !== currentCategory && c.id !== currentId;
      });

      a14Shuffle(sameCategory);
      a14Shuffle(others);

      var picks = sameCategory.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      relatedGrid.innerHTML = picks.map(function (card) {
        return '<a href="' + (card.url || '#') + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + card.image + '" alt="' + (card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + card.badge + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + card.title + '</h3>' +
            '<p class="related-card__excerpt">' + card.excerpt + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + (card.readTime || '') + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + (card.views || '') + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3.  TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a14BuildTOC() {
      var tocNav   = document.getElementById('a14-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a14-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a14-toc-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
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


    /* ════════════════════════════════════════════════════════════
       4.  READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a14InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function updateProgress() {
        var scrollTop  = window.scrollY || document.documentElement.scrollTop;
        var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
        var progress   = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        bar.style.width = progress.toFixed(1) + '%';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }


    /* ════════════════════════════════════════════════════════════
       5.  STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a14InitSidebarShare() {
      var stickyShare = document.getElementById('a14-sticky-share');
      var hero        = document.getElementById('a14-hero');
      if (!stickyShare || !hero) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyShare.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6.  SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a14InitShareButtons() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a14-share-pill, .a14-share-pill--lg').forEach(function (btn) {

        // Copy link
        if (btn.id === 'a14-hero-copy' || btn.id === 'a14-bottom-copy' ||
            btn.classList.contains('a14-share-pill--copy')) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var originalClass = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () {
                btn.classList.remove('copied');
                if (icon) icon.className = originalClass;
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

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var shareUrl = '#';
          if (btn.classList.contains('a14-share-pill--fb')) {
            shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a14-share-pill--pi')) {
            var imgEl = document.getElementById('a14-hero-img');
            var img   = encodeURIComponent(imgEl ? imgEl.src : '');
            shareUrl  = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a14-share-pill--wa')) {
            shareUrl = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a14-share-pill--tw')) {
            shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (shareUrl !== '#') {
            window.open(shareUrl, '_blank', 'noopener,width=620,height=440');
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7.  REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a14InitReactions() {
      var STORAGE_KEY = 'cf_article_reactions_article14';

      function getReacted()      { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(type) { try { localStorage.setItem(STORAGE_KEY, type); }        catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a14-article-reactions .reaction-btn').forEach(function (btn) {
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


    /* ════════════════════════════════════════════════════════════
       8.  REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article14';
      var API              = '/.netlify/functions/reviews-article';
      var REVIEWS_PER_PAGE = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;

          a14setCount('a14-count-helpful',  data.likes);
          a14setCount('a14-count-inspired', data.reviewsCount);
          a14setCount('a14-count-more',     data.shares);

          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) {
          console.warn('[a14 reviews] loadStats failed:', e.message);
        }
      }

      function a14setCount(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Like button
      var btnHelpful = document.getElementById('a14-btn-helpful');
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
            if (data.success) a14setCount('a14-count-helpful', data.likes);
          } catch (e) { console.warn('[a14] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID })
          });
          var data = await res.json();
          if (data.success) a14setCount('a14-count-more', data.shares);
        } catch (e) { console.warn('[a14] share failed:', e.message); }
      }

      document.querySelectorAll('.a14-share-pill').forEach(function (btn) {
        btn.addEventListener('click', recordShare);
      });

      var btnMore = document.getElementById('a14-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var formWrap = document.getElementById('a14-art-review-form-wrap');
          if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      var btnInspired = document.getElementById('a14-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var target = allReviews.length > 0
            ? document.getElementById('a14-art-reviews-list-wrap')
            : document.getElementById('a14-art-review-form-wrap');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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

      var avatarInput  = document.getElementById('a14-rv-avatar-input');
      var avatarWrap   = document.getElementById('a14-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a14-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a14-rv-avatar-placeholder');

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

      // Stars
      var stars          = document.querySelectorAll('#a14-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a14-rv-rating');
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

      // Char counter
      var textarea = document.getElementById('a14-rv-text');
      var charNum  = document.getElementById('a14-rv-char-num');
      if (textarea && charNum) {
        textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; });
      }

      // Submit
      var reviewForm = document.getElementById('a14-art-review-form');
      var submitBtn  = document.getElementById('a14-rv-submit');
      var errorEl    = document.getElementById('a14-rv-error');
      var successEl  = document.getElementById('a14-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();

          var firstName = document.getElementById('a14-rv-firstname').value.trim();
          var lastName  = document.getElementById('a14-rv-lastname').value.trim();
          var text      = document.getElementById('a14-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)     { showError('Please enter your first and last name.'); return; }
          if (rating === 0)                { showError('Please select a star rating.'); return; }
          if (!text || text.length < 10)   { showError('Please write at least 10 characters.'); return; }

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
              a14setCount('a14-count-inspired', data.reviewsCount);

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

      // Reviews list
      var listWrap    = document.getElementById('a14-art-reviews-list-wrap');
      var listEl      = document.getElementById('a14-art-reviews-list');
      var countLabel  = document.getElementById('a14-rv-count-label');
      var loadMoreBtn = document.getElementById('a14-rv-load-more');

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
              '<span class="art-rv-card__name">' + a14EscHtml(rv.firstName) + ' ' + a14EscHtml(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a14EscHtml(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a14EscHtml(rv.text) + '</p>' +
          '</div>';

        return card;
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9.  NEWSLETTER FORMS
    ════════════════════════════════════════════════════════════ */
    function a14InitNewsletterForms() {
      var nlForm  = document.getElementById('a14-article-nl-form');
      var nlEmail = document.getElementById('a14-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = nlForm.querySelector('button');
          var originalHTML = btn ? btn.innerHTML : '';
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
                setTimeout(function () { btn.disabled = false; btn.innerHTML = originalHTML; }, 4000);
              }
              a14ShowNewsletterPopup();
            } else {
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
          } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
          }
        });
      }

      // Footer newsletter (bind only once)
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');

      if (footerForm && footerEmail && !footerForm.dataset.a14Bound) {
        footerForm.dataset.a14Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;

          var btn          = footerForm.querySelector('button');
          var originalText = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

          try {
            var res  = await fetch('/.netlify/functions/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'newsletter-subscribe', email: val })
            });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a14ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally {
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
          }
        });
      }
    }

    function a14ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a14InitScrollReveal() {
      var revealEls = document.querySelectorAll(
        '.a14-section, .a14-discover, .a14-pullquote, .a14-mid-cta, ' +
        '.a14-author-bio, .a14-reason-card, .a14-prep-item, ' +
        '.a14-move, .a14-schedule-card, .a14-callout, ' +
        '#a14-article-reactions, #a14-article-share-bottom, #a14-article-newsletter'
      );

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });

      revealEls.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        observer.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       11. FLOATING CARDS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a14AnimateFloatCards() {
      var cards = document.querySelectorAll('.a14-float-card');
      cards.forEach(function (card, i) {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(18px) scale(0.93)';
        card.style.transition = 'opacity 0.48s ease, transform 0.48s ease';
        setTimeout(function () {
          card.style.opacity   = '1';
          card.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 380);
      });
    }


    /* ════════════════════════════════════════════════════════════
       12. READ BUTTON — smooth scroll to content
    ════════════════════════════════════════════════════════════ */
    function a14InitReadBtn() {
      var btn = document.querySelector('.a14-btn-read');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        var target = document.querySelector('.a14-ribbon');
        if (target) {
          e.preventDefault();
          window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 10, behavior: 'smooth' });
        }
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILS
    ════════════════════════════════════════════════════════════ */
    function a14setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
      // Also try querySelectorAll for duplicated IDs (rare but safe)
      document.querySelectorAll('#' + id).forEach(function (el) { el.textContent = text; });
    }

    function a14Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j   = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function a14EscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a14InitProgressBar();
    a14InitSidebarShare();
    a14InitShareButtons();
    a14InitReactions();
    a14InitNewsletterForms();
    a14AnimateFloatCards();
    a14InitReadBtn();

    // Delayed to allow JSON injection to settle
    setTimeout(function () {
      a14BuildTOC();
      a14InitScrollReveal();
    }, 200);

  }); // end DOMContentLoaded

})(); // end IIFE

/* ================================================================
   ARTICLE 15 — "Intermittent Fasting for Curvy Women"
================================================================ */

(function () {

  // Only run on article15
  if (!document.body.classList.contains('a15-page')) return;

  document.addEventListener('DOMContentLoaded', function () {

    /* ════════════════════════════════════════════════════════════
       1. LOAD DATA FROM blog-articles.json — card-15
    ════════════════════════════════════════════════════════════ */
    fetch('/blog/blog-articles.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {

        // Find card-15 in editorsPicks first, fallback to cards
        var cardData = null;

        if (data.editorsPicks) {
          data.editorsPicks.forEach(function (c) {
            if (c.id === 'card-15') cardData = c;
          });
        }
        if (!cardData && data.cards) {
          data.cards.forEach(function (c) {
            if (c.id === 'card-15') cardData = c;
          });
        }

        if (!cardData) {
          console.warn('articles.js [a15]: card-15 not found in blog-articles.json');
          return;
        }

        // ── Meta tags ──────────────────────────────────────────
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = cardData.title + ' | CurvaFit Journal';

        var metaDesc = document.getElementById('meta-description');
        if (metaDesc) metaDesc.setAttribute('content', cardData.excerpt);

        var metaOgTitle = document.getElementById('meta-og-title');
        if (metaOgTitle) metaOgTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaOgDesc = document.getElementById('meta-og-desc');
        if (metaOgDesc) metaOgDesc.setAttribute('content', cardData.excerpt);

        var metaOgImage = document.getElementById('meta-og-image');
        if (metaOgImage) metaOgImage.setAttribute('content', cardData.image);

        var metaTwTitle = document.getElementById('meta-tw-title');
        if (metaTwTitle) metaTwTitle.setAttribute('content', cardData.title + ' — CurvaFit Journal');

        var metaTwDesc = document.getElementById('meta-tw-desc');
        if (metaTwDesc) metaTwDesc.setAttribute('content', cardData.excerpt);

        var metaTwImage = document.getElementById('meta-tw-image');
        if (metaTwImage) metaTwImage.setAttribute('content', cardData.image);

        // ── JSON-LD ────────────────────────────────────────────
        var jsonLd = document.getElementById('json-ld');
        if (jsonLd) {
          jsonLd.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': cardData.title,
            'description': cardData.excerpt,
            'image': cardData.image,
            'author': { '@type': 'Person', 'name': cardData.author ? (cardData.author.name || '') : '' },
            'publisher': {
              '@type': 'Organization',
              'name': 'CurvaFit',
              'logo': { '@type': 'ImageObject', 'url': 'https://www.curva-fit.com/src-images/LogoCurvafit(1).png' }
            },
            'datePublished': cardData.date || '',
            'mainEntityOfPage': { '@type': 'WebPage', '@id': 'https://www.curva-fit.com/blog/article15.html' }
          });
        }

        // ── Hero background image ──────────────────────────────
        var heroBg = document.getElementById('a15-hero-bg');
        if (heroBg) {
          heroBg.src = cardData.image;
          heroBg.alt = cardData.imageAlt || cardData.title;
        }

        // ── Hero text fields ───────────────────────────────────
        var badge    = cardData.badge || cardData.category || '';
        var catLabel = badge;

        a15setText('a15-hero-badge',     badge);
        a15setText('a15-breadcrumb-cat', catLabel);
        a15setText('a15-hero-title',     cardData.title);
        a15setText('a15-hero-excerpt',   cardData.excerpt);
        a15setText('a15-hero-readtime',  cardData.readTime || '');
        a15setText('a15-hero-date',      cardData.date     || '');
        a15setText('a15-hero-views',     cardData.views ? cardData.views + ' reads' : '');

        // Ribbon
        a15setText('a15-ribbon-readtime', cardData.readTime || '');
        a15setText('a15-ribbon-views',    cardData.views ? cardData.views + ' reads' : '');
        a15setText('a15-ribbon-date',     cardData.date     || '');

        // Author
        var authorName  = '';
        var authorImage = '';
        if (cardData.author) {
          authorName  = cardData.author.name  || '';
          authorImage = cardData.author.image || '';
        }

        a15setText('a15-hero-author-name', authorName);

        var heroAuthorImg = document.getElementById('a15-hero-author-img');
        if (heroAuthorImg && authorImage) {
          heroAuthorImg.src = authorImage;
          heroAuthorImg.alt = authorName;
        }

        // Show/hide New badge
        var newBadge = document.getElementById('a15-hero-new-badge');
        if (newBadge) newBadge.style.display = cardData.isNew ? 'inline-flex' : 'none';

        // ── Sidebar + body author references ───────────────────
        a15setText('a15-sidebar-author',   authorName);
        a15setText('a15-pullquote-author', authorName);
        a15setText('a15-bio-name',         authorName);
        a15setText('a15-conclusion-author', authorName);

        var bioImg = document.getElementById('a15-bio-img');
        if (bioImg && authorImage) { bioImg.src = authorImage; bioImg.alt = authorName; }

        // ── Related articles ───────────────────────────────────
        a15InjectRelated(
          (data.cards || []).concat(data.editorsPicks || []),
          cardData.category || cardData.badge || '',
          'card-15'
        );

      })
      .catch(function (err) {
        console.error('articles.js [a15]: error loading blog-articles.json:', err);
      });


    /* ════════════════════════════════════════════════════════════
       2. RELATED ARTICLES
    ════════════════════════════════════════════════════════════ */
    function a15InjectRelated(cards, currentCategory, currentId) {
      var grid = document.getElementById('a15-related-grid');
      if (!grid || !cards || !cards.length) return;

      var same   = cards.filter(function (c) { return (c.category === currentCategory || c.badge === currentCategory) && c.id !== currentId; });
      var others = cards.filter(function (c) { return c.category !== currentCategory && c.badge !== currentCategory && c.id !== currentId; });

      a15Shuffle(same);
      a15Shuffle(others);

      var picks = same.slice(0, 3);
      if (picks.length < 3) picks = picks.concat(others.slice(0, 3 - picks.length));

      grid.innerHTML = picks.map(function (card) {
        return '<a href="' + (card.url || '#') + '" class="related-card">' +
          '<div class="related-card__img-wrap">' +
            '<img src="' + (card.image || '') + '" alt="' + a15Esc(card.imageAlt || card.title) + '" loading="lazy">' +
            '<span class="related-card__badge">' + a15Esc(card.badge || card.category || '') + '</span>' +
          '</div>' +
          '<div class="related-card__body">' +
            '<h3 class="related-card__title">' + a15Esc(card.title) + '</h3>' +
            '<p class="related-card__excerpt">' + a15Esc(card.excerpt || '') + '</p>' +
            '<div class="related-card__meta">' +
              '<span><i class="fi fi-rr-clock"></i> ' + a15Esc(card.readTime || '') + '</span>' +
              '<span><i class="fi fi-rr-eye"></i> ' + a15Esc(card.views || '') + '</span>' +
              '<span class="related-card__cta">Read Article →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }


    /* ════════════════════════════════════════════════════════════
       3. TABLE OF CONTENTS
    ════════════════════════════════════════════════════════════ */
    function a15BuildTOC() {
      var tocNav   = document.getElementById('a15-toc-nav');
      if (!tocNav) return;
      var headings = document.querySelectorAll('.a15-content h2');
      if (!headings.length) return;

      var links = [];
      headings.forEach(function (h2, i) {
        if (!h2.id) h2.id = 'a15-h-' + i;
        var a = document.createElement('a');
        a.href = '#' + h2.id;
        a.textContent = h2.textContent;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var el = document.getElementById(h2.id);
          if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
        });
        tocNav.appendChild(a);
        links.push({ el: h2, link: a });
      });

      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var found = links.find(function (l) { return l.el === entry.target; });
          if (found) found.link.classList.toggle('active', entry.isIntersecting);
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      links.forEach(function (l) { obs.observe(l.el); });
    }


    /* ════════════════════════════════════════════════════════════
       4. READING PROGRESS BAR
    ════════════════════════════════════════════════════════════ */
    function a15InitProgressBar() {
      var bar = document.getElementById('reading-progress-bar');
      if (!bar) return;
      function update() {
        var s = window.scrollY || document.documentElement.scrollTop;
        var d = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (d > 0 ? Math.min(s / d * 100, 100) : 0).toFixed(1) + '%';
      }
      window.addEventListener('scroll', update, { passive: true });
      update();
    }


    /* ════════════════════════════════════════════════════════════
       5. STICKY SIDEBAR SHARE
    ════════════════════════════════════════════════════════════ */
    function a15InitStickyShare() {
      var el   = document.getElementById('a15-sticky-share');
      var hero = document.getElementById('a15-hero');
      if (!el || !hero) return;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { el.classList.toggle('visible', !e.isIntersecting); });
      }, { threshold: 0 });
      obs.observe(hero);
    }


    /* ════════════════════════════════════════════════════════════
       6. SHARE BUTTONS
    ════════════════════════════════════════════════════════════ */
    function a15InitShare() {
      var url   = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);

      document.querySelectorAll('.a15-share-btn').forEach(function (btn) {

        // Copy
        if (btn.classList.contains('a15-share-btn--copy') || btn.id === 'a15-hero-copy' || btn.id === 'a15-bottom-copy') {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(function () {
              btn.classList.add('copied');
              var icon = btn.querySelector('i');
              var orig = icon ? icon.className : '';
              if (icon) icon.className = 'fi fi-rr-check';
              setTimeout(function () { btn.classList.remove('copied'); if (icon) icon.className = orig; }, 2200);
            }).catch(function () {
              var ta = document.createElement('textarea');
              ta.value = window.location.href;
              document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            });
          });
          return;
        }

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var share = '#';
          if (btn.classList.contains('a15-share-btn--fb')) {
            share = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
          } else if (btn.classList.contains('a15-share-btn--pi')) {
            var img = encodeURIComponent((document.getElementById('a15-hero-bg') || {}).src || '');
            share = 'https://pinterest.com/pin/create/button/?url=' + url + '&description=' + title + '&media=' + img;
          } else if (btn.classList.contains('a15-share-btn--wa')) {
            share = 'https://api.whatsapp.com/send?text=' + title + '%20' + url;
          } else if (btn.classList.contains('a15-share-btn--tw')) {
            share = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
          }
          if (share !== '#') window.open(share, '_blank', 'noopener,width=620,height=440');
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       7. REACTIONS
    ════════════════════════════════════════════════════════════ */
    function a15InitReactions() {
      var KEY = 'cf_reactions_article15';
      function getReacted() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
      function saveReacted(t){ try { localStorage.setItem(KEY, t); } catch (e) {} }

      var reacted = getReacted();

      document.querySelectorAll('#a15-article-reactions .reaction-btn').forEach(function (btn) {
        var type    = btn.getAttribute('data-reaction');
        var countEl = btn.querySelector('.reaction-btn__count');
        if (reacted === type) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (reacted && reacted !== type) return;
          var cur = parseInt((countEl ? countEl.textContent : '0').replace(/\D/g,''), 10) || 0;
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            if (countEl) countEl.textContent = Math.max(0, cur - 1);
            reacted = ''; saveReacted('');
          } else {
            btn.classList.add('active');
            if (countEl) countEl.textContent = cur + 1;
            reacted = type; saveReacted(type);
          }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════
       8. REVIEW SYSTEM
    ════════════════════════════════════════════════════════════ */
    (function () {
      var ARTICLE_ID       = 'article15';
      var API              = '/.netlify/functions/reviews-article';
      var PER_PAGE         = 5;
      var allReviews       = [];
      var shownCount       = 0;
      var likeGranted      = false;

      async function loadStats() {
        try {
          var res  = await fetch(API + '?articleId=' + encodeURIComponent(ARTICLE_ID));
          var data = await res.json();
          if (!data.success) return;
          a15setCount('a15-count-helpful',  data.likes);
          a15setCount('a15-count-inspired', data.reviewsCount);
          a15setCount('a15-count-more',     data.shares);
          allReviews = data.reviews || [];
          renderReviews(true);
        } catch (e) { console.warn('[a15 reviews]', e.message); }
      }

      function a15setCount(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
      }

      // Like
      var btnHelpful = document.getElementById('a15-btn-helpful');
      if (btnHelpful) {
        btnHelpful.addEventListener('click', async function () {
          if (likeGranted) return;
          likeGranted = true;
          btnHelpful.classList.add('active');
          try {
            var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', articleId: ARTICLE_ID }) });
            var data = await res.json();
            if (data.success) a15setCount('a15-count-helpful', data.likes);
          } catch (e) { console.warn('[a15] like failed:', e.message); }
        });
      }

      // Share counter
      async function recordShare() {
        try {
          var res  = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share', articleId: ARTICLE_ID }) });
          var data = await res.json();
          if (data.success) a15setCount('a15-count-more', data.shares);
        } catch (e) { console.warn('[a15] share failed:', e.message); }
      }

      document.querySelectorAll('.a15-share-btn').forEach(function (btn) { btn.addEventListener('click', recordShare); });

      var btnMore = document.getElementById('a15-btn-more');
      if (btnMore) {
        btnMore.addEventListener('click', function () {
          recordShare();
          var fw = document.getElementById('a15-art-review-form-wrap');
          if (fw) fw.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      var btnInspired = document.getElementById('a15-btn-inspired');
      if (btnInspired) {
        btnInspired.addEventListener('click', function () {
          btnInspired.classList.toggle('active');
          var t = allReviews.length > 0 ? document.getElementById('a15-art-reviews-list-wrap') : document.getElementById('a15-art-review-form-wrap');
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Avatar
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
            var c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        });
      }

      var avatarInput  = document.getElementById('a15-rv-avatar-input');
      var avatarWrap   = document.getElementById('a15-rv-avatar-wrap');
      var avatarPrev   = document.getElementById('a15-rv-avatar-preview');
      var avatarPlaceh = document.getElementById('a15-rv-avatar-placeholder');

      if (avatarWrap && avatarInput) {
        avatarWrap.addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', async function () {
          var file = avatarInput.files[0];
          if (!file) return;
          avatarBase64 = await compressAvatar(file);
          if (avatarBase64 && avatarPrev && avatarPlaceh) {
            avatarPrev.src = avatarBase64; avatarPrev.style.display = 'block';
            avatarPlaceh.style.display = 'none';
          }
        });
      }

      // Stars
      var stars          = document.querySelectorAll('#a15-rv-stars .art-rv-star');
      var ratingInput    = document.getElementById('a15-rv-rating');
      var selectedRating = 0;

      function paintStars(n) {
        stars.forEach(function (s, i) {
          s.classList.toggle('fi-sr-star', i < n);
          s.classList.toggle('fi-rr-star', i >= n);
          s.classList.toggle('selected',   i < n);
        });
      }

      stars.forEach(function (star) {
        star.addEventListener('mouseover', function () { paintStars(parseInt(star.dataset.val)); });
        star.addEventListener('mouseout',  function () { paintStars(selectedRating); });
        star.addEventListener('click',     function () { selectedRating = parseInt(star.dataset.val); if (ratingInput) ratingInput.value = selectedRating; paintStars(selectedRating); });
      });

      // Char counter
      var textarea = document.getElementById('a15-rv-text');
      var charNum  = document.getElementById('a15-rv-char-num');
      if (textarea && charNum) { textarea.addEventListener('input', function () { charNum.textContent = textarea.value.length; }); }

      // Submit
      var reviewForm = document.getElementById('a15-art-review-form');
      var submitBtn  = document.getElementById('a15-rv-submit');
      var errorEl    = document.getElementById('a15-rv-error');
      var successEl  = document.getElementById('a15-rv-success');

      if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var firstName = document.getElementById('a15-rv-firstname').value.trim();
          var lastName  = document.getElementById('a15-rv-lastname').value.trim();
          var text      = document.getElementById('a15-rv-text').value.trim();
          var rating    = parseInt(ratingInput ? ratingInput.value : '0');

          if (errorEl)   errorEl.style.display   = 'none';
          if (successEl) successEl.style.display = 'none';

          if (!firstName || !lastName)     { showError('Please enter your first and last name.');          return; }
          if (rating === 0)                { showError('Please select a star rating.');                    return; }
          if (!text || text.length < 10)   { showError('Please write at least 10 characters.');            return; }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending…';

          try {
            var res  = await fetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'add-review', articleId: ARTICLE_ID, firstName, lastName, avatar: avatarBase64, text, rating })
            });
            var data = await res.json();

            if (data.success) {
              if (successEl) successEl.style.display = 'flex';
              a15setCount('a15-count-inspired', data.reviewsCount);

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

      function showError(msg) { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } }

      // Reviews list
      var listWrap    = document.getElementById('a15-art-reviews-list-wrap');
      var listEl      = document.getElementById('a15-art-reviews-list');
      var countLabel  = document.getElementById('a15-rv-count-label');
      var loadMoreBtn = document.getElementById('a15-rv-load-more');

      function renderReviews(reset) {
        if (!listEl) return;
        if (reset) { shownCount = 0; listEl.innerHTML = ''; }
        if (!allReviews.length) { if (listWrap) listWrap.style.display = 'none'; return; }
        if (listWrap) listWrap.style.display = 'block';
        if (countLabel) countLabel.textContent = allReviews.length + ' review' + (allReviews.length > 1 ? 's' : '');

        var slice = allReviews.slice(shownCount, shownCount + PER_PAGE);
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
        var rating    = parseInt(rv.rating) || 5;
        var starsHTML = '';
        for (var i = 1; i <= 5; i++) starsHTML += '<i class="fi ' + (i <= rating ? 'fi-sr-star' : 'fi-rr-star empty') + '"></i>';
        card.innerHTML = avatarHTML +
          '<div class="art-rv-card__body">' +
            '<div class="art-rv-card__top">' +
              '<span class="art-rv-card__name">' + a15Esc(rv.firstName) + ' ' + a15Esc(rv.lastName) + '</span>' +
              '<span class="art-rv-card__date">' + a15Esc(rv.date || '') + '</span>' +
            '</div>' +
            '<div class="art-rv-card__stars">' + starsHTML + '</div>' +
            '<p class="art-rv-card__text">' + a15Esc(rv.text) + '</p>' +
          '</div>';
        return card;
      }

      loadStats();
    })();


    /* ════════════════════════════════════════════════════════════
       9. NEWSLETTER
    ════════════════════════════════════════════════════════════ */
    function a15InitNewsletter() {
      var nlForm  = document.getElementById('a15-article-nl-form');
      var nlEmail = document.getElementById('a15-article-nl-email');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = nlEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = nlForm.querySelector('button');
          var orig = btn ? btn.innerHTML : '';
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Subscribing…'; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) {
              nlEmail.value = '';
              if (btn) {
                btn.innerHTML = '<i class="fi fi-rr-check"></i> You\'re subscribed!';
                setTimeout(function () { btn.disabled = false; btn.innerHTML = orig; }, 4000);
              }
              a15ShowNewsletterPopup();
            } else { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
          } catch (err) { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
        });
      }

      // Footer newsletter
      var footerForm  = document.getElementById('newsletter-form-footer');
      var footerEmail = document.getElementById('newsletter-email-footer');
      if (footerForm && footerEmail && !footerForm.dataset.a15Bound) {
        footerForm.dataset.a15Bound = '1';
        footerForm.addEventListener('submit', async function (e) {
          e.preventDefault();
          var val = footerEmail.value.trim();
          if (!val || !val.includes('@')) return;
          var btn = footerForm.querySelector('button');
          var orig = btn ? btn.textContent : '';
          if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
          try {
            var res  = await fetch('/.netlify/functions/save-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newsletter-subscribe', email: val }) });
            var data = await res.json();
            if (data.success) { footerEmail.value = ''; a15ShowNewsletterPopup(); }
          } catch (err) { console.error(err); }
          finally { if (btn) { btn.textContent = orig; btn.disabled = false; } }
        });
      }
    }

    function a15ShowNewsletterPopup() {
      var popup = document.getElementById('newsletter-popup');
      if (popup) {
        popup.classList.add('show');
        setTimeout(function () { popup.classList.remove('show'); }, 8000);
        var close = document.getElementById('popup-close-btn');
        if (close) close.onclick = function () { popup.classList.remove('show'); };
      }
    }


    /* ════════════════════════════════════════════════════════════
       10. SCROLL REVEAL
    ════════════════════════════════════════════════════════════ */
    function a15InitScrollReveal() {
      var targets = document.querySelectorAll(
        '.a15-section, .a15-discover, .a15-pullquote, .a15-mid-cta, ' +
        '.a15-author-bio, .a15-timeline, .a15-hcard, .a15-pcard, ' +
        '.a15-who-card, .a15-circ-card, .a15-wk, .a15-break-card, .a15-callout, ' +
        '#a15-article-reactions, #a15-article-share-bottom, #a15-article-newsletter'
      );
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });

      targets.forEach(function (el) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(24px)';
        el.style.transition = 'opacity 0.60s ease, transform 0.60s ease';
        obs.observe(el);
      });
    }


    /* ════════════════════════════════════════════════════════════
       11. CLOCK HAND ANIMATION (SVG)
    ════════════════════════════════════════════════════════════ */
    function a15AnimateClock() {
      var hand = document.querySelector('.a15-hand-sweep-el');
      if (!hand) return;
      var angle = 0;
      function tick() {
        angle = (angle + 0.5) % 360;
        hand.setAttribute('transform', 'rotate(' + angle + ' 150 150)');
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }


    /* ════════════════════════════════════════════════════════════
       12. FLOATING PILLS ENTRANCE
    ════════════════════════════════════════════════════════════ */
    function a15AnimatePills() {
      document.querySelectorAll('.a15-float-pill').forEach(function (pill, i) {
        pill.style.opacity    = '0';
        pill.style.transform  = 'translateY(18px) scale(0.93)';
        pill.style.transition = 'opacity 0.50s ease, transform 0.50s ease';
        setTimeout(function () {
          pill.style.opacity   = '1';
          pill.style.transform = 'translateY(0) scale(1)';
        }, 900 + i * 400);
      });
    }


    /* ════════════════════════════════════════════════════════════
       READ BUTTON — smooth scroll
    ════════════════════════════════════════════════════════════ */
    function a15InitReadBtn() {
      var btn = document.querySelector('.a15-read-btn');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        var ribbon = document.querySelector('.a15-ribbon');
        if (ribbon) { e.preventDefault(); window.scrollTo({ top: ribbon.getBoundingClientRect().top + window.scrollY - 10, behavior: 'smooth' }); }
      });
    }


    /* ════════════════════════════════════════════════════════════
       UTILITIES
    ════════════════════════════════════════════════════════════ */
    function a15setText(id, text) {
      document.querySelectorAll('#' + id).forEach(function (el) { el.textContent = text; });
    }

    function a15Shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    function a15Esc(str) {
      return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }


    /* ════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════ */
    a15InitProgressBar();
    a15InitStickyShare();
    a15InitShare();
    a15InitReactions();
    a15InitNewsletter();
    a15AnimatePills();
    a15InitReadBtn();
    a15AnimateClock();

    // Delay TOC + scroll reveal to let JSON injection settle
    setTimeout(function () {
      a15BuildTOC();
      a15InitScrollReveal();
    }, 220);

  }); // end DOMContentLoaded

})(); // end IIFE







