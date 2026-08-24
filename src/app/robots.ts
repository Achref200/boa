import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/**
 * The operations application, the account area and everything that only makes
 * sense with a session are excluded. `/api` is excluded too: it holds webhooks
 * and media, never content worth indexing.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/*/panier',
          '/*/commande',
          '/*/suivi',
          '/*/compte',
          '/*/connexion',
          '/*/inscription',
          '/*/reservation/',
          '/*/reserver/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
