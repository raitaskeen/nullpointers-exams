import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/db/schema into ./migrations, which wrangler applies to D1
// (`bun run db:migrate:local` / `db:migrate:remote`). Never edit an applied migration - generate a new one.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
});
