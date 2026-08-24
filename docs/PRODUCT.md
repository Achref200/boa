# BOA — Product definition

## 1. What BOA actually is

Confirmed from public sources (see `ASSUMPTIONS.md` for provenance): BOA Cosmetic
is a Tunisian cosmetics company based in Sousse. Its activity is described as
hair care built on **protein, keratin, caviar–collagen–plasma and argan**, face
care including **gommage, anti-cerne and savon noir**, and **fragrance / body
splash**. Real product names visible at Tunisian retailers include *Boa Shampoo
100 ml*, *Boa Shampooing Nano Caviar 300 ml*, *Boa Masque Cheveux 250 ml*, *Boa
Protéine mésothérapie collagène 100 ml* and *Boa Pack Protéine Caviar 1 L*.

Two things follow. First, **BOA is a formulator, not a reseller** — the site has
to carry the weight of explaining a treatment, not just list a bottle. Second,
the 1 L pack tells us there is a **professional channel** (salons buying volume)
alongside retail. The information architecture accounts for both without
splitting into two sites.

## 2. Customer segments and what each one needs

| Segment | Arrives asking | The site must |
|---|---|---|
| Retail customer | "Which BOA treatment is right for my hair?" | Diagnose by need before it sells by SKU |
| Returning customer | "Reorder the one I had" | One-tap reorder from account, clear pack sizes |
| Salon / professional | "Volume sizes, consistent supply" | Surface 1 L formats, pro pricing request, bulk contact |
| Service client | "Book a keratin session / consultation" | Reserve a real slot with confirmation |

## 3. Information architecture

Discovery is organised by **hair or skin problem**, then by product family — not
by database table. A customer who does not know the word "keratin" must still
find the right shelf.

```
/                         Brand + discovery composition
/soins                    Shop root — the catalogue
  /soins/cheveux            Hair
    ?besoin=reparation|lissage|volume|chute|coloration
  /soins/visage             Face
  /soins/parfums            Fragrance
/collections/[slug]       Editorial groupings (routines, packs, seasonal)
/produits/[slug]          Product detail
/rituels                  Routines — multi-product regimens, add-all-to-cart
/services                 What BOA does in person
/services/[slug]          Service detail + availability
/reserver/[slug]          Booking flow
/professionnels           Salon / volume channel
/maison-boa               Brand story, formulation approach, Sousse
/contact
/panier  /commande  /commande/[reference]
/compte  /compte/commandes  /compte/reservations  /compte/adresses
/admin/*                  Operations application (separate shell, separate auth guard)
```

Locale prefixes every public route: `/fr/...` (default), `/en/...`, `/ar/...`
with `dir="rtl"` on the Arabic tree.

**Why "besoin" is a query param and not a path segment.** Need-states change with
the catalogue and are editable from admin; making them URLs would mint SEO pages
that go stale. Categories are stable and get real indexable paths; needs are
facets.

## 4. The homepage, and why it is composed this way

Not Hero → 3 cards → stats → testimonials → CTA. The sequence answers, in order,
the four questions a first-time visitor actually asks:

1. **"What is this?"** — A full-bleed ink opening. The mark, one line of
   positioning, one product in a 4:5 frame set off-centre against a 5|7 split.
   No carousel: a carousel is what you build when you cannot decide.
2. **"Is it for me?"** — The *diagnostic* row. Four need-states as wide, flat,
   typographic tiles (no cards, no shadows) leading straight into filtered
   catalogue views. This is the single most commercially important block and it
   sits above the product grid deliberately.
3. **"What do they actually make?"** — Signature products, presented as an
   asymmetric editorial row (one large, two small) rather than a 4-up grid, so
   the eye is directed rather than distributed.
4. **"Why should I trust a formulation?"** — The *maison* strip on ink:
   formulation approach, Sousse, the professional channel. Editorial, image-led.
5. **"Can I do this properly?"** — Rituals: a multi-step routine as a numbered
   horizontal sequence, each step a real product, with an add-the-whole-routine
   action. This is BOA's differentiator over a shop that only sells bottles.
6. **"Can someone do it for me?"** — Services and reservation entry.
7. Footer on sunken ink: navigation, locales, contact, legal.

Transitions between blocks alternate ink and paper with a hairline gold rule and
the petal seal at the seam, so scrolling reads as one composition rather than
stacked sections.

## 5. Product detail — the progressive answer

The page is not image-left / text-right. It is a two-phase read:

**Phase one (above the fold, both breakpoints):** the media column at 4:5 with a
vertical thumbnail rail on desktop and a swipe rail with dot pagination on
mobile; name, format, price, variant, quantity, and one primary action. On
mobile the buy bar becomes sticky only *after* the primary action scrolls out of
view, never before — a sticky bar on arrival is the template tell.

**Phase two (progressive disclosure):** an accordion whose sections are driven by
what the record actually has — *À quoi ça sert*, *Comment l'utiliser*,
*Composition*, *Précautions*, *Format et conservation*. Empty sections do not
render. Every one of these is admin-editable rich text per locale, and none of it
is generated: if BOA has not supplied the text, the section is absent, not
invented.

Then: the routine this product belongs to (if any), complementary products
(explicit relations set in admin, not "customers also bought" fiction), and the
delivery/return facts that reduce checkout anxiety.

## 6. Reservation model

Deliberately more general than "appointment", because the business model is still
moving. A **Service** has a duration, a capacity, an optional price, and a set of
**AvailabilityRules** (weekday windows) plus **AvailabilityExceptions** (closures
and one-off openings). Concrete **Slots** are materialised from the rules for a
rolling horizon; a **Reservation** points at a slot.

The invariant that a slot cannot be overbooked is enforced by a unique index on
`(slotId, position)` combined with a transactional seat allocation — not by
checking availability in the UI. The UI's view of availability is advisory; the
database is the authority. Cancellation frees the seat by moving the reservation
to a released state and deleting its seat row inside the same transaction.

## 7. Commerce rules

- Prices are stored as `DECIMAL(10,3)` — the Tunisian dinar has three decimals
  (millimes). Storing TND in cents would be wrong by a factor of ten.
- The client never sends a price. It sends `{ variantId, quantity }`. The server
  reprices from the database, re-checks stock, recomputes shipping, and only then
  creates the order.
- Order lines are **snapshots**: name, format, SKU, unit price and image URL are
  copied onto the line at creation. Renaming or deleting a product later cannot
  alter a historical order.
- Fulfilment options, all four confirmed by the client: **cash on delivery**,
  **in-store pickup** (Sousse), **hand-to-hand delivery**, **bank transfer**, plus
  an online gateway behind an abstraction so Konnect/Flouci/Paymee can be added as
  configuration.
- Order creation is idempotent on a client-generated key, so a double submit or a
  retry after a dropped connection cannot mint two orders.
