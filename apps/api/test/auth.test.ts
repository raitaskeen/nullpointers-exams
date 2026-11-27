import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { ADMIN, USER, call, login, registerFresh } from "./helpers/client";

describe("health", () => {
  it("reports ok with a working database", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ status: "ok", db: "ok" });
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("Passw0rd1");
    const b = await hashPassword("Passw0rd1");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Passw0rd1", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("auth", () => {
  it("registers, sets a hardened session cookie, and returns the user", async () => {
    const email = `reg${Date.now()}@test.dev`;
    const res = await call("/api/auth/register", { method: "POST", json: { fullName: "New Person", email, password: "Passw0rd1" } });
    expect(res.status).toBe(201);
    expect(res.data.user).toMatchObject({ email, roles: ["candidate"] });
    expect(res.data.user.passwordHash).toBeUndefined();
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("returns field errors for invalid registration", async () => {
    const res = await call("/api/auth/register", { method: "POST", json: { fullName: "", email: "nope", password: "short" } });
    expect(res.status).toBe(422);
    expect(Object.keys(res.data.error.fields).sort()).toEqual(["email", "fullName", "password"]);
  });

  it("rejects duplicate emails case-insensitively", async () => {
    const { email } = await registerFresh();
    const res = await call("/api/auth/register", {
      method: "POST",
      json: { fullName: "Dup", email: email.toUpperCase(), password: "Passw0rd1" },
    });
    expect(res.status).toBe(409);
    expect(res.data.error.fields.email).toBeTruthy();
  });

  it("gives the same error for unknown email and wrong password", async () => {
    const a = await call("/api/auth/login", { method: "POST", json: { email: "nobody@test.dev", password: "Passw0rd1" } });
    const b = await call("/api/auth/login", { method: "POST", json: { email: ADMIN.email, password: "Wrong1234" } });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.data).toEqual(b.data);
  });

  it("returns the current user with roles and permissions", async () => {
    const cookie = await login(ADMIN);
    const res = await call("/api/auth/me", { cookie });
    expect(res.status).toBe(200);
    expect(res.data.user.roles).toContain("admin");
    expect(res.data.user.permissions).toContain("users:manage");
  });

  it("revokes every session on logout-all", async () => {
    const { cookie } = await registerFresh();
    expect((await call("/api/auth/me", { cookie })).status).toBe(200);
    expect((await call("/api/auth/logout-all", { method: "POST", cookie })).status).toBe(204);
    expect((await call("/api/auth/me", { cookie })).status).toBe(401);
  });

  it("rejects a tampered token", async () => {
    const cookie = await login(USER);
    const tampered = cookie.slice(0, -3) + (cookie.endsWith("a") ? "bbb" : "aaa");
    expect((await call("/api/auth/me", { cookie: tampered })).status).toBe(401);
  });
});

describe("authorization", () => {
  it("blocks non-admins from user management", async () => {
    const cookie = await login(USER);
    expect((await call("/api/users", { cookie })).status).toBe(403);
  });

  it("lets admins list users and deactivate someone, which ends their session", async () => {
    const admin = await login(ADMIN);
    const victim = await registerFresh();
    const list = await call("/api/users?pageSize=100", { cookie: admin });
    expect(list.status).toBe(200);
    const res = await call(`/api/users/${victim.user.id}`, { method: "PATCH", cookie: admin, json: { isActive: false } });
    expect(res.status).toBe(200);
    expect((await call("/api/auth/me", { cookie: victim.cookie })).status).toBe(401);
  });

  it("stops an admin from removing their own admin role", async () => {
    const admin = await login(ADMIN);
    const me = await call("/api/auth/me", { cookie: admin });
    const res = await call(`/api/users/${me.data.user.id}`, { method: "PATCH", cookie: admin, json: { roles: ["candidate"] } });
    expect(res.status).toBe(400);
  });
});

describe("security", () => {
  it("blocks cross-site form posts (CSRF)", async () => {
    const res = await call("/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=a&password=b",
    });
    expect(res.status).toBe(403);
  });

  it("sends security headers", async () => {
    const res = await call("/api/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
  });

  it("issues realtime tickets only to signed-in users", async () => {
    expect((await call("/api/realtime/ticket?topic=lobby")).status).toBe(401);
    const cookie = await login(USER);
    const res = await call("/api/realtime/ticket?topic=lobby", { cookie });
    expect(res.status).toBe(200);
    expect(res.data.url).toContain("/ws/lobby?ticket=");
    expect((await call("/api/realtime/ticket?topic=Bad Topic!", { cookie })).status).toBe(400);
  });

  it("refuses WebSocket upgrades without a valid ticket", async () => {
    const res = await call("/ws/lobby?ticket=nope", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(401);
  });
});
