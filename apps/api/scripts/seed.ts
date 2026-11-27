/**
 * Idempotent seed: syncs roles + permissions from @np/shared and upserts the admin account.
 *   bun scripts/seed.ts --local                     (dev: admin@nullpointers.dev / Admin@Demo2026; run seed-demo.ts for the other demo accounts)
 *   ADMIN_PASSWORD=... bun scripts/seed.ts --remote  (production: password is required, never defaulted, never printed)
 * Safe to re-run any time - `bun run gen` re-runs it so a new resource's permissions exist immediately.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_PERMISSIONS, ROLES, passwordSchema } from "@np/shared";
import { seedStatements, type SeedUser } from "../src/db/seed-sql";

const remote = process.argv.includes("--remote");
const target = remote ? "--remote" : "--local";

const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@nullpointers.dev").toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? (remote ? "" : "Admin@Demo2026");
if (!passwordSchema.safeParse(adminPassword).success) {
  console.error(
    remote
      ? "ADMIN_PASSWORD is required for --remote (8+ chars, a letter and a number). Nothing was changed."
      : "ADMIN_PASSWORD doesn't meet the password rules.",
  );
  process.exit(1);
}

const users: SeedUser[] = [{ email: adminEmail, fullName: "Admin", password: adminPassword, role: "admin" }];

const dir = mkdtempSync(join(tmpdir(), "np-seed-"));
const file = join(dir, "seed.sql");
writeFileSync(file, (await seedStatements(users)).map((s) => `${s};`).join("\n"));
// process.execPath is the running bun binary - works the same on Windows, macOS, Linux and CI.
const result = spawnSync(process.execPath, ["x", "wrangler", "d1", "execute", "DB", target, `--file=${file}`, "--yes"], {
  stdio: ["ignore", "pipe", "inherit"],
  cwd: fileURLToPath(new URL("..", import.meta.url).href),
});
rmSync(dir, { recursive: true, force: true });
if (result.status !== 0) {
  console.error(String(result.stdout ?? ""));
  process.exit(result.status ?? 1);
}
console.log(`Seeded ${ROLES.length} roles, ${ALL_PERMISSIONS.length} permissions, admin ${adminEmail} (${target.slice(2)}).`);
