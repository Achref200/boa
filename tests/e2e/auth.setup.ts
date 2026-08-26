import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE } from './admin-session';

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'boa-dev-password-2026';

/**
 * Sign in once for the whole run and save the session.
 *
 * Not an optimisation: administrator sign-in is rate limited to six attempts
 * per ten minutes per IP (`LIMITS.adminSignIn`), and a suite that signs in at
 * the top of every admin test trips its own limiter — the failures then look
 * like application bugs. One sign-in here, reused as storage state, leaves the
 * budget for the tests that are actually about authentication.
 */
setup('authenticate as administrator', async ({ page }) => {
  await page.goto('/admin/connexion');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();

  await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /bonjour/i })).toBeVisible();

  await page.context().storageState({ path: ADMIN_STATE });
});
