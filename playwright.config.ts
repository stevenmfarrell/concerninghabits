import { defineConfig, devices } from '@playwright/test';

// End-to-end tests (e2e/), in a real browser against the production build, for what only shows up
// there: the service worker, and the outbox that keeps changes made offline. Run with
// `npm run test:e2e`, which builds first. scripts/e2e-server.mjs serves the build on a fresh database.
const BASE_URL = 'http://127.0.0.1:3007';

export default defineConfig({
  testDir: './e2e',
  // Not *.test.ts or *.spec.ts, which vitest would pick up
  testMatch: '**/*.e2e.ts',
  // One at a time: they share a server and its database, and each takes the network away
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
