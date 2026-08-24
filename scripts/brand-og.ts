/**
 * The social share card.
 *
 * Every storefront page declares Open Graph metadata, but only a product page
 * ever supplied an image — so a link to the homepage, the catalogue, a ritual or
 * the contact page shared on WhatsApp, Facebook or LinkedIn rendered as a blank
 * card. For a brand whose customers arrive through exactly those channels, that
 * is a missing placement, not a missing nicety.
 *
 * Two rules shape what is drawn here:
 *
 *  1. **The logo is used as supplied.** It is composited from
 *     `public/brand/boa-logo.png`, not redrawn, recoloured or re-cropped.
 *  2. **The ground is ink.** The mark's "COSMETIC" line is white; on the warm
 *     paper ground it disappears. Same constraint that makes the site header
 *     ink — see `src/components/brand/Logo.tsx`.
 *
 * The only words on the card are the brand name carried by the mark itself and
 * the tagline that already ships in `src/i18n/messages/*.json`. Nothing about
 * BOA is invented here.
 *
 *   npm run brand:og
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import ar from '../src/i18n/messages/ar.json';
import en from '../src/i18n/messages/en.json';
import fr from '../src/i18n/messages/fr.json';

/* Tokens, measured from the logo — see src/styles/tokens.css. */
const INK = '#27282a';
const INK_SUNKEN = '#1e1f21';
const GOLD = '#d2ac49';
const GOLD_LIGHT = '#e4ca69';
const GOLD_DEEP = '#99864a';

/** 1200 × 630 is the size every major platform crops from. */
const WIDTH = 1200;
const HEIGHT = 630;
const LOGO = 300;

const OUT = join(process.cwd(), 'public', 'brand');

/** One card per locale: a French tagline under an English share reads as a bug. */
const MESSAGES = { fr, en, ar } as Record<string, unknown>;

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

/** The place line is the only other copy, and it is the brief's own. */
const PLACE: Record<string, string> = {
  fr: 'SOUSSE, TUNISIE',
  en: 'SOUSSE, TUNISIA',
  ar: 'SOUSSE, TUNISIA',
};

function backdrop(tagline: string, locale: string): string {
  const baseline = 630 * 0.72;
  const rtl = locale === 'ar';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${GOLD_DEEP}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${GOLD}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${GOLD_DEEP}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>
  <rect y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="${INK_SUNKEN}"/>

  <!-- The same gold hairline the site uses to separate its bands. -->
  <rect x="${WIDTH / 2 - 190}" y="${baseline - 42}" width="380" height="1" fill="url(#rule)"/>

  <text x="${WIDTH / 2}" y="${baseline + 4}" text-anchor="middle" direction="${rtl ? 'rtl' : 'ltr'}"
        font-family="${rtl ? "'Segoe UI', 'Noto Naskh Arabic', sans-serif" : "Georgia, 'Times New Roman', serif"}"
        font-size="32" fill="${GOLD_LIGHT}">${escapeXml(tagline)}</text>

  <text x="${WIDTH / 2}" y="${baseline + 62}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="15"
        letter-spacing="4.2" fill="${GOLD_DEEP}">${PLACE[locale] ?? PLACE.fr}</text>
</svg>`;
}

async function main() {
  const mark = await sharp(await readFile(join(process.cwd(), 'public', 'brand', 'boa-logo.png')))
    .resize(LOGO, LOGO, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  for (const [locale, messages] of Object.entries(MESSAGES)) {
    const tagline = (messages as { home?: { openingTagline?: string } }).home?.openingTagline;
    if (!tagline) throw new Error(`home.openingTagline is missing from src/i18n/messages/${locale}.json`);

    const png = await sharp(Buffer.from(backdrop(tagline, locale)))
      .composite([{ input: mark, left: Math.round((WIDTH - LOGO) / 2), top: 96 }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeFile(join(OUT, `og-${locale}.png`), png);
    console.log(`  public/brand/og-${locale}.png  ${WIDTH} × ${HEIGHT}  ${Math.round(png.length / 1024)} Ko`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
