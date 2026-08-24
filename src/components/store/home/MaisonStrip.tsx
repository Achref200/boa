import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { ButtonLink } from '@/components/ui/Button';
import { MediaFrame } from '@/components/ui/MediaFrame';
import type { ContentBlock } from '@/modules/content/service';

/**
 * The trust moment, and the second ink band of the page.
 *
 * The image runs to the viewport edge while the text keeps a reading measure —
 * the asymmetry is what stops the page reading as a stack of centred sections,
 * and the return to ink re-states the brand surface halfway down the scroll.
 */
export function MaisonStrip({
  locale,
  block,
}: {
  locale: AppLocale;
  block: ContentBlock | undefined;
}) {
  const t = getTranslator(locale);
  if (!block) return null;

  return (
    <section data-surface="ink" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="grid items-stretch lg:grid-cols-2">
        {/* 'auto' rather than a fixed ratio: inside a stretched grid row an
            aspect-ratio would derive the width from the row height and overflow
            into the text column. */}
        <div className="relative min-h-[18rem] lg:min-h-[34rem]">
          <MediaFrame
            path={block.mediaPath}
            alt=""
            ratio="auto"
            sizes="(max-width: 1024px) 100vw, 50vw"
            pendingLabel={t('product.imagePending')}
            expected="2000 × 1333"
            className="absolute inset-0"
          />
        </div>

        <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-16 lg:py-24">
          <p className="lockup text-[var(--surface-accent)]">
            {block.eyebrow ?? t('home.houseEyebrow')}
          </p>
          {block.heading ? (
            <h2 className="font-display mt-6 max-w-md text-[length:var(--text-2xl)]">{block.heading}</h2>
          ) : null}
          {block.body ? (
            <p className="mt-6 max-w-[var(--container-reading)] leading-relaxed text-[var(--surface-muted)]">
              {block.body}
            </p>
          ) : null}
          <div className="mt-10">
            <ButtonLink href={block.ctaHref ?? routes.house(locale)} intent="secondary">
              {block.ctaLabel ?? t('nav.house')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
