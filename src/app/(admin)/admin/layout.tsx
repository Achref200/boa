import type { Metadata, Viewport } from 'next';
import { display, text } from '@/lib/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'Administration BOA', template: '%s — Administration BOA' },
  // The operations application must never appear in a search index.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: '#27282a',
  width: 'device-width',
  initialScale: 1,
};

/**
 * The admin is a second root layout, outside the locale tree.
 *
 * It shares BOA's tokens and primitives — the same square corners, the same
 * type, the same surface contexts — so the two applications feel like one
 * product, but it has its own chrome, its own session cookie and no storefront
 * navigation. Its interface language is French, which is what BOA's team works
 * in; the *content* it edits is translated into all three locales.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <body data-surface="paper" className="min-h-dvh bg-[var(--surface-sunken)]">
        {children}
      </body>
    </html>
  );
}
