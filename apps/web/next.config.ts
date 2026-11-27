import type { NextConfig } from "next";

/**
 * Production: a static export (`out/`) served by the same Cloudflare Worker as the API, so the site and
 * `/api/*` share one origin (first-party session cookie, same-origin WebSockets, one deploy).
 * Development: `next dev` proxies `/api/*` to `wrangler dev` on :8787.
 */
const isDev = process.env.NODE_ENV !== "production";
const API_ORIGIN = (process.env.API_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@np/shared"],
  trailingSlash: false,
  images: { unoptimized: true },
  experimental: { optimizePackageImports: ["@phosphor-icons/react", "recharts"] },
  ...(isDev
    ? {
        // Let teammates open the dev server from another machine on the same network (http://10.x / 192.168.x).
        allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.16.*.*", "172.17.*.*", "172.18.*.*", "172.19.*.*", "172.20.*.*", "*.local"],
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
        },
      }
    : { output: "export" as const }),
};

export default config;
