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
  },
  experimental: {
    optimizePackageImports: ['@/components'],
  },
};

export default config;
