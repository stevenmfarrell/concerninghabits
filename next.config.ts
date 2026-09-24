import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the local IP and localtunnel origins to access dev resources
  // This prevents Next.js from blocking the JS bundles on mobile devices
  allowedDevOrigins: ['192.168.4.x', '192.168.4.79', '192.168.0.x', '*.loca.lt'],
  serverExternalPackages: [],
  experimental: {
    // Next 14/15 security blocks cross-origin dev asset requests
  }
};

export default nextConfig;
