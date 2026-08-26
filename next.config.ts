import type { NextConfig } from 'next';

/**
 * Hostinger note: the app is served by `next start` behind Hostinger's proxy.
 * `output: 'standalone'` keeps the deployable bundle small enough for a shared
 * Node container and avoids shipping the full node_modules tree.
 */
const config: NextConfig = {
  output: 'standalone',
  /* Without this, a second package-lock.json higher up the tree makes Next infer
     C:UsersTeam_2 as the workspace root and emit the server at
     .next/standalone/<nested path>/server.js — where build:standalone's copies
     of public/ and .next/static never reach it, so the served page loads no
     JavaScript and forms fall back to a native GET submit. */
  outputFileTracingRoot: process.cwd(),
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Media is served from the local /uploads route in v1 (see src/lib/media).
    // Remote patterns stay empty until an object-storage provider is configured.
    remotePatterns: [],
    formats: ['image/avif', 'image/webp'],
    /* The storefront's widest real image box is the 1440px maison band; the
       narrowest is an 80px gallery thumbnail. Next's defaults span 16px→3840px
       and it generates every candidate a `sizes` string can reach, so trimming
       the ends removes optimiser work and disk in `.next/cache` that no layout
       can request. 2048 covers a 1024px box on a 2× screen. */
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1440, 1920, 2048],
    /* Must cover every fixed-px `sizes` in the codebase and its 2× retina step:
       56 and 64 (cart / order lines), 80 (gallery rail), 96 (admin). Dropping a
       width a `sizes` string names makes Next round *up* to the next candidate
       and ship a needlessly large thumbnail. */
    imageSizes: [56, 64, 80, 96, 128, 160, 192, 256, 384],
    /* Reserves and uploads are content-hashed (`storage.ts`), so a given URL is
       immutable. Without this the optimiser re-encodes on its own 60s default. */
    minimumCacheTTL: 31536000,
  },
  /**
   * `/uploads/*` filenames are a sha256 of the bytes, so a URL can never change
   * meaning — a replaced photograph is a new path. That makes it safe to cache
   * immutably, which is what stops a returning visitor refetching the whole
   * catalogue. Next already sends this for `_next/image` and `_next/static`;
   * the raw files it serves from `public/` get nothing by default.
   */
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['@/components'],
  },
};

export default config;
