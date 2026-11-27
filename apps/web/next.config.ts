import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/*` is proxied to the Cloudflare Worker, so the
 * session cookie is first-party and there is no CORS. WebSockets go straight to the Worker (Vercel can't
 * proxy them) using a short-lived ticket - see apps/api/src/routes/realtime.ts.
 *   Local:      API_ORIGIN unset -> http://127.0.0.1:8787 (wrangler dev)
 *   Production: API_ORIGIN = https://nullpointers-api.<account>.workers.dev  (Vercel env var)
 */
const API_ORIGIN = (process.env.API_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Locks down framing, plugins, <base> and form targets without breaking Next's inline bootstrap scripts.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@np/shared"],
  typedRoutes: false,
  experimental: { optimizePackageImports: ["@phosphor-icons/react", "recharts"] },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
