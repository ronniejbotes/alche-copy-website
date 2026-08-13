import * as THREE from 'three';

/**
 * Procedural stand-in key visuals for the six works and three service
 * reels. The reference site streams client media; this design study ships
 * none of it, so each work gets an animated canvas artwork in a related
 * palette — enough to exercise the exact same texture pipeline
 * (thumbnails, blurred wall backgrounds, service reels).
 */

const WORKS = [
  { title: 'HELLO', sub: 'IN-GAME CONCERT', pal: ['#ff9ad5', '#7b2ff7', '#2ec4ff'] },
  { title: 'WEAR GO LAND', sub: 'FASHION METAVERSE', pal: ['#ffd1ec', '#b28dff', '#8fe3ff'] },
  { title: 'EXHIBITION', sub: 'VIRTUAL SHOW', pal: ['#e8e6df', '#b9b4a5', '#6c675c'] },
  { title: 'RISE UP', sub: 'WORLD STAGE', pal: ['#ffd76a', '#ff9d2e', '#3aa0ff'] },
  { title: 'RUN', sub: 'CHASE EVENT', pal: ['#d8d8d8', '#9aa4b2', '#3c4858'] },
  { title: 'NOWHERE', sub: 'ROLE PLAYING MUSIC', pal: ['#cfd8ff', '#8090c0', '#26304e'] }
];

const SERVICE = [
  { title: 'CREATIVE', pal: ['#9be2ff', '#2e77ff', '#132b66'] },
  { title: 'REALTIME', pal: ['#ffd8b8', '#c86a3a', '#241a20'] },
  // the stellla reel goes fullscreen — bright pastel field, no big title
  { title: '', sub: '', pal: ['#ffd7e8', '#ffe9c9', '#9fc9ff'], bright: true }
];

function seeded(seed) {
  let s = (seed * 2654435761 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paintArt(ctx, W, H, spec, seed, t = 0) {
  const rand = seeded(seed);
  const [c0, c1, c2] = spec.pal;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c0);
  g.addColorStop(0.55, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // drifting light beams (bright specs stay airy — no dark beams)
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(W * rand(), H * rand());
    ctx.rotate(rand() * Math.PI + t * 0.1 * (i % 2 ? 1 : -1));
    ctx.globalAlpha = spec.bright ? 0.08 + rand() * 0.1 : 0.10 + rand() * 0.18;
    ctx.fillStyle = spec.bright || i % 2 ? '#ffffff' : '#000000';
    const bw = W * (0.04 + rand() * 0.08);
    ctx.fillRect(-W, -bw / 2, W * 2, bw);
    ctx.restore();
  }

  // floating shards
  for (let i = 0; i < 12; i++) {
    ctx.save();
    const px = W * rand() + Math.sin(t * 0.7 + i) * 14;
    const py = H * rand() + Math.cos(t * 0.5 + i * 1.7) * 10;
    ctx.translate(px, py);
    ctx.rotate(rand() * Math.PI + t * 0.15);
    ctx.globalAlpha = 0.16 + rand() * 0.22;
    ctx.fillStyle = '#ffffff';
    const s = 22 + rand() * 90;
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(s / 2, s / 2);
    ctx.lineTo(-s / 2, s / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // title block
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 26;
  ctx.font = `600 ${Math.round(H * 0.18)}px "Inter", "Helvetica Neue", sans-serif`;
  ctx.fillText(spec.title, W / 2, H * 0.52);
  ctx.globalAlpha = 0.85;
  ctx.font = `400 ${Math.round(H * 0.055)}px "Google Sans Code", monospace`;
  ctx.fillText(spec.sub ?? '', W / 2, H * 0.62);
  ctx.restore();

  // scanlines
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.2);
}

export class WorksMedia {
  constructor() {
    this.count = WORKS.length;
    this._works = WORKS.map((spec, i) => this._make(spec, i, 1024, 576));
    this._service = SERVICE.map((spec, i) => this._make(spec, 100 + i, 1024, 576));
  }

  _make(spec, seed, W, H) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    paintArt(ctx, W, H, spec, seed);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
    tex.anisotropy = 4;

    // tiny copy for the LED wall — linear magnification acts as the blur
    const small = document.createElement('canvas');
    small.width = 64;
    small.height = 36;
    small.getContext('2d').drawImage(c, 0, 0, 64, 36);
    const blurTex = new THREE.CanvasTexture(small);
    blurTex.colorSpace = THREE.SRGBColorSpace;
    blurTex.wrapS = blurTex.wrapT = THREE.MirroredRepeatWrapping;

    return { canvas: c, ctx, tex, blurTex, spec, seed, aspect: W / H };
  }

  workTexture(i) {
    return this._works[i]?.tex ?? null;
  }

  workBlurTexture(i) {
    return this._works[i]?.blurTex ?? null;
  }

  workAspect(i) {
    return this._works[i]?.aspect ?? 16 / 9;
  }

  serviceTexture(i) {
    return this._service[i]?.tex ?? null;
  }

  /** Animate the "video" reels — cheap repaint a few times a second. */
  update(t) {
    if (!this._last) this._last = 0;
    if (t - this._last < 0.12) return;    // ~8fps repaint is plenty
    this._last = t;
    for (const m of this._service) {
      paintArt(m.ctx, m.canvas.width, m.canvas.height, m.spec, m.seed, t);
      m.tex.needsUpdate = true;
    }
  }

  dispose() {
    for (const m of [...this._works, ...this._service]) {
      m.tex.dispose();
      m.blurTex?.dispose();
    }
  }
}
