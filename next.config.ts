import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the local IP and localtunnel origins to access dev resources
  // This prevents Next.js from blocking the JS bundles on mobile devices
  allowedDevOrigins: ['192.168.4.x', '192.168.4.79', '192.168.0.x', '*.loca.lt'],
  serverExternalPackages: [],
  output: "standalone",
  experimental: {
    // Reuse a visited page for 30s on client-side navigation (the default is to refetch every
    // time), so going back and forth between pages is instant. Server actions' revalidatePath
    // calls still clear it, so your own changes show up right away.
    staleTimes: {
      dynamic: 30,
    },
  }
};

export default nextConfig;
