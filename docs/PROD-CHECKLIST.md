# Deploying BOA to Vercel

The app already ships a Vercel branch: `next.config.ts` skips the Hostinger
`standalone` output when `process.env.VERCEL` is set, so the same tree builds
for both hosts. This document is the Vercel-specific process and the go-live
checklist. The Hostinger procedure stays in `docs/DEPLOYMENT.md`.

## What is different on Vercel

| Concern | Hostinger | Vercel | Consequence |
|---|---|---|---|
| Database | MySQL on the same plan, `localhost` | **No MySQL provided** — `DATABASE_URL` must point at a reachable external MySQL/MariaDB | The build itself connects to the database (page-data collection for the catalogue and ritual pages), so an unreachable host fails the build, not just the runtime |
| Uploaded media | `public/uploads` on disk | Read-only, ephemeral filesystem | `MEDIA_DRIVER=local` uploads are lost on the next deploy. For real media, implement the S3 driver (`src/modules/media/storage.ts`) and set `MEDIA_DRIVER=s3` + `NEXT_PUBLIC_MEDIA_BASE_URL` |
| Rate limiting | One process, in-memory buckets | Multiple serverless instances | `src/lib/rate-limit.ts` buckets are per instance. Move to a shared store before relying on them in production |
| Build output | `.next/standalone` + `npm start` | Next.js default | Nothing to do; `process.env.VERCEL` switches config automatically |
| Node version | 20 / 22 | 22.x (from `"engines": ">=20.11 <23"`) | Fine |

## 1. Environment variables (Project → Settings → Environment Variables)

Validated at build time by `src/lib/env.ts`; a wrong value fails the build with
an explicit message. Everything below must exist for **Production** and
**Preview**.

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:3306/DB` | Must be reachable **from Vercel** — never `localhost` |
| `NEXT_PUBLIC_SITE_URL` | `https://<production-domain>` | No trailing slash. Inlined at build time — changing it requires a redeploy |
| `APP_SECRET` | `openssl rand -base64 48` | ≥ 32 chars; rotating it invalidates signed cookies |
| `NODE_ENV` | `production` | |
| `MEDIA_DRIVER` | `local` | `s3` once the object-storage driver is implemented |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | *(empty)* | Only meaningful with `MEDIA_DRIVER=s3` |
| `MEDIA_MAX_BYTES` | `5242880` | 5 MB upload cap |
| `PAYMENT_PROVIDERS` | `cod,cop,bank_transfer` | Until a gateway is contracted |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | admin@boacosmetic.tn / *(generated)* | Used only by `npm run db:seed`; change the password after first sign-in |

Deployment history note (2026-09-20): the first production deployment failed at
"Linting and checking validity of types" because `@axe-core/playwright` was
imported by `tests/e2e/accessibility.spec.ts` without being in
`package.json`, and `tsconfig.json` includes `**/*.ts`. The second failure was
empty/malformed environment variables. Both are fixed; any future build error
is visible on the deployment page → **Building** → **Runtime Logs**.

## 2. Deploy

```bash
npm run typecheck && npm run lint && npm test && npm run build   # locally first
git push origin main                                             # production deploy (Git integration)
# or, from an uncommitted tree:
vercel --prod
```

## 3. Database provisioning (one-time)

1. Create the MySQL/MariaDB database on a host reachable from Vercel
   (a cloud provider or the Hostinger DB with remote access enabled).
2. From this repository, with `DATABASE_URL` pointing at that host:

   ```bash
   npm run db:migrate          # creates the 55-table schema, safe to re-run
   npm run db:seed             # optional — demo catalogue + first admin
   npm run db:media            # optional — placeholder imagery
   ```

   `db:seed` and `db:reset` refuse to run against `NODE_ENV=production`
   databases unless forced; see the script headers.

### Demo tier: exposing a local MySQL with ngrok

For a public demo without a managed database, the development MySQL on this
machine can be published over a TCP tunnel:

```bash
ngrok config add-authtoken <TOKEN>     # once, from dashboard.ngrok.com
ngrok tcp 3306                         # prints e.g. tcp://0.tcp.eu.ngrok.io:12345
```

Then set `DATABASE_URL=mysql://boa:boa_dev_pw@0.tcp.eu.ngrok.io:12345/boa_dev`
in Vercel and redeploy. **Limitations, stated plainly:** the URL changes every
time the tunnel restarts, the machine must stay online, and the deployed site
runs on development data. This is a demo configuration, not production.

## 4. Verification after every deploy

```bash
npm run verify:deploy -- https://<production-url>
```

The script checks: storefront locales render, `/robots.txt` and
`/sitemap.xml`, the admin sign-in screen, the locale redirect, the five
security headers, and that a bad admin credential is rejected server-side.
Exit code 0 = green; wire it into CI or run it manually after each deploy.

Deeper verification, when the database is seeded:

```bash
E2E_BASE_URL=https://<production-url> npm run e2e
```

**Warning:** the E2E suite creates and deletes real rows (products, orders,
reservations) in the deployment's database, and `adminSignIn` is limited to
6 attempts per 10 minutes. Do not point it at a database that carries real
customer data.

## 5. Go-live checklist

```
[ ] npm run typecheck && npm run lint && npm test all pass locally
[ ] npm run build passes locally (same Node major as Vercel)
[ ] DATABASE_URL points at a reachable external MySQL — verified with a
    direct connection from this machine AND from a non-local network
[ ] npm run db:migrate applied cleanly against that database
[ ] All environment variables set for Production AND Preview (see table §1)
[ ] NEXT_PUBLIC_SITE_URL is the https production domain, no trailing slash
[ ] Production deployment status: Ready (Vercel dashboard → Deployments)
[ ] npm run verify:deploy -- https://<production-url> exits 0
[ ] /admin sign-in works with the real credentials, dashboard shows counts
[ ] one test order placed end to end, then cancelled from the admin
[ ] media: either MEDIA_DRIVER=s3 is configured, or the team understands
    uploads are lost on every redeploy with the local driver
[ ] custom domain attached and HTTPS active (Vercel does this automatically
    once the domain is added; verify the certificate)
[ ] robots.txt and sitemap.xml reference the production domain
[ ] the admin password from the seed has been changed after first sign-in
```

## 6. Rollback

Vercel keeps every deployment. Dashboard → **Deployments** → pick the last
known-good deployment → **⋯ → Promote to Production**. No code action needed;
a rollback never touches the database.

