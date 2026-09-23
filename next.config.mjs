/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_URL || 'http://localhost:3000';

const nextConfig = {
  async rewrites() {
    // Proxy API calls to the NestJS backend.
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
};

export default nextConfig;
