import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { loginSchema, registerSchema } from "@np/shared";
import type { AppEnv } from "../env";
import { audit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, assertSecret, signSession } from "../lib/tokens";
import { parseJson } from "../lib/validate";
import { requireAuth } from "../middleware/auth";
import { AuthService } from "../services/auth.service";
import { UserService } from "../services/user.service";

async function rateLimit(c: Context<AppEnv>, email: string) {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const result = await c.env.AUTH_LIMITER?.limit({ key: `${ip}:${email}` });
  if (result && !result.success) throw AppError.tooMany();
}

/** httpOnly: unreadable by JS (XSS can't steal it). SameSite=Lax + Secure: never sent cross-site or over HTTP. */
async function startSession(c: Context<AppEnv>, userId: number, tokenVersion: number) {
  const token = await signSession(userId, tokenVersion, assertSecret(c.env.JWT_SECRET));
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

async function me(c: Context<AppEnv>, userId: number) {
  const user = await new UserService(c.get("db")).loadSessionUser(userId);
  if (!user) throw AppError.unauthorized();
  const { tokenVersion: _tv, ...publicUser } = user;
  return publicUser;
}

export const authRoutes = new Hono<AppEnv>()
  .post("/register", async (c) => {
    const input = await parseJson(c, registerSchema);
    await rateLimit(c, input.email);
    const user = await new AuthService(c.get("db")).register(input);
    await startSession(c, user.id, user.tokenVersion);
    audit(c, "register", "users", user.id, user.id);
    return c.json({ user: await me(c, user.id) }, 201);
  })
  .post("/login", async (c) => {
    const input = await parseJson(c, loginSchema);
    await rateLimit(c, input.email);
    try {
      const user = await new AuthService(c.get("db")).login(input);
      await startSession(c, user.id, user.tokenVersion);
      audit(c, "login", "users", user.id, user.id);
      return c.json({ user: await me(c, user.id) });
    } catch (err) {
      audit(c, "login_failed", "users", null, null);
      throw err;
    }
  })
  .post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
    return c.body(null, 204);
  })
  /** Revokes every session for this user on every device. */
  .post("/logout-all", requireAuth, async (c) => {
    await new UserService(c.get("db")).bumpTokenVersion(c.get("user")!.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
    audit(c, "logout_all", "users", c.get("user")!.id);
    return c.body(null, 204);
  })
  .get("/me", requireAuth, (c) => c.json({ user: c.get("user")! }));
