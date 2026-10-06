import { defineConfig } from 'vite';

export default defineConfig({
  // Keep production output portable so a personal deployment can live at either
  // the domain root or a project subpath without rewriting English data URLs.
  base: './',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local']
  },
  build: {
    outDir: 'dist',
    manifest: true
  }
});
