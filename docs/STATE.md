# BOA — current state

**Last updated: 2026-08-24.** Keep this file honest — it is the first thing the
next session reads, human or agent.

---

## Where the project stands

Phases 1–10 are built and working end to end against a real MySQL database.

| Area | State |
|---|---|
| Schema — 55 tables, `db/migrations/0001_init.sql` | done |
| Typed data layer (Kysely, generated `src/db/types.ts`) | done |
| Design tokens measured from the logo, three self-hosted typefaces | done |
| i18n — fr / en / ar, RTL, `Africa/Tunis` | done |
| Storefront — home, catalogue, category, product, rituals, brand, professionals, contact | done |
| Cart, checkout, order confirmation, tracking | done |
| Orders — transactional, idempotent, snapshotted, stock-safe | done |
| Reservations — availability engine, booking, DB-level double-booking prevention | done |
| Customer accounts — orders, reservations, addresses | done |
| `/admin` — auth, RBAC, dashboard, and every screen listed in `ADMIN.md` | done |
| Audit journal | done |
| SEO — metadata, canonicals, hreflang, sitemap, robots, JSON-LD | done |
| Security — CSP with nonce, rate limiting, hashed sessions, audit | done |
| Tests — unit, integration (real DB), E2E, axe | done, see below |
| Deployment guide for Hostinger | done |

**Last green accessibility run: 2026-08-21 — 11/11 (`accessibility.spec.ts`,
desktop project), including the admin dashboard.**

## Design system replaced — 2026-08-23

The storefront and admin were re-skinned from the **dark-ground, square-cornered**
system to a **warm, light, rounded** one, at the client`s direction. Documented in
full in `docs/BRAND.md`; the short version:

| | Before | After |
|---|---|---|
| Ground | Ink `#27282A` carried the page | Warm `#FBF8F1`, **derived from the brand gold**; ink now punctuates only |
| Radius | `0` everywhere, enforced by one `*{border-radius:0}` reset | Five-step scale, 8→24px, plus pills for actions |
| Elevation | A hairline | Two soft shadows tinted with `--color-gold-shadow` |
| Display | Bodoni Moda | **Calistoga** |
| Text / UI | Archivo | **Hanken Grotesk** (variable) |
| Primary action | Ink fill on paper | **Gold fill with ink label — 7.0:1** |
| Motion | 160/520ms, custom easing | 180/300ms, `power1.out`, 30ms stagger |

**No new hue entered the palette.** The warm neutrals are desaturated tints of
`#D2AC49` at its own hue; the nine measured colours are untouched. The logo was
not modified in any way.

What made this cheap: `font-display` is a Tailwind utility bound to a token, so
**40 files using it needed no change**, and the `data-surface` architecture meant
the colour swap was a token edit. The work that did need hands was radius —
60 card surfaces and 12 hand-rolled buttons that bypass `<Button>`.

Fonts are vendored as before (`src/assets/fonts/`, Fontsource woff2). The old
`bodoni-moda-*` and `archivo-*` files are **still on disk and now unused** —
delete them once the direction is confirmed.

Verified: `typecheck` and `lint` clean, `build` green including standalone, and
home / catalogue / product / admin sign-in / `ar` RTL checked in a browser.
**Not yet verified: the E2E suite** (see trap notes below) and the admin
workspace behind login.

A pre-change copy of `src/` and `docs/` is at
`../boa-backup-2026-08-23/` — this project is not under git.

## Media reserves and new test coverage — 2026-08-24

**Every image slot in the database is now filled.** `npm run db:media`
(`scripts/seed-media.ts`) draws a *declared reserve* per product, category,
ritual, service and hero block: a real PNG on the brand ground carrying the petal
seal, the item name, the expected dimensions and the words
"RÉSERVE, À REMPLACER". 18 files under `public/uploads/`, content-hashed exactly
as `modules/media/storage.ts` names uploads, so the whole pipeline
(storage → path → `mediaUrl` → `next/image`) is exercised for real.

No photograph was invented. Replacing a reserve is one upload per product in
`/admin`. The script is idempotent and refuses to overwrite a real upload without
`--force`.

### Defect found and fixed: product creation was broken

`tests/e2e/admin-crud.spec.ts` failed on its first run with
`fieldErrors: { "variants.0.id": ["Invalid input"] }` — **no product could be
created from the admin at all**, and the error pointed at a field the UI cannot
display, so the form only said "Vérifiez les champs signalés".

Cause: under **Zod 4** a *missing key* is rejected as "expected nonoptional" even
when the union accepts `z.undefined()`, and React drops undefined properties when
it serialises a Server Action payload. A new variant has no `id`, so the key was
absent. The same latent pattern existed in **16 places across 7 files** —
products, commerce, rituals, services, taxonomy and customer addresses. All now
use `.optional()`, which is the only thing that permits an absent key.

### Known defect, not fixed: soft 404

An archived product correctly renders the not-found page, but the server answers
it with **HTTP 200 instead of 404**. Verified against a clean standalone build
with the data cache cleared, so it is neither caching nor the query
(`fetchProductBySlug` filters `state = 'PUBLISHED'` correctly). A soft 404 keeps
dead product URLs in search indexes. Worth resolving before launch.

### Tests added

- `tests/e2e/auth.spec.ts` — customer sign-up, session survival across a reload,
  sign-out actually ending the session server-side, sign-in, keyboard-only
  completion, weak-password refusal, duplicate address, and the assertion that a
  wrong password is indistinguishable from an unknown account. **4/4 passing.**
- `tests/e2e/admin-crud.spec.ts` — one signed-in journey in eight steps: create →
  appears in the list → reads back cold from the database → live on the
  storefront → update → revalidates without a rebuild → recorded in the audit
  journal → archived, gone from the shop but still in the database.
- `tests/e2e/support/admin-account.ts` — closes open item 0b: aligns the seeded
  administrator with `SEED_ADMIN_PASSWORD` so admin journeys can sign in at all.
  **Side effect: after any admin spec runs, the local admin password is exactly
  what `.env.local` declares.**

### Three traps these tests had to be written around

1. **The in-process rate limiter.** `signUp` is 5 per 15 min and `adminSignIn` is
   6 per 10 min, and the buckets survive between spec files against one server.
   The specs are therefore grouped into journeys with a counted budget rather
   than one assertion per test. Restart the server between full runs.
2. **`getByRole('alert')` is ambiguous.** Next mounts its own route announcer
   with `role="alert"`, so every form-error assertion has to exclude
   `#__next-route-announcer__`.
3. **The default 45s test timeout is per test, not per step.** The admin journey
   sets its own.

### Environment note, worth fixing

`next start` **cannot serve this build** — `output: standalone` refuses it, and
says so in a warning that is easy to miss. Worse, because a second
`package-lock.json` sits at `C:\Users\Team_2`, Next infers *that* as the
workspace root and emits the server at
`.next/standalone/proejcts/boa-cosmetic/boa/server.js` — which is also why
`build:standalone` copies `public` and `static` to a path nothing reads. Serving
the copy without its `_next/static` assets produces a page with no JavaScript,
where forms fall back to a native GET submit and put the password in the URL.
Setting `outputFileTracingRoot` in `next.config.ts` fixes the whole chain.

## Open items

0. **The documented test inventory does not match the repository.** `docs/TESTING.md`
   describes `tests/unit/permissions.test.ts`, a whole `tests/integration/` layer
   (`fixtures.ts`, order/stock/reservation/identity coverage) and
   `tests/e2e/accessibility.spec.ts` with axe. **None of these files exist**, there is
   no axe dependency in `package.json`, and there is no `.env.test`. What actually
   runs is 12 unit tests in two files (money, tz) and 15 E2E tests in five specs.
   The "last green accessibility run: 11/11" line below therefore cannot be
   reproduced from this tree. Either restore the missing suites or correct
   `TESTING.md` — the current state overstates coverage, which is worse than
   having less of it.

0b. **The seeded admin password could never match the E2E credentials.**
   `scripts/seed.ts:125` falls back to a *random* password when
   `SEED_ADMIN_PASSWORD` is unset, while `tests/e2e/admin.spec.ts` falls back to
   `boa-dev-password-2026`. `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` were not
   documented in `.env.example` at all. They are now; set them **before**
   `npm run db:seed`, or the three admin E2E journeys fail on an otherwise
   correct build with "E-mail ou mot de passe incorrect".

0c. **Two production guards make repeated E2E runs fail for non-code reasons.**
   Both work as designed and neither should be weakened:
   - `admin_users.failed_logins` is incremented by the deliberate wrong-password
     assertion in `admin.spec.ts`. Five accumulated attempts lock the account for
     30 minutes. `tests/e2e/support/admin-lockout.ts` now resets it.
   - `src/lib/rate-limit.ts` is **in-process**, so its buckets survive across
     suite runs against a single `next start`. Back-to-back full runs exhaust
     `adminSignIn` (6/10min) and `checkout` (12/5min) and produce failures that
     look like application bugs. **Restart the server between full E2E runs.**

1. **Final senior review pass.** Visual consistency, responsiveness at all four
   breakpoints, DB integrity, authorization coverage, concurrency, code quality,
   deployment readiness — fixing what it finds, not only listing it.
2. **`npm run db:reset` is declared in `package.json` but `scripts/reset.ts`
   does not exist.** Either write it (drop + migrate + seed, refusing to run
   outside development) or remove the script entry.
3. **Real content.** Everything in `CONTENT-CHECKLIST.md` is still a placeholder.
   The platform cannot launch on placeholders.
4. **Payment gateway.** The abstraction is ready; there is no implementation,
   because BOA has no gateway account yet. `PAYMENT_PROVIDERS` currently enables
   `cod,cop,bank_transfer`.
5. **Mail.** Order and reservation confirmations log what they would send when
   `SMTP_URL` is unset. Configure it before launch.

## Recently fixed

- **Functional colour contrast.** `--color-caution` was `#b4762a` — 3.77:1 on
  white, which failed AA wherever a `StatusBadge` or a low-stock note sat on a
  light surface. The four functional colours are now measured twice: a
  light-ground set in `@theme` (all ≥4.88:1 on white, paper and sunken paper)
  and a lifted set inside `[data-surface='ink']` (all ≥5.13:1 on ink and
  ink-raised). Every value carries its measured ratio in a comment.
- Paper-surface muted token raised to `#5f6063` (5.7:1); `opacity-*` text
  dimming removed from ProductGallery, BookingCalendar, BuyPanel, MediaFrame,
  Field and ProductCard — opacity defeats contrast checking.
- Admin sign-in error is now `#admin-signin-error` with `tabIndex={-1}`, and the
  E2E test targets it directly rather than `getByRole('alert')`, which collided
  with Next's route announcer.
- Cart cookie was discarded over http because `secure` was derived from
  `NODE_ENV`. `src/lib/cookies.ts` now derives it from the site URL scheme.
- `src/lib/env.ts` is `import 'server-only'`, so a client import fails at build
  time instead of leaking configuration into the browser bundle.

## Known environment traps

- **Playwright browser version.** `@playwright/test` may expect a Chromium build
  that is not present. Point `PLAYWRIGHT_CHROMIUM_PATH` at an installed one, or
  run `npx playwright install chromium`.
- **Port 3000.** Playwright starts its own server. A stale `next dev` or
  `next start` on 3000 causes `EADDRINUSE` or, worse, serves old chunks and
  produces failures that look like application bugs. Stop it first.
- **`npm start` needs the environment.** `next build` emits a standalone bundle
  which reads configuration from the **process environment only** — correct on
  Hostinger, where hPanel supplies it, but locally `node .next/standalone/server.js`
  will refuse to start unless you export `DATABASE_URL` and `APP_SECRET`
  yourself. `next start` loads `.env.local` and is what the test harness uses.
- **`build:standalone` uses `cp -r`.** Run the build from Git Bash or WSL on
  Windows. Do not commit a Windows-only replacement — the host runs Linux.
- `npm test` **drops every table** in the schema `.env.test` points at.

## Git

Head: `4bc6397 docs: README and Hostinger deployment guide; feat: nonce-based
CSP, standalone start`.

Uncommitted at the time of writing: the accessibility pass (tokens and the
components it touched), the Playwright config comment, and this documentation
set. Commit them as `fix(a11y): …` and `docs: agent context pack`.
