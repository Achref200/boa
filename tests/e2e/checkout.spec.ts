import { expect, test } from '@playwright/test';

/**
 * browse → product → cart → checkout → confirmation.
 *
 * Deliberately drives the real UI rather than posting to the action: the point
 * is to catch the seams — a cart cookie that is not set, a governorate that
 * produces no shipping option, a submit button that stays disabled.
 */
test.describe('customer purchase journey', () => {
  test('a visitor can buy a product with cash on delivery', async ({ page }) => {
    await page.goto('/fr/soins');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('link', { name: /BOA Shampoo/ }).first().click();
    await expect(page).toHaveURL(/\/fr\/produits\//);

    await page.getByRole('button', { name: /ajouter au panier/i }).first().click();
    await expect(page.getByText(/ajouté au panier/i).first()).toBeVisible();

    await page.goto('/fr/panier');
    await expect(page.getByRole('heading', { name: 'Panier' })).toBeVisible();
    await expect(page.getByText('BOA Shampoo').first()).toBeVisible();

    await page.goto('/fr/commande');
    await page.fill('#firstName', 'Amel');
    await page.fill('#lastName', 'Ben Salah');
    await page.fill('#email', 'amel.test@example.tn');
    await page.fill('#phone', '20123456');
    await page.fill('#addressLine1', '12 rue des Oliviers');
    await page.fill('#city', 'Sousse');
    await page.selectOption('#governorate', 'Sousse');
    await page.getByRole('checkbox').last().check();

    const submit = page.getByRole('button', { name: /confirmer la commande/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL(/\/fr\/commande\/BOA-\d{2}-\d{4}/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /commande confirmée/i })).toBeVisible();
  });

  test('the cart survives a reload and is per-visitor', async ({ page, context }) => {
    await page.goto('/fr/produits/boa-masque-cheveux');
    await page.getByRole('button', { name: /ajouter au panier/i }).first().click();
    await expect(page.getByText(/ajouté au panier/i).first()).toBeVisible();

    await page.reload();
    await page.goto('/fr/panier');
    await expect(page.getByText('BOA Masque Cheveux').first()).toBeVisible();

    // A different browser context must not see that cart — this is the check
    // that catches a cart page accidentally being served from a static cache.
    const other = await context.browser()!.newContext();
    const fresh = await other.newPage();
    await fresh.goto(`${test.info().project.use.baseURL}/fr/panier`);
    await expect(fresh.getByText(/votre panier est vide/i)).toBeVisible();
    await other.close();
  });
});
