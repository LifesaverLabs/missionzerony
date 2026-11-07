// Google Analytics 4 for MissionZeroNY.org.
// GA itself records page views, traffic sources (where visitors come from),
// engagement time and outbound clicks. This file adds what GA doesn't:
// which sections people reach and how long they stay, scroll depth, and
// which links, buttons, proposals and controls they use.
//
// Privacy choices: no advertising features, no Google Signals, no free text
// from the search box, and no tracking of help-line (tel:) links.
(function () {
  var GA_ID = 'G-4MWNJZX79X';
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  var page = location.pathname;
  function send(name, params) {
    params = params || {};
    params.page_path = page;
    window.gtag('event', name, params);
  }
  function sectionOf(el) {
    var s = el && el.closest && el.closest('section[id], section[aria-labelledby], header, footer');
    if (!s) return '';
    return s.id || s.getAttribute('aria-labelledby') || s.tagName.toLowerCase();
  }
  function label(el) {
    var t = el.getAttribute('aria-label') || el.textContent || '';
    return t.replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  // Clicks on links, buttons and proposal summaries.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a, button, summary');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    if (/^tel:/i.test(href)) return; // never track help-line calls
    var params = { element: el.tagName.toLowerCase(), label: label(el), section: sectionOf(el) };
    if (href) params.link_url = href.slice(0, 200);
    if (el.dataset && el.dataset.p) params.proposal_id = el.dataset.p;
    send('ui_click', params);
  }, true);

  // Opening a proposal, or any other expandable (e.g. a Semmelspan "Read more").
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.tagName !== 'DETAILS' || !d.open) return;
    if (d.classList.contains('pol')) {
      send('proposal_open', { proposal_id: (d.id || '').toUpperCase(), section: sectionOf(d) });
    } else {
      var item = d.closest('li, .tool, .plan') || d;
      var h = item.querySelector('h3');
      send('details_open', { label: label(h || d.querySelector('summary') || d), section: sectionOf(d) });
    }
  }, true);

  // Sliders, radios and checkboxes (fires on release, not while dragging).
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.tagName !== 'INPUT' || !/^(range|radio|checkbox)$/.test(el.type)) return;
    var value = el.type === 'checkbox' ? String(el.checked) : String(el.value).slice(0, 40);
    send('ui_change', { control: el.id || el.name || el.type, value: value, section: sectionOf(el) });
  }, true);

  // Search: record that it was used and how many results showed, not the words typed.
  var searchTimer = 0;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.type !== 'search') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var count = document.getElementById('pbcount');
      send('policy_search', { results: count ? count.textContent.slice(0, 60) : '', has_text: el.value.trim() !== '' });
    }, 2000);
  }, true);

  // Section reach and time spent in each section (visible on screen).
  var visibleSince = {}, seen = {};
  function flush(id) {
    if (!visibleSince[id]) return;
    var ms = Date.now() - visibleSince[id];
    visibleSince[id] = 0;
    if (ms >= 1000) send('section_time', { section: id, seconds: Math.round(ms / 1000) });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var id = en.target.id || en.target.getAttribute('aria-labelledby') || en.target.className || 'section';
        if (en.isIntersecting) {
          if (!seen[id]) { seen[id] = true; send('section_view', { section: id }); }
          if (document.visibilityState === 'visible') visibleSince[id] = Date.now();
        } else {
          flush(id);
        }
      });
    }, { threshold: 0.35 });
    function observe() {
      document.querySelectorAll('main section').forEach(function (s) { io.observe(s); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe); else observe();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') Object.keys(visibleSince).forEach(flush);
  });

  // Scroll depth at 25, 50, 75, 90 and 100 percent.
  var marks = [25, 50, 75, 90, 100], hit = {};
  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max <= 0 ? 100 : (window.scrollY / max) * 100;
    marks.forEach(function (m) {
      if (pct >= m - 0.5 && !hit[m]) { hit[m] = true; send('scroll_depth', { percent: m }); }
    });
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    setTimeout(function () { ticking = false; onScroll(); }, 500);
  }, { passive: true });
})();
