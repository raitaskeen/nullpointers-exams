import type { Context } from "hono";
import { auditLog } from "../db/schema";
import type { AppEnv } from "../env";

/** Records an audit entry after the response is sent, so it never slows a request down. */
export function audit(c: Context<AppEnv>, action: string, resource: string, resourceId?: number | null, userId?: number | null) {
  const db = c.get("db");
  const entry = {
    action,
    resource,
    resourceId: resourceId ?? null,
    userId: userId ?? c.get("user")?.id ?? null,
    ip: c.req.header("cf-connecting-ip") ?? null,
  };
  const write = db
    .insert(auditLog)
    .values(entry)
    .run()
    .catch((err: unknown) => console.error("audit write failed", err));
  try {
    c.executionCtx.waitUntil(write);
  } catch {
    // No execution context (unit tests) - the promise still runs.
  }
}
