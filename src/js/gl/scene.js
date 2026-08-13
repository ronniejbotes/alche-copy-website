import * as THREE from 'three';
import { BackgroundWall } from './background.js';
import { MainLogo } from './logo.js';
import { AxisGizmo } from './gizmo.js';
import { WorksScreens } from './works-screens.js';

/**
 * AlcheGL — scene orchestrator.
 *
 * Modes:
 *  - 'top': background wall + interactive glass logo + wordmark (homepage)
 *  - 'sub': background wall only, dimmed (subpages)
 *
 * Scroll choreography talks to this class only through setSection(float),
 * where the integer part is the section index (kv=0 … service=5) and the
 * fraction is the transition progress. Everything is scrub-driven, so
 * scrolling back rewinds the scene.
 */

const SECTION_CONFIGS = [
  // kv
  { logoZ: 0, logoScale: 1, logoX: 0, dim: 0.0, wordOpacity: 1 },
  // works_intro
  { logoZ: -6, logoScale: 0.55, logoX: 0, dim: 0.4, wordOpacity: 0 },
  // works — logo recedes behind the key-visual screens
  { logoZ: -14, logoScale: 0.3, logoX: 0, dim: 0.55, wordOpacity: 0 },
  // mission
  { logoZ: -4, logoScale: 0.6, logoX: -3.2, dim: 0.82, wordOpacity: 0 },
  // vision
  { logoZ: -2.5, logoScale: 0.8, logoX: 2.8, dim: 0.7, wordOpacity: 0 },
  // service
  { logoZ: -6, logoScale: 0.42, logoX: 0, dim: 0.88, wordOpacity: 0 }
];

const lerp = (a, b, t) => a + (b - a) * t;

export class AlcheGL {
  /**
   * @returns {boolean} false if WebGL is unavailable (caller applies .no-3d)
   */
  init(container, { mode = 'top' } = {}) {
    this.mode = mode;
    this.container = container;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance'
      });
    } catch {
      return false;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    // The refracted image behind rough glass is low-frequency; half-res
    // transmission halves the most expensive per-frame pass.
    if ('transmissionResolutionScale' in this.renderer) {
      this.renderer.transmissionResolutionScale = 0.5;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 8);

    this.background = new BackgroundWall();
    this.scene.add(this.background.mesh);

    if (mode === 'top') {
      this.logo = new MainLogo();
      this.scene.add(this.logo);
      const worksCount = document.querySelectorAll('[data-top-section="works"] .works-item').length || 4;
      this.works = new WorksScreens(worksCount);
      this.scene.add(this.works.group);
      this._worksProgress = 0;
    } else {
      this.background.setDim(0.62);
    }

    // Environment for glass reflections: PMREM of the background itself.
    // Only the top page has a PBR material to consume it.
    if (mode === 'top') {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      envScene.add(this.background.mesh.clone());
      this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
    }

    this._sectionFloat = 0;
    this._pointer = new THREE.Vector2();
    this._pointerTarget = new THREE.Vector2();
    this._clock = new THREE.Clock();
    this._running = true;
    this._raf = 0;

    this._bindEvents();
    this._loop();
    return true;
  }

  attachGizmo(container) {
    if (this.mode !== 'top') return;
    this.gizmo = new AxisGizmo(container);
  }

  /* ---------- events ---------- */

  _bindEvents() {
    const el = this.renderer.domElement;
    this._onDown = (e) => {
      if (this.mode !== 'top' || this._sectionFloat > 0.5) return;
      this._dragLast = { x: e.clientX, y: e.clientY };
      this.logo.pointerDown();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    };
    this._onMove = (e) => {
      this._pointerTarget.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      if (this._dragLast && this.logo) {
        this.logo.pointerMove(e.clientX - this._dragLast.x, e.clientY - this._dragLast.y);
        this._dragLast = { x: e.clientX, y: e.clientY };
      }
    };
    this._onUp = () => {
      this._dragLast = null;
      this.logo?.pointerUp();
    };
    el.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerup', this._onUp, { passive: true });

    this._onVis = () => {
      this._running = !document.hidden;
      if (this._running) {
        this._clock.getDelta(); // swallow the hidden gap
        this._loop();
      } else {
        cancelAnimationFrame(this._raf);
      }
    };
    document.addEventListener('visibilitychange', this._onVis);

    this._onLost = (e) => e.preventDefault();
    el.addEventListener('webglcontextlost', this._onLost);
  }

  /* ---------- scroll API ---------- */

  setSection(f) {
    this._sectionFloat = Math.max(0, Math.min(SECTION_CONFIGS.length - 1, f));
  }

  /** 0..N-1 — which works screen is centered (fractional while sliding). */
  setWorksProgress(p) {
    this._worksProgress = p;
  }

  /* ---------- frame loop ---------- */

  _loop = () => {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._loop);

    const dt = Math.min(this._clock.getDelta(), 0.05);
    const t = this._clock.elapsedTime;

    this.background.update(t);

    // eased pointer parallax
    this._pointer.lerp(this._pointerTarget, 1 - Math.pow(0.94, dt * 60));
    this.camera.position.x = this._pointer.x * 0.35;
    this.camera.position.y = this._pointer.y * 0.25;
    this.camera.lookAt(0, 0, 0);

    if (this.logo) {
      const i = Math.floor(this._sectionFloat);
      const frac = this._sectionFloat - i;
      const a = SECTION_CONFIGS[i];
      const b = SECTION_CONFIGS[Math.min(i + 1, SECTION_CONFIGS.length - 1)];

      this.logo.update(dt, t);
      this.logo.position.x = lerp(a.logoX, b.logoX, frac);
      this.logo.position.z = lerp(a.logoZ, b.logoZ, frac);
      const s = lerp(a.logoScale, b.logoScale, frac);
      this.logo.scale.setScalar(s);
      this.background.setDim(lerp(a.dim, b.dim, frac));
      this.logo.screen.material.opacity = lerp(a.wordOpacity, b.wordOpacity, frac);
      this.logo.screen.visible = this.logo.screen.material.opacity > 0.01;

      // Gizmo HUD is only visible on the hero section
      if (this._sectionFloat < 1) this.gizmo?.update(this.logo.mesh.quaternion);

      // Works screens: fade in through works_intro, out entering mission
      const f = this._sectionFloat;
      const sstep = (a, b, x) => {
        const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return u * u * (3 - 2 * u);
      };
      const reveal = sstep(1.25, 1.85, f) * (1 - sstep(2.8, 3.25, f));
      this.works.setReveal(reveal);
      this.works.setProgress(this._worksProgress);
      this.works.update(t);
    }

    this.renderer.render(this.scene, this.camera);
  };

  /* ---------- lifecycle ---------- */

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    document.removeEventListener('visibilitychange', this._onVis);
    el.removeEventListener('webglcontextlost', this._onLost);
    this.logo?.dispose();
    this.works?.dispose();
    this.background.dispose();
    this.gizmo?.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
