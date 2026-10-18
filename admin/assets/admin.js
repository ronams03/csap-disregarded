/* ==========================================================================
   CSAP-COC  |  Admin panel application (vanilla JS, API-driven)
   Talks only to ../api/index.php  —  no server-rendered markup.
   ========================================================================== */
(function () {
  'use strict';

  var API = '../api/index.php';
  var root = document.getElementById('root');
  var overlay = document.getElementById('overlay');

  /* pages      : current page per list (keyed, so every list keeps its own)
     listQuery  : server-side search text per generic list
     archives   : server-side search + filters per Archive-storage list
     students   : server-side search + filters of the Student Management list */
  var state = { admin: null, csrf: '', meta: {}, labels: {}, optYear: '', pages: {}, listQuery: {}, listFilters: {}, archives: {}, students: null, fetch: {} };

  /* ------------------------------------------------------------------ utils */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(html) { root.innerHTML = html; }

  /* Live search: run `fn` once the user pauses typing (dropdowns apply at once). */
  function debounce(fn, wait) {
    var t = null;
    return function () {
      var self = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, wait || 300);
    };
  }

  /* Live search fires several requests; only the NEWEST may repaint the list, so
     a slow reply can never overwrite fresher results. */
  function fetchSeq(key) {
    state.fetch = state.fetch || {};
    return (state.fetch[key] = (state.fetch[key] || 0) + 1);
  }
  function isLatest(key, seq) {
    return !!state.fetch && state.fetch[key] === seq;
  }

  /* Repainting a list replaces its filter card, which would blur the box the user
     is typing in — remember the focused control (and its caret) and restore it. */
  function captureFocus(scope) {
    var a = document.activeElement;
    if (!a || !scope || !scope.contains(a)) return null;
    var id = a.id;
    if (!id && a.classList && a.classList.contains('combo-input') && a.parentNode) {
      var sel = a.parentNode.querySelector('select');   // combo-enhanced dropdown
      if (sel && sel.id) id = sel.id;
    }
    if (!id) return null;
    var pos = null;
    try { pos = a.selectionStart; } catch (e) { /* selects have no caret */ }
    return { id: id, pos: pos };
  }
  function restoreFocus(scope, snap) {
    if (!snap) return;
    var node = document.getElementById(snap.id);
    if (!node) return;
    // A dropdown that was upgraded to a searchable combo: focus its text box.
    if (node.classList && node.classList.contains('combo-native') && node.parentNode) {
      var comboInput = node.parentNode.querySelector('.combo-input');
      if (comboInput) node = comboInput;
    }
    if (!scope.contains(node)) return;
    try {
      node.focus();
      if (snap.pos != null && node.setSelectionRange && typeof node.value === 'string') {
        var p = Math.min(snap.pos, node.value.length);
        node.setSelectionRange(p, p);
      }
    } catch (e) { /* non-text control — focus alone is enough */ }
  }

  /* The value the admin is typing RIGHT NOW. A live query may still be in flight
     with an older value, so repainting must reuse this instead of the stored one
     — otherwise keystrokes typed during the request would be wiped out. */
  function liveTypedValue(snap, id) {
    if (!snap || snap.id !== id) return null;
    var box = document.getElementById(id);
    return box ? box.value : null;
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function qparams(hash) {
    var out = {};
    var qi = hash.indexOf('?');
    if (qi < 0) return out;
    hash.slice(qi + 1).split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0]) out[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return out;
  }

  /* ------------------------------------------------- sidebar state (persist) */
  var NAV_STATE_KEY = 'csap.admin.navGroups';
  function navSlug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function navIsOpen(key) {
    try {
      var raw = localStorage.getItem(NAV_STATE_KEY);
      if (!raw) return true;
      var map = JSON.parse(raw) || {};
      return map[key] === undefined ? true : !!map[key];
    } catch (e) { return true; }
  }
  function navSetOpen(key, open) {
    try {
      var raw = localStorage.getItem(NAV_STATE_KEY);
      var map = raw ? (JSON.parse(raw) || {}) : {};
      map[key] = !!open;
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify(map));
    } catch (e) { /* storage disabled — state simply won't persist */ }
  }

  /* -------------------------------------------------------------- icon set */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 14 9 5 9-5"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    crown: '<path d="M4 8l4 4 4-7 4 7 4-4v9H4z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.8M18 20c0-2.2-.7-3.8-2-4.6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    star: '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9 6.8 19.2l1-5.9L3.5 9.2l5.9-.9z"/>',
    award: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.6 6 5.1-2.6 5.1 2.6-1.6-6"/>',
    bell: '<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5 1.5 5h-15S6 13 6 9Z"/><path d="M10.5 18a1.8 1.8 0 0 0 3 0"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 12H3M6 8l-4 4 4 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-5h8v5"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    archive: '<path d="M4 4h16v3.5H4z"/><path d="M6 7.5V20h12V7.5"/><path d="M10 11.5h4"/>',
    restore: '<path d="M9 14 4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-4"/>',
    upload: '<path d="M12 16V5M8 9l4-4 4 4"/><path d="M5 19h14"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m5 18 5-5 4 4 3-2 2 3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    move: '<path d="M12 3v18M3 12h18"/><path d="M12 3l-2.4 2.4M12 3l2.4 2.4M12 21l-2.4-2.4M12 21l2.4-2.4M3 12l2.4-2.4M3 12l2.4 2.4M21 12l-2.4-2.4M21 12l-2.4 2.4"/>',
    zoomin: '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-3.5-3.5"/>',
    zoomout: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-3.5-3.5"/>',
    refresh: '<path d="M20 12a8 8 0 1 0-2.4 5.7M20 5v4.5h-4.5"/>'
  };
  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
      + (cls ? ' class="' + cls + '"' : '') + '>' + (ICONS[name] || '') + '</svg>';
  }

  /* ------------------------------------------------------------- API client */
  function api(resource, params, opts) {
    params = params || {}; opts = opts || {};
    var url = new URL(API, window.location.href);
    url.searchParams.set('r', resource);
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') url.searchParams.set(k, params[k]);
    });
    var method = opts.method || 'GET';
    var headers = {};
    var init = { method: method, credentials: 'same-origin', headers: headers };
    if (opts.body) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    if (method !== 'GET') headers['X-CSRF-Token'] = state.csrf || '';
    return fetch(url.toString(), init).then(function (res) {
      return res.text().then(function (txt) {
        var json;
        try { json = JSON.parse(txt); } catch (e) { throw new Error('Unexpected server response (HTTP ' + res.status + ').'); }
        if (!json.success) {
          var err = new Error(json.error || ('Request failed (HTTP ' + res.status + ').'));
          err.status = res.status;
          throw err;
        }
        return json.data;
      });
    });
  }

  /* ---------------------------------------------------------------- feedback
     Sweet-alert style popups. Centred card with an icon, optional buttons and
     a count-down line timer. The card keeps a neutral border - no coloured
     edges - matching the rest of the panel. */
  function saIconHtml(icon) {
    var paths = {
      success:  '<circle cx="26" cy="26" r="23"/><path d="M15 27l8 8 14-17"/>',
      error:    '<circle cx="26" cy="26" r="23"/><path d="M18 18l16 16M34 18L18 34"/>',
      warning:  '<path d="M26 6 48 44H4Z"/><path d="M26 19v13M26 38h.01"/>',
      question: '<circle cx="26" cy="26" r="23"/><path d="M20 21a6 6 0 1 1 7.5 5.8c-1.3.5-2.5 1.6-2.5 3.4M26 36h.01"/>',
      info:     '<circle cx="26" cy="26" r="23"/><path d="M26 24v11M26 17h.01"/>'
    };
    return '<svg viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="2.6"'
      + ' stroke-linecap="round" stroke-linejoin="round">' + (paths[icon] || paths.info) + '</svg>';
  }

  function sweetAlert(opts) {
    opts = opts || {};
    var existing = document.getElementById('saRoot');
    if (existing) existing.remove();

    return new Promise(function (resolve) {
      var icon = opts.icon || 'info';
      var timer = opts.timer || 0;
      var back = document.createElement('div');
      back.className = 'sa-back';
      back.id = 'saRoot';

      var confirmClass = opts.danger ? 'btn-danger' : 'btn-primary';
      var confirmLabel = opts.confirmText || (icon === 'error' ? 'OK' : (opts.showCancel ? 'Yes' : 'OK'));

      back.innerHTML =
        '<div class="sa-pop' + (icon === 'error' ? ' has-error' : '') + '" role="alertdialog" aria-modal="true">'
        + '<div class="sa-icon sa-icon--' + esc(icon) + '">' + saIconHtml(icon) + '</div>'
        + '<h3 class="sa-title">' + esc(opts.title || '') + '</h3>'
        + (opts.html ? '<div class="sa-text">' + opts.html + '</div>'
                     : (opts.text ? '<div class="sa-text">' + esc(opts.text) + '</div>' : ''))
        + '<div class="sa-actions">'
        + (opts.showCancel ? '<button type="button" class="btn btn-outline sa-cancel">' + esc(opts.cancelText || 'Cancel') + '</button>' : '')
        + '<button type="button" class="btn ' + confirmClass + ' sa-confirm">' + esc(confirmLabel) + '</button>'
        + '</div>'
        + (timer ? '<div class="sa-timer"><i style="animation-duration:' + timer + 'ms"></i></div>' : '')
        + '</div>';
      document.body.appendChild(back);

      function done(out) {
        back.classList.add('is-closing');
        setTimeout(function () { if (document.body.contains(back)) back.remove(); }, 170);
        if (timer) clearTimeout(timerHandle);
        document.removeEventListener('keydown', onKey);
        resolve(out);
      }
      var timerHandle = timer ? setTimeout(function () { done({ isConfirmed: false, isDismissed: true }); }, timer) : 0;

      back.querySelector('.sa-confirm').onclick = function () { done({ isConfirmed: true, isDismissed: false }); };
      var cancelBtn = back.querySelector('.sa-cancel');
      if (cancelBtn) cancelBtn.onclick = function () { done({ isConfirmed: false, isDismissed: true }); };
      back.onclick = function (e) { if (e.target === back) done({ isConfirmed: false, isDismissed: true }); };
      function onKey(e) {
        if (e.key !== 'Escape' || !document.body.contains(back)) return;
        done({ isConfirmed: false, isDismissed: true });
      }
      document.addEventListener('keydown', onKey);
    });
  }

  /** Notification shortcut - auto-dismisses after the line timer runs out. */
  function toast(title, msg, isErr) {
    sweetAlert({
      icon: isErr ? 'error' : 'success',
      title: title,
      text: msg || '',
      timer: isErr ? 2600 : 1700
    });
  }

  function confirmDialog(title, msg, confirmLabel) {
    return sweetAlert({
      icon: 'question',
      title: title,
      text: msg,
      showCancel: true,
      confirmText: confirmLabel || 'Confirm',
      cancelText: 'Cancel',
      danger: confirmLabel === 'Delete'
    }).then(function (r) { return r.isConfirmed; });
  }

  /* ----------------------------------------------------------- nav structure */
  function navConfig() {
    /* One single dropdown (section labels keep it organised as more features
       are added). Drop a new item in the right section and it appears here. */
    return {
      group: 'Manage Website',
      icon: 'layers',
      items: [
        { url: '#/page/hero', label: 'Hero / Welcome', icon: 'home', section: 'Content' },
        { url: '#/page/about', label: 'About Us', icon: 'info' },
        { url: '#/page/history', label: 'Our History', icon: 'clock' },
        { url: '#/page/leaders', label: 'Lineage of Leadership', icon: 'crown' },
        { url: '#/page/officers', label: 'Officers', icon: 'users' },
        { url: '#/page/contact', label: 'Contact Us', icon: 'mail' },

        { url: '#/page/city_scholarship', label: 'City Scholarship', icon: 'star', section: 'Scholarships' },
        { url: '#/page/hk_scholarship', label: 'HK Scholarship', icon: 'award' },
        { url: '#/page/enrollment', label: 'Enrollment Process', icon: 'list' },

        { url: '#/page/announcements', label: 'Announcements', icon: 'bell', section: 'Updates' },
        { url: '#/page/events', label: 'Events & Stories', icon: 'calendar' },
        { url: '#/page/calendar', label: 'Calendar', icon: 'calendar' },

        { url: '#/page/awards', label: 'Awards & Recognition', icon: 'award', section: 'Awards' },

        { url: '#/list/nav_items', label: 'Navigation', icon: 'list', section: 'Management' },
        { url: '#/users', label: 'Admin Users', icon: 'users', super: true },
        { url: '#/settings', label: 'Site Settings', icon: 'settings', divider: true }
      ]
    };
  }

  /* Third sidebar dropdown: the CSAP scholar masterlist. */
  function studentsNavConfig() {
    return {
      group: 'Student Management',
      icon: 'users',
      items: [
        { url: '#/students', label: 'All Students', icon: 'users' },
        { url: '#/archive/students', label: 'Archive', icon: 'archive' }
      ]
    };
  }

  /* Second sidebar dropdown: manage the Officers form dropdown values.
     Kept for the breadcrumb / "Back" links — it is no longer a sidebar group;
     the entry point is the Officer Options button on the Officers page. */
  function optionsNavConfig() {
    return {
      group: 'Officer Options',
      icon: 'settings',
      items: [
        { url: '#/options/school_year', label: 'School Years', icon: 'calendar' },
        { url: '#/options/category', label: 'Category / Block', icon: 'layers' },
        { url: '#/options/department', label: 'Department', icon: 'info' },
        { url: '#/options/year_level', label: 'Year Level', icon: 'list' },
        { url: '#/options/role', label: 'Role / Position', icon: 'crown' }
      ]
    };
  }
  /* The sidebar shows Website + Student Management only. Officer Options now
     hangs off the Officers page, where the dropdowns it manages are used. */
  function navGroups() { return [navConfig(), studentsNavConfig()]; }

  /* Officer options: one button on the Officers page head, opening a dropdown
     with the five managed lists. Lives next to the page it serves. */
  function officerOptionsHtml() {
    var fields = ['school_year', 'category', 'department', 'year_level', 'role'];
    return '<span class="opt" id="optWrap">'
      + '<button type="button" class="btn btn-outline btn-sm" id="optBtn" aria-expanded="false" '
      + 'aria-haspopup="true" title="Manage the Officers form dropdown values">'
      + icon('settings') + 'Officer Options</button>'
      + '<div class="opt-drop" id="optDrop" role="menu">'
      + '<span class="qa-title">Officer Options</span>'
      + '<div class="opt-list">'
      + fields.map(function (f) {
          return '<a href="#/options/' + f + '" role="menuitem">' + icon('settings') + esc(optionsFieldLabel(f)) + '</a>';
        }).join('')
      + '</div></div></span>';
  }
  function wireOfficerOptions(scope) {
    var wrap = scope.querySelector ? scope.querySelector('#optWrap') : null;
    if (!wrap || wrap.__optWired) return;
    wrap.__optWired = true;
    var btn = wrap.querySelector('#optBtn');
    var drop = wrap.querySelector('#optDrop');
    if (!btn || !drop) return;
    btn.onclick = function (e) {
      e.stopPropagation();
      var on = drop.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(on));
    };
    document.addEventListener('click', function () {
      drop.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function sidebarHtml() {
    var html = '<aside class="sidebar" id="sidebar">';
    html += '<div class="sidebar-brand"><img src="../assets/images/logo-128.png" alt="" />'
      + '<span><b>CSAP-COC</b><small>Admin Panel</small></span></div>';
    html += '<div class="sidebar-scroll">';
    html += '<a class="nav-link" href="#/dashboard" data-nav="#/dashboard"><span class="nav-ico">' + icon('dashboard') + '</span>Dashboard</a>';
    navGroups().forEach(function (cfg) {
      var items = cfg.items.filter(function (it) { return !it.super || (state.admin && state.admin.role === 'superadmin'); });
      var lastSection = null;
      var navKey = navSlug(cfg.group);
      var open = navIsOpen(navKey);
      html += '<div class="nav-group' + (open ? ' is-open' : '') + '" data-nav-key="' + navKey + '">'
        + '<button type="button" class="nav-summary" aria-expanded="' + (open ? 'true' : 'false') + '">'
        + '<span class="nav-ico">' + icon(cfg.icon) + '</span>' + esc(cfg.group)
        + '<span class="nav-caret">ᯤ</span></button><div class="nav-sub">';
      items.forEach(function (it) {
        if (it.section && it.section !== lastSection) {
          html += '<div class="nav-sub-head">' + esc(it.section) + '</div>';
          lastSection = it.section;
        }
        if (it.divider) html += '<div class="nav-divider"></div>';
        html += '<a class="nav-link' + (routeKey() === it.url ? ' is-active' : '')
          + '" href="' + it.url + '" data-nav="' + it.url + '">'
          + '<span class="nav-ico">' + icon(it.icon) + '</span>' + esc(it.label) + '</a>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    html += '<div class="sidebar-foot"><span class="avatar">' + (state.admin && state.admin.avatar
      ? '<img src="../' + esc(state.admin.avatar) + '" alt="" />' : esc(initials(state.admin && state.admin.name))) + '</span>'
      + '<span class="who"><b>' + esc(state.admin ? state.admin.name : '') + '</b><span>' + esc(state.admin ? state.admin.role : '') + '</span></span></div>';
    html += '</aside>';
    return html;
  }

  function topbarHtml(title, crumb) {
    return '<header class="topbar">'
      + '<button class="hamburger" id="burger" aria-label="Toggle menu"><span></span></button>'
      + crumbsHtml(title)
      + '<div class="spacer"></div>'
      + '<button class="topbar-btn" id="viewSite" title="Open the public site">' + icon('eye') + 'View site</button>'
      + '<div class="account">'
      +   '<button class="account-btn" id="acctBtn" aria-haspopup="true" aria-expanded="false">'
      +     '<span class="avatar">' + (state.admin && state.admin.avatar
            ? '<img src="../' + esc(state.admin.avatar) + '" alt="" />' : esc(initials(state.admin && state.admin.name))) + '</span>'
      +     '<span><span class="nm">' + esc(state.admin ? state.admin.name : '') + '</span><br><span class="rl">' + esc(state.admin ? state.admin.role : '') + '</span></span>'
      +   '</button>'
      +   '<div class="menu" id="acctMenu">'
      +     '<div class="menu-head"><b>' + esc(state.admin ? state.admin.name : '') + '</b><span>' + esc(state.admin ? state.admin.email : '') + '</span></div>'
      +     '<a href="#/profile"><span class="menu-ico">' + icon('user') + '</span>Admin Profile</a>'
      +     (state.admin && state.admin.role === 'superadmin' ? '<a href="#/users"><span class="menu-ico">' + icon('users') + '</span>Management &middot; Users</a>' : '')
      +     '<div class="divider"></div>'
      +     '<button class="danger" id="logoutBtn"><span class="menu-ico">' + icon('logout') + '</span>Sign out</button>'
      +   '</div>'
      + '</div>'
      + '</header>';
  }

  function shellHtml(title) {
    return sidebarHtml()
      + '<div class="main">' + topbarHtml(title) + '<div class="content" id="content"></div></div>';
  }

  function mountShell(title) {
    root.className = 'app';
    document.title = 'CSAP-COC · Admin Panel';
    el(shellHtml(title));
    applySidebarUI();
    var burger = document.getElementById('burger');
    if (burger) burger.onclick = function () {
      var nowHidden = document.body.classList.toggle('nav-hide');
      try { localStorage.setItem('csap.admin.navHide', nowHidden ? '1' : '0'); } catch (e) {}
    };
    if (overlay) overlay.onclick = function () { document.body.classList.add('nav-hide'); };
    var viewSite = document.getElementById('viewSite');
    if (viewSite) viewSite.onclick = function () { window.open('../index.html', '_blank'); };
    var acctBtn = document.getElementById('acctBtn');
    var acctMenu = document.getElementById('acctMenu');
    if (acctBtn && acctMenu) {
      acctBtn.onclick = function (e) {
        e.stopPropagation();
        var on = acctMenu.classList.toggle('open');
        acctBtn.setAttribute('aria-expanded', String(on));
      };
      document.addEventListener('click', function () {
        acctMenu.classList.remove('open');
        acctBtn.setAttribute('aria-expanded', 'false');
      });
    }
    var logout = document.getElementById('logoutBtn');
    if (logout) logout.onclick = function () {
      api('auth', { a: 'logout' }, { method: 'POST' }).then(function () { state.admin = null; state.csrf = ''; loginScreen(); });
    };
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      a.onclick = function () {
        if (window.matchMedia('(max-width: 900px)').matches) document.body.classList.add('nav-hide');
      };
    });
    // Sidebar dropdowns: fade/slide toggle with persisted open state.
    document.querySelectorAll('.nav-group').forEach(function (g) {
      var k = g.getAttribute('data-nav-key') || 'group';
      var btn = g.querySelector('.nav-summary');
      if (btn) btn.onclick = function () {
        var on = g.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(on));
        navSetOpen(k, on);
      };
    });
  }

  /* Hamburger-collapsible sidebar: closed on phones, remembers preference on
     desktop so the sidebar stays as you left it after a reload. */
  function applySidebarUI() {
    var mobile = window.matchMedia('(max-width: 900px)').matches;
    var pref = '';
    try { pref = localStorage.getItem('csap.admin.navHide') || ''; } catch (e) {}
    if (mobile) document.body.classList.add('nav-hide');
    else document.body.classList.toggle('nav-hide', pref === '1');
  }

  /* ----------------------------------------------------------------- router */
  function routeKey() {
    var h = (window.location.hash || '#/dashboard').replace(/\?.*$/, '');
    return h || '#/dashboard';
  }
  function loading() {
    var c = document.getElementById('content');
    if (c) c.innerHTML = '<div class="grid g-4">' + Array(4).fill('<div class="skeleton" style="height:56px"></div>').join('') + '</div>';
  }
  function route() {
    if (!state.admin) return;
    var key = routeKey();
    loading();
    previewSyncRoute();   // keep / close the floating preview for the new view
    if (key === '#/dashboard' || key === '#/') { mountShell('Dashboard'); viewDashboard(); return; }
    if (key === '#/profile') { mountShell('Admin Profile'); viewProfile(); return; }
    if (key === '#/settings') { mountShell('Site Settings'); viewSettings(); return; }
    if (key === '#/users') { mountShell('Admin Users'); viewUsers(); return; }
    if (key.indexOf('#/users/') === 0) {
      var up = key.split('/');
      if (up[2] === 'new' || up[2] === 'edit') { viewUserForm(up[2] === 'edit' ? up[3] : null); return; }
      mountShell('Admin Users'); viewUsers(); return;
    }
    if (key === '#/students') { mountShell('Student Management'); viewStudents(); return; }
    if (key.indexOf('#/students/') === 0) {
      var stp = key.split('/');
      if (stp[2] === 'new') { mountShell('Add &middot; Student'); viewForm('students', null); return; }
      if (stp[2] === 'edit') { mountShell('Edit &middot; Student'); viewForm('students', stp[3]); return; }
      mountShell('Student Management'); viewStudents(); return;
    }
    if (key.indexOf('#/page/') === 0) {
      var pk = key.split('/')[2];
      if (pk === 'calendar') { mountShell('Calendar'); viewCalendar(); return; }
      mountShell(pageLabel(pk)); viewPage(pk); return;
    }
    if (key.indexOf('#/options/') === 0) {
      var of = key.split('/')[2] || 'school_year';
      mountShell(optionsFieldLabel(of)); viewOptions(of); return;
    }
    if (key.indexOf('#/archive/') === 0) {
      var an = key.split('/')[2] || '';
      mountShell('Archive · ' + collLabel(an)); viewArchive(an); return;
    }
    if (key.indexOf('#/list/') === 0) {
      var parts = key.split('/');           // #, list, name, action?, id?
      var name = parts[2];
      // Students have their own section (filters + paging) — keep old links working.
      if (name === 'students') { window.location.hash = key.replace('#/list/students', '#/students'); return; }
      if (parts[3] === 'new') { mountShell('Add &middot; ' + collLabel(name)); viewForm(name, null); return; }
      if (parts[3] === 'edit') { mountShell('Edit &middot; ' + collLabel(name)); viewForm(name, parts[4]); return; }
      mountShell(collLabel(name)); viewList(name); return;
    }
    mountShell('Dashboard'); viewDashboard();
  }
  function pageLabel(key) {
    var map = { hero: 'Hero / Welcome', about: 'About Us', history: 'Our History', leaders: 'Lineage of Leadership',
      officers: 'Officers', contact: 'Contact Us', city_scholarship: 'City Scholarship', hk_scholarship: 'HK Scholarship',
      enrollment: 'Enrollment Process', announcements: 'Announcements', events: 'Events & Stories',
      calendar: 'Calendar', awards: 'Awards & Recognition' };
    return map[key] || 'Content';
  }
  function collLabel(name) {
    var map = { nav_items: 'Navigation', leaders: 'Lineage of Leadership', officers: 'Officers', announcements: 'Announcements',
      events: 'Events & Stories', awardees: 'Awardees', faqs: 'FAQs', contact_cards: 'Contact cards',
      history_pillars: 'History pillars', sdp_types: 'SDP types', hk_features: 'HK benefits', hk_prices: 'HK price cards',
      enrollment_steps: 'Enrollment steps', officer_options: 'Officer options', users: 'Admin Users',
      students: 'Students' };
    return state.labels[name] || map[name] || name;
  }
  var OPTION_FIELDS = {
    school_year: { label: 'School Years', valueLabel: 'School Year', hint: 'The school years that can be picked when adding an officer.' },
    category: { label: 'Category / Block', valueLabel: 'Category / Block', hint: 'Officer groupings such as Executives, College Directors and Representatives.' },
    department: { label: 'Department', valueLabel: 'Department', hint: 'Departments such as CMA, COED, SCCJ, CAHS, CITE, CEA and Puerto.' },
    year_level: { label: 'Year Level', valueLabel: 'Year Level', hint: 'Year levels such as 1st Year, 2nd Year, 3rd Year and 4th Year.' },
    role: { label: 'Role / Position', valueLabel: 'Role / Position', hint: 'Positions such as President, Vice President and Committee Head.' }
  };
  function optionsValueLabel(key) {
    return (OPTION_FIELDS[key] && OPTION_FIELDS[key].valueLabel) || 'Value';
  }
  function optionsFieldLabel(key) {
    if (key === 'school_year') return 'School Years';
    return (OPTION_FIELDS[key] && OPTION_FIELDS[key].label) || 'Officer Options';
  }

  /* ------------------------------------------------------------ breadcrumbs */
  function ownerPageOf(collection) {
    var keys = Object.keys(PAGE_COLLECTIONS || {});
    for (var i = 0; i < keys.length; i++) {
      if (PAGE_COLLECTIONS[keys[i]].indexOf(collection) >= 0) return keys[i];
    }
    return null;
  }
  function sectionOfUrl(url) {
    var groups = navGroups();
    for (var g = 0; g < groups.length; g++) {
      var items = groups[g].items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].url === url && items[i].section) return items[i].section;
      }
    }
    return null;
  }
  function sectionUrlOf(sect) {
    if (!sect) return null;
    var groups = navGroups();
    for (var g = 0; g < groups.length; g++) {
      var items = groups[g].items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].section === sect && items[i].url) return items[i].url;
      }
    }
    return null;
  }
  /** Trail of crumbs (without the "Admin" root) for the current route. */
  function breadcrumbs() {
    var key = routeKey();
    var seg = key.split('/');
    if (key === '#/dashboard' || key === '#/' || key === '#') return [];
    if (key === '#/profile') return [{ label: 'Admin Profile' }];
    if (key === '#/settings') return [{ label: 'Management' }, { label: 'Site Settings' }];
    if (key === '#/users') return [{ label: 'Management' }, { label: 'Admin Users' }];
    if (key.indexOf('#/users/') === 0) {
      return [
        { label: 'Management' },
        { label: 'Admin Users', url: '#/users' },
        { label: seg[2] === 'edit' ? 'Edit user' : 'Add user' }
      ];
    }
    if (key.indexOf('#/students') === 0) {
      if (seg[2] === 'new') return [{ label: 'Student Management', url: '#/students' }, { label: 'Add new' }];
      if (seg[2] === 'edit') return [{ label: 'Student Management', url: '#/students' }, { label: 'Edit' }];
      return [{ label: 'Student Management' }];
    }
    if (key.indexOf('#/page/') === 0) {
      var pk = seg[2];
      var psect = sectionOfUrl('#/page/' + pk) || 'Content';
      return [
        { label: psect, url: sectionUrlOf(psect) },
        { label: pageLabel(pk) }
      ];
    }
    if (key.indexOf('#/options/') === 0) {
      return [
        { label: 'Officer Options', url: '#/options/school_year' },
        { label: optionsFieldLabel(seg[2] || 'school_year') }
      ];
    }
    if (key.indexOf('#/archive/') === 0) {
      var an = seg[2] || '';
      if (an === 'users') return [{ label: 'Management' }, { label: 'Archive · Admin Users' }];
      if (an === 'students') return [{ label: 'Student Management', url: '#/students' }, { label: 'Archive · Students' }];
      if (an === 'officer_options') return [{ label: 'Officer Options', url: '#/options/school_year' }, { label: 'Archive · Officer options' }];
      var aowner = ownerPageOf(an);
      if (aowner) {
        var aownerLabel = pageLabel(aowner);
        var aosect = sectionOfUrl('#/page/' + aowner) || 'Content';
        return [
          { label: aosect, url: sectionUrlOf(aosect) },
          { label: aownerLabel, url: '#/page/' + aowner },
          { label: 'Archive · ' + collLabel(an) }
        ];
      }
      return [{ label: 'Management' }, { label: 'Archive · ' + collLabel(an) }];
    }
    if (key.indexOf('#/list/') === 0) {
      var name = seg[2];
      var owner = ownerPageOf(name);
      var collName = collLabel(name);
      var trail = [];
      if (owner) {
        var ownerLabel = pageLabel(owner);
        var osect = sectionOfUrl('#/page/' + owner) || 'Content';
        trail.push({ label: osect, url: sectionUrlOf(osect) });
        if (ownerLabel !== collName) trail.push({ label: ownerLabel, url: '#/page/' + owner });
      } else {
        var msect = sectionOfUrl('#/list/' + name) || 'Management';
        trail.push({ label: msect, url: sectionUrlOf(msect) });
      }
      trail.push({ label: collName });
      if (seg[3] === 'new') trail.push({ label: 'Add new' });
      else if (seg[3] === 'edit') trail.push({ label: 'Edit' });
      return trail;
    }
    return [];
  }
  function crumbsHtml(fallbackTitle) {
    var list = breadcrumbs();
    var lastName = list.length ? list[list.length - 1].label : (fallbackTitle || 'Dashboard');
    var mids = list.slice(0, Math.max(0, list.length - 1));
    var html = '<nav class="crumbs" aria-label="Breadcrumb">'
      + '<a class="root label" href="#/dashboard">Admin</a>';
    if (mids.length) {
      html += '<span class="crumbs-mid">';
      mids.forEach(function (c) {
        html += '<span class="sep">&#8250;</span>'
          + (c.url ? '<a class="crumb" href="' + c.url + '">' + esc(c.label) + '</a>'
                   : '<span class="crumb">' + esc(c.label) + '</span>');
      });
      html += '</span>';
    }
    html += '<span class="sep">&#8250;</span><h1 class="crumb-current" aria-current="page">' + esc(lastName) + '</h1>';
    html += '</nav>';
    return html;
  }

  /* ------------------------------------------------------------------ login */
  var EYE_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.38 6.38A13.16 13.16 0 0 0 2 12s3 7 10 7a11.48 11.48 0 0 0 3.39-.5"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';

  function loginScreen(err) {
    /* The login screen has no sidebar. Keeping nav-hide set hides the mobile
       drawer overlay; without it the overlay covers the form (z-index 55) and
       swallows taps on "Sign In As Admin" on phones. mountShell() re-applies
       the correct state once the app shell is shown. */
    document.body.classList.add('nav-hide');
    root.className = '';
    document.title = 'CSAP-COC · Admin Panel — Sign In';
    el('<div class="auth-screen">'
      + '<div class="auth-bg" aria-hidden="true"><img src="../assets/images/admin-login-bg.webp" alt="" />'
      + '<span class="auth-bg-veil"></span></div>'
      + '<div class="auth-shell">'
      + '<section class="auth-hero">'
      + '<div class="auth-eyebrow">CSAP-COC &middot; EST. 2019</div>'
      + '<h1 class="auth-title"><span class="auth-title-top">City Scholars&rsquo;</span>'
      + '<span class="auth-title-bottom">Association</span></h1>'
      + '<span class="auth-deco" aria-hidden="true"></span>'
      + '<p class="auth-tagline">&ldquo;To Serve and Guide the Oro Scholars in PHINMA COC.&rdquo;</p>'
      + '</section>'
      + '<section class="auth-panel">'
      + '<form class="auth-card" id="loginForm" autocomplete="on">'
      + '<span class="auth-card-tab" aria-hidden="true"></span>'
      + '<div class="auth-card-inner">'
      + '<div class="auth-card-head"><span class="auth-card-logo">'
      + '<img src="../assets/images/logo-128.png" alt="CSAP-COC logo" />'
      + '</span><h2>Admin Portal</h2></div>'
      + '<div class="auth-rule"></div>'
      + '<div class="auth-form">'
      + '<div class="auth-field"><label for="u">Email Address</label>'
      + '<input class="auth-input" id="u" name="username" type="text" autocomplete="username" placeholder="scholar.name@phinma.coc.edu.ph" required /></div>'
      + '<div class="auth-field"><label for="p">Password</label>'
      + '<div class="auth-pass"><input class="auth-input" id="p" name="password" type="password" autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" required />'
      + '<button type="button" class="auth-eye" id="togglePass" aria-label="Show password" aria-pressed="false">' + EYE_OPEN + '</button></div></div>'
      + '<button class="auth-submit" type="submit">Sign In As Admin</button>'
      + '<div class="auth-verifying" id="loginVerify" hidden><span class="auth-dot"></span><p>Verifying credentials &middot; Admin only</p></div>'
      + '<p class="auth-error" id="loginError"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p>'
      + '</div>'
      + '<div class="auth-foot">Only authorized personnel &middot; PHINMA Security</div>'
      + '</div>'
      + '</form>'
      + '</section>'
      + '</div></div>');

    var form = document.getElementById('loginForm');
    var pw = document.getElementById('p');
    var eye = document.getElementById('togglePass');
    var submit = form.querySelector('.auth-submit');
    var verify = document.getElementById('loginVerify');
    var error = document.getElementById('loginError');

    function busy(on) {
      submit.disabled = on;
      submit.textContent = on ? 'Checking Access...' : 'Sign In As Admin';
      verify.hidden = !on;
    }
    eye.onclick = function () {
      var show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      eye.innerHTML = show ? EYE_OFF : EYE_OPEN;
      eye.setAttribute('aria-pressed', show ? 'true' : 'false');
      eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    };
    form.onsubmit = function (e) {
      e.preventDefault();
      error.hidden = true; error.textContent = '';
      busy(true);
      api('auth', { a: 'login' }, { method: 'POST', body: {
        username: document.getElementById('u').value, password: pw.value
      }}).then(function (data) {
        state.admin = data.admin; state.csrf = data.csrf;
        if (!window.location.hash) window.location.hash = '#/dashboard';
        route();
        toast('Welcome back', data.admin.name);
      }).catch(function (ex) {
        busy(false);
        error.textContent = ex.message;
        error.hidden = false;
      });
    };
  }

  /* ------------------------------------------------------------------- boot */
  function boot() {
    api('auth', { a: 'me' }).then(function (data) {
      state.csrf = data.csrf || '';
      if (data.admin) { state.admin = data.admin; route(); }
      else { loginScreen(); }
    }).catch(function (e) {
      loginScreen('Cannot reach the API. Is XAMPP (Apache + MySQL) running? ' + e.message);
    });
  }

  window.addEventListener('hashchange', route);
  applySidebarUI();
  window.addEventListener('resize', applySidebarUI);

  /* ======================================================================== */
  /*  VIEWS                                                                    */
  /* ======================================================================== */

  var PAGE_COLLECTIONS = {
    history: ['history_pillars'], leaders: ['leaders'], officers: ['officers'], contact: ['contact_cards'],
    city_scholarship: ['sdp_types', 'faqs'], hk_scholarship: ['hk_features', 'hk_prices'],
    enrollment: ['enrollment_steps'], announcements: ['announcements'], events: ['events'], awards: ['awardees']
  };
  var PAGE_ANCHOR = {
    hero: '#home', about: '#about', history: '#history', leaders: '#lineage', officers: '#officers',
    contact: '#contact', city_scholarship: '#city-scholarship', hk_scholarship: '#hk-scholarship',
    enrollment: '#enrollment', announcements: '#announcements', events: '#events', calendar: '#calendar', awards: '#awards'
  };
  var PAGE_DESC = {
    hero: 'Welcome card, background slides and highlight gallery.',
    about: 'Intro text, Mission and Vision.',
    history: 'The history narrative and its pillars.',
    leaders: 'Past and present presidents.',
    officers: 'Executives, directors, representatives and committees — one roster per school year. Order is auto-assigned on add.',
    contact: 'Contact cards and the Project Amigo banner.',
    city_scholarship: 'City Scholarship copy, SDP types and FAQs.',
    hk_scholarship: 'Hawak-Kamay copy, benefits and price cards.',
    enrollment: 'Walk-in and online enrollment steps.',
    announcements: 'Organizational memorandums and executive orders.',
    events: 'Event cards and story links.',
    calendar: 'Embedded Google Calendar.',
    awards: 'Kinanao awardees through the years.'
  };

  function imgSrc(v) { return !v ? '' : (/^https?:/i.test(v) || v.charAt(0) === '/' ? v : '../' + v); }
  function shortName(p) { return String(p == null ? '' : p).split('/').pop(); }
  function splitLines(v) {
    var a = String(v == null ? '' : v).split(/\r\n|\r|\n/);
    while (a.length && a[a.length - 1].trim() === '') a.pop();
    return a;
  }
  function listRowHtml(item) {
    return '<div class="list-row"><span class="list-dot"></span>'
      + '<input class="input" type="text" data-list-input value="' + esc(item) + '" />'
      + '<button type="button" class="btn btn-ghost btn-icon" data-list-del title="Remove item">' + icon('trash') + '</button>'
      + '</div>';
  }
  function imageRowHtml(path) {
    return '<div class="list-row list-row-img">'
      + '<span class="img-prev img-prev-sm" data-row-prev' + (path ? ' style="background-image:url(\'' + esc(imgSrc(path)) + '\')"' : '')
      + ' role="button" tabindex="0" aria-label="Upload image">' + (path ? '' : icon('image')) + '</span>'
      + '<input class="input" type="text" data-list-input value="' + esc(path) + '" readonly tabindex="-1" />'
      + '<button type="button" class="btn btn-outline btn-icon" data-row-upload title="Upload / replace image">' + icon('upload') + '</button>'
      + '<input type="file" accept="image/*" hidden data-row-file />'
      + '<button type="button" class="btn btn-ghost btn-icon" data-list-del title="Remove image">' + icon('trash') + '</button>'
      + '</div>';
  }

  function renderField(prefix, f, value) {
    var name = prefix + f.key;
    var type = f.type || 'text';
    var full = ['textarea', 'html', 'lines', 'images', 'image'].indexOf(type) >= 0;
    var val = value == null ? '' : value;
    var label = f.label + (f.required ? ' <span class="req">*</span>' : '');
    var ctrl;

    /* Fields flagged `list_only` are managed from the list row (a new record is
       active by default) — they never get a control in the form. */
    if (f.list_only) return '';

    if (type === 'textarea') {
      ctrl = '<textarea class="textarea" id="' + name + '" name="' + name + '" rows="3"' + (f.required ? ' required' : '') + '>' + esc(val) + '</textarea>';
    } else if (type === 'html') {
      ctrl = '<textarea class="textarea" id="' + name + '" name="' + name + '" rows="5"' + (f.required ? ' required' : '') + '>' + esc(val) + '</textarea>';
    } else if (type === 'lines') {
      ctrl = '<div class="list-editor" data-list-editor>'
        + '<input type="hidden" id="' + name + '" name="' + name + '" value="' + esc(val) + '" />'
        + '<div class="list-rows" data-rows>' + splitLines(val).map(listRowHtml).join('') + '</div>'
        + '<button type="button" class="btn btn-accent btn-sm" data-list-add="' + name + '">' + icon('plus') + 'Add item</button>'
        + '</div>';
    } else if (type === 'images') {
      ctrl = '<div class="list-editor" data-list-editor data-list-images>'
        + '<input type="hidden" id="' + name + '" name="' + name + '" value="' + esc(val) + '" />'
        + '<div class="list-rows" data-rows>' + splitLines(val).map(imageRowHtml).join('') + '</div>'
        + '<button type="button" class="btn btn-accent btn-sm" data-list-add="' + name + '">' + icon('plus') + 'Add image</button>'
        + '</div>';
    } else if (type === 'number') {
      ctrl = '<input class="input" id="' + name + '" name="' + name + '" type="number" value="' + esc(val) + '"' + (f.required ? ' required' : '') + ' />';
    } else if (type === 'date') {
      ctrl = '<input class="input" id="' + name + '" name="' + name + '" type="date" value="' + esc(val) + '"' + (f.required ? ' required' : '') + ' />';
    } else if (type === 'checkbox') {
      /* Same shape as every other field: label on top, control underneath, so
         the whole form grid lines up. The state is spelled out, not implied. */
      return '<div class="field field-check"><label>' + label + '</label>'
        + '<label class="check"><input type="checkbox" id="' + name + '" name="' + name + '"'
        + (Number(val) ? ' checked' : '') + ' /> <span>' + (Number(val) ? 'Yes' : 'No') + '</span></label></div>';
    } else if (type === 'select') {
      var opts = (f.options || []).map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(val) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('');
      ctrl = '<select class="select" id="' + name + '" name="' + name + '"' + (f.required ? ' required' : '') + '>' + (f.nullable ? '<option value="">— none —</option>' : '') + opts + '</select>';
    } else if (type === 'color') {
      ctrl = '<span class="color-row"><input type="color" id="' + name + '" name="' + name + '" value="' + esc(val || '#274e13') + '" />'
        + '<input class="input" data-sync="' + name + '" value="' + esc(val) + '" /></span>';
    } else if (type === 'image') {
      ctrl = '<div class="img-field">'
        + '<span class="img-prev" data-prev="' + name + '"' + (val ? ' style="background-image:url(\'' + esc(imgSrc(val)) + '\')"' : '')
        + ' role="button" tabindex="0" aria-label="Upload image">' + (val ? '' : icon('image')) + '</span>'
        + '<div class="img-actions">'
        + '<input type="hidden" id="' + name + '" name="' + name + '" value="' + esc(val) + '" />'
        + '<div class="img-buttons">'
        + '<button type="button" class="btn btn-outline btn-sm" data-upload="' + name + '">' + icon('upload')
        + '<span data-upload-label>' + (val ? 'Replace image' : 'Upload image') + '</span></button>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-clear="' + name + '"' + (val ? '' : ' hidden') + '>Remove</button>'
        + '</div>'
        + '<span class="hint" data-file-name>' + (val ? esc(shortName(val)) : 'No image selected') + '</span>'
        + '</div>'
        + '<input type="file" accept="image/*" hidden data-file="' + name + '" />'
        + '</div>';
    } else {
      ctrl = '<input class="input" id="' + name + '" name="' + name + '" value="' + esc(val) + '"' + (f.required ? ' required' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ' />';
    }

    return '<div class="field' + (full ? ' full' : '') + '"><label for="' + name + '">' + label + '</label>'
      + ctrl + (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '') + '</div>';
  }

  function readField(f, formData) {
    var type = f.type || 'text';
    if (type === 'checkbox') return formData.has(f.key) ? 1 : 0;
    var v = formData.get(f.key);
    return v == null ? '' : v;
  }
  function formDataOf(form) { return new FormData(form); }

  /* One payload builder for every form in the panel, so a field can never be
     silently dropped or reset:
       - `list_only` flags keep their stored value on edit and start ACTIVE on
         create (they are toggled from the list row, never typed in the form);
       - checkboxes post 1/0 even when unticked;
       - everything else posts exactly what the control holds. */
  function formPayload(fields, formData, item) {
    var out = {};
    (fields || []).forEach(function (f) {
      var type = f.type || 'text';
      if (f.list_only) {
        var keep = item ? item[f.key] : undefined;
        out[f.key] = (keep === undefined || keep === null || keep === '')
          ? (f.default === undefined ? 1 : f.default)
          : keep;
        return;
      }
      if (type === 'checkbox') { out[f.key] = formData.has(f.key) ? 1 : 0; return; }
      var v = formData.get(f.key);
      out[f.key] = v == null ? '' : v;
    });
    return out;
  }

  /* --------------------------------------------------------- step-by-step forms
     Splits a long form into "pages" with a header button per page. Any page can
     be opened at any time (Previous/Next + clicking a header button), so nobody
     has to scroll through the whole form. All inputs stay in the DOM, so values
     are preserved and everything is submitted together. */
  function stepify(form, opts) {
    opts = opts || {};
    if (!form) return;

    var cards = Array.prototype.slice.call(form.querySelectorAll(':scope > .card'));
    var panes = [];
    var titles = [];

    if (cards.length > 1) {
      // Settings / Profile: one step per card.
      cards.forEach(function (card, i) {
        var tEl = card.querySelector('.fieldset-title');
        titles.push(tEl && tEl.textContent ? tEl.textContent.trim() : 'Step ' + (i + 1));
        card.classList.add('step-pane');
        card.setAttribute('data-step', String(i));
        panes.push(card);
      });
    } else {
      // Single card (page editors, add/edit forms, modals): chunk the fields.
      var grid = form.querySelector('.form-grid') || form;
      var fields = Array.prototype.slice.call(grid.querySelectorAll(':scope > .field'));
      var chunk = opts.chunk || 4;
      if (fields.length < 2 || fields.length <= chunk) return; // small form — no need
      grid.classList.add('step-wrapper');
      for (var i = 0; i < fields.length; i += chunk) {
        var grp = fields.slice(i, i + chunk);
        // Capture the insertion point BEFORE the fields are moved out of the grid.
        var ref = grp[grp.length - 1].nextSibling;
        var pane = document.createElement('div');
        pane.className = 'step-pane';
        pane.setAttribute('data-step', String(panes.length));
        grp.forEach(function (f) { pane.appendChild(f); });
        grid.insertBefore(pane, ref);
        titles.push('Step ' + (panes.length + 1));
        panes.push(pane);
      }
    }

    var n = panes.length;
    if (n < 2) return;

    var head = document.createElement('div');
    head.className = 'step-head';
    head.innerHTML = panes.map(function (_, i) {
      return '<button type="button" class="step-btn" data-step="' + i + '" aria-current="false">'
        + '<span class="step-n">' + (i + 1) + '</span>' + esc(titles[i]) + '</button>';
    }).join('');
    form.insertBefore(head, form.firstChild);

    var nav = document.createElement('div');
    nav.className = 'step-nav';
    nav.innerHTML = '<button type="button" class="btn btn-outline btn-sm" data-prev>' + icon('back') + 'Previous</button>'
      + '<span class="muted t-10 step-count"></span>'
      + '<span class="spacer"></span>'
      + '<button type="button" class="btn btn-primary btn-sm" data-next>Next' + icon('next') + '</button>';
    var actions = form.querySelector('.form-actions');
    if (actions) actions.parentNode.insertBefore(nav, actions);
    else form.appendChild(nav);

    var active = 0;
    var btns = head.querySelectorAll('.step-btn');
    var prevBtn = nav.querySelector('[data-prev]');
    var nextBtn = nav.querySelector('[data-next]');
    var cntEl = nav.querySelector('.step-count');

    function render() {
      panes.forEach(function (p, j) { p.hidden = j !== active; });
      Array.prototype.forEach.call(btns, function (b, j) {
        b.classList.toggle('is-active', j === active);
        b.classList.toggle('is-done', j < active);
        b.setAttribute('aria-current', String(j === active));
      });
      if (prevBtn) prevBtn.hidden = active === 0;
      if (nextBtn) nextBtn.hidden = active === n - 1;
      if (cntEl) cntEl.textContent = (active + 1) + ' of ' + n;
      var headTop = head.getBoundingClientRect().top + (window.scrollY || 0);
      if (headTop > 8) head.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    head.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.step-btn') : null;
      if (b) { active = parseInt(b.getAttribute('data-step'), 10); render(); }
    });
    if (prevBtn) prevBtn.onclick = function () { if (active > 0) { active--; render(); } };
    if (nextBtn) nextBtn.onclick = function () { if (active < n - 1) { active++; render(); } };

    render();
    return { go: function (i) { active = Math.max(0, Math.min(n - 1, i)); render(); }, count: n };
  }

  /* ------------------------------------------- searchable long dropdowns
     Any <select> with many options becomes a type-to-filter combo, so long
     managed lists (Role, Department, …) stay usable. The original <select>
     is kept hidden as the value carrier, so submit/validation paths are
     unchanged; the visible input only ever mirrors a real option label. */
  var COMBO_MIN_OPTIONS = 7;
  var comboSeq = 0;
  /* Drop orphan panels (e.g. a modal closed while its dropdown was open). */
  function watchComboOrphans() {
    if (document.__comboWatched) return;
    document.__comboWatched = true;
    try {
      var obs = new MutationObserver(function () {
        document.querySelectorAll('.combo-list').forEach(function (l) {
          var id = l.getAttribute('data-combo-for');
          if (!id || !document.getElementById(id)) l.remove();
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* no-op */ }
  }
  function comboSelectedLabel(select) {
    var o = select.options[select.selectedIndex];
    return o ? o.text : '';
  }
  /* Size the combo text box to its word (selected label or placeholder). */
  function fitComboInput(st) {
    var len = String(st.input.value || st.input.getAttribute('placeholder') || '').length;
    st.input.size = Math.min(Math.max(len + 3, 10), 42);
  }
  function comboBuild(select) {
    if (!select || select.__combo) return null;
    if (!select.options || select.options.length < COMBO_MIN_OPTIONS) return null;
    select.__combo = true;
    var wrap = document.createElement('div');
    wrap.className = 'combo';
    wrap.id = 'combo' + (++comboSeq);
    select.parentNode.insertBefore(wrap, select);
    select.classList.add('combo-native');
    wrap.appendChild(select);
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'input combo-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('placeholder', 'Type to search…');
    input.setAttribute('aria-label', 'Search options');
    if (select.required) input.required = true;
    input.value = comboSelectedLabel(select);
    var list = document.createElement('div');
    list.className = 'combo-list';
    list.hidden = true;
    list.setAttribute('data-combo-for', wrap.id);
    wrap.appendChild(input);
    /* Panel lives in <body> (fixed) so it overlays modals instead of being
       clipped by their scroll areas. */
    document.body.appendChild(list);
    watchComboOrphans();
    var st = { select: select, input: input, list: list, hi: -1, opened: false };
    select.__comboState = st;
    fitComboInput(st);

    function allOpts() {
      return Array.prototype.map.call(select.options, function (o) {
        return { value: o.value, label: o.text };
      });
    }
    function visibleOpts() {
      return Array.prototype.filter.call(list.querySelectorAll('.combo-opt'), function (el) {
        return el.style.display !== 'none';
      });
    }
    function paint(filter) {
      var q = String(filter == null ? '' : filter).toLowerCase();
      var any = false;
      list.innerHTML = allOpts().map(function (o) {
        var show = !q || o.label.toLowerCase().indexOf(q) >= 0 || String(o.value).toLowerCase().indexOf(q) >= 0;
        if (show) any = true;
        return '<div class="combo-opt' + (String(o.value) === String(select.value) ? ' is-selected' : '') + '"'
          + ' data-val="' + esc(o.value) + '" title="' + esc(o.label) + '"' + (show ? '' : ' style="display:none"') + '>'
          + esc(o.label) + '</div>';
      }).join('');
      if (!any) list.innerHTML = '<div class="combo-empty">No matches</div>';
      st.hi = -1;
    }
    function highlight() {
      var vis = visibleOpts();
      vis.forEach(function (el, i) { el.classList.toggle('is-hot', i === st.hi); });
      if (st.hi >= 0 && vis[st.hi] && vis[st.hi].scrollIntoView) {
        try { vis[st.hi].scrollIntoView({ block: 'nearest' }); } catch (e) {}
      }
    }
    function pick(val) {
      select.value = val;
      input.value = comboSelectedLabel(select);
      fitComboInput(st);
      close();
      try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }
    function open(full) {
      paint(full ? '' : input.value);
      list.hidden = false;
      st.opened = true;
      positionList();
    }
    function close() { list.hidden = true; st.opened = false; st.hi = -1; }
    /* Pin the body-level panel under the input; flip above it when there is
       no room below. */
    function positionList() {
      var r = input.getBoundingClientRect();
      var w = Math.max(r.width, 120);
      list.style.minWidth = w + 'px';
      var left = Math.max(8, Math.min(r.left, window.innerWidth - Math.min(w, 440) - 8));
      list.style.left = left + 'px';
      var h = Math.min(264, list.scrollHeight || 264);
      var top = r.bottom + 4;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - 4 - h);
      list.style.top = top + 'px';
    }
    window.addEventListener('scroll', function () {
      if (st.opened && document.body.contains(input)) positionList();
      else if (st.opened) close();
    }, true);
    window.addEventListener('resize', function () {
      if (st.opened && document.body.contains(input)) positionList();
    });
    function revert() {
      // The text must always mirror a real option (or blank for optional).
      var cur = comboSelectedLabel(select);
      var t = input.value.trim().toLowerCase();
      var match = null;
      allOpts().forEach(function (o) {
        if (o.label.trim().toLowerCase() === t) match = o;
      });
      if (match) { select.value = match.value; input.value = match.label; }
      else if (t === '' && !select.required) { select.value = ''; input.value = ''; }
      else input.value = cur;
      fitComboInput(st);
    }

    input.addEventListener('focus', function () { open(true); });
    input.addEventListener('click', function () { if (list.hidden) open(true); });
    input.addEventListener('input', function () { open(false); });
    input.addEventListener('blur', function () {
      setTimeout(function () { if (document.body.contains(input)) { revert(); close(); } }, 140);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { revert(); close(); if (e.preventDefault) e.preventDefault(); return; }
      if (!st.opened && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { open(true); if (e.preventDefault) e.preventDefault(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        var vis = visibleOpts();
        if (!vis.length) return;
        st.hi = e.key === 'ArrowDown'
          ? Math.min(vis.length - 1, st.hi + 1)
          : Math.max(0, (st.hi < 0 ? vis.length : st.hi) - 1);
        highlight();
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && st.opened) {
        var vis2 = visibleOpts();
        var el = st.hi >= 0 ? vis2[st.hi] : vis2[0];
        if (el) pick(el.getAttribute('data-val'));
        // Enter then submits the form with the picked value.
      }
    });
    list.addEventListener('mousedown', function (e) {
      var opt = e.target && e.target.closest ? e.target.closest('.combo-opt') : null;
      if (opt) { pick(opt.getAttribute('data-val')); if (e.preventDefault) e.preventDefault(); }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target) && !list.contains(e.target)) close();
    });
    return st;
  }
  function syncCombo(select) {
    var st = select && select.__comboState;
    if (!st) return;
    st.input.value = comboSelectedLabel(select);
    fitComboInput(st);
    st.list.hidden = true;
    st.opened = false;
    st.hi = -1;
  }
  function enhanceLongSelects(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('select').forEach(function (s) { comboBuild(s); });
  }

  /* Make every filter cell exactly as wide as its own words — the longest of
     its label and the text the control shows — so the controls line up, no
     label wraps, and short filters stay compact instead of oversize.
     Runs after enhanceLongSelects() so combos are measured by their value. */
  function fitFilterWidths(scope) {
    if (!scope || !scope.querySelectorAll) return;
    var cap = (window.innerWidth || 999) < 720 ? 20 : 42;   // stays on-screen on phones
    scope.querySelectorAll('.filter-grid .fg-item').forEach(function (item) {
      var longest = 0;
      function note(text) {
        longest = Math.max(longest, String(text == null ? '' : text).trim().length);
      }
      var label = item.querySelector('label');
      if (label) note(label.textContent);
      var comboInput = item.querySelector('.combo-input');
      var select = item.querySelector('select');
      var plain = item.querySelector('input:not(.combo-input)');
      var pad = 24;                       // a text box only needs its own padding
      if (comboInput) {
        note(comboInput.value);
        pad = 42;                         // room for the caret
      } else if (select) {
        Array.prototype.forEach.call(select.options, function (o) { note(o.text); });
        pad = 42;                         // room for the dropdown arrow
      } else if (plain) {
        note(plain.value || plain.getAttribute('placeholder'));
      }
      if (!longest) return;
      var ch = Math.min(longest + 1, cap);
      item.style.width = 'calc(' + ch + 'ch + ' + pad + 'px)';
    });
  }

  function attachFieldBehaviours(scope) {
    scope.querySelectorAll('[data-sync]').forEach(function (txt) {
      var color = document.getElementById(txt.getAttribute('data-sync'));
      if (!color) return;
      color.addEventListener('input', function () { txt.value = color.value; });
      txt.addEventListener('input', function () { color.value = txt.value; });
    });

    /* ---- school-year From/To pair: picking From auto-suggests To = From + 1 ---- */
    var yf = scope.querySelector ? scope.querySelector('[name="year_from"]') : null;
    var yt = scope.querySelector ? scope.querySelector('[name="year_to"]') : null;
    if (yf && yt && !scope.__yearPairBound) {
      scope.__yearPairBound = true;
      var suggestTo = function () {
        var f = parseInt(yf.value, 10);
        var t = parseInt(yt.value, 10);
        if (!isNaN(f) && (isNaN(t) || t <= f)) { yt.value = String(f + 1); syncCombo(yt); }
      };
      yf.addEventListener('input', suggestTo);
      yf.addEventListener('change', suggestTo);
    }

    /* ---- image fields: upload only (no path / link typing) ---- */
    scope.querySelectorAll('.img-field').forEach(function (wrap) {
      var file = wrap.querySelector('[data-file]');
      if (!file) return;
      var holder = wrap.querySelector('input[type="hidden"]');
      var prev = wrap.querySelector('[data-prev]');
      var btn = wrap.querySelector('[data-upload]');
      var labelEl = wrap.querySelector('[data-upload-label]');
      var clearBtn = wrap.querySelector('[data-clear]');
      var nameEl = wrap.querySelector('[data-file-name]');

      function setState(path) {
        path = path || '';
        holder.value = path;
        prev.innerHTML = '';
        prev.style.backgroundImage = '';
        if (path) {
          prev.style.backgroundImage = 'url("' + imgSrc(path) + '")';
          if (labelEl) labelEl.textContent = 'Replace image';
          if (clearBtn) clearBtn.hidden = false;
          if (nameEl) nameEl.textContent = shortName(path);
        } else {
          prev.innerHTML = icon('image');
          if (labelEl) labelEl.textContent = 'Upload image';
          if (clearBtn) clearBtn.hidden = true;
          if (nameEl) nameEl.textContent = 'No image selected';
        }
        // Same reason as the list editor above: the value changed from script.
        try { holder.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* no-op */ }
      }

      var openPicker = function () { file.click(); };
      btn.onclick = openPicker;
      prev.onclick = openPicker;
      prev.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } };
      if (clearBtn) clearBtn.onclick = function () { file.value = ''; setState(''); };

      file.onchange = function () {
        if (!file.files[0]) return;
        var fd = new FormData();
        fd.append('file', file.files[0]);
        fd.append('_csrf', state.csrf);
        var url = new URL(API, window.location.href);
        url.searchParams.set('r', 'upload');
        btn.disabled = true;
        if (labelEl) labelEl.textContent = 'Uploading…';
        if (nameEl) nameEl.textContent = file.files[0].name;
        fetch(url.toString(), { method: 'POST', credentials: 'same-origin', body: fd, headers: { 'X-CSRF-Token': state.csrf } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            btn.disabled = false;
            if (!j.success) { toast('Upload failed', j.error || '', true); setState(holder.value); return; }
            setState(j.data.path);
            toast('Image uploaded', shortName(j.data.path));
          })
          .catch(function () { btn.disabled = false; setState(holder.value); toast('Upload failed', '', true); });
      };

      setState(holder.value);
    });

    /* ---- multi-value fields become real lists (add / remove rows) ---- */
    function syncEditor(editor) {
      var rows = editor.querySelector('[data-rows]');
      var holder = editor.querySelector('input[type="hidden"]');
      var vals = [];
      rows.querySelectorAll('[data-list-input]').forEach(function (i) {
        if (i.value.trim() !== '') vals.push(i.value.trim());
      });
      holder.value = vals.join('\n');
      // The hidden input is set from script, so no `input` event fires on its
      // own — announce it so the live preview re-renders the matching section.
      try { holder.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* no-op */ }
    }
    scope.querySelectorAll('[data-list-editor]').forEach(function (editor) {
      var rows = editor.querySelector('[data-rows]');
      var isImages = editor.hasAttribute('data-list-images');

      function bindRow(row) {
        var input = row.querySelector('[data-list-input]');
        input.addEventListener('input', function () { syncEditor(editor); });
        var del = row.querySelector('[data-list-del]');
        if (del) del.onclick = function () { row.remove(); syncEditor(editor); };

        var upBtn = row.querySelector('[data-row-upload]');
        if (upBtn) {
          var rfile = row.querySelector('[data-row-file]');
          var rprev = row.querySelector('[data-row-prev]');
          var openRow = function () { rfile.click(); };
          upBtn.onclick = openRow;
          if (rprev) {
            rprev.onclick = openRow;
            rprev.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(); } };
          }
          rfile.onchange = function () {
            if (!rfile.files[0]) return;
            var fd = new FormData();
            fd.append('file', rfile.files[0]);
            fd.append('_csrf', state.csrf);
            var url = new URL(API, window.location.href);
            url.searchParams.set('r', 'upload');
            upBtn.disabled = true;
            fetch(url.toString(), { method: 'POST', credentials: 'same-origin', body: fd, headers: { 'X-CSRF-Token': state.csrf } })
              .then(function (r) { return r.json(); })
              .then(function (j) {
                upBtn.disabled = false;
                if (!j.success) { toast('Upload failed', j.error || '', true); return; }
                input.value = j.data.path;
                if (rprev) { rprev.innerHTML = ''; rprev.style.backgroundImage = 'url("' + imgSrc(j.data.path) + '")'; }
                syncEditor(editor);
                toast('Image uploaded', shortName(j.data.path));
              })
              .catch(function () { upBtn.disabled = false; toast('Upload failed', '', true); });
          };
        }
      }

      rows.querySelectorAll('.list-row').forEach(bindRow);
      var addBtn = editor.querySelector('[data-list-add]');
      if (addBtn) addBtn.onclick = function () {
        var tmp = document.createElement('div');
        tmp.innerHTML = (isImages ? imageRowHtml('') : listRowHtml(''));
        var row = tmp.firstChild;
        rows.appendChild(row);
        bindRow(row);
        if (isImages) {
          var f = row.querySelector('[data-row-file]');
          if (f) f.click();
        } else {
          row.querySelector('[data-list-input]').focus();
        }
        syncEditor(editor);
      };
      syncEditor(editor);
    });

    // Flush list editors into their hidden inputs just before the form submits.
    var form = scope.closest ? scope.closest('form') : null;
    if (form && !form.__csapListBound) {
      form.__csapListBound = true;
      form.addEventListener('submit', function () {
        form.querySelectorAll('[data-list-editor]').forEach(syncEditor);
      });
    }

    /* ---- long selects become searchable combos ---- */
    enhanceLongSelects(scope);
  }

  /* ------------------------------------------------------------- dashboard */
  function viewDashboard() {
    api('dashboard').then(function (d) {
      var stats = d.stats.filter(function (s) { return s.count >= 0; });
      var html = '<div class="page-head"><div><h2>Welcome, ' + esc((d.admin.name || '').split(' ')[0]) + '</h2>'
        + '</div><div class="spacer"></div>'
        + '<div class="qa">'
        + '<button class="btn btn-primary btn-sm" id="qaBtn" aria-haspopup="true" aria-expanded="false">' + icon('layers') + 'Quick actions</button>'
        + '<div class="qa-drop" id="qaDrop">' + quickActionsHtml() + '</div>'
        + '</div>'
        + '<a class="btn btn-outline btn-sm" href="../index.html" target="_blank">' + icon('eye') + 'View site</a></div>';

      // Clickable, colourful stat tiles — square, sized to their content, hover effect.
      html += '<div class="grid g-auto dash-stats">';
      var themes = ['st-1', 'st-2', 'st-3', 'st-4', 'st-5', 'st-6'];
      stats.forEach(function (s, i) {
        var statUrl = s.key === 'students' ? '#/students' : '#/list/' + esc(s.key);
        html += '<a class="stat ' + themes[i % themes.length] + '" href="' + statUrl + '" title="Manage ' + esc(s.label) + '">'
          + '<span class="label">' + esc(s.label) + '</span><span class="n">' + s.count + '</span>'
          + '<span class="hint">' + (s.count === 1 ? 'record' : 'records') + '</span></a>';
      });
      html += '</div>';

      // Activity-log widget — "Expand" opens the floating, filterable panel.
      html += '<div class="card" style="margin-top:10px"><div class="card-head"><h3>Activity logs</h3>'
        + '<span class="chip">' + (d.recent_activity || []).length + '</span><span class="spacer"></span>'
        + '<button class="btn btn-outline btn-sm" id="actExpand">' + icon('layers') + 'Expand</button></div>'
        + '<div class="act-list">';
      (d.recent_activity || []).forEach(function (r) { html += activityRow(r); });
      if (!(d.recent_activity || []).length) html += '<div class="empty">No activity recorded yet.</div>';
      html += '</div></div>';

      document.getElementById('content').innerHTML = html;
      var exp = document.getElementById('actExpand');
      if (exp) exp.onclick = openActivityModal;
      var qaBtn = document.getElementById('qaBtn');
      var qaDrop = document.getElementById('qaDrop');
      if (qaBtn && qaDrop) {
        qaBtn.onclick = function (e) {
          e.stopPropagation();
          var on = qaDrop.classList.toggle('open');
          qaBtn.setAttribute('aria-expanded', String(on));
        };
        document.addEventListener('click', function () {
          qaDrop.classList.remove('open');
          qaBtn.setAttribute('aria-expanded', 'false');
        });
      }
    }).catch(function (e) { errorBox(e); });
  }
  function quickTile(url, ic, label) {
    return '<a class="tile" href="' + url + '"><span class="t-ico">' + icon(ic) + '</span><span><b>' + esc(label) + '</b><span>Manage</span></span></a>';
  }
  function quickActionsHtml() {
    return '<span class="qa-title">Quick actions</span>'
      + '<div class="grid qa-grid">'
      + quickTile('#/page/hero', 'home', 'Edit hero') + quickTile('#/page/announcements', 'bell', 'Announcements')
      + quickTile('#/page/officers', 'users', 'Officers') + quickTile('#/page/awards', 'award', 'Awards')
      + quickTile('#/settings', 'settings', 'Site settings') + quickTile('#/list/nav_items', 'list', 'Navigation')
      + '</div>';
  }

  var ACT_ICON = { create: 'plus', update: 'save', delete: 'trash', archive: 'archive', restore: 'restore', purge: 'trash', move: 'next', save: 'save', upload: 'upload', login: 'user', logout: 'logout' };
  var ACT_CHIP = { create: '', update: 'yellow', delete: 'danger', archive: 'yellow', restore: '', purge: 'danger', move: 'yellow', save: '', upload: '', login: '', logout: '' };
  function activityRow(r) {
    var ic = ACT_ICON[r.action] || 'list';
    var chipCls = ACT_CHIP[r.action] || '';
    var time = String(r.created_at || '').replace('T', ' ').slice(0, 16);
    var title = r.detail || r.resource || '';
    return '<div class="act-row">'
      + '<span class="act-ico">' + icon(ic) + '</span>'
      + '<span class="act-main"><span class="act-title"><b>' + esc(title) + '</b> <span class="chip ' + chipCls + '">' + esc(r.action) + '</span></span>'
      + '<span class="act-sub">' + esc(r.admin_name || 'System') + ' &middot; ' + esc(r.resource) + '</span></span>'
      + '<span class="act-time">' + esc(time) + '</span>'
      + '</div>';
  }

  function openActivityModal() {
    var f = floating(
      '<div class="fm-head"><h3>Activity Logs</h3><span class="chip" id="actTotal">0</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-icon fm-close" title="Close">&times;</button></div>'
      + '<form class="fm-filter" id="actFilter">'
      + '<input class="input" name="q" placeholder="Search logs…" aria-label="Search logs" />'
      + '<select class="select" name="action"><option value="all">All actions</option>'
      + '<option value="create">Created</option><option value="update">Updated</option><option value="delete">Deleted</option>'
      + '<option value="save">Saved content</option><option value="upload">Uploads</option>'
      + '<option value="move">Moved officers</option>'
      + '<option value="login">Sign-ins</option><option value="logout">Sign-outs</option></select>'
      + '<select class="select" name="resource"><option value="all">All resources</option></select>'
      + '<select class="select" name="days"><option value="0">Any time</option><option value="1">Last 24h</option>'
      + '<option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>'
      + '<button class="btn btn-primary btn-sm" type="submit">' + icon('search') + 'Filter</button>'
      + '</form>'
      + '<div class="fm-body" id="actBody"></div>'
      + '<div class="fm-foot"><span class="muted t-10" id="actInfo"></span><span class="spacer"></span>'
      + '<button type="button" class="btn btn-outline btn-sm" id="actMore">Load more</button></div>'
    , true);
    var resSel = f.back.querySelector('[name="resource"]');
    var body = f.back.querySelector('#actBody');
    var more = f.back.querySelector('#actMore');
    var state = { offset: 0 };
    var loadSeq = 0;

    function hasOption(sel, val) {
      for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === val) return true; }
      return false;
    }
    function load(reset) {
      var mine = ++loadSeq;
      if (reset) { state.offset = 0; body.innerHTML = '<div class="skeleton" style="height:140px"></div>'; }
      var params = { r: 'activity', limit: 20, offset: state.offset };
      ['q', 'action', 'resource', 'days'].forEach(function (n) {
        var el = f.back.querySelector('[name="' + n + '"]');
        var v = el ? el.value : '';
        if (v && v !== 'all' && v !== '0') params[n] = v;
      });
      api('activity', params).then(function (d) {
        if (mine !== loadSeq) return;   // a newer filter already took over
        f.back.querySelector('#actTotal').textContent = d.total;
        f.back.querySelector('#actInfo').textContent = 'Showing ' + d.items.length + ' of ' + d.total;
        if (reset) body.innerHTML = '';
        if (!d.items.length) body.innerHTML = '<div class="empty">No activity matches your filters.</div>';
        d.items.forEach(function (r) { body.insertAdjacentHTML('beforeend', activityRow(r)); });
        more.hidden = (Number(d.offset) + d.items.length) >= Number(d.total) || d.items.length === 0;
        state.offset = Number(d.offset) + d.items.length;
        (d.resources || []).forEach(function (res) {
          if (!hasOption(resSel, res)) { resSel.appendChild(new Option(res, res)); }
        });
      }).catch(function (e) { toast('Failed to load activity', e.message, true); });
    }

    f.back.querySelectorAll('.fm-close').forEach(function (b) { b.onclick = f.close; });
    var actForm = f.back.querySelector('#actFilter');
    actForm.onsubmit = function (e) { e.preventDefault(); load(true); };
    // Live filters — dropdowns apply at once, the search box as you type.
    actForm.querySelectorAll('select').forEach(function (s) { s.onchange = function () { load(true); }; });
    var actQ = actForm.querySelector('[name="q"]');
    if (actQ) actQ.oninput = debounce(function () { load(true); }, 350);
    more.onclick = function () { load(false); };
    load(true);
  }

  /* ------------------------------------------------------------ content page */
  function viewPage(key) {
    api('blocks', { page: key }).then(function (d) {
      var cols = PAGE_COLLECTIONS[key] || [];
      return Promise.all(cols.map(function (c) {
        return api('collection', { name: c }).then(function (r) { return { name: c, data: r }; })
          .catch(function () { return { name: c, data: { meta: null, items: [] } }; });
      })).then(function (lists) { renderPageView(key, d, lists); });
    }).catch(function (e) { errorBox(e); });
  }

  function renderPageView(key, d, lists) {
    var isOfficers = key === 'officers';
    var html = '<div class="page-head"><div><h2>' + esc(d.label) + '</h2></div>'
      + '<div class="spacer"></div>'
      + (isOfficers ? officerOptionsHtml() : '')
      + (PAGE_ANCHOR[key] ? '<a class="btn btn-outline btn-sm" href="../index.html' + PAGE_ANCHOR[key] + '" target="_blank">' + icon('eye') + 'View section</a>' : '')
      + (PREVIEW_SECTIONS[key] ? '<button type="button" class="btn btn-accent btn-sm" id="pvOpen" aria-pressed="false" title="Open a floating live preview of the public site">' + icon('eye') + 'Live preview</button>' : '')
      + '</div>';

    html += '<form id="blockForm"><div class="card"><div class="card-head"><h3>Page content</h3>'
      + '<span class="chip">' + d.blocks.length + ' editable fields</span></div>'
      + '<p class="card-sub">Changes are published to the public website immediately.</p>'
      + '<div class="form-grid">';
    d.blocks.forEach(function (b) { html += renderField('b_', b, b.value); });
    html += '</div><div class="form-actions"><span class="muted t-10">Editing <b>' + esc(d.label) + '</b></span>'
      + '<span class="spacer"></span><button class="btn btn-primary btn-sm" type="submit">' + icon('save') + 'Save content</button></div>'
      + '</div></form>';

    lists.forEach(function (l) {
      if (!l.data.meta) return;
      html += collectionCard(l.name, l.data.meta, l.data.items, true);
    });

    document.getElementById('content').innerHTML = html;

    var form = document.getElementById('blockForm');
    attachFieldBehaviours(form);
    stepify(form);
    if (PREVIEW_SECTIONS[key]) {
      wirePreviewForm(form, previewCtxForPage(key, d.label));
      previewSyncButton();
      var pvBtn = document.getElementById('pvOpen');
      if (pvBtn) pvBtn.onclick = function () { togglePreview(); };
    }
    if (key === 'officers') wireOfficerOptions(document.getElementById('content'));
    lists.forEach(function (l) {
      if (!l.data.meta) return;
      var card = document.querySelector('[data-collection="' + l.name + '"]');
      if (card) attachTableBehaviours(card, l.data.meta, l.data.items, function () { viewPage(key); });
      if (card && l.name === 'officers') wireOfficerMove(card, l.data.meta, l.data.items, function () { viewPage(key); });
    });
    form.onsubmit = function (e) {
      e.preventDefault();
      var fd = formDataOf(form);
      var payload = {};
      d.blocks.forEach(function (b) { payload[b.key] = fd.get('b_' + b.key); });
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      api('blocks', { page: key }, { method: 'POST', body: { blocks: payload } })
        .then(function () { toast('Saved', d.label + ' updated.'); })
        .catch(function (err) { toast('Save failed', err.message, true); })
        .then(function () { btn.disabled = false; });
    };
  }

  /* ---------------------------------------------------------------- calendar
     A REAL month calendar instead of a plain list. Browse by month, click a day
     to see / edit / archive everything on it, drop a new entry straight onto
     that date, or pull the dated records that already live elsewhere on the
     site ("Events & Stories", "Announcements") into the calendar.

     Writes go through the same generic collection endpoint every other list
     uses — so archive storage, audit logging and the live preview all behave
     exactly as they do elsewhere in the panel. */
  var CAL_ADMIN_KINDS = {
    holiday: 'Public holiday', school_event: 'School event', csap_event: 'CSAP activity',
    deadline: 'Deadline', other: 'Other'
  };
  var CAL_ADMIN_COLOR = {
    holiday: '#b23a2e', school_event: '#c99a00', csap_event: '#3f7d1f',
    deadline: '#1c6b86', other: '#6d7a66'
  };
  var CAL_ADMIN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var calAdmin = { y: 0, m: 0, meta: null, items: [], byDate: {}, blocks: [] };

  function calKindColorAdmin(k) { return CAL_ADMIN_COLOR[k] || CAL_ADMIN_COLOR.other; }
  function calKindLabelAdmin(k) { return CAL_ADMIN_KINDS[k] || k || 'Other'; }
  function calAdmISO(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function calAdmToday() {
    var d = new Date();
    return calAdmISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  function calAdmAddDays(iso, n) {
    var p = String(iso || '').split('-');
    var dt = new Date(+p[0] || 1970, (+p[1] || 1) - 1, (+p[2] || 1) + n);
    return calAdmISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  /* Bucket every entry under each day it spans (date_start … date_end). */
  function calAdmIndex(items) {
    var byDate = {};
    (items || []).forEach(function (it) {
      var start = String(it.date_start || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
      var end = String(it.date_end || start).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) end = start;
      var cur = start, guard = 0;
      while (cur <= end && guard++ < 400) { (byDate[cur] = byDate[cur] || []).push(it); cur = calAdmAddDays(cur, 1); }
    });
    return byDate;
  }

  /* The month grid: six stable rows, today ringed, highlighted days in yellow. */
  function calAdmDraw() {
    var grid = document.getElementById('calAdmGrid');
    if (!grid) return;
    var today = calAdmToday();
    var label = document.getElementById('calAdmMonth');
    if (label) label.innerHTML = '<strong>' + CAL_ADMIN_MONTHS[calAdmin.m] + '</strong> <span>' + calAdmin.y + '</span>';
    var lead = new Date(calAdmin.y, calAdmin.m, 1).getDay();
    var html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (d) {
      return '<div class="cal-adm-dow">' + d + '</div>';
    }).join('');
    for (var i = 0; i < 42; i++) {
      var cell = new Date(calAdmin.y, calAdmin.m, 1 - lead + i);
      var iso = calAdmISO(cell.getFullYear(), cell.getMonth() + 1, cell.getDate());
      var outside = cell.getMonth() !== calAdmin.m;
      var items = calAdmin.byDate[iso] || [];
      var hl = items.some(function (it) { return Number(it.is_highlight); });
      var cls = ['cal-adm-cell'];
      if (outside) cls.push('is-outside');
      if (iso === today) cls.push('is-today');
      if (hl) cls.push('is-highlight');
      html += '<button type="button" class="' + cls.join(' ') + '" data-adm-day="' + iso + '"'
        + ' title="' + esc(iso + (items.length ? ' — ' + items.length + ' entr' + (items.length === 1 ? 'y' : 'ies') : '')) + '">'
        + '<span class="cal-adm-num">' + cell.getDate() + '</span>'
        + (items.length
          ? '<span class="cal-adm-dots">' + items.slice(0, 6).map(function (it) {
              return '<i class="cal-adm-dot' + (Number(it.is_highlight) ? ' hl' : '') + '" style="background:' + calKindColorAdmin(it.kind) + '"></i>';
            }).join('') + (items.length > 6 ? '<i class="cal-adm-dot" style="background:#c9c9c9"></i>' : '') + '</span>'
          : '')
        + '</button>';
    }
    grid.innerHTML = html;
    var cnt = document.getElementById('calAdmCount');
    if (cnt) cnt.textContent = calAdmin.items.length + ' entr' + (calAdmin.items.length === 1 ? 'y' : 'ies');
  }
  /* CAL_ADMIN_MODALS */

  /* One entry's create / edit modal. `dateISO` pre-fills a brand-new entry. */
  function calEntryModal(item, dateISO) {
    var meta = calAdmin.meta;
    var fields = meta.fields || [];
    var data = {};
    fields.forEach(function (f) { data[f.key] = item ? item[f.key] : defaultFieldValue(f, meta.key); });
    if (!item && dateISO) { data.date_start = dateISO; data.date_end = ''; }
    var f = floating(
      '<div class="fm-head"><h3>' + (item ? 'Edit &middot; ' + esc(item.title || '#' + item.id) : 'Create &middot; ' + esc(meta.label)) + '</h3>'
      + '<span class="chip">' + esc(meta.label) + '</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-icon fm-close" title="Close">&times;</button></div>'
      + '<form id="calEntryForm" class="fm-body"><div class="form-grid">'
      + fields.map(function (fi) { return renderField('', fi, data[fi.key]); }).join('')
      + '</div></form>'
      + '<div class="fm-foot">'
      + (item ? '<button type="button" class="btn btn-danger btn-sm" data-cal-delete>' + icon('trash') + 'Delete</button>' : '')
      + '<span class="muted t-10">' + (item ? 'Editing entry #' + item.id : 'Publishes to the public calendar straight away') + '</span>'
      + '<span class="spacer"></span>'
      + '<button type="button" class="btn btn-outline btn-sm fm-close">Cancel</button>'
      + '<button type="submit" form="calEntryForm" class="btn ' + (item ? 'btn-primary' : 'btn-accent') + ' btn-sm">' + icon('save') + (item ? 'Save changes' : 'Create') + '</button>'
      + '</div>'
    );
    var form = f.back.querySelector('#calEntryForm');
    attachFieldBehaviours(form);
    stepify(form);
    f.back.querySelectorAll('.fm-close').forEach(function (b) { b.onclick = f.close; });
    var del = f.back.querySelector('[data-cal-delete]');
    if (del) {
      del.onclick = function () {
        confirmDialog('Delete record?', 'This will permanently remove the entry.', 'Delete').then(function (ok) {
          if (!ok) return;
          api('collection', { name: 'calendar_entries', id: item.id }, { method: 'DELETE' })
            .then(function () { toast('Archived', 'Find it in Archive storage.'); f.close(); calAdminReload(); })
            .catch(function (e) { toast('Delete failed', e.message, true); });
        });
      };
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      var fd = formDataOf(form);
      var payload = formPayload(fields, fd, item);
      if (!String(payload.date_start || '').slice(0, 10)) { toast('Start date needed', 'Pick the day this entry begins.', true); return; }
      if (payload.date_end && payload.date_end < payload.date_start) payload.date_end = payload.date_start;
      var btn = f.back.querySelector('[type="submit"]');
      btn.disabled = true;
      api('collection', item ? { name: 'calendar_entries', id: item.id } : { name: 'calendar_entries' },
          { method: item ? 'PUT' : 'POST', body: payload })
        .then(function () {
          toast(item ? 'Saved' : 'Created', item ? meta.label : 'The public calendar now shows it.');
          f.close();
          calAdminReload();
        })
        .catch(function (err) { if (!err || err.message !== '__silent__') toast('Save failed', err && err.message, true); btn.disabled = false; });
    };
  }
  /* CAL_ADMIN_DAY */

  /* The floating day panel: everything on that date + add / edit / archive. */
  function calDayModal(iso) {
    var items = (calAdmin.byDate[iso] || []).slice();
    var p = String(iso).split('-');
    var nice = CAL_ADMIN_MONTHS[(+p[1] || 1) - 1] + ' ' + (+p[2] || 1) + ', ' + (+p[0]);
    var rows = items.length ? items.map(function (it) {
      var meta = [];
      var t = it.time_from && it.time_to ? (it.time_from + ' – ' + it.time_to) : (it.time_from || it.time_to);
      if (!Number(it.all_day) && t) meta.push(esc(t));
      if (it.date_start !== it.date_end) meta.push(esc(String(it.date_start) + ' → ' + String(it.date_end)));
      if (it.location) meta.push(esc(it.location));
      return '<div class="cal-adm-item' + (Number(it.is_highlight) ? ' hl' : '') + '" style="--kind:' + calKindColorAdmin(it.kind) + '">'
        + '<div class="cal-adm-item-head"><span class="cal-adm-kind">' + esc(calKindLabelAdmin(it.kind)) + '</span>'
        + '<strong>' + esc(it.title) + '</strong><span class="spacer"></span>'
        + '<button type="button" class="btn btn-ghost btn-icon" data-adm-edit="' + it.id + '" title="Edit">' + icon('save') + '</button>'
        + '<button type="button" class="btn btn-ghost btn-icon" data-adm-archive="' + it.id + '" title="Archive">' + icon('archive') + '</button>'
        + '</div>'
        + (meta.length ? '<div class="cal-adm-item-meta">' + meta.join('<span>&middot;</span>') + '</div>' : '')
        + (it.description ? '<p class="cal-adm-item-desc">' + esc(it.description) + '</p>' : '')
        + '</div>';
    }).join('') : '<p class="muted t-10">Nothing on this day yet.</p>';
    var f = floating(
      '<div class="fm-head"><h3>' + esc(nice) + '</h3><span class="chip">' + items.length + ' item(s)</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-icon fm-close" title="Close">&times;</button></div>'
      + '<div class="fm-body"><div class="cal-adm-list">' + rows + '</div></div>'
      + '<div class="fm-foot"><span class="muted t-10">Full details</span><span class="spacer"></span>'
      + '<button type="button" class="btn btn-outline btn-sm fm-close">Close</button>'
      + '<button type="button" class="btn btn-accent btn-sm" data-adm-add>' + icon('plus') + 'Add on this day</button></div>'
    );
    f.back.querySelectorAll('.fm-close').forEach(function (b) { b.onclick = f.close; });
    f.back.querySelector('[data-adm-add]').onclick = function () { f.close(); calEntryModal(null, iso); };
    f.back.querySelectorAll('[data-adm-edit]').forEach(function (b) {
      b.onclick = function () {
        var id = +b.getAttribute('data-adm-edit');
        var item = calAdmin.items.filter(function (x) { return +x.id === id; })[0];
        f.close();
        calEntryModal(item);
      };
    });
    f.back.querySelectorAll('[data-adm-archive]').forEach(function (b) {
      b.onclick = function () {
        var id = +b.getAttribute('data-adm-archive');
        confirmDialog('Archive record?', 'It moves to Archive storage and can be restored any time.', 'Archive').then(function (ok) {
          if (!ok) return;
          api('collection', { name: 'calendar_entries', id: id }, { method: 'DELETE' })
            .then(function () { toast('Archived', 'Find it in Archive storage.'); f.close(); calAdminReload(); })
            .catch(function (e) { toast('Archive failed', e.message, true); });
        });
      };
    });
  }
  /* CAL_ADMIN_SOURCES */

  /* "Add all existing / choose sources": the dated records already on the site.
     Events & Stories and Announcements are offered; anything already imported
     (same source_ref) is skipped by the server, so this is safe to repeat. */
  function calSourcesModal() {
    var f = floating(
      '<div class="fm-head"><h3>Add from existing content</h3><span class="chip">Sources</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-icon fm-close" title="Close">&times;</button></div>'
      + '<div class="fm-body" id="calSrcBody"><p class="muted t-10">Loading&hellip;</p></div>'
      + '<div class="fm-foot"><span class="muted t-10" id="calSrcInfo">Already-imported records are skipped.</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-outline btn-sm fm-close">Close</button>'
      + '<button type="button" class="btn btn-accent btn-sm" id="calSrcAll">' + icon('plus') + 'Add all existing</button></div>'
    , true);
    f.back.querySelectorAll('.fm-close').forEach(function (b) { b.onclick = f.close; });
    var allBtn = f.back.querySelector('#calSrcAll');
    var info = f.back.querySelector('#calSrcInfo');
    allBtn.onclick = function () {
      allBtn.disabled = true;
      api('calendar', { a: 'import' }, { method: 'POST', body: { all: 1 } })
        .then(function (r) {
          toast('Added', (r.added || 0) + ' imported' + (r.skipped ? ', ' + r.skipped + ' already there' : '') + '.');
          f.close(); calAdminReload();
        })
        .catch(function (e) { toast('Import failed', e.message, true); allBtn.disabled = false; });
    };
    api('calendar', { a: 'sources' }).then(function (d) {
      var body = f.back.querySelector('#calSrcBody');
      if (!body) return;
      var items = d.items || [];
      if (!items.length) {
        body.innerHTML = '<p class="empty">Nothing dated to pull in yet &mdash; add a publication date to an event or announcement first.</p>';
        allBtn.disabled = true;
        return;
      }
      var groups = {};
      items.forEach(function (it) {
        var g = it.source === 'events' ? 'Events &amp; Stories' : 'Announcements';
        (groups[g] = groups[g] || []).push(it);
      });
      body.innerHTML = Object.keys(groups).map(function (g) {
        return '<div class="fieldset-title">' + g + '</div><div class="cal-src-list">'
          + groups[g].map(function (it) {
            return '<label class="check cal-src"><input type="checkbox" name="src" value="' + esc(it.source_ref) + '"'
              + " data-src='" + esc(JSON.stringify(it)) + "' />"
              + '<span><b>' + esc(it.title) + '</b> <span class="muted t-10">' + esc(it.date)
              + ' &middot; ' + esc(calKindLabelAdmin(it.kind)) + '</span></span></label>';
          }).join('') + '</div>';
      }).join('')
        + '<div class="form-actions"><span class="muted t-10">Pick individual records&hellip;</span>'
        + '<span class="spacer"></span>'
        + '<button type="button" class="btn btn-primary btn-sm" id="calSrcSel">' + icon('plus') + 'Add selected</button></div>';
      var selBtn = body.querySelector('#calSrcSel');
      selBtn.onclick = function () {
        var rows = [];
        body.querySelectorAll('input[name="src"]:checked').forEach(function (cb) {
          try { rows.push(JSON.parse(cb.getAttribute('data-src'))); } catch (e) {}
        });
        if (!rows.length) { toast('Nothing selected', 'Tick at least one record, or use “Add all existing”.', true); return; }
        selBtn.disabled = true;
        api('calendar', { a: 'import' }, { method: 'POST', body: { rows: rows } })
          .then(function (r) {
            toast('Added', (r.added || 0) + ' imported' + (r.skipped ? ', ' + r.skipped + ' skipped' : '') + '.');
            f.close(); calAdminReload();
          })
          .catch(function (e) { toast('Import failed', e.message, true); selBtn.disabled = false; });
      };
      if (info) info.textContent = items.length + ' dated record(s) available.';
    }).catch(function (e) {
      var body = f.back.querySelector('#calSrcBody');
      if (body) body.innerHTML = '<p class="empty">' + esc(e.message || 'Could not load the sources.') + '</p>';
    });
  }

  /* Re-read the calendar (and the page blocks) and redraw everything. */
  function calAdminReload() {
    return Promise.all([
      api('collection', { name: 'calendar_entries' }),
      api('blocks', { page: 'calendar' })
    ]).then(function (r) {
      calAdmin.items = r[0].items || [];
      calAdmin.meta = r[0].meta || calAdmin.meta;
      calAdmin.blocks = r[1].blocks || calAdmin.blocks;
      calAdmin.byDate = calAdmIndex(calAdmin.items);
      calAdmDraw();
      calDrawTable();
      /* Push the change into the live preview window, when it is open. */
      if (preview) previewReload();
    }).catch(function (e) { errorBox(e); });
  }
  /* CAL_ADMIN_VIEW */

  /* The "All entries" table: the same rows the calendar shows, in list form,
     so an admin can also scan and open an entry without hunting for it on the
     grid. */
  function calDrawTable() {
    var wrap = document.getElementById('calTableWrap');
    if (!wrap) return;
    if (!calAdmin.items.length) {
      wrap.innerHTML = '<p class="empty">The calendar is empty &mdash; add an entry, or pull in an existing one from Sources.</p>';
      return;
    }
    wrap.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr>'
      + '<th>Title</th><th>Type</th><th>Dates</th><th>Location</th><th></th>'
      + '</tr></thead><tbody>'
      + calAdmin.items.map(function (it) {
        return '<tr><td><b>' + esc(it.title) + '</b>'
          + (Number(it.is_highlight) ? ' <span class="chip yellow">highlight</span>' : '')
          + (it.source && it.source !== 'manual' ? ' <span class="chip muted">' + esc(it.source) + '</span>' : '') + '</td>'
          + '<td><span class="chip" style="background:' + calKindColorAdmin(it.kind) + ';color:#fff">' + esc(calKindLabelAdmin(it.kind)) + '</span></td>'
          + '<td>' + esc(String(it.date_start) + (it.date_end && it.date_end !== it.date_start ? ' → ' + it.date_end : '')) + '</td>'
          + '<td>' + esc(it.location || '—') + '</td>'
          + '<td><div class="actions">'
          + '<button type="button" class="btn btn-outline btn-sm" data-tbl-view="' + it.id + '" title="Open the day panel">' + icon('eye') + 'View</button>'
          + '<button type="button" class="btn btn-primary btn-sm" data-tbl-edit="' + it.id + '" title="Edit all details">' + icon('save') + 'Edit</button>'
          + '<button type="button" class="btn btn-outline btn-sm" data-tbl-archive="' + it.id + '" title="Move to Archive storage">' + icon('archive') + 'Archive</button>'
          + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
    wrap.querySelectorAll('[data-tbl-view]').forEach(function (b) {
      b.onclick = function () {
        var id = +b.getAttribute('data-tbl-view');
        var item = calAdmin.items.filter(function (x) { return +x.id === id; })[0];
        if (item) calDayModal(String(item.date_start).slice(0, 10));
      };
    });
    wrap.querySelectorAll('[data-tbl-edit]').forEach(function (b) {
      b.onclick = function () {
        var id = +b.getAttribute('data-tbl-edit');
        calEntryModal(calAdmin.items.filter(function (x) { return +x.id === id; })[0]);
      };
    });
    wrap.querySelectorAll('[data-tbl-archive]').forEach(function (b) {
      b.onclick = function () {
        var id = +b.getAttribute('data-tbl-archive');
        confirmDialog('Archive record?', 'It moves to Archive storage and can be restored any time.', 'Archive').then(function (ok) {
          if (!ok) return;
          api('collection', { name: 'calendar_entries', id: id }, { method: 'DELETE' })
            .then(function () { toast('Archived', 'Find it in Archive storage.'); calAdminReload(); })
            .catch(function (e) { toast('Archive failed', e.message, true); });
        });
      };
    });
  }
  /* CAL_ADMIN_VIEW2 */

  function viewCalendar() {
    var now = new Date();
    calAdmin.y = now.getFullYear();
    calAdmin.m = now.getMonth();
    Promise.all([
      api('blocks', { page: 'calendar' }),
      api('collection', { name: 'calendar_entries' })
    ]).then(function (r) {
      calAdmin.blocks = r[0].blocks || [];
      calAdmin.items = r[1].items || [];
      calAdmin.meta = r[1].meta;
      calAdmin.byDate = calAdmIndex(calAdmin.items);

      var html = '<div class="page-head"><div><h2>Calendar</h2>'
        + '<p>Everything added here is listed on the public calendar, opens a full-detail popup when a day is clicked, and scrolls in the header marquee once its date arrives.</p></div>'
        + '<span class="spacer"></span>'
        + '<a class="btn btn-outline btn-sm" href="../index.html#calendar" target="_blank">' + icon('eye') + 'View section</a>'
        + '<button type="button" class="btn btn-accent btn-sm" id="pvOpen" aria-pressed="false">' + icon('eye') + 'Live preview</button></div>';

      /* --- page content (banner) + the floating live preview ---------------- */
      html += '<form id="blockForm"><div class="card"><div class="card-head"><h3>Page content</h3>'
        + '<span class="chip">' + calAdmin.blocks.length + ' editable fields</span></div>'
        + '<p class="card-sub">Changes are published to the public website immediately.</p>'
        + '<div class="form-grid">';
      calAdmin.blocks.forEach(function (b) { html += renderField('b_', b, b.value); });
      html += '</div><div class="form-actions"><span class="muted t-10">Editing <b>Calendar</b></span>'
        + '<span class="spacer"></span><button class="btn btn-primary btn-sm" type="submit">' + icon('save') + 'Save content</button></div>'
        + '</div></form>';

      /* --- the calendar itself ---------------------------------------------- */
      html += '<div class="card"><div class="card-head"><h3>Calendar</h3>'
        + '<span class="chip" id="calAdmCount">0 entries</span><span class="spacer"></span>'
        + '<button type="button" class="btn btn-ghost btn-icon" data-adm-prev title="Previous month">&lsaquo;</button>'
        + '<span class="cal-adm-month" id="calAdmMonth"></span>'
        + '<button type="button" class="btn btn-ghost btn-icon" data-adm-next title="Next month">&rsaquo;</button>'
        + '<button type="button" class="btn btn-outline btn-sm" data-adm-today>Today</button>'
        + '<button type="button" class="btn btn-outline btn-sm" data-adm-new>' + icon('plus') + 'Add entry</button>'
        + '<button type="button" class="btn btn-outline btn-sm" data-adm-sources>' + icon('layers') + 'Sources</button>'
        + '<a class="btn btn-ghost btn-sm" href="#/archive/calendar_entries">Archive</a>'
        + '</div>'
        + '<div class="cal-legend">' + Object.keys(CAL_ADMIN_KINDS).map(function (k) {
          return '<span class="cal-legend-item"><i class="cal-legend-dot' + (k === 'school_event' ? ' hl' : '')
            + '" style="background:' + calKindColorAdmin(k) + '"></i>' + esc(calKindLabelAdmin(k)) + '</span>';
        }).join('') + '</div>'
        + '<div class="cal-adm-grid" id="calAdmGrid"></div>'
        + '<p class="card-sub">Click any day to see its full details, edit an entry, archive it, or add something new on that date. '
        + 'School events are highlighted in yellow. When the live preview is open it reloads itself after every change.</p>'
        + '</div>';

      html += '<div class="card"><div class="card-head"><h3>All entries</h3>'
        + '<span class="chip">' + calAdmin.items.length + '</span></div>'
        + '<div id="calTableWrap"></div></div>';

      document.getElementById('content').innerHTML = html;
      calAdmDraw();
      calDrawTable();

      /* --- behaviours ------------------------------------------------------- */
      var form = document.getElementById('blockForm');
      attachFieldBehaviours(form);
      stepify(form);
      wirePreviewForm(form, previewCtxForPage('calendar', 'Calendar'));
      previewSyncButton();
      var pvBtn = document.getElementById('pvOpen');
      if (pvBtn) pvBtn.onclick = function () { togglePreview(); };
      form.onsubmit = function (e) {
        e.preventDefault();
        var fd = formDataOf(form);
        var payload = {};
        calAdmin.blocks.forEach(function (b) { payload[b.key] = fd.get('b_' + b.key); });
        var btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        api('blocks', { page: 'calendar' }, { method: 'POST', body: { blocks: payload } })
          .then(function () { toast('Saved', 'Calendar updated.'); })
          .catch(function (err) { toast('Save failed', err.message, true); })
          .then(function () { btn.disabled = false; });
      };

      /* Toolbar + day clicks, delegated on the content root. */
      var content = document.getElementById('content');
      content.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || typeof t.closest !== 'function') return;
        if (t.closest('[data-adm-prev]')) {
          calAdmin.m--; if (calAdmin.m < 0) { calAdmin.m = 11; calAdmin.y--; } calAdmDraw(); return;
        }
        if (t.closest('[data-adm-next]')) {
          calAdmin.m++; if (calAdmin.m > 11) { calAdmin.m = 0; calAdmin.y++; } calAdmDraw(); return;
        }
        if (t.closest('[data-adm-today]')) {
          var d = new Date(); calAdmin.y = d.getFullYear(); calAdmin.m = d.getMonth(); calAdmDraw(); return;
        }
        if (t.closest('[data-adm-new]')) { calEntryModal(null, calAdmToday()); return; }
        if (t.closest('[data-adm-sources]')) { calSourcesModal(); return; }
        var day = t.closest('[data-adm-day]');
        if (day) calDayModal(day.getAttribute('data-adm-day'));
      });
    }).catch(function (e) { errorBox(e); });
  }

  /* ------------------------------------------------------------ live preview
     A floating window over the admin layout that shows the REAL public page
     (../index.html) while a content page — or the site settings — is being
     edited. Every keystroke / upload is pushed into that page through
     window.CSAP.preview (see assets/js/cms.js), so the preview is exactly what
     the site will look like, before anything is saved.

     The window floats: drag it by its title bar or its footer, or switch on
     Move mode to drag it from anywhere inside the page. The page itself
     scrolls inside the frame. Focusing a field zooms the preview onto the
     element that field writes to and highlights it; leaving the field zooms
     back out. Using the toolbar zoom-out / zoom-in buttons takes over: the
     level you pick then sticks (focusing a field only highlights and scrolls)
     until you reload the preview or switch section. Box (position / size) is
     remembered between visits. */
  var PREVIEW_BOX_KEY = 'csap.admin.previewBox';
  var PREVIEW_ZOOM_IN = 1.5;                 // auto-zoom while a field has focus (a step below)
  var PREVIEW_ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2];

  /* page key -> block key -> the element that block is written to on the
     public site. Same selectors assets/js/cms.js uses, so the highlight always
     lands on the exact spot where the change appears. */
  var PREVIEW_TARGETS = {
    hero: { eyebrow: '#heroEyebrow', title: '#heroTitle', tagline: '#heroTagline', meta: '#heroMeta',
      logo: '#heroLogo', btn1_label: '#heroBtn1', btn1_url: '#heroBtn1', btn2_label: '#heroBtn2',
      btn2_url: '#heroBtn2', bg_slides: '#heroBg', gallery: '#cmsGallery' },
    about: { banner_title: '#cmsAboutBanner', lede: '#cmsAboutLede', body: '#cmsAboutBody', image: '#cmsAboutImg',
      mission_image: '#cmsMissionImg', mission_title: '#cmsMissionTitle', mission_body: '#cmsMissionBody',
      vision_image: '#cmsVisionImg', vision_title: '#cmsVisionTitle', vision_body: '#cmsVisionBody' },
    history: { title: '#cmsHistoryTitle', subtitle: '#cmsHistorySub', intro: '#cmsHistoryIntro',
      h1_title: '#cmsHistoryH1', h1_body: '#cmsHistoryH1Body', purpose_title: '#cmsHistoryPurpose',
      purpose_body: '#cmsHistoryPurposeBody', growth_title: '#cmsHistoryGrowth', growth_body: '#cmsHistoryGrowthBody',
      banner: '#cmsHistoryBanner' },
    leaders: { title: '#cmsLeadersTitle' },
    officers: { title: '#cmsOfficersTitle' },
    contact: { title: '#cmsContactTitle', project_image: '#cmsProjectImg', project_caption: '#cmsProjectCaption' },
    city_scholarship: { banner_title: '#cmsCityBanner', lede: '#cmsCityLede', sdp_title: '#cmsSdpTitle',
      sdp_body: '#cmsSdpBody', sdp_types_title: '#cmsSdpTypesTitle', faq_title: '#cmsFaqTitle',
      guide_title: '#cmsGuideTitle', guide_image: '#cmsGuideImg' },
    hk_scholarship: { banner_title: '#cmsHkBanner', lede: '#cmsHkLede', who_title: '#cmsHkWhoTitle',
      who_lines: '#cmsHkWho', benefits_title: '#cmsHkBenefitsTitle', price_note: '#cmsHkPriceNote',
      eligibility_title: '#cmsHkEligTitle', eligibility_sub: '#cmsHkEligSub', eligibility_lines: '#cmsHkElig',
      requirements_sub: '#cmsHkReqSub', requirements_body: '#cmsHkReqBody', requirements_lines: '#cmsHkReq',
      maintenance: '#cmsHkMaintenance', exam_title: '#cmsHkExamTitle', exam_lines: '#cmsHkExam',
      duty_title: '#cmsHkDutyTitle', duty_lines: '#cmsHkDuty', renewal_title: '#cmsHkRenewTitle',
      renewal_body: '#cmsHkRenewBody', renewal_sub: '#cmsHkRenewSub', renewal_lines: '#cmsHkRenew',
      renewal_note: '#cmsHkRenewNote' },
    enrollment: { banner_title: '#cmsEnrollBanner', title: '#cmsEnrollTitle', requirements_heading: '#cmsEnrollReqHeading',
      requirements_lines: '#cmsEnrollReq', walkin_title: '#cmsWalkinTitle', online_title: '#cmsOnlineTitle',
      online_note: '#cmsOnlineNote' },
    announcements: { banner_title: '#cmsAnnBanner', section_title: '#cmsAnnTitle' },
    events: { banner_title: '#cmsEventsBanner' },
    calendar: { banner_title: '#cmsCalendarBanner' },
    awards: { banner_title: '#cmsAwardsBanner', title: '#cmsAwardsTitle', para1: '#cmsAwardsP1', para2: '#cmsAwardsP2' }
  };

  /* page key -> the section of the public site that page lives in. */
  var PREVIEW_SECTIONS = {
    hero: '#home', about: '#about', history: '#history', leaders: '#lineage', officers: '#officers',
    contact: '#contact', city_scholarship: '#city-scholarship', hk_scholarship: '#hk-scholarship',
    enrollment: '#enrollment', announcements: '#announcements', events: '#events', calendar: '#calendar', awards: '#awards'
  };

  /* settings key -> element (site settings editor). Settings that are stored
     but never printed on the public site simply land on their section. */
  var PREVIEW_SETTING_TARGETS = {
    site_title: '#cmsBrand', site_short: '#cmsBrand', org_name: '#cmsBrand', site_tagline: '#cmsBrand',
    site_established: '#cmsFooterEst', logo: '.brand-logo', logo_small: '.brand-logo',
    theme_color: '#siteHeader', color_primary: '#siteHeader', color_accent: '#siteHeader', color_bg: '#siteHeader',
    footer_about: '#cmsFooterAbout', footer_credit: '#cmsFooterCopy', footer_copy: '#cmsFooterCopy'
  };

  /* Highlight ring, injected once into the preview document. */
  var PREVIEW_HL_CSS =
    '.pv-hl{outline:3px solid #ffd400 !important;outline-offset:4px !important;'
    + 'box-shadow:0 0 0 6px rgba(255,212,0,.32),0 0 22px rgba(255,212,0,.45) !important;'
    + 'animation:pvPulse 1.5s ease-in-out infinite;}'
    + '@keyframes pvPulse{0%,100%{box-shadow:0 0 0 6px rgba(255,212,0,.32),0 0 22px rgba(255,212,0,.45)}'
    + '50%{box-shadow:0 0 0 12px rgba(255,212,0,.10),0 0 28px rgba(255,212,0,.28)}}'
    + '.pv-hl-soft{outline:2px dashed rgba(255,212,0,.9) !important;outline-offset:3px !important;}';

  /* previewCtx — what the open form edits. Set by every previewable view and
     kept while the window is closed, so re-opening lands on the same page. */
  var previewCtx = null;
  var preview = null;      // the window itself (null = closed)

  function previewCtxForPage(key, label) {
    return { kind: 'page', key: key, label: label, anchor: PREVIEW_SECTIONS[key] || '#home', prefix: 'b_', form: null };
  }
  function previewCtxForSettings(label) {
    return { kind: 'settings', key: 'settings', label: label || 'Site Settings', anchor: '#home', prefix: '', form: null };
  }
  function previewHref(anchor) { return '../index.html' + (anchor || '#home'); }
  function previewFrame() { return preview ? preview.panel.querySelector('[data-pv-frame]') : null; }
  function previewPart(sel) { return preview ? preview.panel.querySelector(sel) : null; }
  function previewStatus(html) {
    var s = previewPart('[data-pv-status]');
    if (s) s.innerHTML = html;
  }
  /* ------------------------------------------------------------ the window */
  function createPreview() {
    var panel = document.createElement('div');
    panel.className = 'pv-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Live website preview');
    panel.innerHTML =
      '<div class="pv-head" data-pv-drag title="Drag to move the preview">'
      + '<span class="pv-title" data-pv-title>Live preview</span>'
      + '<span class="chip">live</span><span class="spacer"></span>'
      + '<button type="button" class="btn btn-ghost btn-icon" data-pv="move" aria-pressed="false" '
      + 'title="Move mode: drag the preview from anywhere inside it, then click again to scroll the page">' + icon('move') + '</button>'
      + '<button type="button" class="btn btn-ghost btn-icon" data-pv="zoomout" title="Zoom out">' + icon('zoomout') + '</button>'
      + '<span class="pv-zoom" data-pv-zoom>100%</span>'
      + '<button type="button" class="btn btn-ghost btn-icon" data-pv="zoomin" title="Zoom in">' + icon('zoomin') + '</button>'
      + '<button type="button" class="btn btn-ghost btn-icon" data-pv="reload" title="Reload the preview">' + icon('refresh') + '</button>'
      + '<a class="btn btn-ghost btn-icon" data-pv="open" href="../index.html" target="_blank" rel="noopener" '
      + 'title="Open the public site in a new tab">' + icon('eye') + '</a>'
      + '<button type="button" class="btn btn-ghost btn-icon" data-pv="close" title="Close the preview">&times;</button>'
      + '</div>'
      + '<div class="pv-body"><iframe class="pv-frame" data-pv-frame title="Live preview of the public website"></iframe>'
      + '<div class="pv-grab" data-pv-grab><b>Drag to move</b></div>'
      + '<div class="pv-load" data-pv-load hidden>Loading the live preview&hellip;</div></div>'
      + '<div class="pv-foot" data-pv-drag title="Drag to move the preview">'
      + '<span class="pv-status" data-pv-status>Live preview</span><span class="spacer"></span>'
      + '<span class="pv-hint">Drag the bars to move &middot; Move mode drags inside &middot; scroll to pan</span></div>'
      + '<span class="pv-grip" data-pv-resize title="Drag to resize"></span>';
    document.body.appendChild(panel);

    preview = { panel: panel, anchor: null, docLoaded: false, hl: null, zoom: 1, timer: null, move: false, manual: false, blurTimer: null };
    panel.querySelector('[data-pv-frame]').addEventListener('load', previewOnLoad);
    panel.addEventListener('pointerdown', previewPointerDown);
    panel.addEventListener('click', previewClick);
    document.addEventListener('keydown', previewKey);
    window.addEventListener('resize', previewClamp);
    previewPlace();
  }

  function closePreview() {
    if (!preview) return;
    if (preview.timer) clearInterval(preview.timer);
    document.removeEventListener('keydown', previewKey);
    window.removeEventListener('resize', previewClamp);
    previewBoxSave();
    preview.panel.remove();
    preview = null;
    previewSyncButton();
  }

  function togglePreview() {
    if (preview) { closePreview(); return; }
    if (!previewCtx) return;
    createPreview();
    previewConfigure();
    previewSyncButton();
  }

  /* ------------------------------------------------- position / size / zoom */
  function previewBoxRead() {
    try {
      var b = JSON.parse(localStorage.getItem(PREVIEW_BOX_KEY) || 'null');
      return (b && isFinite(b.x) && isFinite(b.w)) ? b : null;
    } catch (e) { return null; }
  }
  function previewBoxSave() {
    if (!preview) return;
    var r = preview.panel.getBoundingClientRect();
    try {
      localStorage.setItem(PREVIEW_BOX_KEY, JSON.stringify({
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)
      }));
    } catch (e) { /* storage disabled — the box simply is not remembered */ }
  }
  /* First run keeps the CSS default (right side, under the top bar); after
     that the saved box is restored and clamped into the current viewport. */
  function previewPlace() {
    var box = previewBoxRead();
    if (!box) return;
    var panel = preview.panel;
    var maxW = window.innerWidth - 16, maxH = window.innerHeight - 52;
    var w = Math.round(Math.min(Math.max(box.w, 264), maxW));
    var h = Math.round(Math.min(Math.max(box.h, 200), maxH));
    var x = Math.round(Math.min(Math.max(box.x, 8), Math.max(8, window.innerWidth - w - 8)));
    var y = Math.round(Math.min(Math.max(box.y, 52), Math.max(52, window.innerHeight - h - 8)));
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = 'auto';
  }
  function previewClamp() {
    if (!preview) return;
    var r = preview.panel.getBoundingClientRect();
    if (r.left > window.innerWidth - 60 || r.top > window.innerHeight - 30) previewPlace();
  }
  function previewSetZoom(z) {
    if (!preview) return;
    preview.zoom = z;
    var label = previewPart('[data-pv-zoom]');
    if (label) label.textContent = Math.round(z * 100) + '%';
    var frame = previewFrame();
    var doc = frame && frame.contentDocument;
    if (doc && doc.body) doc.body.style.zoom = (z === 1 ? '' : String(z));
  }
  function previewZoomStep(dir) {
    var steps = PREVIEW_ZOOM_STEPS, z = preview ? preview.zoom : 1, i, s;
    for (s = 0, i = -1; s < steps.length; s++) if (Math.abs(steps[s] - z) < 0.01) i = s;
    if (i < 0) {                       // an off-step value: step to the nearest one past it
      i = dir > 0 ? steps.length - 1 : 0;
      for (s = 0; s < steps.length; s++) {
        if (dir > 0 && steps[s] > z) { i = s; break; }
        if (dir < 0 && steps[s] < z) i = s;
      }
    } else {
      i += dir;
    }
    return steps[Math.max(0, Math.min(steps.length - 1, i))];
  }
  /* A zoom chosen on the toolbar. It becomes the zoom that sticks: the focus /
     blur auto-zoom then only highlights and scrolls — it no longer forces its
     own level — until a reload or a change of section hands control back to the
     automatic behaviour. */
  function previewManualZoom(z) {
    if (!preview) return;
    if (preview.blurTimer) { clearTimeout(preview.blurTimer); preview.blurTimer = null; }
    preview.manual = true;
    previewSetZoom(z);
  }
  function previewToggleMove() {
    if (!preview) return;
    preview.move = !preview.move;
    preview.panel.classList.toggle('is-move', preview.move);
    var btn = preview.panel.querySelector('[data-pv="move"]');
    if (btn) btn.setAttribute('aria-pressed', String(preview.move));
    if (preview.move) previewStatus('<b>Move mode</b> &middot; drag anywhere inside, Esc to finish');
    else previewStatus('Live &middot; focus a field to zoom to it');
  }
  function previewKey(e) {
    if (preview && preview.move && e.key === 'Escape') previewToggleMove();
  }
  function previewReload() {
    if (!preview) return;
    preview.docLoaded = false;
    if (preview.blurTimer) { clearTimeout(preview.blurTimer); preview.blurTimer = null; }
    var load = previewPart('[data-pv-load]');
    if (load) load.hidden = false;
    preview.manual = false;          // a reload hands zoom back to the automatic behaviour
    previewSetZoom(1);
    previewFrame().src = previewHref(preview.anchor);
  }

  /* --------------------------------------------------------- drag / resize */
  function previewDragStart(e) {
    if (e.button) return;
    var panel = preview.panel, r = panel.getBoundingClientRect();
    var dx = e.clientX - r.left, dy = e.clientY - r.top;
    panel.classList.add('is-drag');
    function move(ev) {
      var x = Math.max(-r.width + 90, Math.min(ev.clientX - dx, window.innerWidth - 90));
      var y = Math.max(48, Math.min(ev.clientY - dy, window.innerHeight - 30));
      panel.style.left = Math.round(x) + 'px';
      panel.style.top = Math.round(y) + 'px';
      panel.style.right = 'auto';
    }
    function up() {
      panel.classList.remove('is-drag');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      previewBoxSave();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  }
  function previewResizeStart(e) {
    if (e.button) return;
    var panel = preview.panel, r = panel.getBoundingClientRect();
    var sx = e.clientX, sy = e.clientY, w0 = r.width, h0 = r.height;
    panel.classList.add('is-drag');
    function move(ev) {
      var w = Math.max(264, Math.min(w0 + (ev.clientX - sx), window.innerWidth - 16));
      var h = Math.max(200, Math.min(h0 + (ev.clientY - sy), window.innerHeight - 52));
      panel.style.width = Math.round(w) + 'px';
      panel.style.height = Math.round(h) + 'px';
    }
    function up() {
      panel.classList.remove('is-drag');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      previewBoxSave();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
    e.stopPropagation();
  }
  function previewPointerDown(e) {
    if (!preview) return;
    var t = e.target;
    if (t.closest && t.closest('[data-pv-resize]')) { previewResizeStart(e); return; }
    if (t.closest && t.closest('[data-pv-grab]')) { previewDragStart(e); return; }   // Move mode
    var drag = t.closest ? t.closest('[data-pv-drag]') : null;
    if (drag && !(t.closest('button') || t.closest('a'))) previewDragStart(e);
  }
  function previewClick(e) {
    if (!preview) return;
    var btn = e.target.closest ? e.target.closest('[data-pv]') : null;
    if (!btn || !preview.panel.contains(btn)) return;
    var act = btn.getAttribute('data-pv');
    if (act === 'close') closePreview();
    else if (act === 'move') previewToggleMove();
    else if (act === 'zoomin') previewManualZoom(previewZoomStep(1));
    else if (act === 'zoomout') previewManualZoom(previewZoomStep(-1));
    else if (act === 'reload') previewReload();
  }

  /* ------------------------------------------------------- value transport */
  function previewBridge() {
    var frame = previewFrame();
    var win = frame && frame.contentWindow;
    return (win && win.CSAP && win.CSAP.preview) ? win.CSAP.preview : null;
  }
  /* Send ONE field's value straight into the page inside the frame. */
  function previewPush(name, value) {
    var bridge = previewBridge(), ctx = previewCtx;
    if (!bridge || !ctx) return;
    var key = previewKeyOf(ctx, name);
    if (!key) return;
    var patch = {}; patch[key] = value;
    if (ctx.kind === 'settings') bridge.settings(patch);
    else bridge.page(ctx.key, patch);
  }
  /* Send every field of the open form (on open, reload and section jumps). */
  function previewPushAll() {
    var bridge = previewBridge(), ctx = previewCtx;
    if (!bridge || !ctx || !ctx.form) return;
    var patch = {};
    Array.prototype.forEach.call(ctx.form.elements, function (el) {
      if (!el.name || el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
      var key = previewKeyOf(ctx, el.name);
      if (!key) return;
      patch[key] = el.type === 'checkbox' ? (el.checked ? 1 : '') : el.value;
    });
    if (!Object.keys(patch).length) return;
    if (ctx.kind === 'settings') bridge.settings(patch);
    else bridge.page(ctx.key, patch);
  }
  function previewInjectStyle() {
    var frame = previewFrame(), doc = frame && frame.contentDocument;
    if (!doc || doc.getElementById('pvHlStyle')) return;
    var st = doc.createElement('style');
    st.id = 'pvHlStyle';
    st.textContent = PREVIEW_HL_CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* The public page answers its own API a moment after it loads, so the bridge
     only becomes usable then. Poll briefly, then hand the values over. The
     handler runs on every load — including the page's own reload after a save. */
  function previewOnLoad() {
    preview.docLoaded = true;
    preview.hl = null;
    previewInjectStyle();
    var load = previewPart('[data-pv-load]');
    if (load) load.hidden = false;
    previewStatus('Loading the live preview&hellip;');
    if (preview.timer) clearInterval(preview.timer);
    var tries = 0;
    preview.timer = setInterval(function () {
      tries++;
      var bridge = previewBridge();
      if (bridge && bridge.ready()) {
        clearInterval(preview.timer); preview.timer = null;
        if (load) load.hidden = true;
        previewPushAll();
        previewStatus('Live &middot; focus a field to zoom to it');
        return;
      }
      if (tries >= 60) {          // ~6s: keep showing the page, without live updates
        clearInterval(preview.timer); preview.timer = null;
        if (load) load.hidden = true;
        previewStatus('Preview loaded &middot; live updates unavailable');
      }
    }, 100);
  }

  function previewConfigure() {
    var ctx = previewCtx;
    if (!preview || !ctx) return;
    previewPart('[data-pv-title]').textContent = ctx.label + ' · live preview';
    var open = previewPart('[data-pv-open]');
    if (open) open.setAttribute('href', previewHref(ctx.anchor));
    if (preview.anchor === ctx.anchor && preview.docLoaded) { previewPushAll(); return; }
    preview.anchor = ctx.anchor;
    preview.manual = false;          // a new section hands zoom back to the automatic behaviour
    previewSetZoom(1);
    previewClearHighlight();
    var frame = previewFrame();
    if (preview.docLoaded) {
      try { frame.contentWindow.location.hash = ctx.anchor; }   // same section: no reload
      catch (e) { frame.src = previewHref(ctx.anchor); }
      previewPushAll();
    } else {
      frame.src = previewHref(ctx.anchor);
    }
  }

  /* ------------------------------------------------------ zoom + highlight */
  function previewKeyOf(ctx, name) {
    if (!ctx || !name) return '';
    if (!ctx.prefix) return name;
    return name.indexOf(ctx.prefix) === 0 ? name.slice(ctx.prefix.length) : '';
  }
  function previewClearHighlight() {
    if (preview && preview.hl && preview.hl.classList) {
      preview.hl.classList.remove('pv-hl');
      preview.hl.classList.remove('pv-hl-soft');
    }
    if (preview) preview.hl = null;
  }
  function previewTargetOf(name) {
    var ctx = previewCtx;
    if (!ctx || !name) return null;
    var key = previewKeyOf(ctx, name);
    if (!key) return null;
    return ctx.kind === 'settings' ? PREVIEW_SETTING_TARGETS[key] : (PREVIEW_TARGETS[ctx.key] || {})[key];
  }
  /* Focusing a field: zoom in, ring the element that field writes to and scroll
     it to the middle of the preview. */
  function previewFocusField(input) {
    if (!preview || !previewCtx) return;
    var sel = previewTargetOf(previewFieldName(input));
    var doc = previewFrame().contentDocument;
    if (!doc) return;
    var el = sel ? doc.querySelector(sel) : null;
    if (!el) el = doc.querySelector(previewCtx.anchor || '#home');    // section fallback
    if (!preview.manual) previewSetZoom(PREVIEW_ZOOM_IN);   // honour a zoom chosen on the toolbar
    previewClearHighlight();
    if (el && el.classList) { el.classList.add('pv-hl'); preview.hl = el; }
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* no-op */ }
    }
    var label = previewLabelOf(input) || 'this field';
    previewStatus(sel
      ? 'Zoomed to <b>' + esc(label) + '</b>'
      : 'Showing the section for <b>' + esc(label) + '</b> <span class="muted">(no single element)</span>');
  }
  /* Leaving the last field: zoom back out and leave a soft marker behind. */
  function previewBlurField() {
    if (!preview) return;
    if (preview.blurTimer) clearTimeout(preview.blurTimer);
    preview.blurTimer = setTimeout(function () {
      preview.blurTimer = null;
      if (!preview || !previewCtx || !previewCtx.form) return;
      if (previewCtx.form.contains(document.activeElement)) return;   // another field took over
      if (preview.hl && preview.hl.classList) {
        preview.hl.classList.remove('pv-hl');
        preview.hl.classList.add('pv-hl-soft');
      }
      if (preview.manual) {                       // keep a zoom chosen on the toolbar
        previewStatus('Live &middot; zoom held at <b>' + Math.round(preview.zoom * 100)
          + '%</b> <span class="muted">(reload to auto-zoom again)</span>');
      } else {
        previewSetZoom(1);
        previewStatus('Live &middot; focus a field to zoom to it');
      }
    }, 170);
  }
  /* Which field does this input belong to? Inputs inside a list editor and the
     text twin of a colour box carry no name of their own. */
  function previewFieldName(input) {
    if (!input) return '';
    if (input.name) return input.name;
    var sync = input.getAttribute && input.getAttribute('data-sync');
    if (sync) return sync;
    var ed = input.closest ? input.closest('[data-list-editor]') : null;
    if (ed) { var h = ed.querySelector('input[type="hidden"]'); if (h && h.name) return h.name; }
    return '';
  }
  function previewLabelOf(input) {
    if (!previewCtx || !previewCtx.form) return '';
    var name = previewFieldName(input);
    var lab = name ? previewCtx.form.querySelector('label[for="' + name + '"]') : null;
    if (!lab && input.closest) {
      var field = input.closest('.field');
      if (field) lab = field.querySelector('label');
    }
    return lab ? String(lab.textContent || '').replace(/\*+/g, '').trim() : '';
  }

  /* ----------------------------------------------------------- form wiring */
  var PV_INPUT_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1 };
  function wirePreviewForm(form, cfg) {
    if (!form) return;
    cfg.form = form;
    previewCtx = cfg;
    if (preview) previewConfigure();           // window already open: re-point it
    if (form.__pvWired) return;
    form.__pvWired = true;
    form.addEventListener('focusin', function (e) {
      var t = e.target;
      if (!preview || previewCtx.form !== form || !t || !PV_INPUT_TAGS[t.tagName]) return;
      if (t.type === 'file' || t.type === 'hidden') return;
      previewFocusField(t);
    });
    form.addEventListener('focusout', function (e) {
      var t = e.target;
      if (!preview || previewCtx.form !== form || !t || !PV_INPUT_TAGS[t.tagName]) return;
      if (t.type === 'file' || t.type === 'hidden') return;
      previewBlurField();
    });
    /* Live values — every keystroke, colour pick, upload and list edit. */
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (!preview || previewCtx.form !== form || !t || t.type === 'file' || t.type === 'hidden') return;
      var name = previewFieldName(t);
      if (name) previewPush(name, t.type === 'checkbox' ? (t.checked ? 1 : '') : t.value);
    });
    form.addEventListener('change', function (e) {   // selects + checkboxes
      var t = e.target;
      if (!preview || previewCtx.form !== form || !t) return;
      var name = previewFieldName(t);
      if (name) previewPush(name, t.type === 'checkbox' ? (t.checked ? 1 : '') : t.value);
    });
  }

  /* ------------------------------------------------------- router + button */
  function previewSyncRoute() {
    if (!preview) return;                       // closed: stay closed
    var key = routeKey();
    var onPage = key.indexOf('#/page/') === 0 && !!PREVIEW_SECTIONS[key.split('/')[2]];
    if (onPage || key === '#/settings') return; // the view itself re-points it
    closePreview();
  }
  function previewSyncButton() {
    var btn = document.getElementById('pvOpen');
    if (!btn) return;
    var on = !!preview;
    btn.classList.toggle('btn-primary', on);
    btn.classList.toggle('btn-accent', !on);
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Hide the live preview' : 'Open a floating live preview of the public site';
    btn.innerHTML = icon('eye') + (on ? 'Hide preview' : 'Live preview');
  }

  /* ------------------------------------------------------- list page pieces
     Every list in the panel is built from the same two cards:
       1. the FILTER card — carries the page label plus its search/filters;
       2. the LIST card   — carries the list title, the Archive + Add actions,
                            the table itself, the pager and the bulk bar.
     Students, Archive storage and all the other lists therefore look and
     behave identically. */

  /* Rows per page for the server-paged lists (Students + Archive storage). */
  var LIST_PAGE_SIZE = 50;

  function pageOf(key) {
    var p = parseInt(state.pages[key], 10);
    return p > 0 ? p : 1;
  }
  function goToPage(key, page) {
    state.pages[key] = Math.max(1, page | 0);
  }
  /* 1 … 4 5 6 … 52 — a compact window of page numbers around the current one. */
  function pagerNumbers(page, pages) {
    var start = Math.max(1, Math.min(page - 2, pages - 4));
    var end = Math.min(pages, start + 4);
    var out = [];
    if (start > 1) { out.push(1); if (start > 2) out.push(-1); }
    for (var i = start; i <= end; i++) out.push(i);
    if (end < pages) { if (end < pages - 1) out.push(-1); out.push(pages); }
    return out;
  }
  function pagerHtml(key, total) {
    if (!total) return '';
    var pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
    var page = Math.min(pageOf(key), pages);
    var from = (page - 1) * LIST_PAGE_SIZE + 1;
    var to = Math.min(total, page * LIST_PAGE_SIZE);
    var html = '<div class="pager" data-pager="' + esc(key) + '">'
      + '<span class="muted t-10">Showing <b>' + from + '&ndash;' + to + '</b> of <b>' + total + '</b></span>'
      + '<span class="spacer"></span>'
      + '<button type="button" class="btn btn-outline btn-sm" data-pg="prev"' + (page <= 1 ? ' disabled' : '') + '>' + icon('back') + 'Prev</button>';
    pagerNumbers(page, pages).forEach(function (n) {
      html += n < 0
        ? '<span class="pager-gap">&hellip;</span>'
        : '<button type="button" class="btn btn-sm ' + (n === page ? 'btn-primary' : 'btn-outline') + '" data-pg="' + n + '">' + n + '</button>';
    });
    html += '<button type="button" class="btn btn-outline btn-sm" data-pg="next"' + (page >= pages ? ' disabled' : '') + '>Next' + icon('next') + '</button></div>';
    return html;
  }
  function wirePager(scope, key, reload) {
    scope.querySelectorAll('[data-pg]').forEach(function (btn) {
      btn.onclick = function () {
        var v = btn.getAttribute('data-pg');
        var p = pageOf(key);
        goToPage(key, v === 'prev' ? p - 1 : (v === 'next' ? p + 1 : parseInt(v, 10)));
        reload();
        // A fresh page is shown from the top of the list, never mid-table.
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      };
    });
  }
  /* Card 1: the page label + record count + whatever filters the page has. */
  function filterCardHtml(label, chip, innerHtml, headExtra) {
    return '<div class="card" data-filter-card>'
      + '<div class="card-head"><h2>' + esc(label) + '</h2><span class="chip">' + chip + '</span>'
      + '<span class="spacer"></span>' + (headExtra || '') + '</div>'
      + (innerHtml || '') + '</div>';
  }
  /* Card 2: list title + Archive/Add actions + table, pager and bulk bar. */
  function listCardHtml(title, chip, actionsHtml, bodyHtml) {
    return '<div class="card" data-list-card>'
      + '<div class="card-head"><h3>' + esc(title) + '</h3>' + (chip === '' || chip == null ? '' : '<span class="chip">' + chip + '</span>')
      + '<span class="spacer"></span>' + (actionsHtml || '') + '</div>'
      + bodyHtml + '</div>';
  }
  function bulkBarHtml(buttonsHtml) {
    return '<div class="bulk-bar" data-bulk hidden><span class="muted t-10" data-bulk-count></span><span class="spacer"></span>'
      + buttonsHtml + '</div>';
  }
  var ARCHIVE_SELECTED = '<button type="button" class="btn btn-outline btn-sm" data-bulk-archive>' + icon('archive') + 'Archive selected</button>';
  /* List-card head actions: Archive-storage link + Add, plus the bulk
     "Archive selected" button that only appears once rows are picked (select
     all included) — right beside the Archive link so a whole selection can be
     archived straight from the top of the list. */
  function archiveAddActions(name, addLabel) {
    return '<button type="button" class="btn btn-primary btn-sm" data-bulk data-bulk-archive hidden title="Archive the selected records">'
        + icon('archive') + 'Archive selected</button>'
      + '<a class="btn btn-outline btn-sm" href="#/archive/' + name + '" title="Open Archive storage">' + icon('archive') + 'Archive</a>'
      + '<button type="button" class="btn btn-accent btn-sm" data-add="' + name + '">' + icon('plus') + esc(addLabel) + '</button>';
  }
  /* Search box + Search/Clear buttons, shared by every list's filter card. */
  function searchFieldHtml(id, placeholder, value) {
    return '<div class="fg-item"><label for="' + id + '">Search</label>'
      + '<input class="input" id="' + id + '" placeholder="' + esc(placeholder) + '" value="' + esc(value) + '"'
      + ' autocomplete="off" title="Results update as you type" /></div>';
  }
  function searchButtonsHtml(clearId, extraHtml) {
    return '<div class="fg-foot">'
      + '<button class="btn btn-primary btn-sm" type="submit">' + icon('search') + 'Search</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" id="' + clearId + '">Clear</button>'
      + (extraHtml || '') + '</div>';
  }

  /* -------------------------------------------------------------- list view */
  /* Active / Visible switches live in the list, never in the form. One
     delegated listener per list scope survives every re-render, and only the
     changed column is sent — the API keeps the rest of the record untouched. */
  function wireListToggles(scope) {
    if (!scope || !scope.addEventListener || scope.__togWired) return;
    scope.__togWired = true;
    scope.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-toggle]') : null;
      if (!b || !scope.contains(b) || b.disabled) return;
      var id = b.getAttribute('data-toggle');
      var coll = b.getAttribute('data-coll');
      var key = b.getAttribute('data-key');
      var next = Number(b.getAttribute('data-val')) ? 0 : 1;
      var patch = {};
      patch[key] = next;
      b.disabled = true;
      api('collection', { name: coll, id: id }, { method: 'PUT', body: patch })
        .then(function () {
          b.setAttribute('data-val', String(next));
          b.classList.toggle('is-on', !!next);
          b.setAttribute('aria-checked', next ? 'true' : 'false');
          b.title = 'Click to ' + (next ? 'deactivate' : 'activate');
          var txt = b.querySelector('b');
          if (txt) txt.textContent = next ? 'Active' : 'Inactive';
          toast(next ? 'Activated' : 'Deactivated', '');
        })
        .catch(function (err) { toast('Update failed', err.message, true); b.disabled = false; });
    });
  }

  /* ---------------------------------------------- data-driven list filters
     Every list gets the filters its own data deserves: one dropdown per field
     whose values are short and few enough to be useful (select fields, Yes/No
     flags, and short text columns such as Year level). Options come from the
     rows actually loaded, so a filter can never offer a value the list does
     not have. Long free text, notes and images are never filtered. */
  var FILTER_SKIP_KEYS = {
    id: 1, sort_order: 1, parent_id: 1, archived_at: 1, created_at: 1, last_login: 1,
    comment: 1, note: 1, bio: 1, answer: 1, question: 1, items: 1, url: 1, document_url: 1,
    link_url: 1, href: 1, email: 1, mobile: 1, guardian_contact: 1, address: 1, barangay: 1,
    photo: 1, avatar: 1, image: 1, banner: 1, name: 1, last_name: 1, first_name: 1, middle_name: 1,
    student_no: 1, username: 1, guardian_name: 1, position: 1, term: 1
  };
  var FILTER_SKIP_TYPES = { image: 1, images: 1, html: 1, lines: 1, textarea: 1 };
  var FILTER_MAX_VALUES = 15;

  function filterOptionLabel(f, v) {
    var pool = (f.options || []).concat(
      f.options_by_year
        ? Object.keys(f.options_by_year).reduce(function (a, k) { return a.concat(f.options_by_year[k] || []); }, [])
        : []
    );
    for (var i = 0; i < pool.length; i++) {
      if (String(pool[i].value) === String(v)) return pool[i].label;
    }
    return String(v);
  }
  /* -> [{key, label, col, values:[{value,label}]}] for the rows now on screen. */
  function filterFieldsOf(meta, items) {
    var out = [];
    (meta.fields || []).forEach(function (f, idx) {
      if (!f || f.list_only) return;
      if (FILTER_SKIP_TYPES[f.type] || FILTER_SKIP_KEYS[f.key]) return;
      var seen = {};
      var values = [];
      (items || []).forEach(function (row) {
        var v = row[f.key];
        if (v == null || v === '') return;
        var s = String(v);
        if (s.length > 40) return;                       // free text is not a filter
        if (seen[s]) return;
        seen[s] = 1;
        values.push({ value: s, label: f.type === 'checkbox' ? (Number(v) ? 'Yes' : 'No') : filterOptionLabel(f, v) });
      });
      if (!values.length || values.length > FILTER_MAX_VALUES) return;
      out.push({ key: f.key, label: f.label, col: idx + 1, values: values });
    });
    return out;
  }

  /* The filter row: free-text search + one dropdown per derived field. */
  function filtersHtml(fields, sel, idPrefix) {
    sel = sel || {};
    var html = '<div class="filter-grid">'
      + '<div class="fg-item"><label for="' + idPrefix + '-q">Search</label>'
      + '<input class="input" id="' + idPrefix + '-q" data-fq value="' + esc(sel.q || '') + '"'
      + ' placeholder="Type to filter this list&hellip;" autocomplete="off" /></div>';
    fields.forEach(function (f) {
      html += '<div class="fg-item"><label for="' + idPrefix + '-' + esc(f.key) + '">' + esc(f.label) + '</label>'
        + '<select class="select" id="' + idPrefix + '-' + esc(f.key) + '" data-ff="' + esc(f.key) + '">'
        + '<option value="">All</option>'
        + f.values.map(function (o) {
            return '<option value="' + esc(o.value) + '"'
              + (String(sel[f.key] || '') === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
          }).join('')
        + '</select></div>';
    });
    html += '<div class="fg-foot"><span class="muted t-10" data-fcount></span><span class="spacer"></span>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-fclear>Clear</button></div></div>';
    return html;
  }
  /* Client-side filter of one table body: text across the row, exact per column.
     Column index is field position + 1 (column 0 is the row checkbox). */
  function applyRowFilter(wrap, fields, sel) {
    sel = sel || {};
    var q = (sel.q || '').toLowerCase();
    var rows = wrap.querySelectorAll('tbody tr');
    var shown = 0;
    Array.prototype.forEach.call(rows, function (tr) {
      var ok = true;
      if (q && tr.textContent.toLowerCase().indexOf(q) < 0) ok = false;
      if (ok) {
        for (var i = 0; i < fields.length; i++) {
          var want = sel[fields[i].key];
          if (want === undefined || want === null || want === '') continue;
          var td = tr.children[fields[i].col];
          var cell = td ? (td.querySelector('b') || td).textContent : '';
          if (String(cell).trim() !== String(want)) { ok = false; break; }
        }
      }
      tr.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    var card = wrap.closest ? wrap.closest('[data-filter-card]') : null;
    var box = card && card.querySelector ? card.querySelector('[data-fcount]') : null;
    if (box) {
      box.textContent = (shown === rows.length)
        ? rows.length + ' record' + (rows.length === 1 ? '' : 's')
        : shown + ' of ' + rows.length + ' shown';
    }
    return shown;
  }
  /* One wiring for every client-filtered list: reads the controls, filters the
     rows, keeps the bulk-selection bar honest and updates the count. */
  function wireClientFilters(scope, wrap, meta, items) {
    var fields = filterFieldsOf(meta, items);
    function read() {
      var sel = {};
      var q = scope.querySelector('[data-fq]');
      if (q) sel.q = q.value;
      fields.forEach(function (f) {
        var s = scope.querySelector('[data-ff="' + f.key + '"]');
        if (s && s.value !== '') sel[f.key] = s.value;
      });
      return sel;
    }
    function apply() {
      applyRowFilter(wrap, fields, read());
      if (typeof scope.__refreshSel === 'function') scope.__refreshSel();
    }
    scope.addEventListener('input', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-fq')) apply();
    });
    scope.addEventListener('change', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-ff')) apply();
    });
    var clear = scope.querySelector('[data-fclear]');
    if (clear) clear.onclick = function () {
      var q = scope.querySelector('[data-fq]');
      if (q) q.value = '';
      fields.forEach(function (f) {
        var s = scope.querySelector('[data-ff="' + f.key + '"]');
        if (s) s.value = '';
      });
      apply();
    };
    apply();
    return { fields: fields, apply: apply };
  }

  function tableHtml(meta, items, embedded) {
    var fields = meta.fields;
    var html = '<div class="table-wrap"><table class="tbl" data-coll="' + meta.key + '"><thead><tr>'
      + '<th class="idx"><input type="checkbox" class="rowcheck" data-check-all title="Select all" /></th>';
    fields.forEach(function (f) { html += '<th>' + esc(f.label) + '</th>'; });
    html += '<th style="text-align:right">Actions</th></tr></thead><tbody>';
    if (!items.length) {
      html += '<tr><td colspan="' + (fields.length + 2) + '"><div class="empty">No records yet. Use “Add” to create the first one.</div></td></tr>';
    }
    items.forEach(function (row, i) {
      html += '<tr data-row="' + row.id + '"><td><input type="checkbox" class="rowcheck" data-check="' + row.id + '" title="Select record" /></td>';
      fields.forEach(function (f) {
        var v = row[f.key];
        var cell;
        if (f.list_only) {
          /* Status flags live in the list: one click flips them (the form never
             shows them, and a new record is active from the start). */
          var on = Number(v) ? 1 : 0;
          cell = '<button type="button" class="sw' + (on ? ' is-on' : '') + '" role="switch"'
            + ' aria-checked="' + (on ? 'true' : 'false') + '" data-val="' + on + '"'
            + ' data-toggle="' + row.id + '" data-coll="' + esc(meta.key) + '" data-key="' + esc(f.key) + '"'
            + ' title="Click to ' + (on ? 'deactivate' : 'activate') + '">'
            + '<span></span><b>' + (on ? 'Active' : 'Inactive') + '</b></button>';
        }
        else if (f.type === 'image') cell = v ? '<img class="thumb" src="' + esc(imgSrc(v)) + '" alt="" />' : '<span class="muted">—</span>';
        else if (f.type === 'checkbox') cell = Number(v) ? '<span class="chip">yes</span>' : '<span class="chip muted">no</span>';
        else if (f.type === 'select' && f.options) {
          var m = f.options.filter(function (o) { return String(o.value) === String(v); })[0];
          cell = '<span class="chip yellow">' + esc(m ? m.label : (v || '—')) + '</span>';
        } else if (f.type === 'html' || f.type === 'lines' || f.type === 'textarea') {
          var str = String(v == null ? '' : v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          cell = '<span class="truncate" style="max-width:190px;display:inline-block">' + esc(str.slice(0, 70) || '—') + '</span>';
        } else cell = esc(v == null || v === '' ? '—' : v);
        html += '<td>' + cell + '</td>';
      });
      html += '<td><div class="actions">'
        + '<button type="button" class="btn btn-outline btn-sm" data-view="' + row.id + '" title="View full details">' + icon('eye') + 'View</button>'
        + '<button type="button" class="btn btn-primary btn-sm" data-edit="' + row.id + '" title="Edit all details">' + icon('save') + 'Edit</button>'
        + '<button type="button" class="btn btn-outline btn-sm" data-archive="' + row.id + '" title="Move to Archive storage">' + icon('archive') + 'Archive</button>'
        + '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  /* Embedded list on a content page (#/page/…): ONE card — the page label, the
     record count, the quick filter and the Archive/Add actions all share the
     card head (aligned on one line) so the list reads as a single block. */
  function collectionCard(name, meta, items, embedded) {
    var filterFields = filterFieldsOf(meta, items);
    var first = filterFields.length ? filterFields[0] : null;
    var headFilter = '<span class="head-filter"><label for="coll-q-' + name + '">' + esc(first ? first.label : 'Filter') + '</label>'
      + '<select class="select" id="coll-q-' + name + '" data-filter="' + name + '"'
      + (first ? ' data-filter-col="' + first.col + '"' : '') + '>'
      + '<option value="">All</option>'
      + (first ? first.values.map(function (o) {
          return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
        }).join('') : '')
      + '</select></span>';
    var body = '<div data-table="' + name + '">' + tableHtml(meta, items, embedded) + '</div>'
      + bulkBarHtml(ARCHIVE_SELECTED);
    /* Officers: let the admin roll the roster into another (non-past) year. */
    if (name === 'officers') body = officerMoveBarHtml(meta, items) + body;
    return '<div data-collection="' + name + '" style="margin-top:10px">'
      + '<div class="card" data-list-card>'
      + '<div class="card-head"><h2>' + esc(meta.label) + '</h2><span class="chip">' + items.length + '</span>'
      + '<span class="spacer"></span>' + headFilter + archiveAddActions(name, 'Add') + '</div>'
      + body + '</div>'
      + '</div>';
  }

  /* --------------------------------------- checkbox selection + bulk actions
     One helper for every list table: header check-all, row checkboxes and a
     bulk bar. Delegated listeners survive content re-renders; the newest
     onArchiveMany handler always wins. Returns refresh(). */
  function wireSelection(scope, onArchiveMany) {
    function boxes() { return scope.querySelectorAll('[data-check]'); }
    function visibleBoxes() {
      return Array.prototype.filter.call(boxes(), function (c) {
        var tr = c.closest ? c.closest('tr') : null;
        return tr && tr.style.display !== 'none';
      });
    }
    function refresh() {
      var ids = [];
      boxes().forEach(function (c) { if (c.checked && !c.disabled) ids.push(c.getAttribute('data-check')); });
      var bars = scope.querySelectorAll('[data-bulk]');
      bars.forEach(function (b) {
        b.hidden = ids.length === 0;
        var c2 = b.querySelector('[data-bulk-count]');
        if (c2) c2.textContent = ids.length + ' selected';
      });
      var all = scope.querySelector('[data-check-all]');
      if (all) {
        var vis = visibleBoxes().filter(function (c) { return !c.disabled; });
        var checked = vis.filter(function (c) { return c.checked; });
        all.checked = vis.length > 0 && checked.length === vis.length;
        try { all.indeterminate = checked.length > 0 && checked.length < vis.length; } catch (e) {}
      }
      return ids;
    }
    scope.__selHandler = onArchiveMany;
    if (!scope.__selWired) {
      scope.__selWired = true;
      scope.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || !t.hasAttribute) return;
        if (t.hasAttribute('data-check-all')) {
          visibleBoxes().forEach(function (c) { if (!c.disabled) c.checked = t.checked; });
        }
        if (t.hasAttribute('data-check') || t.hasAttribute('data-check-all')) refresh();
      });
      scope.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-bulk-archive]') : null;
        if (!b || !scope.contains(b)) return;
        var ids = refresh();
        if (!ids.length) return;
        var handler = scope.__selHandler;
        confirmDialog('Archive ' + ids.length + ' record(s)?', 'They move to Archive storage and can be restored any time.', 'Archive')
          .then(function (ok) { if (ok && handler) handler(ids); });
      });
    }
    refresh();
    return refresh;
  }

  function attachTableBehaviours(scope, meta, items, onChanged) {
    /* ---- floating detail + edit modals for every row ---- */
    scope.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.onclick = function () {
        openCreateModal(meta, function (payload) {
          return api('collection', { name: meta.key }, { method: 'POST', body: payload })
            .then(function (r) { onChanged(); return r; });
        });
      };
    });
    scope.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-view');
        api('collection', { name: meta.key, id: id })
          .then(function (d) {
            var m = d.meta || meta;
            var item = d.item;
            openDetailModal(m, item, function () {
              openEditModal(m, item, function (payload) {
                return api('collection', { name: meta.key, id: id }, { method: 'PUT', body: payload })
                  .then(function (r) { onChanged(); return r; });
              });
            });
          })
          .catch(function (e) { errorBox(e); });
      };
    });
    scope.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-edit');
        api('collection', { name: meta.key, id: id })
          .then(function (d) {
            openEditModal(d.meta || meta, d.item, function (payload) {
              return api('collection', { name: meta.key, id: id }, { method: 'PUT', body: payload })
                .then(function (r) { onChanged(); return r; });
            });
          })
          .catch(function (e) { errorBox(e); });
      };
    });
    /* ---- archive instead of delete: single + bulk, everywhere ---- */
    scope.querySelectorAll('[data-archive]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-archive');
        confirmDialog('Archive record?', 'It moves to Archive storage and can be restored any time.', 'Archive')
          .then(function (ok) {
            if (!ok) return;
            api('collection', { name: meta.key, id: id }, { method: 'DELETE' })
              .then(function () { toast('Archived', 'Find it in Archive storage.'); onChanged(); })
              .catch(function (e) { toast('Archive failed', e.message, true); });
          });
      };
    });
    var refreshSel = wireSelection(scope, function (ids) {
      api('collection', { name: meta.key, a: 'archive' }, { method: 'POST', body: { ids: ids } })
        .then(function (r) { toast('Archived', (r.count || ids.length) + ' record(s) moved to Archive storage.'); onChanged(); })
        .catch(function (e) { toast('Archive failed', e.message, true); });
    });
    scope.querySelectorAll('[data-filter]').forEach(function (sel) {
      sel.onchange = function () {
        var name = sel.getAttribute('data-filter');
        var wrap = scope.querySelector('[data-table="' + name + '"]');
        if (!wrap) return;
        var col = parseInt(sel.getAttribute('data-filter-col') || '', 10);
        var want = sel.value;
        var shown = 0;
        wrap.querySelectorAll('tbody tr').forEach(function (tr) {
          var ok = true;
          if (want !== '' && !isNaN(col)) {
            var td = tr.children[col];
            var cell = td ? (td.querySelector('b') || td).textContent : '';
            ok = String(cell).trim() === String(want);
          }
          tr.style.display = ok ? '' : 'none';
          if (ok) shown++;
        });
        var card = wrap.closest('[data-list-card]');
        var count = card ? card.querySelector('.chip') : null;
        if (count) count.textContent = shown === wrap.querySelectorAll('tbody tr').length
          ? wrap.querySelectorAll('tbody tr').length
          : shown + ' / ' + wrap.querySelectorAll('tbody tr').length;
        refreshSel();
      };
    });
    wireListToggles(scope);
  }

  /* ----------------------- floating detail / edit modals ----------------------- */
  function fieldValueHtml(f, item) {
    var v = item[f.key];
    var type = f.type || 'text';
    if (type === 'image') {
      return v ? '<img class="fd-img" src="' + esc(imgSrc(v)) + '" alt="" />' : '<span class="muted">—</span>';
    }
    if (type === 'checkbox') return Number(v) ? '<span class="chip">yes</span>' : '<span class="chip muted">no</span>';
    if (type === 'select') {
      var m = (f.options || []).filter(function (o) { return String(o.value) === String(v); })[0];
      return '<span class="chip yellow">' + esc(m ? m.label : (v == null || v === '' ? '—' : v)) + '</span>';
    }
    if (type === 'html') {
      return esc(String(v == null ? '' : v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '—');
    }
    if (type === 'lines' || type === 'textarea') {
      return '<div class="fd-pre">' + esc(v == null ? '' : v) + '</div>';
    }
    return esc(v == null || v === '' ? '—' : v);
  }

  function floating(html, wide) {
    var back = document.createElement('div');
    back.className = 'fm-back';
    back.innerHTML = '<div class="fm' + (wide ? ' fm-wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(back);
    function onKey(e) { if (e.key === 'Escape' && document.body.contains(back)) close(); }
    function close() {
      back.classList.add('is-closing');
      setTimeout(function () { if (document.body.contains(back)) back.remove(); }, 160);
      document.removeEventListener('keydown', onKey);
    }
    back.onclick = function (e) { if (e.target === back) close(); };
    document.addEventListener('keydown', onKey);
    return { back: back, close: close };
  }

  function openDetailModal(meta, item, onEdit) {
    /* A personal photo (Students' `photo`, admins' `avatar`) belongs in the
       modal HEADER — it identifies the record at a glance — and is left out of
       the field grid below so it never appears twice. */
    var photoKey = null;
    var photo = null;
    (meta.fields || []).forEach(function (f) {
      if (photoKey || item[f.key] == null || item[f.key] === '') return;
      if (f.key === 'photo' || f.key === 'avatar') { photoKey = f.key; photo = item[f.key]; }
    });
    var fields = (meta.fields || []).filter(function (f) {
      return ['password', 'password_confirm'].indexOf(f.key) < 0 && f.key !== photoKey;
    });
    var LONG = ['textarea', 'html', 'lines', 'images', 'image'];
    var title = item[meta.title] || ('Record #' + item.id);
    var rows = fields.map(function (f) {
      var full = LONG.indexOf(f.type || 'text') >= 0;
      return '<div class="fd-row' + (full ? ' full' : '') + '"><span class="label">' + esc(f.label) + '</span>'
        + '<div class="fd-val">' + fieldValueHtml(f, item) + '</div></div>';
    }).join('');
    var f = floating(
      '<div class="fm-head">'
      + (photo ? '<span class="fm-photo"><img src="' + esc(imgSrc(photo)) + '" alt="" /></span>' : '')
      + '<h3>' + esc(title) + '</h3><span class="chip">' + esc(meta.label) + '</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-icon fm-close" title="Close">&times;</button></div>'
      + '<div class="fm-body"><div class="fd-grid">' + rows + '</div></div>'
      + '<div class="fm-foot"><span class="muted t-10">Full details' + (item.id ? ' &middot; ID ' + item.id : '') + '</span>'
      + '<span class="spacer"></span>'
      + (onEdit ? '<button type="button" class="btn btn-primary btn-sm" data-fm-edit>' + icon('save') + 'Edit</button>' : '')
      + '<button type="button" class="btn btn-outline btn-sm fm-close">Close</button></div>'
      , true);
    f.back.querySelectorAll('.fm-close').forEach(function (b) { b.onclick = f.close; });
    var ebtn = f.back.querySelector('[data-fm-edit]');
    if (ebtn) ebtn.onclick = function () { f.close(); onEdit(); };
  }

  function openEditModal(meta, item, onSave) {
    var fields = meta.fields || [];
    var title = item[meta.title] || ('Record #' + item.id);
    var f = floating(
      '<div class="fm-head"><h3>Edit &middot; ' + esc(title) + '</h3><span class="chip">' + esc(meta.label) + '</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-icon fm-close" title="Close">&times;</button></div>'
      + '<form id="fmEditForm" class="fm-body"><div class="form-grid">'
      + fields.map(function (fi) { return renderField('', fi, item[fi.key]); }).join('')
      + '</div></form>'
      + '<div class="fm-foot"><span class="muted t-10">Editing all fields</span><span class="spacer"></span>'
      + '<button type="button" class="btn btn-outline btn-sm fm-close">Cancel</button>'
      + '<button type="submit" form="fmEditForm" class="btn btn-primary btn-sm">' + icon('save') + 'Save changes</button></div>'
    );
    var form = f.back.querySelector('#fmEditForm');
    attachFieldBehaviours(form);
    ['current_password', 'password', 'password_confirm'].forEach(function (n) {
      var i = form.querySelector('[name="' + n + '"]');
      if (i) i.type = 'password';
    });
    stepify(form);
    bindOfficerOptionSelects(form, meta);
    f.back.querySelectorAll('.fm-close').forEach(function (b) { b.onclick = f.close; });
    form.onsubmit = function (e) {
      e.preventDefault();
      var fd = formDataOf(form);
      var payload = formPayload(fields, fd, item);
      var btn = f.back.querySelector('[type="submit"]');
      btn.disabled = true;
      onSave(payload)
        .then(function () { toast('Saved', meta.label); f.close(); })
        .catch(function (err) { if (!err || err.message !== '__silent__') toast('Save failed', err && err.message, true); btn.disabled = false; });
    };
  }

  /* Current school year (Aug–Jul cutoff), e.g. Oct 2026 -> "2026-2027".
     Used as the default `school_year` when adding an officer. */
  function currentSchoolYear() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1; // 1-12
    return (m >= 8 ? y : y - 1) + '-' + (m >= 8 ? y + 1 : y);
  }

  /* ------------------------------------------------- officer school-year move
     Officers change roster every school year. This lets the admin roll a whole
     roster (or every officer) into another school year at once — but never
     into a PAST year: rosters only ever move forward. */
  function officerYearField(meta) {
    var fields = (meta && meta.fields) || [];
    return fields.filter(function (f) { return f.key === 'school_year'; })[0] || null;
  }
  function isPastSchoolYear(sy) {
    sy = String(sy == null ? '' : sy).trim();
    return sy !== '' && sy < currentSchoolYear();
  }
  function officerMoveBarHtml(meta, items) {
    /* Source years: every school year that actually has officers right now. */
    var years = [];
    (items || []).forEach(function (r) {
      var y = String(r.school_year == null ? '' : r.school_year).trim();
      if (y && years.indexOf(y) < 0) years.push(y);
    });
    years.sort();
    years.reverse();
    /* Target years: the managed School Years MINUS the past ones. */
    var fld = officerYearField(meta);
    var targets = ((fld && fld.options) || []).map(function (o) { return String(o.value); })
      .filter(function (y, i, a) { return y && !isPastSchoolYear(y) && a.indexOf(y) === i; });
    targets.sort();
    if (!targets.length) {
      return '<div class="list-toolbar"><span class="muted t-10">Add a current or future '
        + 'School Year in Officer Options to move officers between years.</span></div>';
    }
    var current = currentSchoolYear();
    return '<div class="list-toolbar" id="officerMoveBar">'
      + '<span class="muted t-10">Move officers</span>'
      + '<select class="select" id="officerMoveFrom" aria-label="Move officers from school year">'
      + '<option value="">(all school years)</option>'
      + years.map(function (y) { return '<option value="' + esc(y) + '">S.Y. ' + esc(y) + '</option>'; }).join('')
      + '</select>'
      + '<span class="muted t-10">to</span>'
      + '<select class="select" id="officerMoveTo" aria-label="Move officers to school year">'
      + targets.map(function (y) {
          return '<option value="' + esc(y) + '"' + (y === current ? ' selected' : '') + '>S.Y. ' + esc(y) + '</option>';
        }).join('')
      + '</select>'
      + '<button type="button" class="btn btn-primary btn-sm" id="officerMoveBtn">' + icon('next') + 'Move</button>'
      + '</div>';
  }
  function wireOfficerMove(scope, meta, items, onChanged) {
    var bar = scope && scope.querySelector ? scope.querySelector('#officerMoveBar') : null;
    var btn = bar && bar.querySelector('#officerMoveBtn');
    if (!btn) return;
    var fromSel = bar.querySelector('#officerMoveFrom');
    var toSel = bar.querySelector('#officerMoveTo');
    btn.onclick = function () {
      var from = fromSel ? fromSel.value : '';
      var to = toSel ? toSel.value : '';
      if (!to) { toast('Pick a school year', 'Choose the school year to move the officers into.', true); return; }
      var scoped = (items || []).filter(function (r) { return !from || String(r.school_year || '') === from; });
      var count = scoped.length;
      if (!count) { toast('Nothing to move', 'No officers in the selected school year.', true); return; }
      if (!scoped.some(function (r) { return String(r.school_year || '') !== to; })) {
        toast('Already there', 'Those officers are already in S.Y. ' + to + '.', true); return;
      }
      confirmDialog('Move ' + count + ' officer(s) to S.Y. ' + to + '?',
        'Move ' + (from ? 'the S.Y. ' + from + ' roster' : 'every officer') + ' into S.Y. ' + to
        + '? Past school years can never be a target.', 'Move')
        .then(function (ok) {
          if (!ok) return;
          btn.disabled = true;
          api('collection', { name: 'officers', a: 'move' }, { method: 'POST', body: { from: from, school_year: to } })
            .then(function (r) {
              toast('Moved', (r.count || count) + ' officer(s) moved to S.Y. ' + to + '.');
              onChanged();
            })
            .catch(function (e) { toast('Move failed', e.message, true); btn.disabled = false; });
        });
    };
  }

  function defaultFieldValue(f, metaKey) {
    // List-only flags are not in the form, but a brand-new record must be active.
    if (f.list_only) return f.default === undefined ? 1 : f.default;
    if (f.type === 'checkbox') return 0;
    if (f.default !== undefined && f.default !== null && f.default !== '') return f.default;
    // OFFICERS: prefer the current school year when it is a managed option.
    if (f.key === 'school_year' && metaKey === 'officers') {
      var cy = currentSchoolYear();
      var has = (f.options || []).some(function (o) { return String(o.value) === cy; });
      if (has) return cy;
    }
    if (f.type === 'select') {
      if (f.nullable) return '';
      if (f.options && f.options.length) return f.options[0].value;
      return '';
    }
    // OFFICERS: pre-fill school year so the admin rarely types it.
    if (f.key === 'school_year' && metaKey === 'officers') return currentSchoolYear();
    return '';
  }

  /* Rapid entry everywhere: after Create, keep the form open and clear it
     so the admin can immediately add the next record. */
  function clearCreateForm(form, meta) {
    try { form.reset(); } catch (e) { /* no-op */ }
    bindOfficerOptionSelects(form, meta);
    if (form.querySelectorAll) {
      form.querySelectorAll('select').forEach(function (s) { syncCombo(s); });
    }
    var first = form.querySelector('[name="name"]') || form.querySelector('input[type="text"], textarea, select');
    if (first && first.focus) {
      try { first.focus(); } catch (e) { /* hidden pane — ignore */ }
    }
  }
  /* Officer form: the Category / Department / Year level / Role dropdowns are
     scoped to the selected school year. Rebuild them whenever school year
     changes (and once on open) so only that year's managed options appear. */
  function bindOfficerOptionSelects(form, meta) {
    if (!form || !meta || meta.key !== 'officers') return;
    var fieldsByKey = {};
    (meta.fields || []).forEach(function (f) { fieldsByKey[f.key] = f; });
    function selectFor(k) { return form.querySelector('select[name="' + k + '"]'); }
    var yearSel = selectFor('school_year');

    function rebuild() {
      var year = yearSel ? yearSel.value : '';
      ['category', 'department', 'year_level', 'role'].forEach(function (k) {
        var sel = selectFor(k);
        var f = fieldsByKey[k];
        if (!sel || !f) return;
        var prev = sel.value;
        var byYear = f.options_by_year || {};
        var yearOpts = byYear[year];
        // Use the selected year's list; if that year has none yet, fall back to
        // every managed value so the form stays usable while options are set up.
        var opts = (yearOpts && yearOpts.length) ? yearOpts : (f.options || []);
        var values = opts.map(function (o) { return String(o.value); });
        var html = (f.nullable ? '<option value="">— none —</option>' : '')
          + opts.map(function (o) {
              return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(prev) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
            }).join('');
        // Keep a value that isn't in this year's list (e.g. a legacy entry).
        if (prev && values.indexOf(String(prev)) < 0) {
          html += '<option value="' + esc(prev) + '" selected>' + esc(prev) + '</option>';
        } else if (!prev && !f.nullable && opts.length) {
          html = html.replace('<option value="' + esc(opts[0].value) + '"', '<option value="' + esc(opts[0].value) + '" selected');
        }
        sel.innerHTML = html;
        syncCombo(sel);
      });
    }

    if (yearSel && !yearSel.__officerBound) {
      yearSel.__officerBound = true;
      yearSel.addEventListener('change', rebuild);
    }
    rebuild();
  }

  function openCreateModal(meta, onSave) {
    var fields = meta.fields || [];
    // AUTO ORDER: `sort_order` is assigned by the API (MAX + 1), so it is
    // hidden on add — the admin never types it. It stays editable on Edit.
    var visible = fields.filter(function (fi) { return fi.key !== 'sort_order'; });
    var f = floating(
      '<div class="fm-head"><h3>Create &middot; ' + esc(meta.label) + '</h3><span class="chip">' + esc(meta.label) + '</span>'
      + '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-icon fm-close" title="Close">&times;</button></div>'
      + '<form id="fmCreateForm" class="fm-body"><div class="form-grid">'
      + visible.map(function (fi) { return renderField('', fi, defaultFieldValue(fi, meta.key)); }).join('')
      + '</div></form>'
      + '<div class="fm-foot"><span class="muted t-10">Stays open — add as many as needed</span><span class="spacer"></span>'
      + '<button type="button" class="btn btn-outline btn-sm fm-close">Cancel</button>'
        + '<button type="submit" form="fmCreateForm" class="btn btn-accent btn-sm">' + icon('plus') + 'Create</button></div>'
      , true);
    var form = f.back.querySelector('#fmCreateForm');
    attachFieldBehaviours(form);
    ['current_password', 'password', 'password_confirm'].forEach(function (n) {
      var i = form.querySelector('[name="' + n + '"]');
      if (i) i.type = 'password';
    });
    stepify(form);
    bindOfficerOptionSelects(form, meta);
    f.back.querySelectorAll('.fm-close').forEach(function (b) { b.onclick = f.close; });
    form.onsubmit = function (e) {
      e.preventDefault();
      var fd = formDataOf(form);
      var payload = formPayload(fields, fd, null);
      // Never send sort_order on create: the backend computes MAX + 1.
      var btn = f.back.querySelector('[type="submit"]');
      btn.disabled = true;
      onSave(payload)
        .then(function () {
          btn.disabled = false;
          // Rapid entry everywhere: stay open and clear for the next record.
          toast('Created', meta.label + ' — ready for the next one.');
          clearCreateForm(form, meta);
        })
        .catch(function (err) { if (!err || err.message !== '__silent__') toast('Create failed', err && err.message, true); btn.disabled = false; });
    };
  }

  /* Every generic list (#/list/…): server-side search + real paging.
     Filter card carries the page label; the list card carries Archive/Add. */
  function viewList(name) {
    var key = 'list:' + name;
    var q = state.listQuery[name] || '';
    var page = pageOf(key);
    var params = { name: name, limit: LIST_PAGE_SIZE, offset: (page - 1) * LIST_PAGE_SIZE };
    if (q) params.q = q;
    // Column filters are pushed to the API (f_<key>) so they apply to the whole
    // table, not just the page on screen.
    var lf = state.listFilters[name] || {};
    Object.keys(lf).forEach(function (k) { if (lf[k]) params['f_' + k] = lf[k]; });
    var seq = fetchSeq(key);
    api('collection', params).then(function (d) {
      if (!isLatest(key, seq)) return;   // a newer search already took over
      state.labels[name] = d.meta.label;
      mountShell(d.meta.label);
      var total = Number(d.total || 0);
      // Filters may have shrunk the list below the current page — go back to 1.
      if (!(d.items || []).length && page > 1) { goToPage(key, 1); viewList(name); return; }
      renderListView(name, d.meta, d.items || [], total);
    }).catch(function (e) { errorBox(e); });
  }

  function renderListView(name, meta, items, total) {
    var content = document.getElementById('content');
    var key = 'list:' + name;
    var q = state.listQuery[name] || '';
    var focusSnap = captureFocus(content);
    var typedQ = liveTypedValue(focusSnap, 'listQ');

    var filters = '<form class="filter-grid" id="listFilter">'
      + filtersHtml(filterFieldsOf(meta, items), Object.assign({ q: typedQ != null ? typedQ : q }, state.listFilters[name] || {}), 'listF')
      + '<div class="fg-foot"><span class="muted t-10" data-fcount>' + total + ' record' + (total === 1 ? '' : 's') + '</span>'
      + '<span class="spacer"></span>'
      + '<button class="btn btn-primary btn-sm" type="submit">' + icon('search') + 'Search</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="listClear">Clear</button></div></form>';
    var body = tableHtml(meta, items)
      + pagerHtml(key, total)
      + bulkBarHtml(ARCHIVE_SELECTED);

    content.innerHTML = filterCardHtml(meta.label, total, filters)
      + listCardHtml('Records', total, archiveAddActions(name, 'Add new'), body);

    function applyQuery() {
      state.listQuery[name] = ((document.getElementById('listF-q') || {}).value || '').trim();
      var nf = {};
      content.querySelectorAll('[data-ff]').forEach(function (s) {
        if (s.value !== '') nf[s.getAttribute('data-ff')] = s.value;
      });
      state.listFilters[name] = nf;
      goToPage(key, 1);
      viewList(name);
    }
    var form = document.getElementById('listFilter');
    if (form) form.onsubmit = function (e) { e.preventDefault(); applyQuery(); };
    // Live search — results follow the typing; no button or Enter needed.
    var listQ = document.getElementById('listF-q');
    if (listQ) listQ.oninput = debounce(applyQuery, 320);
    // Filters apply the moment they change — no Search click needed.
    content.querySelectorAll('[data-ff]').forEach(function (s) { s.onchange = applyQuery; });
    var clear = document.getElementById('listClear');
    if (clear) clear.onclick = function () {
      state.listQuery[name] = '';
      state.listFilters[name] = {};
      goToPage(key, 1);
      viewList(name);
    };
    wirePager(content, key, function () { viewList(name); });
    enhanceLongSelects(content);
    fitFilterWidths(content);
    attachTableBehaviours(content, meta, items, function () { viewList(name); });
    restoreFocus(content, focusSnap);
  }

  /* ------------------------------------------------- student management
     The CSAP scholar masterlist with its own section: server-side search
     (name, student number, CSR…), dropdown filters for the fields the API
     marks as `filter`, and real paging so the whole masterlist stays fast. */

  function viewStudents() {
    var st = state.students;
    if (!st) st = state.students = { q: '', filters: {} };
    var page = pageOf('students');
    var params = { name: 'students', limit: LIST_PAGE_SIZE, offset: (page - 1) * LIST_PAGE_SIZE };
    if (st.q) params.q = st.q;
    Object.keys(st.filters).forEach(function (k) { if (st.filters[k]) params['f_' + k] = st.filters[k]; });
    var seq = fetchSeq('students');
    api('collection', params).then(function (d) {
      if (!isLatest('students', seq)) return;   // a newer search already took over
      state.labels.students = d.meta.label;
      var total = Number(d.total || 0);
      // A search/filter may have left fewer pages than we are on.
      if (!(d.items || []).length && page > 1) { goToPage('students', 1); viewStudents(); return; }
      renderStudentsView(d.meta, d.items || [], total);
    }).catch(function (e) { errorBox(e); });
  }

  function studentChip(meta, key, value) {
    if (value == null || value === '') return '<span class="muted">—</span>';
    var f = (meta.fields || []).filter(function (x) { return x.key === key; })[0];
    var m = (f && f.options ? f.options : []).filter(function (o) { return String(o.value) === String(value); })[0];
    return '<span class="chip yellow">' + esc(m ? m.label : value) + '</span>';
  }

  /* The readable list cells for one student — SHARED by the working list and
     Archive storage so both always show exactly the same columns. */
  function studentCellsHtml(meta, row) {
    var name = esc(row.last_name) + ', ' + esc(row.first_name) + (row.name_ext ? ' ' + esc(row.name_ext) : '');
    var enr = String(row.enrollment_status || '');
    var enrCls = enr === 'Enrolled' ? '' : (enr === 'Dropped' || enr === 'Transferred' ? ' danger' : ' yellow');
    return '<td><b>' + name + '</b></td>'
      + '<td>' + esc(row.student_no || '—') + '</td>'
      + '<td>' + studentChip(meta, 'program', row.program) + '</td>'
      + '<td>' + esc(row.year_level || '—') + '</td>'
      + '<td>' + esc(row.school_year || '—') + '</td>'
      + '<td>' + studentChip(meta, 'scholarship_type', row.scholarship_type) + '</td>'
      + '<td>' + (enr ? '<span class="chip' + enrCls + '">' + esc(enr) + '</span>' : '<span class="muted">—</span>') + '</td>';
  }

  function studentsTableHtml(meta, items) {
    var html = '<div class="table-wrap"><table class="tbl" data-coll="students"><thead><tr>'
      + '<th class="idx"><input type="checkbox" class="rowcheck" data-check-all title="Select all" /></th>'
      + '<th>Student</th><th>Student no.</th><th>Program</th><th>Year level</th><th>School year</th>'
      + '<th>Scholarship</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead><tbody>';
    if (!items.length) {
      var st = state.students || {};
      var filtered = st.q || Object.keys(st.filters || {}).length;
      html += '<tr><td colspan="9"><div class="empty">'
        + (filtered ? 'No students match your search or filters.'
                    : 'No students yet. Use “Add student” to create the first record.')
        + '</div></td></tr>';
    }
    items.forEach(function (row) {
      html += '<tr data-row="' + row.id + '"><td><input type="checkbox" class="rowcheck" data-check="' + row.id + '" title="Select record" /></td>'
        + studentCellsHtml(meta, row)
        + '<td><div class="actions">'
        + '<button type="button" class="btn btn-outline btn-sm" data-view="' + row.id + '" title="View full details">' + icon('eye') + 'View</button>'
        + '<button type="button" class="btn btn-primary btn-sm" data-edit="' + row.id + '" title="Edit all details">' + icon('save') + 'Edit</button>'
        + '<button type="button" class="btn btn-outline btn-sm" data-archive="' + row.id + '" title="Move to Archive storage">' + icon('archive') + 'Archive</button>'
        + '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderStudentsView(meta, items, total) {
    var st = state.students;
    var content = document.getElementById('content');
    var filterFields = (meta.fields || []).filter(function (f) { return f.filter; });
    var focusSnap = captureFocus(content);
    var typedQ = liveTypedValue(focusSnap, 'stuQ');

    /* Card 1 — the page label sits with the filters it belongs to. */
    var filters = '<form class="filter-grid" id="stuFilter">'
      + searchFieldHtml('stuQ', 'Name, student no., CSR…', typedQ != null ? typedQ : st.q);
    filterFields.forEach(function (f) {
      var fid = 'stu-f-' + esc(f.key);
      filters += '<div class="fg-item"><label for="' + fid + '">' + esc(f.label) + '</label>'
        + '<select class="select" id="' + fid + '" data-stu-f="' + esc(f.key) + '">'
        + '<option value="">All</option>'
        + (f.options || []).map(function (o) {
            return '<option value="' + esc(o.value) + '"'
              + (String(st.filters[f.key] || '') === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
          }).join('')
        + '</select></div>';
    });
    filters += searchButtonsHtml('stuClear') + '</form>';

    /* Card 2 — the scholars list with its Archive + Add student actions. */
    var body = studentsTableHtml(meta, items)
      + pagerHtml('students', total)
      + bulkBarHtml(ARCHIVE_SELECTED);

    content.innerHTML = filterCardHtml('Student Management', total, filters)
      + listCardHtml('Scholars', total, archiveAddActions('students', 'Add student'), body);

    function collectFilters() {
      st.q = ((document.getElementById('stuQ') || {}).value || '').trim();
      st.filters = {};
      content.querySelectorAll('[data-stu-f]').forEach(function (s) {
        if (s.value) st.filters[s.getAttribute('data-stu-f')] = s.value;
      });
      goToPage('students', 1);
    }

    var form = document.getElementById('stuFilter');
    if (form) form.onsubmit = function (e) { e.preventDefault(); collectFilters(); viewStudents(); };
    content.querySelectorAll('[data-stu-f]').forEach(function (s) {
      s.onchange = function () { collectFilters(); viewStudents(); };
    });
    // Live search — the sheet of students follows the typing, no Search click.
    var stuQ = document.getElementById('stuQ');
    if (stuQ) stuQ.oninput = debounce(function () { collectFilters(); viewStudents(); }, 320);
    var clear = document.getElementById('stuClear');
    if (clear) clear.onclick = function () {
      st.q = ''; st.filters = {}; goToPage('students', 1); viewStudents();
    };
    wirePager(content, 'students', function () { viewStudents(); });

    enhanceLongSelects(content);
    fitFilterWidths(content);
    attachTableBehaviours(content, meta, items, function () { viewStudents(); });
    restoreFocus(content, focusSnap);
  }

  /* ------------------------------------------------------ archive storage
     Every list's archived records live here: data-based filters, restore
     (one / selected / all) and permanent delete. */
  function archiveBackUrl(name) {
    if (name === 'users') return '#/users';
    if (name === 'students') return '#/students';
    if (name === 'officer_options') return '#/options/school_year';
    var owner = (typeof ownerPageOf === 'function') ? ownerPageOf(name) : null;
    if (owner) return '#/page/' + owner;
    return '#/list/' + name;
  }

  /* Server-side search + filters of one Archive-storage list. */
  function archiveQuery(key) {
    var aq = state.archives[key];
    if (!aq) aq = state.archives[key] = { q: '', filters: {} };
    return aq;
  }

  /* Archive storage is paged like every other list, so a big archive (a whole
     archived masterlist, for example) never loads in one go. */
  function viewArchive(name) {
    var isUsers = name === 'users';
    var key = 'archive:' + name;
    var page = pageOf(key);
    var aq = archiveQuery(key);
    var params = { archived: '1', limit: LIST_PAGE_SIZE, offset: (page - 1) * LIST_PAGE_SIZE };
    if (!isUsers) params.name = name;
    if (aq.q) params.q = aq.q;
    if (!isUsers) {
      Object.keys(aq.filters).forEach(function (k) { if (aq.filters[k]) params['f_' + k] = aq.filters[k]; });
    }
    var seq = fetchSeq(key);
    api(isUsers ? 'users' : 'collection', params).then(function (d) {
      if (!isLatest(key, seq)) return;   // a newer search already took over
      var total = Number(d.total || 0);
      if (!(d.items || []).length && page > 1) { goToPage(key, 1); viewArchive(name); return; }
      if (!isUsers && d.meta) state.labels[name] = d.meta.label;
      renderArchiveView(name, isUsers ? usersArchiveMeta() : d.meta, d.items || [], isUsers, total);
    }).catch(function (e) { errorBox(e); });
  }

  /* Compact column set for the archived Admin Users list. */
  function usersArchiveMeta() {
    return {
      key: 'users', label: 'Admin Users', title: 'username',
      fields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'username', label: 'Username', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'role', label: 'Role', type: 'select', options: [
          { value: 'superadmin', label: 'superadmin' }, { value: 'editor', label: 'editor' }
        ] }
      ]
    };
  }

  function archDate(v) {
    return esc(String(v || '').replace('T', ' ').slice(0, 16) || '—');
  }

  /* Generic archive table: the collection's fields + Archived + actions. */
  function archiveTableHtml(meta, items) {
    var fields = meta.fields || [];
    var html = '<div class="table-wrap"><table class="tbl" id="archTable"><thead><tr>'
      + '<th class="idx"><input type="checkbox" class="rowcheck" data-check-all title="Select all" /></th>';
    fields.forEach(function (f) { html += '<th>' + esc(f.label) + '</th>'; });
    html += '<th>Archived</th><th style="text-align:right">Actions</th></tr></thead><tbody>';
    if (!items.length) {
      html += '<tr><td colspan="' + (fields.length + 3) + '"><div class="empty">Archive storage is empty.</div></td></tr>';
    }
    items.forEach(function (row) {
      html += '<tr data-row="' + row.id + '"><td><input type="checkbox" class="rowcheck" data-check="' + row.id + '" title="Select record" /></td>';
      fields.forEach(function (f) {
        var cell;
        if (f.type === 'select' && f.options) {
          var m = f.options.filter(function (o) { return String(o.value) === String(row[f.key]); })[0];
          cell = '<span class="chip yellow">' + esc(m ? m.label : (row[f.key] || '—')) + '</span>';
        } else {
          var v = row[f.key];
          cell = esc(v == null || v === '' ? '—' : v);
        }
        html += '<td>' + cell + '</td>';
      });
      html += '<td class="muted t-10">' + archDate(row.archived_at) + '</td>'
        + '<td><div class="actions">' + archiveRowActions(row.id) + '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }
  function archiveRowActions(id) {
    return '<button type="button" class="btn btn-primary btn-sm" data-arch-restore="' + id + '" title="Bring back to the list">' + icon('restore') + 'Restore</button>'
      + '<button type="button" class="btn btn-danger btn-sm" data-arch-purge="' + id + '" title="Erase permanently">' + icon('trash') + 'Delete forever</button>';
  }
  /* Students keep their readable list columns in Archive storage too (the same
     cells as the working list) — the full profile is one "View" away. */
  function studentsArchiveTableHtml(meta, items) {
    var html = '<div class="table-wrap"><table class="tbl" data-coll="students" id="archTable"><thead><tr>'
      + '<th class="idx"><input type="checkbox" class="rowcheck" data-check-all title="Select all" /></th>'
      + '<th>Student</th><th>Student no.</th><th>Program</th><th>Year level</th><th>School year</th>'
      + '<th>Scholarship</th><th>Status</th><th>Archived</th><th style="text-align:right">Actions</th></tr></thead><tbody>';
    if (!items.length) {
      html += '<tr><td colspan="10"><div class="empty">Archive storage is empty.</div></td></tr>';
    }
    items.forEach(function (row) {
      html += '<tr data-row="' + row.id + '"><td><input type="checkbox" class="rowcheck" data-check="' + row.id + '" title="Select record" /></td>'
        + studentCellsHtml(meta, row)
        + '<td class="muted t-10">' + archDate(row.archived_at) + '</td>'
        + '<td><div class="actions">' + archiveRowActions(row.id) + '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderArchiveView(name, meta, items, isUsers, total) {
    var content = document.getElementById('content');
    var label = (meta && meta.label) || collLabel(name);
    var back = archiveBackUrl(name);
    var key = 'archive:' + name;
    var aq = archiveQuery(key);
    var fields = meta.fields || [];
    var focusSnap = captureFocus(content);
    var typedQ = liveTypedValue(focusSnap, 'archQ');
    // Data-based filters: one dropdown per flagged select field (Students),
    // otherwise one per select field of the collection.
    var selFields = isUsers ? [] : fields.filter(function (f) {
      return (f.type === 'select') && f.options && f.options.length;
    });
    if (!isUsers) {
      var flagged = selFields.filter(function (f) { return f.filter; });
      if (flagged.length) selFields = flagged;
    }

    /* Card 1 — "Archive · <label>" sits with its search + dropdown filters. */
    var filters = '<form class="filter-grid" id="archFilter">'
      + searchFieldHtml('archQ', 'Search the archived records…', typedQ != null ? typedQ : aq.q);
    selFields.forEach(function (f) {
      var fid = 'arch-f-' + esc(f.key);
      filters += '<div class="fg-item"><label for="' + fid + '">' + esc(f.label) + '</label>'
        + '<select class="select" id="' + fid + '" data-arch-f="' + esc(f.key) + '">'
        + '<option value="">All</option>'
        + f.options.map(function (o) {
            return '<option value="' + esc(o.value) + '"'
              + (String(aq.filters[f.key] || '') === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
          }).join('')
        + '</select></div>';
    });
    filters += searchButtonsHtml('archClear') + '</form>';

    /* Card 2 — the archived rows. "Restore all" and the selection actions
       (Restore selected / Delete forever selected) live WITH the rows inside
       the list, in the toolbar above the table. The two selection buttons stay
       hidden until at least one row is ticked. */
    var table = (!isUsers && name === 'students') ? studentsArchiveTableHtml(meta, items) : archiveTableHtml(meta, items);
    var toolbar = total
      ? '<div class="list-toolbar" data-arch-toolbar>'
        + '<span class="muted t-10">' + total + ' archived record' + (total === 1 ? '' : 's') + ' in this view</span>'
        + '<span class="spacer"></span>'
        + '<button type="button" class="btn btn-primary btn-sm" data-bulk data-bulk-restore hidden>'
        + icon('restore') + 'Restore selected</button>'
        + '<button type="button" class="btn btn-danger btn-sm" data-bulk data-bulk-purge hidden>'
        + icon('trash') + 'Delete forever selected</button>'
        + '<button type="button" class="btn btn-primary btn-sm" id="archRestoreAll">' + icon('restore') + 'Restore all</button>'
        + '</div>'
      : '';
    var body = toolbar + table + pagerHtml(key, total);

    /* The Back button sits inside the list card itself (top-right, where the
       Archive-storage link sits on every other list) — not up in the filter card. */
    content.innerHTML = filterCardHtml('Archive · ' + label, total, filters)
      + listCardHtml('Archived records', total,
          '<a class="btn btn-ghost btn-sm" href="' + back + '">' + icon('back') + 'Back</a>', body);

    /* Filters are server-side here, so every change re-reads the list. */
    function applyFilters() {
      aq.q = ((document.getElementById('archQ') || {}).value || '').trim();
      aq.filters = {};
      content.querySelectorAll('[data-arch-f]').forEach(function (s) {
        if (s.value) aq.filters[s.getAttribute('data-arch-f')] = s.value;
      });
      goToPage(key, 1);
      viewArchive(name);
    }
    var aform = document.getElementById('archFilter');
    if (aform) aform.onsubmit = function (e) { e.preventDefault(); applyFilters(); };
    content.querySelectorAll('[data-arch-f]').forEach(function (s) { s.onchange = applyFilters; });
    // Live search — archived results follow the typing, no Search click.
    var archQ = document.getElementById('archQ');
    if (archQ) archQ.oninput = debounce(applyFilters, 320);
    var aclear = document.getElementById('archClear');
    if (aclear) aclear.onclick = function () {
      aq.q = ''; aq.filters = {}; goToPage(key, 1); viewArchive(name);
    };
    wirePager(content, key, function () { viewArchive(name); });
    enhanceLongSelects(content);
    fitFilterWidths(content);

    var refreshArchSel = wireSelection(content, function () {});

    function apiRes() { return isUsers ? 'users' : 'collection'; }
    function reload() { viewArchive(name); }

    /* Restore explicit ids, or everything matching the current filters. */
    function restoreRecords(body, all) {
      var ids = (body && body.ids) || [];
      var params = { a: 'restore' };
      if (!isUsers) params.name = name;
      if (all) {
        params.all = '1';
        params.archived = '1';
        if (aq.q) params.q = aq.q;
        selFields.forEach(function (f) { if (aq.filters[f.key]) params['f_' + f.key] = aq.filters[f.key]; });
      }
      return api(apiRes(), params, { method: 'POST', body: body })
        .then(function (r) {
          var skipped = isUsers ? (r.skipped || []).map(function (s) { return '#' + s.id + ' (' + s.reason + ')'; }) : [];
          var count = all ? Number(r.count || (r.ids || []).length) : ids.length;
          toast('Restored', (all ? 'All matching ' : '') + count + ' record(s) restored.'
            + (skipped.length ? ' Skipped: ' + skipped.join('; ') : ''), skipped.length ? true : false);
          reload();
        })
        .catch(function (e) { toast('Restore failed', e.message, true); });
    }
    function purgeIds(ids, what) {
      var chain = Promise.resolve();
      ids.forEach(function (id) {
        chain = chain.then(function () {
          var p = isUsers ? { id: id, purge: '1' } : { name: name, id: id, purge: '1' };
          return api(apiRes(), p, { method: 'DELETE' }).catch(function () { return null; });
        });
      });
      chain.then(function () { toast('Deleted', what + ' permanently erased.'); reload(); });
    }

    content.querySelectorAll('[data-arch-restore]').forEach(function (btn) {
      btn.onclick = function () { restoreRecords({ ids: [btn.getAttribute('data-arch-restore')] }, false); };
    });
    content.querySelectorAll('[data-arch-purge]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-arch-purge');
        confirmDialog('Delete forever?', 'This permanently erases the record. It cannot be restored.', 'Delete')
          .then(function (ok) { if (ok) purgeIds([id], 'Record'); });
      };
    });
    var br = content.querySelector('[data-bulk-restore]');
    if (br) br.onclick = function () {
      var ids = refreshArchSel();
      if (ids.length) restoreRecords({ ids: ids }, false);
    };
    var bp = content.querySelector('[data-bulk-purge]');
    if (bp) bp.onclick = function () {
      var ids = refreshArchSel();
      if (!ids.length) return;
      confirmDialog('Delete forever?', 'This permanently erases ' + ids.length + ' record(s). They cannot be restored.', 'Delete')
        .then(function (ok) { if (ok) purgeIds(ids, ids.length + ' record(s)'); });
    };
    var ra = document.getElementById('archRestoreAll');
    if (ra) ra.onclick = function () {
      if (!total) { toast('Nothing to restore', 'Archive storage is empty.'); return; }
      var filtered = aq.q || Object.keys(aq.filters).length;
      confirmDialog('Restore all?', 'Bring ' + (filtered ? 'every archived record matching the filters' : 'all ' + total + ' archived record(s)')
        + ' back to the list?', 'Restore all')
        .then(function (ok) { if (ok) restoreRecords({ all: 1 }, true); });
    };
    restoreFocus(content, focusSnap);
  }

  /* ------------------------------------------------------ option management
     Manages the dropdown values for the Officers form (officer_options table),
     one list per school year. `field` is one of the option field keys. */
  function viewOptions(field) {
    var isYear = field === 'school_year';
    var info = OPTION_FIELDS[field] || { label: optionsFieldLabel(field), hint: '' };
    api('collection', { name: 'officer_options' }).then(function (d) {
      var items = d.items || [];
      var rows = items.filter(function (r) { return r.field_key === field; });
      var years = [];
      items.forEach(function (r) {
        if (r.field_key === 'school_year' && r.value && years.indexOf(r.value) < 0) years.push(r.value);
      });
      years.sort();
      years.reverse();
      if (!state.optYear || years.indexOf(state.optYear) < 0) state.optYear = years[0] || currentSchoolYear();
      renderOptionsView(field, info, rows, years, isYear);
    }).catch(function (e) { errorBox(e); });
  }

  function renderOptionsView(field, info, rows, years, isYear) {
    var content = document.getElementById('content');
    var valueLabel = optionsValueLabel(field);
    var officersLink = '<a class="btn btn-outline btn-sm" href="#/page/officers">' + icon('users') + 'Officers form</a>';

    if (!isYear && !years.length) {
      content.innerHTML = filterCardHtml(info.label, 0,
        '<div class="empty">Add a School Year first, then come back to manage this list.</div>'
        + '<div class="form-actions"><span class="spacer"></span>'
        + '<a class="btn btn-primary btn-sm" href="#/options/school_year">' + icon('plus') + 'Manage School Years</a></div>',
        officersLink);
      return;
    }

    var scoped = isYear ? rows.slice() : rows.filter(function (r) { return r.school_year === state.optYear; });
    scoped.sort(function (a, b) { return String(a.value).localeCompare(String(b.value)); });

    /* Card 1 — the page label with the school-year selector and the list filter. */
    var filters = '<div class="filter-grid">'
      + (isYear ? ''
          : '<div class="fg-item"><label for="optYearSel">School Year</label>'
            + '<select class="select" id="optYearSel">'
            + years.map(function (y) {
                return '<option value="' + esc(y) + '"' + (y === state.optYear ? ' selected' : '') + '>S.Y. ' + esc(y) + '</option>';
              }).join('')
            + '</select></div>')
      + '<div class="fg-item"><label for="optFilter">Filter</label>'
      + '<input class="input" id="optFilter" placeholder="Type to filter this list&hellip;" /></div>'
      + '<div class="fg-foot"><span class="muted t-10">'
      + (isYear ? 'These school years are the ones offered by the Officers form.'
                : 'The ' + esc(valueLabel.toLowerCase()) + ' list applies only to the selected school year.')
      + '</span></div></div>';
    var html = filterCardHtml(info.label, scoped.length, filters, officersLink);

    var table = '<div class="table-wrap"><table class="tbl" id="optTable"><thead><tr>'
      + '<th class="idx"><input type="checkbox" class="rowcheck" data-check-all title="Select all" /></th>'
      + (isYear ? '' : '<th>School year</th>') + '<th>' + esc(valueLabel) + '</th><th style="text-align:right">Actions</th></tr></thead><tbody>';
    if (!scoped.length) {
      // A new school year starts empty — the old year's list is still saved.
      // Offer a one-click copy so nothing ever looks "disappeared".
      var emptyMsg = 'No ' + esc(valueLabel.toLowerCase()) + ' options yet. Use “Add” to create the first one.';
      var copyBtnHtml = '';
      if (!isYear) {
        var srcYear = null;
        for (var yi = 0; yi < years.length; yi++) {
          var y = years[yi];
          if (y === state.optYear) continue;
          var has = rows.some(function (r) { return r.school_year === y; });
          if (has) { srcYear = y; break; }
        }
        if (srcYear) {
          emptyMsg = 'No ' + esc(valueLabel.toLowerCase()) + ' options for S.Y. ' + esc(state.optYear)
            + ' yet. Your S.Y. ' + esc(srcYear) + ' list is still saved — switch the School Year above to see it,'
            + ' or copy it over:';
          copyBtnHtml = '<div style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-copy-year="'
            + esc(srcYear) + '">' + icon('plus') + 'Copy from S.Y. ' + esc(srcYear) + '</button></div>';
        }
      }
      table += '<tr><td colspan="' + (isYear ? 3 : 4) + '"><div class="empty">' + emptyMsg + copyBtnHtml + '</div></td></tr>';
    }
    scoped.forEach(function (r, i) {
      table += '<tr><td><input type="checkbox" class="rowcheck" data-check="' + esc(r.id) + '" title="Select option" /></td>'
        + (isYear ? '' : '<td>' + esc(r.school_year) + '</td>')
        + '<td>' + esc(r.value) + '</td>'
        + '<td><div class="actions">'
        + '<button type="button" class="btn btn-primary btn-sm" data-opt-edit="' + esc(r.id) + '">' + icon('save') + 'Edit</button>'
        + '<button type="button" class="btn btn-outline btn-sm" data-opt-archive="' + esc(r.id) + '" title="Move to Archive storage">' + icon('archive') + 'Archive</button>'
        + '</div></td></tr>';
    });
    table += '</tbody></table></div>';

    /* Card 2 — the option values with their Archive + Add actions. */
    html += listCardHtml('Options', scoped.length,
      '<a class="btn btn-outline btn-sm" href="#/archive/officer_options" title="Open Archive storage">' + icon('archive') + 'Archive</a>'
      + '<button type="button" class="btn btn-accent btn-sm" id="optAdd">' + icon('plus') + 'Add</button>',
      table + bulkBarHtml(ARCHIVE_SELECTED));
    content.innerHTML = html;
    fitFilterWidths(content);

    var sel = document.getElementById('optYearSel');
    if (sel) sel.onchange = function () { state.optYear = sel.value; renderOptionsView(field, info, rows, years, isYear); };

    var filter = document.getElementById('optFilter');
    if (filter) filter.oninput = function () {
      var q = filter.value.toLowerCase();
      content.querySelectorAll('#optTable tbody tr').forEach(function (tr) {
        tr.style.display = tr.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
      refreshOptSel();
    };

    /* Year dropdowns: every year from 2000 up to a few years past the current
       one, generated automatically so the list never goes stale. */
    var thisYear = new Date().getFullYear();
    var yearOpts = [];
    for (var yy = 2000; yy <= thisYear + 5; yy++) {
      yearOpts.push({ value: String(yy), label: String(yy) });
    }
    var meta = isYear
      ? { key: 'officer_options', label: info.label, title: 'value', fields: [
          { key: 'year_from', label: 'From (year)', type: 'select', required: true, options: yearOpts,
            default: String(thisYear),
            hint: 'Pick the From and To years — saved together as “FROM–TO”, e.g. 2025-2026.' },
          { key: 'year_to', label: 'To (year)', type: 'select', required: true, options: yearOpts,
            default: String(thisYear + 1) }
        ]}
      : { key: 'officer_options', label: info.label, title: 'value', fields: [
          { key: 'value', label: valueLabel, type: 'text', required: true }
        ]};

    function makePayload(payload) {
      payload.field_key = field;
      if (!isYear) payload.school_year = state.optYear;
      else if (!payload.school_year) payload.school_year = payload.value;
      return payload;
    }
    /* School Years are entered as From/To and stored as "2025-2026". */
    function combineYears(payload) {
      var f = parseInt(payload.year_from, 10);
      var t = parseInt(payload.year_to, 10);
      if (isNaN(f) || isNaN(t)) {
        toast('Incomplete', 'Please enter both the From and To years.', true);
        return false;
      }
      if (t <= f) {
        toast('Invalid range', 'The To year must be after the From year.', true);
        return false;
      }
      payload.value = f + '-' + t;
      payload.school_year = payload.value;
      delete payload.year_from;
      delete payload.year_to;
      return true;
    }
    // Empty input is never saved: the required attribute blocks the submit in
    // the browser, and this guard is the backstop (silent so the modal only
    // shows our single toast, not the generic failure one).
    function checkValue(payload) {
      var v = String(payload.value || '').trim();
      if (!v) {
        toast('Cannot add', 'Please type a ' + valueLabel.toLowerCase() + ' first.', true);
        return false;
      }
      payload.value = v;
      return true;
    }
    function isDuplicate(payload, excludeId) {
      var v = String(payload.value || '').trim().toLowerCase();
      if (!v) return false;
      return rows.some(function (r) {
        if (excludeId && String(r.id) === String(excludeId)) return false;
        if (!isYear && r.school_year !== payload.school_year) return false;
        return String(r.value || '').trim().toLowerCase() === v;
      });
    }

    var addBtn = document.getElementById('optAdd');
    if (addBtn) addBtn.onclick = function () {
      openCreateModal(meta, function (payload) {
        if (isYear && !combineYears(payload)) return Promise.reject(new Error('__silent__'));
        makePayload(payload);
        if (!checkValue(payload)) return Promise.reject(new Error('__silent__'));
        if (isDuplicate(payload, null)) {
          toast('Already exists', '"' + payload.value + '" is already in this list.', true);
          return Promise.reject(new Error('__silent__'));
        }
        return api('collection', { name: 'officer_options' }, { method: 'POST', body: payload })
          .then(function (r) { viewOptions(field); return r; });
      });
    };

    content.querySelectorAll('[data-opt-edit]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-opt-edit');
        var item = scoped.filter(function (r) { return String(r.id) === String(id); })[0];
        if (!item) return;
        // Pre-split "2025-2026" into the From/To inputs on the edit form.
        var editItem = item;
        if (isYear) {
          var parts = String(item.value || '').split('-');
          editItem = { value: item.value, year_from: parts[0] || '', year_to: parts[1] || '' };
        }
        openEditModal(meta, editItem, function (payload) {
          if (isYear && !combineYears(payload)) return Promise.reject(new Error('__silent__'));
          makePayload(payload);
          if (!checkValue(payload)) return Promise.reject(new Error('__silent__'));
          if (isDuplicate(payload, id)) {
            toast('Already exists', '"' + payload.value + '" is already in this list.', true);
            return Promise.reject(new Error('__silent__'));
          }
          return api('collection', { name: 'officer_options', id: id }, { method: 'PUT', body: payload })
            .then(function (r) { viewOptions(field); return r; });
        });
      };
    });

    content.querySelectorAll('[data-opt-archive]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-opt-archive');
        confirmDialog('Archive option?', 'It moves to Archive storage. Officers already using it keep their saved value.', 'Archive')
          .then(function (ok) {
            if (!ok) return;
            api('collection', { name: 'officer_options', id: id }, { method: 'DELETE' })
              .then(function () { toast('Archived', ''); viewOptions(field); })
              .catch(function (e) { toast('Archive failed', e.message, true); });
          });
      };
    });

    var refreshOptSel = wireSelection(content, function (ids) {
      api('collection', { name: 'officer_options', a: 'archive' }, { method: 'POST', body: { ids: ids } })
        .then(function (r) { toast('Archived', (r.count || ids.length) + ' option(s) moved to Archive storage.'); viewOptions(field); })
        .catch(function (e) { toast('Archive failed', e.message, true); });
    });

    /* Carry the previous year's list into a new empty school year. */
    var copyBtn = content.querySelector('[data-copy-year]');
    if (copyBtn) copyBtn.onclick = function () {
      var sy = copyBtn.getAttribute('data-copy-year');
      var srcRows = rows.filter(function (r) { return r.school_year === sy; });
      if (!srcRows.length) return;
      confirmDialog('Copy options?',
          'Copy ' + srcRows.length + ' ' + valueLabel.toLowerCase() + ' option(s) from S.Y. ' + sy + ' to S.Y. ' + state.optYear + '?',
          'Copy')
        .then(function (ok) {
          if (!ok) return;
          var chain = Promise.resolve();
          srcRows.forEach(function (r) {
            chain = chain.then(function () {
              return api('collection', { name: 'officer_options' }, {
                method: 'POST',
                body: { field_key: field, school_year: state.optYear, value: r.value }
              }).catch(function () { return null; }); // already copied → skip
            });
          });
          chain.then(function () {
            toast('Copied', valueLabel + ' options copied to S.Y. ' + state.optYear + '.');
            viewOptions(field);
          });
        });
    };
  }

  /* -------------------------------------------------------------- form view */
  /* Students live in their own section; every other list sits under #/list/. */
  function formBaseUrl(name) {
    return name === 'students' ? '#/students' : '#/list/' + name;
  }

  function viewForm(name, id) {
    // Adding: only the field definitions are needed — meta-only avoids pulling
    // the whole collection (Student Management holds thousands of rows).
    var req = api('collection', id ? { name: name, id: id } : { name: name, meta: 1 });
    req.then(function (d) {
      state.labels[name] = d.meta.label;
      var item = d.item || {};
      var title = (id ? 'Edit' : 'Add') + ' &middot; ' + d.meta.label;
      mountShell(d.meta.label);
      var html = '<div class="page-head"><a class="btn btn-ghost btn-sm" href="' + formBaseUrl(name) + '">' + icon('back') + 'Back</a>'
        + '<div><h2>' + esc(title.replace(/&middot;/g, '·')) + '</h2></div></div>';
      html += '<form id="itemForm"><div class="card"><div class="form-grid">';
      // AUTO ORDER on the standalone Add page too: hide Order when creating.
      var formFields = (!id) ? d.meta.fields.filter(function (ff) { return ff.key !== 'sort_order'; }) : d.meta.fields;
      formFields.forEach(function (f) {
        var v = item[f.key];
        if (!id && (v == null || v === '')) v = defaultFieldValue(f, name);
        html += renderField('', f, v);
      });
      html += '</div><div class="form-actions">'
        + (id ? '<button type="button" class="btn btn-danger btn-sm" id="delItem">' + icon('trash') + 'Delete</button>' : '')
        + '<span class="spacer"></span>'
        + '<a class="btn btn-outline btn-sm" href="' + formBaseUrl(name) + '">Cancel</a>'
        + '<button class="btn ' + (id ? 'btn-primary' : 'btn-accent') + ' btn-sm" type="submit">' + icon('save') + (id ? 'Save changes' : 'Create') + '</button>'
        + '</div></div></form>';
      document.getElementById('content').innerHTML = html;

      var form = document.getElementById('itemForm');
      attachFieldBehaviours(form);
      stepify(form);
      bindOfficerOptionSelects(form, d.meta);
      form.onsubmit = function (e) {
        e.preventDefault();
        var fd = formDataOf(form);
        var payload = formPayload(d.meta.fields, fd, item);
        var btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        api('collection', id ? { name: name, id: id } : { name: name },
            { method: id ? 'PUT' : 'POST', body: payload })
          .then(function () {
            if (id) { toast('Saved', d.meta.label); window.location.hash = formBaseUrl(name); }
            else { toast('Created', d.meta.label + ' — ready for the next one.'); viewForm(name, null); }
          })
          .catch(function (err) { toast('Save failed', err.message, true); btn.disabled = false; });
      };
      var del = document.getElementById('delItem');
      if (del) del.onclick = function () {
        confirmDialog('Delete record?', 'This will permanently remove the entry.', 'Delete').then(function (ok) {
          if (!ok) return;
          api('collection', { name: name, id: id }, { method: 'DELETE' })
            .then(function () { toast('Deleted', ''); window.location.hash = formBaseUrl(name); });
        });
      };
    }).catch(function (e) { errorBox(e); });
  }

  /* ---------------------------------------------------------------- settings */
  function viewSettings() {
    api('settings').then(function (d) {
    var html = '<div class="page-head"><div><h2>Site Settings</h2></div>'
      + '<div class="spacer"></div>'
      + '<a class="btn btn-outline btn-sm" href="../index.html" target="_blank">' + icon('eye') + 'View site</a>'
      + '<button type="button" class="btn btn-accent btn-sm" id="pvOpen" aria-pressed="false">' + icon('eye') + 'Live preview</button></div>';
      html += '<form id="setForm">';
      Object.keys(d.groups).forEach(function (g) {
        html += '<div class="card"><div class="fieldset-title">' + esc(g) + '</div><div class="form-grid">';
        d.groups[g].forEach(function (s) {
          html += renderField('', { key: s.key, label: s.label, type: s.type }, s.value);
        });
        html += '</div></div>';
      });
      html += '<div class="form-actions"><span class="muted t-10">Colours stay in sync with the public site palette.</span>'
        + '<span class="spacer"></span><button class="btn btn-primary btn-sm" type="submit">' + icon('save') + 'Save settings</button></div></form>';
      document.getElementById('content').innerHTML = html;

      var form = document.getElementById('setForm');
      attachFieldBehaviours(form);
      stepify(form);
      wirePreviewForm(form, previewCtxForSettings('Site Settings'));
      previewSyncButton();
      var pvBtn = document.getElementById('pvOpen');
      if (pvBtn) pvBtn.onclick = function () { togglePreview(); };
      form.onsubmit = function (e) {
        e.preventDefault();
        var fd = formDataOf(form);
        var payload = {};
        Object.keys(d.groups).forEach(function (g) {
          d.groups[g].forEach(function (s) { payload[s.key] = fd.get(s.key) || ''; });
        });
        var btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        api('settings', {}, { method: 'POST', body: { settings: payload } })
          .then(function () { toast('Saved', 'Site settings updated.'); })
          .catch(function (err) { toast('Save failed', err.message, true); })
          .then(function () { btn.disabled = false; });
      };
    }).catch(function (e) { errorBox(e); });
  }

  /* ----------------------------------------------------------------- profile */
  function viewProfile() {
    api('profile').then(function (d) {
      var a = d.admin;
      var html = '<div class="page-head"><div><h2>Admin Profile</h2></div></div>';
      html += '<div class="split"><form id="profForm">'
        + '<div class="card"><div class="fieldset-title">Profile details</div><div class="form-grid">'
        + renderField('', { key: 'name', label: 'Full name', type: 'text', required: true }, a.name)
        + renderField('', { key: 'email', label: 'Email address', type: 'text', required: true }, a.email)
        + renderField('', { key: 'phone', label: 'Phone', type: 'text' }, a.phone)
        + renderField('', { key: 'avatar', label: 'Avatar image', type: 'image' }, a.avatar)
        + renderField('', { key: 'bio', label: 'Short bio', type: 'textarea' }, a.bio)
        + '</div></div>'
        + '<div class="card"><div class="fieldset-title">Change password</div><div class="form-grid">'
        + renderField('', { key: 'current_password', label: 'Current password', type: 'text' }, '')
        + renderField('', { key: 'password', label: 'New password', type: 'text', hint: 'Leave blank to keep the current password.' }, '')
        + renderField('', { key: 'password_confirm', label: 'Confirm new password', type: 'text', hint: 'Re-type the new password.' }, '')
        + '</div></div>'
        + '<div class="form-actions"><span class="spacer"></span>'
        + '<button class="btn btn-primary btn-sm" type="submit">' + icon('save') + 'Save profile</button></div></form>';

      html += '<div class="card"><div class="fieldset-title">Account</div>'
        + '<div class="kv"><span>Username</span><b>' + esc(a.username) + '</b></div>'
        + '<div class="kv"><span>Role</span><b>' + esc(a.role) + '</b></div>'
        + '<div class="kv"><span>Last sign-in</span><b>' + esc(a.last_login || '—') + '</b></div>'
        + '<div class="kv"><span>Member since</span><b>' + esc((a.created_at || '').slice(0, 10)) + '</b></div>'
        + '</div></div>';

      document.getElementById('content').innerHTML = html;
      var form = document.getElementById('profForm');
      attachFieldBehaviours(form);
      // password inputs should be masked
      ['current_password', 'password', 'password_confirm'].forEach(function (n) {
        var i = document.getElementById(n); if (i) i.type = 'password';
      });
      stepify(form);
      form.onsubmit = function (e) {
        e.preventDefault();
        var fd = formDataOf(form);
        var pw = fd.get('password') || '';
        var pwConfirm = fd.get('password_confirm') || '';
        if (pw || pwConfirm) {
          if (pw !== pwConfirm) { toast('Passwords do not match', 'Re-type the new password and try again.', true); return; }
          if (pw.length > 0 && pw.length < 6) { toast('Password too short', 'Use at least 6 characters.', true); return; }
        }
        var payload = {
          name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'),
          bio: fd.get('bio'), avatar: fd.get('avatar'),
          current_password: fd.get('current_password'), password: pw, password_confirm: pwConfirm
        };
        var btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        api('profile', {}, { method: 'POST', body: payload })
          .then(function (r) {
            state.admin = r.admin;
            toast('Saved', 'Your profile has been updated.');
            mountShell('Admin Profile');
            viewProfile();
          })
          .catch(function (err) { toast('Save failed', err.message, true); btn.disabled = false; });
      };
    }).catch(function (e) { errorBox(e); });
  }

  /* ------------------------------------------------------------------- users */
  function userFields() {
    return [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'text', hint: 'Minimum 6 characters. Leave blank when editing to keep unchanged.' },
      { key: 'password_confirm', label: 'Confirm password', type: 'text', hint: 'Re-type the password.' },
      { key: 'role', label: 'Role', type: 'select', options: [{ value: 'editor', label: 'Editor' }, { value: 'superadmin', label: 'Superadmin' }] },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'avatar', label: 'Avatar', type: 'image' },
      { key: 'bio', label: 'Bio', type: 'textarea' },
      { key: 'is_active', label: 'Active', type: 'checkbox' }
    ];
  }
  function viewUsers() {
    api('users').then(function (d) {
      var content = document.getElementById('content');
      var total = Number(d.total || d.items.length);
      var userMeta = { label: 'Admin User', title: 'username', fields: userFields() };
      /* Card 1 — the page label with filters derived from the accounts on
         screen (role, status) plus a text search. */
      var filters = '<form class="filter-grid" id="userFilter">'
        + filtersHtml(filterFieldsOf(userMeta, d.items || []), {}, 'userF')
        + '<div class="fg-foot"><span class="muted t-10" data-fcount>' + total + ' account' + (total === 1 ? '' : 's') + '</span>'
        + '<span class="spacer"></span>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="userClear">Clear</button></div></form>';
      /* Card 2 — the accounts list with its Archive + Add user actions. */
      var html = filterCardHtml('Admin Users', total, filters)
        + '<div class="card" id="userCard" data-list-card>'
        + '<div class="card-head"><h3>Admin accounts</h3><span class="chip">' + total + '</span>'
        + '<span class="spacer"></span>'
        + '<a class="btn btn-outline btn-sm" href="#/archive/users" title="Open Archive storage">' + icon('archive') + 'Archive</a>'
        + '<button type="button" class="btn btn-accent btn-sm" id="addUser">' + icon('plus') + 'Add user</button></div>'
        + '<div class="table-wrap"><table class="tbl" id="userTable"><thead><tr>'
        + '<th class="idx"><input type="checkbox" class="rowcheck" data-check-all title="Select all" /></th>'
        + '<th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th style="text-align:right">Actions</th>'
        + '</tr></thead><tbody>';
      var meId = state.admin ? String(state.admin.id) : '';
      d.items.forEach(function (u) {
        var isSelf = String(u.id) === meId;
        html += '<tr><td>' + (isSelf ? '' : '<input type="checkbox" class="rowcheck" data-check="' + u.id + '" title="Select user" />') + '</td>'
          + '<td><b>' + esc(u.name) + '</b></td><td>' + esc(u.username) + '</td><td>' + esc(u.email) + '</td>'
          + '<td><span class="chip' + (u.role === 'superadmin' ? ' yellow' : '') + '">' + esc(u.role) + '</span></td>'
          + '<td>' + (Number(u.is_active) ? '<span class="chip">active</span>' : '<span class="chip danger">disabled</span>') + '</td>'
          + '<td>' + esc(u.last_login || '—') + '</td>'
          + '<td><div class="actions">'
          + '<button type="button" class="btn btn-outline btn-sm" data-uview="' + u.id + '" title="View full details">' + icon('eye') + 'View</button>'
          + '<button type="button" class="btn btn-primary btn-sm" data-uedit="' + u.id + '" title="Edit all details">' + icon('save') + 'Edit</button>'
          + (isSelf ? '' : '<button type="button" class="btn btn-outline btn-sm" data-uarchive="' + u.id + '" title="Move to Archive storage">' + icon('archive') + 'Archive</button>')
          + '</div></td></tr>';
      });
      html += '</tbody></table></div>' + bulkBarHtml(ARCHIVE_SELECTED) + '</div>';
      content.innerHTML = html;
      fitFilterWidths(content);
      wireListToggles(content);

      /* Client-side filtering of the accounts table: the derived dropdowns
         plus the text box, applied without a round-trip. */
      var userWrap = content.querySelector('#userTable');
      wireClientFilters(content, userWrap.parentNode, userMeta, d.items || []);
      var userClear = document.getElementById('userClear');
      if (userClear) userClear.onclick = function () {
        var q = content.querySelector('[data-fq]');
        if (q) q.value = '';
        content.querySelectorAll('[data-ff]').forEach(function (s) { s.value = ''; });
        applyRowFilter(userWrap.parentNode, filterFieldsOf(userMeta, d.items || []), {});
      };
      var userMeta = { label: 'Admin User', title: 'username', fields: userFields() };
      var au = document.getElementById('addUser');
      if (au) au.onclick = function () {
        openCreateModal(userMeta, function (payload) {
          if ((payload.password || '') !== (payload.password_confirm || '')) {
            return Promise.reject(new Error('Passwords do not match.'));
          }
          if (!payload.password) { return Promise.reject(new Error('A password is required for new users.')); }
          return api('users', {}, { method: 'POST', body: payload })
            .then(function (r) { viewUsers(); return r; });
        });
      };
      document.querySelectorAll('[data-uview]').forEach(function (btn) {
        btn.onclick = function () {
          api('users', { id: btn.getAttribute('data-uview') })
            .then(function (d) { openDetailModal(userMeta, d.item); })
            .catch(function (e) { errorBox(e); });
        };
      });
      document.querySelectorAll('[data-uedit]').forEach(function (btn) {
        var id = btn.getAttribute('data-uedit');
        btn.onclick = function () {
          api('users', { id: id })
            .then(function (d) {
              openEditModal(userMeta, d.item, function (payload) {
                if ((payload.password || '') !== (payload.password_confirm || '')) {
                  return Promise.reject(new Error('Passwords do not match.'));
                }
                if (!payload.password) { delete payload.password; delete payload.password_confirm; }
                return api('users', { id: id }, { method: 'PUT', body: payload })
                  .then(function (r) { viewUsers(); return r; });
              });
            })
            .catch(function (e) { errorBox(e); });
        };
      });
      document.querySelectorAll('[data-uarchive]').forEach(function (btn) {
        btn.onclick = function () {
          confirmDialog('Archive user?', 'The account is deactivated and moves to Archive storage. It can be restored any time.', 'Archive').then(function (ok) {
            if (!ok) return;
            api('users', { id: btn.getAttribute('data-uarchive') }, { method: 'DELETE' })
              .then(function () { toast('Archived', ''); viewUsers(); })
              .catch(function (e) { toast('Archive failed', e.message, true); });
          });
        };
      });
      wireSelection(document.getElementById('content'), function (ids) {
        api('users', { a: 'archive' }, { method: 'POST', body: { ids: ids } })
          .then(function (r) {
            var skipped = (r.skipped || []).map(function (s) { return '#' + s.id + ' (' + s.reason + ')'; });
            if (skipped.length) toast('Partially archived', (r.ids || []).length + ' archived. Skipped: ' + skipped.join('; '), true);
            else toast('Archived', (r.ids || []).length + ' user(s) moved to Archive storage.');
            viewUsers();
          })
          .catch(function (e) { toast('Archive failed', e.message, true); });
      });
    }).catch(function (e) { errorBox(e); });
  }
  function viewUserForm(id) {
    if (id === 'new') id = null;
    var req = id ? api('users', { id: id }) : Promise.resolve({ item: { is_active: 1, role: 'editor' } });
    // `is_active` is flipped from the list row, never typed into the form.
    var userFieldsList = userFields().map(function (f) {
      return f.key === 'is_active' ? Object.assign({}, f, { list_only: true }) : f;
    });
    req.then(function (d) {
      var u = d.item || {};
      mountShell('Admin Users');
      var html = '<div class="page-head"><a class="btn btn-ghost btn-sm" href="#/users">' + icon('back') + 'Back</a>'
        + '<div><h2>' + (id ? 'Edit user' : 'Add user') + '</h2></div></div>';
      html += '<form id="userForm"><div class="card"><div class="form-grid">';
      userFieldsList.forEach(function (f) { html += renderField('', f, u[f.key]); });
      html += '</div><div class="form-actions"><span class="spacer"></span>'
        + '<a class="btn btn-outline btn-sm" href="#/users">Cancel</a>'
        + '<button class="btn ' + (id ? 'btn-primary' : 'btn-accent') + ' btn-sm" type="submit">' + icon('save') + (id ? 'Save changes' : 'Create user') + '</button>'
        + '</div></div></form>';
      document.getElementById('content').innerHTML = html;
      var form = document.getElementById('userForm');
      attachFieldBehaviours(form);
      ['password', 'password_confirm'].forEach(function (n) {
        var i = document.getElementById(n); if (i) i.type = 'password';
      });
      stepify(form);
      form.onsubmit = function (e) {
        e.preventDefault();
        var fd = formDataOf(form);
        var payload = formPayload(userFieldsList, fd, u);
        if (!id) payload.is_active = 1;
        if ((payload.password || '') !== (payload.password_confirm || '')) {
          toast('Passwords do not match', 'Re-type the password and try again.', true);
          return;
        }
        var btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        api('users', id ? { id: id } : {}, { method: id ? 'PUT' : 'POST', body: payload })
          .then(function () {
            if (id) { toast('Saved', ''); window.location.hash = '#/users'; }
            else { toast('Created', 'Ready for the next user.'); viewUserForm(null); }
          })
          .catch(function (err) { toast('Save failed', err.message, true); btn.disabled = false; });
      };
    }).catch(function (e) { errorBox(e); });
  }

  /* ----------------------------------------------------------------- helpers */
  function errorBox(e) {
    var c = document.getElementById('content');
    var msg = e && e.message ? e.message : 'Something went wrong.';
    if (c) c.innerHTML = '<div class="card"><div class="empty"><b>Unable to load.</b><br>' + esc(msg) + '</div></div>';
    toast('Error', msg, true);
    if (e && (e.status === 401 || e.status === 419)) { state.admin = null; state.csrf = ''; loginScreen(); }
  }

  boot();
})();
