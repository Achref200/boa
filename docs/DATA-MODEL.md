# BOA — data model

`db/migrations/0001_init.sql` is the single source of truth: 55 tables,
`utf8mb4_unicode_ci`, written to run on both **MySQL 8** and **MariaDB 10.6+**
(Hostinger may give you either). `src/db/types.ts` is generated from the live
schema by `npm run db:types` and must never be hand-edited.

Schema changes are **new numbered migrations**. `0001_init.sql` is history.

---

## Conventions in the schema

| | |
|---|---|
| Primary keys | 24-character opaque string ids (`src/lib/ids.ts`), not auto-increment — safe to expose, safe to generate before insert |
| Money | `DECIMAL(10,3)` — the Tunisian dinar has three decimals (millimes) |
| Timestamps | UTC `DATETIME`; the business timezone `Africa/Tunis` is applied on render |
| Locale | `ENUM('FR','EN','AR')` on every `*_translations` table |
| Publication | `ENUM('DRAFT','PUBLISHED','ARCHIVED')` — archiving is how things leave the site without breaking order history |
| Soft delete | `deleted_at` on anything an order can reference |
| JSON | Stored as text and parsed through `src/lib/json.ts` — MariaDB returns JSON as a string, MySQL does not |

---

## The groups

**Access control and audit**
`roles` · `permissions` · `role_permissions` · `admin_users` · `admin_sessions` ·
`audit_logs`

**Customers**
`customers` · `customer_sessions` · `addresses`

**Taxonomy**
`categories` + `category_translations` · `needs` + `need_translations` ·
`collections` + `collection_translations` + `collection_products`

**Catalogue**
`products` + `product_translations` · `product_variants` · `product_media` ·
`product_needs` · `product_relations` (`COMPLEMENTARY` | `SIMILAR`) ·
`stock_movements` · `reviews`

**Editorial**
`rituals` + `ritual_translations` · `ritual_steps` + `ritual_step_translations` ·
`content_blocks` + `content_block_translations` · `announcements` +
`announcement_translations` · `settings` · `inquiries`

**Commerce**
`carts` · `cart_items` · `orders` · `order_lines` · `order_events` · `payments` ·
`discounts` · `shipping_zones` · `pickup_points` + `pickup_point_translations` ·
`webhook_events` · `idempotency_keys` · `reference_counters`

**Services and reservations**
`services` + `service_translations` · `availability_rules` ·
`availability_exceptions` · `slots` · `reservations` · `reservation_seats`

**Infrastructure**
`schema_migrations`

---

## Invariants that must not be broken

### 1. Orders are immutable snapshots

`orders` and `order_lines` copy everything they display at the moment of
purchase: product name, variant format, SKU, unit price, tax, the delivery
address, the pickup point name, the shipping cost. Nothing on an order is
resolved through a join to a live row for display.

Consequence: **products are soft-deleted and ordered variants are deactivated,
never deleted.** Renaming or repricing a product cannot rewrite what a customer
bought.

`order_events` is the append-only history of status changes — who, when, from
what to what.

### 2. Stock is committed by the database

```sql
UPDATE product_variants
   SET stock = stock - ?
 WHERE id = ? AND (allow_backorder = 1 OR stock >= ?)
```

The **affected-row count is the authority**. Zero rows means someone else took
the last unit between the quote and the commit, and the transaction raises
`out_of_stock`. The number rendered on the page is advisory.

Every movement is recorded in `stock_movements` with a reason
(`MANUAL_ADJUSTMENT`, `ORDER_RESERVED`, `ORDER_RELEASED`, `ORDER_FULFILLED`,
`RESTOCK`), so stock is auditable rather than merely current.

### 3. A seat is a row, and the index is the guard

`reservation_seats` carries
`UNIQUE KEY uq_reservation_seats_slot_seat (slot_id, seat_index)`.

Booking takes `SELECT … FOR UPDATE` on the slot **and** inserts the seat row.
Two guarantees, deliberately independent: the lock serialises the readers, the
unique index makes a double booking physically impossible even if the lock is
ever wrong. `ER_DUP_ENTRY` is translated to `AppError('slot_unavailable')`.

### 4. References are allocated, not guessed

`reference_counters` is read `FOR UPDATE` inside the same transaction to produce
`BOA-25-0001`. No `MAX(id)+1`, no timestamp collisions.

### 5. Retries are safe

`idempotency_keys` is claimed before an order or a reservation is created. A
double-submitted form, a retried network call or an impatient customer produces
one record, and the second attempt returns the first result.

### 6. Webhooks arrive twice

`webhook_events` has `UNIQUE (provider, external_id)`. A duplicate delivery is
inserted once and ignored the second time.

### 7. Translation rows, not translation files

Content is translated per row. A product exists once in `products` and has up to
three rows in `product_translations`. A missing translation falls back to the
default locale rather than rendering a key or an empty page.
`product_translations` carries the FULLTEXT index used by catalogue search.

---

## Enumerations worth memorising

| Column | Values |
|---|---|
| `orders.status` | `PENDING` `CONFIRMED` `PREPARING` `SHIPPED` `READY_FOR_PICKUP` `COMPLETED` `CANCELLED` `REFUNDED` |
| `orders.fulfilment` | `DELIVERY` `HAND_TO_HAND` `STORE_PICKUP` |
| `orders.payment_method` / `payments.method` | `CASH_ON_DELIVERY` `CASH_ON_PICKUP` `BANK_TRANSFER` `ONLINE_GATEWAY` |
| `orders.payment_status` / `payments.status` | `UNPAID` `AUTHORIZED` `PAID` `FAILED` `REFUNDED` `CANCELLED` |
| `reservations.status` | `PENDING` `CONFIRMED` `COMPLETED` `CANCELLED` `NO_SHOW` |
| `discounts.kind` | `PERCENTAGE` `FIXED_AMOUNT` `FREE_SHIPPING` |
| `inquiries.kind` | `CONTACT` `PROFESSIONAL` |
| publication state | `DRAFT` `PUBLISHED` `ARCHIVED` |
