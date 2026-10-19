import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Allow the local IP and localtunnel origins to access dev resources
  // This prevents Next.js from blocking the JS bundles on mobile devices
  allowedDevOrigins: ['192.168.4.x', '192.168.4.79', '192.168.0.x', '*.loca.lt'],
  serverExternalPackages: [],
  output: "standalone",
  // The app doesn't use next/image, so it never needs Next's image optimizer. Turning it off means
  // Next never loads sharp, the library behind it, which the Dockerfile leaves out of the image.
  images: { unoptimized: true },
  // The service worker (public/sw.js) is always checked for a new version, so a fix to it reaches
  // everyone on their next visit rather than whenever the browser's cache lets go of it
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
  experimental: {
    // Reuse a visited page for five minutes on client-side navigation (the default is to refetch
    // every time), so going back and forth between pages is instant, as the bottom tabs, prefetched
    // in full, are (`static`, five minutes by default). Server actions' revalidatePath calls still
    // clear them, so your own changes show up right away, and coming back to the app after a while
    // refreshes them (see ResumeReload).
    staleTimes: {
      dynamic: 300,
    },
  }
};

// With a Sentry auth token at build time (the hosted version's, see fly/README.md), the build
// uploads its source maps to Sentry, so error reports show the original code rather than the
// minified bundles, and then deletes them, so they're never served. Any other build, a self-hosted
// one included, is left as it is. A failed upload only warns: it never fails the build.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      silent: true,
      errorHandler: error => console.warn('Uploading source maps to Sentry failed:', error.message),
    })
  : nextConfig;
