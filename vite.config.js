import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      three: 'three',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
