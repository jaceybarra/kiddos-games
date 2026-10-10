import { defineConfig } from '@playwright/test';

/** E2E_PORT lets two checkouts run their journeys side by side without sharing a server. */
const port = Number(process.env.E2E_PORT ?? 4174);

/**
 * Browser journeys run against an e2e build (vite build --mode e2e), which
 * includes test hooks (window.__ww) for locating things on the canvas.
 * Uses the Chromium preinstalled with Playwright 1.56.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1024, height: 768 },
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npx vite build --mode e2e --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
