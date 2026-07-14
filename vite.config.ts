import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'chrome120',
    minify: 'esbuild',
  },
  server: {
    port: 5173,
  }
});
