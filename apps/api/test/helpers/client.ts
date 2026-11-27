import { env } from "cloudflare:test";
import { app } from "../../src/app";

export const ADMIN = { email: "admin@test.dev", password: "Admin@12345" };
export const USER = { email: "user@test.dev", password: "User@12345" };
export const EXAMINER = { email: "examiner@test.dev", password: "Examiner@12345" };
export const CANDIDATE2 = { email: "cand2@test.dev", password: "Cand2@12345" };
export const ORIGIN = "http://localhost:3000";

/** Calls the Hono app in-process with the real bindings (D1, Durable Objects). */
export async function call(path: string, init: RequestInit & { cookie?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Origin")) headers.set("Origin", ORIGIN);
  if (init.cookie) headers.set("Cookie", init.cookie);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  } else if (init.method && init.method !== "GET" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await app.request(`http://api.test${path}`, { ...init, headers, body }, env);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

export function sessionCookie(headers: Headers): string {
  const raw = headers.get("set-cookie") ?? "";
  const m = raw.match(/np_session=([^;]+)/);
  if (!m) throw new Error(`No session cookie in: ${raw}`);
  return `np_session=${m[1]}`;
}

export async function login(creds: { email: string; password: string }) {
  const res = await call("/api/auth/login", { method: "POST", json: creds });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.data)}`);
  return sessionCookie(res.headers);
}

let counter = 0;
export async function registerFresh() {
  const email = `u${Date.now()}${counter++}@test.dev`;
  const res = await call("/api/auth/register", {
    method: "POST",
    json: { fullName: "Fresh User", email, password: "Passw0rd1" },
  });
  if (res.status !== 201) throw new Error(`register failed ${res.status} ${JSON.stringify(res.data)}`);
  return { cookie: sessionCookie(res.headers), user: res.data.user, email };
}
