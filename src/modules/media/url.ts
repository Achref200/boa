/**
 * Media paths are stored relative to the driver, never as absolute URLs, so the
 * storage provider can change without a data migration. This is the only place
 * that turns a stored path into something a browser can request.
 *
 * It reads `NEXT_PUBLIC_MEDIA_BASE_URL` directly rather than importing the
 * validated server env, because client components resolve image URLs too — and
 * `lib/env` is `server-only` precisely so a bundle leak fails at build time
 * instead of throwing in a customer's browser.
 */
const BASE = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? '';

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const clean = path.replace(/^\/+/, '');
  if (BASE) return `${BASE.replace(/\/+$/, '')}/${clean}`;
  return `/uploads/${clean}`;
}

/**
 * Product photography is locked to 4:5 so a catalogue grid reads as one set.
 * Editorial imagery is free to break the grid; see docs/BRAND.md §6.
 */
export const PRODUCT_ASPECT = 4 / 5;
export const productSizes = '(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 26vw';
