import * as THREE from 'three';

/**
 * The works showcase: curved "screens" floating in the scene, one per
 * project, sliding horizontally as you scroll through the works section.
 * Each screen shows generated placeholder art; drop a real key visual at
 * public/works/kv-01.jpg … kv-04.jpg and it replaces the placeholder
 * automatically.
 */

const PALETTES = [
  ['#ff5fa2', '#7b2ff7', '#00e0ff'],
  ['#ffe259', '#ffa751', '#ff5f6d'],
  ['#43e97b', '#38f9d7', '#4facfe'],
  ['#f83600', '#f9d423', '#c471f5'],
  ['#a18cd1', '#fbc2eb', '#fad0c4'],
  ['#00c6ff', '#0072ff', '#00ffb3']
];

function seededRand(seed) {
  let s = seed * 2654435761 + 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function placeholderArt(index) {
  const W = 1024, H = 576;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const pal = PALETTES[index % PALETTES.length];
  const rand = seededRand(index + 7);

  // vivid diagonal gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  pal.forEach((col, i) => g.addColorStop(i / (pal.length - 1), col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // translucent geometric shapes
  for (let i = 0; i < 14; i++) {
    ctx.save();
    ctx.translate(rand() * W, rand() * H);
    ctx.rotate(rand() * Math.PI);
    ctx.globalAlpha = 0.1 + rand() * 0.2;
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
    const s = 40 + rand() * 200;
    if (rand() > 0.5) {
      ctx.beginPath();
      ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.lineTo(-s / 2, s / 2);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(-s / 2, -s / 8, s, s / 4);
    }
    ctx.restore();
  }

  // halftone dots
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  for (let y = 8; y < H; y += 18) {
    for (let x = 8; x < W; x += 18) {
      const r = 1.4 + 2.2 * ((x / W + y / H) % 1);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // big rotated title
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.09);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24;
  ctx.font = '900 118px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('PLACEHOLDER', 0, 8);
  ctx.font = '700 54px ui-monospace, Menlo, monospace';
  ctx.fillText(`KEY VISUAL 0${index + 1}`, 0, 86);
  ctx.restore();

  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.4);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Plane bent so the center bulges toward the camera, like a curved display. */
function bentPlane(w, h, curve) {
  const geo = new THREE.PlaneGeometry(w, h, 48, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = (pos.getX(i) * 2) / w; // -1..1
    pos.setZ(i, curve * (1 - nx * nx));
  }
  geo.computeVertexNormals();
  return geo;
}

export class WorksScreens {
  constructor(count = 4) {
    this.count = count;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.spacing = 7.2;   // next screen peeks in from the right edge
    this._baseX = 0.7;    // composition sits slightly right of center
    this._screens = [];

    const loader = new THREE.TextureLoader();

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: placeholderArt(i),
        transparent: true,
        opacity: 0,
        toneMapped: false,
        side: THREE.DoubleSide
      });
      // optional real key visual (public/works/kv-01.jpg …)
      loader.load(
        `/works/kv-0${i + 1}.jpg`,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          mat.map?.dispose();
          mat.map = tex;
          mat.needsUpdate = true;
        },
        undefined,
        () => { /* keep the generated placeholder */ }
      );

      const mesh = new THREE.Mesh(bentPlane(6.1, 3.4, 0.65), mat);
      mesh.position.x = i * this.spacing;
      mesh.position.y = 0.35;
      this.group.add(mesh);
      this._screens.push(mesh);
    }
  }

  /** p: 0..count-1 — which screen is centered (fractional while sliding). */
  setProgress(p) {
    this._p = Math.max(0, Math.min(this.count - 1, p));
    this.group.position.x = this._baseX - this._p * this.spacing;
  }

  /** r: 0..1 global reveal — fades screens in/out around the works section. */
  setReveal(r) {
    this.group.visible = r > 0.005;
    for (const s of this._screens) s.material.opacity = r;
  }

  update(t) {
    const p = this._p ?? 0;
    this._screens.forEach((s, i) => {
      // subtle idle sway
      s.rotation.y = Math.sin(t * 0.4 + i * 1.7) * 0.04;
      s.position.y = 0.35 + Math.sin(t * 0.6 + i) * 0.05;
      // non-active screens recede and dim, so neighbors read as depth layers
      const d = Math.min(1, Math.abs(i - p));
      s.position.z = -1.5 * d;
      s.material.color.setScalar(1 - 0.4 * d);
    });
  }

  dispose() {
    for (const s of this._screens) {
      s.geometry.dispose();
      s.material.map?.dispose();
      s.material.dispose();
    }
  }
}
