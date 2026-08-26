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
`../boa-backup-2026-08-23/`. (This line said "this project is not under git";
it was `git init`ed on 2026-08-25 and now has one commit, `f3b71d9 first commit`.)

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

## Imagery verification pass — 2026-08-25

A sweep of every image placement on the public site, ahead of the first client
presentation. Four defects found, all fixed; `typecheck`, `lint` and the 12 unit
tests are green, and the new media suite is 12/12.

### Defect: images could render at zero height, silently

`MediaFrame` supplies its own `relative`, and `src/lib/cn.ts` is a plain
class-name joiner with no Tailwind conflict resolution. A caller that passed its
own position therefore emitted `relative absolute` — and because Tailwind v4
orders `.relative` after `.absolute`, the frame kept `position: relative`,
`inset-0` did nothing, the box collapsed to **760×0**, and the image disappeared.

Nothing threw. The request returned 200, the `<img>` was in the DOM, the file
decoded correctly, and every structural assertion in the existing suite passed.
The visible symptom was that **the whole "Formulé à Sousse" ink band on the home
page rendered as an empty black rectangle** — the single most prominent brand
moment on the page, in that state since the 2026-08-23 re-skin.

`MediaFrame` now supplies `relative` only when the caller has not chosen a
position of its own, so no call site can reintroduce it.

### Two image placements existed in the database but were never rendered

`categories.image_path` (6 rows) and `rituals.cover_path` (1 row) were written by
`npm run db:media` and read by nothing. Both are now rendered:

- **category masthead** — `soins/[category]`, 3:1, above the grid;
- **ritual cover band** — `rituels/[slug]`, 5:2, under the header.

Both are conditional, not reserved frames: a category is a navigational page and
an empty placeholder band would push the products below the fold for nothing.
`CategoryView` gained `imagePath`; `RitualView.coverPath` was already fetched.

### Reserves are now drawn at the ratio they are displayed at

A reserve exists to say *"this is a reserve, replace it"*, and `object-cover`
crops that line out of any plate whose ratio does not match its frame. The single
1800×1200 cover plate, shown in a 3:1 masthead, lost its
`BOA COSMETIC · RÉSERVE, À REMPLACER` footer and read as a broken image.
`scripts/seed-media.ts` now draws each cover at its display ratio — categories
1800×600, rituals 1800×720, services and collections unchanged at 1800×1200.

### `screenshots.spec.ts` wrote outside the project

`OUT` was the absolute `/root/boa/screenshots`, which existed on one Linux
machine and silently resolved to `C:\root\…` on Windows. It is now
`path.join(process.cwd(), 'screenshots')`, which `.gitignore` already covers.

### Test added: `tests/e2e/media.spec.ts`

Eleven routes plus a reachability pass, asserting **geometrically** rather than
structurally: a visible `<img>` must have a real box and a non-zero intrinsic
size. Images inside a `display:none` subtree are excluded, because the product
gallery deliberately renders the mobile swipe rail and the zoom dialog off-screen
at desktop widths, and each page is scrolled end to end first so that a
`loading="lazy"` footer mark is not read as broken.

**The suite was verified against the bug**: with the `MediaFrame` fix reverted,
`imagery renders on /fr` fails and names `content/88f6…png` — the maison band —
as collapsed. With the fix in place it passes, **24/24 across the desktop and
mobile projects**, against a single dev server on a clean `.next/cache`.

### Two traps this pass ran into, worth knowing

1. **`unstable_cache` survives a dev-server restart.** After `db:media` redrew
   the category plates, the page kept serving the *old* path from
   `.next/cache`, and `next/image` still had the old optimised copy — so the
   masthead showed a 1800×1200 plate that no longer existed on disk. `rm -rf
   .next/cache` before judging any change to seeded media.
2. **A dev server that fails to bind does not fail.** `next dev` prints
   `Port 3000 is in use … using available port 3001 instead` and carries on, so
   a stale server keeps answering on 3000 while the edited code runs on 3001.
   Every "my change did nothing" moment in this pass was that.
3. **Two dev servers share one `.next`, and corrupt it.** Following on from (2),
   the second server writes the same webpack cache as the first. The symptom is
   `[webpack.cache.PackFileCacheStrategy] Caching failed … ENOENT … 3.pack.gz`,
   a `Fast Refresh had to perform a full reload`, and **transient 500s on pages
   that are fine seconds later** — `media.spec.ts` failed twice on
   `expect(status).toBe(200)` for exactly this reason, and passed 24/24 once a
   single server owned the directory. Never `rm -rf .next/cache` while a server
   is running either; stop everything first, then wipe, then start one server.
   `Get-NetTCPConnection -LocalPort 3000,3001,3002 -State Listen` shows the
   stragglers.

### Still open after this pass

- **No admin UI uploads a cover.** Only `product_media` has an upload manager.
  `categories.image_path`, `rituals.cover_path`, `services.cover_path` and
  `content_blocks.media_path` can be set **only** by `npm run db:media`. Every
  one of those placements now renders, so this is the gap that matters most for
  handing the site over: BOA cannot replace those four kinds of image without a
  developer. See `CONTENT-CHECKLIST.md`.
- 3 of 8 products are `DRAFT` (`boa-gommage`, `boa-savon-noir`,
  `boa-body-splash`), so the shop presents 5. Intentional or not, it is a
  content decision to confirm before the presentation.
- `collections` has 0 rows, so no collection surface renders at all.
- The soft 404 below is unchanged.

## Imagery weight and delivery pass — 2026-08-25

The previous pass made every placement *render*. This one makes the delivery
cheap. No new placement was added and no component moved — the changes are the
encoding, the cache policy and what gets fetched when.

### Reserves are WebP, not PNG

`scripts/seed-media.ts` wrote PNG. These plates are flat vector art at up to
2400×1600, where PNG costs ~62% more bytes for a pixel-identical result, and
`next/image` re-reads the source on every cold optimise. Switching `writePlate`
to `webp({ quality: 82 })` took `public/uploads/` from **4.2 MB → 1.6 MB** across
34 files. WebP was already in `storage.ts`'s allowed upload types, so a reserve
is still indistinguishable from a real upload.

The 35 orphaned PNGs were deleted after confirming **zero** rows in
`product_media`, `categories`, `rituals`, `services` or `content_blocks` still
referenced a `.png`.

### `/uploads/*` is now cached immutably

Filenames are a sha256 of the bytes, so a URL cannot change meaning — replacing
a photograph produces a new path. Next sends long-lived caching for
`_next/static` and `_next/image` but **nothing at all** for the raw files it
serves out of `public/`, so every returning visitor refetched the whole
catalogue. `next.config.ts` grew a `headers()` entry setting
`public, max-age=31536000, immutable`, plus `minimumCacheTTL` so the optimiser
stops re-encoding on its 60-second default.

Verified against the running server: the raw file returns the immutable header,
and `_next/image` with an AVIF `Accept` serves **4 KB** for a catalogue card that
is 40 KB at source.

### `deviceSizes` / `imageSizes` trimmed to the layouts that exist

Next's defaults span 16px→3840px and it generates every candidate a `sizes`
string can reach. The widest real box is the 1440px maison band. The lists are
now bounded by what the site actually renders — and `imageSizes` deliberately
includes **56, 64, 80 and 96**, because dropping a width a fixed-px `sizes`
names makes Next round *up* and ship a larger thumbnail than the slot.

### Product gallery stopped double-loading the LCP image

Two real defects, both invisible because the page looked correct:

1. **The zoom dialog always mounted its `100vw` image.** A closed `<dialog>`
   still renders its children, so every product page paid for a full-viewport
   decode that most visitors never open. It is now mounted only while `zoomed`.
2. **The mobile rail carried `priority` on image 0 and a flat `sizes="100vw"`.**
   Both rails are in the DOM at every width — only CSS hides one — so desktop
   preloaded the LCP file twice and picked the widest candidate for a rail it
   never shows. The rail now uses `loading="eager"` on the first image only and
   `sizes="(min-width: 1024px) 1px, 100vw"`.

### `MediaFrame` fades in instead of popping

Every non-`priority` image is now explicitly `loading="lazy"` and fades up from a
50-byte inlined 1×1 WebP of `--color-paper-sunken` (#f5efe2) — the media well's
own ground. Encoding a real per-asset thumbnail cannot work here: media is
uploaded at runtime and the path is all the database stores. This costs no
request, never goes stale when a photograph is replaced, and leaves no seam if
an image fails to load.

### Defect fixed: WebP and AVIF uploads stored NULL dimensions

`storage.ts` accepts `image/webp` and `image/avif`, but `readImageSize` parsed
only PNG and JPEG and fell through to `null` — so `product_media.width/height`
were NULL for exactly the formats a modern phone or export pipeline produces,
which is what `next/image` needs to reserve layout. It now parses the WebP RIFF
container (all three of `VP8X`, `VP8L`, `VP8 `) and the AVIF `ispe` box.
Verified against sharp-encoded fixtures at 1234×567: **6/6 formats** return the
exact intrinsic size.

### Pre-existing: `npm run build` does not produce a standalone server

`next build` exits **0** while printing `PageNotFoundError: Cannot find module
for page: /admin` and `Failed to collect page data`, and `.next/standalone/` is
never created — so `build:standalone` copies into nothing and `npm run e2e`,
whose `webServer` runs `.next/standalone/server.js`, hangs waiting for a server
that cannot boot.

**This is not caused by the changes above.** It was confirmed by stashing every
edit in this pass and rebuilding from a clean tree: the baseline fails
identically. The exit code being 0 is what hides it. This blocks production
deploy and the e2e suite, and should be the next thing fixed.

The imagery work here was therefore verified against `next dev` on port 3007
plus `E2E_BASE_URL`, not against a standalone build.

## Product imagery — 2026-08-26

The catalogue now shows **product renders instead of "asset missing" plates.**

The previous reserves were correct by the letter of the no-invented-content rule
and useless in front of a client: a grid of documents reading
`BOA COSMETIC · RÉSERVE, À REMPLACER` looks like a broken site, not a shop.

`scripts/media/vessels.ts` draws seven vessel types — bottle, pump, jar, tube,
flacon, sachet, bar — from primitives, on the brand grounds, in the brand
palette, with glass shading and a contact shadow. Each product's vessel is
**stated explicitly** in `VESSEL_BY_SLUG`, not guessed at runtime, with a
category/name fallback for products added later.

Three views per product, so the gallery rail, the dot pagination and the zoom
all have something real to show: `front` (the vessel), `detail` (a texture
field) and `packaging` (a carton). The wide editorial bands get an abstract
composition from `editorial()` rather than a stretched product.

### What these are, precisely

Generated renders. **Not photographs, not stock, not traced from any real
product.** They make no claim: the label prints the product name the database
already holds, the category, and the real `product_variants.format` — and the
volume appears *only* when a variant actually declares one. No ingredient,
certification or origin is invented. `docs/ASSUMPTIONS.md` carries the full
statement.

They are still placeholders. They land in `public/uploads/products/` with the
same content-hashed naming as a real upload, so replacing one is a single
upload in `/admin` with no code change.

### Two drawing bugs found by looking at the render

Both were caught by rendering a contact sheet before touching the database,
which is the cheap way to do this:

1. **The tube was upside down.** It was drawn with the crimped seam at the foot
   and the cap on top, so the seam sat under the label and read as a bottle with
   a broken base. A tube stands *on its cap*.
2. **The packaging carton was a stamp in the corner.** Drawn at 420×560 inside a
   1000-wide box. Also, `d` (the receding side) means the visual centre is
   `x + (w + d)/2`, not `x + w/2`.

### Weight

`public/uploads/` is **824 KB** across 34 files — down from 4.2 MB of PNG
reserves before the 2026-08-25 pass. A catalogue card is 14 KB at source and
**2 KB served** as AVIF. The immutable `/uploads/*` cache header and the trimmed
`deviceSizes`/`imageSizes` from the previous pass are unchanged and verified
still working against the running server.

Orphan cleanup is a real step here: `--force` rewrites every path, so the old
files stop being referenced. Both regenerations in this pass were followed by a
sweep that deletes any file under `public/uploads/` not referenced by
`product_media`, `categories`, `rituals`, `services`, `collections` or
`content_blocks`.

### Verified

`typecheck`, `lint`, 12/12 unit, and the home / catalogue / product pages
captured and inspected at 1280px. The pre-existing standalone build failure
(below) still blocks `npm run build`, so this was verified against `next dev`
with `E2E_BASE_URL`, not a production build.

**`npm run db:media -- --force` overwrites real uploads.** Once BOA supplies
photography, use the no-flag form, which only fills empty slots.

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
