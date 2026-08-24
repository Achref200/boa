# BOA — glossary

## Domain vocabulary

| Term | Meaning here |
|---|---|
| **Product** | A catalogue entry. Has translations, media, taxonomy and one or more variants. Never priced itself. |
| **Variant** | The thing that is actually bought: a format of a product, with SKU, price and stock. |
| **Need** (*besoin*) | The discovery axis customers really use — "peau sèche", "cheveux abîmés". Cross-cuts categories. |
| **Collection** | A curated, editorial grouping. A product can be in several. |
| **Ritual** (*rituel*) | An ordered sequence of steps, each pointing at a product. BOA's editorial format. |
| **Service** | Something bookable in person. |
| **Availability rule** | A recurring pattern ("Tuesdays 09:00–17:00, 45 minutes, one seat"). |
| **Slot** | A concrete bookable moment generated from rules and exceptions. |
| **Seat** | One booked place in a slot. A row with a unique `(slot_id, seat_index)`. |
| **Reference** | The human-facing identifier, `BOA-25-0001`, allocated from a counter. |
| **Snapshot** | The copy of a name, price or address taken at the moment of an order or a reservation, so history cannot be rewritten. |
| **Fulfilment** | How an order reaches the customer: `DELIVERY`, `HAND_TO_HAND`, `STORE_PICKUP`. |
| **Pickup point** | A physical BOA location where an order can be collected. |
| **Governorate** | Tunisia's administrative division. Delivery zones and costs are defined by it. |
| **Millime** | 1/1000 of a Tunisian dinar. All money arithmetic happens in millimes as `bigint`. |
| **Actor** | The authenticated administrator plus the set of capabilities they hold. |
| **Capability / permission** | `product.write`, `order.refund`, … The unit of authorization. Roles are bundles of these. |
| **Surface** | `data-surface="ink"` or `"paper"` — the ground a component is rendered on. Tokens resolve against it. |

## Public routes — French paths, in every locale

| Path | English |
|---|---|
| `/soins` | shop / skincare index |
| `/soins/[category]` | category |
| `/produits/[slug]` | product |
| `/collections/[slug]` | collection |
| `/rituels` | rituals |
| `/services`, `/reserver/[slug]` | services, booking |
| `/reservation/[reference]` | booking confirmation |
| `/panier` | cart |
| `/commande`, `/commande/[reference]` | checkout, order confirmation |
| `/suivi` | order tracking |
| `/compte`, `/compte/commandes`, `/compte/reservations`, `/compte/adresses` | account |
| `/connexion`, `/inscription` | sign in, register |
| `/maison-boa` | the brand story |
| `/professionnels` | professional / wholesale |
| `/contact` | contact |

## Admin routes

| Path | English |
|---|---|
| `/admin/produits` | products |
| `/admin/categories`, `/admin/besoins`, `/admin/collections`, `/admin/rituels` | taxonomy and editorial |
| `/admin/commandes` | orders |
| `/admin/reservations`, `/admin/services` | bookings |
| `/admin/clients` | customers |
| `/admin/contenu` | editorial content |
| `/admin/remises` | discounts |
| `/admin/livraison` | shipping and pickup |
| `/admin/messages` | enquiries |
| `/admin/reglages` | settings |
| `/admin/journal` | audit log |

## Interface terms, three locales

| fr | en | ar |
|---|---|---|
| Panier | Cart | السلة |
| Commande | Order | طلب |
| Livraison | Delivery | التوصيل |
| Retrait en boutique | Store pickup | الاستلام من المتجر |
| Réservation | Booking | حجز |
| Disponibilité | Availability | التوفر |
| Rupture de stock | Out of stock | نفدت الكمية |
| Remise | Discount | تخفيض |
| Besoin | Need | الحاجة |
| Rituel | Ritual | طقوس |

The authoritative strings are in `src/i18n/messages/{fr,en,ar}.ts`. This table
is orientation, not a source of truth.
