import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browsers that probe /favicon.ico get the pot icon too.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icons/32" }];
  },
};

export default nextConfig;
