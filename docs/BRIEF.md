# BOA — the client brief

The substance of what the client (Achref, for BOA Cosmetic) asked for, kept here
so that anyone joining the project — human or agent — works from the same
instructions. Where the brief and this repository disagree, the brief wins.

---

## 1. The ask

Build a complete, production-grade digital ecosystem for **BOA Cosmetic**, a
real beauty brand based in **Sousse, Tunisia** — not a demo, not a template
fill-in. The work is to be done as a multidisciplinary senior team would do it:
brand designer, product designer, UX strategist, art director, senior frontend
and backend engineers, database architect, DevOps, security, QA and project
management, each perspective actually applied.

## 2. Scope

1. A premium **storefront** that carries the brand.
2. **Product discovery** — catalogue, categories, needs, collections, rituals,
   search, filtering, a product page that answers questions progressively.
3. **E-commerce** — cart, checkout, orders, delivery and pickup, payments.
4. **Reservations / booking** for services, with real availability.
5. **Customer accounts** — orders, reservations, addresses.
6. A secure **`/admin` administration application** that runs the business:
   products, stock, media, taxonomy, orders, reservations, services, customers,
   content, discounts, shipping, messages, settings, audit journal.

## 3. Stack and target

React + TypeScript + Next.js; MySQL; deployed on **Hostinger**. Clean git
history, architectural decisions documented, work delivered in phases.

## 4. Client answers to setup questions

| Question | Answer |
|---|---|
| Where does the code live? | A new folder under `C:\Users\Team_2\proejcts` → `boa-cosmetic/boa` |
| Brand assets | The official logo, supplied directly by the client (also on `facebook.com/boacosmetic`) |
| Locales | **French + English + Arabic** |
| Payments | **All methods**, plus **hand-to-hand delivery** and **in-store pickup point** |

## 5. Explicit prohibitions

Quoted in substance from the brief:

**Brand**
- The BOA logo must remain the official BOA logo. It must not be redesigned,
  distorted, replaced, unnecessarily recoloured, or turned into a generic
  AI-generated logo. The design system is to be extracted from the real logo and
  assets.

**Content**
- Do not invent BOA products, services, claims, certifications, ingredients,
  prices, medical benefits or brand history.
- No fake testimonials, reviews or statistics. No lorem ipsum.
- Where real content is unavailable, use clearly structured placeholders that can
  be replaced from the admin.

**Design**
- It must not look AI-generated. Specifically: no hero → three cards → stats →
  testimonials → CTA skeleton; no pink/beige cosmetics template; no random
  gradients; no excessive rounded cards; no glassmorphism.

**Engineering**
- Do not build a fake backend. Do not use `localStorage` as a replacement for a
  database. Do not create fake admin CRUD that only changes frontend state.
- Do not store raw card information.
- Do not expose secrets in client code. Use environment variables for
  credentials and configuration. Never commit secrets.

## 6. Required qualities

Server-authoritative pricing · immutable order snapshots · database-level
double-booking prevention · role-based access control · audit trail · a payment
abstraction rather than a fake payment system · performance · scalability ·
security · responsiveness · accessibility · SEO · automated tests · real error,
empty and loading states · deployment readiness.

## 7. Working method

Work in phases. Keep the git history clean and readable. Document architectural
decisions as they are made — the reasoning is part of the deliverable, not an
afterthought.
