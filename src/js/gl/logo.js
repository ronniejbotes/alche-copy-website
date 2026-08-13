import * as THREE from 'three';
import { createNoiseNormalTexture } from './noise.js';

/**
 * MainLogo: the glass triangle mark + the wordmark "screen" behind it.
 * All geometry & textures are generated procedurally.
 *
 * Interaction model (mirrors the original site's feel):
 *  - pointer drag applies a rotation quaternion with inertia
 *  - on release the quaternion springs back to identity
 *  - live values are exposed on `this.params.quat` for the Tweakpane HUD
 */

const TAU = Math.PI * 2;

function triangleShape(size, cornerRadius = 0.06) {
  // Equilateral triangle centered on origin, slightly rounded corners
  const shape = new THREE.Shape();
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 3;
    pts.push(new THREE.Vector2(Math.cos(a) * size, -Math.sin(a) * size));
  }
  const r = cornerRadius * size;
  for (let i = 0; i < 3; i++) {
    const prev = pts[(i + 2) % 3];
    const curr = pts[i];
    const next = pts[(i + 1) % 3];
    const inA = curr.clone().sub(prev).normalize();
    const outA = next.clone().sub(curr).normalize();
    const p1 = curr.clone().sub(inA.clone().multiplyScalar(r));
    const p2 = curr.clone().add(outA.clone().multiplyScalar(r));
    if (i === 0) shape.moveTo(p1.x, p1.y);
    else shape.lineTo(p1.x, p1.y);
    shape.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
  }
  shape.closePath();
  return { shape, pts };
}

function buildMarkGeometry(size = 2.1) {
  const { shape } = triangleShape(size);
  const inner = triangleShape(size * 0.44).shape;
  const hole = new THREE.Path();
  hole.setFromPoints(inner.getPoints(24).reverse());
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 24
  });
  geo.center();
  return geo;
}

/** Draw the ALCHE wordmark on a canvas — angular A glyphs, blocky caps. */
function buildWordmarkTexture() {
  const W = 2048, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';

  const letterH = 300;
  const y0 = (H - letterH) / 2;
  const stroke = 74;                  // stem thickness
  const gap = 56;
  let x = 60;

  const rect = (rx, ry, rw, rh) => ctx.fillRect(rx, ry, rw, rh);

  const drawA = (w) => {
    // Triangle 'A' with a triangular counter — echoes the logo mark
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y0);
    ctx.lineTo(x + w, y0 + letterH);
    ctx.lineTo(x, y0 + letterH);
    ctx.closePath();
    // counter
    const cw = w * 0.36, ch = letterH * 0.42;
    const cx = x + w / 2, cy = y0 + letterH * 0.52;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - cw / 2, cy + ch);
    ctx.lineTo(cx + cw / 2, cy + ch);
    ctx.closePath();
    ctx.fill('evenodd');
    x += w + gap;
  };
  const drawL = (w) => {
    rect(x, y0, stroke, letterH);
    rect(x, y0 + letterH - stroke, w, stroke);
    x += w + gap;
  };
  const drawC = (w) => {
    rect(x, y0, w, stroke);
    rect(x, y0, stroke, letterH);
    rect(x, y0 + letterH - stroke, w, stroke);
    x += w + gap;
  };
  const drawH = (w) => {
    rect(x, y0, stroke, letterH);
    rect(x + w - stroke, y0, stroke, letterH);
    rect(x, y0 + (letterH - stroke) / 2, w, stroke);
    x += w + gap;
  };
  const drawE = (w) => {
    rect(x, y0, stroke, letterH);
    rect(x, y0, w, stroke);
    rect(x, y0 + (letterH - stroke) / 2, w * 0.86, stroke);
    rect(x, y0 + letterH - stroke, w, stroke);
    x += w + gap;
  };

  drawA(360); drawL(280); drawC(300); drawH(330); drawE(300);

  const totalW = x - gap + 60;
  // recenter horizontally by copying onto a fresh canvas
  const c2 = document.createElement('canvas');
  c2.width = W; c2.height = H;
  const ctx2 = c2.getContext('2d');
  ctx2.drawImage(c, (W - totalW) / 2, 0);

  const tex = new THREE.CanvasTexture(c2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class MainLogo extends THREE.Object3D {
  constructor() {
    super();

    this.params = {
      roughness: 0.1,
      noiseScale: 9.0,
      color: { r: 255, g: 255, b: 255 },
      quat: { x: 0, y: 0, z: 0, w: 1 },
      returnForce: 1.8
    };

    this._normalTex = createNoiseNormalTexture(256);
    this._normalTex.repeat.set(3, 3);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: this.params.roughness,
      transmission: 1,
      thickness: 1.4,
      ior: 1.45,
      attenuationColor: new THREE.Color(0xffffff),
      attenuationDistance: 4,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      specularIntensity: 1.2,
      normalMap: this._normalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      envMapIntensity: 2.4,
      // FrontSide: DoubleSide on a transmissive material doubles the
      // transmission pass every frame for no visual gain on a closed mesh.
      side: THREE.FrontSide
    });

    this.mesh = new THREE.Mesh(buildMarkGeometry(), this.material);
    this.add(this.mesh);

    // Faint edge outline (the original carries outline meshes over the glass)
    const edges = new THREE.EdgesGeometry(this.mesh.geometry, 24);
    this.outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
    );
    this.add(this.outline);

    // Specular interest for the glass (transmission needs highlights to read)
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(4, 6, 6);
    this.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.4);
    rim.position.set(-5, -2, 4);
    this.add(rim);

    // Wordmark screen behind the glass so refraction bends it
    this._wordTex = buildWordmarkTexture();
    const screenGeo = new THREE.PlaneGeometry(15.8, 3.95);
    this.screen = new THREE.Mesh(
      screenGeo,
      new THREE.MeshBasicMaterial({
        map: this._wordTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false
      })
    );
    this.screen.position.z = -2.6;
    this.add(this.screen);

    // drag state
    this._dragging = false;
    this._velocity = new THREE.Vector2();
    this._identity = new THREE.Quaternion();
    this._tmpQ = new THREE.Quaternion();
    this._tmpAxis = new THREE.Vector3();
  }

  /* ---------- interaction ---------- */

  pointerDown() {
    this._dragging = true;
    this._velocity.set(0, 0);
  }

  pointerMove(dx, dy) {
    if (!this._dragging) return;
    this._applyDelta(dx, dy);
    this._velocity.set(dx, dy);
  }

  pointerUp() {
    this._dragging = false;
  }

  _applyDelta(dx, dy) {
    const angle = Math.sqrt(dx * dx + dy * dy) * 0.008;
    if (angle < 1e-6) return;
    this._tmpAxis.set(dy, dx, 0).normalize();
    this._tmpQ.setFromAxisAngle(this._tmpAxis, angle);
    this.mesh.quaternion.premultiply(this._tmpQ);
  }

  resetQuaternion() {
    this.mesh.quaternion.identity();
    this._velocity.set(0, 0);
  }

  /* ---------- per-frame ---------- */

  update(dt, t) {
    // inertia + spring return
    if (!this._dragging) {
      if (this._velocity.lengthSq() > 0.01) {
        this._applyDelta(this._velocity.x, this._velocity.y);
        this._velocity.multiplyScalar(Math.pow(0.94, dt * 60));
      }
      const k = 1 - Math.exp(-this.params.returnForce * dt);
      this.mesh.quaternion.slerp(this._identity, k);
    }
    this.outline.quaternion.copy(this.mesh.quaternion);

    // idle float
    this.position.y = Math.sin(t * 0.5) * 0.06;

    // material params from the HUD
    this.material.roughness = this.params.roughness;
    const s = Math.max(0.001, this.params.noiseScale / 3);
    this._normalTex.repeat.set(s, s);
    this._normalTex.offset.x = t * 0.008;
    this.material.color.setRGB(
      this.params.color.r / 255,
      this.params.color.g / 255,
      this.params.color.b / 255
    );

    // live quaternion readout for the HUD
    const q = this.mesh.quaternion;
    this.params.quat.x = q.x;
    this.params.quat.y = q.y;
    this.params.quat.z = q.z;
    this.params.quat.w = q.w;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.outline.geometry.dispose();
    this.outline.material.dispose();
    this.screen.geometry.dispose();
    this.screen.material.dispose();
    this._normalTex.dispose();
    this._wordTex.dispose();
  }
}
