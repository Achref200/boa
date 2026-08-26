/**
 * Product imagery for the demo catalogue.
 *
 * ── What this is, and what it is not ──────────────────────────────────────
 *
 * These are **generated studio renders**, not photographs and not stock
 * imagery. Every shape here is drawn from primitives in this file, on the
 * brand's own grounds, in the brand's own palette. Nothing is traced from a
 * real BOA product, downloaded, or copied from another brand.
 *
 * They exist so the catalogue can be presented to the client as a working
 * shop rather than a grid of "asset missing" plates, while the rule in
 * CLAUDE.md still holds: no invented BOA *facts*. A vessel silhouette makes
 * no claim — it states no ingredient, no volume that is not already in the
 * database, no certification, no origin. It is the visual equivalent of a
 * greyboxed model.
 *
 * They are still placeholders and must be replaced by real photography before
 * launch. `docs/ASSUMPTIONS.md` records that; the filenames land under
 * `public/uploads/products/` exactly like a real upload so the swap is one
 * upload per product in /admin.
 *
 * ── Why SVG → WebP through sharp ──────────────────────────────────────────
 *
 * The same pipeline the reserves already used, so nothing downstream changes:
 * content-hashed name, WebP at quality 82, `next/image` optimises it to AVIF
 * on request. A 1600×2000 render is ~40 KB at source and ~4 KB served.
 */

/* Brand palette — every value is an existing token from src/styles/tokens.css.
   No new hue is introduced here. */
export const PAPER = '#fbf8f1';
export const SUNKEN = '#f5efe2';
export const LINE = '#e7dfcd';
export const INK = '#27282a';
export const GOLD = '#d2ac49';
export const GOLD_DEEP = '#99864a';
export const BRONZE = '#645322';
export const MUTED = '#6b6459';

export function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

/** Naive greedy wrap; product names are short. */
export function wrap(text: string, perLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > perLine) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The petal cluster — the same five-leaf construction as
 * `src/components/brand/Petals.tsx`, redrawn from its geometry rather than
 * traced from the logo JPEG. The logo asset itself is never modified.
 */
export function petals(cx: number, cy: number, scale: number, colour: string, opacity = 1): string {
  const leaves = [
    { angle: -52, ry: 10.5, o: 0.62 },
    { angle: -26, ry: 12.5, o: 0.82 },
    { angle: 0, ry: 14, o: 1 },
    { angle: 26, ry: 12.5, o: 0.82 },
    { angle: 52, ry: 10.5, o: 0.62 },
  ];
  const inner = leaves
    .map(
      (l) =>
        `<ellipse cx="24" cy="${38 - l.ry}" rx="4.1" ry="${l.ry}" opacity="${l.o}" transform="rotate(${l.angle} 24 38)"/>`,
    )
    .join('');
  const size = 48 * scale;
  return `<g fill="${colour}" opacity="${opacity}" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})">${inner}</g>`;
}

/** Which vessel a product is shown in. Chosen per product, not at random. */
export type VesselKind = 'bottle' | 'pump' | 'jar' | 'tube' | 'flacon' | 'sachet' | 'bar';

/** The three catalogue views every product carries. */
export type View = 'front' | 'detail' | 'packaging';

export type Vessel = {
  kind: VesselKind;
  /** Product name, printed on the label exactly as the database holds it. */
  name: string;
  /** Short line under the name — the category, never an invented claim. */
  kicker?: string;
  /** Volume, only when the database actually has one. */
  volume?: string;
  view: View;
  width: number;
  height: number;
  /** 0–2, picks the ground so a grid does not read as one repeated asset. */
  tone?: number;
};

const GROUNDS = [PAPER, SUNKEN, LINE] as const;

/* ── shared parts ─────────────────────────────────────────────────────────── */

/**
 * Vertical glass shading. A flat fill reads as a sticker; two soft highlights
 * down the left third and a shadow on the right read as a cylinder.
 */
function glassDefs(id: string, base: string, dark: string, light: string): string {
  return `
    <linearGradient id="body-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="${dark}"/>
      <stop offset="0.16" stop-color="${base}"/>
      <stop offset="0.34" stop-color="${light}"/>
      <stop offset="0.52" stop-color="${base}"/>
      <stop offset="1"    stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="cap-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="${dark}"/>
      <stop offset="0.3"  stop-color="${light}"/>
      <stop offset="1"    stop-color="${dark}"/>
    </linearGradient>`;
}

/** Contact shadow, so the vessel sits on the surface instead of floating. */
function groundShadow(cx: number, y: number, rx: number): string {
  return `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${rx * 0.13}" fill="${INK}" opacity="0.13"/>`;
}

/**
 * The label block: petal mark, product name, and an optional kicker/volume.
 * Type is centred on the vessel and clipped to its width by the caller's
 * choice of `perLine`.
 */
function label(
  cx: number,
  top: number,
  w: number,
  name: string,
  kicker: string | undefined,
  volume: string | undefined,
  scale: number,
): string {
  const nameSize = w * 0.108;
  const lines = wrap(name, 15).slice(0, 3);
  const markY = top + w * 0.14;

  const nameBlock = lines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${markY + w * 0.2 + i * nameSize * 1.2}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${nameSize}" fill="${INK}">${escapeXml(line)}</text>`,
    )
    .join('');

  const afterName = markY + w * 0.2 + lines.length * nameSize * 1.2;
  const kickerSize = w * 0.05;

  const kickerBlock = kicker
    ? `<text x="${cx}" y="${afterName + w * 0.03}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${kickerSize}" letter-spacing="${kickerSize * 0.22}" fill="${BRONZE}">${escapeXml(kicker.toUpperCase())}</text>`
    : '';

  const volumeBlock = volume
    ? `<text x="${cx}" y="${afterName + w * 0.115}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${kickerSize * 0.92}" letter-spacing="${kickerSize * 0.1}" fill="${MUTED}">${escapeXml(volume)}</text>`
    : '';

  return `
    ${petals(cx, markY, scale, BRONZE, 0.9)}
    ${nameBlock}
    ${kickerBlock}
    ${volumeBlock}`;
}

/* ── the vessels ──────────────────────────────────────────────────────────── */
/* Each returns SVG in a 1000×1000 working box; the caller scales and places it.
   Proportions are drawn to look like a real cosmetics vessel: a shampoo bottle
   is tall and narrow with a shoulder, a mask jar is squat and wide, a tube has
   a crimped seam. */

function bottle(v: Vessel): string {
  const cx = 500;
  const w = 300;
  const x = cx - w / 2;
  const top = 250;
  const bottom = 880;
  const shoulder = 70;
  const neckW = 96;
  const capH = 96;

  return `
    ${groundShadow(cx, bottom + 12, w * 0.56)}
    <!-- cap -->
    <rect x="${cx - neckW / 2}" y="${top - capH}" width="${neckW}" height="${capH}" rx="10" fill="url(#cap-v)"/>
    <rect x="${cx - neckW / 2}" y="${top - capH}" width="${neckW}" height="${capH * 0.22}" rx="10" fill="${INK}" opacity="0.14"/>
    <!-- body: straight sides, rounded shoulder into the neck -->
    <path d="M ${x} ${bottom - 26}
             L ${x} ${top + shoulder}
             Q ${x} ${top} ${cx - neckW / 2 - 6} ${top - 4}
             L ${cx + neckW / 2 + 6} ${top - 4}
             Q ${x + w} ${top} ${x + w} ${top + shoulder}
             L ${x + w} ${bottom - 26}
             Q ${x + w} ${bottom} ${x + w - 26} ${bottom}
             L ${x + 26} ${bottom}
             Q ${x} ${bottom} ${x} ${bottom - 26} Z"
          fill="url(#body-v)"/>
    <!-- specular highlight -->
    <rect x="${x + w * 0.13}" y="${top + shoulder + 20}" width="${w * 0.07}" height="${bottom - top - shoulder - 90}" rx="${w * 0.035}" fill="#ffffff" opacity="0.34"/>
    ${label(cx, top + 190, w, v.name, v.kicker, v.volume, w / 48 / 5.6)}`;
}

function pump(v: Vessel): string {
  const cx = 500;
  const w = 290;
  const x = cx - w / 2;
  const top = 280;
  const bottom = 880;

  return `
    ${groundShadow(cx, bottom + 12, w * 0.56)}
    <!-- pump head and collar -->
    <path d="M ${cx - 34} ${top - 128} L ${cx - 34} ${top - 150} Q ${cx - 34} ${top - 162} ${cx - 22} ${top - 162} L ${cx + 52} ${top - 162} Q ${cx + 66} ${top - 162} ${cx + 66} ${top - 148} L ${cx + 66} ${top - 138} Q ${cx + 66} ${top - 128} ${cx + 52} ${top - 128} Z" fill="${INK}" opacity="0.72"/>
    <rect x="${cx - 26}" y="${top - 130}" width="52" height="60" fill="url(#cap-v)"/>
    <rect x="${cx - 62}" y="${top - 74}" width="124" height="56" rx="8" fill="url(#cap-v)"/>
    <rect x="${cx - 62}" y="${top - 74}" width="124" height="12" rx="6" fill="${INK}" opacity="0.13"/>
    <!-- shoulderless cylinder -->
    <path d="M ${x} ${bottom - 30}
             L ${x} ${top + 40}
             Q ${x} ${top - 18} ${cx - 62} ${top - 18}
             L ${cx + 62} ${top - 18}
             Q ${x + w} ${top - 18} ${x + w} ${top + 40}
             L ${x + w} ${bottom - 30}
             Q ${x + w} ${bottom} ${x + w - 30} ${bottom}
             L ${x + 30} ${bottom}
             Q ${x} ${bottom} ${x} ${bottom - 30} Z"
          fill="url(#body-v)"/>
    <rect x="${x + w * 0.13}" y="${top + 70}" width="${w * 0.07}" height="${bottom - top - 150}" rx="${w * 0.035}" fill="#ffffff" opacity="0.32"/>
    ${label(cx, top + 180, w, v.name, v.kicker, v.volume, w / 48 / 5.6)}`;
}

function jar(v: Vessel): string {
  const cx = 500;
  const w = 430;
  const x = cx - w / 2;
  const top = 400;
  const bottom = 830;
  const lidH = 120;

  return `
    ${groundShadow(cx, bottom + 14, w * 0.54)}
    <!-- lid, slightly wider than the base -->
    <rect x="${x - 14}" y="${top - lidH}" width="${w + 28}" height="${lidH}" rx="18" fill="url(#cap-v)"/>
    <rect x="${x - 14}" y="${top - lidH}" width="${w + 28}" height="22" rx="11" fill="#ffffff" opacity="0.20"/>
    <rect x="${x - 14}" y="${top - 26}" width="${w + 28}" height="26" fill="${INK}" opacity="0.10"/>
    <!-- squat body -->
    <path d="M ${x} ${top}
             L ${x + w} ${top}
             L ${x + w} ${bottom - 34}
             Q ${x + w} ${bottom} ${x + w - 34} ${bottom}
             L ${x + 34} ${bottom}
             Q ${x} ${bottom} ${x} ${bottom - 34} Z"
          fill="url(#body-v)"/>
    <rect x="${x + w * 0.09}" y="${top + 34}" width="${w * 0.05}" height="${bottom - top - 110}" rx="${w * 0.025}" fill="#ffffff" opacity="0.30"/>
    ${label(cx, top + 54, w * 0.82, v.name, v.kicker, v.volume, w / 48 / 8)}`;
}

function tube(v: Vessel): string {
  const cx = 500;
  const w = 270;
  const x = cx - w / 2;
  /* A tube stands on its cap: the crimped seam is the *top*, the screw cap is
     the foot. Drawing it the other way up put the seam under the label and read
     as a bottle with a broken base. */
  const top = 250;
  const bottom = 880;
  const capH = 104;
  const seamH = 44;

  return `
    ${groundShadow(cx, bottom + 12, w * 0.62)}
    <!-- crimped seam, at the shoulder -->
    <rect x="${x - 8}" y="${top}" width="${w + 16}" height="${seamH}" rx="6" fill="url(#cap-v)"/>
    ${Array.from({ length: 5 }, (_, i) => `<line x1="${x + 6 + i * ((w - 12) / 4)}" y1="${top + 8}" x2="${x + 6 + i * ((w - 12) / 4)}" y2="${top + seamH - 8}" stroke="${INK}" stroke-opacity="0.16" stroke-width="4"/>`).join('')}
    <!-- body, tapering slightly into the cap -->
    <path d="M ${x} ${top + seamH}
             L ${x + w} ${top + seamH}
             L ${x + w} ${bottom - capH - 40}
             Q ${x + w} ${bottom - capH} ${cx + 62} ${bottom - capH}
             L ${cx - 62} ${bottom - capH}
             Q ${x} ${bottom - capH} ${x} ${bottom - capH - 40} Z"
          fill="url(#body-v)"/>
    <!-- screw cap it stands on -->
    <rect x="${cx - 66}" y="${bottom - capH}" width="132" height="${capH}" rx="10" fill="url(#cap-v)"/>
    <rect x="${cx - 66}" y="${bottom - 18}" width="132" height="18" rx="9" fill="${INK}" opacity="0.12"/>
    <rect x="${x + w * 0.15}" y="${top + seamH + 40}" width="${w * 0.07}" height="${bottom - top - capH - seamH - 110}" rx="${w * 0.035}" fill="#ffffff" opacity="0.32"/>
    ${label(cx, top + seamH + 120, w, v.name, v.kicker, v.volume, w / 48 / 5.4)}`;
}

function flacon(v: Vessel): string {
  const cx = 500;
  const w = 340;
  const x = cx - w / 2;
  const top = 360;
  const bottom = 850;

  return `
    ${groundShadow(cx, bottom + 12, w * 0.54)}
    <!-- collar and stopper -->
    <rect x="${cx - 54}" y="${top - 150}" width="108" height="74" rx="8" fill="url(#cap-v)"/>
    <rect x="${cx - 54}" y="${top - 150}" width="108" height="12" rx="6" fill="#ffffff" opacity="0.2"/>
    <rect x="${cx - 40}" y="${top - 80}" width="80" height="34" fill="${GOLD_DEEP}" opacity="0.55"/>
    <!-- rounded shoulders, wide body -->
    <path d="M ${x} ${bottom - 40}
             L ${x} ${top + 96}
             Q ${x} ${top - 46} ${cx - 40} ${top - 46}
             L ${cx + 40} ${top - 46}
             Q ${x + w} ${top - 46} ${x + w} ${top + 96}
             L ${x + w} ${bottom - 40}
             Q ${x + w} ${bottom} ${x + w - 40} ${bottom}
             L ${x + 40} ${bottom}
             Q ${x} ${bottom} ${x} ${bottom - 40} Z"
          fill="url(#body-v)"/>
    <rect x="${x + w * 0.12}" y="${top + 120}" width="${w * 0.06}" height="${bottom - top - 220}" rx="${w * 0.03}" fill="#ffffff" opacity="0.30"/>
    ${label(cx, top + 150, w * 0.86, v.name, v.kicker, v.volume, w / 48 / 6.6)}`;
}

function sachet(v: Vessel): string {
  const cx = 500;
  const w = 400;
  const x = cx - w / 2;
  const top = 260;
  const bottom = 860;

  return `
    ${groundShadow(cx, bottom + 12, w * 0.5)}
    <!-- flat pouch with a serrated top seam -->
    <rect x="${x}" y="${top}" width="${w}" height="${bottom - top}" rx="14" fill="url(#body-v)"/>
    <rect x="${x}" y="${top}" width="${w}" height="54" rx="12" fill="${INK}" opacity="0.09"/>
    <rect x="${x}" y="${bottom - 46}" width="${w}" height="46" rx="12" fill="${INK}" opacity="0.07"/>
    ${Array.from({ length: 13 }, (_, i) => `<circle cx="${x + 16 + i * ((w - 32) / 12)}" cy="${top + 30}" r="5" fill="${PAPER}" opacity="0.55"/>`).join('')}
    <rect x="${x + w * 0.07}" y="${top + 80}" width="${w * 0.045}" height="${bottom - top - 190}" rx="${w * 0.022}" fill="#ffffff" opacity="0.26"/>
    ${label(cx, top + 130, w * 0.8, v.name, v.kicker, v.volume, w / 48 / 7.4)}`;
}

function bar(v: Vessel): string {
  const cx = 500;
  const w = 430;
  const h = 300;
  const x = cx - w / 2;
  const y = 520;

  return `
    ${groundShadow(cx, y + h + 12, w * 0.5)}
    <!-- wrapped bar, banded sleeve -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="url(#body-v)"/>
    <rect x="${x}" y="${y + h * 0.3}" width="${w}" height="${h * 0.42}" fill="${PAPER}" opacity="0.72"/>
    <line x1="${x}" y1="${y + h * 0.3}" x2="${x + w}" y2="${y + h * 0.3}" stroke="${LINE}" stroke-width="3"/>
    <line x1="${x}" y1="${y + h * 0.72}" x2="${x + w}" y2="${y + h * 0.72}" stroke="${LINE}" stroke-width="3"/>
    ${label(cx, y + h * 0.2, w * 0.74, v.name, v.kicker, v.volume, w / 48 / 9)}`;
}

const VESSELS: Record<VesselKind, (v: Vessel) => string> = {
  bottle,
  pump,
  jar,
  tube,
  flacon,
  sachet,
  bar,
};

/* ── views ────────────────────────────────────────────────────────────────── */

/**
 * `detail` and `packaging` are not re-renders of the same object at a different
 * zoom — that reads as a bug in a gallery. `detail` crops into the texture of
 * the product itself; `packaging` shows the carton. Both stay abstract: no
 * ingredient, no claim, no text the database does not hold.
 */
function detailView(v: Vessel, ground: string): string {
  const rings = Array.from({ length: 7 }, (_, i) => {
    const r = 120 + i * 62;
    return `<circle cx="500" cy="520" r="${r}" fill="none" stroke="${GOLD_DEEP}" stroke-opacity="${0.2 - i * 0.022}" stroke-width="${9 - i * 0.7}"/>`;
  }).join('');

  return `
    <rect width="1000" height="1000" fill="${ground}"/>
    <circle cx="500" cy="520" r="330" fill="${GOLD}" opacity="0.10"/>
    ${rings}
    ${petals(500, 470, 3.1, BRONZE, 0.92)}
    <text x="500" y="700" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="52" fill="${INK}">${escapeXml(wrap(v.name, 20)[0] ?? v.name)}</text>
    <text x="500" y="756" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" letter-spacing="6" fill="${BRONZE}">TEXTURE</text>`;
}

function packagingView(v: Vessel, ground: string): string {
  /* Sized so the carton fills the 4:5 crop the way the vessels do — the first
     pass drew it at 420×560 inside a 1000-wide box and it read as a stamp
     floating in the corner. `d` is the receding side, so the visual centre is
     x + (w + d)/2, not x + w/2. */
  const w = 520;
  const h = 700;
  const d = 96;
  const x = (1000 - (w + d)) / 2;
  const y = 220;

  return `
    <rect width="1000" height="1000" fill="${ground}"/>
    ${groundShadow(x + (w + d) / 2, y + h + 16, 300)}
    <!-- carton: front face plus one receding side, no perspective tricks -->
    <path d="M ${x + w} ${y} L ${x + w + d} ${y - d * 0.55} L ${x + w + d} ${y + h - d * 0.55} L ${x + w} ${y + h} Z" fill="${INK}" opacity="0.13"/>
    <path d="M ${x} ${y} L ${x + w} ${y} L ${x + w + d} ${y - d * 0.55} L ${x + d} ${y - d * 0.55} Z" fill="${INK}" opacity="0.07"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${LINE}" stroke-width="3"/>
    <rect x="${x + 34}" y="${y + 34}" width="${w - 68}" height="${h - 68}" fill="none" stroke="${GOLD_DEEP}" stroke-opacity="0.4" stroke-width="2"/>
    ${label(x + w / 2, y + 96, w * 0.78, v.name, v.kicker, v.volume, w / 48 / 7)}
    <text x="${x + w / 2}" y="${y + h - 52}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="5" fill="${MUTED}">BOA COSMETIC</text>`;
}

/* ── editorial ────────────────────────────────────────────────────────────── */

/**
 * The wide bands (hero, maison) are not product shots — a bottle stretched to
 * 3:2 reads as a mistake. This is an abstract composition in the brand palette:
 * concentric gold arcs, the petal mark, and a horizon line. It carries **no
 * text**, so it states nothing about BOA that the database does not already
 * say, and the band's own copy sits over it in the layout.
 *
 * `seed` shifts the composition so the hero and the maison band are not the
 * same picture twice.
 */
export function editorial(width: number, height: number, seed = 0): string {
  const ground = GROUNDS[seed % GROUNDS.length]!;
  const cx = width * (seed % 2 === 0 ? 0.68 : 0.34);
  const cy = height * 0.5;
  const unit = Math.min(width, height);

  const arcs = Array.from({ length: 9 }, (_, i) => {
    const r = unit * (0.16 + i * 0.085);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD_DEEP}" stroke-opacity="${0.26 - i * 0.024}" stroke-width="${Math.max(1, 7 - i * 0.6)}"/>`;
  }).join('');

  /* A few soft discs offset from the centre, so the field is not perfectly
     concentric and reads as composed rather than generated. */
  const discs = [
    { x: cx - unit * 0.34, y: cy - unit * 0.22, r: unit * 0.1, o: 0.1 },
    { x: cx + unit * 0.3, y: cy + unit * 0.26, r: unit * 0.07, o: 0.08 },
    { x: cx - unit * 0.12, y: cy + unit * 0.36, r: unit * 0.05, o: 0.12 },
  ]
    .map((d) => `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${BRONZE}" opacity="${d.o}"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${ground}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${unit * 0.62}" ry="${unit * 0.62}" fill="${GOLD}" opacity="0.09"/>
  ${arcs}
  ${discs}
  <line x1="0" y1="${height * 0.78}" x2="${width}" y2="${height * 0.78}" stroke="${LINE}" stroke-width="2" stroke-opacity="0.85"/>
  ${petals(cx, cy - unit * 0.02, unit / 48 / 3.4, BRONZE, 0.92)}
</svg>`;
}

/* ── entry point ──────────────────────────────────────────────────────────── */

export function render(v: Vessel): string {
  const ground = GROUNDS[(v.tone ?? 1) % GROUNDS.length]!;

  /* The vessel's own colour. Kept within the palette: a warm near-white glass
     with a gold cast, so the render sits on the brand ground rather than
     looking like a product from another catalogue. */
  const base = '#efe7d6';
  const dark = '#d8cdb6';
  const light = '#fdfbf6';

  const inner =
    v.view === 'detail'
      ? detailView(v, ground)
      : v.view === 'packaging'
        ? packagingView(v, ground)
        : `<rect width="1000" height="1000" fill="${ground}"/>
           <ellipse cx="500" cy="560" rx="430" ry="430" fill="${GOLD}" opacity="0.07"/>
           ${VESSELS[v.kind](v)}`;

  /* The working box is square; the output is 4:5 (or whatever the caller asks
     for). preserveAspectRatio="xMidYMid slice" would crop the label, so the
     viewBox is widened instead and the art stays centred. */
  const vbW = 1000;
  const vbH = 1000 * (v.height / v.width) * (v.width / v.height);
  void vbH;

  const boxH = Math.round(1000 * (v.height / v.width));
  const offsetY = (boxH - 1000) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${v.width}" height="${v.height}" viewBox="0 ${-offsetY} ${vbW} ${boxH}">
  <defs>${glassDefs('v', base, dark, light)}</defs>
  <rect x="0" y="${-offsetY}" width="${vbW}" height="${boxH}" fill="${ground}"/>
  ${inner}
</svg>`;
}
