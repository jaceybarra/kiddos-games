import { defineConfig } from 'vitest/config';

// Relative base so the production build can be opened from any local folder
// or static file server without a fixed URL path.
export default defineConfig({
  base: './',
  build: {
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
  server: { host: '127.0.0.1', port: 5173 },
  // strictPort: saves belong to the exact address, so never drift to another port.
  // allowedHosts: a tablet may reach this computer by any home-network name (my-mac.local, my-mac.lan, …).
  // Safe to allow all: preview only serves the built game files — no source, no data, no API — and saves
  // live in each device's own browser storage, which another site can't read.
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, allowedHosts: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
