import * as THREE from 'three';

/**
 * Canvas-drawn white-on-transparent title textures (our own letterforms):
 *  - XERO wordmark (1204:250 aspect) — tiled on the LED wall + 2D hero plane
 *  - WORKS band (1136:256)
 *  - SERVICES band (1074:192)
 * All original drawings — blocky geometric caps built from primitives.
 */

function canvasTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Blocky geometric caps drawn from rectangles/polygons. */
function drawLetter(ctx, ch, x, y, w, h, stroke) {
  const s = stroke;
  const r = (rx, ry, rw, rh) => ctx.fillRect(x + rx, y + ry, rw, rh);
  switch (ch) {
    case 'A': {
      // triangular A with hollow triangular counter — echoes the logo mark
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      const cw = w * 0.42, chh = h * 0.42;
      const cx = x + w / 2, cy = y + h * 0.5;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - cw / 2, cy + chh);
      ctx.lineTo(cx + cw / 2, cy + chh);
      ctx.closePath();
      ctx.fill('evenodd');
      break;
    }
    case 'L':
      r(0, 0, s, h);
      r(0, h - s, w, s);
      break;
    case 'C':
      r(0, 0, w, s);
      r(0, 0, s, h);
      r(0, h - s, w, s);
      break;
    case 'H':
      r(0, 0, s, h);
      r(w - s, 0, s, h);
      r(0, (h - s) / 2, w, s);
      break;
    case 'E':
      r(0, 0, s, h);
      r(0, 0, w, s);
      r(0, (h - s) / 2, w * 0.82, s);
      r(0, h - s, w, s);
      break;
    case 'W': {
      const t = s * 0.9;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + t, y); ctx.lineTo(x + w * 0.3, y + h); ctx.lineTo(x + w * 0.3 - t, y + h); ctx.closePath();
      ctx.moveTo(x + w * 0.3 - t, y + h); ctx.lineTo(x + w * 0.3, y + h); ctx.lineTo(x + w * 0.5 + t / 2, y + h * 0.25); ctx.lineTo(x + w * 0.5 - t / 2, y + h * 0.25); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w - t, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.7, y + h); ctx.lineTo(x + w * 0.7 - t, y + h); ctx.closePath();
      ctx.moveTo(x + w * 0.7 - t, y + h); ctx.lineTo(x + w * 0.7, y + h); ctx.lineTo(x + w * 0.5 + t / 2, y + h * 0.25); ctx.lineTo(x + w * 0.5 - t / 2, y + h * 0.25); ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'O':
      r(0, 0, w, s);
      r(0, h - s, w, s);
      r(0, 0, s, h);
      r(w - s, 0, s, h);
      break;
    case 'R':
      r(0, 0, s, h);
      r(0, 0, w, s);
      r(w - s, 0, s, h * 0.5);
      r(0, h * 0.5 - s / 2, w, s);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.45, y + h * 0.5);
      ctx.lineTo(x + w * 0.45 + s, y + h * 0.5);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - s, y + h);
      ctx.closePath();
      ctx.fill();
      break;
    case 'K':
      r(0, 0, s, h);
      ctx.beginPath();
      ctx.moveTo(x + s, y + h * 0.5);
      ctx.lineTo(x + w - s, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + s * 1.6, y + h * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + s, y + h * 0.5);
      ctx.lineTo(x + s * 1.6, y + h * 0.45);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - s, y + h);
      ctx.closePath();
      ctx.fill();
      break;
    case 'S': {
      r(0, 0, w, s);
      r(0, 0, s, h * 0.5);
      r(0, (h - s) / 2, w, s);
      r(w - s, h * 0.5, s, h * 0.5);
      r(0, h - s, w, s);
      break;
    }
    case 'V':
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + s, y);
      ctx.lineTo(x + w / 2 + s / 2, y + h); ctx.lineTo(x + w / 2 - s / 2, y + h);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y);
      ctx.lineTo(x + w / 2 + s / 2, y + h); ctx.lineTo(x + w / 2 - s / 2, y + h);
      ctx.closePath(); ctx.fill();
      break;
    case 'I':
      r((w - s) / 2, 0, s, h);
      break;
    default:
      break;
  }
}

function drawX(ctx, x, y, w, h) {
  // blocky X matching the 3D mark: tips on the corners, notched centre
  const tx = 0.34 * w;
  const ty = 0.34 * h;
  const sTop = (w / 2 - tx) / (w - tx);
  const ncY = (h / 2) - sTop * (h - ty);
  const sSide = (h / 2 - ty) / (h - ty);
  const ncX = (w / 2) - sSide * (w - tx);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts = [
    [-w / 2, -h / 2], [-w / 2 + tx, -h / 2], [0, -ncY], [w / 2 - tx, -h / 2], [w / 2, -h / 2],
    [w / 2, -h / 2 + ty], [ncX, 0], [w / 2, h / 2 - ty], [w / 2, h / 2],
    [w / 2 - tx, h / 2], [0, ncY], [-w / 2 + tx, h / 2], [-w / 2, h / 2],
    [-w / 2, h / 2 - ty], [-ncX, 0], [-w / 2, -h / 2 + ty]
  ];
  ctx.beginPath();
  ctx.moveTo(cx + pts[0][0], cy + pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(cx + pts[i][0], cy + pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

function drawWord(word, W, H, letterH, weights = {}) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';

  const stroke = letterH * (weights.stroke ?? 0.24);
  const gap = letterH * (weights.gap ?? 0.16);
  const widths = { A: 1.15, W: 1.35, M: 1.3, I: 0.34, L: 0.82, C: 0.92, H: 1.0, E: 0.9, O: 1.0, R: 0.95, K: 1.0, S: 0.92, V: 1.1, X: 1.1 };

  let total = 0;
  for (const ch of word) total += letterH * (widths[ch] ?? 1) + gap;
  total -= gap;

  let x = (W - total) / 2;
  const y = (H - letterH) / 2;
  for (const ch of word) {
    const w = letterH * (widths[ch] ?? 1);
    if (ch === 'X') drawX(ctx, x, y, w, letterH);
    else drawLetter(ctx, ch, x, y, w, letterH, stroke);
    x += w + gap;
  }
  return c;
}

export function createBrandWordmarkTexture() {
  // "XERO" — the X echoes the 3D mark, like the reference's triangular A
  return canvasTexture(drawWord('XERO', 1204, 250, 190, { stroke: 0.22, gap: 0.2 }));
}

export function createWorksTitleTexture() {
  // leave breathing room above/below so the wall band reads as letter rows
  return canvasTexture(drawWord('WORKS', 1136, 256, 150, { stroke: 0.2, gap: 0.14 }));
}

export function createServicesTitleTexture() {
  return canvasTexture(drawWord('SERVICES', 1074, 192, 148, { stroke: 0.24, gap: 0.12 }));
}
