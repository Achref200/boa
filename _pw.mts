import base from './playwright.config';
import { devices } from '@playwright/test';
// Same config, minus the admin `setup` dependency: media.spec.ts never uses the
// admin session, so its sign-in is pure overhead (and currently fails for an
// unrelated reason). `use` is merged explicitly so baseURL survives.
export default {
  ...base,
  timeout: base.timeout,
  use: { ...base.use, baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
};
