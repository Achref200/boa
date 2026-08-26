import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './admin-session';

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn';

/**
 * admin → edit → storefront.
 *
 * The third critical journey: a change made in the operations application has
 * to be visible on the public site without a deploy. This also exercises the
 * authorization boundary — the first test asserts that /admin is not reachable
 * simply by knowing the URL.
 */
test.describe('operations application', () => {
  test('the admin is not reachable without a session', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/connexion/);
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible();
  });

  /* Two failed attempts, and only in one project: administrator sign-in allows
     six per ten minutes per IP, and this test deliberately spends some of that
     budget. Running it per viewport would trip the limiter on a control that is
     server-side and viewport-independent. */
  test('wrong credentials do not reveal whether the account exists', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'server-side behaviour, no viewport dimension');
    await page.goto('/admin/connexion');
    await page.fill('#email', 'definitely-not-an-admin@example.com');
    await page.fill('#password', 'whatever');
    await page.getByRole('button', { name: /se connecter/i }).click();
    const unknown = await page.locator('#admin-signin-error').textContent();

    await page.fill('#email', EMAIL);
    await page.fill('#password', 'the-wrong-password');
    await page.getByRole('button', { name: /se connecter/i }).click();
    const wrongPassword = await page.locator('#admin-signin-error').textContent();

    expect(unknown).toBe(wrongPassword);
  });

  test.describe('signed in', () => {
    test.use({ storageState: ADMIN_STATE });

    test('an edit in the admin reaches the storefront', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /bonjour/i })).toBeVisible();

    await page.goto('/admin/produits');
    await page.getByRole('link', { name: 'BOA Masque Cheveux' }).first().click();
    await expect(page).toHaveURL(/\/admin\/produits\/[a-z0-9]{24}/);

    const tagline = `Accroche de test ${Date.now()}`;
    await page.fill('#tagline-FR', tagline);
    await page.getByRole('button', { name: /^enregistrer$/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /enregistrées/i })).toBeVisible({
      timeout: 15_000,
    });

    // The storefront is statically served with tag-based revalidation, so the
    // change must appear without a rebuild.
    await page.goto('/fr/produits/boa-masque-cheveux');
    await expect(page.getByText(tagline)).toBeVisible({ timeout: 15_000 });
    });
  });
});
