import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getProducts } from '@/modules/catalog/service';
import { ProductCard } from '@/components/store/ProductCard';
import { ContactForm } from '@/components/store/ContactForm';
import { SectionSeam } from '@/components/brand/Petals';
import { routes } from '@/lib/routes';

export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return { title: t('contact.professionalTitle'), alternates: { canonical: routes.professionals(locale) } };
}

/**
 * The salon channel.
 *
 * BOA sells a 1 L protein pack, which is not a retail format — that single fact
 * is what this page is built on. It lists the professional formats (hidden from
 * the public catalogue) and gives a salon a way to open an account, rather than
 * inventing a wholesale price list BOA has not published.
 */
export default async function ProfessionalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale);
  const professional = await getProducts(locale, {
    includeProfessional: true,
    perPage: 12,
    sort: 'relevance',
  });
  const items = professional.items.filter((product) => product.isProfessional);

  return (
    <article>
      <section data-surface="ink" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
        <div className="container-page py-16 lg:py-24">
          <p className="lockup text-[var(--surface-accent)]">{t('nav.professionals')}</p>
          <h1 className="font-display mt-8 max-w-3xl text-[length:var(--text-3xl)]">
            {t('contact.professionalTitle')}
          </h1>
          <p className="mt-6 max-w-[var(--container-reading)] leading-relaxed text-[var(--surface-muted)]">
            {t('product.professionalOnly')} — {t('home.openingTagline')}
          </p>
        </div>
      </section>

      {items.length > 0 ? (
        <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
          <div className="container-page py-[var(--spacing-section)]">
            <h2 className="font-display text-[length:var(--text-xl)]">{t('shop.format')}</h2>
            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4 lg:gap-8">
              {items.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section data-surface="paper" className="bg-[var(--surface-sunken)] text-[var(--surface-fg)]">
        <div className="container-page py-[var(--spacing-section)]">
          <SectionSeam className="mb-14" />
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <h2 className="font-display text-[length:var(--text-xl)]">{t('nav.contact')}</h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--surface-muted)]">
                {t('order.whatNext')}
              </p>
            </div>
            <div className="lg:col-span-8">
              <ContactForm
                kind="PROFESSIONAL"
                labels={{
                  name: t('contact.name'),
                  email: t('checkout.email'),
                  phone: t('checkout.phone'),
                  company: t('contact.company'),
                  subject: t('contact.subject'),
                  message: t('contact.message'),
                  send: t('contact.send'),
                  sent: t('contact.sent'),
                  optional: t('common.optional'),
                  generic: t('errors.generic'),
                  validation: t('errors.validation'),
                  rateLimited: t('errors.rateLimited'),
                  fieldInvalid: t('errors.fieldInvalid'),
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
