export const LOCALES = ['fr', 'en', 'ar'] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'fr';

/** Maps the URL segment to the database enum used by every *_translations table. */
export const DB_LOCALE = { fr: 'FR', en: 'EN', ar: 'AR' } as const;
export type DbLocale = (typeof DB_LOCALE)[AppLocale];

export const LOCALE_META: Record<AppLocale, { label: string; dir: 'ltr' | 'rtl'; htmlLang: string }> = {
  fr: { label: 'Français', dir: 'ltr', htmlLang: 'fr-TN' },
  en: { label: 'English', dir: 'ltr', htmlLang: 'en' },
  ar: { label: 'العربية', dir: 'rtl', htmlLang: 'ar-TN' },
};

export const isLocale = (value: string): value is AppLocale =>
  (LOCALES as readonly string[]).includes(value);

export const dbLocale = (locale: AppLocale): DbLocale => DB_LOCALE[locale];
