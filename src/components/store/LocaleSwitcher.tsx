'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALES, LOCALE_META, isLocale, type AppLocale } from '@/i18n/config';
import { IconGlobe } from '@/components/ui/icons';

/**
 * Swaps the locale segment in place, so switching language keeps the visitor on
 * the page they were reading instead of dumping them on the homepage.
 */
export function LocaleSwitcher({ current, label }: { current: AppLocale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const swap = (next: string) => {
    const segments = pathname.split('/');
    if (isLocale(segments[1] ?? '')) segments[1] = next;
    else segments.splice(1, 0, next);
    startTransition(() => router.push(segments.join('/') || `/${next}`));
  };

  return (
    <div className="relative inline-flex items-center">
      <IconGlobe
        width={16}
        height={16}
        className="pointer-events-none absolute inset-inline-start-0 text-[var(--surface-muted)]"
        style={{ insetInlineStart: 0 }}
      />
      <label htmlFor="locale-switcher" className="visually-hidden">
        {label}
      </label>
      <select
        id="locale-switcher"
        value={current}
        disabled={pending}
        onChange={(event) => swap(event.target.value)}
        className="appearance-none bg-transparent py-2 ps-6 pe-4 text-xs uppercase tracking-[0.14em] text-[var(--surface-muted)] hover:text-[var(--surface-fg)]"
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale} className="text-black">
            {LOCALE_META[locale].label}
          </option>
        ))}
      </select>
    </div>
  );
}
