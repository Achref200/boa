---
description: Run the full quality gate — typecheck, lint, unit + integration, E2E
---

Run the complete gate for this repository, in order, and stop at the first
failure:

```bash
npm run typecheck
npm run lint
npm test
npm run e2e
```

Then report:

1. Which stage failed, with the actual error — not a paraphrase.
2. For each failure, the file and the cause.
3. Whether the failure is a regression from the current change or pre-existing
   (check `docs/STATE.md` — known issues are listed there).

If everything passes, say so in one line and update `docs/STATE.md` with the
date of the last green run.

Notes:
- `npm test` needs a MySQL database pointed at by `.env.test`. It **drops every
  table** in that schema — never point it at development data.
- Playwright starts its own server. If a stale `npm run dev` is holding port
  3000, stop it first; the Playwright web server is the authoritative one.
