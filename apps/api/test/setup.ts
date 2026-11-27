import { applyD1Migrations, env } from "cloudflare:test";
import { seedStatements } from "../src/db/seed-sql";
import { ADMIN, CANDIDATE2, EXAMINER, USER } from "./helpers/client";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
const statements = await seedStatements([
  { ...ADMIN, fullName: "Admin", role: "admin" },
  { ...EXAMINER, fullName: "Erin Examiner", role: "examiner" },
  { ...USER, fullName: "Cara Candidate", role: "candidate" },
  { ...CANDIDATE2, fullName: "Dan Second", role: "candidate" },
]);
await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
