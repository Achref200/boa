---
description: Create a new database migration correctly
argument-hint: <short description of the change>
---

Create a migration for: $ARGUMENTS

Follow this exactly:

1. **Never edit `db/migrations/0001_init.sql`.** It is history. Create the next
   numbered file: `db/migrations/000N_<snake_case_description>.sql`.
2. Read `docs/DATA-MODEL.md` first and respect the conventions there:
   24-character string ids, `DECIMAL(10,3)` for money, UTC `DATETIME`,
   `ENUM('FR','EN','AR')` on translation tables, `utf8mb4_unicode_ci`,
   `deleted_at` on anything an order can reference.
3. The SQL must run on **both MySQL 8 and MariaDB 10.6+**.
4. It must be safe against a database that already contains orders: add columns
   nullable or with a default; do not rename or drop anything an order or
   reservation snapshot depends on.
5. Then run:
   ```bash
   npm run db:migrate
   npm run db:types      # regenerates src/db/types.ts — never hand-edit it
   npm run typecheck     # the compiler lists every call site to update
   ```
6. Fix the call sites, add or update the integration test that covers the new
   invariant, and note the change in `docs/DATA-MODEL.md` if it introduces one.
