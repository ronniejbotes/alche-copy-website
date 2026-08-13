import '../styles/main.css';
import { AlcheGL } from './gl/scene.js';
import { buildPanels } from './panels.js';
import { initScroll } from './scroll.js';
import { initHeader } from './ui.js';

/**
 * Top page boot. All-or-nothing gate: reduced motion, missing WebGL, or a
 * scene init failure all fall back to `body.no-3d` (static backdrop, HUD
 * hidden, content fully readable).
 */

document.body.classList.add('js-enabled');
initHeader();

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const container = document.getElementById('gl-canvas');
const loading = document.getElementById('loading');

let gl = null;

function bootFallback() {
  document.body.classList.add('no-3d');
  finishLoading();
}

function finishLoading() {
  // small delay so the mark-draw animation reads even on instant loads
  setTimeout(() => loading?.setAttribute('data-done', 'true'), reduced ? 0 : 900);
}

if (reduced || !container) {
  bootFallback();
} else {
  try {
    gl = new AlcheGL();
    const ok = gl.init(container, { mode: 'top' });
    if (!ok) {
      bootFallback();
    } else {
      const gizmoEl = document.querySelector('.hud--gizmo');
      if (gizmoEl) gl.attachGizmo(gizmoEl);
      buildPanels(gl);
      initScroll(gl);
      finishLoading();
    }
  } catch (err) {
    console.error('[alche] scene boot failed, falling back', err);
    try { gl?.destroy(); } catch { /* already broken */ }
    bootFallback();
  }
}
