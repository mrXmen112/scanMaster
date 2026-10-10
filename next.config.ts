import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Capacitor APK needs a fully static bundle in `out/` (webDir: 'out').
  // The hosted web build keeps the standalone server for its API routes.
  // `scripts/build-apk.js` sets NEXT_BUILD_MODE=export to select export mode.
  output: process.env.NEXT_BUILD_MODE === "export" ? "export" : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
