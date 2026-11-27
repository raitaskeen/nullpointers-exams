#!/usr/bin/env bun
/**
 * One-time Cloudflare provisioning (run once per Cloudflare account, after `bun x wrangler login`):
 *
 *   bun run cf:setup -- --web https://<your-app>.vercel.app
 *
 * 1. Creates the D1 database (or reuses it) and writes its id into apps/api/wrangler.jsonc
 * 2. Sets WEB_ORIGINS (the Vercel URL, for CORS/CSRF/WebSocket origin checks) in wrangler.jsonc
 * 3. Generates and uploads a random JWT_SECRET as a Worker secret (never written to disk)
 * 4. Migrates the remote database, deploys the Worker, fills in PUBLIC_API_URL, seeds the admin
 *
 * Needs ADMIN_PASSWORD in the environment for step 4 (8+ chars, a letter and a number).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = join(import.meta.dir, "..", "apps/api");
const CONFIG = join(API, "wrangler.jsonc");
const DB_NAME = "nullpointers-db";

const webIdx = process.argv.indexOf("--web");
const web = webIdx > -1 ? process.argv[webIdx + 1]?.replace(/\/$/, "") : undefined;
if (!web || !/^https:\/\/[^/]+$/.test(web)) {
  console.error("Usage: bun run cf:setup -- --web https://<your-app>.vercel.app");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.error("Set ADMIN_PASSWORD first (it becomes the production admin password). Nothing was changed.");
  process.exit(1);
}

function wrangler(args: string[], input?: string) {
  const r = spawnSync(process.execPath, ["x", "wrangler", ...args], { cwd: API, input, encoding: "utf8", stdio: [input ? "pipe" : "inherit", "pipe", "inherit"] });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(`\n  x wrangler ${args.join(" ")} failed.`);
    process.exit(1);
  }
  return r.stdout;
}

let config = readFileSync(CONFIG, "utf8");

console.log("> D1 database");
const list = JSON.parse(wrangler(["d1", "list", "--json"])) as { name: string; uuid: string }[];
let dbId = list.find((d) => d.name === DB_NAME)?.uuid;
if (!dbId) {
  const out = wrangler(["d1", "create", DB_NAME]);
  dbId = out.match(/"database_id":\s*"([0-9a-f-]{36})"/)?.[1] ?? out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)?.[1];
  if (!dbId) {
    console.error(out);
    process.exit(1);
  }
}
config = config.replace(/"database_id": "[^"]*"/, `"database_id": "${dbId}"`).replace(/"WEB_ORIGINS": "[^"]*"/, `"WEB_ORIGINS": "${web}"`);
writeFileSync(CONFIG, config);
console.log(`  database_id = ${dbId}, WEB_ORIGINS = ${web}`);

console.log("> Remote migrations");
wrangler(["d1", "migrations", "apply", "DB", "--remote"]);

console.log("> Deploy");
const deployOut = wrangler(["deploy"]);
const apiUrl = deployOut.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0];
if (apiUrl) {
  config = readFileSync(CONFIG, "utf8").replace(/"PUBLIC_API_URL": "[^"]*"/, `"PUBLIC_API_URL": "${apiUrl}"`);
  writeFileSync(CONFIG, config);
  console.log(`  API live at ${apiUrl}`);
}

console.log("> JWT secret (random, uploaded straight to Cloudflare)");
const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64url");
wrangler(["secret", "put", "JWT_SECRET"], secret);

console.log("> Redeploy with final vars");
wrangler(["deploy"]);

console.log("> Seed production roles + admin");
const seed = spawnSync(process.execPath, ["scripts/seed.ts", "--remote"], { cwd: API, stdio: "inherit" });
if (seed.status !== 0) process.exit(1);

console.log(`
  Done. Now:
   1. Commit apps/api/wrangler.jsonc (ids and URLs only - no secrets).
   2. Vercel -> Project -> Settings -> Environment Variables:  API_ORIGIN = ${apiUrl ?? "<your workers.dev URL>"}
   3. GitHub repo -> Settings -> Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ADMIN_PASSWORD
                                Variables: API_URL = ${apiUrl ?? "<api url>"}, ADMIN_EMAIL (optional), FREEZE_AT
`);
