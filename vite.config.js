import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Relative base so the built site works on any static host (Vercel, Netlify,
  // GitHub Pages subpaths) without configuration.
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        works: resolve(__dirname, 'works/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        news: resolve(__dirname, 'news/index.html'),
        cognexa: resolve(__dirname, 'cognexa/index.html'),
        contact: resolve(__dirname, 'contact/index.html')
      }
    }
  }
});
