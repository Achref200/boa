import { test } from '@playwright/test';
import { ADMIN_STATE } from './admin-session';

const OUT = process.env.SCREENSHOT_DIR ?? 'screenshots';

/** Visual capture pass. Run with: npx playwright test screenshots */
test('capture storefront', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (const [name, url] of [
    ['01-home', '/fr'],
    ['02-shop', '/fr/soins'],
    ['03-product', '/fr/produits/boa-shampoo'],
    ['04-rituals', '/fr/rituels'],
    ['05-services', '/fr/services'],
    ['06-booking', '/fr/reserver/diagnostic-cheveux'],
    ['07-house', '/fr/maison-boa'],
    ['08-contact', '/fr/contact'],
    ['09-home-arabic', '/ar'],
  ] as const) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, url] of [
    ['10-mobile-home', '/fr'],
    ['11-mobile-product', '/fr/produits/boa-shampoo'],
  ] as const) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  }
});

test('capture cart and checkout', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/fr/produits/boa-shampoo', { waitUntil: 'load' });
  await page.getByRole('button', { name: /ajouter au panier/i }).first().click();
  await page.waitForTimeout(1200);
  await page.goto('/fr/panier', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/12-cart.png`, fullPage: true });
  await page.goto('/fr/commande', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/13-checkout.png`, fullPage: true });
});

test('capture the admin sign-in screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/connexion', { waitUntil: 'load' });
  await page.screenshot({ path: `${OUT}/14-admin-signin.png` });
});

test.describe('signed in', () => {
  test.use({ storageState: ADMIN_STATE });

  test('capture admin', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  for (const [name, url] of [
    ['15-admin-dashboard', '/admin'],
    ['16-admin-products', '/admin/produits'],
    ['17-admin-orders', '/admin/commandes'],
    ['18-admin-reservations', '/admin/reservations'],
    ['19-admin-content', '/admin/contenu'],
    ['20-admin-services', '/admin/services'],
  ] as const) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  }

  await page.goto('/admin/produits', { waitUntil: 'load' });
  await page.getByRole('link', { name: 'BOA Shampoo' }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/21-admin-product-edit.png`, fullPage: true });
  });
});
