import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow images from external domains (placeholder avatars in dev)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
