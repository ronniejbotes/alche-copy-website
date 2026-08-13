import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

/**
 * DOM-side section controllers: works item swap, mission/vision text
 * choreography, service items, stellla frame, left rail indicator.
 * Everything is driven per-frame from raw trigger progress so scrolling
 * back always rewinds.
 */

/* ---------------- works items ---------------- */

export class WorksItems {
  constructor() {
    this.items = [...document.querySelectorAll('.works-item')];
    this.layer = document.querySelector('.works-layer');
    this.current = -1;
    this._splits = this.items.map((el) => {
      const title = el.querySelector('.works-item__title');
      const split = new SplitText(title, { type: 'chars' });
      gsap.set(el, { opacity: 0 });
      return split;
    });
  }

  setVisible(v) {
    this.layer?.setAttribute('data-visible', String(v));
  }

  show(i) {
    if (i === this.current) return;
    const prev = this.current;
    this.current = i;
    if (prev >= 0) this._hideItem(prev);
    const el = this.items[i];
    if (!el) return;
    gsap.to(el, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo(this._splits[i].chars,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power4.out', stagger: 0.01 }
    );
    const desc = el.querySelectorAll('.works-item__ja, .works-item__cats, .works-item__info');
    gsap.fromTo(desc, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.3 });
  }

  _hideItem(i) {
    const el = this.items[i];
    if (!el) return;
    gsap.to(this._splits[i].chars, {
      y: -10, opacity: 0, duration: 0.4, ease: 'power2.in', stagger: 0.001
    });
    gsap.to(el, { opacity: 0, duration: 0.5, ease: 'power2.inOut' });
  }
}

/* ---------------- mission / vision ---------------- */

class MissionVisionBase {
  constructor(root) {
    this.root = root;
    this.lines = [...root.querySelectorAll('.mv__line')];
    this.markers = [...root.querySelectorAll('.mv__marker')];
    this.ttl = root.querySelector('.mv__ttl-text');
    this.en = root.querySelector('.mv__en');
    if (this.ttl) {
      this.ttl.style.strokeDasharray = '500';
      this.ttl.style.strokeDashoffset = '500';
    }
    for (const l of this.lines) {
      l.style.opacity = '0';
      l.style.transform = 'translateY(8px)';
    }
    if (this.en) this.en.style.opacity = '0';
    this._in = 0;
    this._magnet = 0;
  }

  /** inP: entrance progress 0..1; outP: exit progress 0..1 */
  update(inP, outP, dt) {
    // double smoothing with a magnet toward 0/1 — text "snaps" drawn/undrawn
    this._in += (inP - this._in) * Math.min(1, dt * 8);
    const rounded = Math.round(this._in);
    const target = rounded - (rounded - this._in) * 0.7;
    this._magnet += (target - this._magnet) * Math.min(1, dt * 8);
    const g = this._magnet;

    if (this.ttl) this.ttl.style.strokeDashoffset = String(500 * (1 - g));

    const n = this.lines.length;
    this.lines.forEach((line, i) => {
      const at = (i / n) * 0.8;
      const lp = Math.max(0, Math.min(1, (g - at) / 0.1));
      const e = 1 - Math.pow(1 - lp, 3);
      line.style.opacity = String(e);
      line.style.transform = `translateY(${(1 - e) * 8}px)`;
    });
    this.markers.forEach((m, i) => {
      const at = (i / n) * 0.8 + 0.03;
      const mp = Math.max(0, Math.min(1, (g - at) / 0.5));
      const e = 1 - Math.pow(1 - mp, 2);
      m.style.backgroundSize = `${e * 100}% 100%`;
    });
    if (this.en) this.en.style.opacity = String(g);

    // exit: blur + fade; fully hidden until the section starts entering
    const gg = Math.max(0, 1 - outP * 2);
    const active = inP > 0.02 && outP < 0.98;
    this.root.style.filter = `blur(${(1 - gg) * 10}px)`;
    this.root.style.opacity = active ? String(gg) : '0';
    this.root.setAttribute('data-visible', String(active));
  }
}

export class MissionController extends MissionVisionBase {
  constructor() {
    super(document.querySelector('.mv--mission'));
  }

  update(inP, outP, dt) {
    super.update(inP, outP, dt);
    // rising mask synced to the scene wipe
    const h = Math.max(0, inP * 100 - 1.5);
    this.root.style.setProperty('--mask-height', `${h}%`);
  }
}

export class VisionController extends MissionVisionBase {
  constructor() {
    super(document.querySelector('.mv--vision'));
  }
}

/* ---------------- service ---------------- */

export class ServiceItems {
  constructor() {
    this.layer = document.querySelector('.service-layer');
    this.items = [...document.querySelectorAll('.service-item')];
    this.current = -1;
    for (const el of this.items) gsap.set(el, { opacity: 0 });
  }

  setVisible(v) {
    this._visible = v;
    this.layer?.setAttribute('data-visible', String(v));
  }

  show(i) {
    if (i === this.current) return;
    if (this.current >= 0) {
      gsap.to(this.items[this.current], { opacity: 0, duration: 0.5, ease: 'power2.inOut' });
    }
    this.current = i;
    const el = this.items[i];
    if (el) gsap.to(el, { opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.15 });
  }

  hideAll() {
    if (this.current >= 0) {
      gsap.to(this.items[this.current], { opacity: 0, duration: 0.4, ease: 'power2.inOut' });
      this.current = -1;
    }
  }

  /** container opacity scrubbed by service_in progress, gated by visibility */
  setProgress(p) {
    if (this.layer) this.layer.style.opacity = this._visible ? String(Math.min(1, p)) : '0';
  }
}

/* ---------------- stellla ---------------- */

export class StelllaController {
  constructor() {
    this.root = document.querySelector('.stellla');
  }

  update(progress, section) {
    if (!this.root) return;
    // hide entirely once the outro/footer takes over
    const p = section === 'footer' ? 0 : Math.min(1, progress * 1.5);
    this.root.style.opacity = String(p);
    this.root.setAttribute('data-visible', String(p > 0.01));
    const frame = this.root.querySelector('.stellla__frame');
    if (frame) frame.style.setProperty('--progress', String(p));
  }
}

/* ---------------- left rail ---------------- */

const RAIL_GROUPS = {
  kv: ['works_intro'],
  works: ['works', 'works_outro', 'mission_in'],
  mission: ['mission'],
  vision: ['vision', 'vision_out', 'service_in'],
  service: ['service', 'stellla']
};

export class RailController {
  constructor(scrollManager) {
    this.sm = scrollManager;
    this.rail = document.querySelector('.rail');
    this.items = new Map(
      [...document.querySelectorAll('.rail__item')].map((el) => [el.dataset.rail, el])
    );
    for (const [key, el] of this.items) {
      el.querySelector('.rail__main')?.addEventListener('click', () => {
        const first = RAIL_GROUPS[key]?.[0];
        const trig = this.sm.triggers.get(first === 'works' ? 'works_progress' : first);
        if (trig) this.sm.scrollTo(trig.start);
      });
    }
  }

  update(section) {
    // hidden on kv / stellla / footer
    const hidden = section === 'kv' || section === 'stellla' || section === 'footer';
    this.rail?.setAttribute('data-hidden', String(hidden));

    // active = last group mid-progress, else last fully-passed group
    let activeMid = null;
    let activeDone = null;
    for (const [key, trigNames] of Object.entries(RAIL_GROUPS)) {
      let p = 0;
      for (const name of trigNames) {
        const t = this.sm.triggers.get(name === 'works' ? 'works_progress' : name);
        if (t) p = Math.max(p, t.progress);
      }
      if (p > 0 && p < 1) activeMid = key;
      if (p >= 1) activeDone = key;
      const el = this.items.get(key);
      if (el) {
        el.setAttribute('data-active', 'false');
        const subs = el.querySelectorAll('.rail__sub');
        const litCount = Math.floor(Math.min(1, p) * 2);
        subs.forEach((s, i) => s.setAttribute('data-active', String(i < litCount)));
      }
    }
    const active = activeMid ?? activeDone ?? 'kv';
    this.items.get(active)?.setAttribute('data-active', 'true');
  }
}

/* ---------------- news / kv HUD visibility ---------------- */

export class HudVisibility {
  constructor() {
    this.news = document.querySelector('.news-hud');
    this.hint = document.querySelector('.scroll-hint');
    this.paneMaterial = document.getElementById('pane-material');
    this.paneScreen = document.getElementById('pane-screen');
    this.paneQuat = document.getElementById('pane-quaternion');
  }

  update(section) {
    const onKv = section === 'kv';
    this.news?.setAttribute('data-hidden', String(!onKv));
    this.news?.toggleAttribute('inert', !onKv);
    this.hint?.setAttribute('data-hidden', String(!onKv));

    // material pane on the hero; screen pane on vision; quaternion pane
    // stays up from the hero through the whole works block
    const onWorks = section === 'works_intro' || section === 'works' || section === 'works_outro';
    this.paneMaterial?.setAttribute('data-visible', String(section === 'kv'));
    this.paneScreen?.setAttribute('data-visible', String(section === 'vision'));
    this.paneQuat?.setAttribute('data-visible', String(section === 'kv' || onWorks));

    const light = section === 'mission_in' || section === 'mission' || section === 'vision' || section === 'vision_out';
    document.body.setAttribute('data-light', String(light));
    const headerHidden = section === 'stellla' || section === 'footer';
    document.body.setAttribute('data-header-hidden', String(headerHidden));
  }
}
