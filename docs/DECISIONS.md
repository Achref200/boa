# BOA — architecture decision log

Each entry: the decision, what was rejected, and why. Add to the end; do not
rewrite history.

---

### ADR-001 — Next.js App Router with two root layouts

The storefront and the admin application share a database and a domain, nothing
else. Route groups `(storefront)` and `(admin)` give each its own root layout,
fonts, chrome and session cookie inside one deployment.

*Rejected:* two separate applications (a second deploy, a second build, shared
domain code duplicated or extracted into a package Hostinger would have to
resolve).

---

### ADR-002 — Kysely + mysql2, not Prisma

Prisma's engine binaries were unreachable from the build environment, which
forced the question early — and the answer turned out to be the better one for
the target. Kysely is pure TypeScript with no native addon and no engine
download, which is exactly what a shared Hostinger Node environment can be
trusted to run. It also produces the SQL you wrote, which matters for the
`FOR UPDATE` locks and conditional updates this domain depends on.

*Cost:* the schema is hand-written SQL and `src/db/types.ts` is generated from
the live database (`npm run db:types`) rather than from a schema file.

---

### ADR-003 — Money as `DECIMAL(10,3)` and a string in TypeScript

The Tunisian dinar has **three** decimals. Floats are not an option, and a
`number` type invites `0.1 + 0.2`. Money crosses the wire as `"12.500"` and all
arithmetic happens in `bigint` millimes inside `src/lib/money.ts`.

---

### ADR-004 — Server Actions as the only mutation surface

One place to validate, authorise, audit and revalidate. Next.js's origin check
gives CSRF protection without a token dance. No REST layer exists to be called
with a forged price.

*Cost:* actions must return `ActionResult<T>` rather than throw, so failures
cross the RSC boundary as data.

---

### ADR-005 — Database-backed opaque sessions, not JWT

A revoked administrator must lose access **now**. A hashed token in a table
gives immediate revocation and leaks nothing if the database is dumped. JWT's
statelessness buys scale this business will not need for years, at the cost of
the one property it does need.

---

### ADR-006 — bcryptjs at cost 12, not argon2

argon2 is the stronger algorithm and needs a native addon. Hostinger's shared
Node environment cannot be relied on to compile one. A hash that runs everywhere
at cost 12 beats a better hash that fails at deploy.

---

### ADR-007 — Concurrency enforced by MySQL

Stock: conditional `UPDATE … WHERE stock >= n`, affected rows are the authority.
Seats: `UNIQUE (slot_id, seat_index)` plus a `FOR UPDATE` slot lock — two
independent guarantees. Application-level checks are advisory by definition,
because between the check and the write there is always a gap.

---

### ADR-008 — Immutable snapshots on orders and reservations

Everything displayed on a record is copied at the moment it happens. Products are
soft-deleted; ordered variants are deactivated. History cannot be rewritten by an
edit to a live row.

---

### ADR-009 — Dark ground, gold accent, zero radius

Measured from the official logo: the ink field is 78.2% of the mark's canvas and
the gold is a narrow ramp, not a single value. The brand is therefore
dark-grounded, and gold is an accent that never becomes body text on paper
(1.9:1). `--radius: 0` follows the mark's own geometry. Full measurements in
`BRAND.md`.

*Rejected:* the pink/beige cosmetics template, which would have been faster and
would have made BOA look like everyone else.

---

### ADR-010 — Self-hosted variable fonts

Bodoni Moda, Archivo and IBM Plex Sans Arabic, vendored from Fontsource and
loaded through `next/font/local`. No third-party font request: no external
dependency at render time, no CSP exception, no layout shift, no data leaving
the visitor's browser.

---

### ADR-011 — Locale in the route, French paths in every locale

`/en/soins`, not `/en/skincare`. One information architecture, one set of route
builders, one redirect map if a section is ever renamed. Content is translated
per row in `*_translations`; interface strings are typed against the French file
so a missing key fails the build.

---

### ADR-012 — Payment abstraction instead of a payment integration

BOA has no gateway account yet. Building a fake one would have been a lie in the
codebase. Cash on delivery, cash on pickup and bank transfer are fully
implemented; the online gateway is an interface with no implementation yet, and
the checkout only offers what `PAYMENT_PROVIDERS` enables.

---

### ADR-013 — Nonce-based CSP in middleware

`strict-dynamic` with a per-request nonce, no `unsafe-inline`. Adding a
third-party script becomes a deliberate act.

---

### ADR-014 — `next build` standalone, assembled by an npm script

Hostinger runs `node .next/standalone/server.js`. `build:standalone` copies
`public/` and `.next/static/` into the standalone tree so the artefact is
self-contained and the host needs no build step of its own.
