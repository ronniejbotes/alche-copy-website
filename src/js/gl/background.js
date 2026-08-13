import * as THREE from 'three';

/**
 * The curved "LED wall" surrounding the scene: an inverted sphere whose
 * fragment shader draws an animated black/white flow-noise zebra pattern,
 * quantized into a panel grid with thin seams and a subtle dot matrix —
 * everything procedural, no textures.
 */

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uDim;        // 0 = full brightness, 1 = almost black
  uniform float uNoiseScale; // zebra frequency
  uniform vec2 uGrid;        // panel grid density

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(19.7, 7.3);
      a *= 0.5;
    }
    return v;
  }
  // 3-octave variant for the domain warp — it feeds another fbm, so the
  // high octaves are invisible and just cost transcendentals.
  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(19.7, 7.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Aspect-corrected coords on the sphere interior
    vec2 p = vUv * vec2(4.0, 2.0);

    // Domain-warped fbm -> smooth scalar field, stretched so bands elongate
    vec2 warp = vec2(
      fbm3(p * 1.2 + uTime * 0.016),
      fbm3(p * 1.2 - uTime * 0.011 + 5.2)
    );
    vec2 ps = vec2(p.x * 0.55, p.y * 1.25);
    float field = fbm(ps * uNoiseScale * 0.32 + warp * 2.6);

    // Zebra: sharp parallel-ish bands carved from the field
    float band = sin(field * 24.0 + uTime * 0.10);
    float zebra = smoothstep(-0.05, 0.22, band);

    // Panel grid: seams + faint per-cell brightness variation
    vec2 cell = vUv * uGrid;
    vec2 cellId = floor(cell);
    vec2 cellUv = fract(cell);
    float seam = smoothstep(0.0, 0.045, cellUv.x) * smoothstep(1.0, 0.955, cellUv.x)
               * smoothstep(0.0, 0.06, cellUv.y) * smoothstep(1.0, 0.94, cellUv.y);
    float cellJitter = 0.85 + 0.15 * hash(cellId);

    // LED dot matrix inside each cell
    vec2 dotUv = fract(cellUv * 14.0) - 0.5;
    float dots = 1.0 - smoothstep(0.28, 0.5, length(dotUv));
    float ledMask = mix(0.75, 1.0, dots);

    // Occasional glitch row flicker
    float rowFlick = step(0.985, hash(vec2(cellId.y, floor(uTime * 2.0)))) * 0.35;

    float lum = zebra * seam * cellJitter * ledMask;
    lum = lum * 0.92 + rowFlick * seam;

    // Vignette toward poles/back, and global dim control
    float vig = smoothstep(0.02, 0.28, vUv.y) * smoothstep(0.98, 0.72, vUv.y);
    lum *= mix(0.35, 1.0, vig);
    lum *= (1.0 - uDim);

    vec3 col = vec3(lum) * 0.82;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class BackgroundWall {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uDim: { value: 0 },
      uNoiseScale: { value: 9.0 },
      uGrid: { value: new THREE.Vector2(46, 20) }
    };
    const geo = new THREE.SphereGeometry(26, 48, 32);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.y = Math.PI * 0.5;
  }

  update(t) {
    this.uniforms.uTime.value = t;
  }

  setDim(d) {
    this.uniforms.uDim.value = d;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
