import { expect, test } from '@playwright/test';
import { clearAdminLockout } from './support/admin-lockout';

test.beforeAll(clearAdminLockout);

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'boa-dev-password-2026';

const PUBLIC_ROUTES = [
  '/fr', '/en', '/ar',
  '/fr/soins', '/fr/soins/cheveux', '/fr/soins/shampooings',
  '/fr/produits/boa-shampoo',
  '/fr/rituels', '/fr/rituels/rituel-proteine',
  '/fr/services', '/fr/services/diagnostic-cheveux', '/fr/reserver/diagnostic-cheveux',
  '/fr/maison-boa', '/fr/professionnels', '/fr/contact',
  '/fr/panier', '/fr/suivi', '/fr/connexion', '/fr/inscription',
  '/ar/soins', '/ar/produits/boa-shampoo',
  '/sitemap.xml', '/robots.txt',
];

const ADMIN_ROUTES = [
  '/admin', '/admin/produits', '/admin/produits/nouveau',
  '/admin/categories', '/admin/besoins', '/admin/collections', '/admin/rituels',
  '/admin/commandes', '/admin/clients', '/admin/remises', '/admin/livraison',
  '/admin/reservations', '/admin/services', '/admin/services/nouveau',
  '/admin/contenu', '/admin/messages', '/admin/reglages', '/admin/journal',
];


test.describe('every route renders', () => {
  test.setTimeout(120_000);

  test('public routes', async ({ page }) => {
    const failures: string[] = [];

    for (const route of PUBLIC_ROUTES) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 0;
      if (status >= 400) {
        failures.push(`${route} → HTTP ${status}`);
        continue;
      }
      const type = response?.headers()['content-type'] ?? '';
      if (!type.includes('text/html')) continue;

      const body = await page.locator('body').innerText();
      if (/Application error|Service momentanément indisponible/i.test(body)) {
        failures.push(`${route} → error boundary`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('admin routes', async ({ page }) => {
    await page.goto('/admin/connexion');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL(/\/admin$/, { timeout: 20_000 });

    const failures: string[] = [];

    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 0;
      if (status >= 400) {
        failures.push(`${route} → HTTP ${status}`);
        continue;
      }
      const body = await page.locator('body').innerText();
      if (/Une erreur est survenue|Application error/i.test(body)) {
        failures.push(`${route} → error boundary`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
