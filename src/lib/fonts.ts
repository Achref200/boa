import localFont from 'next/font/local';

/**
 * Fonts are vendored into the repository rather than fetched from Google.
 * Self-hosting removes a third-party request from the critical path, keeps the
 * build reproducible offline, and avoids sending visitor IPs to a font CDN.
 * Files come from the Fontsource distributions of the same open families.
 *
 * The CSS variables are named by **role**, not by family, so replacing a
 * typeface is a change to this file alone — `tokens.css` and every component
 * keep referring to `--font-display-src` and `--font-text-src`.
 */

/**
 * Display — Calistoga.
 *
 * A single-weight warm display face: soft, slightly rounded terminals and a
 * generous x-height. It is the counterweight to a palette whose ground is a
 * near-charcoal; where a Didone would make the brand cold and formal, this
 * reads as a maker rather than a maison. One weight only, by design — display
 * type that needs a bold is display type doing too much work.
 */
export const display = localFont({
  variable: '--font-display-src',
  display: 'swap',
  preload: true,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
  src: [
    { path: '../assets/fonts/calistoga-latin.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/calistoga-latin-ext.woff2', weight: '400', style: 'normal' },
  ],
});

/**
 * Text and UI — Hanken Grotesk, variable 100–900.
 *
 * A humanist grotesque with open apertures and slightly soft joins, so long
 * French product copy and dense admin tables stay warm without losing the
 * neutrality a price column needs. Variable, so weight is a design axis rather
 * than four separate downloads.
 */
export const text = localFont({
  variable: '--font-text-src',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: 'Arial',
  src: [
    { path: '../assets/fonts/hanken-grotesk-latin.woff2', weight: '100 900', style: 'normal' },
    { path: '../assets/fonts/hanken-grotesk-latin-ext.woff2', weight: '100 900', style: 'normal' },
  ],
});

/**
 * Arabic is only preloaded on the Arabic tree — see the locale layout — so
 * French and English visitors never pay for it.
 */
export const plexArabic = localFont({
  variable: '--font-plex-arabic',
  display: 'swap',
  preload: false,
  fallback: ['Segoe UI', 'Tahoma', 'sans-serif'],
  src: [
    { path: '../assets/fonts/plex-arabic-300.woff2', weight: '300', style: 'normal' },
    { path: '../assets/fonts/plex-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/plex-arabic-500.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/plex-arabic-600.woff2', weight: '600', style: 'normal' },
  ],
});

export const fontVariables = `${display.variable} ${text.variable} ${plexArabic.variable}`;
