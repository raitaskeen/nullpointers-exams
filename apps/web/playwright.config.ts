import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests in a real browser, desktop + phone. Local: start `bun run dev` first. Against a deploy:
 *   E2E_BASE_URL=https://<app>.vercel.app ADMIN_PASSWORD=... bun run test:e2e
 * Every test also fails on uncaught errors / unexpected console errors and serious axe findings (e2e/fixtures.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
});
