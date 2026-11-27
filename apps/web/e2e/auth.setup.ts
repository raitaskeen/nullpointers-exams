import { expect, test as setup } from "@playwright/test";
import { ADMIN, ADMIN_STATE, CANDIDATE, CANDIDATE_STATE, EXAMINER, EXAMINER_STATE } from "./fixtures";

/**
 * Sign in once per role and reuse the sessions. Logging in per test would trip the API's brute-force
 * limiter (10 attempts/min per IP+email) - which is the limiter doing its job.
 */
for (const [name, creds, file] of [
  ["admin", ADMIN, ADMIN_STATE],
  ["examiner", EXAMINER, EXAMINER_STATE],
  ["candidate", CANDIDATE, CANDIDATE_STATE],
] as const) {
  setup(`sign in as ${name}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password", { exact: true }).fill(creds.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.context().storageState({ path: file });
  });
}
