/* ==========================================================================
   CSAP-COC  |  Front-end content hydration
   Pulls the published content from api/index.php and fills the page in.
   The static markup in index.html remains as the no-JS fallback, so a failure
   here simply leaves the original content on screen.
   ========================================================================== */
(function () {
  'use strict';

  var API = 'api/index.php';

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function setText(sel, val) {
    if (val == null || val === '') return;
    var el = document.querySelector(sel);
    if (el) el.textContent = val;
  }
  function setHtml(sel, val) {
    if (val == null || val === '') return;
    var el = document.querySelector(sel);
    if (el) el.innerHTML = val;
  }
  function setImg(sel, src) {
    if (!src) return;
    var el = document.querySelector(sel);
    if (el) el.src = src;
  }
  function paragraphs(text) {
    if (!text) return '';
    return String(text).split(/\n{2,}/).map(function (p) {
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function escT(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parasHtml(text) {
    if (!text) return '';
    return String(text).split(/\n{2,}/).map(function (p) {
      return '<p>' + escT(p.replace(/\n+/g, '<br>')) + '</p>';
    }).join('');
  }
  function setParas(sel, val) {
    if (val == null || val === '') return;
    var el = document.querySelector(sel);
    if (el) el.innerHTML = parasHtml(val);
  }
  function lines(v) {
    if (!v) return [];
    return String(v).split(/\r\n|\r|\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function icon(name) {
    return '<span class="nav-sub-title">' + name + '</span>';
  }

  function api(params) {
    var url = new URL(API, window.location.href);
    Object.keys(params || {}).forEach(function (k) { url.searchParams.set(k, params[k]); });
    return fetch(url.toString(), { credentials: 'same-origin' }).then(function (r) { return r.json(); })
      .then(function (j) { if (!j.success) throw new Error(j.error || 'API error'); return j.data; });
  }

  function applyHead(s) {
    if (s.site_title) { document.title = s.site_title; }
    var md = $('meta[name="description"]');
    if (md && s.meta_description) md.setAttribute('content', s.meta_description);
    var og = $('meta[property="og:title"]');
    if (og && s.site_title) og.setAttribute('content', s.site_title);
    var tc = $('meta[name="theme-color"]');
    if (tc && s.theme_color) tc.setAttribute('content', s.theme_color);
    if (s.logo_small) { var f = $('link[rel="icon"]'); if (f) f.href = s.logo_small; }
    if (s.color_primary) document.documentElement.style.setProperty('--green-800', s.color_primary);
    if (s.color_accent) document.documentElement.style.setProperty('--yellow-500', s.color_accent);
    if (s.color_bg) document.documentElement.style.setProperty('--bg', s.color_bg);
  }

  function renderBrand(s) {
    var b = document.getElementById('cmsBrand');
    if (b) {
      b.innerHTML = (s.site_short || 'CSAP-COC') + '<small>' + (s.org_name || '') + '</small>';
    }
    var img = document.querySelector('.brand-logo');
    if (img && s.logo_small) img.src = s.logo_small;
  }

  function renderNav(nav) {
    var ul = document.getElementById('cmsNav');
    if (!ul || !nav || !nav.length) return;
    ul.innerHTML = nav.map(function (item, i) {
      var kids = item.children || [];
      var cls = [];
      if (kids.length) cls.push('has-sub');
      if (Number(item.is_cta)) cls.push('nav-cta');
      if (i === 0 && !Number(item.is_cta)) cls.push('is-active');
      var a = '<a href="' + escT(item.href) + '"' + (cls.length ? ' class="' + cls.join(' ') + '"' : '')
        + (kids.length ? ' aria-haspopup="true" aria-expanded="false"' : '') + '>' + escT(item.label) + '</a>';
      if (!kids.length) return '<li>' + a + '</li>';
      var sub = '<div class="nav-sub-panel"><ul class="nav-sub">' + kids.map(function (k) {
        return '<li><a href="' + escT(k.href) + '"><span class="nav-sub-title">' + escT(k.label) + '</span></a></li>';
      }).join('') + '</ul></div>';
      return '<li class="' + cls.join(' ') + '">' + a + sub + '</li>';
    }).join('');
  }

  function renderHero(b) {
    setText('#heroEyebrow', b.eyebrow); setText('#heroTitle', b.title);
    setText('#heroTagline', b.tagline); setText('#heroMeta', b.meta);
    setImg('#heroLogo', b.logo);
    var a1 = $('#heroBtn1'), a2 = $('#heroBtn2');
    if (a1) { a1.textContent = b.btn1_label || a1.textContent; a1.href = b.btn1_url || a1.href; }
    if (a2) { a2.textContent = b.btn2_label || a2.textContent; a2.href = b.btn2_url || a2.href; }
    var slides = lines(b.bg_slides);
    if (slides.length) {
      var bg = document.getElementById('heroBg');
      if (bg) bg.innerHTML = slides.map(function (src, i) {
        return '<div class="hero-bg-slide' + (i === 0 ? ' is-active' : '') + '" style="background-image:url(\'' + escT(src) + '\')"></div>';
      }).join('');
    }
    var g = lines(b.gallery);
    if (g.length) {
      var grid = document.getElementById('cmsGallery');
      if (grid) grid.innerHTML = g.map(function (src, i) {
        return '<button class="gallery-item" type="button" data-lightbox="' + i + '" aria-label="View highlight ' + (i + 1) + '">'
          + '<img src="' + escT(src) + '" alt="CSAP-COC highlight ' + (i + 1) + '" loading="lazy" /></button>';
      }).join('');
    }
  }

  function renderAbout(b) {
    setText('#cmsAboutBanner', b.banner_title);
    setParas('#cmsAboutLede', b.lede); setParas('#cmsAboutBody', b.body);
    setImg('#cmsAboutImg', b.image);
    setImg('#cmsMissionImg', b.mission_image);
    setText('#cmsMissionTitle', b.mission_title);
    setParas('#cmsMissionBody', b.mission_body);
    setImg('#cmsVisionImg', b.vision_image);
    setText('#cmsVisionTitle', b.vision_title);
    setParas('#cmsVisionBody', b.vision_body);
  }

  function renderHistory(b, pillars) {
    setText('#cmsHistoryTitle', b.title); setText('#cmsHistorySub', b.subtitle);
    setParas('#cmsHistoryIntro', b.intro);
    setText('#cmsHistoryH1', b.h1_title); setParas('#cmsHistoryH1Body', b.h1_body);
    setText('#cmsHistoryPurpose', b.purpose_title); setParas('#cmsHistoryPurposeBody', b.purpose_body);
    setText('#cmsHistoryGrowth', b.growth_title); setParas('#cmsHistoryGrowthBody', b.growth_body);
    setImg('#cmsHistoryBanner', b.banner);
    var wrap = document.getElementById('cmsPillars');
    if (wrap && pillars && pillars.length) {
      wrap.innerHTML = pillars.map(function (p) {
        return '<div class="pillar"><strong>' + escT(p.title) + '</strong>' + escT(p.body) + '</div>';
      }).join('');
    }
  }

  function renderLeaders(b, list) {
    setText('#cmsLeadersTitle', b && b.title);
    var ul = document.getElementById('cmsLeaders');
    if (!ul || !list || !list.length) return;
    ul.innerHTML = list.map(function (l) {
      var tag = l.is_current ? ' <span class="muted">(Interim President)</span>' : '';
      return '<li' + (Number(l.is_current) ? ' class="is-current"' : '') + '>'
        + '<span class="who">' + escT(l.name) + tag + '</span><span class="when">' + escT(l.term) + '</span></li>';
    }).join('');
  }

  function groupBy(list, fn) {
    var out = {};
    list.forEach(function (r) { var k = fn(r); (out[k] = out[k] || []).push(r); });
    return out;
  }

  /* ---------------------------------------------------------------- officers
     OFFICERS — one roster per school_year (e.g. "2025-2026").
     - `list` holds EVERY year from the API; we group by school_year first,
       fill the #cmsOfficersYear dropdown (newest first), then render only the
       selected year, grouped by category (Executives, College Directors, ...).
     - `sort_order` is already auto-assigned by the API on create, so the only
       thing that decides position here is the stored order (category, then
       sort_order). No manual sorting in JS. */
  var officersCache = [];
  var officersTitle = '';
  var officersYear = null;

  function officersYears(list) {
    var seen = {};
    (list || []).forEach(function (r) {
      var y = (r.school_year || '').trim() || '2025-2026';
      seen[y] = true;
    });
    return Object.keys(seen).sort().reverse(); // newest school year first
  }

  function renderOfficersYearPicker(list) {
    var sel = document.getElementById('cmsOfficersYear');
    var note = document.getElementById('cmsOfficersYearNote');
    if (!sel) return;
    var years = officersYears(list);
    if (!years.length) return;
    // Keep the admin's manual choice; otherwise default to the newest year.
    if (!officersYear || years.indexOf(officersYear) < 0) officersYear = years[0];
    sel.innerHTML = years.map(function (y) {
      return '<option value="' + escT(y) + '"' + (y === officersYear ? ' selected' : '') + '>S.Y. ' + escT(y) + '</option>';
    }).join('');
    if (note) note.textContent = years.length > 1 ? years.length + ' school years available' : '';
    if (!sel.__csapBound) {
      sel.__csapBound = true;
      sel.addEventListener('change', function () {
        officersYear = sel.value;
        renderOfficers(null, officersCache);
      });
    }
  }

  function renderOfficers(b, list) {
    if (b && b.title !== undefined) officersTitle = b.title;
    setText('#cmsOfficersTitle', officersTitle);
    if (list && list.length) officersCache = list;
    list = (list && list.length ? list : officersCache);
    if (!list || !list.length) return;
    renderOfficersYearPicker(list);
    // Show only the selected school year's roster.
    var scoped = list.filter(function (r) {
      var y = ((r.school_year || '').trim() || '2025-2026');
      return y === officersYear;
    });
    if (!scoped.length) scoped = list; // fallback: old rows without a year
    var byCat = groupBy(scoped, function (r) { return r.category; });

    // Optional per-officer comment / note shown under the member.
    function commentHtml(p) {
      return p.comment ? '<span class="officer-comment">' + escT(p.comment) + '</span>' : '';
    }
    function personHtml(p) {
      return '<div class="person"' + (p.department ? ' data-dept="' + escT(p.department) + '"' : '') + '>'
        + '<span class="role">' + escT(p.role) + '</span><span class="name">' + escT(p.name) + '</span>'
        + commentHtml(p) + '</div>';
    }

    // -- Executives block --
    var exec = byCat['Executives'] || [];
    var execEl = document.getElementById('cmsOfficersExec');
    if (execEl) execEl.innerHTML = exec.map(personHtml).join('');

    // -- College Directors block --
    var dirs = byCat['College Directors'] || [];
    var dirEl = document.getElementById('cmsOfficersDir');
    if (dirEl) dirEl.innerHTML = dirs.map(personHtml).join('');

    // -- Representatives block (grouped further by department) --
    var reps = byCat['Representatives'] || [];
    var repEl = document.getElementById('cmsReps');
    if (repEl) {
      var byDept = groupBy(reps, function (r) { return r.department || 'Others'; });
      repEl.innerHTML = Object.keys(byDept).map(function (dept) {
        var rows = byDept[dept].map(function (r) {
          return '<div class="rep-row"><span class="rep-year">' + escT(r.year_level || 'Representative') + '</span>'
            + '<span class="rep-names">' + escT(r.name) + commentHtml(r) + '</span></div>';
        }).join('');
        return '<article class="rep-card" data-dept="' + dept + '">'
          + '<header class="rep-head"><span class="rep-badge">' + escT(dept.slice(0, 3).toUpperCase()) + '</span>'
          + '<h4>' + escT(dept) + ' Department</h4></header><div class="rep-list">' + rows + '</div></article>';
      }).join('');
    }

    // -- Volunteer Scholars Development Committee block --
    var cm = byCat['Volunteer Scholars Development Committee'] || [];
    var cmEl = document.getElementById('cmsCommittee');
    if (cmEl) {
      var head = cm.filter(function (r) { return r.role === 'Committee Head'; });
      var teams = cm.filter(function (r) { return r.role !== 'Committee Head'; });
      cmEl.innerHTML = (head.length ? '<div class="person-grid">' + head.map(personHtml).join('') + '</div>' : '')
        + '<div class="committee-grid mt-2">' + teams.map(function (p) {
          return '<div class="dept" data-dept="' + escT(p.department || '') + '"><h4>' + escT(p.role) + '</h4>'
            + '<p class="dept-names">' + escT(p.name) + commentHtml(p) + '</p></div>';
        }).join('') + '</div>';
    }

    // -- Scholarship Coordinator block --
    var co = byCat['Scholarship Coordinator'] || [];
    var coEl = document.getElementById('cmsCoordinators');
    if (coEl) coEl.innerHTML = co.map(personHtml).join('');
  }

  function renderContact(b, cards) {
    setText('#cmsContactTitle', b.title);
    setImg('#cmsProjectImg', b.project_image);
    setText('#cmsProjectCaption', b.project_caption);
    var grid = document.getElementById('cmsContactCards');
    if (grid && cards && cards.length) {
      grid.innerHTML = cards.map(function (c) {
        return '<a class="contact-card" href="' + escT(c.url || '#') + '"' + (/^https?:/i.test(c.url || '') ? ' target="_blank" rel="noopener"' : '') + '>'
          + (c.image ? '<img src="' + escT(c.image) + '" alt="' + escT(c.label) + '" loading="lazy" />' : '')
          + '<span class="label">' + escT(c.label) + '</span><span class="value">' + escT(c.value) + '</span></a>';
      }).join('');
    }
  }

  function renderCity(b, sdp, faqs) {
    setText('#cmsCityBanner', b.banner_title);
    setParas('#cmsCityLede', b.lede);
    setText('#cmsSdpTitle', b.sdp_title); setParas('#cmsSdpBody', b.sdp_body);
    setText('#cmsSdpTypesTitle', b.sdp_types_title);
    setText('#cmsFaqTitle', b.faq_title);
    setText('#cmsGuideTitle', b.guide_title);
    setImg('#cmsGuideImg', b.guide_image);

    var sdpWrap = document.getElementById('cmsSdp');
    if (sdpWrap && sdp && sdp.length) {
      sdpWrap.innerHTML = sdp.map(function (s, i) {
        var items = lines(s.items);
        return '<div class="sdp-card"><h4>' + escT(s.title) + '</h4>' + (s.body ? '<p>' + escT(s.body) + '</p>' : '')
          + (items.length ? '<ul class="arrow-list">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' : '')
          + '</div>';
      }).join('');
    }
    var faqWrap = document.getElementById('cmsFaq');
    if (faqWrap && faqs && faqs.length) {
      faqWrap.innerHTML = faqs.map(function (f, i) {
        return '<details class="faq-item"' + (i === 0 ? ' open' : '') + '><summary>' + escT(f.category) + ' &mdash; ' + escT(f.question) + '</summary>'
          + '<div class="faq-body">' + escT(f.answer) + '</div></details>';
      }).join('');
    }
  }

  function renderHk(b, features, prices) {
    setText('#cmsHkBanner', b.banner_title);
    setParas('#cmsHkLede', b.lede);
    setText('#cmsHkWhoTitle', b.who_title);
    setList('#cmsHkWho', b.who_lines);
    setText('#cmsHkBenefitsTitle', b.benefits_title);
    setParas('#cmsHkPriceNote', b.price_note);
    setText('#cmsHkEligTitle', b.eligibility_title);
    setText('#cmsHkEligSub', b.eligibility_sub); setList('#cmsHkElig', b.eligibility_lines);
    setText('#cmsHkReqSub', b.requirements_sub); setParas('#cmsHkReqBody', b.requirements_body);
    setList('#cmsHkReq', b.requirements_lines);
    setParas('#cmsHkMaintenance', b.maintenance);
    setText('#cmsHkExamTitle', b.exam_title); setList('#cmsHkExam', b.exam_lines);
    setText('#cmsHkDutyTitle', b.duty_title); setList('#cmsHkDuty', b.duty_lines);
    setText('#cmsHkRenewTitle', b.renewal_title); setParas('#cmsHkRenewBody', b.renewal_body);
    setText('#cmsHkRenewSub', b.renewal_sub); setList('#cmsHkRenew', b.renewal_lines);
    setParas('#cmsHkRenewNote', b.renewal_note);

    var fWrap = document.getElementById('cmsHkFeatures');
    if (fWrap && features && features.length) {
      fWrap.innerHTML = features.map(function (f) {
        return '<div class="feature"><strong>' + escT(f.title) + '</strong><span>' + escT(f.body) + '</span></div>';
      }).join('');
    }
    var pWrap = document.getElementById('cmsHkPrices');
    if (pWrap && prices && prices.length) {
      pWrap.innerHTML = prices.map(function (p) {
        return '<div class="price"><strong>' + escT(p.code) + '</strong><span>' + escT(p.price) + '</span></div>';
      }).join('');
    }
  }
  function setList(sel, text) {
    var ul = document.querySelector(sel);
    if (!ul) return;
    var items = lines(text);
    ul.innerHTML = items.map(function (t) { return '<li>' + escT(t) + '</li>'; }).join('');
  }

  function renderEnrollment(b, steps) {
    setText('#cmsEnrollBanner', b.banner_title);
    setText('#cmsEnrollTitle', b.title);
    setText('#cmsEnrollReqHeading', b.requirements_heading);
    setList('#cmsEnrollReq', b.requirements_lines);
    setText('#cmsWalkinTitle', b.walkin_title);
    setText('#cmsOnlineTitle', b.online_title);
    setParas('#cmsOnlineNote', b.online_note);
    if (steps && steps.length) {
      var walk = steps.filter(function (s) { return s.mode === 'walkin'; });
      var onl = steps.filter(function (s) { return s.mode === 'online'; });
      var wEl = document.getElementById('cmsWalkin');
      if (wEl) wEl.innerHTML = walk.map(function (s) {
        return '<div class="step"><div><h4>' + escT(s.title) + '</h4>' + (s.body ? '<p>' + escT(s.body) + '</p>' : '') + '</div></div>';
      }).join('');
      var oEl = document.getElementById('cmsOnline');
      if (oEl) oEl.innerHTML = onl.map(function (s) {
        var body = s.body || '';
        var m = body.match(/https?:\/\/\S+/);
        var title = escT(s.title);
        if (m) {
          var link = m[0];
          body = escT(body.replace(link, '').replace(/\s*—\s*/, '').trim());
          body = (body ? body + ' ' : '') + '<a href="' + escT(link) + '" target="_blank" rel="noopener">&raquo; Register Here &laquo;</a>';
        } else {
          body = escT(body);
        }
        return '<div class="step"><div><h4>' + title + '</h4>' + (body ? '<p>' + body + '</p>' : '') + '</div></div>';
      }).join('');
    }
  }

  function renderAnnouncements(b, list) {
    setText('#cmsAnnBanner', b.banner_title);
    setText('#cmsAnnTitle', b.section_title);
    var wrap = document.getElementById('cmsDocs');
    if (wrap && list && list.length) {
      wrap.innerHTML = list.map(function (a) {
        return '<article class="doc-card">'
          + (a.image ? '<img src="' + escT(a.image) + '" alt="' + escT(a.title) + '" loading="lazy" />' : '')
          + '<div class="doc-body"><strong>' + escT(a.title) + '</strong>'
          + (a.document_url ? '<a class="btn btn-primary btn-sm" href="' + escT(a.document_url) + '" target="_blank" rel="noopener">View document</a>' : '')
          + '</div></article>';
      }).join('');
    }
  }

  function renderEvents(b, list) {
    setText('#cmsEventsBanner', b.banner_title);
    if (!list || !list.length) return;
    var cards = list.filter(function (e) { return e.kind === 'event'; });
    var stories = list.filter(function (e) { return e.kind === 'story'; });
    var cEl = document.getElementById('cmsEvents');
    if (cEl) cEl.innerHTML = cards.map(function (e) {
      return '<article class="event-card">'
        + (e.image ? '<img src="' + escT(e.image) + '" alt="' + escT(e.title) + '" loading="lazy" />' : '')
        + '<div class="event-body"><h3>' + escT(e.title) + '</h3>'
        + (e.link_url ? '<a class="btn btn-accent btn-sm" href="' + escT(e.link_url) + '" target="_blank" rel="noopener">Check it out!</a>' : '')
        + '</div></article>';
    }).join('');
    var sEl = document.getElementById('cmsStories');
    if (sEl) sEl.innerHTML = stories.map(function (e) {
      return '<div class="story"><h3>' + escT(e.title) + '</h3>'
        + (e.link_url ? '<a class="btn btn-outline btn-sm" href="' + escT(e.link_url) + '" target="_blank" rel="noopener">Read more...</a>' : '')
        + '</div>';
    }).join('');
  }

  /* ==========================================================================
     CALENDAR — the public month grid, the day-detail popup and the header
     marquee. Everything is driven by collections.calendar_entries; the static
     Google embed in index.html stays as the no-JS fallback and is hidden the
     moment a grid is built.
     ========================================================================== */
  var CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var CAL_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var CAL_FALLBACK_KINDS = {
    holiday: 'Public holiday', school_event: 'School event', csap_event: 'CSAP activity',
    deadline: 'Deadline', other: 'Other'
  };
  /* One colour per kind — reused by the grid dots, the popup stripe and the
     marquee so a holiday always looks like a holiday everywhere. */
  var CAL_KIND_COLOR = {
    holiday: '#b23a2e', school_event: '#c99a00', csap_event: '#3f7d1f',
    deadline: '#1c6b86', other: '#6d7a66'
  };
  var calState = { y: 0, m: 0, byDate: {}, kinds: null, built: false, selected: null };

  function calKindLabel(kind) {
    var k = calState.kinds || CAL_FALLBACK_KINDS;
    return k[kind] || CAL_FALLBACK_KINDS[kind] || kind || 'Other';
  }
  function calKindColor(kind) { return CAL_KIND_COLOR[kind] || CAL_KIND_COLOR.other; }
  function calTodayISO() {
    var d = new Date();
    return calISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  function calISO(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  /* Parse "YYYY-MM-DD" as a LOCAL date — new Date('2026-01-01') is UTC, which
     shifts a day back west of Greenwich. */
  function calParse(iso) {
    var p = String(iso || '').split('-');
    return { y: +p[0] || 1970, m: +p[1] || 1, d: +p[2] || 1 };
  }
  function calAddDays(iso, n) {
    var p = calParse(iso), dt = new Date(p.y, p.m - 1, p.d + n);
    return calISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  /* Bucket every entry under each day it covers (date_start … date_end). */
  function calIndex(items) {
    var byDate = {};
    (items || []).forEach(function (it) {
      var start = String(it.date_start || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
      var end = String(it.date_end || start).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) end = start;
      var cur = start, guard = 0;
      while (cur <= end && guard++ < 400) {
        (byDate[cur] = byDate[cur] || []).push(it);
        cur = calAddDays(cur, 1);
      }
    });
    return byDate;
  }
  function calItemsFor(iso) { return calState.byDate[iso] || []; }
  function calItemTime(it) {
    if (Number(it.all_day)) return '';
    var f = String(it.time_from || ''), t = String(it.time_to || '');
    if (f && t) return f + ' – ' + t;
    if (f) return 'From ' + f;
    if (t) return 'Until ' + t;
    return '';
  }
  function calItemDateLine(it) {
    var s = String(it.date_start || ''), e = String(it.date_end || '');
    return (!s || !e || s === e) ? s : (s + ' → ' + e);
  }
  /* CALENDAR_GRID */

  /* -------------------------------------------------- the month grid */
  function calRender() {
    var grid = document.getElementById('cmsCalGrid');
    if (!grid) return;
    var y = calState.y, m = calState.m;
    var first = new Date(y, m, 1);
    var lead = first.getDay();                       // blanks before the 1st
    var today = calTodayISO();

    setText('#cmsCalMonth', CAL_MONTHS[m]);
    setText('#cmsCalYear', String(y));

    /* Legend — only the kinds that actually appear in the data. */
    var seen = {};
    Object.keys(calState.byDate).forEach(function (iso) {
      calState.byDate[iso].forEach(function (it) { seen[it.kind || 'other'] = true; });
    });
    var legend = document.getElementById('cmsCalLegend');
    if (legend) {
      var keys = Object.keys(seen);
      legend.innerHTML = (keys.length ? keys : Object.keys(CAL_FALLBACK_KINDS)).map(function (k) {
        return '<span class="cal-legend-item"><i class="cal-legend-dot' + (k === 'school_event' ? ' hl' : '')
          + '" style="background:' + calKindColor(k) + '"></i>' + escT(calKindLabel(k)) + '</span>';
      }).join('');
    }

    var html = CAL_DOW.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('');
    var monthSeen = 0;
    for (var i = 0; i < 42; i++) {
      var cell = new Date(y, m, 1 - lead + i);
      var cy = cell.getFullYear(), cm = cell.getMonth(), cd = cell.getDate();
      var iso = calISO(cy, cm + 1, cd);
      var outside = cm !== m;
      var items = calItemsFor(iso);
      var hl = items.some(function (it) { return Number(it.is_highlight); });
      if (!outside) monthSeen += items.length;
      var cls = ['cal-cell'];
      if (outside) cls.push('is-outside');
      if (iso === today) cls.push('is-today');
      if (items.length) cls.push('has-events');
      if (hl) cls.push('is-highlight');
      var dots = items.slice(0, 5).map(function (it) {
        return '<i class="cal-dot' + (Number(it.is_highlight) ? ' hl' : '')
          + '" style="background:' + calKindColor(it.kind) + '"></i>';
      }).join('');
      var more = items.length > 5 ? '<i class="cal-dot" style="background:#c9c9c9"></i>' : '';
      var chips = items.slice(0, 2).map(function (it) {
        return '<span class="cal-chip' + (Number(it.is_highlight) ? ' hl' : '') + '">' + escT(it.title) + '</span>';
      }).join('');
      html += '<button type="button" class="' + cls.join(' ') + '" data-cal-day="' + iso + '"'
        + ' aria-label="' + escT(CAL_MONTHS[cm] + ' ' + cd + ', ' + cy + (items.length ? ' — ' + items.length + ' item(s)' : '')) + '">'
        + '<span class="cal-num">' + cd + '</span>'
        + (items.length ? '<span class="cal-dots">' + dots + more + '</span>' + chips : '')
        + '</button>';
    }
    grid.innerHTML = html;
    var empty = document.getElementById('cmsCalEmpty');
    if (empty) empty.hidden = monthSeen > 0;

    /* The real calendar replaces the Google embed fallback. */
    var app = document.getElementById('cmsCalendarApp');
    if (app) app.hidden = false;
    var fb = document.getElementById('cmsCalendarFrame');
    if (fb) fb.hidden = true;
  }

  /* CALENDAR_POPUP */

  /* --------------------------------------------- the day-detail popup */
  function calMarkSelected() {
    var cells = document.querySelectorAll('[data-cal-day]');
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle('is-selected', cells[i].getAttribute('data-cal-day') === calState.selected);
    }
  }
  function calClosePopup() {
    var box = document.getElementById('calPopup');
    if (!box) return;
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    calState.selected = null;
    calMarkSelected();
  }
  function calOpenPopup(iso) {
    var box = document.getElementById('calPopup');
    if (!box) return;
    var items = calItemsFor(iso);
    var p = calParse(iso);
    var nice = CAL_MONTHS[p.m - 1] + ' ' + p.d + ', ' + p.y;
    setText('#calPopTitle', items.length
      ? (items.length === 1 ? items[0].title : items.length + ' things on this day')
      : nice);
    setText('#calPopDate', nice);
    var list = document.getElementById('calPopList');
    if (list) {
      list.innerHTML = items.length ? items.map(function (it) {
        var meta = [];
        var time = calItemTime(it);
        if (time) meta.push(escT(time));
        if (it.date_start !== it.date_end) meta.push(escT(calItemDateLine(it)));
        if (it.location) meta.push(escT(it.location));
        return '<div class="cal-pop-item' + (Number(it.is_highlight) ? ' hl' : '') + '" style="--kind:' + calKindColor(it.kind) + '">'
          + '<div class="cal-pop-item-head"><span class="cal-pop-kind">'
          + escT(calKindLabel(it.kind)) + '</span><strong>' + escT(it.title) + '</strong></div>'
          + (meta.length ? '<div class="cal-pop-meta">' + meta.join('<span>&middot;</span>') + '</div>' : '')
          + (it.description ? '<p class="cal-pop-desc">' + escT(it.description) + '</p>' : '')
          + (it.link ? '<p class="cal-pop-desc"><a href="' + escT(it.link) + '" target="_blank" rel="noopener">Open the original &raquo;</a></p>' : '')
          + '</div>';
      }).join('') : '<p class="cal-pop-empty">Nothing scheduled on this day &mdash; yet.</p>';
    }
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    calState.selected = iso;
    calMarkSelected();
  }

  /* Delegated, so a re-render never needs re-binding. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    if (t.closest('[data-cal-pop-close]')) { calClosePopup(); return; }
    if (t.closest('[data-cal-prev]')) { calShift(-1); return; }
    if (t.closest('[data-cal-next]')) { calShift(1); return; }
    var day = t.closest('[data-cal-day]');
    if (day) {
      var iso = day.getAttribute('data-cal-day');
      var p = calParse(iso);
      if (p.y !== calState.y || (p.m - 1) !== calState.m) {
        calState.y = p.y; calState.m = p.m - 1; calRender();
      }
      calOpenPopup(iso);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') calClosePopup();
  });
  function calShift(n) {
    var d = new Date(calState.y, calState.m + n, 1);
    calState.y = d.getFullYear();
    calState.m = d.getMonth();
    calRender();
  }
  var calTodayBtn = document.querySelector('[data-cal-today]');
  if (calTodayBtn) {
    calTodayBtn.addEventListener('click', function () {
      var t = new Date();
      calState.y = t.getFullYear();
      calState.m = t.getMonth();
      calRender();
    });
  }

  /* CALENDAR_MARQUEE */

  /* ------------------------------------------------------- header marquee */
  var CAL_MARQUEE_KEY = 'csap.marquee.dismissed';
  function calDismissedSignature() {
    try { return sessionStorage.getItem(CAL_MARQUEE_KEY) || ''; } catch (e) { return ''; }
  }
  /**
   * The ticker only speaks up the moment a calendar entry lands on today's
   * date. When nothing is happening today it falls back to the next few
   * upcoming entries, so the bar still tells visitors what is coming.
   */
  function renderMarquee(items) {
    var box = document.getElementById('calMarquee');
    var track = document.getElementById('calMarqueeTrack');
    if (!box || !track) return;
    var byDate = calIndex(items);
    var today = calTodayISO();
    var shown = (byDate[today] || []).slice();
    var label = 'Today';
    if (!shown.length) {
      var horizon = calAddDays(today, 7);
      Object.keys(byDate).forEach(function (iso) {
        if (iso > today && iso <= horizon) shown = shown.concat(byDate[iso]);
      });
      shown.sort(function (a, b) { return String(a.date_start) < String(b.date_start) ? -1 : 1; });
      shown = shown.slice(0, 4);
      label = 'Coming up';
    }
    if (!shown.length) { box.hidden = true; return; }
    /* Already dismissed this exact line-up? Keep the bar closed. */
    var sig = label + '|' + shown.map(function (i) { return i.id + i.date_start; }).join(',');
    if (calDismissedSignature() === sig) { box.hidden = true; return; }
    setText('#calMarqueeTag', label);
    var html = shown.map(function (it) {
      var when = it.date_start === today ? '' : ' <span style="opacity:.75">(' + escT(calItemDateLine(it)) + ')</span>';
      return '<span class="cal-marquee-item">'
        + '<i class="cal-marquee-dot" style="background:' + calKindColor(it.kind) + '"></i>'
        + '<b>' + escT(it.title) + '</b>'
        + '<span style="opacity:.8">' + escT(calKindLabel(it.kind)) + '</span>' + when
        + '</span>';
    }).join('');
    /* Rendered twice: the CSS loop shifts by -50%, so it never shows a gap. */
    track.innerHTML = html + html;
    box.hidden = false;
    var close = document.getElementById('calMarqueeClose');
    if (close && !close.__calBound) {
      close.__calBound = true;
      close.addEventListener('click', function () {
        box.hidden = true;
        try { sessionStorage.setItem(CAL_MARQUEE_KEY, sig); } catch (e) {}
      });
    }
  }

  function renderCalendar(b, items, kinds) {
    setText('#cmsCalendarBanner', b.banner_title);
    if (kinds && Object.keys(kinds).length) calState.kinds = kinds;
    var list = items || [];
    calState.byDate = calIndex(list);
    calState.built = true;
    var now = new Date();
    /* Land on "this month" on the first build and whenever the viewer is still
       looking at the current month; otherwise keep the month they navigated to. */
    if (!calState.y || (calState.y === now.getFullYear() && calState.m === now.getMonth())) {
      calState.y = now.getFullYear();
      calState.m = now.getMonth();
    }
    calRender();
    renderMarquee(list);
  }

  function renderAwards(b, list) {
    setText('#cmsAwardsBanner', b.banner_title);
    setText('#cmsAwardsTitle', b.title);
    setParas('#cmsAwardsP1', b.para1); setParas('#cmsAwardsP2', b.para2);
    var wrap = document.getElementById('cmsAwards');
    if (wrap && list && list.length) {
      wrap.innerHTML = list.map(function (a) {
        return '<article class="award">'
          + (a.image ? '<img src="' + escT(a.image) + '" alt="' + escT(a.name) + '" loading="lazy" />' : '')
          + '<div class="award-body"><p class="award-name">' + escT(a.name) + '</p>'
          + '<p class="award-title">' + escT(a.award) + '</p></div></article>';
      }).join('');
    }
  }

  function renderFooter(s) {
    if (s.footer_about) {
      setHtml('#cmsFooterAbout', escT(s.footer_about) + (s.site_tagline ? '<br /><em>' + escT(s.site_tagline) + '</em>' : ''));
    }
    setText('#cmsFooterEst', s.site_established);
    var copy = $('#cmsFooterCopy');
    if (copy) {
      copy.innerHTML = escT(s.footer_copy || '') + ' &middot; Designed and Developed by <span class="devs">' + escT(s.footer_credit || '') + '</span>';
    }
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* main.js builds the nav, carousel, reveal animation and lightbox behaviours.
     It ships as a static deferred script, so it may boot before or after this
     hydration: either way window.CSAP.refresh() re-binds it to the final DOM
     (loadMain() only has to fetch it when that script was not on the page). */
  var mainLoaded = false;
  function loadMain() {
    // Already on the page: just rebind to the freshly rendered DOM.
    if (window.CSAP && typeof window.CSAP.refresh === 'function') {
      window.CSAP.refresh();
      return;
    }
    if (mainLoaded || window.__csapMainLoaded) return;
    mainLoaded = true;
    window.__csapMainLoaded = true;
    var s = document.createElement('script');
    s.src = 'assets/js/main.js';
    /* main.js is normally already on the page (a static defer script). This is
       only a fallback, so no defer/async is set: a dynamically inserted script
       already runs as soon as it has loaded, whereas adding defer here can
       leave it pending forever in Chrome. */
    s.onload = function () {
      if (window.CSAP && typeof window.CSAP.refresh === 'function') window.CSAP.refresh();
    };
    s.onerror = function () {
      if (window.console) console.warn('CSAP-COC: assets/js/main.js could not be loaded.');
    };
    document.body.appendChild(s);
  }

  /* ------------------------------------------------------- page dispatcher
     One entry per editable page: blocks -> that page's section of the site.
     Kept as a table so a single section can be re-rendered on its own, which
     is what the admin live-preview bridge (window.CSAP.preview) needs. */
  var lastPayload = null;
  var PAGE_RENDERERS = {
    hero: function (b) { renderHero(b); },
    about: function (b) { renderAbout(b); },
    history: function (b, c) { renderHistory(b, c.history_pillars); },
    leaders: function (b, c) { renderLeaders(b, c.leaders); },
    officers: function (b, c) { renderOfficers(b, c.officers); },
    contact: function (b, c) { renderContact(b, c.contact_cards); },
    city_scholarship: function (b, c) { renderCity(b, c.sdp_types, c.faqs); },
    hk_scholarship: function (b, c) { renderHk(b, c.hk_features, c.hk_prices); },
    enrollment: function (b, c) { renderEnrollment(b, c.enrollment_steps); },
    announcements: function (b, c) { renderAnnouncements(b, c.announcements); },
    events: function (b, c) { renderEvents(b, c.events); },
    calendar: function (b, c) { renderCalendar(b, c.calendar_entries, c.kinds); },
    awards: function (b, c) { renderAwards(b, c.awardees); }
  };

  /* A single page's blocks -> its section. Own try/catch so one broken page
     can never stop the rest of the site from rendering. */
  function renderPage(key, d) {
    var fn = PAGE_RENDERERS[key];
    if (!fn) return;
    try {
      fn(d.blocks[key] || {}, d.collections || {}, d.settings || {});
    } catch (e) {
      if (window.console) console.warn('CMS page skipped:', key, e);
    }
  }

  /* Apply a content payload to the page. */
  function apply(d) {
    lastPayload = d;
    try {
      var S = d.settings || {};

      applyHead(S);
      renderBrand(S);
      renderNav(d.nav);
      Object.keys(PAGE_RENDERERS).forEach(function (k) { renderPage(k, d); });
      renderFooter(S);
    } catch (e) {
      if (window.console) console.warn('CMS hydration skipped:', e);
    }

    /* Hand the page over to the UI layer (nav, carousel, reveal animation,
       lightbox ...). This happens even when one of the renderers above failed,
       so a single bad row can never leave the rest of the page stuck in its
       "animate in" state (which looks like an empty site). */
    try { document.dispatchEvent(new CustomEvent('cms:rendered')); } catch (e) { /* no-op */ }
    if (window.CSAP && typeof window.CSAP.refresh === 'function') {
      try { window.CSAP.refresh(); } catch (e) { /* no-op */ }
    }
  }

  /* ------------------------------------------------------ admin live preview
     The admin panel (admin/) shows THIS page in a floating iframe so an editor
     sees the change before saving. It forwards unsaved values here and only
     the matching section is re-rendered - nothing else about the public site
     changes, and the bridge is inert unless the admin panel calls it. */
  window.CSAP = window.CSAP || {};
  window.CSAP.preview = {
    /* true once a payload has been applied (i.e. the API answered). */
    ready: function () { return !!lastPayload; },
    /* patch = { block_key: value } for one page; missing keys keep their value. */
    page: function (key, patch) {
      if (!lastPayload || !PAGE_RENDERERS[key]) return false;
      var blocks = lastPayload.blocks[key] || (lastPayload.blocks[key] = {});
      Object.keys(patch || {}).forEach(function (k) { blocks[k] = patch[k]; });
      renderPage(key, lastPayload);
      try { document.dispatchEvent(new CustomEvent('cms:rendered')); } catch (e) { /* no-op */ }
      return true;
    },
    settings: function (patch) {
      if (!lastPayload) return false;
      var S = lastPayload.settings || (lastPayload.settings = {});
      Object.keys(patch || {}).forEach(function (k) { S[k] = patch[k]; });
      try {
        applyHead(S);
        renderBrand(S);
        renderFooter(S);
        renderPage('calendar', lastPayload);   // the calendar survives a settings re-render
        document.dispatchEvent(new CustomEvent('cms:rendered'));
      } catch (e) { /* no-op */ }
      return true;
    }
  };

  /* Live content watcher: the page refreshes itself the moment an admin adds
     or edits anything, so new items appear on the website automatically. */
  function payloadSig(d) {
    return JSON.stringify([d.settings, d.blocks, d.nav, d.collections]);
  }
  var lastSig = null;
  var applied = false;
  function pollTick() {
    if (document.hidden) return;
    api({ r: 'content' }).then(function (d) {
      if (!applied) {
        applied = true;
        lastSig = payloadSig(d);
        apply(d);
        loadMain();
        return;
      }
      var sig = payloadSig(d);
      if (lastSig !== null && sig !== lastSig) {
        if (window.console) console.info('Website content changed — refreshing to show the latest.');
        window.location.reload();
        return;
      }
      lastSig = sig;
    }).catch(function () { /* keep showing the current content */ });
  }

  /* First load: render the content, then hand over to main.js for the UI. */
  api({ r: 'content' }).then(function (d) {
    applied = true;
    lastSig = payloadSig(d);
    apply(d);
    loadMain();
  }).catch(function (e) {
    if (window.console) console.warn('CMS unavailable, showing static content:', e.message);
    loadMain();
  });

  /* Watch for changes while the tab is open and visible. */
  setInterval(pollTick, 15000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) pollTick();
  });
})();