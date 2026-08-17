import { Pane } from 'tweakpane';
import { SOURCE_NOTE } from './telemetry.js';

/**
 * The on-page instrument panels — real Tweakpane, shipped as a deliberate
 * design element, but reading out the business rather than the scene graph:
 *  - "SIGNAL / live":  ad spend (the one live control) → leads, cost per
 *                      lead, ROAS, impression share
 *  - "ATTRIBUTION":    average position, featured snippets, AI citations
 *
 * Values come from Telemetry and are scrubbed by scroll depth. They are an
 * illustrative model, which is why the source note ships with them.
 */

export function buildPanels(telemetry) {
  if (!telemetry) return null;
  const t = telemetry;
  const panes = [];

  const signalEl = document.getElementById('pane-signal');
  if (signalEl) {
    const pane = new Pane({ container: signalEl, title: 'SIGNAL / live' });
    pane
      .addBinding(t.values, 'spend', { label: 'SPEND / MO', min: 1000, max: 50000, step: 500 })
      .on('change', () => t.recompute());
    pane.addBinding(t.values, 'leads', { label: 'LEADS', readonly: true, format: (v) => String(Math.round(v)) });
    pane.addBinding(t.values, 'cpl', { label: 'CPL', readonly: true, format: (v) => `$${v.toFixed(0)}` });
    pane.addBinding(t.values, 'roas', { label: 'ROAS', readonly: true, format: (v) => `${v.toFixed(2)}x` });
    pane.addBinding(t.values, 'imprShare', { label: 'IMPR SH', readonly: true, format: (v) => `${(v * 100).toFixed(0)}%` });
    panes.push(pane);
  }

  const attrEl = document.getElementById('pane-attribution');
  if (attrEl) {
    const pane = new Pane({ container: attrEl, title: 'ATTRIBUTION' });
    pane.addBinding(t.values, 'avgPosition', { label: 'AVG POS', readonly: true, format: (v) => v.toFixed(1) });
    pane.addBinding(t.values, 'snippets', { label: 'SNIPPETS', readonly: true, format: (v) => String(v) });
    pane.addBinding(t.values, 'aiCitations', { label: 'AI CITES', readonly: true, format: (v) => String(v) });
    const note = document.createElement('p');
    note.className = 'hud__note';
    note.textContent = SOURCE_NOTE;
    attrEl.appendChild(note);
    panes.push(pane);
  }

  // readonly bindings are pull-based, so drive them off a timer
  const sync = setInterval(() => panes.forEach((p) => p.refresh()), 100);

  return {
    dispose() {
      clearInterval(sync);
      panes.forEach((p) => p.dispose());
    }
  };
}
