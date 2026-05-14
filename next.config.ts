import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses (gzip) — Nginx will also do this, but doesn't hurt.
  compress: true,
  // Trust the upstream proxy (Nginx) for forwarded headers in production.
  poweredByHeader: false,
};

export default nextConfig;
