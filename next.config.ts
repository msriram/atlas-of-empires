import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.GITHUB_PAGES === "true"
    ? { output: "export", basePath: "/atlas-of-empires", trailingSlash: true }
    : {}),
};

export default nextConfig;
