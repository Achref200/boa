import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE } from './admin-session';

/**
 * Automated checks catch roughly a third of real accessibility problems, so
 * they are a floor, not a certificate. The keyboard test below covers what axe
 * cannot see: whether the page can actually be operated without a mouse.
 */
const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

const PUBLIC_PAGES = [
  ['home', '/fr'],
  ['catalogue', '/fr/soins'],
  ['product', '/fr/produits/boa-shampoo'],
  ['cart', '/fr/panier'],
  ['booking', '/fr/reserver/diagnostic-cheveux'],
  ['contact', '/fr/contact'],
  ['sign in', '/fr/connexion'],
  ['arabic home', '/ar'],
] as const;

test.describe('accessibility', () => {
  test.setTimeout(180_000);

  for (const [name, url] of PUBLIC_PAGES) {
    test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'load' });
      const results = await scan(page).analyze();

      const summary = results.violations.map(
        (violation) =>
          `${violation.id} (${violation.impact}) — ${violation.help}\n    ${violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(' '))
            .join('\n    ')}`,
      );
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }

  test.describe('signed in', () => {
    test.use({ storageState: ADMIN_STATE });

    test('the admin dashboard has no WCAG A/AA violations', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'load' });
      await expect(page.getByRole('heading', { name: /bonjour/i })).toBeVisible();

      const results = await scan(page).analyze();
      const summary = results.violations.map(
        (v) => `${v.id} (${v.impact}) — ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`,
      );
      expect(summary, summary.join('\n')).toEqual([]);
    });
  });

  test('a product can be added to the cart with the keyboard alone', async ({ page }) => {
    await page.goto('/fr/produits/boa-shampoo', { waitUntil: 'load' });

    // Walk forward until the add-to-cart button holds focus, then activate it.
    let reached = false;
    for (let step = 0; step < 60 && !reached; step += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() =>
        /ajouter au panier/i.test(document.activeElement?.textContent ?? ''),
      );
    }
    expect(reached, 'the add-to-cart button must be reachable by Tab').toBe(true);

    await page.keyboard.press('Enter');
    await expect(page.getByText(/ajouté au panier/i).first()).toBeVisible();
  });

  test('the mobile menu traps focus and closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fr', { waitUntil: 'load' });

    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('dialog[open]')).toBeVisible();

    // Native <dialog> gives Escape and focus containment for free — this test
    // exists so a future rewrite to a div cannot quietly lose them.
    const inside = await page.evaluate(() =>
      document.querySelector('dialog[open]')?.contains(document.activeElement) ?? false,
    );
    expect(inside).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });
});
