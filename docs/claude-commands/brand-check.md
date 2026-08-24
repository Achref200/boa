---
description: Audit a change against the BOA brand and content rules
argument-hint: [path or "staged"]
---

Audit $ARGUMENTS (default: the staged diff) against `docs/RULES.md` and
`docs/BRAND.md`. Report every violation with file and line.

**Brand**
- Is the official logo used unmodified? No re-colouring, no re-cropping, no
  regeneration, no CSS filter on it.
- Any raw hex or named colour in a component instead of a token?
- Any `--radius` other than 0, any gradient, blur, glassmorphism or drop shadow
  used decoratively?
- Any physical direction property (`ml-`, `mr-`, `left-`, `right-`,
  `text-left`) instead of a logical one?

**Content**
- Any BOA fact that nobody supplied: a price, an ingredient, a claim, a
  certification, an opening hour, an address, a statistic?
- Any invented review, testimonial or rating? Any `aggregateRating` in JSON-LD?
- Any lorem ipsum or filler prose standing in for missing content?
- Does missing content render as nothing or as a labelled, admin-editable
  placeholder?

**Structure**
- Does a new page follow the generic funnel (hero → three cards → stats →
  testimonials → CTA)?
- Do all three message files have every new key?

For anything found: propose the fix, and if the block is a missing BOA fact, add
the row to `docs/CONTENT-CHECKLIST.md` instead of inventing it.
