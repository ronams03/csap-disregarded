/* ==========================================================================
   CSAP-COC  |  Front-end behaviour
   Vanilla JS - no dependencies

   The CMS layer (assets/js/cms.js) rewrites large parts of the page *after*
   the first paint.  Every binding here therefore lives in a small, idempotent
   init function, and window.CSAP.refresh() re-runs them once the content is in
   place - so late-rendered cards keep their fade-in, the hero slideshow keeps
   its slides and the gallery lightbox keeps working.  A failure inside one
   block never stops the others, and nothing here can leave the page blank:
   the CSS carries its own fail-safe (see "Fail-safe" in style.css).
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var warn = function () {
    if (window.console && console.warn) { console.warn.apply(console, arguments); }
  };

  // Reveal animation only applies when JS can undo it.
  root.classList.add('js');

  /* ---------------- 1. Header: sticky state + scroll progress ---------------- */
  var header = $('#siteHeader');
  var bar    = $('#scrollProgress');
  var toTop  = $('#toTop');

  /* Keep the two header metrics in sync with reality:
       --nav-h     the nav bar itself (brand + menu) — what .nav-wrap sizes to.
       --header-h  the pinned sticky strip (nav bar + the optional marquee) —
                   what the mobile body padding, the drawer offset and the
                   anchor scroll margin have to clear.

     They are measured separately on purpose: .nav-wrap is sized by --nav-h, so
     tying it to the WHOLE header height would count the marquee twice and make
     the header grow on every refresh. Measuring the bar against itself is a
     fixed point, so the layout settles immediately. */
  function syncHeaderH() {
    if (!header) return;
    var navBar = header.querySelector('.nav-wrap') || header;
    var navH = Math.round(navBar.getBoundingClientRect().height);
    if (navH <= 0) return;
    /* Clamped so a stray stylesheet rule could never turn a repeated sync into
       an ever-taller header (this runs on every resize and every CMS refresh). */
    navH = Math.min(navH, 200);
    var full = Math.min(Math.round(header.getBoundingClientRect().height) || navH, 260);
    root.style.setProperty('--nav-h', navH + 'px');
    root.style.setProperty('--header-h', Math.max(navH, full) + 'px');
  }
  syncHeaderH();
  window.addEventListener('resize', syncHeaderH);
  window.addEventListener('orientationchange', syncHeaderH);
  if (window.FontFace && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncHeaderH).catch(function () {});
  }

  function onScroll() {
    var y = window.scrollY || root.scrollTop;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (toTop)  toTop.classList.toggle('is-visible', y > 420);
    if (bar) {
      var max = root.scrollHeight - window.innerHeight;
      bar.style.setProperty('--p', max > 0 ? Math.min(1, y / max) : 0);
    }
    spy();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------- 2. Navigation: mobile drawer + dropdowns ---------------- */
  var nav       = $('#siteNav');
  var navToggle = $('#navToggle');
  var isMobile  = function () { return window.matchMedia('(max-width: 1024px)').matches; };

  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation');
    $$('.has-sub', nav).forEach(function (li) {
      li.classList.remove('is-open');
      var a = $('a', li);
      if (a) a.setAttribute('aria-expanded', 'false');
    });
  }

  if (nav && navToggle) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });

    document.addEventListener('click', function (e) {
      if (isMobile() && nav.classList.contains('is-open') && !nav.contains(e.target) && !navToggle.contains(e.target)) closeNav();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
  }

  // Keep dropdown panels inside the viewport: flip to the right edge when they
  // would overflow. On mobile the drawer is full-width, so the panel stays left.
  function alignDropdowns() {
    if (!nav) return;
    var mobile = isMobile();
    $$('.has-sub', nav).forEach(function (li) {
      li.classList.remove('align-right');
      if (mobile) return;
      var panel = $('.nav-sub-panel', li);
      if (!panel) return;
      if (panel.getBoundingClientRect().right > window.innerWidth - 12) li.classList.add('align-right');
    });
  }
  window.addEventListener('resize', alignDropdowns);
  window.addEventListener('load', alignDropdowns);

  /* The CMS re-renders the menu, so (re)bind the behaviour of the current items. */
  function initNav() {
    if (!nav) return;

    $$('.has-sub', nav).forEach(function (li) {
      if (li.__csapSubBound) return;
      li.__csapSubBound = true;
      var trigger = $(':scope > a', li) || $('a', li);
      if (!trigger) return;
      trigger.addEventListener('click', function (e) {
        if (!isMobile()) return;
        e.preventDefault();
        var open = !li.classList.contains('is-open');
        $$('.has-sub', nav).forEach(function (other) {
          if (other !== li) other.classList.remove('is-open');
        });
        li.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', String(open));
      });
    });

    // Close the drawer after choosing a real destination.
    $$('#siteNav a').forEach(function (link) {
      if (link.__csapCloseBound) return;
      link.__csapCloseBound = true;
      link.addEventListener('click', function () {
        if (link.classList.contains('nav-cta') || !link.parentNode.classList.contains('has-sub')) closeNav();
      });
    });

    alignDropdowns();
  }

  /* ---------------- 3. Scroll-spy (highlights nav + parent item) ---------------- */
  // The CTA is a permanent call-to-action, never a scroll-spy indicator.
  var navLinks = [];
  var spyList  = [];

  function buildSpy() {
    navLinks = $$('#siteNav a[href^="#"]:not(.nav-cta)');
    spyList  = navLinks.map(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      return el ? { el: el, a: a } : null;
    }).filter(Boolean);
  }

  function spy() {
    if (!spyList.length) return;
    var line = (window.scrollY || root.scrollTop) + (header ? header.offsetHeight : 0) + 90;
    var current = null;
    spyList.forEach(function (item) {
      if (item.el.getBoundingClientRect().top + (window.scrollY || root.scrollTop) <= line) current = item;
    });
    navLinks.forEach(function (a) { a.classList.remove('is-active'); });
    if (!current) { if (navLinks[0]) navLinks[0].classList.add('is-active'); return; }
    current.a.classList.add('is-active');
    var parentLi = current.a.closest('.has-sub');
    if (parentLi) {
      var top = parentLi.querySelector(':scope > a') || parentLi.querySelector('a');
      if (top) top.classList.add('is-active');
    }
  }

  /* ---------------- 4. Hero: background slideshow ---------------- */
  var carouselRoot = $('#heroCarousel');
  var dotsBox      = $('#carouselDots');
  var bgSlides     = [];
  var dots         = [];
  var slideIndex   = 0;
  var timer        = null;
  var DELAY        = 5500;

  function carouselRender() {
    bgSlides.forEach(function (s, i) { s.classList.toggle('is-active', i === slideIndex); });
    if (dots.length) dots.forEach(function (d, i) { d.setAttribute('aria-current', String(i === slideIndex)); });
  }
  function carouselGo(i) {
    if (!bgSlides.length) return;
    slideIndex = (i + bgSlides.length) % bgSlides.length;
    carouselRender();
    carouselRestart();
  }
  function carouselNext() { carouselGo(slideIndex + 1); }
  function carouselPrev() { carouselGo(slideIndex - 1); }
  function carouselRestart() {
    clearInterval(timer);
    timer = bgSlides.length > 1 ? setInterval(carouselNext, DELAY) : null;
  }

  /* Re-read the slides after a CMS render and rebuild the dots to match. */
  function initCarousel() {
    if (!carouselRoot) return;
    bgSlides = $$('.hero-bg-slide', $('#heroBg') || document);
    if (!bgSlides.length) return;
    if (slideIndex >= bgSlides.length) slideIndex = 0;

    if (dotsBox) {
      dotsBox.innerHTML = '';
      bgSlides.forEach(function (_, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function () { carouselGo(i); });
        dotsBox.appendChild(dot);
      });
      dots = $$('button', dotsBox);
    }

    carouselRender();
    carouselRestart();
  }

  if (carouselRoot) {
    var nextBtn = $('#nextSlide');
    var prevBtn = $('#prevSlide');
    if (nextBtn) nextBtn.addEventListener('click', carouselNext);
    if (prevBtn) prevBtn.addEventListener('click', carouselPrev);

    carouselRoot.addEventListener('mouseenter', function () { clearInterval(timer); });
    carouselRoot.addEventListener('mouseleave', carouselRestart);

    var startX = 0;
    carouselRoot.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
    carouselRoot.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) { if (dx < 0) { carouselNext(); } else { carouselPrev(); } } else { carouselRestart(); }
    });

    var holding = false;
    function hold() { if (!holding) { holding = true; clearInterval(timer); } }
    function release() { if (holding) { holding = false; carouselRestart(); } }
    carouselRoot.addEventListener('mousedown', hold);
    window.addEventListener('mouseup', release);
    carouselRoot.addEventListener('touchstart', function () { hold(); }, { passive: true });
    window.addEventListener('touchend', release, { passive: true });
    carouselRoot.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' || e.pointerType === 'touch') hold(); });
    window.addEventListener('pointerup', release);
    carouselRoot.addEventListener('pointerleave', release);
  }

  /* ---------------- 5. Split the hero headline into animated letters ---------------- */
  function initHeroTitle() {
    var heroTitle = $('#heroTitle');
    if (!heroTitle) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var text = heroTitle.textContent.trim();
    if (!text) return;

    /* cms.js may write the headline either before or after we run, so only skip
       when the current text is already split into letters. */
    if (heroTitle.querySelector('.ltr') && heroTitle.__csapSplitText === text) return;

    heroTitle.__csapSplitText = text;
    heroTitle.setAttribute('data-csap-split', '1');
    heroTitle.setAttribute('aria-label', text);

    var frag = document.createDocumentFragment();
    var n = 0;
    text.split('').forEach(function (ch) {
      if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
      var span = document.createElement('span');
      span.className = 'ltr';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = ch;
      span.style.setProperty('--i', n++);
      frag.appendChild(span);
    });
    heroTitle.innerHTML = '';
    heroTitle.appendChild(frag);
  }

  /* ---------------- 6. Reveal in / out + staggered children ---------------- */
  var GRID_SEL = '.person-grid, .card-grid, .award-grid, .contact-grid, .grid,' +
                 '.grid-2, .grid-3, .grid-4, .pillars, .lineage-list, .steps, .faq,' +
                 '.mv-grid, .about-grid, .info-grid, .price-grid,' +
                 '.rep-grid, .sdp-grid, .feature-grid, .gallery-grid';

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-in', entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-4% 0px -10% 0px' });
  }

  function initReveal() {
    var revealEls = $$('.reveal');

    revealEls.forEach(function (el) {
      var grids = [];
      if (el.matches(GRID_SEL)) grids.push(el);
      $$(GRID_SEL, el).forEach(function (g) { grids.push(g); });
      grids.forEach(function (g) {
        if (g.__csapStagger) return;
        if (g !== el && g.closest('.reveal') !== el) return;
        g.__csapStagger = true;
        g.classList.add('stagger');
        Array.prototype.forEach.call(g.children, function (child, i) {
          child.style.setProperty('--d', Math.min(i, 11) * 70 + 'ms');
        });
      });
    });

    var animTargets = revealEls.concat($$('.section-banner, .section-title.center, #heroCard'));
    animTargets.forEach(function (el) {
      if (!io) { el.classList.add('is-in'); return; }
      if (el.__csapObserved) return;
      el.__csapObserved = true;
      io.observe(el);
    });

    // Force off-screen titles/banners into view on small scrolls (safety for headless).
    setTimeout(function () { animTargets.forEach(function (el) { if (el && el.getBoundingClientRect().top < window.innerHeight * 1.2) { el.classList.add('is-in'); } }); }, 1200);
    setTimeout(function () { animTargets.forEach(function (el) { if (el) { el.classList.add('is-in'); } }); }, 3500);
  }

  /* ---------------- 7. Images fade in when decoded ---------------- */
  function markLoaded(img) {
    if (img && !img.classList.contains('is-loaded')) img.classList.add('is-loaded');
  }
  function initImages() {
    $$('img').forEach(function (img) {
      if (img.complete && img.naturalWidth) { markLoaded(img); return; }
      if (img.__csapImgBound) return;
      img.__csapImgBound = true;
      img.addEventListener('load', function () { markLoaded(img); });
      img.addEventListener('error', function () { markLoaded(img); });
    });
  }
  window.addEventListener('load', function () { $$('img').forEach(markLoaded); });
  setTimeout(function () { $$('img').forEach(markLoaded); }, 3000);
  setTimeout(function () { $$('img').forEach(markLoaded); }, 8000);

  /* ---------------- 8. Footer year ---------------- */
  function initYears() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------------- 9. Hero thumbnail lightbox (delegated, survives re-renders) ---------------- */
  (function lightbox() {
    var box = document.getElementById('lightbox');
    if (!box) return;

    var lbImg    = document.getElementById('lightboxImg');
    var caption  = document.getElementById('lightboxCaption');
    var closeBtn = document.getElementById('lightboxClose');
    var prevBtn  = document.getElementById('lightboxPrev');
    var nextBtn  = document.getElementById('lightboxNext');
    var backdrop = document.getElementById('lightboxBackdrop');
    var fallback = ['assets/images/hero-1.jpg', 'assets/images/hero-2.jpg', 'assets/images/hero-3.jpg'];
    var items = [];
    var idx = 0;

    function collect() {
      items = $$('[data-lightbox]').map(function (el, i) {
        var thumb = el.tagName === 'IMG' ? el : el.querySelector('img');
        return {
          el: el,
          src: (thumb && (thumb.getAttribute('src') || thumb.src)) || fallback[i % fallback.length],
          caption: (thumb && thumb.getAttribute('alt')) || ('CSAP-COC highlight ' + (i + 1))
        };
      });
    }
    function open(i) {
      if (!items.length) return;
      idx = (i + items.length) % items.length;
      if (lbImg) lbImg.src = items[idx].src;
      if (caption) caption.textContent = items[idx].caption;
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      box.setAttribute('aria-hidden', 'false');
    }
    function close() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      box.setAttribute('aria-hidden', 'true');
      if (lbImg) lbImg.src = '';
    }

    // Delegated so thumbnails rebuilt by the CMS keep working.
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var trigger = target.closest('[data-lightbox]');
      if (!trigger) return;
      e.preventDefault();
      collect();
      var found = 0;
      for (var i = 0; i < items.length; i++) { if (items[i].el === trigger) { found = i; break; } }
      open(found);
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);
    if (prevBtn) prevBtn.addEventListener('click', function () { open(idx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { open(idx + 1); });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') open(idx - 1);
      if (e.key === 'ArrowRight') open(idx + 1);
    });
  })();

  /* ---------------- 10. Public refresh hook (called by cms.js after rendering) ---------------- */
  function safe(label, fn) {
    try { fn(); } catch (e) { warn('CSAP-COC UI (' + label + '):', e); }
  }

  function refresh() {
    safe('headerH',   syncHeaderH);
    safe('nav',       initNav);
    safe('scrollspy', buildSpy);
    safe('carousel',  initCarousel);
    safe('hero',      initHeroTitle);
    safe('reveal',    initReveal);
    safe('images',    initImages);
    safe('year',      initYears);
    safe('scroll',    onScroll);
  }

  window.CSAP = { refresh: refresh };
  window.__csapMainLoaded = true;

  /* cms.js rewrites the page after load - rebind as soon as it says it is done. */
  document.addEventListener('cms:rendered', function () { safe('refresh', refresh); });

  refresh();
})();
