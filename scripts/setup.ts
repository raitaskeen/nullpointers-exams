#!/usr/bin/env bun
/**
 * One-time local setup on a fresh clone:  bun run setup
 * Installs deps, creates apps/api/.dev.vars with a random JWT secret, migrates + seeds the local D1,
 * and enables the repo's git hooks (the competition push-freeze guard). Safe to re-run.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const API = join(ROOT, "apps/api");

function step(label: string, args: string[], cwd = ROOT, exe = process.execPath) {
  console.log(`\n> ${label}`);
  const r = spawnSync(exe, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\n  x "${label}" failed. Fix the error above and re-run: bun run setup`);
    process.exit(1);
  }
}

step("Install dependencies", ["install"]);

const devVars = join(API, ".dev.vars");
if (!existsSync(devVars)) {
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64url");
  const example = readFileSync(join(API, ".dev.vars.example"), "utf8");
  writeFileSync(devVars, example.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log("\n> Created apps/api/.dev.vars with a random JWT secret");
}

step("Apply local database migrations", ["x", "wrangler", "d1", "migrations", "apply", "DB", "--local"], API);
step("Seed roles, permissions and the admin", ["scripts/seed.ts", "--local"], API);
step("Load demo accounts and exams (same as production)", ["scripts/seed-demo.ts", "--local"], API);
step("Enable git hooks (push freeze guard)", ["config", "core.hooksPath", ".githooks"], ROOT, "git");

console.log(`
  Ready.  bun run dev   ->  web http://localhost:3000   api http://localhost:8787

  Demo accounts (same as production, see README):
    Examiner  ayesha.khan@nullpointers.dev / Examiner@Demo2026
    Candidate hamza.iqbal@student.nullpointers.dev / Candidate@Demo2026
    Admin     admin@nullpointers.dev / Admin@Demo2026
`);
