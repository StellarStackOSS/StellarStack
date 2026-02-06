import { execSync } from "child_process";

const getGitCommitHash = () => {
  if (
    process.env.NEXT_PUBLIC_GIT_COMMIT_HASH &&
    process.env.NEXT_PUBLIC_GIT_COMMIT_HASH !== "unknown"
  ) {
    return process.env.NEXT_PUBLIC_GIT_COMMIT_HASH;
  }
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: false,
  transpilePackages: ["@stellarUI"],
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_GIT_COMMIT_HASH: getGitCommitHash(),
    NEXT_PUBLIC_API_URL: "http://localhost:3001",
    NEXT_PUBLIC_DESKTOP_MODE: "true",
  },
};

export default nextConfig;
