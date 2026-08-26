import { test, expect, type Page } from '@playwright/test';

/**
 * Every image placement on the public site actually renders.
 *
 * This suite exists because of a failure mode that no other test could see: an
 * image that is present in the DOM, fetched successfully by the browser, and
 * laid out at **zero height**. `MediaFrame` supplies its own `relative`, and
 * `cn()` is a plain class-name joiner rather than a Tailwind-aware merger, so a
 * caller that passed `absolute inset-0` produced `relative absolute` — Tailwind
 * emits `.relative` last, the frame kept `position: relative`, `inset-0` did
 * nothing, and the whole "Formulé à Sousse" band on the home page rendered as an
 * empty rectangle. Nothing threw, no request 404'd, and the DOM assertions every
 * other spec makes all passed.
 *
 * So the assertion here is geometric, not structural: a visible <img> must have
 * a non-trivial box and a non-zero intrinsic size. Images inside a `display:none`
 * subtree are excluded — the product gallery deliberately renders the mobile
 * swipe rail and the zoom dialog off-screen at desktop widths.
 */

type ImageReport = {
  alt: string;
  src: string;
  box: string;
  natural: string;
  problem: 'collapsed' | 'broken' | null;
};

async function inspectImages(page: Page): Promise<ImageReport[]> {
  return page.evaluate(() => {
    return [...document.querySelectorAll('img')]
      .filter((img) => {
        // offsetParent is null for anything inside display:none. `position:fixed`
        // also reports null, so keep those by checking the rect as well.
        const rect = img.getBoundingClientRect();
        return img.offsetParent !== null || rect.width > 0 || rect.height > 0;
      })
      .map((img) => {
        const rect = img.getBoundingClientRect();
        const collapsed = rect.width < 2 || rect.height < 2;
        const broken = img.complete && img.naturalWidth === 0;
        return {
          alt: img.alt,
          src: (img.currentSrc || img.src).slice(-80),
          box: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
          natural: `${img.naturalWidth}×${img.naturalHeight}`,
          problem: broken ? ('broken' as const) : collapsed ? ('collapsed' as const) : null,
        };
      });
  });
}

/**
 * Scrolls the page end to end, then waits for every visible image to settle.
 *
 * Both halves matter. Most imagery below the fold is `loading="lazy"`, so
 * without the scroll the footer mark reports `naturalWidth === 0` and reads as
 * broken when it is merely deferred; without the wait, a slow decode on a cold
 * dev server reads the same way.
 */
async function settleImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });

  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('img')]
          .filter((img) => img.offsetParent !== null)
          .every((img) => img.complete && img.naturalWidth > 0),
      undefined,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
}

/**
 * Routes that must carry imagery, with the minimum each one has to show. The
 * counts are floors, not fixtures: they catch a placement disappearing without
 * failing every time BOA publishes another product.
 */
const ROUTES: { path: string; minImages: number; note: string }[] = [
  { path: '/fr', minImages: 6, note: 'hero, signatures, maison band, ritual steps' },
  { path: '/fr/soins', minImages: 4, note: 'catalogue grid' },
  { path: '/fr/soins/cheveux', minImages: 5, note: 'category masthead + grid' },
  { path: '/fr/produits/boa-shampoo', minImages: 2, note: 'gallery frame + thumbnail rail' },
  { path: '/fr/rituels', minImages: 3, note: 'one card per ritual step' },
  { path: '/fr/rituels/rituel-proteine', minImages: 4, note: 'ritual cover + step images' },
  { path: '/fr/services', minImages: 1, note: 'service cover' },
  { path: '/fr/services/diagnostic-cheveux', minImages: 1, note: 'service cover' },
  { path: '/fr/maison-boa', minImages: 1, note: 'editorial bands' },
  { path: '/en', minImages: 6, note: 'the English home page renders the same blocks' },
  { path: '/ar', minImages: 6, note: 'RTL must not collapse a frame' },
];

for (const route of ROUTES) {
  test(`imagery renders on ${route.path} (${route.note})`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: 'load' });
    expect(response?.status(), `${route.path} should answer 200`).toBe(200);

    await settleImages(page);
    const images = await inspectImages(page);
    const broken = images.filter((image) => image.problem !== null);

    expect(
      broken,
      `${route.path} — ${broken
        .map((b) => `${b.problem} ${b.box} (intrinsic ${b.natural}) alt="${b.alt}" ${b.src}`)
        .join(' | ')}`,
    ).toEqual([]);

    expect(images.length, `${route.path} should render at least ${route.minImages} images`)
      .toBeGreaterThanOrEqual(route.minImages);
  });
}

/**
 * The reserve pipeline itself: a stored path has to resolve to a file the server
 * will actually serve. A row pointing at a deleted upload is a broken image on a
 * page nobody happens to open during a manual pass.
 */
test('every image the home page and catalogue reference is served', async ({ page, request }) => {
  const seen = new Set<string>();

  for (const path of ['/fr', '/fr/soins', '/fr/soins/cheveux', '/fr/rituels/rituel-proteine']) {
    await page.goto(path, { waitUntil: 'load' });
    await settleImages(page);
    for (const url of await page.evaluate(() =>
      [...document.querySelectorAll('img')].map((img) => img.currentSrc || img.src),
    )) {
      if (url) seen.add(url);
    }
  }

  expect(seen.size, 'the pass should have collected some image URLs').toBeGreaterThan(0);

  for (const url of seen) {
    const response = await request.get(url);
    expect(response.status(), `${url} should be served`).toBeLessThan(400);
  }
});
