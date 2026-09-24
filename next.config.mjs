/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_URL || 'http://localhost:3000';

// Security headers for every page. Deliberately no script-src/style-src CSP:
// the App Router hydrates through inline scripts, so a script policy that
// works needs per-request nonces (dynamic rendering on every page), and one
// with 'unsafe-inline' stops nothing. What is here is the part that can't
// break the app: no framing (clickjacking), no plugins, no <base> hijack.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Browsers ignore this over plain http, so it is harmless on localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    // Proxy API calls to the NestJS backend.
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
};

export default nextConfig;
