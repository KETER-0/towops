import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the built dist/ works from any folder or host.
  base: './',
  server: { port: 5190, host: true },
  // The main chunk carries the whole demo dataset (data/*.json, ~97 kB gzipped): expected, not a leak.
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
