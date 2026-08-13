import * as THREE from 'three';
import { buildLogoGeometry, buildLogoOutlineGeometry, buildSideScreenGeometry } from './logo-geometry.js';
import { GLSL_CONSTANTS, GLSL_HASH, GLSL_ROTATE2 } from './shader-lib.js';

/**
 * The glass "A" prism.
 *
 * Look: screen-space refraction — the already-rendered scene is copied to a
 * small backbuffer texture, and the prism bends/chromatically splits it,
 * with a patchy animated frost mask, a GGX highlight from one fixed light,
 * a Schlick fresnel and a studio cubemap reflection.
 *
 * Feel: no dragging. Pointer *movement* near screen centre applies small
 * euler impulses (pitch from vertical motion, yaw from horizontal). The
 * impulse decays each frame and the quaternion slerps home at a
 * per-section return force, so a flick sends the prism tumbling and it
 * settles back upright.
 */

const SECTION_ROTATION = {
  default: { intensity: 0, baseSpeed: 0, returnForce: 2.0, scrollSpin: 0, hoverMult: 0 },
  kv: { intensity: 0, baseSpeed: 0, returnForce: 2.0, scrollSpin: 0, hoverMult: 1 },
  works_intro: { intensity: 1, baseSpeed: 0.5, returnForce: 0.4, scrollSpin: 0.001, hoverMult: 0.2 },
  works: { intensity: 1, baseSpeed: 0.5, returnForce: 0.1, scrollSpin: 0.001, hoverMult: 0.2 },
  mission: { intensity: 0, baseSpeed: 0, returnForce: 2.0, scrollSpin: 0, hoverMult: 0 },
  vision: { intensity: 0, baseSpeed: 0, returnForce: 1.5, scrollSpin: 0, hoverMult: 0 },
  service: { intensity: 0, baseSpeed: 0, returnForce: 1.8, scrollSpin: 0, hoverMult: 1 }
};

const vert = /* glsl */ `
${GLSL_CONSTANTS}
${GLSL_ROTATE2}
uniform float uVisionRotate;   // vision tilt (shows the side screen)
uniform float uServiceRotate;  // morph toward a fullscreen sheet
uniform float uScreenAspectRatio;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vec3 pos = position;
  vec3 nml = normal;

  // scroll-driven tilts (vision) and the service sheet morph
  float tiltA = (uVisionRotate * 0.15 + uServiceRotate * 0.5) * HPI;
  pos.xz *= rot2(tiltA);
  pos.yz *= rot2(uVisionRotate * -0.1 - uServiceRotate * 0.2);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 projected = projectionMatrix * mv;
  projected.xyz /= projected.w;
  projected.w = 1.0;

  // clip-space sheet the side screen face expands into during service_in
  vec3 sc = position;
#ifdef IS_OUTLINE
  sc -= nml * 0.001;
#endif
  sc.xz *= rot2(HPI);
  vec4 sheet = vec4(
    sc.x * (20.5 + (1.0 / uScreenAspectRatio) * 3.0),
    sc.y * (7.0 + uScreenAspectRatio * 8.0) - 0.22,
    projected.z,
    1.0
  );

  gl_Position = mix(projected, sheet, uServiceRotate);
  vUv = uv;
  vNormal = normalMatrix * nml;
  vViewPos = -mv.xyz;
}
`;

const frag = /* glsl */ `
${GLSL_CONSTANTS}
${GLSL_HASH}
uniform sampler2D uBackTex;     // scene rendered behind the prism
uniform vec2 uBackRes;
uniform sampler2D uNoiseTex;    // shared animated flow noise
uniform samplerCube uEnvMap;
uniform float uRoughness;
uniform float uNoiseScale;
uniform vec3 uMaterialColor;    // 0-255 per channel
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPos;

#define TAPS 8

float ggxSpec(float dNH, float rough) {
  float a2 = rough * rough;
  a2 *= a2;
  float d2 = dNH * dNH;
  if (d2 <= 0.0) return 0.0;
  float denom = d2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

float fresnelSchlick(float d) {
  const float f0 = 0.1;
  return f0 + (1.0 - f0) * pow(1.0 - d, 5.0);
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uBackRes;

  // patchy frost: warp the noise through itself, threshold the result
  vec4 n1 = texture2D(uNoiseTex, vUv * uNoiseScale);
  vec4 n2 = texture2D(uNoiseTex, vUv + (n1.xy - 0.5) * 2.0);
  float rough = smoothstep(0.3, 0.8, n2.y) * uRoughness;

  vec3 N = normalize(vNormal);
  vec2 bend = N.xy * (1.0 - N.z * 0.7);     // foreshorten the bend

  vec3 refracted = vec3(0.0);
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i);
    float slide = 0.010 + hash21(screenUv + fi * 0.2) * 0.012;
    vec2 scatter = (vec2(
      hash21(screenUv + fi * 0.1),
      hash21(screenUv + fi * 0.2)
    ) - 0.5) * rough * 0.3;
    vec2 uvR = scatter + screenUv - bend * (0.1 + slide);
    vec2 uvG = scatter + screenUv - bend * (0.1 + slide * 2.0);
    vec2 uvB = scatter + screenUv - bend * (0.1 + slide * 4.0);
    refracted += vec3(
      texture2D(uBackTex, uvR).r,
      texture2D(uBackTex, uvG).g,
      texture2D(uBackTex, uvB).b
    ) * 0.9;
  }
  refracted /= float(TAPS);

  vec3 col = refracted;

  vec3 V = normalize(vViewPos);
  vec3 L = normalize(vec3(-1.0, 0.8, -1.0));
  vec3 H = normalize(V + L);
  col += ggxSpec(dot(N, H), 0.003 + rough * 0.4);

  float F = fresnelSchlick(dot(V, N));
  vec3 env = textureCube(uEnvMap, reflect(V, N)).rgb;
  col += mix(col, env, F * 0.9) * (1.0 - F);
  col += env * 0.06;   // faint ambient sparkle so the glass never goes dead


  col *= 1.2;
  col *= uMaterialColor / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const outlineFrag = /* glsl */ `
void main() {
#ifdef IS_BASE
  // depth mask in the light scene's bg colour, invisible in colour
  gl_FragColor = vec4(0.8431, 0.8588, 0.8627, 0.0);
#else
  gl_FragColor = vec4(1.0);
#endif
}
`;

const screenFrag = /* glsl */ `
${GLSL_HASH}
uniform sampler2D uSceneTex;       // service scene render target
uniform sampler2D uNoiseTex;
uniform vec2 uScreenResolution;
uniform float uServiceIn;
uniform float uVisionRotate;
uniform float uScreenNoiseScale;
varying vec2 vUv;

vec2 lensWarp(vec2 r, float a) { return r * (1.0 - a * dot(r, r)); }

void main() {
  // narrow slice of local uv (screen sits on a thin flank)
  vec2 geoUv = vUv;
  geoUv.x = (geoUv.x - 0.5) * 0.4 + 0.5;
  vec2 fullUv = gl_FragCoord.xy / uScreenResolution;
  vec2 uv = mix(geoUv, fullUv, pow(uServiceIn, 0.2));

  // holographic shimmer: tri-channel warped noise, kept bright and airy
  vec4 h1 = texture2D(uNoiseTex, geoUv * uScreenNoiseScale);
  vec4 h2 = texture2D(uNoiseTex, geoUv * 0.3 * uScreenNoiseScale + h1.xy * (2.3 + hash21(fullUv) * 0.2));
  vec3 shimmer = pow(h2.xyz, vec3(0.8)) * 1.25 + 0.08;

  // scene sample warps hard early, settles as the sheet fills the screen
  float inv = 1.0 - uServiceIn;
  vec3 scene = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i) / 5.0;
    vec2 wuv = uv + (h2.xy - 0.5) * inv;
    float power = inv * 5.0 + fi * 0.2 * inv;
    scene.r += texture2D(uSceneTex, lensWarp(wuv - 0.5, 1.00 * power) + 0.5).r;
    scene.g += texture2D(uSceneTex, lensWarp(wuv - 0.5, 1.05 * power) + 0.5).g;
    scene.b += texture2D(uSceneTex, lensWarp(wuv - 0.5, 1.10 * power) + 0.5).b;
  }
  scene /= 5.0;
  scene *= 1.0 + inv * 3.0;
  scene *= mix(0.5 + shimmer, vec3(1.0), uServiceIn);

  float w = smoothstep(0.0, smoothstep(0.0, 1.0, h2.z), -h2.y + uServiceIn * 2.0);
  vec3 col = mix(shimmer, scene, w);
  gl_FragColor = vec4(col, smoothstep(0.0, 0.1, uVisionRotate));
}
`;

export class MainLogo extends THREE.Object3D {
  constructor({ noiseTexture, envMap }) {
    super();

    this.params = {
      roughness: 0.1,
      noiseScale: 9.0,
      screenNoiseScale: 1.0,
      color: { r: 255, g: 255, b: 255 },
      quat: { x: 0, y: 0, z: 0, w: 1 }
    };

    this.geometry = buildLogoGeometry();

    this.uniforms = {
      uBackTex: { value: null },
      uBackRes: { value: new THREE.Vector2(1, 1) },
      uNoiseTex: { value: noiseTexture },
      uEnvMap: { value: envMap },
      uRoughness: { value: this.params.roughness },
      uNoiseScale: { value: this.params.noiseScale },
      uMaterialColor: { value: new THREE.Vector3(255, 255, 255) },
      uVisionRotate: { value: 0 },
      uServiceRotate: { value: 0 },
      uScreenAspectRatio: { value: 16 / 9 }
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: this.uniforms,
      transparent: true
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.scale.setScalar(3);
    this.mesh.renderOrder = 101;
    this.add(this.mesh);

    // ---- outline set for the light (mission/vision) scene ----
    this.outlineGroup = new THREE.Group();
    const baseMat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: outlineFrag,
      uniforms: this.uniforms,
      defines: { IS_BASE: 1 },
      transparent: true
    });
    this._outlineBase = new THREE.Mesh(this.geometry, baseMat);
    this._outlineBase.renderOrder = 10;
    this.outlineGroup.add(this._outlineBase);

    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    this._outlineLines = new THREE.LineSegments(buildLogoOutlineGeometry(this.geometry), lineMat);
    this._outlineLines.renderOrder = 11;
    this.outlineGroup.add(this._outlineLines);

    // side screen (drawn in the light scene group too, over the outline)
    this.screenUniforms = {
      uSceneTex: { value: null },
      uNoiseTex: { value: noiseTexture },
      uScreenResolution: { value: new THREE.Vector2(1, 1) },
      uServiceIn: { value: 0 },
      uVisionRotate: { value: 0 },
      uScreenNoiseScale: { value: 1 }
    };
    this.screenMesh = new THREE.Mesh(
      buildSideScreenGeometry(),
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: screenFrag,
        uniforms: { ...this.uniforms, ...this.screenUniforms },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false      // the flank quad must not lose to the base mesh depth
      })
    );
    this.screenMesh.renderOrder = 12;
    this.outlineGroup.add(this.screenMesh);

    this.scale.setScalar(4.0);
    this.position.set(0, -0.15, 0);

    // rotation state
    this._euler = new THREE.Euler();
    this._impulseQ = new THREE.Quaternion();
    this._identity = new THREE.Quaternion();
    this._spinQ = new THREE.Quaternion();
    this._yAxis = new THREE.Vector3(0, 1, 0);
    this._section = 'kv';
    this._worksRotate = 0;        // animated toward section intensity
    this._worksRotateTarget = 0;
    this._pointer = { x: 0, y: 0, px: 0, py: 0, has: false };
  }

  setSection(name) {
    this._section = SECTION_ROTATION[name] ? name : 'default';
    this._worksRotateTarget = SECTION_ROTATION[this._section].intensity;
  }

  /** Latest pointer NDC (+y up). Called every frame with the last event. */
  hover(x, y) {
    if (this._pointer.has) {
      const s = SECTION_ROTATION[this._section];
      const dist = Math.min(1, Math.hypot(x, y));
      const gain = 0.01 * Math.max(0, 1 - dist * 1.5) * s.hoverMult;
      const velX = (x - this._pointer.px) * 10;
      const velY = (y - this._pointer.py) * 10;
      this._euler.x -= velY * gain * (1 - this._worksRotate * 0.7);
      this._euler.y += velX * gain;
    }
    this._pointer.px = x;
    this._pointer.py = y;
    this._pointer.has = true;
  }

  resetQuaternion() {
    this.mesh.quaternion.identity();
    this._euler.set(0, 0, 0);
  }

  update(dt, scrollVelocity) {
    const s = SECTION_ROTATION[this._section];

    // section intensity approaches its target over ~1s
    this._worksRotate += (this._worksRotateTarget - this._worksRotate) * Math.min(1, dt * 3);

    // pointer impulse acts as decaying angular velocity
    this._euler.x *= 1 - dt;
    this._euler.y *= 1 - dt;
    this._impulseQ.setFromEuler(this._euler);
    this.mesh.quaternion.premultiply(this._impulseQ);

    // works auto-spin + scroll-speed spin
    const spin = -dt * s.baseSpeed * this._worksRotate - scrollVelocity * s.scrollSpin;
    if (spin !== 0) {
      this._spinQ.setFromAxisAngle(this._yAxis, spin);
      this.mesh.quaternion.premultiply(this._spinQ);
    }

    // spring home
    this.mesh.quaternion.slerp(
      this._identity,
      Math.min(1, dt * s.returnForce * (1 - this._worksRotate * 0.8))
    );

    // sync outline set pose to the glass mesh
    this.updateWorldMatrix(true, false);
    this.outlineGroup.position.copy(this.position);
    this.outlineGroup.scale.copy(this.scale);
    this._outlineBase.quaternion.copy(this.mesh.quaternion);
    this._outlineBase.scale.setScalar(3);
    this._outlineLines.quaternion.copy(this.mesh.quaternion);
    this._outlineLines.scale.setScalar(3);
    this.screenMesh.quaternion.copy(this.mesh.quaternion);
    this.screenMesh.scale.setScalar(3);

    // HUD params → uniforms
    this.uniforms.uRoughness.value = this.params.roughness;
    this.uniforms.uNoiseScale.value = this.params.noiseScale;
    this.uniforms.uMaterialColor.value.set(
      this.params.color.r, this.params.color.g, this.params.color.b
    );
    this.screenUniforms.uScreenNoiseScale.value = this.params.screenNoiseScale;

    const q = this.mesh.quaternion;
    // keep the readout in the +w hemisphere (same rotation, tidier numbers)
    if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    this.params.quat.x = q.x;
    this.params.quat.y = q.y;
    this.params.quat.z = q.z;
    this.params.quat.w = q.w;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this._outlineBase.material.dispose();
    this._outlineLines.geometry.dispose();
    this._outlineLines.material.dispose();
    this.screenMesh.geometry.dispose();
    this.screenMesh.material.dispose();
  }
}
