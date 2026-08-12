import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/arb/:path*',
        destination: 'http://arb.vyronx.io:3001/:path*',
      },
    ];
  },
};

export default nextConfig;
