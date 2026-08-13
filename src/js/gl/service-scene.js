import * as THREE from 'three';
import { GLSL_CONSTANTS, GLSL_ROTATE2 } from './shader-lib.js';
import { GridOverlay } from './grid-overlay.js';

/**
 * The service scene: three reel panels riding a sine-wave wall that
 * un-curls as the section enters, a ghost "SERVICES" title band scrolling
 * behind them with a dim projection of the current reel, and the third
 * panel (stellla) peeling off the wall into a fullscreen cover-fit quad.
 */

const panelVert = /* glsl */ `
${GLSL_CONSTANTS}
${GLSL_ROTATE2}
uniform float uInstanceId;
uniform float uThumbnailScroll;  // 0.5..4 smoothed
uniform float uServiceIn;        // wall un-curl
uniform float uStelllaIn;        // stellla section entering
uniform float uStelllaView;      // 0..1 peel to fullscreen
uniform vec3 uScale;             // frustum extents at z=0
uniform float uCanvasAspect;
uniform float uVideoAspect;
varying vec2 vUv;
varying vec2 vLocal;

vec2 coverUv(vec2 uv, float canvasA, float videoA) {
  vec2 t = uv - 0.5;
  if (canvasA > videoA) {
    t.y *= videoA / canvasA;
  } else {
    t.x *= canvasA / videoA;
  }
  return t + 0.5;
}

void main() {
  float x = uInstanceId - (uThumbnailScroll - 1.0);

  // plane geometry already carries the 16:9 aspect — scale it uniformly
  vec2 local = position.xy * 0.55;
  local.x += x * 1.9;
  local.x += -0.05 * (1.0 - uStelllaIn);

  // phase scaled so one panel spans ~half a sine period (gentle bend,
  // not an hourglass) while adjacent panels still sit a near-full phase apart
  float theta = local.x * PI * 0.5 + (1.0 - uServiceIn) * 8.0 - uStelllaIn * 2.0;
  float wave = 4.0 * uServiceIn * (1.0 - uStelllaIn);

  vec3 pos = vec3(local.x * uScale.x * 0.5, local.y * uScale.y * 0.5, -sin(theta) * wave);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  vUv = uv;
  vLocal = uv - 0.5;

#ifdef IS_STELLLA
  // left-to-right per-vertex peel into a screen-covering quad
  float curve = 0.3;
  float w = smoothstep(0.0, 1.0, -uv.x * curve + uStelllaView * (1.0 + curve));
  clip = mix(clip, vec4(position.xy * 2.0, 0.0, 1.0), w);
  vUv = mix(vUv, coverUv(uv, uCanvasAspect, uVideoAspect), w);
#endif

  gl_Position = clip;
}
`;

const panelFrag = /* glsl */ `
uniform sampler2D uTex;
uniform float uServiceIn;
varying vec2 vUv;
varying vec2 vLocal;
void main() {
  vec3 col = texture2D(uTex, vUv).rgb;
#ifndef IS_STELLLA
  col *= smoothstep(1.0, 0.3, length(vLocal));
#endif
  col *= 0.7;
  gl_FragColor = vec4(col, smoothstep(0.5, 1.0, uServiceIn));
}
`;

const titleVert = /* glsl */ `
${GLSL_CONSTANTS}
uniform vec3 uScale;
varying vec2 vUv;
void main() {
  vec3 pos = vec3(position.x * uScale.x, position.y * uScale.y, -2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vUv = uv;
}
`;

const titleFrag = /* glsl */ `
uniform sampler2D uTitleTex;
uniform sampler2D uVideoTex;
uniform float uTime;
uniform float uThumbnailScroll;
uniform float uServiceIn;
varying vec2 vUv;
void main() {
  vec2 t = vUv;
  t.y *= 2.4;   // big letter rows — the tunnel fly-through reads as huge type
  t.x *= 1.1;
  t.x += uThumbnailScroll * 0.2 + uTime * 0.015;
  vec4 glyph = texture2D(uTitleTex, fract(t));
  vec3 col = vec3(glyph.a) * 0.8 * (1.0 - smoothstep(0.4, 1.0, vUv.x) * uServiceIn);
  // burn brighter while the tunnel is still opening (the sheet samples this)
  col *= 1.0 + (1.0 - uServiceIn) * 1.6;
  // blurred echo of the active reel lights the whole wall, stronger left
  col += texture2D(uVideoTex, vUv).rgb * mix(0.38, 0.16, vUv.x);
  // the ghost wall clears out as stellla takes over
  col *= 1.0 - uStelllaIn * 0.92;
  gl_FragColor = vec4(col * 0.7, 1.0);
}
`;

export class ServiceScene {
  constructor(media, { servicesTitleTexture }) {
    this.media = media;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    this.uniformsShared = {
      uThumbnailScroll: { value: 0.5 },
      uServiceIn: { value: 0 },
      uStelllaIn: { value: 0 },
      uStelllaView: { value: 0 },
      uScale: { value: new THREE.Vector3(14.8, 8.3, 1) }
    };

    this.panels = [];
    for (let i = 0; i < 3; i++) {
      const isStellla = i === 2;
      const uniforms = {
        // 0-based: reel i sits centred when uThumbnailScroll = i + 1
        uInstanceId: { value: i },
        uTex: { value: media.serviceTexture(i) },
        uCanvasAspect: { value: 16 / 9 },
        uVideoAspect: { value: 16 / 9 },
        ...this.uniformsShared
      };
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2 * (9 / 16), 16, 8),
        new THREE.ShaderMaterial({
          vertexShader: panelVert,
          fragmentShader: panelFrag,
          uniforms,
          transparent: true,
          side: THREE.DoubleSide,
          defines: isStellla ? { IS_STELLLA: 1 } : {},
          depthWrite: false
        })
      );
      mesh.renderOrder = isStellla ? 5 : 2;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.panels.push(mesh);
    }

    // ghost SERVICES band + reel projection behind the panels
    this.titleUniforms = {
      uTitleTex: { value: servicesTitleTexture },
      uVideoTex: { value: media.serviceTexture(0) },
      uTime: { value: 0 },
      uThumbnailScroll: this.uniformsShared.uThumbnailScroll,
      uServiceIn: this.uniformsShared.uServiceIn,
      uScale: this.uniformsShared.uScale
    };
    this.titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: titleVert,
        fragmentShader: titleFrag,
        uniforms: this.titleUniforms,
        depthWrite: false
      })
    );
    this.titleMesh.renderOrder = 0;
    this.titleMesh.frustumCulled = false;
    this.scene.add(this.titleMesh);

    this.grid = new GridOverlay({ dark: false, cylinder: true });
    this.grid.uniforms.uGrid.value.set(75, 50);
    this.scene.add(this.grid.group);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const fh = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const fw = fh * this.camera.aspect;
    this.uniformsShared.uScale.value.set(fw, fh, 1);
    this.grid.resize(this.camera);
    for (const p of this.panels) {
      p.material.uniforms.uCanvasAspect.value = w / h;
    }
  }

  /**
   * @param {number} thumbScroll 0.5..4 smoothed reel position
   * @param {number} serviceIn   0..1 wall un-curl
   * @param {number} stelllaIn   0..1 stellla enter
   * @param {number} stelllaView 0..1 fullscreen peel
   */
  update(t, thumbScroll, serviceIn, stelllaIn, stelllaView) {
    this.uniformsShared.uThumbnailScroll.value = Math.min(3, thumbScroll);
    this.uniformsShared.uServiceIn.value = serviceIn;
    this.uniformsShared.uStelllaIn.value = stelllaIn;
    this.uniformsShared.uStelllaView.value = stelllaView;
    this.titleUniforms.uTime.value = t;
    const reel = Math.max(0, Math.min(2, Math.round(thumbScroll - 1)));
    this.titleUniforms.uVideoTex.value = this.media.serviceTexture(reel);
    this.grid.setScroll(t * 0.01 + thumbScroll * 0.3);
  }

  dispose() {
    for (const p of this.panels) {
      p.geometry.dispose();
      p.material.dispose();
    }
    this.titleMesh.geometry.dispose();
    this.titleMesh.material.dispose();
    this.grid.dispose();
  }
}
