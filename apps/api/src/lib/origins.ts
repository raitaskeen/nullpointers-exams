import type { Context } from "hono";
import type { Bindings } from "../env";

/** WEB_ORIGINS is a comma-separated allowlist of extra browser origins (e.g. a local dev server). */
export function allowedOrigins(env: Pick<Bindings, "WEB_ORIGINS">): string[] {
  return (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/** The site and API share one origin in production, so the Worker's own origin is always trusted. */
export function isAllowedOrigin(c: Context, origin: string | undefined): boolean {
  if (!origin) return false;
  return origin === new URL(c.req.url).origin || allowedOrigins(c.env as Bindings).includes(origin);
}
