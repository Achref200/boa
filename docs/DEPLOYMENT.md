# Deploying BOA to Hostinger

Written for Hostinger's Node.js hosting with a MySQL/MariaDB database from
hPanel. Nothing here assumes a local environment behaves like the server — the
differences that actually bite are called out.

## 1. Database

1. hPanel → **Databases → MySQL Databases** → create a database and a user.
2. Note the host (usually `localhost` for an app on the same plan), the database
   name, the user and the password. Hostinger prefixes both database and user
   names with your account id — use the full prefixed values.
3. Build the connection string:
   `mysql://USER:PASSWORD@localhost:3306/DATABASE`

**Engine.** Most Hostinger plans ship MariaDB, some ship MySQL 8. The schema is
written for both: `utf8mb4_unicode_ci` rather than MySQL 8's
`utf8mb4_0900_ai_ci`, and every JSON column is read through `parseJson`, because
MariaDB returns JSON as a string and MySQL returns it parsed.

## 2. Environment

Copy `.env.example` to `.env` on the server and fill it in.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | From step 1 |
| `NEXT_PUBLIC_SITE_URL` | `https://…`, no trailing slash. **This also decides whether cookies get the `Secure` flag** — an `http://` value in production means session cookies a browser will silently discard |
| `APP_SECRET` | `openssl rand -base64 48` |
| `MEDIA_DRIVER` | `local` unless you have configured object storage |
| `PAYMENT_PROVIDERS` | `cod,cop,bank_transfer` until a gateway is contracted |

`NEXT_PUBLIC_*` values are **inlined at build time**. Changing one requires a
rebuild, not a restart.

## 3. Build and start

```bash
npm ci --omit=dev=false     # devDependencies are needed for the build
npm run build               # next build + assembles .next/standalone
npm run db:migrate          # safe to re-run; already-applied files are skipped
npm start                   # node .next/standalone/server.js
```

In hPanel → **Node.js**, set:

- **Application root**: the folder you uploaded to
- **Application startup file**: `.next/standalone/server.js`
- **Node version**: 20 or 22 (`package.json` pins `>=20.11 <23`)

`npm run build` copies `public/` and `.next/static/` into `.next/standalone/`.
Without that step the standalone server starts and serves a site with no CSS and
no images — it is the single most common way this deployment goes wrong.

The app listens on `process.env.PORT`, which Hostinger sets. Do not hard-code
3000.

## 4. Uploaded media

The local media driver writes to `public/uploads`. Two consequences:

1. **The directory must exist and be writable** by the Node process. Create it
   before the first upload: `mkdir -p public/uploads && chmod 755 public/uploads`.
2. **It must survive a deploy.** If your deployment replaces the application
   directory wholesale, uploaded product photography is destroyed with it. Either
   deploy in place (git pull / rsync without `--delete` over `public/uploads`),
   or move to object storage.

Moving to object storage is a config change plus a copy job: the database stores
a *relative path*, never an absolute URL. Implement the S3 driver in
`src/modules/media/storage.ts`, set `MEDIA_DRIVER=s3` and
`NEXT_PUBLIC_MEDIA_BASE_URL`, and copy the existing files across. No data
migration is required.

## 5. HTTPS, headers and the CSP

Enable Hostinger's free SSL and force HTTPS before going live. The app sends a
per-request nonce-based Content-Security-Policy from `src/middleware.ts`. If you
later add a third-party script — analytics, a chat widget, a payment SDK — it
will be blocked until you add its origin to `script-src` and `connect-src`
there. That is the intended behaviour: an unlisted script cannot run.

## 6. What still needs configuration before launch

Listed live on the admin dashboard under **Contenu à compléter**, and in
`docs/ASSUMPTIONS.md`:

- real prices for every product (the seed values are placeholders)
- product descriptions, usage, composition, precautions
- product photography (4:5, 1600 × 2000 minimum)
- company address, phone, e-mail, opening hours → **Réglages**
- delivery zones and their real tariffs → **Livraison**
- the services BOA actually offers → **Services**
- legal notices and the return policy → **Réglages**

## 7. Operating notes

**Backups.** hPanel's automatic backups cover the database; `public/uploads` is
covered only if it is inside the backed-up application directory. Verify this
before you rely on it.

**Rate limiting is per process.** `src/lib/rate-limit.ts` is an in-process
limiter — correct for the single Node process Hostinger runs today. If the app
is ever scaled to more than one instance, that module has to move to Redis or a
database table. It is deliberately small so the swap is one file.

**Sessions and carts are database rows.** They accumulate. The admin dashboard
purges expired ones opportunistically on each visit, which is enough at BOA's
volume; if the tables ever grow uncomfortable, run `purgeExpiredSessions()` from
a scheduled task instead.

**Deploy checklist**

```
[ ] npm run typecheck && npm run lint && npm test   pass locally
[ ] .env on the server is complete, NEXT_PUBLIC_SITE_URL is https
[ ] npm run build succeeded and .next/standalone/public exists
[ ] npm run db:migrate applied cleanly
[ ] public/uploads exists and is writable
[ ] /admin reachable, sign-in works, dashboard shows real counts
[ ] a test order can be placed end to end, then cancelled from the admin
[ ] SSL forced, /robots.txt and /sitemap.xml return 200
```
