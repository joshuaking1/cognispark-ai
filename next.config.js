/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning instead of error during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignoring TypeScript errors during build
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;