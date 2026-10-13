import { defineConfig } from '@playwright/test';

/** E2E_PORT lets two checkouts run their journeys side by side. */
const port = Number(process.env.E2E_PORT ?? 4176);

/**
 * Browser journeys against an e2e build (vite build --mode e2e), which adds
 * the test hooks (window.__garage). Chromium preinstalled with Playwright.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: '../test-results/garage',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1024, height: 768 },
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npx vite build --config garage/vite.config.ts --mode e2e && npx vite preview --config garage/vite.config.ts --outDir ../dist-garage-e2e --port ${port} --strictPort`,
    cwd: '..',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
