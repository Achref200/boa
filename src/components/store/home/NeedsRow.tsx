import Link from 'next/link';
import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { IconArrowRight } from '@/components/ui/icons';
import type { NeedView } from '@/modules/catalog/types';
import type { ContentBlock } from '@/modules/content/service';

/**
 * The commercially decisive block, so it sits above the product grid.
 *
 * Deliberately not cards: a stack of full-width rules with an index, a large
 * name and a quiet tagline reads as a table of contents, which is what a
 * customer who does not yet know the word "keratin" actually needs. The whole
 * row is the target, so it is comfortable on a phone.
 */
export function NeedsRow({
  locale,
  needs,
  block,
}: {
  locale: AppLocale;
  needs: NeedView[];
  block: ContentBlock | undefined;
}) {
  const t = getTranslator(locale);
  if (needs.length === 0) return null;

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-[var(--spacing-section)]">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="lockup text-[var(--surface-accent)]">
              {block?.eyebrow ?? t('home.needsEyebrow')}
            </p>
            <h2 className="font-display mt-5 text-[length:var(--text-2xl)]">
              {block?.heading ?? t('home.needsHeading')}
            </h2>
          </div>

          <ul className="lg:col-span-8">
            {needs.map((need, index) => (
              <li key={need.id} className="border-t border-[var(--surface-line)] last:border-b">
                <Link
                  href={`${routes.shop(locale)}?besoin=${encodeURIComponent(need.slug)}`}
                  className="group flex items-baseline gap-5 py-6 transition-colors hover:text-[var(--surface-accent)] sm:gap-8 sm:py-8"
                >
                  <span className="shrink-0 text-xs tabular-nums text-[var(--surface-muted)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="font-display flex-1 text-[length:var(--text-xl)] transition-transform duration-[var(--duration-state)] ease-[var(--ease-boa)] motion-safe:group-hover:translate-x-1 rtl:motion-safe:group-hover:-translate-x-1">
                    {need.name}
                  </span>
                  {need.tagline ? (
                    <span className="hidden max-w-xs text-sm text-[var(--surface-muted)] sm:block">
                      {need.tagline}
                    </span>
                  ) : null}
                  <IconArrowRight
                    width={18}
                    height={18}
                    className="shrink-0 text-[var(--surface-muted)] transition-colors group-hover:text-[var(--surface-accent)] rtl:-scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
