import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALES, isLocale } from '@/i18n/config';

const PUBLIC_FILE = /\.(?:png|jpe?g|svg|webp|avif|ico|txt|xml|woff2?|css|js|map|webmanifest)$/i;
const LOCALE_COOKIE = 'boa_locale';

/**
 * Two jobs, both cheap enough to run on every request:
 *  1. Put a locale on every storefront URL, remembering the visitor's choice.
 *  2. Set the security headers that must exist before any handler runs.
 *
 * /admin and /api are deliberately outside the locale tree.
 */
function negotiate(request: NextRequest): string {
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  if (remembered && isLocale(remembered)) return remembered;

  const header = request.headers.get('accept-language');
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', q = 'q=1'] = part.trim().split(';');
      return { tag: tag.toLowerCase(), q: Number.parseFloat(q.replace('q=', '')) || 0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0] ?? '';
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Content-Security-Policy with a per-request nonce.
 *
 * Next.js picks the nonce up from the request header and stamps it on its own
 * scripts, so `script-src` needs neither 'unsafe-inline' nor 'unsafe-eval' in
 * production — an injected <script> simply does not execute. `style-src` still
 * allows inline styles: next/font and React's style attributes emit them, and
 * inline CSS is a far weaker vector than inline JS.
 *
 * `strict-dynamic` lets the nonced bootstrap load the chunks it needs without
 * listing every hashed filename. In development the dev overlay and Fast
 * Refresh need eval, so the policy is relaxed there and only there.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

function withSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  const headers = response.headers;
  headers.set('Content-Security-Policy', buildCsp(nonce));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('X-DNS-Prefetch-Control', 'off');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  // Next reads the nonce from the request headers to stamp its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', buildCsp(nonce));
  const forward = { request: { headers: requestHeaders } };

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return withSecurityHeaders(NextResponse.next(forward), nonce);
  }

  const segments = pathname.split('/');
  const first = segments[1] ?? '';

  if (isLocale(first)) {
    const response = withSecurityHeaders(NextResponse.next(forward), nonce);
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
    return response;
  }

  const locale = negotiate(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return withSecurityHeaders(NextResponse.redirect(url), nonce);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

export { LOCALE_COOKIE, LOCALES };
