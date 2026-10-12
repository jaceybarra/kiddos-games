import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Bentley's Wonder Garage: its own app inside this repo (shares the installed Phaser/Vite/TypeScript).
export default defineConfig({
  root,
  base: './',
  publicDir: 'public',
  build: {
    outDir: '../dist-garage',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  // Same reasoning as the main app: any home-network name may reach the computer; only built files are served.
  preview: { host: '127.0.0.1', port: 4175, strictPort: true, allowedHosts: true },
  test: {
    root,
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
