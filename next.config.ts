import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Neon serverless driver + ws out of the webpack bundle; they have
  // native/optional deps that break when bundled and must be loaded at runtime.
  serverExternalPackages: ["@prisma/adapter-neon", "@neondatabase/serverless", "ws"],
  // /api/invoices/[id]/pdf reads assets/fonts/NotoSansJP-Regular.ttf from disk
  // at request time via fs.readFileSync(path.join(process.cwd(), "assets",
  // "fonts", ...)) — see src/lib/invoice-pdf.ts. That path is statically
  // analyzable so Next's build-time file tracing should already pick it up,
  // but the font is several MB and this route is the one place it's needed,
  // so it's pinned explicitly rather than relying solely on the automatic
  // trace to avoid a silent ENOENT in the deployed function if detection
  // ever misses it.
  outputFileTracingIncludes: {
    "/api/invoices/[id]/pdf": ["./assets/fonts/NotoSansJP-Regular.ttf"],
  },
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
