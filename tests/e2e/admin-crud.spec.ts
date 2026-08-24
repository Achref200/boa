import { expect, test, type Page } from '@playwright/test';
import { clearAdminLockout } from './support/admin-lockout';
import { ensureAdminAccount } from './support/admin-account';
import { deleteProductBySlug } from './support/e2e-products';

/**
 * The operations application, exercised as a full create → read → update →
 * publish → archive cycle on a real product, against the real database.
 *
 * This is the journey that proves the claim in CLAUDE.md that there is no fake
 * backend: nothing here mutates React state. Every step is verified by *leaving*
 * the page and coming back, so a value that only lives in a component fails the
 * test. The cycle ends by archiving what it created, so the suite can run
 * repeatedly without filling the catalogue with rows.
 *
 * **One sign-in for the whole file.** `adminSignIn` allows 6 attempts per 10
 * minutes and the limiter is in-process, so a spec that signs in per test
 * exhausts it and produces failures that look like authentication bugs. The
 * lifecycle is therefore a single test made of steps, sharing one session.
 */

test.describe.configure({ mode: 'serial' });

// Eight steps, each a real round trip through the database and the cache.
// The default 45s is a per-test budget, not a per-step one.
test.setTimeout(240_000);

test.beforeAll(ensureAdminAccount);

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'boa-dev-password-2026';

const stamp = Date.now();
const SLUG = `e2e-produit-${stamp}`;
const REFERENCE = `E2E-${stamp}`;
const NAME = `Produit E2E ${stamp}`;
const RENAMED = `${NAME} modifie`;

// The journey ends on 'archived' on purpose; the row is removed here so repeat
// runs do not accumulate test products in a catalogue a human browses.
test.afterAll(() => deleteProductBySlug(SLUG));

async function signInAsAdmin(page: Page) {
  await clearAdminLockout();
  await page.goto('/admin/connexion');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: /^se connecter$/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 25_000 });
}

test('a product can be created, read, updated, published and archived', async ({ page }) => {
  let editUrl = '';

  await test.step('sign in to the operations application', async () => {
    await signInAsAdmin(page);
    await expect(page.getByRole('heading', { name: /bonjour/i })).toBeVisible();
  });

  await test.step('create a published product with one format', async () => {
    await page.goto('/admin/produits');
    await page.getByRole('link', { name: /nouveau produit/i }).click();
    await expect(page).toHaveURL(/\/admin\/produits\/nouveau/);

    await page.fill('#slug', SLUG);
    await page.fill('#reference', REFERENCE);

    // Take whichever category the seed provides rather than hardcoding one.
    const categoryValue = await page
      .locator('#categoryId option[value]:not([value=""])')
      .first()
      .getAttribute('value');
    expect(categoryValue, 'the seed must provide at least one category').toBeTruthy();
    await page.selectOption('#categoryId', categoryValue!);

    await page.selectOption('#state', 'PUBLISHED');
    await page.fill('#name-FR', NAME);
    await page.fill('#tagline-FR', 'Accroche ecrite par le test E2E.');

    await page.fill('#format-first', '100 ml');
    await page.fill('#sku-first', `${REFERENCE}-100`);
    await page.fill('#price-first', '19.900');
    await page.fill('#stock-first', '7');

    await page.getByRole('button', { name: /créer le produit/i }).click();

    // Creation lands on the new product's own page — the media manager only
    // exists once there is a row to attach files to.
    await expect(page).toHaveURL(/\/admin\/produits\/[a-z0-9]{24}/, { timeout: 25_000 });
    editUrl = page.url();
  });

  await test.step('it appears in the catalogue list', async () => {
    await page.goto('/admin/produits');
    await expect(page.getByRole('link', { name: NAME }).first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step('it reads back from the database, not from component state', async () => {
    // Arrive cold, by URL, with no form state carried over.
    await page.goto('/admin/produits');
    await page.getByRole('link', { name: NAME }).first().click();
    await expect(page).toHaveURL(editUrl);

    await expect(page.locator('#slug')).toHaveValue(SLUG);
    await expect(page.locator('#reference')).toHaveValue(REFERENCE);
    await expect(page.locator('#name-FR')).toHaveValue(NAME);
    await expect(page.locator('#state')).toHaveValue('PUBLISHED');
  });

  await test.step('a published product is live on the storefront', async () => {
    await page.goto(`/fr/produits/${SLUG}`);
    await expect(page.getByRole('heading', { name: NAME, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    // A single-format product renders no format selector, by design, so assert
    // on what is always there: it is buyable, at the price that was entered.
    await expect(page.getByRole('button', { name: /ajouter au panier/i })).toBeVisible();
    await expect(page.getByText(/19[,.]900/).first()).toBeVisible();
  });

  await test.step('an update persists and revalidates the public page', async () => {
    await page.goto(editUrl);
    await page.fill('#name-FR', RENAMED);
    await page.getByRole('button', { name: /^enregistrer$/i }).click();
    await expect(page.getByRole('status')).toBeVisible({ timeout: 25_000 });

    await page.reload();
    await expect(page.locator('#name-FR')).toHaveValue(RENAMED);

    // revalidateTag, not ISR luck: no rebuild happens between these two lines.
    await page.goto(`/fr/produits/${SLUG}`);
    await expect(page.getByRole('heading', { name: RENAMED, level: 1 })).toBeVisible({
      timeout: 25_000,
    });
  });

  await test.step('the writes are recorded in the audit journal', async () => {
    // Every admin capability has to leave a trace — CLAUDE.md §6.5. The journal
    // names the actor and the action, so both writes above must appear here.
    await page.goto('/admin/journal');
    await expect(page.getByText('Produit créé').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Produit modifié').first()).toBeVisible();
  });

  await test.step('archiving hides it from the shop but keeps the row', async () => {
    await page.goto(editUrl);
    await page.getByRole('button', { name: /archiver le produit/i }).click();

    // Destructive actions confirm in a real <dialog>, never window.confirm.
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^archiver$/i }).click();

    // Re-request the page rather than asserting against a DOM already in
    // memory: the public page is statically served and only changes on the next
    // request, so a toHaveCount() against a loaded document would never see it.
    let archivedStatus: number | undefined;
    await expect
      .poll(
        async () => {
          const response = await page.goto(`/fr/produits/${SLUG}`);
          archivedStatus = response?.status();
          return page.getByRole('heading', { name: RENAMED, level: 1 }).count();
        },
        { timeout: 25_000, message: 'an archived product must leave the storefront' },
      )
      .toBe(0);

    // …and it must leave with a real 404. Answering 200 with the not-found page
    // is a soft 404: search engines keep the dead URL indexed. This regressed
    // once already, when a route-level loading.tsx flushed the shell (and the
    // 200) before the page could call notFound().
    expect(archivedStatus).toBe(404);

    // Still in the database — "archived" must not mean "deleted". Asserted from
    // the catalogue list rather than the edit form: an archived product no
    // longer renders the form, so the list is what proves the row survived.
    await page.goto('/admin/produits?state=ARCHIVED');
    await expect(page.getByText(RENAMED).first()).toBeVisible({ timeout: 20_000 });
  });
});
