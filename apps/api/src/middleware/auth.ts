import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { AppError } from "../lib/errors";
import { SESSION_COOKIE, assertSecret, verifySession } from "../lib/tokens";
import { UserService } from "../services/user.service";

/**
 * Resolves the current user from the httpOnly session cookie (browsers) or a Bearer token (scripts/tests).
 * Re-reads the user, roles and permissions from D1 on every request, so deactivation, role changes and
 * logout-all take effect immediately instead of waiting for a token to expire.
 */
export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null);
  const header = c.req.header("authorization");
  const token = getCookie(c, SESSION_COOKIE) ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (token) {
    const claims = await verifySession(token, assertSecret(c.env.JWT_SECRET));
    if (claims) {
      const user = await new UserService(c.get("db")).loadSessionUser(claims.userId);
      if (user && user.isActive && user.tokenVersion === claims.tokenVersion) {
        const { tokenVersion: _tv, ...sessionUser } = user;
        c.set("user", sessionUser);
      }
    }
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) throw AppError.unauthorized();
  await next();
});

/** Deny by default: the route runs only if the user holds this exact permission. */
export function requirePermission(permission: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) throw AppError.unauthorized();
    if (!user.permissions.includes(permission)) throw AppError.forbidden();
    await next();
  });
}

export function requireRole(role: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) throw AppError.unauthorized();
    if (!user.roles.includes(role)) throw AppError.forbidden();
    await next();
  });
}
