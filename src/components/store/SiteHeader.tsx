import Link from 'next/link';
import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { Logo } from '@/components/brand/Logo';
import { IconSearch, IconUser } from '@/components/ui/icons';
import { CartButton } from './HeaderActions';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileNav, type NavLink } from './MobileNav';
import type { Navigation } from '@/modules/catalog/types';
import type { Announcement } from '@/modules/content/service';

/**
 * The header is always ink.
 *
 * That is a consequence of the mark, not a style preference: BOA's logo is
 * drawn on a charcoal ground and its "COSMETIC" line is white, so it cannot be
 * placed on a pale surface without being altered — and altering it is out of
 * bounds. Making the masthead a permanent ink band turns that constraint into
 * the site's strongest architectural gesture.
 */
export function SiteHeader({
  locale,
  navigation,
  announcement,
}: {
  locale: AppLocale;
  navigation: Navigation;
  announcement: Announcement;
}) {
  const t = getTranslator(locale);

  const categoryLinks: NavLink[] = navigation.categories.map((category) => ({
    href: routes.category(locale, category.slug),
    label: category.name,
    children: category.children.map((child) => ({
      href: routes.category(locale, child.slug),
      label: child.name,
    })),
  }));

  const primary: NavLink[] = [
    { href: routes.shop(locale), label: t('nav.shop'), children: categoryLinks },
    { href: routes.rituals(locale), label: t('nav.rituals') },
    { href: routes.services(locale), label: t('nav.services') },
    { href: routes.house(locale), label: t('nav.house') },
  ];

  return (
    <header data-surface="ink" className="sticky top-0 z-[var(--z-header)] bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      {announcement ? (
        <div className="border-b border-[var(--surface-line)] bg-[var(--color-ink-sunken)]">
          <div className="container-page flex min-h-9 items-center justify-center py-1.5 text-center">
            {announcement.href ? (
              <Link href={announcement.href} className="lockup text-[var(--color-gold-light)] hover:underline">
                {announcement.message}
              </Link>
            ) : (
              <p className="lockup text-[var(--color-gold-light)]">{announcement.message}</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="container-page flex items-center gap-4 py-3 lg:py-4">
        <MobileNav links={primary} label={t('common.menu')} closeLabel={t('common.close')} />

        <Link
          href={routes.home(locale)}
          className="shrink-0"
          aria-label={t('common.brand')}
        >
          <Logo size={48} priority className="h-11 w-11 lg:h-12 lg:w-12" />
        </Link>

        <nav aria-label={t('common.menu')} className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-8">
            {primary.map((link) => (
              <li key={link.href} className="group relative">
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-xs uppercase tracking-[0.16em] text-[var(--surface-fg)] transition-colors hover:text-[var(--surface-accent)]"
                >
                  {link.label}
                </Link>

                {link.children && link.children.length > 0 ? (
                  <div className="invisible absolute start-0 top-full z-10 min-w-56 rounded-md border border-[var(--surface-line)] bg-[var(--color-ink-raised)] p-2 opacity-0 shadow-[var(--shadow-overlay)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <ul>
                      {link.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="block px-3 py-2 text-sm text-[var(--surface-muted)] hover:bg-[var(--color-ink)] hover:text-[var(--surface-fg)]"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1 lg:gap-2">
          <div className="hidden lg:block">
            <LocaleSwitcher current={locale} label={t('common.language')} />
          </div>
          <Link
            href={routes.shop(locale)}
            aria-label={t('common.search')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--surface-fg)] hover:text-[var(--surface-accent)]"
          >
            <IconSearch />
          </Link>
          <Link
            href={routes.account(locale)}
            aria-label={t('nav.account')}
            className="hidden min-h-11 min-w-11 items-center justify-center text-[var(--surface-fg)] hover:text-[var(--surface-accent)] sm:inline-flex"
          >
            <IconUser />
          </Link>
          <CartButton
            href={routes.cart(locale)}
            label={t('nav.cart')}
            countLabel={t('nav.cartCount', { count: '{count}' })}
          />
        </div>
      </div>

      <div className="rule-gold" />
    </header>
  );
}
