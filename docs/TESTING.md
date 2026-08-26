# BOA — testing

Four layers, each answering a question the others cannot.

| Layer | Tool | Location | Question |
|---|---|---|---|
| Unit | Vitest | `tests/unit/` | Is the arithmetic right? |
| Integration | Vitest + **real MySQL** | `tests/integration/` | Does the transaction hold under concurrency? |
| End to end | Playwright | `tests/e2e/` | Can a person actually complete the journey? |
| Accessibility | Playwright + axe-core | `tests/e2e/accessibility.spec.ts` | Is it usable by everyone? |

```bash
npm test        # unit + integration
npm run e2e     # playwright, which starts its own server
```

## Unit

`money.test.ts` — millimes, rounding, three decimals, multiplication by integer
quantities, the half-up boundary. `permissions.test.ts` — capability resolution.
`tz.test.ts` — `Africa/Tunis`, computed against the runtime timezone database
rather than a hardcoded offset.

## Integration

These run against a **real database**, because the guarantees under test are
database guarantees and an in-memory fake would prove nothing.

`tests/integration/fixtures.ts` drops every table, replays
`db/migrations/0001_init.sql`, and seeds a minimal catalogue. Point `.env.test`
at a throwaway schema — `resetTestDatabase()` is destructive by design.

Covered: order creation end to end, idempotent retry, stock exhaustion under
parallel orders, reservation seat uniqueness, identity and session handling.

## End to end

`checkout.spec.ts` — browse, add, cart, checkout, confirmation, tracking.
`reservation.spec.ts` — booking, including **two browsers racing the same
slot**, asserting exactly one wins and the loser is told the slot is gone.
`admin.spec.ts` — sign in, edit a product, see the change on the storefront.
`routes.spec.ts` — every route renders in every locale.
`screenshots.spec.ts` — deterministic captures for review.

Playwright starts its own server (`playwright.config.ts`). A stale `npm run dev`
on the same port has caused confusing failures; the Playwright web server is the
authoritative one.

Two things in that config are load-bearing rather than cosmetic:

- **A `setup` project signs in once** (`tests/e2e/auth.setup.ts`) and saves the
  session to `tests/.auth/admin.json`; every admin test does
  `test.use({ storageState: ADMIN_STATE })` instead of signing in itself.
  Administrator sign-in allows six attempts per ten minutes per IP, so a suite
  that signs in per test trips its own limiter — and the failures then look like
  application bugs. The one test that deliberately spends attempts (credential
  probing) runs in the desktop project only.
- **`contextOptions: { reducedMotion: 'reduce' }`.** The site sets
  `scroll-behavior: smooth`, so a programmatic scroll is still animating when a
  click lands and something else takes the hit. The app already honours the
  reduced-motion preference, so the suite tests the same DOM a visitor with that
  setting sees, and clicks land where they were aimed.

The reservation specs consume seats. If a run reports that no bookable day is
offered, the seed has been used up — `npm run db:seed` — that assertion message
says so rather than failing as a mystery.

## Accessibility

axe-core scans eight public pages, the Arabic home page, and the admin
dashboard, and **fails on any WCAG A/AA violation**. Plus explicit tests for
keyboard-only add-to-cart and for the mobile menu's focus trap and Escape
handling.

This is a gate. When it goes red, fix the interface — do not lower the
threshold, and do not dim text with `opacity-*` to make a contrast check
disappear.

## Before you push

```bash
npm run typecheck && npm run lint && npm test && npm run e2e
```
