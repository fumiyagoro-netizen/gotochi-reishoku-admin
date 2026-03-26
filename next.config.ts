import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "app.qubo.jp",
      },
      {
        protocol: "https",
        hostname: "backend.qubo.jp",
      },
    ],
  },
};

export default nextConfig;
