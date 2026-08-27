/* Position Xero — main.js */

// Cloth-warp grid effect — used on the hero AND every dark "grid" section.
(function () {
  // Respect reduced-motion preferences — skip the animation entirely (static
  // CSS grids stay in place as the fallback).
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Geometry / physics (shared)
  const STEPS    = 16;  // polyline segments per line (more = smoother curve)
  const SIGMA    = 200; // px — radius of cloth depression
  const STRENGTH = 90;  // px — max inward pull at dead-centre
  const SPRING   = 0.055;

  // Attach a warping grid to `host`. opts: { canvas?, cell, color }
  function initWarpGrid(host, opts) {
    const CELL  = opts.cell  || 64;
    const color = opts.color || 'rgba(0,0,0,0.055)';

    // Use the supplied canvas (hero) or inject one behind the section content.
    let canvas = opts.canvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'warp-grid';
      canvas.setAttribute('aria-hidden', 'true');
      host.insertBefore(canvas, host.firstChild);
      host.classList.add('has-warp-grid'); // hides the static CSS grid via CSS
    }
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0;
    let rawX = -9999, rawY = -9999;  // actual mouse position (relative to host)
    let smX  = -9999, smY  = -9999;  // spring-eased position
    let velX = 0, velY = 0;

    function resize() { W = canvas.width = host.offsetWidth; H = canvas.height = host.offsetHeight; }

    host.addEventListener('mousemove', e => {
      const r = host.getBoundingClientRect();
      rawX = e.clientX - r.left;
      rawY = e.clientY - r.top;
    });
    host.addEventListener('mouseleave', () => { rawX = -9999; rawY = -9999; });

    // Gaussian pull toward cursor — strongest at centre, zero at infinity.
    function warp(px, py) {
      const dx = px - smX, dy = py - smY, d2 = dx * dx + dy * dy;
      const pull = STRENGTH * Math.exp(-d2 / (2 * SIGMA * SIGMA));
      const dist = Math.sqrt(d2) || 1;
      return { x: px - (dx / dist) * pull, y: py - (dy / dist) * pull };
    }

    function drawWarpedLine(x0, y0, x1, y1) {
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, w = warp(px, py);
        i === 0 ? ctx.moveTo(w.x, w.y) : ctx.lineTo(w.x, w.y);
      }
      ctx.stroke();
    }

    function draw() {
      // Critically-damped spring toward raw mouse (the "fabric sinking" lag).
      const dx = rawX - smX, dy = rawY - smY;
      velX += dx * SPRING; velY += dy * SPRING;
      velX *= 0.78; velY *= 0.78;
      smX += velX; smY += velY;

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      const cols = Math.ceil(W / CELL) + 1, rows = Math.ceil(H / CELL) + 1;
      for (let r = 0; r <= rows; r++) drawWarpedLine(0, r * CELL, W, r * CELL);
      for (let c = 0; c <= cols; c++) drawWarpedLine(c * CELL, 0, c * CELL, H);

      if (running) rafId = requestAnimationFrame(draw);
    }

    let rafId = null, running = false;
    function start() { if (!running) { running = true; rafId = requestAnimationFrame(draw); } }
    function stop()  { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    resize();
    window.addEventListener('resize', resize);

    // Only animate while the section is on-screen (saves CPU/battery).
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? start() : stop())), { threshold: 0 }).observe(host);
    } else { start(); }
  }

  // Homepage hero — existing canvas, light section so dark lines.
  const heroCanvas = document.getElementById('heroGrid');
  if (heroCanvas) {
    const hero = heroCanvas.closest('.hero');
    if (hero) initWarpGrid(hero, { canvas: heroCanvas, cell: 68, color: 'rgba(0,0,0,0.055)' });
  }

  // Every dark "grid" section — inject a canvas, light lines, hide static grid.
  [['.stats-section', 64], ['.cta-banner', 48], ['.page-header', 72], ['.article-header', 72], ['.calc-section', 64]]
    .forEach(([sel, cell]) => {
      document.querySelectorAll(sel).forEach(host => {
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        initWarpGrid(host, { cell, color: 'rgba(255,255,255,0.06)' });
      });
    });
})();

// Mobile nav
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  const setMenu = (open) => {
    hamburger.classList.toggle('active', open);
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  hamburger.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  // Escape closes the menu and returns focus to the toggle.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) { setMenu(false); hamburger.focus(); }
  });
}

// Sticky nav
const nav = document.getElementById('nav');
if (nav) window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

// Fade-in on scroll (guarded so browsers without IntersectionObserver still show content)
if ('IntersectionObserver' in window) {
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); fadeObserver.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
} else {
  document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// FAQ accordion (with aria-expanded sync for screen readers)
const faqButtons = document.querySelectorAll('.faq-question');
function syncFaqAria() {
  faqButtons.forEach(b => {
    const it = b.closest('.faq-item');
    b.setAttribute('aria-expanded', it && it.classList.contains('open') ? 'true' : 'false');
  });
}
faqButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
    syncFaqAria();
  });
});
syncFaqAria();

// Animated counters
function animateCounter(el) {
  const raw    = el.dataset.target;
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const target = parseFloat(raw);
  const isFloat = raw.includes('.');
  const dur = 2200, start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + (isFloat ? (target * eased).toFixed(1) : Math.round(target * eased)) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}
const counterObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && !e.target.dataset.animated) {
      e.target.dataset.animated = '1';
      animateCounter(e.target);
    }
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-target]').forEach(el => counterObs.observe(el));

// Cost-of-missed-leads calculator
(function () {
  const slider = document.getElementById('calcValue');
  if (!slider) return;
  const out     = document.getElementById('calcValueOut');
  const yearEl  = document.getElementById('calcYear');
  const monthEl = document.getElementById('calcMonth');

  // Leads/month and close rate are user inputs, not assumptions we assert.
  const leadsEl = document.getElementById('calcLeads');
  const closeEl = document.getElementById('calcClose');
  const leadsOut = document.getElementById('calcLeadsOut');
  const closeOut = document.getElementById('calcCloseOut');
  const custEl   = document.getElementById('calcCustomers');
  if (!leadsEl || !closeEl || !leadsOut || !closeOut || !custEl) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmt = n => Math.round(n).toLocaleString('en-US');

  let animId = null, shownYear = 0;
  function animateYear(target) {
    if (reduce) { shownYear = target; yearEl.textContent = fmt(target); return; }
    cancelAnimationFrame(animId);
    const start = shownYear, t0 = performance.now(), dur = 550;
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);        // easeOutCubic
      shownYear = start + (target - start) * e;
      yearEl.textContent = fmt(shownYear);
      if (p < 1) animId = requestAnimationFrame(step);
    }
    animId = requestAnimationFrame(step);
  }

  function update(animate) {
    const value   = +slider.value;
    const leads   = +leadsEl.value;
    const close   = +closeEl.value / 100;
    const cpm     = leads * close;          // new customers / month
    const monthly = cpm * value;
    const yearly  = monthly * 12;
    out.textContent      = '$' + fmt(value);
    leadsOut.textContent = fmt(leads);
    closeOut.textContent = closeEl.value + '%';
    custEl.textContent   = (Math.round(cpm * 10) / 10).toLocaleString('en-US');
    monthEl.textContent  = '$' + fmt(monthly);
    if (animate) { animateYear(yearly); }
    else { shownYear = yearly; yearEl.textContent = fmt(yearly); }
  }

  [slider, leadsEl, closeEl].forEach(el => el.addEventListener('input', () => update(true)));
  update(false); // set initial values without animating

  // Count up from zero the first time the calculator scrolls into view.
  const calc = slider.closest('.calc');
  if (calc && 'IntersectionObserver' in window && !reduce) {
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(e => { if (e.isIntersecting) { shownYear = 0; update(true); o.disconnect(); } });
    }, { threshold: 0.35 });
    obs.observe(calc);
  }
})();

// Email links are assembled client-side to keep the address out of the static HTML (spam-scraper hygiene).
(function () {
  var links = document.querySelectorAll('[data-em-u]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var addr = a.getAttribute('data-em-u') + '@' + a.getAttribute('data-em-d');
    a.setAttribute('href', 'mailto:' + addr);
    a.textContent = addr;
  }
})();

// Lead value calculator (/blog/how-much-are-leads-worth). Self-contained; no-ops elsewhere.
(function () {
  const val = document.getElementById('lvValue');
  if (!val) return;
  const close  = document.getElementById('lvClose');
  const margin = document.getElementById('lvMargin');
  const valOut = document.getElementById('lvValueOut');
  const closeOut = document.getElementById('lvCloseOut');
  const marginOut = document.getElementById('lvMarginOut');
  const profitEl = document.getElementById('lvProfit');
  const revEl = document.getElementById('lvRevenue');
  const cplEl = document.getElementById('lvMaxCpl');
  if (!close || !margin || !valOut || !closeOut || !marginOut || !profitEl || !revEl || !cplEl) return;

  const ACQUISITION_SHARE = 0.30; // documented in the copy above the calculator
  const fmt = n => Math.round(n).toLocaleString('en-US');

  function update() {
    const v = +val.value, c = +close.value / 100, m = +margin.value / 100;
    const revenuePerLead = v * c;
    const profitPerLead  = v * m * c;
    valOut.textContent    = '$' + fmt(v);
    closeOut.textContent  = close.value + '%';
    marginOut.textContent = margin.value + '%';
    profitEl.textContent  = fmt(profitPerLead);
    revEl.textContent     = '$' + fmt(revenuePerLead);
    cplEl.textContent     = '$' + fmt(profitPerLead * ACQUISITION_SHARE);
  }
  [val, close, margin].forEach(el => el.addEventListener('input', update));
  update();
})();
