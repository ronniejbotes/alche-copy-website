# ALCHE rebuild study

A from-scratch rebuild of the interaction design of [alche.studio](https://alche.studio/) —
the WebGL glass-triangle logo, the live debug-panel HUD (Tweakpane), the curved LED-wall
background, and the scroll-driven top page — as an editable, hostable Vite project.

**This is a design study.** All code is original, all 3D assets and textures are generated
procedurally at runtime (no files were taken from the original site), and all copy is
placeholder text. If you deploy this publicly, replace the ALCHE branding and placeholder
content with your own — publishing it as-is would misrepresent a real company.

## How it works

| Piece | Where | What it does |
| --- | --- | --- |
| Background wall | `src/js/gl/background.js` | Inverted sphere + fragment shader: domain-warped fbm zebra stripes, LED panel grid, glitch rows. All procedural. |
| Glass logo | `src/js/gl/logo.js` | Extruded triangle (with triangular hole), `MeshPhysicalMaterial` with `transmission: 1` so the wordmark refracts through it. Noise normal map drives the liquid distortion (`noiseScale`). Drag to rotate (quaternion + inertia + spring return). |
| Wordmark | `src/js/gl/logo.js` | "ALCHE" drawn on a canvas (custom block letterforms), placed behind the glass. |
| Debug HUD | `src/js/panels.js` | Real Tweakpane panels — *MainLogo Material* (roughness / noiseScale / color) and *MainLogo Quaternion* (live readout + Reset) — wired to the live scene, like the original site. |
| Axis gizmo | `src/js/gl/gizmo.js` | Tiny standalone renderer showing the logo's orientation as an XYZ triad. |
| Scroll | `src/js/scroll.js` | GSAP ScrollTrigger. Sections kv → works_intro → works → mission → vision → service drive `gl.setSection(float)`; everything scrubs, so scrolling back rewinds. |
| Boot gate | `src/js/main.js` | Reduced-motion / no-WebGL / init failure → `body.no-3d` static fallback; content stays readable. |

Scene tuning lives at the top of `src/js/gl/scene.js` (`SECTION_CONFIGS` — logo position,
scale, and background dim per section).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

Pages: `/` (top), `/works/`, `/about/`, `/news/`, `/stellla/`, `/contact/`.
Subpage content is plain HTML in each folder's `index.html`.

## Build & host

```bash
npm run build      # outputs static site to dist/
npm run preview    # sanity-check the build locally
```

`dist/` is fully static — host it anywhere:

- **Vercel**: `npx vercel` in the repo root (framework: Vite, output: `dist`), or connect the GitHub repo in the dashboard.
- **Netlify**: drag `dist/` into the dashboard, or connect the repo with build command `npm run build`, publish dir `dist`.
- **GitHub Pages**: `npm run build`, push `dist/` to a `gh-pages` branch (the relative `base: './'` in `vite.config.js` makes subpath hosting work out of the box).

## Placeholders to replace before any real use

- All "Placeholder …" copy (works entries, news items, about profile, service cards, contact links)
- Social links in header/side-menu/footer (`href="#"`)
- The loading-screen tagline in `index.html`
- The sound toggle is visual-only (no audio track is shipped)
- The ALCHE name/mark itself if deploying publicly
