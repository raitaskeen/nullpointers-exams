import type { Bindings } from "../env";

/** WEB_ORIGINS is a comma-separated allowlist, e.g. "https://np.vercel.app,http://localhost:3000". */
export function allowedOrigins(env: Pick<Bindings, "WEB_ORIGINS">): string[] {
  return (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}
