import '@fontsource/google-sans-code/400.css';
import '@fontsource/google-sans-code/300.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/300.css';
import '@fontsource/ibm-plex-sans-jp/400.css';
import '@fontsource/ibm-plex-sans-jp/500.css';
import '@fontsource/ibm-plex-sans-jp/700.css';
import '@fontsource/inter/200.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '../styles/main.css';

import { AlcheGL } from './gl/scene.js';
import { Loader } from './loader.js';
import { ScrollManager } from './scroll-manager.js';
import {
  WorksItems, MissionController, VisionController,
  ServiceItems, StelllaController, RailController, HudVisibility
} from './dom-sections.js';
import { buildPanels } from './panels.js';
import { Outro } from './outro.js';
import { initHeader } from './ui.js';

/**
 * Top page boot.
 * Reduced motion / missing WebGL / init failure → body.no-3d static
 * fallback, content stays readable.
 */

document.body.classList.add('js-enabled');
initHeader();

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const container = document.getElementById('gl-canvas');

function bootFallback() {
  document.body.classList.add('no-3d');
  document.getElementById('loading')?.setAttribute('data-done', 'true');
  document.body.setAttribute('data-gl-ready', 'true');
}

async function boot() {
  const loader = new Loader();

  let gl = null;
  try {
    gl = new AlcheGL();
    if (!gl.init(container)) throw new Error('webgl unavailable');
  } catch (err) {
    console.error('[alche] scene boot failed, falling back', err);
    try { gl?.destroy(); } catch { /* already broken */ }
    bootFallback();
    return;
  }

  /* ---- scroll + sections ---- */
  const hud = new HudVisibility();
  const works = new WorksItems();
  const mission = new MissionController();
  const vision = new VisionController();
  const service = new ServiceItems();
  const stellla = new StelllaController();

  const sm = new ScrollManager({
    onSectionChange: (name) => {
      gl.changeSection(name);
      hud.update(name);
      works.setVisible(name === 'works' || name === 'works_outro');
      service.setVisible(name === 'service' || name === 'service_in');
    }
  });
  sm.init();
  sm.onItem('works', (i, entered) => { if (entered) works.show(i); });
  // service items switch deterministically from reel progress (see frame loop)

  const rail = new RailController(sm);
  new Outro();
  buildPanels(gl);

  /* ---- shared frame loop: lenis → controllers → GL ---- */
  let lastVision = 0;
  const frame = (timeMs) => {
    requestAnimationFrame(frame);
    sm.update(timeMs);
    const dt = Math.min(0.05, (timeMs - (frame._t || timeMs)) / 1000 || 0.016);
    frame._t = timeMs;

    const p = sm.progress;
    gl.setScrollState({
      worksTitle: p.worksTitle,
      worksProgress: p.worksProgress,
      worksOutro: p.worksOutro,
      missionIn: p.missionIn,
      vision: p.vision,
      serviceIn: p.serviceIn,
      serviceProgress: p.serviceProgress,
      stelllaIn: p.stelllaIn,
      lenisVelocity: sm.velocity,
      pageScroll: sm.scroll / window.innerHeight
    });

    mission.update(p.missionIn, p.vision, dt);
    vision.update(p.vision, p.visionOut, dt);
    lastVision = p.vision;
    service.setProgress(p.serviceIn);
    // one reel = one text card; index derived from the same mapping the GL
    // uses, and text held back until the dark tunnel has settled
    const reelO = (p.serviceProgress * 7 + 1) / 2;
    const reelIdx = Math.max(0, Math.min(2, Math.round(reelO) - 1));
    if ((sm.section === 'service' || sm.section === 'service_in') && p.serviceIn > 0.85) {
      if (reelIdx === 2) service.hideAll();
      else service.show(reelIdx);
    }
    stellla.update(p.stellla, sm.section);
    rail.update(sm.section);
  };
  requestAnimationFrame(frame);

  /* ---- resize ---- */
  let resizeId = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => {
      gl.resize();
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => ScrollTrigger.refresh());
    }, 200);
  });

  /* ---- loading handoff ---- */
  // everything is procedural, so "loading" is mostly the 1s minimum ramp
  loader.setProgress(0.5);
  requestAnimationFrame(() => loader.setProgress(1));

  await loader.finished;            // guides + logo outline drawn
  gl.setLoaderTexture(loader.texture);
  await loader.hide();              // overlay fade 0.8s
  gl.onLoadingComplete();           // uLoaded 0→1 over 3s (zoom + ripple)
  setTimeout(() => document.body.setAttribute('data-gl-ready', 'true'), 800);
}

if (reduced || !container) {
  bootFallback();
} else {
  boot();
}
