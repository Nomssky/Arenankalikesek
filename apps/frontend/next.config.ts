import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arenankalikesek.com',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['@repo/backend'],
}

export default nextConfig
