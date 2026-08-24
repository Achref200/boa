# BOA — code conventions

How code is written here, and why. Deviating is fine when you have a reason;
deviating silently is not.

---

## Language and typing

- TypeScript **strict**, plus `noUncheckedIndexedAccess` and `noImplicitOverride`.
  `array[i]` is `T | undefined` — handle it, do not `!` your way past it.
- `any` is banned. `unknown` plus a narrowing function is the answer. JSON
  columns are typed `unknown` and parsed through `src/lib/json.ts`.
- Types describing a shape that crosses a boundary live in a `types.ts` beside
  the module (`modules/catalog/types.ts`). Local types stay local.
- Prefer `type` aliases and discriminated unions over classes. `AppError` is the
  one class, because it needs `instanceof`.

## Module boundaries

```
app/ ─┐
      ├─► modules/ ─► lib/, db/
components/ ─┘
```

`modules/` contains **no React and no JSX**, ever. Anything in `modules/` must
be callable from `scripts/seed.ts`. If a domain function needs a React hook, the
design is wrong.

File roles inside a module: `service.ts` (use cases), `repository.ts` (queries),
`actions.ts` (`'use server'` entry points), `types.ts`, plus named files for
distinct concerns (`pricing.ts`, `availability.ts`, `booking.ts`).

A `'use server'` file may export **async functions only**. Constants go in a
sibling `constants.ts` — this is a Next.js requirement and it has bitten us.

## Money

```ts
type MoneyString = string;   // "12.500" — three decimals, Tunisian millimes
```

- Money is **never** a JavaScript `number`. `0.1 + 0.2` is a bug.
- All arithmetic goes through `src/lib/money.ts`, which converts to `bigint`
  millimes, operates, and converts back. Rounding is half-up, documented in the
  function.
- The database column is `DECIMAL(10,3)`.
- Formatting for display is `formatMoney(value, locale)` — never string
  concatenation with "TND".

## Server Actions

Every mutation is a Server Action. They are the only mutation surface, which
gives us Next.js's built-in origin check for free.

The shape, without exception:

```ts
'use server';
export async function doThingAction(input: unknown): Promise<ActionResult<T>> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return fail('validation_failed', '…', flatten(parsed.error));
  const actor = await requireActor();            // when the action is privileged
  assertCan(actor, 'thing.write');
  try {
    const data = await service.doThing(parsed.data);
    revalidateTag(CATALOG_TAG);                  // when a public page shows it
    return ok(data);
  } catch (error) {
    return toActionResult(error);                // AppError → code; anything else → generic
  }
}
```

Actions **never throw across the RSC boundary**. They return `ActionResult<T>`
from `src/lib/errors.ts`. The client branches on `result.ok` and maps
`result.code` to a translated message — it never renders `result.message` raw
from an unexpected error.

## Errors

- `AppError(code)` carries a stable machine code and an HTTP status
  (`src/lib/errors.ts`). The codes are a closed union — add to it deliberately.
- Anything not an `AppError` is logged server-side and surfaces as a generic
  message. A driver error must never leak a table name or a connection string.

## Authorization

`assertCan(actor, 'order.write')`. Nothing checks a role name — roles are just
bundles of permissions in `role_permissions`. Adding "content manager" is a row,
not a refactor. See `src/lib/permissions.ts`.

## Database access

- Kysely, typed from `src/db/types.ts`, which is **generated** by
  `npm run db:types` from the live schema. Do not hand-edit it.
- Schema changes are a **new numbered migration** in `db/migrations/`.
  `0001_init.sql` is history; it is never edited.
- Anything that must be atomic runs inside `db.transaction()`. Order creation
  and reservation creation each do all of their work in one.
- Write the SQL you mean. A clever query with a comment beats an ORM incantation
  nobody can debug at 2am.

## Dates and time

- Stored in UTC. Business timezone is **`Africa/Tunis`**.
- Formatting happens on the **server** (`src/lib/tz.ts`, `src/lib/datetime.ts`)
  and ships as a string. If the browser formatted a slot time, a customer in
  Paris would be shown 10:00 for a 09:00 appointment and would arrive an hour
  early.
- The only date arithmetic allowed in the browser is choosing which day's
  already-formatted list to display.

## Styling

- Tailwind v4 utilities referencing CSS variables: `text-[var(--surface-fg)]`.
- **No raw hex in components.** Every colour is a token in
  `src/styles/tokens.css`.
- Surfaces are contextual: `data-surface="ink"` or `data-surface="paper"`
  re-points `--surface-bg`, `--surface-fg`, `--surface-muted`,
  `--surface-line`, `--surface-accent`. A component reads the surface tokens and
  works on either ground without a prop.
- `--radius` is `0`. This is a brand decision, not an oversight.
- **Logical properties only**: `ms-`/`me-`, `ps-`/`pe-`, `inset-inline-start`.
  No `left`/`right`, no `ml-`/`mr-`. Arabic is RTL and the layout must mirror
  for free.
- Do not dim text with `opacity-70` — it defeats contrast checking. Use a
  muted **token**.

## Components

- Server Components by default. `'use client'` only when there is state, an
  effect, or an event handler — and then as low in the tree as possible.
- **Never pass a function as a prop to a Client Component** from a Server
  Component. Pass data (`productBasePath: string`, not `productHref: () => …`).
- Primitives live in `components/ui/` and take tokens, not colours.
- Every interactive element: a real `<button>`/`<a>`, an accessible name, a
  visible focus ring, ≥44px hit area.

## Internationalisation

- No hardcoded UI strings. `const t = getTranslator(locale)` and a key in
  `src/i18n/messages/{fr,en,ar}.ts`. A missing key is a build-time type error.
- The **admin interface is French** (it is BOA's working language); its labels
  are written inline in French, which is deliberate and consistent.
- Content is translated per-row in `*_translations` tables, not per-file.

## Caching

Public pages are statically generated with `revalidate` where it makes sense and
tagged. After any admin write that a public page renders, call `revalidateTag`
with the matching tag (`CATALOG_TAG`, `CONTENT_TAG`, `SERVICES_TAG`,
`CHECKOUT_TAG`). An admin edit that does not reach the storefront is a bug.

## Comments

Explain **why**, at the top of a module or above a non-obvious block. The
codebase's existing docblocks are the model: they justify a decision, name the
alternative that was rejected, or warn about a trap. No line-by-line narration,
no `// increment i`.

## Naming

- Files: `kebab-case.ts`; React components: `PascalCase.tsx`.
- Public URLs are **French** (`/soins`, `/rituels`, `/panier`) and built through
  `src/lib/routes.ts` — never string-concatenated at the call site.
- Database: `snake_case`, plural tables, `*_translations` for locale rows,
  `uq_*` unique indexes, `ix_*` ordinary ones.
- Boolean columns read as assertions: `is_default`, `allow_backorder`.

## Git

`feat(scope): …`, `fix: …`, `docs: …`, `chore: …`, `test: …`. One coherent change
per commit, message says what and why. No "wip", no giant dumps, no committed
secrets, `.next/`, `node_modules/` or uploaded media.
