#!/usr/bin/env bun
/**
 * Golden-path check against a running deployment, through the same path a judge's browser uses.
 *   bun run smoke                                  (local: http://localhost:3000)
 *   bun run smoke -- https://<app>.vercel.app      (production; needs ADMIN_PASSWORD set)
 * Exits non-zero on the first failure, so it can gate a deploy.
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL ?? "admin@nullpointers.dev";
const password = process.env.ADMIN_PASSWORD ?? (base.includes("localhost") ? "Admin@12345" : "");
let failures = 0;

async function check(label: string, fn: () => Promise<string | void>) {
  const started = performance.now();
  try {
    const note = await fn();
    console.log(`  ok   ${label} (${Math.round(performance.now() - started)}ms)${note ? ` - ${note}` : ""}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${label} - ${err instanceof Error ? err.message : err}`);
  }
}
const expect = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};

console.log(`Smoke test: ${base}\n`);
let cookie = "";

await check("home page renders", async () => {
  const r = await fetch(`${base}/`);
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("x-frame-options") === "DENY", "missing security headers");
});
await check("API reachable through the web origin", async () => {
  const r = await fetch(`${base}/api/health`);
  const body = (await r.json()) as { db?: string };
  expect(r.ok && body.db === "ok", `status ${r.status} ${JSON.stringify(body)}`);
});
await check("anonymous access is refused", async () => {
  const r = await fetch(`${base}/api/auth/me`);
  expect(r.status === 401, `expected 401, got ${r.status}`);
});
await check("admin can log in", async () => {
  expect(password, "set ADMIN_PASSWORD for non-local targets");
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(r.ok, `status ${r.status}`);
  cookie = (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  expect(cookie.startsWith("np_session="), "no session cookie");
});
await check("session works and has permissions", async () => {
  const r = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  const body = (await r.json()) as { user?: { permissions: string[] } };
  expect(r.ok, `status ${r.status}`);
  return `${body.user?.permissions.length} permissions`;
});
await check("realtime ticket issued", async () => {
  const r = await fetch(`${base}/api/realtime/ticket?topic=smoke`, { headers: { cookie } });
  expect(r.ok, `status ${r.status}`);
});

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
