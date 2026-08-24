# BOA Cosmetic — digital platform

Storefront, commerce, reservations and an operations application for BOA
Cosmetic (Sousse, Tunisia). Next.js 15 · React 19 · TypeScript (strict) ·
MySQL/MariaDB · Kysely.

> **Read `docs/ASSUMPTIONS.md` first.** It separates what is confirmed about BOA
> from what is a professional assumption and what is a placeholder waiting for
> real content. No price, description, ingredient, claim or review in this
> repository is presented as BOA's own unless it is sourced there.

---

## Quick start

```bash
npm ci
cp .env.example .env.local          # then fill DATABASE_URL and APP_SECRET
npm run db:migrate                  # creates the schema
npm run db:seed                     # development data (refuses to run in production)
npm run db:media                    # fills every empty image slot with a declared reserve
npm run dev                         # http://localhost:3000
```

The seed prints a generated administrator password. Sign in at `/admin`.
Set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` to choose your own.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build + standalone bundle assembly |
| `npm start` | Runs the standalone server (what Hostinger executes) |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | ESLint with the Next config |
| `npm test` | Vitest — domain logic and database integration |
| `npm run e2e` | Playwright — the critical customer and admin journeys |
| `npm run db:migrate` | Applies every unapplied file in `db/migrations` |
| `npm run db:types` | Regenerates `src/db/types.ts` from the live schema |
| `npm run db:seed` | Development seed |
| `npm run db:media` | Draws a labelled reserve image for every empty media slot. `public/uploads/` is git-ignored, so run this after a fresh clone or the site renders empty frames. `--force` redraws and overwrites real uploads. |

## Architecture in one screen

```
db/migrations/       SQL — the single source of truth for the schema
src/
  app/
    (storefront)/[locale]/…   public site, three locales, fr default
    (admin)/admin/…           operations application, own session cookie
    sitemap.ts robots.ts
  modules/           the domain. No React in here, ever.
    catalog/ cart/ orders/ payments/ reservations/ identity/ content/ media/ admin/ audit/
  components/        ui primitives · brand · store · admin
  lib/               db, env, money, i18n, errors, rate-limit, permissions
  styles/            tokens.css (brand) + globals.css
```

**The rule:** `app/` imports from `modules/`; `modules/` never imports from
`app/` or `components/`. Every database read goes through a module, and every
mutation is a Server Action that re-validates, re-authorises and re-prices on
the server.

Longer reasoning lives in `docs/`:

- `docs/BRAND.md` — the visual language, measured from the official logo
- `docs/PRODUCT.md` — customers, information architecture, page reasoning
- `docs/ARCHITECTURE.md` — stack decisions and their trade-offs
- `docs/ASSUMPTIONS.md` — confirmed vs assumed vs placeholder
- `docs/DEPLOYMENT.md` — Hostinger, step by step

## Things worth knowing before you change something

**Money is a string, never a number.** The Tunisian dinar has three decimals.
All arithmetic goes through `src/lib/money.ts`, which works in `bigint`
millimes. `0.1 + 0.2` is a bug waiting in any code that does otherwise.

**The client never sends a price.** It sends `{ variantId, quantity }`.
`modules/orders/pricing.ts` re-reads every price, stock level, shipping zone and
discount from the database at the moment of use.

**Orders and reservations snapshot what they show.** Renaming, repricing,
unpublishing or archiving a product cannot alter a record of something that
already happened. That is why products are soft-deleted and variants that have
been ordered are deactivated rather than removed.

**Concurrency is enforced by the database, not by the UI.** Stock is committed
with a conditional `UPDATE … WHERE stock >= n` whose affected-row count is the
authority. A reservation seat is a row with a unique index on
`(slot_id, seat_index)`. Availability shown in the interface is advisory; both
paths are covered by tests that race two real browsers.

**Empty means empty.** A product with no description renders no description
section — it does not render invented copy. A missing image renders a labelled
placeholder with the expected dimensions. Company details that BOA has not
supplied are absent from the site and listed on the admin dashboard.

## Licence

Proprietary — BOA Cosmetic. The bundled typefaces (Bodoni Moda, Archivo,
IBM Plex Sans Arabic) are under the SIL Open Font License.
