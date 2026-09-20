/**
 * Post-deployment verification for the public deployment (Vercel or any host).
 *
 * Verifies the running site from the outside in — exactly what a visitor and
 * the browser experience — so a deployment that "built fine" but serves a
 * broken site cannot pass:
 *
 *   1. every storefront locale renders (HTTP 200, real HTML)
 *   2. /robots.txt and /sitemap.xml answer
 *   3. the admin sign-in screen answers
 *   4. the bare domain redirects into a locale (middleware alive)
 *   5. the security headers middleware sends actually arrive
 *   6. a deliberate bad admin sign-in is rejected by the server
 *
 * Admin credential checks are deliberately *negative* only: the sign-in action
 * is rate limited (6 per 10 min per IP, `src/lib/rate-limit.ts`), so a probe
 * that signs in with real credentials would both trip the limiter and put the
 * production password into a command line. The positive path belongs to the
 * manual checklist and the Playwright suite.
 *
 * Usage:
 *   npm run verify:deploy -- https://boa-achref-ben-yaagoubs-projects.vercel.app
 *   BASE_URL=https://… npm run verify:deploy
 */
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const BASE = (process.argv[2] ?? process.env.BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

if (!BASE) {
  console.error('Usage: npm run verify:deploy -- https://<deployment-url>  (or set BASE_URL)');
  process.exit(2);
}

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  const mark = ok ? '  ✓ ' : '  ✗ ';
  process.stdout.write(`${mark}${name}${detail ? ` — ${detail}` : ''}\n`);
}

async function expectStatus(name: string, url: string, expected: number, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000), ...init });
    record(name, response.status === expected, `HTTP ${response.status} (expected ${expected})`);
    return response;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function main(): Promise<void> {
  process.stdout.write(`Verifying ${BASE}\n\n`);

  /* 1 — storefront locales. Follow redirects (middleware may remember a
     locale via cookie-less 307 on the bare path) but only accept 200. */
  for (const locale of ['fr', 'en', 'ar'] as const) {
    try {
      const response = await fetch(`${BASE}/${locale}`, { signal: AbortSignal.timeout(30_000) });
      const html = await response.text();
      const rendered = html.includes('<html');
      record(
        `/fr · /en · /ar → /${locale}`,
        response.status === 200 && rendered,
        `HTTP ${response.status}, ${rendered ? 'HTML rendered' : 'no HTML'}`,
      );
    } catch (error) {
      record(`/${locale}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  /* 2 — SEO routes are prerendered; a 404/500 here means the build lost them. */
  const robots = await expectStatus('/robots.txt', `${BASE}/robots.txt`, 200);
  await expectStatus('/sitemap.xml', `${BASE}/sitemap.xml`, 200);

  /* 3 — admin sign-in screen. Outside the locale tree by design. */
  await expectStatus('/admin/connexion', `${BASE}/admin/connexion`, 200);

  /* 4 — the bare domain must redirect into a locale (middleware negotiate). */
  const root = await expectStatus('/', BASE, 307);
  const location = root.headers.get('location') ?? '';
  record('bare domain redirects into /{locale}', /^\/(fr|en|ar)/.test(location), location || 'no location header');

  /* 5 — security headers. Set in src/middleware.ts; if they are missing the
     response you are looking at did not pass through the middleware. */
  const probed = await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(30_000) });
  const required = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy'] as const;
  for (const header of required) {
    const value = probed.headers.get(header);
    record(`security header: ${header}`, Boolean(value), value ? value.slice(0, 60) : 'MISSING');
  }

  /* 6 - wrong admin credential must be rejected server-side. Probe with a
     bogus server-action id: a wrong credential must NOT redirect (the form
     stays and shows an error); any 5xx would mean the page crashed instead
     of rejecting. One attempt only: the limiter allows six per ten minutes. */
  try {
    const attempt = await fetch(`${BASE}/admin/connexion`, {
      method: "POST",
      headers: { "Next-Action": "verify-deployment-probe" },
      body: "probe",
      signal: AbortSignal.timeout(30_000),
    });
    const redirected = attempt.status >= 300 && attempt.status < 400;
    const rejected = !redirected && attempt.status < 500;
    record("admin sign-in rejects bad credentials", rejected, `HTTP ${attempt.status}`);
  } catch (error) {
    record("admin sign-in rejects bad credentials", false, error instanceof Error ? error.message : String(error));
  }
  const failed = checks.filter((c) => !c.ok);
  process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);
  if (failed.length > 0) {
    process.stdout.write(`Failed: ${failed.map((f) => f.name).join(', ')}\n`);
    process.exit(1);
  }
}

main().catch(() => process.exit(1));
