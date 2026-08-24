import { expect, test, type Page } from '@playwright/test';

/**
 * Customer authentication, step by step.
 *
 * The account surface is where a shop leaks the most: an unprotected page, a
 * form that tells an attacker which e-mails are registered, a session that
 * survives sign-out. Each step below is one of those failure modes stated as an
 * assertion and walked through the real UI, not the server action.
 *
 * **Budgeted against the real rate limiter.** `src/lib/rate-limit.ts` allows
 * 5 sign-ups per 15 minutes and 8 sign-ins per 5 minutes from one address, and
 * the limiter is in-process, so its buckets survive between spec files against a
 * single server. This file therefore spends exactly 3 sign-ups and 5 sign-ins,
 * grouped into journeys rather than one-assertion-per-test. If you run the full
 * suite twice inside fifteen minutes, restart the server first — otherwise the
 * limiter does its job and the failures look like application bugs.
 */

test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const rand = Math.floor(Math.random() * 1e6);

const ACCOUNT = {
  email: `e2e-${stamp}-${rand}@example.test`,
  password: 'boa-e2e-password-2026',
  firstName: 'Test',
  lastName: 'E2E',
};

async function fillSignUp(page: Page, email: string, password: string) {
  await page.goto('/fr/inscription');
  await page.fill('#firstName', ACCOUNT.firstName);
  await page.fill('#lastName', ACCOUNT.lastName);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: /créer un compte/i }).click();
}

/**
 * Next mounts its own route announcer — an element with role="alert" and the id
 * `__next-route-announcer__` — on every navigation. A bare getByRole('alert') is
 * therefore ambiguous and resolves to two nodes, so every assertion about a form
 * error has to exclude it.
 */
const formAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function fillSignIn(page: Page, email: string, password: string) {
  await page.goto('/fr/connexion');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: /^se connecter$/i }).click();
}

test('the account area is not reachable without a session', async ({ page }) => {
  await page.goto('/fr/compte');
  await expect(page).toHaveURL(/\/fr\/connexion/);
  await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
});

test('sign-up, session, sign-out and sign-in', async ({ page }) => {
  await test.step('signing up lands the customer inside their account', async () => {
    await fillSignUp(page, ACCOUNT.email, ACCOUNT.password);
    await expect(page).toHaveURL(/\/fr\/compte/, { timeout: 20_000 });
  });

  await test.step('the session is a cookie the server accepts, not client state', async () => {
    await page.reload();
    await expect(page).toHaveURL(/\/fr\/compte/);
    await expect(page.getByRole('button', { name: /se déconnecter/i })).toBeVisible();
  });

  await test.step('signing out actually ends the session server-side', async () => {
    await page.getByRole('button', { name: /se déconnecter/i }).click();
    await expect(page).not.toHaveURL(/\/fr\/compte/, { timeout: 20_000 });
    // Navigating away is not proof. Asking the server again is.
    await page.goto('/fr/compte');
    await expect(page).toHaveURL(/\/fr\/connexion/);
  });

  await test.step('the same credentials sign back in', async () => {
    await fillSignIn(page, ACCOUNT.email, ACCOUNT.password);
    await expect(page).toHaveURL(/\/fr\/compte/, { timeout: 20_000 });
  });

  await test.step('the form is completable with the keyboard alone', async () => {
    await page.getByRole('button', { name: /se déconnecter/i }).click();
    await page.goto('/fr/connexion');
    await page.getByLabel(/e-mail/i).focus();
    await page.keyboard.type(ACCOUNT.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(ACCOUNT.password);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/fr\/compte/, { timeout: 20_000 });
  });
});

test('the form refuses a weak password and a duplicate address', async ({ page }) => {
  await test.step('a password under the stated minimum is rejected', async () => {
    await fillSignUp(page, `e2e-weak-${stamp}@example.test`, 'court');
    await expect(page).toHaveURL(/\/fr\/inscription/);
    // The rule is restated next to the field, not only in a summary at the top.
    await expect(page.getByText(/12 caractères/i).first()).toBeVisible();
  });

  await test.step('an address already registered cannot be registered again', async () => {
    await fillSignUp(page, ACCOUNT.email, ACCOUNT.password);
    await expect(page).toHaveURL(/\/fr\/inscription/);
    await expect(formAlert(page)).toBeVisible();
  });
});

test('a wrong password does not reveal whether the account exists', async ({ page }) => {
  await fillSignIn(page, ACCOUNT.email, 'the-wrong-password-entirely');
  const wrongPassword = (await formAlert(page).textContent())?.trim();

  await fillSignIn(page, `e2e-nobody-${stamp}@example.test`, 'the-wrong-password-entirely');
  const unknownAccount = (await formAlert(page).textContent())?.trim();

  expect(wrongPassword, 'a failed sign-in must say something').toBeTruthy();
  expect(unknownAccount, 'the two failures must be indistinguishable').toBe(wrongPassword);
});
