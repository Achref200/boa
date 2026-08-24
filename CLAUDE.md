# CLAUDE.md — BOA Cosmetic platform

This file is the contract for any AI agent working in this repository. It is
loaded automatically by Claude Code (CLI and VS Code extension). Read it before
touching anything. Deeper reasoning lives in `docs/` — the index is
`docs/README.md`.

---

## 1. What this project is

A production platform for **BOA Cosmetic**, a real cosmetics brand based in
**Sousse, Tunisia**. One codebase, four surfaces:

1. **Storefront** — brand, catalogue, product discovery (fr / en / ar).
2. **Commerce** — cart, checkout, orders, payments, delivery and pickup.
3. **Reservations** — bookable services with real availability.
4. **`/admin`** — the operations application BOA staff actually run the business from.

Stack: **Next.js 15 (App Router) · React 19 · TypeScript strict · MySQL/MariaDB
via Kysely + mysql2 · Tailwind CSS v4 · Vitest · Playwright**. Deployment target
is **Hostinger** (Node app + MySQL on the same plan).

---

## 2. Non-negotiable rules

These come from the client brief (`docs/BRIEF.md`). Breaking one of them is a
defect even if the code compiles and the tests pass. The full list with
rationale is `docs/RULES.md`.

### Brand
- **The BOA logo is untouchable.** Never redesign, redraw, distort, recolour,
  re-crop, "clean up" or AI-generate it. Use the supplied asset as-is
  (`public/brand/`). If a placement needs a different treatment, change the
  placement.
- The design system is **derived from the real logo**, not invented. Colours,
  type and spacing come from `src/styles/tokens.css`, documented in
  `docs/BRAND.md`. Do not introduce a colour that is not a token.

### Truth
- **Never invent BOA facts.** No made-up products, prices, ingredients,
  certifications, awards, medical or dermatological claims, brand history,
  founder story, addresses, phone numbers, opening hours, statistics.
- **No fake social proof.** No invented reviews, testimonials, ratings, star
  counts, "trusted by 10,000 customers", press logos.
- Missing content renders as **nothing, or a clearly labelled placeholder that
  an administrator can replace** — never as filler prose or lorem ipsum.
- Structured data (JSON-LD) is emitted only from fields that really exist.

### Design (what "not AI-generated" means here)
Forbidden defaults: hero → three feature cards → stat row → testimonials → CTA;
the pink/lavender "cosmetics template" palette; decorative gradients;
glassmorphism; emoji as iconography; stock-photo-shaped placeholder blobs;
invented social proof of any kind.

BOA is a **warm-ground, gold-accent** brand. The storefront ground is a warm
off-white **derived from the brand's own gold** (`#FBF8F1`, `#F5EFE2`,
`#E7DFCD`) — not an imported beige, and never a new hue. Ink `#27282A` no longer
carries the page: it punctuates (footer, salon band, toasts, admin chrome).

Shape is a **scale, not a zero**: `--radius-xs|sm|md|lg|full`. Cards take
`rounded-md`, controls `rounded-sm`, actions are **pills**. Elevation is two
soft gold-tinted shadows, not a hairline. Display type is **Calistoga**, text
and UI **Hanken Grotesk**. See `docs/BRAND.md`.

One contrast rule that is easy to get backwards: gold as **text** on a light
ground is 1.9:1 and is forbidden; gold as a **fill carrying an ink label** is
7.0:1 and is the primary action.

### Engineering
- **No fake backend.** No mock arrays standing in for tables, no `localStorage`
  as a database, no admin CRUD that only mutates React state. Every screen reads
  and writes real MySQL.
- **The client never sends a price.** It sends `{ variantId, quantity }`.
  Money, stock, shipping and discounts are recomputed server-side at the moment
  of use (`src/modules/orders/pricing.ts`).
- **No raw card data** is ever accepted, logged or stored. Payments go through
  the provider abstraction in `src/modules/payments/provider.ts`.
- **No secrets in client code or in git.** Everything through `src/lib/env.ts`,
  which is `server-only`. `NEXT_PUBLIC_*` is the only thing allowed to reach the
  browser, and only for values that are public by nature.
- **Concurrency is enforced by the database**, never by the UI.

---

## 3. Repository map

```
db/migrations/            SQL — the single source of truth for the schema
docs/                     the reasoning; start at docs/README.md
scripts/                  migrate · seed · db type generation
src/
  app/
    (storefront)/[locale]/…   public site, three locales, fr is default
    (admin)/admin/…           operations app, separate root layout + session
  modules/                the domain. No React, no JSX, ever.
    catalog cart orders payments reservations identity content media admin audit
  components/             ui/ (primitives) brand/ store/ admin/
  lib/                    env money errors permissions routes datetime tz
                          rate-limit cookies password ids json labels cn fonts
  db/                     client.ts (Kysely) + types.ts (generated)
  i18n/                   config, translate, messages/{fr,en,ar}.ts
  styles/                 tokens.css (brand) + globals.css
tests/                    unit/ integration/ (real DB) e2e/ (Playwright)
```

**The dependency rule:** `app/` and `components/` import from `modules/` and
`lib/`. `modules/` imports from `lib/` and `db/` only — never from `app/` or
`components/`. A domain function must be callable from a script with no React
in scope.

---

## 4. Conventions you must follow

Full version: `docs/CONVENTIONS.md`. The ones that bite:

| Area | Rule |
|---|---|
| Money | A `MoneyString` (`"12.500"`), never a `number`. All arithmetic via `src/lib/money.ts` (bigint millimes). TND has **three** decimals. |
| Mutations | Server Actions only, returning `ActionResult<T>` from `src/lib/errors.ts`. Actions never throw across the RSC boundary. |
| Validation | Zod at the action boundary, re-validated server-side even if the form already validated. |
| Authorization | `assertCan(actor, 'permission')` from `src/lib/permissions.ts`. Never check a role name. |
| Dates | Store UTC. Format on the **server** in `Africa/Tunis` (`src/lib/tz.ts`) and ship strings. |
| Text | Never hardcode UI strings. `getTranslator(locale)` + `src/i18n/messages/*`. Admin UI is French. |
| Styling | Tailwind v4 utilities over `var(--token)` values. No raw hex in components. Surfaces via `data-surface="ink|paper"`. |
| Direction | CSS logical properties (`ms-`, `me-`, `inset-inline-*`). No `left`/`right` — Arabic is RTL. |
| Caching | `revalidateTag(CATALOG_TAG | CONTENT_TAG | SERVICES_TAG | CHECKOUT_TAG)` after any admin write that a public page renders. |
| Comments | Explain *why*, at the top of a module or a non-obvious block. No line-by-line narration. |
| Accessibility | WCAG 2.1 AA. Contrast ≥ 4.5:1 for text, 44px minimum touch targets, visible focus, keyboard-complete flows. The axe suite is a gate, not a report. |

---

## 5. Commands

```bash
npm ci
cp .env.example .env.local     # fill DATABASE_URL and APP_SECRET
npm run db:migrate             # apply db/migrations
npm run db:seed                # dev data; refuses to run with NODE_ENV=production
npm run db:media               # reserve imagery for every empty media slot (uploads are git-ignored)
npm run dev                    # http://localhost:3000

npm run typecheck              # tsc --noEmit, strict
npm run lint
npm test                       # vitest — unit + real-DB integration
npm run e2e                    # playwright — customer + admin journeys + axe
npm run db:types               # regenerate src/db/types.ts from the live schema
npm run build && npm start     # standalone build, what Hostinger runs
```

---

## 6. Definition of done

A change is finished when **all** of these hold:

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run e2e` pass.
2. Loading, empty, error and permission-denied states exist for anything new.
3. It works at 360px, 768px, 1280px and 1920px, and in `ar` (RTL).
4. New user-visible strings exist in **fr, en and ar**.
5. New admin capability is behind a permission and writes to `audit_logs`.
6. Schema changes are a **new numbered migration** — `0001_init.sql` is never
   edited — followed by `npm run db:types`.
7. No fabricated BOA content was added. Anything unknown is a placeholder listed
   in `docs/ASSUMPTIONS.md`.
8. The commit message says what changed and why, in the existing style
   (`feat(scope): …`, `fix: …`, `docs: …`).

---

## 7. How to behave in this repo

- **Read before writing.** The module you need almost certainly exists.
- **Ask before assuming a BOA fact.** If the answer would be invented, stop and
  add it to `docs/CONTENT-CHECKLIST.md` instead.
- **Prefer fixing over reporting.** If you find a real defect while doing
  something else, fix it or record it in `docs/STATE.md`.
- **Small, coherent commits** with a clean history. No "wip", no dumps.
- **Never commit** `.env.local`, `node_modules`, `.next`, uploaded media, or a
  database dump containing real customer data.
- Current status, open items and known issues: **`docs/STATE.md`**.
