# NullPointers

Team NullPointers' starter kit for Technoverse 5.0 Web-e-Thon: **Next.js on Vercel + Hono on Cloudflare Workers + D1 + Durable Objects**, one Bun monorepo. Full context for people and Claude: [`CLAUDE.md`](CLAUDE.md). Day-of plan: [`docs/runbook.md`](docs/runbook.md).

## Quick start

Needs only [Bun](https://bun.sh) and git - no Docker, no cloud account for local work.

```bash
bun run setup   # install, local secrets, local database, demo accounts, git hooks
bun run dev     # web http://localhost:3000  ·  api http://localhost:8787
```

Log in with `admin@nullpointers.dev` / `Admin@12345` (local only).

## Add a theme entity

```bash
bun run gen bookings "roomId:ref=rooms!" "day:date!" "status:enum=pending/confirmed/cancelled!" "notes:text"
```

You get the table + migration, a validated and permission-checked REST API with realtime and audit, API tests, and list/create/edit screens at `/app/bookings`.

## Verify

```bash
bun run check      # typecheck + API tests (real Workers runtime) + production build
bun run test:e2e   # Playwright, desktop + mobile (first time: cd apps/web && bun x playwright install chromium)
bun run smoke      # golden path through the web origin
```

## Deploy

Web: Vercel Git integration (root directory `apps/web`). API: `.github/workflows/deploy-api.yml` on push to `main`. First-time setup: [`.claude/skills/deploy/SKILL.md`](.claude/skills/deploy/SKILL.md).
