import { ADMIN, ADMIN_STATE, expect, expectAccessible, expectNoHorizontalScroll, test } from "./fixtures";

/** The browser logs a page's own 404 status as a console error - expected on the 404 tests only. */
const ignore404 = (errors: string[]) => {
  const keep = errors.filter((e) => !/status of 404/.test(e));
  errors.length = 0;
  errors.push(...keep);
};

test.describe("public site", () => {
  test("landing explains the product and offers a way in", async ({ page, errors: _ }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /start free/i }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });

  test("unknown pages show the custom 404", async ({ page, errors }) => {
    const res = await page.goto("/this-page-does-not-exist");
    ignore404(errors);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /doesn't exist/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
  });

  test("offline fallback page is shipped", async ({ page, errors: _ }) => {
    await page.goto("/offline.html");
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
  });
});

test.describe("authentication", () => {
  test("sign-up validates with the shared schema before sending anything", async ({ page, errors: _ }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expectAccessible(page);
  });

  test("protected pages send visitors to log in and back again", async ({ page, errors: _ }) => {
    await page.goto("/app/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ftasks/);
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/app\/tasks$/);
  });

  test("wrong password shows one clear message", async ({ page, errors: _ }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password", { exact: true }).fill("Wrong12345");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /invalid email or password/i })).toBeVisible();
  });

  test("a new user registers, lands in the app, and never sees admin pages", async ({ page, errors: _ }) => {
    const email = `e2e${Date.now()}${Math.floor(Math.random() * 1e4)}@test.dev`;
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Passw0rd1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E");
    await expect(page.getByRole("link", { name: "People" })).toHaveCount(0);
    await page.goto("/app/users");
    await expect(page.getByText(/don't have access/i)).toBeVisible();
  });
});

test.describe("app", () => {
  test.use({ storageState: ADMIN_STATE });
  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
    // Wait until the shell is mounted (keyboard shortcuts attach on mount).
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("dashboard is accessible and fits the screen", async ({ page, errors: _ }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });

  test("list -> detail panel -> edit form, with state in the URL", async ({ page, errors: _ }) => {
    await page.goto("/app/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);

    // Create through the generated form (validation first).
    await page.getByRole("link", { name: /new project/i }).first().click();
    await page.getByRole("button", { name: /create project/i }).click();
    await expect(page.getByText("Name is required")).toBeVisible();
    const name = `E2E project ${Date.now()}`;
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Status").selectOption("active");
    await expectAccessible(page);
    await page.getByRole("button", { name: /create project/i }).click();
    await expect(page).toHaveURL(/\/app\/projects$/);

    // Search narrows the list via the URL, then open the record panel.
    await page.getByRole("searchbox").fill(name);
    await expect(page).toHaveURL(/q=E2E/);
    await page.getByText(name).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/view=\d+/);
    await expect(page.getByRole("dialog")).toContainText(name);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("command palette finds records and navigates", async ({ page, errors: _ }) => {
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByPlaceholder(/type a command/i);
    await expect(input).toBeVisible();
    await input.fill("Projects");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/projects/);
  });

  test("assistant panel opens with ⌘J and closes with Escape", async ({ page, errors: _ }) => {
    await page.keyboard.press("ControlOrMeta+j");
    await expect(page.getByRole("dialog", { name: "Assistant" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Assistant" })).toHaveCount(0);
  });

  test("Urdu switches the whole app to right-to-left", async ({ page, errors: _ }) => {
    await page.evaluate(() => localStorage.setItem("np-locale", "ur"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ur");
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => localStorage.setItem("np-locale", "en"));
  });
});

test.describe("smallest phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ["/", "/login", "/register", "/this-page-does-not-exist"]) {
    test(`${path} fits without sideways scrolling`, async ({ page, errors }) => {
      await page.goto(path);
      ignore404(errors);
      await expectNoHorizontalScroll(page);
    });
  }

  test.describe("signed in", () => {
    test.use({ storageState: ADMIN_STATE });
    test("app pages fit too", async ({ page, errors: _ }) => {
    for (const path of ["/app", "/app/tasks", "/app/tasks/new", "/app/users"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalScroll(page);
    }
  });
  });
});
