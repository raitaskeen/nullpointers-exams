---
name: qa-testing
description: Run and extend the tests, verify a deploy actually works, break the app like a judge would, and check the judging rubric before evaluation. Owned by Shahzaib. Use after any feature or deploy, at every runbook checkpoint, and before the freeze.
---

## The test layers (fastest first)

| Command | What it proves | Time |
|---|---|---|
| `bun run typecheck` | shared + api + web compile | ~5s |
| `bun run test` | API in the real Workers runtime with real D1 + Durable Objects: auth, cookies, revocation, CSRF, RBAC, and the contract suite for every generated resource | ~5s |
| `bun run smoke` / `bun run smoke -- https://<app>.vercel.app` | the golden path through the web origin, exactly like a judge's browser (needs `ADMIN_PASSWORD` for prod) | ~2s |
| `bun run test:e2e` | real Chromium, desktop + Pixel 7: journeys (register, validation, list→sheet→form, ⌘K, assistant, Urdu RTL, 404, offline page) **plus** on every test: zero console errors, axe WCAG A/AA on key screens, no sideways scroll down to 320px. Signs in once (`e2e/auth.setup.ts`) so the login rate limiter isn't tripped | ~45s |
| `bun run check` | typecheck + test + production build (what CI runs) | ~30s |

E2E against a deployment: `E2E_BASE_URL=https://<app>.vercel.app ADMIN_PASSWORD=... bun run test:e2e`.
First run on a machine: `cd apps/web && bun x playwright install chromium`.

## Writing a test for a theme feature

- Business rule in the API -> add `it(...)` in `apps/api/test/resources/<name>.test.ts` (use `login(ADMIN)`, `registerFresh()`, `call(path, { method, cookie, json })` from `test/helpers/client.ts`).
- User journey -> add a `test(...)` to `apps/web/e2e/golden-path.spec.ts` (`page.getByLabel`, `getByRole` - same labels a screen reader uses).

## Break it on purpose (judges will)

Use the `break-ui` skill on the main list and form. Also try by hand: empty submit, 300-character names, emoji, a past date, a negative number, double-clicking Save, opening `/app/<other-users-row-id>` as a normal user (must 404), logging out in one tab and acting in another, phone width, keyboard-only.

## After every deploy

1. `bun run smoke -- https://<app>.vercel.app` must pass before the team builds further.
2. Click the main flow once in a real browser on the deployed URL (not localhost).

## Before evaluation

Walk `docs/rubric-checklist.md` with the `rubric-self-check` skill / `rubric-auditor` agent.

## Pitfalls

- Treat smoke + e2e as the hard gate before the freeze. A flaky test unrelated to a visible break gets skipped, not chased.
- Don't test destructively against production data you plan to demo with - use your own test accounts.
- File bugs to the owner with the exact command/output; fix app code yourself only when it's trivial.
