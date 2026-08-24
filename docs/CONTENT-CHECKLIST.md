# BOA — real content still needed

Everything on this list is currently a **placeholder** or **absent**. Nothing on
it has been invented. Each row says where the real value lands, and who can put
it there.

Rule: if a task needs one of these and nobody has supplied it, the task stops
here. It does not get filled in plausibly.

---

## 1. Company identity

| Needed | Where it lands | Consequence while missing |
|---|---|---|
| Legal company name and form | `/admin/reglages` | Absent from the footer |
| Registered address in Sousse | `/admin/reglages` | Contact page shows no address block |
| Tax / registration number | `/admin/reglages` | Absent from invoices and legal pages |
| Public phone number(s) | `/admin/reglages` | No phone link anywhere |
| Public email address | `/admin/reglages` | Contact form only |
| Opening hours | `/admin/reglages` | Not displayed |
| Social profiles (Facebook confirmed, others?) | `/admin/reglages` | Only the confirmed ones render |
| Final domain name | `NEXT_PUBLIC_SITE_URL` | Canonicals and sitemap point at the placeholder host |

## 1b. Brand assets

| Needed | Where it lands | Consequence while missing |
|---|---|---|
| **Logo variant with "COSMETIC" in charcoal `#27282A`** | `public/brand/` | The supplied PNG is cut out correctly, but "COSMETIC" is **white** and vanishes on any light ground. Every light-surface placement has to give the mark a dark chip to sit in. One asset would remove that workaround everywhere — see `docs/BRAND.md` §7 |
| Vector source of the mark (SVG or AI) | `public/brand/` | The mark is a 595×595 raster; it soft-edges above ~300px and cannot be printed |
| Product photography, 4:5, one consistent crop | `/admin/produits` | Every card, grid and hero renders the petal reserve instead |
| Editorial photography at human scale (hands, skin, workroom) | `/admin/contenu` | Hero and brand bands render reserves |

## 2. Catalogue

| Needed | Where it lands |
|---|---|
| The real product list | `/admin/produits` |
| Formats / sizes per product, with SKU | product variants |
| **Prices in TND** (three decimals) | product variants |
| Opening stock per variant | product variants |
| Product descriptions — fr, en, ar | product translations |
| Usage instructions | product translations |
| Composition / INCI, exactly as on the packaging | product translations |
| Precautions and storage | product translations |
| Category and "need" assignment | taxonomy |
| Product photography — portrait 4:5, ≥1600×2000 | `/admin/produits/[id]` media |

**No claim may be added that is not on BOA's own packaging or documentation.**
Cosmetics claims are regulated; "hydrates for 24h" is a legal statement, not
copy.

## 3. Services and reservations

| Needed | Where it lands |
|---|---|
| The real service list | `/admin/services` |
| Duration, capacity and price per service | `/admin/services/[id]` |
| Opening pattern per service (days, hours) | availability rules |
| Closures and holidays | availability exceptions |
| Where a service takes place | service translations |

## 4. Commerce operations

| Needed | Where it lands |
|---|---|
| Delivery zones and costs by governorate | `/admin/livraison` |
| Free-delivery threshold, if any | `/admin/livraison` |
| Pickup point address(es) and collection hours | `/admin/livraison` |
| Bank transfer details (RIB / IBAN, account name) | `/admin/reglages` |
| Which payment methods are live | `PAYMENT_PROVIDERS` + `/admin/reglages` |
| Return, exchange and delivery policy text | `/admin/contenu` |
| Privacy policy and terms of sale | `/admin/contenu` |

## 5. Brand and editorial

| Needed | Where it lands |
|---|---|
| The brand story, in BOA's own words | `/admin/contenu` → `maison-boa` |
| Rituals: the real sequences BOA recommends | `/admin/rituels` |
| Professional / wholesale terms | `/admin/contenu` → `professionnels` |
| Editorial photography | `/admin/contenu` |
| Logo variants BOA may already own (light ground, monochrome, favicon source) | `public/brand/` |

## 6. Anything that will never be invented

Not on the list above and never generated: customer reviews, ratings,
testimonials, sales figures, follower counts, awards, certifications, press
mentions, partner logos, "trusted by" claims, before/after imagery, and any
dermatological or medical assertion.

If BOA has real ones, they go through the admin like everything else. If they
do not exist, the section does not render.
