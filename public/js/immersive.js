/* Position Xero, immersive interaction layer.
 *
 * Shared enhancement for the 51 non-home pages. Classic script, no build step,
 * no dependencies. Load it exactly the way main.js is loaded:
 *
 *   <script src="/js/main.js" defer></script>
 *   <script src="/js/immersive.js" defer></script>
 *
 * This file is additive. main.js keeps doing its existing job (mobile menu,
 * .nav.scrolled, FAQ accordion, counters, calculators, mailto assembly and its
 * own .fade-in observer). Nothing here removes or replaces any of that, and
 * every behaviour below degrades to a complete, readable static page when
 * JavaScript is off or fails.
 *
 * What it provides:
 *   1. Scroll reveals for .fade-in, honouring .delay-1 to .delay-4.
 *   2. A fixed canvas backdrop in the language of the immersive LED wall.
 *   3. A pointer-reactive cyan glow, pointer devices only.
 *   4. Header hide on scroll down, show on scroll up.
 *
 * Accessibility: prefers-reduced-motion switches every moving part off and
 * reveals all content immediately. Nothing is hover-only. No focus state is
 * removed. The backdrop is aria-hidden and pointer-events: none.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.document) { return; }
  if (window.__pxImmersiveLoaded) { return; }
  window.__pxImmersiveLoaded = true;

  var doc = document;
  var root = doc.documentElement;

  /* Design tokens, mirrored from src/styles/main.css so this file stands alone.
     Kept as literal rgba because a CSS custom property cannot be used inside
     an rgba() channel list. */
  var SIGNAL = '46, 230, 255';   /* --signal #2EE6FF */
  var HEAT   = '255, 106, 31';   /* --heat   #FF6A1F */

  var mqReduce = win_mq('(prefers-reduced-motion: reduce)');
  var mqFine   = win_mq('(hover: hover) and (pointer: fine)');

  function win_mq(q) {
    try { return window.matchMedia ? window.matchMedia(q) : null; }
    catch (e) { return null; }
  }
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function finePointer() { return !!(mqFine && mqFine.matches); }
  function onMq(mq, fn) {
    if (!mq) { return; }
    if (mq.addEventListener) { mq.addEventListener('change', fn); }
    else if (mq.addListener) { mq.addListener(fn); }
  }
  function ready(fn) {
    if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', fn, { once: true }); }
    else { fn(); }
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* Marker for the stylesheet. Do not gate the resting hidden state of
     .fade-in on this class: the script is deferred, so the class lands after
     first paint and content would flash in and then out. Use it only for
     states that apply once an element has already been revealed. */
  root.classList.add('immersive-ready');

  /* The stylesheet arms the reveal on html.js-reveal. That class is added in
     armReveal() below, NOT here, and only after everything already inside the
     viewport has been marked .visible. Adding it before that pass would hide
     content the browser has already painted, which is the flash this file's
     comment above warns about. */

  /* ============================================================
     1. Scroll reveals
     ============================================================ */

  var DELAY_CLASSES = [
    ['delay-1', 100],
    ['delay-2', 200],
    ['delay-3', 300],
    ['delay-4', 400]
  ];

  function delayFor(el) {
    for (var i = 0; i < DELAY_CLASSES.length; i++) {
      if (el.classList.contains(DELAY_CLASSES[i][0])) { return DELAY_CLASSES[i][1]; }
    }
    return 0;
  }

  /* The legacy sheet already carries .fade-in.delay-1 { transition-delay: 0.1s }
     and friends. If the active stylesheet does that, JavaScript must not add a
     second delay on top, or a .delay-2 element waits 400ms. One probe answers
     it for the whole page. */
  function stylesheetHandlesDelay() {
    var probe = doc.createElement('div');
    probe.className = 'fade-in delay-1';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none';
    var value = '0s';
    try {
      doc.body.appendChild(probe);
      value = window.getComputedStyle(probe).transitionDelay || '0s';
    } catch (e) { /* ignore */ }
    if (probe.parentNode) { probe.parentNode.removeChild(probe); }
    /* parseFloat handles "0.1s", "100ms" and "0.1s, 0.1s" alike. */
    return (parseFloat(value) || 0) > 0.001;
  }

  function revealAll() {
    var nodes = doc.querySelectorAll('.fade-in');
    for (var i = 0; i < nodes.length; i++) { nodes[i].classList.add('visible'); }
  }

  /* Mark everything currently on screen as revealed, then arm the animation.
     Order is load-bearing: .js-reveal hides `.fade-in:not(.visible)`, so any
     above-the-fold element must already carry .visible before the class lands
     or it flashes in and back out. */
  function armReveal() {
    var vh = window.innerHeight || root.clientHeight || 0;
    var nodes = doc.querySelectorAll('.fade-in');
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) { nodes[i].classList.add('visible'); }
    }
    root.classList.add('js-reveal');
  }

  function initReveals() {
    if (reduced() || !('IntersectionObserver' in window)) {
      /* No observer, or the reader asked for no motion: show everything now.
         The stylesheet already forces opacity 1 and transform none under
         reduced motion, so this is belt and braces. */
      revealAll();
      return;
    }

    armReveal();

    var cssDelays = stylesheetHandlesDelay();

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.isIntersecting) { continue; }
        var el = entry.target;
        io.unobserve(el);
        if (el.classList.contains('visible')) { continue; }
        var ms = cssDelays ? 0 : delayFor(el);
        if (ms > 0) {
          (function (node, wait) {
            window.setTimeout(function () { node.classList.add('visible'); }, wait);
          }(el, ms));
        } else {
          el.classList.add('visible');
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -10% 0px' });

    var nodes = doc.querySelectorAll('.fade-in');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].classList.contains('visible')) { io.observe(nodes[i]); }
    }

    /* If the reader switches reduced motion on mid-session, stop staging and
       show the rest of the document at once. */
    onMq(mqReduce, function () { if (reduced()) { io.disconnect(); revealAll(); } });
  }

  /* ============================================================
     2. Animated backdrop
     ============================================================ */

  var STYLE_ID = 'px-immersive-style';
  var BG_CSS = [
    '.px-bg{position:fixed;inset:0;top:0;right:0;bottom:0;left:0;z-index:-1;',
    'pointer-events:none;overflow:hidden;contain:layout style paint;',
    'background:radial-gradient(120% 90% at 50% 38%, #0E151C 0%, #05070A 76%);}',

    /* Layer 1, the diagonal hairline weave. 1px lines every 26px at low alpha
       reads as a technical hatch, not as stripes. */
    '.px-bg__hatch{position:absolute;inset:-40px;top:-40px;right:-40px;bottom:-40px;left:-40px;',
    'background:repeating-linear-gradient(115deg, rgba(255,255,255,0.032) 0 1px, transparent 1px 26px);}',

    /* A single settle on load, then it stops. Nothing here loops forever. */
    '.px-bg--motion .px-bg__hatch{animation:px-hatch-settle 1.2s cubic-bezier(0.25,0.46,0.45,0.94) both;}',
    '@keyframes px-hatch-settle{from{transform:translate3d(-18px,10px,0);opacity:0}',
    'to{transform:translate3d(0,0,0);opacity:1}}',

    /* Layer 2, the cell field. Oversized so its drift never exposes an edge. */
    '.px-bg__canvas{position:absolute;top:-60px;left:-60px;width:calc(100% + 120px);',
    'height:calc(100% + 120px);display:block;will-change:transform;}',

    /* Layer 3, the pointer glow. Off until the pointer moves. */
    '.px-bg__glow{position:absolute;inset:0;top:0;right:0;bottom:0;left:0;opacity:0;',
    'transition:opacity 0.6s ease;background:radial-gradient(38vmax 38vmax at var(--px,50%) var(--py,38%),',
    'rgba(' + SIGNAL + ',0.055) 0%, rgba(' + SIGNAL + ',0) 62%);}',
    '.px-bg--pointer .px-bg__glow{opacity:1;}',

    '@media (prefers-reduced-motion: reduce){',
    '.px-bg--motion .px-bg__hatch{animation:none;}',
    '.px-bg__glow{display:none;}}'
  ].join('');

  function injectStyle() {
    if (doc.getElementById(STYLE_ID)) { return; }
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(doc.createTextNode(BG_CSS));
    (doc.head || root).appendChild(s);
  }

  function parseRgb(str) {
    if (!str) { return null; }
    var m = String(str).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/i);
    if (!m) { return null; }
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }

  function isDarkGround(c) {
    if (!c || c.a < 0.5) { return false; }
    /* Rec. 709 luma is close enough to judge dark versus light ground. */
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) < 90;
  }

  /* The backdrop sits at z-index -1 so it can never paint over content, which
     means it also paints under the body background. Move the body ground up to
     the html element so the canvas has somewhere to show. Visually identical,
     and it happens only when the ground is dark enough for the backdrop to
     belong there. */
  function liftGroundToHtml(cs) {
    try {
      var htmlCs = window.getComputedStyle(root);
      var htmlBg = parseRgb(htmlCs.backgroundColor);
      if (!htmlBg || htmlBg.a < 0.5) { root.style.backgroundColor = cs.backgroundColor; }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        root.style.backgroundImage    = cs.backgroundImage;
        root.style.backgroundSize     = cs.backgroundSize;
        root.style.backgroundPosition = cs.backgroundPosition;
        root.style.backgroundRepeat   = cs.backgroundRepeat;
        doc.body.style.backgroundImage = 'none';
      }
      doc.body.style.backgroundColor = 'transparent';
      return true;
    } catch (e) { return false; }
  }

  function backdropWanted() {
    /* Explicit opt out wins. */
    var flag = root.getAttribute('data-immersive-bg') || doc.body.getAttribute('data-immersive-bg');
    if (flag === 'off') { return false; }
    if (flag === 'on') { return true; }
    /* The home page runs the real three.js scene. Never double up. */
    if (doc.getElementById('gl-canvas') || doc.querySelector('.gl-stage')) { return false; }
    return true;
  }

  function initBackdrop() {
    if (!backdropWanted()) { return null; }

    var bodyCs;
    try { bodyCs = window.getComputedStyle(doc.body); } catch (e) { return null; }

    /* The ground may sit on either element. The stylesheet paints it on html
       and sets body to transparent so the html weave shows through, so a body
       only check reads rgba(0,0,0,0), decides the page is not dark yet, and
       silently skips the backdrop on every page. Check body, then html. */
    var ground = parseRgb(bodyCs.backgroundColor);
    if (!ground || ground.a < 0.5) {
      try { ground = parseRgb(window.getComputedStyle(root).backgroundColor); }
      catch (e) { ground = null; }
    }
    if (!isDarkGround(ground)) {
      /* A light page is not this design language yet. Leave it alone rather
         than dropping a near-black sheet over it. */
      return null;
    }
    if (!liftGroundToHtml(bodyCs)) { return null; }

    injectStyle();

    var wrap = doc.createElement('div');
    wrap.className = 'px-bg';
    wrap.setAttribute('aria-hidden', 'true');

    var hatch = doc.createElement('div');
    hatch.className = 'px-bg__hatch';

    var canvas = doc.createElement('canvas');
    canvas.className = 'px-bg__canvas';

    var glow = doc.createElement('div');
    glow.className = 'px-bg__glow';

    wrap.appendChild(hatch);
    wrap.appendChild(canvas);
    wrap.appendChild(glow);
    doc.body.insertBefore(wrap, doc.body.firstChild);
    if (!reduced()) { wrap.classList.add('px-bg--motion'); }

    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) {
      /* No 2D context. The two gradient layers alone are a complete backdrop. */
      canvas.parentNode.removeChild(canvas);
      return { wrap: wrap, glow: glow, canvas: null };
    }

    /* ---- geometry ------------------------------------------------------ */
    var SPACING = 30;      /* CSS px between cells */
    var DOT     = 1.6;     /* CSS px, the lit face of a cell */
    var COARSE  = 6;       /* every sixth cell marks a panel seam */
    var MARGIN  = 60;      /* the oversize that lets the field drift */

    var scale = 1, cw = 0, ch = 0, S = 0, dot = 0, offX = 0, offY = 0;
    var sprites = null;

    function sizeCanvas() {
      var w = Math.max(1, window.innerWidth || root.clientWidth) + MARGIN * 2;
      var h = Math.max(1, window.innerHeight || root.clientHeight) + MARGIN * 2;
      var dpr = window.devicePixelRatio || 1;
      scale = Math.min(dpr, 2);
      /* Cap the buffer so a large display does not pay for a subtle texture. */
      if (w * h * scale * scale > 4.2e6) { scale = 1; }
      cw = Math.round(w * scale);
      ch = Math.round(h * scale);
      canvas.width = cw;
      canvas.height = ch;
      S = SPACING * scale;
      dot = Math.max(1, Math.round(DOT * scale));
      offX = S * 0.5;
      offY = S * 0.5;
      sprites = [makeGlint(SIGNAL, 22 * scale), makeGlint(HEAT, 18 * scale)];
      drawField(0, 0, cw, ch);
    }

    function makeGlint(rgb, radius) {
      var r = Math.max(6, Math.round(radius));
      var c = doc.createElement('canvas');
      c.width = r * 2; c.height = r * 2;
      var g = c.getContext('2d');
      var grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0,    'rgba(' + rgb + ',0.9)');
      grad.addColorStop(0.16, 'rgba(' + rgb + ',0.4)');
      grad.addColorStop(1,    'rgba(' + rgb + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, r * 2, r * 2);
      return c;
    }

    /* Repaint the cell field inside a rectangle given in device pixels. The
       whole canvas on resize, a small patch around a glint every frame. */
    function drawField(x0, y0, x1, y1) {
      var i0 = Math.floor((x0 - offX) / S), i1 = Math.ceil((x1 - offX) / S);
      var j0 = Math.floor((y0 - offY) / S), j1 = Math.ceil((y1 - offY) / S);
      var i, j, x, y;

      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (j = j0; j <= j1; j++) {
        y = offY + j * S;
        for (i = i0; i <= i1; i++) {
          x = offX + i * S;
          ctx.fillRect(x, y, dot, dot);
        }
      }
      /* Panel seams: a slightly brighter cell on a coarse lattice, which is
         what gives the field its LED wall rhythm. */
      ctx.fillStyle = 'rgba(255,255,255,0.065)';
      for (j = j0; j <= j1; j++) {
        if (((j % COARSE) + COARSE) % COARSE !== 0) { continue; }
        y = offY + j * S;
        for (i = i0; i <= i1; i++) {
          if (((i % COARSE) + COARSE) % COARSE !== 0) { continue; }
          x = offX + i * S;
          ctx.fillRect(x, y, dot, dot);
        }
      }
    }

    /* ---- glints -------------------------------------------------------- */
    var POOL = 12;
    var glints = [];
    for (var gi = 0; gi < POOL; gi++) {
      glints.push({ on: false, x: 0, y: 0, t: 0, dur: 1200, sprite: 0, rect: null });
    }

    function spawn(g, now, biasX, biasY) {
      var x, y;
      if (biasX !== null && Math.random() < 0.4) {
        x = biasX + (Math.random() - 0.5) * 460 * scale;
        y = biasY + (Math.random() - 0.5) * 460 * scale;
      } else {
        x = Math.random() * cw;
        y = Math.random() * ch;
      }
      /* Snap to the lattice so a glint always lands on a cell. */
      g.x = offX + Math.round((clamp(x, 0, cw) - offX) / S) * S;
      g.y = offY + Math.round((clamp(y, 0, ch) - offY) / S) * S;
      g.t = now;
      g.dur = 900 + Math.random() * 1400;
      g.sprite = Math.random() < 0.08 ? 1 : 0;  /* amber is the rare one */
      g.on = true;
    }

    function paintGlints(now, pointerDev) {
      var i, g, sp, r, env, p;

      /* Pass one: restore every patch touched last frame. */
      for (i = 0; i < POOL; i++) {
        r = glints[i].rect;
        if (!r) { continue; }
        ctx.clearRect(r[0], r[1], r[2], r[3]);
        drawField(r[0], r[1], r[0] + r[2], r[1] + r[3]);
        glints[i].rect = null;
      }

      /* Pass two: draw the live ones. */
      for (i = 0; i < POOL; i++) {
        g = glints[i];
        if (!g.on) {
          if (Math.random() < 0.003) { spawn(g, now, pointerDev ? pointerDev[0] : null, pointerDev ? pointerDev[1] : null); }
          continue;
        }
        p = (now - g.t) / g.dur;
        if (p >= 1) { g.on = false; continue; }
        env = Math.sin(Math.PI * p);
        sp = sprites[g.sprite];
        r = [
          Math.round(g.x - sp.width / 2),
          Math.round(g.y - sp.height / 2),
          sp.width,
          sp.height
        ];
        ctx.globalAlpha = env * 0.4;
        ctx.drawImage(sp, r[0], r[1]);
        ctx.globalAlpha = 1;
        /* A hot core so the cell itself reads as lit, not just haloed. */
        ctx.fillStyle = 'rgba(' + (g.sprite ? HEAT : SIGNAL) + ',' + (env * 0.6).toFixed(3) + ')';
        ctx.fillRect(g.x, g.y, dot + scale, dot + scale);
        g.rect = r;
      }
    }

    sizeCanvas();

    return {
      wrap: wrap,
      glow: glow,
      canvas: canvas,
      resize: sizeCanvas,
      paint: paintGlints,
      spacing: function () { return SPACING; },
      staticFrame: function () {
        /* Reduced motion: one frame, a handful of cells lit, then nothing. */
        for (var i = 0; i < 3; i++) {
          spawn(glints[i], 0, null, null);
          glints[i].t = -glints[i].dur * 0.25;
        }
        paintGlints(0, null);
      }
    };
  }

  /* ============================================================
     3. Pointer accent and the single frame loop
     ============================================================ */

  function initMotion(bg) {
    if (!bg) { return; }

    var wantPointer = finePointer() && !reduced();
    var px = 50, py = 38;          /* current, in percent */
    var tx = 50, ty = 38;          /* target, in percent */
    var pointerSeen = false;
    var devX = null, devY = null;  /* pointer in canvas device pixels */

    if (bg.canvas && reduced()) { bg.staticFrame(); }

    function onPointerMove(e) {
      if (!wantPointer) { return; }
      var w = window.innerWidth || 1, h = window.innerHeight || 1;
      tx = (e.clientX / w) * 100;
      ty = (e.clientY / h) * 100;
      if (bg.canvas) {
        devX = (e.clientX + 60) * (bg.canvas.width / (w + 120));
        devY = (e.clientY + 60) * (bg.canvas.height / (h + 120));
      }
      if (!pointerSeen) {
        pointerSeen = true;
        px = tx; py = ty;
        bg.wrap.style.setProperty('--px', px.toFixed(2) + '%');
        bg.wrap.style.setProperty('--py', py.toFixed(2) + '%');
        bg.wrap.classList.add('px-bg--pointer');
      }
      start();
    }

    /* Always bound, gated inside on wantPointer, so that a reader who turns
       reduced motion back off in the same session still gets the accent. */
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', function () {
      bg.wrap.classList.remove('px-bg--pointer');
    }, { passive: true });

    /* ---- the loop ------------------------------------------------------ */
    var raf = 0, running = false;
    var last = 0, acc = 0;
    var FRAME = 1000 / 30;         /* pixel work runs at 30fps, not 60 */
    var drift = 0, driftX = 0, lastTransform = '';
    var scrollY = 0;

    function transformCanvas() {
      if (!bg.canvas) { return; }
      var s = bg.spacing();
      /* Modulo the cell spacing so the drift is seamless and never runs out
         of the 60px oversize. */
      var dy = (((drift + scrollY * 0.04) % s) + s) % s - s;
      var dx = (((driftX) % s) + s) % s - s;
      var t = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
      if (t !== lastTransform) { bg.canvas.style.transform = t; lastTransform = t; }
    }

    function frame(now) {
      raf = 0;
      if (!running) { return; }
      var dt = last ? Math.min(64, now - last) : 16;
      last = now;

      /* Pointer glow, exponential smoothing toward the target. Matches the
         lerp feel of the immersive build without importing anything. */
      if (pointerSeen) {
        var k = Math.min(1, dt / 1000 * 6);
        px += (tx - px) * k;
        py += (ty - py) * k;
        if (Math.abs(tx - px) > 0.03 || Math.abs(ty - py) > 0.03) {
          bg.wrap.style.setProperty('--px', px.toFixed(2) + '%');
          bg.wrap.style.setProperty('--py', py.toFixed(2) + '%');
        }
      }

      drift  += dt * 0.0075;   /* about 7.5px a second, barely perceptible */
      driftX += dt * 0.0022;
      transformCanvas();

      acc += dt;
      if (acc >= FRAME) {
        acc = 0;
        if (bg.canvas) { bg.paint(now, devX === null ? null : [devX, devY]); }
      }

      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduced() || doc.hidden) { return; }
      running = true;
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    }

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { stop(); } else { start(); }
    });

    onMq(mqReduce, function () {
      if (reduced()) {
        stop();
        bg.wrap.classList.remove('px-bg--motion', 'px-bg--pointer');
        if (bg.canvas) { bg.canvas.style.transform = 'none'; lastTransform = 'none'; bg.staticFrame(); }
      } else {
        wantPointer = finePointer();
        bg.wrap.classList.add('px-bg--motion');
        start();
      }
    });

    /* Scroll parallax on the field. One passive listener, coalesced into the
       frame loop, no layout reads beyond window.scrollY. */
    window.addEventListener('scroll', function () {
      if (reduced()) { return; }
      scrollY = window.pageYOffset || root.scrollTop || 0;
    }, { passive: true });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (bg.resize) { bg.resize(); }
        if (reduced() && bg.staticFrame) { bg.staticFrame(); }
      }, 160);
    }, { passive: true });

    start();

    window.PXImmersive.start = start;
    window.PXImmersive.stop = stop;
  }

  /* ============================================================
     4. Header behaviour on scroll
     ============================================================ */

  function initHeader() {
    var nav = doc.getElementById('nav') || doc.querySelector('.nav');
    if (!nav) { return; }
    var menu = doc.getElementById('mobileMenu');

    var lastY = window.pageYOffset || 0;
    var hidden = false;
    var ticking = false;

    function menuOpen() { return !!(menu && menu.classList.contains('open')); }

    function apply() {
      ticking = false;
      var y = Math.max(0, window.pageYOffset || root.scrollTop || 0);
      var h = nav.offsetHeight || 70;

      /* Mirrors main.js's own .scrolled toggle as a body attribute, so the
         stylesheet can key off either without the two fighting. */
      var sc = y > 40 ? 'true' : 'false';
      if (doc.body.getAttribute('data-scrolled') !== sc) { doc.body.setAttribute('data-scrolled', sc); }

      var next = hidden;
      if (reduced() || menuOpen()) {
        next = false;
      } else if (y <= h + 40) {
        next = false;
      } else if (y > lastY + 6) {
        next = true;
      } else if (y < lastY - 6) {
        next = false;
      }

      if (next !== hidden) {
        hidden = next;
        doc.body.setAttribute('data-header-hidden', hidden ? 'true' : 'false');
        nav.classList.toggle('nav-hidden', hidden);
      }
      lastY = y;
    }

    function onScroll() {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(apply);
    }

    doc.body.setAttribute('data-header-hidden', 'false');
    window.addEventListener('scroll', onScroll, { passive: true });

    /* A keyboard reader tabbing into the navigation must never be scrolled to
       a control that is off screen. */
    doc.addEventListener('focusin', function (e) {
      if (hidden && nav.contains(e.target)) {
        hidden = false;
        doc.body.setAttribute('data-header-hidden', 'false');
        nav.classList.remove('nav-hidden');
      }
    });

    apply();
  }

  /* ============================================================
     Boot
     ============================================================ */

  window.PXImmersive = { revealAll: revealAll, start: function () {}, stop: function () {} };

  ready(function () {
    try { initReveals(); } catch (e) { revealAll(); }
    try { initHeader(); } catch (e) { /* chrome stays exactly as main.js left it */ }
    try { initMotion(initBackdrop()); } catch (e) { /* the page is complete without it */ }
  });
}());
