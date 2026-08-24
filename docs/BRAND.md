# BOA — Visual language

> **Source of truth.** Everything below is derived by measurement from the one
> official asset we hold: `public/brand/boa-logo.jpg` (595×595, supplied by the
> client). No official brand book was provided. Where a value is inferred rather
> than measured it is marked *(inferred)*. When BOA supplies the real guidelines,
> replace the values in `src/styles/tokens.css` — nothing else needs to change.

## 1. What the mark actually contains

| Element | Observation |
|---|---|
| Ground | A warm neutral charcoal, **not** black — `#27282A`, occupying 78.2% of the canvas |
| Wordmark "BOA" | High-contrast Didone serif. Vertical stress, hairline thins, sharp unbracketed serifs. The `A` has a pointed apex with no crossbar visible in the counter area |
| Counter of the "O" | A woman's profile in negative space, hair flowing down past the baseline |
| Above the "O" | A five-part petal/leaf cluster, hand-drawn, asymmetric |
| "COSMETIC" | White, uppercase, light-weight, very wide tracking (≈0.42em) |
| Fill | The letterforms are a **metallic gradient**, not a flat gold |

### The gold, measured

Gold covers 8.4% of the canvas. Sampling every gold pixel and bucketing by
lightness gives the actual ramp used in the mark:

| Lightness band | Weighted mean | Share of gold |
|---|---|---|
| 10–30% | `#645322` | 1.4% |
| 30–40% | `#7B6A37` | 2.5% |
| 40–50% | `#99864A` | 2.8% |
| 50–60% | `#D2AC49` | **36.5%** |
| 60–70% | `#E4CA69` | **41.6%** |
| 70–80% | `#EDDC82` | 14.9% |
| 80–90% | `#F5EBAA` | 0.2% |
| Specular peak | `#FFF585` | trace |

Two thirds of the gold sits between `#D2AC49` and `#E4CA69`. That pair — not a
single hex — is BOA's gold.

## 2. Decisions this forces

**BOA is a warm brand whose mark happens to sit on charcoal.** The previous
reading of this file took the mark's 78% charcoal ground literally and made the
whole storefront dark and square. That was defensible as typography and wrong as
a shop: a cosmetics customer is buying a material, and a dark, hairline-ruled
page makes a material look like a specification.

The current reading takes the *gold* as the brand's temperature. The gold ramp
measured in §1 runs all the way down to `#645322` and `#7B6A37` — those are earth
tones, already in the mark. Desaturating and lightening `#D2AC49` while holding
its hue at 43° yields the storefront ground:

```
--color-paper             #FBF8F1   gold at ~4%    page ground
--color-paper-raised      #FFFFFF                  cards, fields
--color-paper-sunken      #F5EFE2   gold at ~10%   media wells, panels
--color-paper-line        #E7DFCD                  hairlines, card borders
--color-paper-line-strong #D9C89F                  emphasised separators
```

**No hue enters the palette that was not already in the logo.** That is the test
any future change has to pass.

**Ink punctuates; it no longer carries.** `#27282A` is now the footer, the salon
band, the brand strip on `maison-boa` and `professionnels`, toasts, and the admin
chrome. Everything a customer shops in is warm and light.

**Gold reads two ways, and the distinction is the one thing to get right.**

| Use | Ratio | Verdict |
|---|---|---|
| Gold `#D2AC49` as **text** on paper | 1.9:1 | **forbidden** |
| Gold `#D2AC49` as a **fill** carrying ink `#27282A` | **7.0:1** | the primary action |
| Bronze `#645322` as text on paper | 7.0:1 | the paper accent |
| Gold `#D2AC49` on ink | 6.8:1 | AA at every size |

The previous version of this file banned "gold as a button fill on paper"
because contrast fails. It conflated foreground with background: gold *behind*
an ink label is one of the strongest pairs in the palette. Primary actions are
gold on both surfaces.

**Shape is a scale, not a zero.** The mark's geometry is circular and organic and
contains no rounded rectangle. The old system read that as "use no curves"; this
one reads it as the opposite. Radius is now a five-step scale, and the full
circle is kept for marks, seals, steppers and pill actions.

```
--radius-xs    8px    chips, badges, small thumbnails
--radius-sm   12px    fields, selects, format and slot pickers
--radius-md   16px    cards, panels, media frames
--radius-lg   24px    hero media, feature blocks, salon bands
--radius-full         actions, avatars, steppers, seals
```

**Elevation is light, not a line.** Two levels only — a third tempts a component
into floating for no reason. Both are tinted with `--color-gold-shadow` rather
than pure black, so a lifted card warms the surface beneath it instead of greying
it.

**The petal cluster is still the only ornament we own.** Extracted once as an SVG
(`src/components/brand/Petals.tsx`), used as the section divider, the empty-state
mark, the loading indicator and the "end of page" seal. Nothing else decorative
is invented.

## 3. Colour tokens

Semantic names, so the palette can be re-pointed without touching components.
The gold and the ink are unchanged from §1; only the neutrals moved.

```
--color-ink               #27282A   measured — brand ground, now punctuation
--color-ink-raised        #303134
--color-ink-sunken        #1E1F21
--color-ink-line          #3B3C3F
--color-ink-soft          #4A453C   warm-shifted dark for long body copy

--color-paper             #FBF8F1   derived from the gold — the shop's ground
--color-paper-raised      #FFFFFF
--color-paper-sunken      #F5EFE2
--color-paper-line        #E7DFCD
--color-paper-line-strong #D9C89F

--color-gold              #D2AC49   measured — core gold
--color-gold-light        #E4CA69   measured — second core stop
--color-gold-pale         #EDDC82   measured
--color-gold-deep         #99864A   measured
--color-gold-shadow       #645322   measured
--color-bone              #FEFEFF   measured
```

Functional colours are chosen *outside* the brand hue so they never read as
decoration: success `#2F6F4E`, warning `#8A5514`, danger `#A3342C`, info
`#34606F`. Each is re-measured for the ink context inside `[data-surface='ink']`,
because a colour legible on paper is not legible on charcoal.

**Contrast**, measured against the new ground rather than assumed:

| Pair | Ratio | Verdict |
|---|---|---|
| Ink `#27282A` on paper `#FBF8F1` | 13.9:1 | AAA |
| Muted `#6B6459` on paper | 5.4:1 | AA |
| Muted `#6B6459` on sunken `#F5EFE2` | 5.0:1 | AA |
| Bronze `#645322` on paper | 7.0:1 | AA at every size |
| Ink label on a gold fill | 7.0:1 | the primary action |
| Gold `#D2AC49` on ink | 6.8:1 | AA at every size |
| Muted `#A8A396` on ink | 6.0:1 | AA |

`--surface-muted` was warm-shifted from the old cool `#5F6063`: secondary copy
has to belong to the ground it sits on.

## 4. Typography

No official typeface was provided. Two Latin families plus one for Arabic,
loaded by **role** (`--font-display-src`, `--font-text-src`) so replacing a
typeface is a change to `src/lib/fonts.ts` alone.

| Role | Family | Why |
|---|---|---|
| Display | **Calistoga** | A single-weight display face with round terminals, heavy stems and a tall x-height. Warm where a Didone is formal. One weight by design: display type that needs a bold is display type doing too much work |
| Text & UI | **Hanken Grotesk** (variable 100–900) | A humanist grotesque with open apertures and slightly soft joins, so long French product copy stays warm while a price column keeps the neutrality it needs |
| Arabic | **IBM Plex Sans Arabic** | Calistoga has no Arabic. Rather than distort the concept, the Arabic locale uses one well-drawn family across display and text, with its own line-height. A deliberate divergence, not an oversight |

Scale is fluid and `clamp`-based, with body at **16px** rather than 15: a shop is
read, not scanned. Calistoga is already wide and round and does not want the
negative tracking a Didone needed — `--tracking-display` is `-0.012em`. The
lockup label is `0.24em`, softened from the mark's literal `0.42em`, at which a
label stops being readable as a word.

## 5. Space, rhythm, motion

- Base unit 4px. Section rhythm uses a coarser step so vertical spacing reads as
  intentional.
- Layout is a 12-column grid with a documented asymmetric variant (`5 | 7` and
  `4 | 8` splits) used on editorial rows so the page does not become a stack of
  centred bands.
- Motion follows the **Subtle** tier: `--duration-state` 180ms,
  `--duration-entrance` 300ms, one easing `cubic-bezier(0.22, 0.61, 0.36, 1)`
  (`power1.out`), one entrance gesture (8px rise + fade), and a `--stagger-step`
  of 30ms for lists. No parallax, no scroll-jack, no floating objects.
  Everything is wrapped in `prefers-reduced-motion`.
- Touch targets are **44px minimum**, 48px on the two larger button sizes, with
  at least 8px between adjacent targets.

## 6. Imagery

- Product: 4:5 portrait, product centred, shot on the warm ground or on ink —
  never on a gradient. One consistent crop across the catalogue so grids read as
  a set.
- Editorial: 3:2 or full-bleed, allowed to break the grid. Prefer human scale —
  hands, skin, the workroom — over product-on-white.
- Every image slot has a declared aspect ratio in the schema so the layout never
  shifts when media is missing, and every missing image renders the petal seal on
  the sunken surface with the expected dimensions written on it — an obvious
  "asset expected here" state, never a stock photo.

## 7. The logo, and the one asset we still need

The logo is used **as supplied** — never redrawn, recoloured, re-cropped or
regenerated. `public/brand/boa-logo.png` is correctly cut out (transparent
background), but the word **"COSMETIC" is white**. On any light ground it
disappears, and the mark loses its lower half.

Every light-surface placement therefore gives the logo a dark field to sit in
(the header chip, the footer mark). This works, but it is a workaround.

**Ask BOA for a variant with "COSMETIC" in `#27282A`.** It is a single asset and
it would let the mark sit directly on the warm ground anywhere. Tracked in
`docs/CONTENT-CHECKLIST.md`.
