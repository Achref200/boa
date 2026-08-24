# BOA — security model

---

## Sessions

Two separate session systems that never share a cookie:

| | Customer | Administrator |
|---|---|---|
| Table | `customer_sessions` | `admin_sessions` |
| Cookie | storefront session cookie | admin session cookie |
| Scope | `/` | `/admin` |
| Lifetime | long, sliding | short, absolute |

Both are **database-backed opaque tokens**, not JWTs. The cookie holds a random
token; the database stores its **SHA-256 hash**. Consequences: a stolen database
dump does not yield usable sessions, and signing out — or an administrator
revoking access — takes effect immediately, which a self-contained JWT cannot
offer.

Cookies are `httpOnly`, `sameSite=lax`, `path`-scoped, and `secure` whenever the
site URL is `https://` (`src/lib/cookies.ts` derives this from
`NEXT_PUBLIC_SITE_URL` rather than from `NODE_ENV`, so a production build served
over http in a test environment still works).

Passwords: **bcryptjs, cost 12**. Chosen over argon2 because Hostinger's Node
environment cannot be relied on to build a native addon; a pure-JS hash that
actually runs beats a stronger one that fails at deploy. Hashes are never
selected into a view model.

## Authorization

Capability-based, defined once in `src/lib/permissions.ts`: 19 permissions, four
role blueprints. **Nothing in the codebase checks a role name** — every guarded
path calls `assertCan(actor, 'order.write')`. Roles are rows in
`role_permissions`, so a new role is configuration, not a refactor.

Authorization is checked in the Server Action, not in the component. A hidden
button is a courtesy; the action is the control.

## CSRF

Mutations are Server Actions only, which gives Next.js's origin check by
default. Nothing mutates on `GET`.

## Content Security Policy

Set in `src/middleware.ts` with a **per-request nonce**:

```
script-src 'self' 'nonce-…' 'strict-dynamic'
```

No `unsafe-inline`, no `unsafe-eval`. The nonce is forwarded to the render
through request headers. Adding a third-party script means adding it to the
policy deliberately — which is the point.

Alongside it: `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, and HSTS once the domain is on HTTPS.

## Rate limiting

`src/lib/rate-limit.ts` guards sign-in, registration, password paths, contact and
professional enquiry submission, and reservation creation. Repeated failed
sign-ins lock an account (`account_locked`, HTTP 423) rather than allowing
unlimited guessing. Limits are per-identifier and per-IP.

## Input validation

Zod at every action boundary. Validation runs on the server even when the form
validated in the browser — the browser is not a trusted participant. Uploads are
checked for MIME type and size (`MEDIA_MAX_BYTES`), given generated names, and
stored outside any executable path.

## Payments

- **No raw card data** is accepted, transported, logged or stored. There is no
  card field in this codebase.
- Cash on delivery, cash on pickup and bank transfer are implemented and require
  no card handling at all.
- An online gateway is a new implementation of the interface in
  `modules/payments/provider.ts`. Card capture happens in the gateway's hosted
  flow; we receive a signed result.
- Webhooks are signature-verified and deduplicated by
  `webhook_events (provider, external_id)`.

## Secrets

Everything comes from the environment through `src/lib/env.ts`, which is
`import 'server-only'` — an accidental client import fails at **build** time
rather than shipping the configuration to the browser. Only `NEXT_PUBLIC_*`
values reach the client, and only ones that are public by nature (site URL,
media base URL).

`.env.local` is git-ignored. `APP_SECRET` is 32+ random bytes; rotating it
invalidates signed cookies but not sessions, which live in the database.

## Audit

Every privileged mutation writes to `audit_logs`: actor, action, entity type and
id, a diff, IP and user agent, timestamp. The journal is readable at
`/admin/journal` under `audit.read` and is **append-only** — there is no
interface to edit or delete a row.

## Error disclosure

`AppError` codes are safe to show. Everything else is logged server-side and
rendered as a generic message. Stack traces, table names and connection strings
never reach a response body.
