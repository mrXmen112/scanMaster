import type { NextConfig } from "next";

// Detect APK/Capacitor build mode
// Set NEXT_BUILD_MODE=export when building for Capacitor APK
const isExportMode = process.env.NEXT_BUILD_MODE === 'export';

const nextConfig: NextConfig = {
  // 'export' for Capacitor APK (static files, no server needed)
  // 'standalone' for server deployment (InsForge platform)
  output: isExportMode ? "export" : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai"],
  // Static export doesn't support image optimization
  ...(isExportMode ? { images: { unoptimized: true } } : {}),
};

export default nextConfig;
