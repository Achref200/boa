# BOA — documentation index

Everything an engineer or an AI agent needs to work on this platform without
guessing. Root `CLAUDE.md` is the short contract; this is the long form.

## Read in this order

| # | Document | What it answers |
|---|---|---|
| 1 | [BRIEF.md](BRIEF.md) | What the client asked for, in their terms, and what they explicitly forbade. |
| 2 | [RULES.md](RULES.md) | The non-negotiables, with the reasoning behind each. |
| 3 | [ASSUMPTIONS.md](ASSUMPTIONS.md) | Confirmed vs assumed vs placeholder. **Read before writing any copy.** |
| 4 | [PRODUCT.md](PRODUCT.md) | Who the customers are, the information architecture, why each page is composed the way it is. |
| 5 | [BRAND.md](BRAND.md) | The visual language, measured from the official logo. Colours, type, space, motion. |
| 6 | [ARCHITECTURE.md](ARCHITECTURE.md) | Stack decisions, the server/client boundary, caching, performance. |
| 7 | [CONVENTIONS.md](CONVENTIONS.md) | How code is written here. Money, actions, errors, naming, styling, i18n. |
| 8 | [DATA-MODEL.md](DATA-MODEL.md) | The 55 tables, grouped, with the invariants that matter. |
| 9 | [COMMERCE.md](COMMERCE.md) | Pricing, checkout, order lifecycle, fulfilment, payments. |
| 10 | [RESERVATIONS.md](RESERVATIONS.md) | Availability engine, slots, seats, double-booking prevention. |
| 11 | [ADMIN.md](ADMIN.md) | The operations application: every screen, every permission. |
| 12 | [SECURITY.md](SECURITY.md) | Sessions, RBAC, CSP, rate limiting, secrets, payment safety, audit. |
| 13 | [I18N.md](I18N.md) | Three locales, translation tables, RTL, timezone and formatting. |
| 14 | [TESTING.md](TESTING.md) | The four test layers and how to run them. |
| 15 | [DEPLOYMENT.md](DEPLOYMENT.md) | Hostinger, step by step. |
| 16 | [DECISIONS.md](DECISIONS.md) | Architecture decision log — what was chosen, what was rejected, why. |
| 17 | [WORKFLOW.md](WORKFLOW.md) | Local setup in VS Code, git conventions, how to pick up and hand back work. |
| 18 | [STATE.md](STATE.md) | **Current status, open items, known issues.** Update it as you go. |
| 19 | [CONTENT-CHECKLIST.md](CONTENT-CHECKLIST.md) | The real content BOA still has to supply, and where each piece lands. |
| 20 | [GLOSSARY.md](GLOSSARY.md) | French ↔ English ↔ Arabic terms, and the domain vocabulary used in code. |

## The five-line version

BOA is a real Tunisian cosmetics brand. The platform sells products, takes
reservations for services, and is administered from `/admin`. Money is a
three-decimal string computed only on the server. Concurrency is enforced by
MySQL, not by the interface. Nothing about BOA is invented — anything unknown is
a labelled placeholder an administrator can fill in. The logo is never touched.
