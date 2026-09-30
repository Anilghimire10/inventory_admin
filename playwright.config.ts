import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the panel, against a running admin app and API:
 *
 *   npm run dev            # this app, on ADMIN_URL (default :5174)
 *   (API on API_URL, default http://localhost:3000/api)
 *   npm run test:e2e
 *
 * Each test makes its own throwaway business through the API and deletes it
 * afterwards, so they can run against a dev database without touching the
 * shops in it. One worker: the tests share that database.
 *
 * First run on a new machine: `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: process.env.ADMIN_URL ?? 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
