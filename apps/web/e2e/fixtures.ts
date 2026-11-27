import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/** Saved sessions (written once by auth.setup.ts). */
export const ADMIN_STATE = "e2e/.auth/admin.json";
export const EXAMINER_STATE = "e2e/.auth/examiner.json";
export const CANDIDATE_STATE = "e2e/.auth/candidate.json";

/** Demo accounts from apps/api/scripts/seed-demo.ts (fictional data). */
export const ADMIN = { email: process.env.ADMIN_EMAIL ?? "admin@nullpointers.dev", password: process.env.ADMIN_PASSWORD ?? "Admin@Demo2026" };
export const EXAMINER = { email: "ayesha.khan@nullpointers.dev", password: "Examiner@Demo2026" };
export const CANDIDATE = { email: "zainab.hussain@student.nullpointers.dev", password: "Candidate@Demo2026" };

/** Console noise that isn't a bug: expected 401s from "am I signed in?" checks, and dev-server HMR. */
const IGNORED = [/status of 401/, /status of 403/, /status of 404/, /WebSocket/, /_next\/hmr/, /webpack-hmr/, /Download the React DevTools/];

/**
 * Every test fails if the page throws an uncaught error or logs an unexpected console error -
 * the same things a judge would see in DevTools.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORED.some((re) => re.test(m.text()))) errors.push(`console: ${m.text()}`);
    });
    await use(errors);
    expect(errors, "no uncaught errors or console errors").toEqual([]);
  },
});

export { expect };

export async function login(page: Page, creds = ADMIN) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password", { exact: true }).fill(creds.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** WCAG 2 A/AA scan; serious and critical findings fail the test. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`),
  ).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, "page must not scroll sideways").toBeLessThanOrEqual(innerWidth);
}
