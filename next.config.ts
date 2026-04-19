import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["@react-pdf/renderer", "geo-tz", "pg"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "maps.googleapis.com", pathname: "/**" },
    ],
  },
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
