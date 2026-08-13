import { Pane } from 'tweakpane';
import * as RotationPlugin from '@0b5vr/tweakpane-plugin-rotation';

/**
 * The on-page debug HUD — real Tweakpane panels wired to the live scene,
 * shipped as a deliberate design element:
 *  - "MainLogo Material": roughness / noiseScale / color
 *  - "MainLogo Screen":   noiseScale (vision section)
 *  - "MainLogo Quaternion": live rotation gizmo + Reset button
 */

export function buildPanels(gl) {
  if (!gl.logo) return null;
  const params = gl.logo.params;
  const panes = [];

  const matEl = document.getElementById('pane-material');
  if (matEl) {
    const pane = new Pane({ container: matEl, title: 'MainLogo Material' });
    pane.addBinding(params, 'roughness', { min: 0, max: 1, step: 0.01 });
    pane.addBinding(params, 'noiseScale', { min: 0.1, max: 20, step: 0.1 });
    pane.addBinding(params, 'color', { view: 'color', picker: 'inline', expanded: false });
    panes.push(pane);
  }

  const screenEl = document.getElementById('pane-screen');
  if (screenEl) {
    const pane = new Pane({ container: screenEl, title: 'MainLogo Screen' });
    pane.addBinding(params, 'screenNoiseScale', {
      label: 'noiseScale', min: 0.1, max: 5, step: 0.1
    });
    panes.push(pane);
  }

  const quatEl = document.getElementById('pane-quaternion');
  if (quatEl) {
    const pane = new Pane({ container: quatEl, title: 'MainLogo Quaternion' });
    pane.registerPlugin(RotationPlugin);
    try {
      pane.addBinding(params, 'quat', {
        view: 'rotation',
        rotationMode: 'quaternion',
        picker: 'inline',
        expanded: true,
        step: 0.001
      });
    } catch {
      // plugin API mismatch — fall back to numeric readouts
      const fmt = { readonly: true, format: (v) => v.toFixed(2), interval: 60 };
      pane.addBinding(params.quat, 'x', fmt);
      pane.addBinding(params.quat, 'y', fmt);
      pane.addBinding(params.quat, 'z', fmt);
      pane.addBinding(params.quat, 'w', fmt);
    }
    pane.addButton({ title: 'Reset Quaternion' }).on('click', () => gl.logo.resetQuaternion());
    panes.push(pane);
  }

  // keep the quaternion widget in sync with the live value
  const quatPane = panes[panes.length - 1];
  const sync = setInterval(() => quatPane?.refresh(), 100);

  return {
    dispose() {
      clearInterval(sync);
      panes.forEach((p) => p.dispose());
    }
  };
}
