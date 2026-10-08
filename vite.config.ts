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
  // allowedHosts '.local': lets a tablet use the computer's stable name (e.g. my-mac.local) instead of an IP that can change.
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, allowedHosts: ['.local'] },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
