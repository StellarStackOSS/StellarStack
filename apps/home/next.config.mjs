/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stellarUI"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
}

export default nextConfig
