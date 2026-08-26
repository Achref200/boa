import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './admin-session';

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

/**
 * A cheap net that catches the failure mode nothing else does: a page that
 * compiles, type-checks and then throws the first time it is actually rendered.
 * Every route is asserted on both its HTTP status and the absence of a runtime
 * error boundary.
 */
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
      // XML and plain-text routes have no HTML body to inspect; their status
      // code is the whole assertion.
      const type = response?.headers()['content-type'] ?? '';
      if (!type.includes('text/html')) continue;

      const body = await page.locator('body').innerText();
      if (/Application error|Service momentanément indisponible/i.test(body)) {
        failures.push(`${route} → error boundary`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });

  test.describe('signed in', () => {
    test.use({ storageState: ADMIN_STATE });

    test('admin routes', async ({ page }) => {
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
});
