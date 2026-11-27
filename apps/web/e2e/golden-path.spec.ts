import { CANDIDATE_STATE, EXAMINER_STATE, expect, expectAccessible, expectNoHorizontalScroll, test } from "./fixtures";

/**
 * Golden paths through the exam product, run on desktop and a Pixel 7. Uses the demo data from
 * apps/api/scripts/seed-demo.ts (run `bun run demo:local` in apps/api first).
 */

test.describe("public", () => {
  test("landing page explains the product and is accessible", async ({ page, errors }) => {
    void errors;
    // The hero fades in; with reduced motion it renders final, so axe measures real contrast, not a mid-fade frame.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Exams that hold up under pressure");
    await expect(page.getByRole("link", { name: "Open the live demo" }).first()).toBeVisible();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
  });

  test("resilience demo reacts to a dropped connection", async ({ page, errors }) => {
    void errors;
    await page.goto("/#resilience");
    await page.getByRole("button", { name: "Drop the connection" }).click();
    await expect(page.getByText(/Offline/).first()).toBeVisible();
    await expect(page.getByText("All answers saved")).toBeVisible({ timeout: 8000 });
  });

  test("architecture diagrams render", async ({ page, errors }) => {
    void errors;
    await page.goto("/architecture");
    await expect(page.getByRole("heading", { name: "How Invigil is built" })).toBeVisible();
    await expect(page.getByRole("img", { name: /System architecture/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("verification rejects an unknown code without leaking anything", async ({ page, errors }) => {
    void errors;
    await page.goto("/verify");
    await page.getByLabel("Verification code").fill("ZZZZZZZZZZ");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("No published result matches this code")).toBeVisible();
    await expectAccessible(page);
  });

  test("sign-in validates on the client before calling the API", async ({ page, errors }) => {
    void errors;
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/email/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("examiner", () => {
  test.use({ storageState: EXAMINER_STATE });

  test("overview shows live exams and work to do", async ({ page, errors }) => {
    void errors;
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Needs your attention")).toBeVisible();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
  });

  test("question bank filters and opens the editor", async ({ page, errors }) => {
    void errors;
    await page.goto("/app/questions");
    await expect(page.getByRole("heading", { name: "Question bank" })).toBeVisible();
    await page.getByLabel("Difficulty").selectOption("hard");
    await expect(page).toHaveURL(/difficulty=hard/);
    await page.getByRole("button", { name: "New question" }).first().click();
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByText(/Write the question/)).toBeVisible();
  });

  test("every tab of a live exam renders", async ({ page, errors }) => {
    void errors;
    await page.goto("/app/exams/view?id=502");
    await expect(page.getByRole("heading", { name: /Databases/ })).toBeVisible();
    for (const tab of ["Questions", "Candidates", "Monitor", "Grading", "Results & analytics"]) {
      await page.getByRole("link", { name: new RegExp(`^${tab.replace("&", "\\&")}`) }).click();
      await expect(page).toHaveURL(/tab=/);
    }
    await page.goto("/app/exams/view?id=502&tab=monitor");
    await expect(page.getByText("Signals recorded").first()).toBeVisible();
    await expectAccessible(page);
  });

  test("sandbox: preview an exam as a candidate without touching results", async ({ page, errors }) => {
    void errors;
    await page.goto("/app/exams/view?id=502&tab=setup");
    await page.getByRole("button", { name: "Open sandbox" }).click();
    await expect(page).toHaveURL(/\/exam\?attempt=/);
    await expect(page.getByText("Sandbox preview · not recorded")).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    await page.getByRole("button", { name: "Review & submit" }).first().click();
    await page.getByRole("button", { name: "Submit exam" }).click();
    await page.getByRole("button", { name: "Submit now" }).click();
    await expect(page.getByRole("heading", { name: "Exam submitted" })).toBeVisible();
    await page.getByRole("button", { name: "Discard this sandbox attempt" }).click();
    await expect(page).toHaveURL(/\/app\/exams\/view/);
  });
});

test.describe("candidate", () => {
  test.use({ storageState: CANDIDATE_STATE });

  test("sees available, upcoming and completed exams", async ({ page, errors }) => {
    void errors;
    await page.goto("/app");
    await expect(page.getByText("Available now")).toBeVisible();
    await expect(page.getByText("Upcoming")).toBeVisible();
    await expect(page.getByText("Completed")).toBeVisible();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
  });

  test("sees own published result with a verification code", async ({ page, errors }) => {
    void errors;
    await page.goto("/app/results");
    await page.getByRole("link", { name: /Data Structures/ }).click();
    await expect(page.getByText("Question by question")).toBeVisible();
    await expect(page.getByRole("link", { name: /Verify ·/ })).toBeVisible();
  });

  test("can't reach examiner pages or APIs", async ({ page, errors }) => {
    void errors;
    await page.goto("/app/exams");
    await expect(page.getByText("You don't have access to this")).toBeVisible();
    const status = await page.evaluate(async () => (await fetch("/api/exams", { credentials: "same-origin" })).status);
    expect(status).toBe(403);
    const other = await page.evaluate(async () => (await fetch("/api/attempts/9001/result", { credentials: "same-origin" })).status);
    expect(other).toBe(404);
  });
});
