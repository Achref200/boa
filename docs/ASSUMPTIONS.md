# BOA — Confirmed vs assumed vs placeholder

Three states, kept separate on purpose. Nothing in column C is presented to a
visitor as fact, and every item in column C is editable from `/admin` without a
developer.

## A. Confirmed

| Fact | Source |
|---|---|
| BOA Cosmetic is a Tunisian cosmetics company, Sousse | Facebook page, B2B Tunisia listing |
| Activity: hair care (protein, keratin, caviar–collagen–plasma, argan), face care (gommage, anti-cerne, savon noir), fragrance / body splash | B2B Tunisia company listing |
| Real product names in market: Boa Shampoo 100 ml; Boa Shampooing Nano Caviar 300 ml; Boa Masque Cheveux 250 ml; Boa Protéine mésothérapie collagène 100 ml; Boa Pack Protéine Caviar 1 L | Tunisian retailer listings (price.tn, Jumia Tunisie) |
| Official logo | File supplied by the client, stored at `public/brand/boa-logo.jpg` |
| Locales required: French, English, Arabic | Client |
| Payment/fulfilment: all methods, plus hand-to-hand delivery and in-store pickup | Client |
| Codebase location | Client: `C:\Users\Team_2\proejcts` |

## B. Assumed (professional judgement, safe to change)

| Assumption | Why | Cost to change |
|---|---|---|
| French is the default locale | Tunisian cosmetics retail operates primarily in French | One constant |
| TND with 3 decimals | Tunisian dinar is millime-denominated | Schema is already `DECIMAL(10,3)` |
| The 1 L format implies a professional/salon channel | Volume SKUs are not retail formats | `/professionnels` is one page + one contact type |
| BOA offers in-person services worth reserving | The client asked for reservations | Services are data; if there are none the section hides itself |
| One admin role in v1 | No org chart supplied | Permission model is already capability-based |
| Local disk media storage | What Hostinger Node hosting supports | Driver swap, one file |

## C. Placeholder — must be replaced before launch

Everything here renders with a visible provenance marker in admin and is listed
on the admin dashboard under "Contenu à compléter".

- **Prices.** Seed prices are structurally valid but **not** BOA's real prices.
- **Product descriptions, usage, composition, precautions.** Seeded with the
  real product *names* only. Description fields ship empty; the product page
  omits any section with no content rather than filling it. No ingredient list,
  no benefit claim and no medical statement has been written by us.
- **Product photography.** No BOA product image was available. Every image slot
  is filled by a **generated studio render** from `scripts/media/vessels.ts` —
  a vessel silhouette (bottle, pump, jar, tube, flacon, sachet, bar) drawn from
  primitives in that file, on the brand grounds, in the brand palette. The wide
  editorial bands get an abstract composition rather than a product.

  These are **not photographs, not stock imagery, and not traced from any real
  product** — BOA's or anyone else's. They exist so the catalogue can be shown
  as a working shop instead of a grid of "asset missing" plates.

  They make **no claim**: the label prints only the product name the database
  already holds, plus the category and — when and only when a variant actually
  declares one — the real `product_variants.format`. No ingredient, volume,
  certification or origin is invented.

  **They are still placeholders and must be replaced before launch.** They are
  written to `public/uploads/products/` with the same content-hashed naming as
  a real upload, so the swap is one upload per product in `/admin` with no code
  change. The vessel chosen per product is stated explicitly in
  `VESSEL_BY_SLUG` in `scripts/seed-media.ts`.
- **Services and their prices/durations.** Structure is real; the three seeded
  services are labelled placeholders.
- **Company details**: address, phone, email, opening hours, delivery zones and
  fees, return policy, legal notices, VAT number.
- **Social proof.** No testimonial, review, rating or statistic has been
  invented. The review system exists and shows real rows or nothing at all.

## Deliberate omissions

- No fabricated certifications, "100% natural" claims, dermatological testing
  claims, or before/after imagery.
- No invented brand history or founder story.
- No fake analytics on the admin dashboard — every figure is a live query.
