/**
 * Data source for the on-page instrument panels.
 *
 * The panels are a real, working Tweakpane wired to these values — the one
 * control the visitor gets is monthly ad spend, and the readouts respond to
 * it. Everything else is scrubbed by scroll depth, so the numbers improve as
 * the page makes its argument.
 *
 * The figures are an illustrative model, not client data. Anything shown must
 * carry SOURCE_NOTE with it.
 */

export const SOURCE_NOTE = 'Illustrative model — real figures on request.';

export class Telemetry {
  constructor() {
    this.values = {
      spend: 8000,
      cpl: 84,
      roas: 1.8,
      imprShare: 0.18,
      leads: 95,
      avgPosition: 11.4,
      aiCitations: 0,
      snippets: 0
    };
    this.recompute();
  }

  /** @param {{works:number, mission:number, service:number, page:number}} progress */
  update(progress) {
    const p = Math.max(0, Math.min(1, progress.page || 0));
    const v = this.values;
    v.cpl = 84 - 53 * p;
    v.roas = 1.8 + 4.1 * p;
    v.imprShare = 0.18 + 0.61 * p;
    v.avgPosition = 11.4 - 11.4 * p;   // approaching 0 = position zero
    v.aiCitations = Math.round(p * 27);
    v.snippets = Math.round(p * 14);
    this.recompute();
  }

  /** leads follow from spend and cost-per-lead, so the slider means something */
  recompute() {
    this.values.leads = Math.round(this.values.spend / Math.max(1, this.values.cpl));
  }
}
