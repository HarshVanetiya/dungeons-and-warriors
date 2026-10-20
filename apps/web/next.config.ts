import type { NextConfig } from 'next';

// Every /api/* request is forwarded to the game server, so the login cookie stays on this
// site's domain (DEPLOYMENT.md, "Why it's wired this way"). Live matches connect to the
// server directly with NEXT_PUBLIC_SOCKET_URL, because rewrites can't carry WebSockets.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
