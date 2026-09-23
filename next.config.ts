import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ekt.kz", pathname: "/upload/**" },
    ],
  },
};

export default nextConfig;
