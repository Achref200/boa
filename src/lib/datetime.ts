import { BUSINESS_TIMEZONE } from './tz';

/**
 * All customer- and admin-facing dates go through here.
 *
 * Two decisions this centralises:
 *   • everything is rendered in Africa/Tunis, never in the viewer's timezone —
 *     an appointment at 09:00 is 09:00 for the salon and for the customer;
 *   • the clock is 24-hour in every locale. Some fr-TN and ar-TN
 *     implementations resolve `timeStyle` to a 12-hour clock, and "9:00 AM" is
 *     not how appointments are written in Tunisia.
 */
const INTL_LOCALE: Record<string, string> = { fr: 'fr-TN', en: 'en-GB', ar: 'ar-TN' };

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let existing = cache.get(key);
  if (!existing) {
    existing = new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'fr-TN', {
      timeZone: BUSINESS_TIMEZONE,
      ...options,
    });
    cache.set(key, existing);
  }
  return existing;
}

export const formatDateTime = (value: Date, locale = 'fr'): string =>
  formatter(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);

export const formatLongDateTime = (value: Date, locale = 'fr'): string =>
  formatter(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);

export const formatDate = (value: Date, locale = 'fr'): string =>
  formatter(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);

export const formatTime = (value: Date, locale = 'fr'): string =>
  formatter(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
