import '../styles/main.css';
import { AlcheGL } from './gl/scene.js';
import { initHeader } from './ui.js';

/**
 * Subpage boot: shared header + the dimmed background wall (no logo).
 */

document.body.classList.add('js-enabled');
initHeader();

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const container = document.getElementById('gl-canvas');

if (reduced || !container) {
  document.body.classList.add('no-3d');
} else {
  try {
    const gl = new AlcheGL();
    if (!gl.init(container, { mode: 'sub' })) {
      document.body.classList.add('no-3d');
    } else {
      let resizeId;
      window.addEventListener('resize', () => {
        clearTimeout(resizeId);
        resizeId = setTimeout(() => gl.resize(), 200);
      });
    }
  } catch (err) {
    console.error('[alche] subpage scene failed, falling back', err);
    document.body.classList.add('no-3d');
  }
}

// Category filter rows (works page): client-side filter over list items.
const filterRow = document.querySelector('[data-filter-row]');
if (filterRow) {
  const buttons = filterRow.querySelectorAll('button');
  const items = document.querySelectorAll('[data-cats]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      buttons.forEach((b) => {
        b.setAttribute('data-active', String(b === btn));
        b.setAttribute('aria-pressed', String(b === btn));
      });
      items.forEach((item) => {
        const cats = (item.dataset.cats || '').split(',');
        item.style.display = cat === 'all' || cats.includes(cat) ? '' : 'none';
      });
    });
  });
}
