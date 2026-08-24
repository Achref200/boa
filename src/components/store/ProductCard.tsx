import Link from 'next/link';
import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { Price } from '@/components/ui/Price';
import { productSizes } from '@/modules/media/url';
import type { ProductCard as ProductCardData } from '@/modules/catalog/types';
import { cn } from '@/lib/cn';

/**
 * No card chrome: no border, no shadow, no rounded corner, no hover lift. The
 * product photograph is the object and the type sits under it, the way a
 * printed catalogue works. The only motion is a slow scale on the image, which
 * reads as looking closer rather than as a UI effect.
 */
export function ProductCard({
  product,
  locale,
  priority = false,
  size = 'default',
}: {
  product: ProductCardData;
  locale: AppLocale;
  priority?: boolean;
  size?: 'default' | 'feature';
}) {
  const t = getTranslator(locale);
  const soldOut = !product.inStock;

  return (
    <article className="group">
      <Link href={routes.product(locale, product.slug)} className="block focus-visible:outline-offset-4">
        <div className="relative overflow-hidden">
          <MediaFrame
            path={product.image?.path}
            alt={product.image?.alt ?? product.name}
            sizes={size === 'feature' ? '(max-width: 1024px) 92vw, 46vw' : productSizes}
            priority={priority}
            pendingLabel={t('product.imagePending')}
            expected="1200 × 1500"
            className="transition-transform duration-700 ease-[var(--ease-boa)] motion-safe:group-hover:scale-[1.03]"
          />

          {soldOut ? (
            <span className="absolute inset-inline-start-0 top-0 bg-[var(--color-ink)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-bone)]"
              style={{ insetInlineStart: 0 }}>
              {t('product.outOfStock')}
            </span>
          ) : null}

          {product.isProfessional ? (
            <span className="absolute bottom-0 bg-[var(--color-gold)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink)]"
              style={{ insetInlineStart: 0 }}>
              {t('product.professionalOnly')}
            </span>
          ) : null}
        </div>

        <div className={cn('mt-4 flex flex-col gap-1', soldOut && 'opacity-70')}>
          <h3 className={cn('font-display leading-tight', size === 'feature' ? 'text-2xl' : 'text-lg')}>
            <span className="name-rule">{product.name}</span>
          </h3>
          {product.tagline ? (
            <p className="text-sm text-[var(--surface-muted)]">{product.tagline}</p>
          ) : null}
          <Price
            amount={product.priceFrom}
            compareAt={product.compareAtFrom}
            locale={locale}
            fromLabel={product.formatCount > 1 ? t('common.from') : undefined}
            className="mt-1 text-sm"
          />
        </div>
      </Link>
    </article>
  );
}
