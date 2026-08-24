import { expect, test } from '@playwright/test';
import { clearAdminLockout } from './support/admin-lockout';
import { ensureAdminAccount } from './support/admin-account';
import { clearProductTagline } from './support/product-tagline';

const EDITED_PRODUCT = 'boa-masque-cheveux';

test.beforeAll(ensureAdminAccount);

// The revalidation assertion writes to a real published product. Put the row
// back the way the seed left it, so the storefront never shows test copy.
test.afterAll(() => clearProductTagline(EDITED_PRODUCT));

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'boa-dev-password-2026';

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

  test('wrong credentials do not reveal whether the account exists', async ({ page }) => {
    await page.goto('/admin/connexion');
    await page.fill('#email', 'definitely-not-an-admin@example.com');
    await page.fill('#password', 'whatever');
    await page.getByRole('button', { name: /se connecter/i }).click();
    const unknown = await page.getByRole('alert').textContent();

    await page.fill('#email', EMAIL);
    await page.fill('#password', 'the-wrong-password');
    await page.getByRole('button', { name: /se connecter/i }).click();
    const wrongPassword = await page.getByRole('alert').textContent();

    expect(unknown).toBe(wrongPassword);
  });

  test('an edit in the admin reaches the storefront', async ({ page }) => {
    // the previous test intentionally burns failed attempts; clear them first
    await clearAdminLockout();
    await page.goto('/admin/connexion');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();

    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
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
    await page.goto(`/fr/produits/${EDITED_PRODUCT}`);
    await expect(page.getByText(tagline)).toBeVisible({ timeout: 15_000 });
  });
});
