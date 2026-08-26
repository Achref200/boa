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
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    /* The site sets `scroll-behavior: smooth`, so a programmatic scroll is
       still animating when a click lands and another element takes the hit.
       The app already honours `prefers-reduced-motion`, which turns scrolling
       and transitions off — so the suite runs the same DOM the way a visitor
       with that preference sees it, and clicks land where they were aimed. */
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    /* Signs in once and stores the session; the admin tests reuse it rather
       than each spending one of the six sign-in attempts the limiter allows. */
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        /* `next start` and not the standalone server, because the standalone
           bundle reads its configuration from the process environment only —
           that is correct on Hostinger, where hPanel supplies it, but locally
           the suite relies on .env.local being loaded for it. */
        command: 'npx next start -p 3000',
        url: 'http://127.0.0.1:3000/fr',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
