# BOA — testing

> **Status check (2026-08-22).** This document describes the intended four-layer
> shape. Parts of it are not yet in the repository: there is no
> `tests/unit/permissions.test.ts`, no `tests/integration/` directory, no
> `tests/e2e/accessibility.spec.ts` and no axe dependency or `.env.test`. What
> runs today is **12 unit tests** (money, tz) and **15 E2E tests** across five
> specs. Sections below marked _(not yet implemented)_ are the plan, not the
> current state. See `docs/STATE.md` open item 0.

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

## Integration _(not yet implemented)_

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

## Accessibility _(not yet implemented)_

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
