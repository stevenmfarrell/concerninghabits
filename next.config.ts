import type { NextConfig } from "next";

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

export default nextConfig;
