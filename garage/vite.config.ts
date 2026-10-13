import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { garageServiceWorker } from './tools/sw-plugin.ts';

const root = import.meta.dirname;

/**
 * Optional HTTPS for `npm run garage:preview`: real offline install on the
 * iPad over the home network needs a secure address. Put a locally trusted
 * certificate in garage/certs/{key,cert}.pem (see README), or point
 * GARAGE_HTTPS_KEY / GARAGE_HTTPS_CERT at the files.
 */
function https(): { key: Buffer; cert: Buffer } | undefined {
  const key = process.env.GARAGE_HTTPS_KEY ?? resolve(root, 'certs/key.pem');
  const cert = process.env.GARAGE_HTTPS_CERT ?? resolve(root, 'certs/cert.pem');
  return existsSync(key) && existsSync(cert) ? { key: readFileSync(key), cert: readFileSync(cert) } : undefined;
}

export default defineConfig(({ mode }) => ({
  root,
  base: './',
  publicDir: 'public',
  envDir: root,
  plugins: [garageServiceWorker(resolve(root, 'public'))],
  build: {
    outDir: resolve(root, mode === 'e2e' ? '../dist-garage-e2e' : '../dist-garage'),
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    // only the game page: lab pages are development tools
    rollupOptions: {
      input: resolve(root, 'index.html'),
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 5175 },
  // strictPort: saves belong to the exact address, so never drift to another port.
  // allowedHosts: the iPad reaches the Mac by its home-network name (my-mac.local); preview only serves the built files.
  preview: { host: '127.0.0.1', port: 4175, strictPort: true, allowedHosts: true, https: https() },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
