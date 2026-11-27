import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Tests run inside the real Workers runtime (workerd) with a real local D1 + Durable Objects,
// so what passes here behaves the same once deployed.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url).href));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
            WEB_ORIGINS: "http://localhost:3000",
            PUBLIC_API_URL: "http://localhost:8787",
            ENVIRONMENT: "test",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
    },
  };
});
