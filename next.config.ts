import type { NextConfig } from "next";

const localTracingRoot = process.env.NEXT_OUTPUT_FILE_TRACING_ROOT?.trim();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  ...(localTracingRoot
    ? {
        outputFileTracingRoot: localTracingRoot,
        turbopack: { root: localTracingRoot },
      }
    : {}),
};

export default nextConfig;
