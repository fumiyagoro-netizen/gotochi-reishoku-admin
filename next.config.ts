import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Neon serverless driver + ws out of the webpack bundle; they have
  // native/optional deps that break when bundled and must be loaded at runtime.
  serverExternalPackages: ["@prisma/adapter-neon", "@neondatabase/serverless", "ws"],
  async headers() {
    return [
      {
        // Allow /entry and /results pages to be embedded in iframes from gotouchireisyoku.com
        source: "/entry/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://gotouchireisyoku.com",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://gotouchireisyoku.com https://*.gotouchireisyoku.com",
          },
        ],
      },
      {
        source: "/results/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://gotouchireisyoku.com",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://gotouchireisyoku.com https://*.gotouchireisyoku.com",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
