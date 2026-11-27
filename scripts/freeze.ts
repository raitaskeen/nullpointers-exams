#!/usr/bin/env bun
/**
 * Submission freeze guard.
 *   bun run freeze 2026-11-29T05:30:00+05:00   set the freeze moment (our T-30, before the real deadline)
 *   bun run freeze                              show status
 *   bun run freeze --clear                      remove it (only after evaluation!)
 * The pre-push hook calls `--check` and blocks every push once the time has passed.
 * Also set the same value as the GitHub variable FREEZE_AT so the API deploy workflow refuses too.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(import.meta.dir, "..", ".freeze-at");
const arg = process.argv[2];
const read = () => (existsSync(FILE) ? readFileSync(FILE, "utf8").trim() : null);

if (arg === "--clear") {
  rmSync(FILE, { force: true });
  console.log("Freeze cleared.");
} else if (arg === "--check") {
  const at = read();
  if (at && Date.now() >= Date.parse(at)) {
    console.error(`\n  PUSH BLOCKED - submission freeze started at ${at}.\n  Pushing now could disqualify the team. (Clear only after evaluation: bun run freeze --clear)\n`);
    process.exit(1);
  }
} else if (arg) {
  const t = Date.parse(arg);
  if (Number.isNaN(t)) {
    console.error("Give an ISO time with timezone, e.g. 2026-11-29T05:30:00+05:00");
    process.exit(1);
  }
  writeFileSync(FILE, new Date(t).toISOString());
  console.log(`Freeze set for ${new Date(t).toString()} - pushes are blocked from then on.`);
} else {
  const at = read();
  if (!at) console.log("No freeze set.");
  else {
    const mins = Math.round((Date.parse(at) - Date.now()) / 60000);
    console.log(mins > 0 ? `Freeze in ${mins} min (${new Date(at).toString()})` : `FROZEN since ${new Date(at).toString()}`);
  }
}
