import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getNeeds, getProducts } from '@/modules/catalog/service';
import type { ProductQuery, ProductSort } from '@/modules/catalog/types';
import { ProductCard } from './ProductCard';
import { CatalogueFilters } from './CatalogueFilters';
import { Pagination } from '@/components/ui/Pagination';
import { Petals } from '@/components/brand/Petals';

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORTS: ProductSort[] = ['relevance', 'newest', 'price_asc', 'price_desc'];

/**
 * Turns untrusted query strings into a typed, bounded query. Anything the
 * parser does not recognise is dropped rather than passed through — a hand-made
 * `?tri=;DROP` never reaches the database layer, and `?page=99999` becomes a
 * real page number instead of an enormous OFFSET.
 */
export function parseCatalogueParams(params: RawSearchParams): ProductQuery {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const many = (key: string): string[] => {
    const value = params[key];
    if (Array.isArray(value)) return value.filter(Boolean).slice(0, 8);
    return value ? [value] : [];
  };

  const sortParam = single('tri');
  const pageParam = Number.parseInt(single('page') ?? '1', 10);

  return {
    needSlugs: many('besoin'),
    search: single('q')?.slice(0, 80),
    inStockOnly: single('stock') === '1',
    sort: SORTS.includes(sortParam as ProductSort) ? (sortParam as ProductSort) : 'relevance',
    page: Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, 500) : 1,
  };
}

export async function CatalogueView({
  locale,
  query,
  basePath,
  searchParams,
  title,
  intro,
}: {
  locale: AppLocale;
  query: ProductQuery;
  basePath: string;
  searchParams: RawSearchParams;
  title: string;
  intro?: string | null;
}) {
  const t = getTranslator(locale);
  const [result, needs] = await Promise.all([getProducts(locale, query), getNeeds(locale)]);

  const hrefFor = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page') continue;
      if (Array.isArray(value)) value.forEach((entry) => next.append(key, entry));
      else if (value) next.set(key, value);
    }
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <header className="max-w-[var(--container-reading)]">
          <h1 className="font-display text-[length:var(--text-3xl)]">{title}</h1>
          {intro ? (
            <p className="mt-5 leading-relaxed text-[var(--surface-muted)]">{intro}</p>
          ) : null}
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <CatalogueFilters
              needs={needs}
              resultCount={t('shop.resultCount', { count: result.total })}
              labels={{
                filters: t('shop.filters'),
                clear: t('shop.clearFilters'),
                apply: t('shop.applyFilters'),
                close: t('common.close'),
                sort: t('shop.sort'),
                sortRelevance: t('shop.sortRelevance'),
                sortNewest: t('shop.sortNewest'),
                sortPriceAsc: t('shop.sortPriceAsc'),
                sortPriceDesc: t('shop.sortPriceDesc'),
                availability: t('shop.availability'),
                inStockOnly: t('shop.inStockOnly'),
                search: t('common.search'),
                searchPlaceholder: t('common.searchPlaceholder'),
                needsTitle: t('home.needsEyebrow'),
              }}
            />
          </aside>

          <div>
            <p className="hidden pb-6 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] lg:block">
              {t('shop.resultCount', { count: result.total })}
            </p>

            {result.items.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-md border border-[var(--surface-line)] px-6 py-24 text-center">
                <Petals size={32} className="text-[var(--surface-accent)]" />
                <p className="font-display text-xl">{t('shop.noResults')}</p>
                <p className="max-w-sm text-sm text-[var(--surface-muted)]">{t('shop.noResultsHint')}</p>
              </div>
            ) : (
              <ul className="catalogue-grid grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
                {result.items.map((product, index) => (
                  <li key={product.id}>
                    <ProductCard product={product} locale={locale} priority={index < 3} />
                  </li>
                ))}
              </ul>
            )}

            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={hrefFor}
              labels={{
                previous: t('common.back'),
                next: t('common.continue'),
                nav: t('shop.title'),
                page: t('shop.title'),
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
