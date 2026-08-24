import { defineConfig } from 'vite';
import { resolve } from 'path';

// import.meta.dirname rather than __dirname: this package is "type": "module",
// so __dirname only resolved because Vite pre-bundled the config through
// esbuild's CJS shim on every load — which writes a temp file into the project
// root that the config watcher then sees as a change. Loading natively removes
// that round trip. (Node 20.11+; this project runs 24.)
const root = import.meta.dirname;

export default defineConfig({
  // Relative base so the built site works on any static host (Vercel, Netlify,
  // GitHub Pages subpaths) without configuration.
  base: './',
  server: {
    watch: {
      // Everything here lives inside the project root but is not source. The
      // build output alone is 129 files, and the screen recordings are 22MB —
      // all of it fed the watcher for nothing.
      ignored: [
        '**/dist/**',
        '**/content/**',
        '**/tools/**',
        '**/*.mp4',
        '**/.git/**'
      ]
    },
    // Transform the entry graphs up front so the first request after a start
    // is not a cold transform of three.js + gsap.
    warmup: {
      clientFiles: ['./src/js/main.js', './src/js/subpage.js']
    }
  },
  optimizeDeps: {
    // Heavy and stable. Declaring them keeps the dep cache deterministic
    // instead of Vite discovering them mid-request and re-optimizing, which
    // is what leaves a page showing unstyled HTML while it waits.
    include: ['three', 'gsap', 'gsap/ScrollTrigger', 'lenis']
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        works: resolve(root, 'works/index.html'),
        about: resolve(root, 'about/index.html'),
        news: resolve(root, 'news/index.html'),
        cognexa: resolve(root, 'cognexa/index.html'),
        contact: resolve(root, 'contact/index.html')
      }
    }
  }
});
