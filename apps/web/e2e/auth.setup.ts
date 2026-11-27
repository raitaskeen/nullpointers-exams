import { expect, test as setup } from "@playwright/test";
import { ADMIN, ADMIN_STATE } from "./fixtures";



/**
 * Sign in once and reuse the session for every app test. Logging in per test would trip the API's
 * brute-force limiter (10 attempts/min per IP+email) - which is the limiter doing its job.
 */
setup("sign in as admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.context().storageState({ path: ADMIN_STATE });
});
