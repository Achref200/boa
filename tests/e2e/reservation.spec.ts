import { expect, test } from '@playwright/test';

/**
 * browse → service → slot → confirmation.
 *
 * The second test is the one that matters: two browsers racing for the same
 * slot must produce exactly one booking. It is deliberately driven through the
 * UI rather than the service layer, so it also covers the action, the
 * validation and the error surface a customer would actually see.
 */
test.describe('reservation journey', () => {
  test('a visitor can book an available slot', async ({ page }) => {
    await page.goto('/fr/services');
    await page.getByRole('link', { name: /diagnostic cheveux/i }).first().click();
    await page.getByRole('link', { name: /^réserver$/i }).click();

    await expect(page.getByRole('heading', { name: /diagnostic cheveux/i })).toBeVisible();

    /* The first day tab is disabled once its slots are gone, so the test picks
       the first day that still has one. If none does, the seed has been used
       up — re-run `npm run db:seed` rather than reading this as a bug. */
    const openDay = page.locator('[role="tab"]:not([disabled])').first();
    await expect(openDay, 'no bookable day is offered — re-seed the database').toBeVisible();
    await openDay.click();
    await page.locator('input[name="slotId"]:not([disabled])').first().check({ force: true });

    await page.fill('#firstName', 'Sonia');
    await page.fill('#lastName', 'Trabelsi');
    await page.fill('#email', `sonia.${Date.now()}@example.tn`);
    await page.fill('#phone', '22334455');

    await page.getByRole('button', { name: /confirmer la réservation/i }).click();

    await expect(page).toHaveURL(/\/fr\/reservation\/BOA-R-\d{2}-\d{4}/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /réservation confirmée/i })).toBeVisible();
  });

  test('two visitors cannot take the same single-capacity slot', async ({ browser }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map((context) => context.newPage()));

    // Both land on the booking page and select the same first free slot.
    for (const page of pages) {
      await page.goto('/fr/reserver/diagnostic-cheveux');
      const openDay = page.locator('[role="tab"]:not([disabled])').first();
      await expect(openDay, 'no bookable day is offered — re-seed the database').toBeVisible();
      await openDay.click();
    }

    const slotValue = await pages[0]!
      .locator('input[name="slotId"]:not([disabled])')
      .first()
      .getAttribute('value');
    expect(slotValue).toBeTruthy();

    for (const [index, page] of pages.entries()) {
      await page.locator(`input[name="slotId"][value="${slotValue}"]`).check({ force: true });
      await page.fill('#firstName', `Racer${index}`);
      await page.fill('#lastName', 'Test');
      await page.fill('#email', `racer${index}.${Date.now()}@example.tn`);
      await page.fill('#phone', '2233445' + index);
    }

    // Fire both submissions as close together as the harness allows.
    await Promise.all(
      pages.map((page) => page.getByRole('button', { name: /confirmer la réservation/i }).click()),
    );

    await Promise.all(pages.map((page) => page.waitForTimeout(6000)));

    const outcomes = pages.map((page) => /\/fr\/reservation\/BOA-R-/.test(page.url()));
    const succeeded = outcomes.filter(Boolean).length;

    expect(succeeded, 'exactly one of the two bookings must succeed').toBe(1);

    const loser = pages[outcomes.indexOf(false)]!;
    await expect(loser.locator('#booking-error')).toContainText(/vient d'être réservé/i);

    await Promise.all(contexts.map((context) => context.close()));
  });
});
