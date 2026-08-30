import type { NextConfig } from "next";

const config: NextConfig = {
  // The workspace packages ship TypeScript source rather than a build step, so
  // Next has to compile them alongside the app.
  transpilePackages: ["@shipshape/core", "@shipshape/db", "@shipshape/ui"],
  experimental: {
    // Server actions carry board drags and assessment writes; the default 1MB
    // body limit is far more than either needs.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default config;
