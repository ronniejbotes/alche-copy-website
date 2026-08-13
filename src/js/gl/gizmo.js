import * as THREE from 'three';

/**
 * Viewport axis gizmo (top-right HUD): a tiny standalone renderer showing
 * the logo's current orientation as an XYZ triad — X red, Y green, Z blue —
 * like an editor viewport widget.
 */

function axisLabelSprite(text, colorCss) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '700 34px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colorCss;
  ctx.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  spr.scale.setScalar(0.42);
  return spr;
}

export class AxisGizmo {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(container.clientWidth || 110, container.clientHeight || 110);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
    this.camera.position.set(0, 0, 3.4);

    this.triad = new THREE.Group();
    this.scene.add(this.triad);

    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xe23b3b, label: 'X', css: '#e25555' },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x3be23b, label: 'Y', css: '#55e255' },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x3b6be2, label: 'Z', css: '#5577e2' }
    ];

    for (const a of axes) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        a.dir.clone().multiplyScalar(0.85)
      ]);
      this.triad.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: a.color })));

      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshBasicMaterial({ color: a.color })
      );
      tip.position.copy(a.dir).multiplyScalar(0.85);
      this.triad.add(tip);

      const label = axisLabelSprite(a.label, a.css);
      label.position.copy(a.dir).multiplyScalar(1.22);
      this.triad.add(label);
    }

    // center ball
    this.triad.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xbbbbbb })
      )
    );
  }

  /** Sync to the logo's quaternion so the triad mirrors the drag. */
  update(quaternion) {
    // Skip the render when the orientation hasn't changed
    if (this._lastQ && this._lastQ.equals(quaternion)) return;
    this._lastQ = (this._lastQ || quaternion.clone()).copy(quaternion);
    this.triad.quaternion.copy(quaternion);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
