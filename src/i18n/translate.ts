import 'server-only';
import { cache } from 'react';
import type { AppLocale } from './config';
import { DEFAULT_LOCALE } from './config';
import fr from './messages/fr.json';
import en from './messages/en.json';
import ar from './messages/ar.json';

type Messages = typeof fr;
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

const BUNDLES: Record<AppLocale, Messages> = {
  fr,
  en: en as Messages,
  ar: ar as Messages,
};

function lookup(bundle: unknown, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    bundle,
  );
  return typeof value === 'string' ? value : undefined;
}

/**
 * `t('cart.title')` with `{name}` interpolation. A missing key falls back to
 * French rather than rendering the raw key at a customer, and is reported once
 * in development so the gap is visible without breaking the page.
 */
export const getTranslator = cache((locale: AppLocale) => {
  const bundle = BUNDLES[locale] ?? BUNDLES[DEFAULT_LOCALE];
  return function t(key: MessageKey, values?: Record<string, string | number>): string {
    const template = lookup(bundle, key) ?? lookup(BUNDLES[DEFAULT_LOCALE], key);
    if (template === undefined) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
});

export type Translator = ReturnType<typeof getTranslator>;
