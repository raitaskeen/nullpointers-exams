import { Hono } from "hono";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { allResources } from "@np/shared";
import { auditLog, users } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth } from "../middleware/auth";

/**
 * Recent activity for the dashboard feed. Admins (users:read) see everyone's writes; everyone else sees
 * their own. Only resources the viewer can read are included, and auth noise (logins) is left out.
 */
export const activityRoutes = new Hono<AppEnv>().get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const readable = allResources()
    .filter((r) => user.permissions.includes(`${r.name}:read`))
    .map((r) => r.name);
  if (!readable.length) return c.json({ items: [] });

  const rows = await c
    .get("db")
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      at: auditLog.at,
      userName: users.fullName,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(
      and(
        inArray(auditLog.resource, readable),
        notInArray(auditLog.action, ["login", "login_failed", "logout_all"]),
        user.permissions.includes("users:read") ? undefined : eq(auditLog.userId, user.id),
      ),
    )
    .orderBy(desc(auditLog.id))
    .limit(12);

  return c.json({ items: rows });
});
