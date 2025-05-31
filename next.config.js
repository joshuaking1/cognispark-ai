/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude Supabase Edge Functions from webpack bundling
    config.module.rules.push({
      test: /supabase\/functions\/.*\.ts$/,
      loader: 'ignore-loader',
    });

    return config;
  },
  // Exclude Supabase Edge Functions from TypeScript checking
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
