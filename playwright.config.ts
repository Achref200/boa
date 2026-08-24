import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end coverage for the three journeys that must never break:
 * browse → cart → checkout, browse → reserve → confirm, and admin → edit →
 * storefront. The suite runs against a real build and a real MySQL database,
 * because most of the risk in this application lives in transactions and
 * server-side validation, not in the components.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  /* These journeys are multi-step round trips through a real database; 45s was
     a per-test budget that the reservation and admin flows exceeded on a cold
     server for reasons that had nothing to do with the code under test. */
  timeout: 120_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        /* `next start` refuses to serve an `output: 'standalone'` build — it
           says so in a warning that is easy to miss, then serves nothing. So run
           the standalone server directly, with dotenv preloaded because that
           bundle reads configuration from the process environment only. */
        command: 'node -r dotenv/config .next/standalone/server.js dotenv_config_path=.env.local',
        url: 'http://127.0.0.1:3000/fr',
        env: { PORT: '3000', HOSTNAME: '127.0.0.1' },
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
