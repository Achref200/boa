import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { LOCALE_META, LOCALES, isLocale, type AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { display, plexArabic, text } from '@/lib/fonts';
import { env } from '@/lib/env';
import { SiteHeader } from '@/components/store/SiteHeader';
import { SiteFooter } from '@/components/store/SiteFooter';
import { ToastRegion } from '@/components/ui/Toast';
import { CartProvider } from '@/components/store/CartProvider';
import { getCartSummary } from '@/modules/cart/service';
import { getNavigation } from '@/modules/catalog/service';
import { getActiveAnnouncement } from '@/modules/content/service';
import '@/styles/globals.css';

export const viewport: Viewport = {
  themeColor: '#27282a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: {
      default: `${t('common.brand')} — ${t('home.openingTagline')}`,
      template: `%s — ${t('common.brand')}`,
    },
    description: t('home.openingTagline'),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].htmlLang, `/${l}`])),
    },
    openGraph: {
      type: 'website',
      siteName: t('common.brand'),
      locale: LOCALE_META[locale].htmlLang.replace('-', '_'),
      url: `/${locale}`,
      // Without this every non-product share — the homepage, the catalogue, a
      // ritual, the contact page — renders as a blank card. The mark needs its
      // ink ground, so the card is ink; see scripts/brand-og.ts.
      images: [{ url: `/brand/og-${locale}.png`, width: 1200, height: 630, alt: t('common.brand') }],
    },
    twitter: { card: 'summary_large_image' },
    icons: {
      icon: [{ url: '/brand/icon-32.png', sizes: '32x32' }, { url: '/brand/icon-192.png', sizes: '192x192' }],
      apple: '/brand/icon-180.png',
    },
    robots: { index: true, follow: true },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: AppLocale = raw;
  const { dir, htmlLang } = LOCALE_META[locale];
  const t = getTranslator(locale);

  const [navigation, cart, announcement] = await Promise.all([
    getNavigation(locale),
    getCartSummary(),
    getActiveAnnouncement(locale),
  ]);

  return (
    <html
      lang={htmlLang}
      dir={dir}
      className={`${display.variable} ${text.variable} ${plexArabic.variable}`}
      suppressHydrationWarning
    >
      <body data-surface="paper">
        <a href="#main" className="visually-hidden focus:not-sr-only">
          {t('common.skipToContent')}
        </a>
        <CartProvider initialCount={cart.itemCount}>
          <SiteHeader locale={locale} navigation={navigation} announcement={announcement} />
          <main id="main">{children}</main>
          <SiteFooter locale={locale} navigation={navigation} />
          <ToastRegion />
        </CartProvider>
      </body>
    </html>
  );
}
