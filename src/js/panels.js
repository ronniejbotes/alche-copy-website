import { Pane } from 'tweakpane';

/**
 * The on-page debug HUD — real Tweakpane panels wired to the live scene,
 * shipped as a deliberate design element (as on the original site).
 */

export function buildPanels(gl) {
  if (!gl.logo) return null;
  const params = gl.logo.params;
  const panes = [];

  const matEl = document.querySelector('.hud--material');
  if (matEl) {
    const pane = new Pane({ container: matEl, title: 'MainLogo Material' });
    pane.addBinding(params, 'roughness', { min: 0, max: 1, step: 0.01 });
    pane.addBinding(params, 'noiseScale', { min: 0, max: 20, step: 0.1 });
    pane.addBinding(params, 'color');
    panes.push(pane);
  }

  const quatEl = document.querySelector('.hud--quaternion');
  if (quatEl) {
    const pane = new Pane({ container: quatEl, title: 'MainLogo Quaternion' });
    const fmt = { readonly: true, format: (v) => v.toFixed(2), interval: 60 };
    pane.addBinding(params.quat, 'x', fmt);
    pane.addBinding(params.quat, 'y', fmt);
    pane.addBinding(params.quat, 'z', fmt);
    pane.addBinding(params.quat, 'w', fmt);
    pane.addButton({ title: 'Reset Quaternion' }).on('click', () => gl.logo.resetQuaternion());
    panes.push(pane);
  }

  return {
    dispose() {
      panes.forEach((p) => p.dispose());
    }
  };
}
