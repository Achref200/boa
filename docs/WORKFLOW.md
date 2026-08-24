# BOA — working on this repository

Written for someone continuing the work in **VS Code with the Claude extension**.

---

## 1. What Claude reads automatically

| File | Loaded | Purpose |
|---|---|---|
| `CLAUDE.md` (repo root) | every session, automatically | the contract: rules, structure, conventions, definition of done |
| `docs/**` | on demand | the reasoning behind everything |
| `.claude/commands/*.md` | as slash commands | repeatable project chores |
| `.claude/settings.local.json` | every session | **your** local tool permissions — personal, not committed |

So: ask Claude to "read `docs/DATA-MODEL.md` before changing the schema" and it
will. The rules in `CLAUDE.md` apply without being asked for.

Keep `CLAUDE.md` short and true. When a rule changes, change it there — a
contract nobody trusts is worse than none.

## 2. Local setup

```bash
git clone <repo> && cd boa
npm ci
cp .env.example .env.local
```

Fill in `.env.local`:

- `DATABASE_URL` — a local MySQL 8 or MariaDB 10.6+. XAMPP, Laragon, a Docker
  container, whatever you already run on Windows.
- `APP_SECRET` — 32+ random bytes. `openssl rand -base64 48`, or in PowerShell:
  `[Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))`
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` in development.

Then:

```bash
npm run db:migrate     # create the schema
npm run db:seed        # development data — prints a generated admin password
npm run dev            # http://localhost:3000  ·  admin at /admin
```

`npm run db:seed` refuses to run when `NODE_ENV=production`. Set
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` to choose your own credentials.

**Windows note.** `build:standalone` uses `cp -r`. It works in Git Bash and WSL;
in PowerShell either run the build from Git Bash or replace those two copies
with `xcopy` locally. Do not commit a Windows-only build script — Hostinger runs
Linux.

For tests, create a **separate throwaway schema** and point `.env.test` at it.
`resetTestDatabase()` drops every table; never aim it at your development data.

## 3. The loop

1. Read the relevant `docs/` page. The module you need probably exists.
2. Change the code.
3. `npm run typecheck && npm run lint && npm test`
4. `npm run e2e` before anything touching checkout, booking, auth or layout.
5. Update `docs/STATE.md` if you opened or closed something.
6. Commit: `feat(scope): …` / `fix: …` / `docs: …`, one coherent change.

## 4. Changing the schema

```bash
# 1. write db/migrations/0002_<what>.sql — never edit 0001_init.sql
npm run db:migrate
npm run db:types        # regenerates src/db/types.ts from the live schema
npm run typecheck       # the compiler now tells you every call site to fix
```

A migration is forward-only and must be safe to run against a database that
already has orders in it. Add columns nullable or with a default; do not rename
a column that an order snapshot depends on.

## 5. Adding a page

1. Route under `src/app/(storefront)/[locale]/…` — a **Server Component**.
2. Add its builder to `src/lib/routes.ts`.
3. Read data through a module, never with a query in the page.
4. Strings via `getTranslator(locale)`, keys in all three message files.
5. `generateMetadata` with canonical + `alternates.languages`.
6. Loading, empty and error states.
7. Check it at 360px and in `/ar`.
8. Add it to `tests/e2e/routes.spec.ts` and to the axe sweep.

## 6. Adding an admin capability

1. A permission in `src/lib/permissions.ts` (and the role blueprints that get it).
2. A Server Action: Zod → `assertCan` → service → `audit` → `revalidateTag` →
   `ActionResult`.
3. A screen under `src/app/(admin)/admin/(workspace)/…`, French labels.
4. Confirmation for anything destructive.
5. A test that a user **without** the permission is refused by the action, not
   merely shown no button.

## 7. Talking to Claude in this repo

Useful, because it makes the constraint explicit:

> "Add a gift-wrap option at checkout. Follow `docs/CONVENTIONS.md` and
> `docs/COMMERCE.md`: the price is server-computed and snapshotted onto the
> order. No new colours. Update the three message files."

Not useful, because it invites invention:

> "Make the product page look nicer and add some content."

If a task needs a fact about BOA that nobody has supplied — a real price, a real
ingredient list, an opening hour — the correct move is to **stop and add it to
`docs/CONTENT-CHECKLIST.md`**, not to fill the gap plausibly.

## 8. Handing back

Leave `docs/STATE.md` accurate. It is the first thing the next session reads —
human or agent — and an out-of-date status file costs more than it saves.
