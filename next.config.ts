import type { NextConfig } from "next";
import path from "node:path";

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const repoName = "Sync";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: isGitHubPagesBuild ? `/${repoName}` : "",
  assetPrefix: isGitHubPagesBuild ? `/${repoName}/` : ""
};

export default nextConfig;
