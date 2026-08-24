# BOA — commerce

## The rule everything else follows

**The client sends `{ variantId, quantity }`.** Never a price, never a total,
never a discount amount, never a shipping cost. Every figure is recomputed from
the database at the moment it is used.

## Pricing

`src/modules/orders/pricing.ts` is the only place money is computed.

- `priceLines()` re-reads every variant, drops lines whose product is no longer
  published (returning a structured *issue*, not a silent removal), and reduces
  quantities that now exceed stock.
- `quoteShipping()` resolves the governorate to a `shipping_zones` row and
  returns `{ available: false }` for a governorate BOA does not serve — an
  unserved address is not a zero-cost address.
- `quoteOrder()` composes lines, shipping, discount and total.

The cart page, the checkout page and order creation all call the same quote. The
customer cannot be shown one total and charged another, because there is only
one calculation.

Arithmetic runs in `bigint` millimes via `src/lib/money.ts`. A `DECIMAL(10,3)`
column and a three-decimal string, never a float.

## Cart

A cart is a row (`carts` + `cart_items`), identified by a signed cookie for a
guest and attached to the customer on sign-in. It survives a device change once
the customer is known. Cart contents are re-priced on every render; a cart is a
list of intentions, not a saved total.

## Checkout

Three fulfilment methods, all confirmed by the client:

| Method | What it means |
|---|---|
| `DELIVERY` | Shipped to an address, priced by governorate zone |
| `HAND_TO_HAND` | Delivered in person by BOA |
| `STORE_PICKUP` | Collected at a `pickup_points` location |

Four payment methods:

| Method | Status |
|---|---|
| `CASH_ON_DELIVERY` | Implemented, no configuration |
| `CASH_ON_PICKUP` | Implemented, no configuration |
| `BANK_TRANSFER` | Implemented — instructions shown on confirmation |
| `ONLINE_GATEWAY` | Abstraction ready; a provider is plugged in when BOA has an account |

Enabled methods are configured with `PAYMENT_PROVIDERS` and surfaced through
`modules/orders/checkout-options.ts`.

## Order creation

`modules/orders/service.ts → createOrder()`, one transaction:

1. Claim the **idempotency key** — a retry returns the first order.
2. **Re-price** everything. If a line has become unavailable, the order fails
   with a structured reason the checkout page can explain.
3. **Commit stock** per line with a conditional `UPDATE … WHERE stock >= n`.
   Zero affected rows → `out_of_stock`, the whole transaction rolls back.
4. Allocate the reference (`BOA-25-0001`) from `reference_counters` with
   `FOR UPDATE`.
5. Insert the order, the **snapshot** lines, the payment record and the first
   `order_events` row.
6. Mark the cart converted.

Then, outside the transaction: `revalidateTag(CATALOG_TAG)` so the storefront's
stock display catches up.

## Lifecycle

```
PENDING → CONFIRMED → PREPARING → SHIPPED ────────────┐
                                 └→ READY_FOR_PICKUP ─┴→ COMPLETED
        ↘ CANCELLED        COMPLETED ↘ REFUNDED
```

Every transition writes an `order_events` row (actor, from, to, note) and, when
staff-initiated, an `audit_logs` entry. Cancelling releases stock through
`stock_movements` with reason `ORDER_RELEASED`.

Payment status moves independently of fulfilment status: an order can be
`SHIPPED` and `UNPAID` when the method is cash on delivery. This is why they are
two columns.

## Discounts

`discounts` supports `PERCENTAGE`, `FIXED_AMOUNT` and `FREE_SHIPPING`, with
validity windows, usage caps and minimum totals. A code is validated server-side
at quote time and again at order time — a code that expires between the two is
rejected at the second check, and the customer is told why.

## Customer-facing surfaces

- `/[locale]/panier` — cart
- `/[locale]/commande` — checkout
- `/[locale]/commande/[reference]` — confirmation
- `/[locale]/suivi` — order tracking by reference + email, no account needed
- `/[locale]/compte/commandes` — order history for signed-in customers
