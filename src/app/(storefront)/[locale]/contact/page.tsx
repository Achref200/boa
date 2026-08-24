import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getSiteSettings } from '@/modules/content/service';
import { ContactForm } from '@/components/store/ContactForm';
import { SectionSeam } from '@/components/brand/Petals';
import { routes } from '@/lib/routes';

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return { title: t('contact.title'), alternates: { canonical: routes.contact(locale) } };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale);
  const settings = await getSiteSettings();
  const hasDetails = Boolean(settings.contactEmail || settings.contactPhone || settings.addressLine);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <h1 className="font-display text-[length:var(--text-3xl)]">{t('contact.title')}</h1>

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <ContactForm
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

          <aside className="lg:col-span-4 lg:col-start-9">
            {hasDetails ? (
              <address className="not-italic leading-relaxed">
                {settings.addressLine ? <span className="block">{settings.addressLine}</span> : null}
                {settings.city ? <span className="block">{settings.city}</span> : null}
                {settings.contactPhone ? (
                  <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="mt-4 block underline underline-offset-4">
                    {settings.contactPhone}
                  </a>
                ) : null}
                {settings.contactEmail ? (
                  <a href={`mailto:${settings.contactEmail}`} className="block underline underline-offset-4">
                    {settings.contactEmail}
                  </a>
                ) : null}
                {settings.openingHours ? (
                  <span className="mt-4 block text-sm text-[var(--surface-muted)]">
                    {settings.openingHours}
                  </span>
                ) : null}
              </address>
            ) : (
              <p className="text-sm text-[var(--surface-muted)]">{t('footer.detailsPending')}</p>
            )}

            <div className="my-8">
              <SectionSeam />
            </div>

            <p className="text-sm text-[var(--surface-muted)]">
              {t('order.trackHint')}{' '}
              <a href={routes.orderTracking(locale)} className="underline underline-offset-4">
                {t('order.trackTitle')}
              </a>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
