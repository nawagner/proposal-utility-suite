import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["duckdb"],
  webpack: (config) => {
    if (!config.externals) {
      config.externals = [];
    }

    config.externals.push("duckdb");
    return config;
  },
};

export default nextConfig;
