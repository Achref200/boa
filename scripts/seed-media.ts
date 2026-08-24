/**
 * Reserve imagery.
 *
 * BOA has supplied no product photography (see `docs/CONTENT-CHECKLIST.md`), and
 * this repository does not invent it: no stock photograph, no generated bottle,
 * nothing that could be mistaken for a real BOA product.
 *
 * What this script does instead is fill every image slot in the database with a
 * **declared reserve** — a real image file, drawn from the brand's own tokens,
 * that states in words what asset belongs there and at what size. The site then
 * renders a picture everywhere instead of an empty frame, the whole media
 * pipeline (storage → path → `mediaUrl` → `next/image`) is exercised for real,
 * and swapping in a genuine photograph is one upload per product in `/admin`.
 *
 * It is idempotent: a slot that already holds a path is left alone unless
 * `--force` is passed, so it can never overwrite a real photograph.
 *
 * Refuses to run against a production database unless MEDIA_SEED_FORCE=1.
 *
 *   npm run db:media           fill empty slots
 *   npm run db:media -- --force  redraw everything (destroys real uploads)
 */
import { createPool } from 'mysql2/promise';
import { config } from 'dotenv';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const FORCE = process.argv.includes('--force');
const UPLOADS = join(process.cwd(), 'public', 'uploads');

/* ── ids, matching the ULID-ish shape the rest of the codebase uses ──────── */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
let counter = 0;
function id(): string {
  const time = Date.now() + (counter += 1);
  let head = '';
  let value = time;
  for (let i = 0; i < 8; i += 1) {
    head = ALPHABET[value % 32]! + head;
    value = Math.floor(value / 32);
  }
  const bytes = randomBytes(16);
  let tail = '';
  for (let i = 0; i < 16; i += 1) tail += ALPHABET[bytes[i]! % 32];
  return head + tail;
}

/* ── the drawing ─────────────────────────────────────────────────────────── */

const INK = '#27282a';
const LINE = '#e7dfcd';
/**
 * Three grounds, all existing tokens (--color-paper, -paper-sunken, -paper-line).
 * A catalogue where every reserve is the same card reads as one repeated asset;
 * alternating the ground makes the grid read as art direction instead, and makes
 * the product gallery's thumbnail rail legible at 80px. No new hue is introduced.
 */
const GROUNDS = ['#fbf8f1', '#f5efe2', '#e7dfcd'] as const;
const BRONZE = '#645322';
const GOLD_DEEP = '#99864a';
const MUTED = '#6b6459';

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

/** Naive greedy wrap. The names are short; a typographic wrapper would be overkill. */
function wrap(text: string, perLine: number): string[] {
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
  return lines.slice(0, 4);
}

/**
 * The petal cluster, five leaves fanned about a single base point — the same
 * construction as `src/components/brand/Petals.tsx`, not a trace of the JPEG.
 */
function petals(cx: number, cy: number, scale: number, colour: string): string {
  const leaves = [
    { angle: -52, ry: 10.5, opacity: 0.62 },
    { angle: -26, ry: 12.5, opacity: 0.82 },
    { angle: 0, ry: 14, opacity: 1 },
    { angle: 26, ry: 12.5, opacity: 0.82 },
    { angle: 52, ry: 10.5, opacity: 0.62 },
  ];
  const inner = leaves
    .map(
      (l) =>
        `<ellipse cx="24" cy="${38 - l.ry}" rx="4.1" ry="${l.ry}" opacity="${l.opacity}" transform="rotate(${l.angle} 24 38)"/>`,
    )
    .join('');
  const size = 48 * scale;
  return `<g fill="${colour}" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})">${inner}</g>`;
}

/**
 * A product carries three reserves rather than one. A single image leaves the
 * gallery rail, the dot pagination and the zoom with nothing to show, so the
 * page a reviewer sees is not the page the code actually builds.
 */
const PRODUCT_VIEWS = [
  { label: 'Visuel principal', alt: 'visuel principal' },
  { label: 'Détail · texture', alt: 'détail de texture' },
  { label: 'Packaging', alt: 'packaging' },
] as const;

type Plate = {
  label: string;
  title: string;
  width: number;
  height: number;
  /** Index into GROUNDS. Defaults to the sunken ground the first reserves used. */
  tone?: number;
};

function plate({ label, title, width, height, tone = 1 }: Plate): string {
  const ground = GROUNDS[tone % GROUNDS.length]!;
  const short = Math.min(width, height);
  const pad = Math.round(short * 0.055);
  const bracket = Math.round(short * 0.05);
  const sealScale = short / 48 / 7;
  const sealY = height * 0.4;

  const titleSize = Math.round(short * 0.062);
  const lines = wrap(title, 22);
  const titleBlock = lines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${sealY + short * 0.13 + i * titleSize * 1.22}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" fill="${INK}">${escapeXml(line)}</text>`,
    )
    .join('');

  const labelSize = Math.round(short * 0.026);
  const dimSize = Math.round(short * 0.022);
  const afterTitle = sealY + short * 0.13 + lines.length * titleSize * 1.22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="hatch" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <line x1="0" y1="0" x2="0" y2="26" stroke="${GOLD_DEEP}" stroke-opacity="0.10" stroke-width="2"/>
    </pattern>
  </defs>

  <rect width="${width}" height="${height}" fill="${ground}"/>
  <rect width="${width}" height="${height}" fill="url(#hatch)"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="${LINE}" stroke-width="2"/>

  <path d="M ${pad} ${pad + bracket} L ${pad} ${pad} L ${pad + bracket} ${pad}" fill="none" stroke="${GOLD_DEEP}" stroke-opacity="0.45" stroke-width="3"/>
  <path d="M ${width - pad - bracket} ${height - pad} L ${width - pad} ${height - pad} L ${width - pad} ${height - pad - bracket}" fill="none" stroke="${GOLD_DEEP}" stroke-opacity="0.45" stroke-width="3"/>

  ${petals(width / 2, sealY, sealScale, BRONZE)}
  ${titleBlock}

  <text x="${width / 2}" y="${afterTitle + short * 0.06}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="${labelSize}" letter-spacing="${labelSize * 0.24}" fill="${BRONZE}">${escapeXml(label.toUpperCase())}</text>
  <text x="${width / 2}" y="${afterTitle + short * 0.115}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${dimSize}" letter-spacing="${dimSize * 0.12}" fill="${MUTED}">${width} × ${height}</text>
  <text x="${width / 2}" y="${height - pad - dimSize * 0.4}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${dimSize}" letter-spacing="${dimSize * 0.1}" fill="${MUTED}">BOA COSMETIC · RÉSERVE, À REMPLACER</text>
</svg>`;
}

/**
 * Content-hashed names, exactly as `src/modules/media/storage.ts` writes them,
 * so a reserve is indistinguishable from an upload to the rest of the system.
 */
async function writePlate(prefix: string, spec: Plate): Promise<string> {
  const png = await sharp(Buffer.from(plate(spec))).png({ compressionLevel: 9 }).toBuffer();
  const hash = createHash('sha256').update(png).digest('hex').slice(0, 32);
  const relative = `${prefix}/${hash}.png`;
  await mkdir(join(UPLOADS, prefix), { recursive: true });
  await writeFile(join(UPLOADS, relative), png);
  return relative;
}

/* ── the run ─────────────────────────────────────────────────────────────── */

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  if (process.env.NODE_ENV === 'production' && process.env.MEDIA_SEED_FORCE !== '1') {
    throw new Error('Refusing to seed media against a production database.');
  }

  const pool = createPool({ uri: url, connectionLimit: 4, timezone: 'Z' });
  let drawn = 0;
  let skipped = 0;

  const say = (what: string, name: string, action: 'drawn' | 'kept') => {
    if (action === 'drawn') {
      drawn += 1;
      console.log(`  + ${what.padEnd(15)} ${name}`);
    } else {
      skipped += 1;
    }
  };

  try {
    /* Products — 4:5, the locked catalogue crop (docs/BRAND.md §6). */
    const [products] = await pool.query<any[]>(
      `SELECT p.id, COALESCE(t.name, p.slug) AS name,
              (SELECT COUNT(*) FROM product_media m WHERE m.product_id = p.id) AS media_count
         FROM products p
         LEFT JOIN product_translations t ON t.product_id = p.id AND t.locale = 'FR'
        ORDER BY p.created_at`,
    );

    console.log(`\nProduits (${products.length})`);
    for (const row of products) {
      if (row.media_count > 0 && !FORCE) {
        say('produit', row.name, 'kept');
        continue;
      }
      if (FORCE) await pool.query('DELETE FROM product_media WHERE product_id = ?', [row.id]);
      for (const [position, view] of PRODUCT_VIEWS.entries()) {
        const path = await writePlate('products', {
          label: view.label,
          title: row.name,
          width: 1600,
          height: 2000,
          tone: position + 1,
        });
        await pool.query(
          `INSERT INTO product_media (id, product_id, kind, path, alt, width, height, position)
           VALUES (?, ?, 'IMAGE', ?, ?, 1600, 2000, ?)`,
          [id(), row.id, path, `Réserve d'image — ${row.name} — ${view.alt}`, position],
        );
      }
      say('produit', row.name, 'drawn');
    }

    /* Everything else carries a single cover column. Editorial crop, 3:2. */
    const covers: { table: string; column: string; label: string }[] = [
      { table: 'categories', column: 'image_path', label: 'Catégorie' },
      { table: 'collections', column: 'cover_path', label: 'Collection' },
      { table: 'rituals', column: 'cover_path', label: 'Rituel' },
      { table: 'services', column: 'cover_path', label: 'Service' },
    ];

    for (const spec of covers) {
      const singular = spec.table.replace(/ies$/, 'y').replace(/s$/, '');
      const [rows] = await pool.query<any[]>(
        `SELECT e.id, COALESCE(t.name, e.slug) AS name, e.${spec.column} AS current
           FROM ${spec.table} e
           LEFT JOIN ${singular}_translations t
                  ON t.${singular}_id = e.id AND t.locale = 'FR'
          ORDER BY e.id`,
      );
      console.log(`\n${spec.label} (${rows.length})`);
      for (const [index, row] of rows.entries()) {
        if (row.current && !FORCE) {
          say(spec.label, row.name, 'kept');
          continue;
        }
        const path = await writePlate(spec.table, {
          label: spec.label,
          title: row.name,
          width: 1800,
          height: 1200,
          tone: index + 1,
        });
        await pool.query(`UPDATE ${spec.table} SET ${spec.column} = ? WHERE id = ?`, [path, row.id]);
        say(spec.label, row.name, 'drawn');
      }
    }

    /* Content blocks — the hero and editorial bands. Wider crop. */
    const [blocks] = await pool.query<any[]>(
      `SELECT id, page, kind, media_path FROM content_blocks ORDER BY page, position`,
    );
    console.log(`\nBlocs de contenu (${blocks.length})`);
    for (const row of blocks) {
      if (row.media_path && !FORCE) {
        say('bloc', `${row.page}/${row.kind}`, 'kept');
        continue;
      }
      // Only bands that actually render an image get one.
      if (!['hero', 'maison', 'editorial', 'banner'].includes(String(row.kind))) {
        say('bloc', `${row.page}/${row.kind}`, 'kept');
        continue;
      }
      const path = await writePlate('content', {
        label: `${row.page} · ${row.kind}`,
        title: 'Visuel éditorial',
        width: 2400,
        height: 1600,
        tone: 0,
      });
      await pool.query('UPDATE content_blocks SET media_path = ? WHERE id = ?', [path, row.id]);
      say('bloc', `${row.page}/${row.kind}`, 'drawn');
    }

    console.log(`\n${drawn} réserve(s) dessinée(s), ${skipped} emplacement(s) déjà pourvu(s).`);
    if (skipped && !FORCE) console.log('Passer --force pour redessiner (écrase de vrais téléversements).');
    console.log('Fichiers dans public/uploads/. Remplacer une réserve = un téléversement dans /admin.\n');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
