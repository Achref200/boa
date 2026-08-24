# BOA — Technical architecture

## Shape

A **modular monolith** on Next.js 15 (App Router) + TypeScript strict + Prisma +
MySQL. One deployable, clear internal seams. Microservices would buy nothing at
BOA's stage and would cost a deployment story that Hostinger cannot tell.

```
src/
  app/
    [locale]/(store)/...      public storefront   — server components by default
    [locale]/(account)/...    customer account
    admin/...                 operations app      — own layout, own guard, no locale prefix
    api/...                   webhooks + the few genuinely-HTTP endpoints
  modules/                    the domain. No React in here, ever.
    catalog/  { repository.ts service.ts types.ts }
    cart/
    orders/     ( + pricing.ts, the single source of money truth )
    payments/   ( provider.ts interface + providers/ )
    reservations/ ( availability.ts, booking.ts )
    identity/   ( auth, sessions, rbac )
    content/    ( homepage blocks, editorial )
    media/      ( storage abstraction )
    audit/
  components/   ui primitives, brand, store, admin
  lib/          db, env, i18n, money, errors, rate-limit, validation helpers
  styles/       tokens.css + globals.css
```

**Rule:** `app/` may import from `modules/`; `modules/` may never import from
`app/` or `components/`. A module exposes a `service` (business rules, the only
thing routes call) over a `repository` (all Prisma access). This is what makes
the code testable without a browser and portable off Next.js later.

## Server/client boundary

Server Components render everything that is data. Client Components exist only
where there is genuine interaction: cart drawer, filters, gallery, quantity
stepper, booking calendar, admin forms, toasts. Mutations are **Server Actions**
guarded by a shared `withAction` wrapper that does: session resolution →
authorization → zod parse → rate limit → execute → typed result. There is no
parallel REST surface duplicating that logic; `api/` holds only webhooks, the
sitemap, media streaming and health.

## Data

Prisma over MySQL 8. Chosen because it is what Hostinger offers and because
Prisma's migration story is the one another developer will already know. Every
Prisma call goes through a repository, so swapping the ORM later touches one
layer.

Money: `Decimal(10,3)`, TND. Never `Float`. Conversions are centralised in
`lib/money.ts`; the rest of the codebase never does arithmetic on money.

Concurrency: order creation and reservation booking each run inside
`prisma.$transaction` with `Serializable` isolation, and both lean on database
constraints rather than read-then-write checks — a unique index on the
reservation seat, and a conditional stock decrement (`UPDATE ... WHERE stock >= n`)
whose affected-row count is the authority on whether the reservation of stock
succeeded.

## Identity

Database-backed sessions in an httpOnly, SameSite=Lax, Secure cookie holding an
opaque 256-bit token; the token is stored hashed, so a database dump does not
hand over live sessions. Passwords use bcrypt (`bcryptjs`, pure JS — chosen over
argon2 because Hostinger's shared containers cannot reliably build native
addons; documented as a portability trade-off, cost factor 12).

Authorization is capability-based from day one even though v1 ships one admin
role: `Role -> Permission[]`, checked by `can(actor, 'product.write')`. Adding
"order manager" later is a row, not a refactor. Every admin mutation writes an
`AuditLog` row with actor, action, entity, and a JSON diff.

## Media

`modules/media` exposes `put / get / delete / url`. v1 implements a local-disk
driver writing under `public/uploads` with content-hashed names, because that is
what a Hostinger Node container can do. An S3-compatible driver is a second file;
the schema stores a provider key plus a relative path, never an absolute URL, so
migrating storage is a config change and a copy job.

## i18n

Locale is a route segment. Translatable *content* (product names, descriptions,
content blocks) lives in per-locale translation tables keyed by entity + locale,
so admins translate without developers. Translatable *interface* strings live in
flat message files under `src/i18n/messages`. Arabic sets `dir="rtl"` at the
layout level and the CSS uses logical properties throughout (`margin-inline`,
`padding-block`, `inset-inline-start`) so RTL is free rather than a second
stylesheet.

## Performance

- Catalogue and product pages are statically generated with `revalidate`, and
  revalidated on demand by tag when admin publishes a change — so an edit is live
  in seconds without giving up static delivery.
- Every list query is cursor- or offset-paginated with an explicit `take`;
  `findMany` without a bound is a review failure.
- Relations are loaded with explicit `select`/`include` — no lazy N+1. The admin
  list screens select only the columns the table renders.
- Images go through `next/image` with declared ratios; the LCP hero image is
  `priority`, everything else is lazy.

## Testing

Vitest for the domain (`modules/**` — pricing, cart math, stock, availability,
rbac), Vitest + a disposable MySQL schema for repository/transaction tests
(double booking, idempotent orders), Playwright for the three journeys that must
never break: browse→cart→checkout, browse→reserve→confirm, admin→edit→storefront.

## Hostinger

Node ≥ 20, `next build` producing `.next/standalone`, started with
`node .next/standalone/server.js` behind Hostinger's proxy on `$PORT`. MySQL from
the hPanel. `public/uploads` must live on a persistent path — on Hostinger's Node
hosting the app directory persists between deploys, but the directory must be
created and writable; if the plan turns out to redeploy into a clean tree, switch
the media driver to S3-compatible storage. Documented in `DEPLOYMENT.md`.
