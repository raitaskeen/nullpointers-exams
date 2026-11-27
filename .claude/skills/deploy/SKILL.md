---
name: deploy
description: Set up, run or debug deployments - Next.js on Vercel (required by the competition rules), the Hono API on Cloudflare Workers + D1, GitHub Actions CI/deploy, secrets, the submission freeze. Use for first-time setup on a new repo/account, when a deploy fails, or before the freeze.
---

## Topology

```
Browser ──https──> Vercel (Next.js, apps/web)  ── /api/* rewrite ──> Cloudflare Worker (apps/api) ──> D1 (SQLite)
   └────────── wss://<worker>/ws/<topic>?ticket=... (direct) ──────> Durable Object RealtimeRoom
```

**Competition rule:** "The website must be deployed to Vercel through a GitHub repository." The Vercel URL is the one judges use. Last Vercel build or last commit after the deadline = disqualification.

## First-time setup (new GitHub repo + accounts) - about 15 minutes

1. Push the repo to GitHub (raitaskeen account), branch `main`.
2. **Vercel**: Add New Project -> import the repo -> Root Directory `apps/web` (framework auto-detects Next.js; `vercel.json` sets the Bun install). Deploy once to get the URL (`https://<name>.vercel.app`).
3. **Cloudflare** (in a terminal, logged in yourself): `bun x wrangler login`, then
   `ADMIN_PASSWORD=<strong> bun run cf:setup -- --web https://<name>.vercel.app`
   This creates D1, writes its id + `WEB_ORIGINS` into `apps/api/wrangler.jsonc`, migrates, deploys, uploads a random `JWT_SECRET`, seeds the admin, and prints the Worker URL.
4. **Vercel env**: Project -> Settings -> Environment Variables -> `API_ORIGIN = https://nullpointers-api.<acct>.workers.dev` -> Redeploy.
5. **GitHub** -> Settings -> Secrets and variables -> Actions:
   - Secrets: `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers" + D1 edit), `CLOUDFLARE_ACCOUNT_ID`, `ADMIN_PASSWORD`
   - AI assistant (optional): `cd apps/api && bun x wrangler secret put GROQ_API_KEY` (see the `ai-assistant` skill)
   - Variables: `API_URL` (Worker URL), `ADMIN_EMAIL` (optional), `FREEZE_AT` (set on the day)
   - Environment `production` exists (the deploy job uses it).
6. Commit `apps/api/wrangler.jsonc` (ids/URLs only - no secrets). Verify: `ADMIN_PASSWORD=... bun run smoke -- https://<name>.vercel.app`.

## Day-to-day

- Push to `main` -> **CI** (typecheck, API tests in workerd, web build, audit, gitleaks) + **Vercel** builds the web + **Deploy API** (tests -> D1 migrations -> wrangler deploy -> seed -> health check) when `apps/api` or `packages/shared` changed.
- PRs get Vercel preview URLs - test there (`E2E_BASE_URL=<preview> bun run test:e2e`).
- Manual API deploy: `bun run deploy:api` (after `bun x wrangler d1 migrations apply DB --remote` if there are new migrations).

## The freeze (T-30 before the deadline)

```
bun run freeze 2026-11-29T05:30:00+05:00   # blocks git push locally (pre-push hook) from that moment
```
And set the same value as GitHub variable `FREEZE_AT` (the API deploy job refuses after it). Also stop merging PRs - Vercel builds on every push. `bun run freeze` shows the countdown.

## Debugging

- API logs live: `cd apps/api && bun x wrangler tail`
- 404/502 on `/api/*` from Vercel: `API_ORIGIN` unset or wrong (and redeploy after changing it).
- 403 "Request blocked"/CORS or WebSocket refused: `WEB_ORIGINS` in `wrangler.jsonc` doesn't match the exact Vercel origin (scheme + host, no trailing slash). Add preview origins comma-separated if needed.
- 500 on every request: `JWT_SECRET` missing -> `bun x wrangler secret put JWT_SECRET`.
- D1 "no such table": migrations not applied remotely -> `bun x wrangler d1 migrations apply DB --remote`.

## Pitfalls

- Never commit `.dev.vars`, `.env*` or tokens (gitleaks in CI will fail the build).
- Don't change `compatibility_date` above what the test pool supports.
- Preview deployments have different origins - login works there only if that origin is in `WEB_ORIGINS`.
