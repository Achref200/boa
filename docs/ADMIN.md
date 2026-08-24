# BOA — the administration application

`/admin` is not a CRUD skin over the schema. It is the application BOA staff run
the business from, so it is organised around the jobs they do, in French, their
working language.

It has its **own root layout** (`src/app/(admin)/`), its own session cookie
scoped to `/admin`, its own navigation, and no storefront chrome. It is
`noindex` and excluded from the sitemap.

## Screens

| Route | Job | Permission |
|---|---|---|
| `/admin` | Dashboard — today's orders and reservations, low stock, unanswered messages, and the list of company details still missing | any |
| `/admin/connexion` | Sign in | — |
| `/admin/produits` · `/nouveau` · `/[id]` | Products: translations per locale, variants, prices, stock, media, taxonomy, publication | `product.read` `product.write` `product.publish` |
| `/admin/categories` | Categories | `catalog.write` |
| `/admin/besoins` | Needs ("peau sèche", …) — the discovery axis customers actually use | `catalog.write` |
| `/admin/collections` | Collections | `catalog.write` |
| `/admin/rituels` | Rituals and their ordered steps | `catalog.write` |
| `/admin/commandes` · `/[id]` | Orders: status transitions, payment status, notes, the full snapshot and event history | `order.read` `order.write` `order.refund` |
| `/admin/reservations` | Reservations and slot occupancy | `reservation.read` `reservation.write` |
| `/admin/services` · `/nouveau` · `/[id]` | Services, durations, capacity, availability rules and exceptions | `service.write` |
| `/admin/clients` | Customers, their orders and reservations | `customer.read` `customer.write` |
| `/admin/contenu` | Editorial blocks and announcements, per locale | `content.write` |
| `/admin/remises` | Discount codes | `discount.write` |
| `/admin/livraison` | Shipping zones by governorate, and pickup points | `shipping.write` |
| `/admin/messages` | Contact and professional enquiries | `customer.read` |
| `/admin/reglages` | Site settings, company details, enabled payment methods | `settings.write` |
| `/admin/journal` | The audit journal — append-only | `audit.read` |

## Rules for admin screens

- **Every write is a Server Action** that re-validates with Zod, re-checks the
  permission with `assertCan`, writes an `audit_logs` entry, and calls
  `revalidateTag` so the storefront reflects the change. An admin edit that does
  not reach the public site is a bug.
- **Nothing is fake.** No screen mutates only client state. If a control exists,
  it writes to MySQL.
- **Destructive actions are confirmed** through `ConfirmButton` and are audited.
  Anything an order references is archived or soft-deleted, never hard-deleted.
- **Placeholders are visible.** Where BOA has not supplied real content, the
  admin shows what is missing and where it will appear — the dashboard keeps a
  running list. This is the mechanism that keeps invented content out of the
  storefront.
- **Media** is uploaded through `ProductMediaManager`: alt text sits beside each
  image because that is the only place anyone will think to write it, the first
  image is labelled as the catalogue image because that is the decision being
  made, and ordering uses buttons rather than drag-and-drop because dragging is
  unusable with a keyboard and awkward on a phone.
- **The permission is checked in the action**, not by hiding a button. Hiding is
  courtesy; the action is the control.

## Roles

Four blueprints ship (`src/lib/permissions.ts`): `super_admin`,
`catalog_manager`, `order_manager`, `reservation_manager`. v1 seeds one
administrator. Because every check is a capability and never a role name, adding
a role is inserting rows into `role_permissions`.
