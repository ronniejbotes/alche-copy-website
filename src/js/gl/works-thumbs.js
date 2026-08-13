import * as THREE from 'three';
import { buildThumbnailScreenGeometry } from './logo-geometry.js';
import { GLSL_CONSTANTS } from './shader-lib.js';

/**
 * The six works "screens": rounded 16:9 slabs flying a spiral carousel in
 * their own transparent scene, drawn over the composited main scene.
 * Per screen: 4-tap chromatic lens distortion, vignette, subtle env tint.
 * Layout (k = index + 1 - smoothed position):
 *   x = sin(k)*11, z = cos(k)*5 - 6, y = -k, rotY = k*0.6,
 *   scale = 0.9 + 0.2*(1 - min(1,|k|)),
 *   alpha = (1 - smoothstep(|k|, 0.8, 2.5)) * edge fades.
 */

const vert = /* glsl */ `
${GLSL_CONSTANTS}
uniform float uTexAspect;
varying vec2 vUv;
varying vec2 vMeshUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 pos = position;
  // keep some slab thickness and bow it like a curved LED panel —
  // horizontal cylinder bend plus a slight vertical barrel
  pos.z *= 0.6;
  pos.z += cos(pos.x / 4.0 * PI * 0.35) * 2.2 - 1.6;
  pos.z += cos(pos.y / 2.24 * PI * 0.3) * 0.5 - 0.42;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  vMeshUv = uv;
  // contain-fit the artwork into the 16:9 face
  const float MESH_ASPECT = 16.0 / 9.0;
  vec2 t = uv;
  if (uTexAspect > MESH_ASPECT) {
    t.y = (t.y - 0.5) * (uTexAspect / MESH_ASPECT) + 0.5;
  } else {
    t.x = (t.x - 0.5) / (uTexAspect / MESH_ASPECT) + 0.5;
  }
  vUv = t;
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
}
`;

const frag = /* glsl */ `
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uLoaded;
uniform float uScrollVelocity;
varying vec2 vUv;
varying vec2 vMeshUv;
varying vec3 vNormal;
varying vec3 vViewDir;

vec2 lensWarp(vec2 r, float a) { return r * (1.0 - a * dot(r, r)); }

void main() {
  float facing = abs(dot(vNormal, vViewDir));
  vec2 normalOffset = -vNormal.xy * 0.5 * smoothstep(0.8, 1.0, 1.0 - facing);

  vec2 cuv = (vUv - 0.5);
  cuv *= 1.3;
  cuv.x *= 0.9;
  cuv.x += uScrollVelocity * 0.15;

  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float base = 0.1 + float(i) / 4.0 * 0.03;
    col.r += texture2D(uTex, lensWarp(cuv, base + 0.10) + 0.5 + normalOffset * 1.00).r;
    col.g += texture2D(uTex, lensWarp(cuv, base + 0.12) + 0.5 + normalOffset * 1.01).g;
    col.b += texture2D(uTex, lensWarp(cuv, base + 0.14) + 0.5 + normalOffset * 1.02).b;
  }
  col /= 4.0;

  col *= smoothstep(0.9, 0.49, length(vMeshUv - 0.5));
  col = mix(col, vec3(smoothstep(0.0, 0.2, vViewDir.x)), 0.05);

  gl_FragColor = vec4(col, uAlpha * uLoaded);
}
`;

export class WorksThumbs {
  constructor(media, { onPick } = {}) {
    this.media = media;
    this.count = media.count;
    this.group = new THREE.Group();
    this.group.position.set(0, 0.8, 0);
    // 0.6 is the portrait/mobile layout value — desktop runs full size so the
    // active screen dominates (~half the viewport) and neighbours clip at the edges
    this.group.scale.setScalar(1.0);
    this.onPick = onPick;

    const geo = buildThumbnailScreenGeometry();
    this.screens = [];
    for (let i = 0; i < this.count; i++) {
      const uniforms = {
        uTex: { value: media.workTexture(i) },
        uTexAspect: { value: media.workAspect(i) },
        uAlpha: { value: 0 },
        uLoaded: { value: 1 },
        uScrollVelocity: { value: 0 }
      };
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false
      }));
      mesh.userData.workIndex = i;
      mesh.visible = false;
      this.group.add(mesh);
      this.screens.push(mesh);
    }
  }

  /** u: smoothed carousel position 0..count+1; vel: smoothed velocity. */
  update(u, vel) {
    const fadeIn = Math.min(1, u * 2);
    const fadeOut = Math.min(1, (this.count + 1 - u) * 2);
    for (let i = 0; i < this.count; i++) {
      const mesh = this.screens[i];
      const k = i + 1 - u;
      const ak = Math.abs(k);
      const alpha = (1 - THREE.MathUtils.smoothstep(ak, 0.8, 2.5)) * fadeIn * fadeOut;
      mesh.visible = alpha > 0.004;
      if (!mesh.visible) continue;
      mesh.position.set(Math.sin(k) * 11, -k, Math.cos(k) * 5 - 6);
      mesh.rotation.y = k * 0.6;
      mesh.scale.setScalar(0.9 + 0.2 * (1 - Math.min(1, ak)));
      mesh.material.uniforms.uAlpha.value = alpha;
      mesh.material.uniforms.uScrollVelocity.value = vel;
    }
  }

  pickAt(raycaster) {
    const hits = raycaster.intersectObjects(this.screens.filter((s) => s.visible), false);
    return hits.length ? hits[0].object.userData.workIndex : -1;
  }

  dispose() {
    for (const s of this.screens) s.material.dispose();
    this.screens[0]?.geometry.dispose();
  }
}
