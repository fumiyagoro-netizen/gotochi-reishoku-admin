import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
