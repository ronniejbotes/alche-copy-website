import * as THREE from 'three';

/**
 * Procedural tileable value-noise textures (no external assets).
 * Used for the glass logo's normal perturbation ("noiseScale" in the
 * MainLogo Material panel) and anywhere a grunge mask is needed.
 */

function makeValueNoise(size, octaves = 4) {
  // base random grid, bilinear-sampled with wrapping so the result tiles
  const base = 32;
  const grid = new Float32Array(base * base);
  let seed = 1337;
  const rand = () => {
    // deterministic LCG so rebuilds are stable
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  const sample = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const g = (ix, iy) => grid[((iy % base + base) % base) * base + ((ix % base + base) % base)];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };

  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 0.5, freq = 4, v = 0;
      for (let o = 0; o < octaves; o++) {
        v += amp * sample((x / size) * freq, (y / size) * freq);
        amp *= 0.5; freq *= 2;
      }
      data[y * size + x] = v;
    }
  }
  return data;
}

/** Grayscale noise texture (heightmap style). */
export function createNoiseTexture(size = 256) {
  const height = makeValueNoise(size);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(height[i] * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Normal map derived from the same heightmap (sobel), for glass distortion. */
export function createNoiseNormalTexture(size = 256, strength = 2.2) {
  const h = makeValueNoise(size);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(((-dx * inv) * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((-dy * inv) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
