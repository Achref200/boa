import Link from 'next/link';
import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { Logo } from '@/components/brand/Logo';
import { Petals } from '@/components/brand/Petals';
import { getSiteSettings } from '@/modules/content/service';
import type { Navigation } from '@/modules/catalog/types';

/**
 * Company details come from the `settings` table. Anything BOA has not filled in
 * is simply absent — no placeholder address, no invented phone number, and a
 * quiet line telling an administrator where to complete it.
 */
export async function SiteFooter({ locale, navigation }: { locale: AppLocale; navigation: Navigation }) {
  const t = getTranslator(locale);
  const settings = await getSiteSettings();
  const hasContact = Boolean(settings.contactEmail || settings.contactPhone || settings.addressLine);

  const columns = [
    {
      title: t('footer.navigation'),
      links: [
        { href: routes.shop(locale), label: t('nav.shop') },
        { href: routes.rituals(locale), label: t('nav.rituals') },
        { href: routes.services(locale), label: t('nav.services') },
        { href: routes.professionals(locale), label: t('nav.professionals') },
      ],
    },
    {
      title: t('footer.help'),
      links: [
        { href: routes.orderTracking(locale), label: t('order.trackTitle') },
        { href: routes.contact(locale), label: t('nav.contact') },
        { href: routes.account(locale), label: t('nav.account') },
      ],
    },
    {
      title: t('nav.shop'),
      links: navigation.categories.slice(0, 4).map((category) => ({
        href: routes.category(locale, category.slug),
        label: category.name,
      })),
    },
  ].filter((column) => column.links.length > 0);

  return (
    <footer data-surface="ink" className="bg-[var(--color-ink-sunken)] text-[var(--surface-fg)]">
      <div className="container-page py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-16">
          <div className="flex flex-col gap-5">
            <Logo size={64} className="h-16 w-16" />
            <p className="max-w-xs text-sm leading-relaxed text-[var(--surface-muted)]">
              {t('home.openingTagline')}
            </p>

            {hasContact ? (
              <address className="not-italic text-sm leading-relaxed text-[var(--surface-muted)]">
                {settings.addressLine ? <span className="block">{settings.addressLine}</span> : null}
                {settings.city ? <span className="block">{settings.city}</span> : null}
                {settings.contactPhone ? (
                  <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="block hover:text-[var(--surface-fg)]">
                    {settings.contactPhone}
                  </a>
                ) : null}
                {settings.contactEmail ? (
                  <a href={`mailto:${settings.contactEmail}`} className="block hover:text-[var(--surface-fg)]">
                    {settings.contactEmail}
                  </a>
                ) : null}
              </address>
            ) : (
              <p className="text-xs text-[var(--surface-muted)]">{t('footer.detailsPending')}</p>
            )}
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="lockup mb-5 text-[var(--surface-accent)]">{column.title}</h2>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-[var(--surface-muted)] hover:text-[var(--surface-fg)]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-[var(--surface-line)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--surface-muted)]">
            {t('footer.rights', { year: new Date().getFullYear() })}
          </p>

          <div className="flex items-center gap-6">
            {settings.instagramUrl ? (
              <a href={settings.instagramUrl} rel="noreferrer noopener" target="_blank" className="text-xs uppercase tracking-[0.14em] text-[var(--surface-muted)] hover:text-[var(--surface-fg)]">
                Instagram
              </a>
            ) : null}
            {settings.facebookUrl ? (
              <a href={settings.facebookUrl} rel="noreferrer noopener" target="_blank" className="text-xs uppercase tracking-[0.14em] text-[var(--surface-muted)] hover:text-[var(--surface-fg)]">
                Facebook
              </a>
            ) : null}
            <Petals size={20} className="text-[var(--surface-accent)]" />
          </div>
        </div>
      </div>
    </footer>
  );
}
