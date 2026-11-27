# NullPointers - Invigil (Secure Examination Management System)

> **Current state (27 Nov):** the starter kit below became **Invigil**. Deployed as ONE Cloudflare Worker (static Next.js export + Hono API + WebSockets), live at https://nullpointers-exams.np-api.workers.dev. README has demo accounts; PROGRESS.md (top entry) has what is built. Where this file says Vercel, read Cloudflare Workers Assets.

## What this repo is

A pre-built, production-grade starter for **Technoverse 5.0 Web-e-Thon** (COMSATS Lahore, 28-29 Nov 2026; 10 hours; theme announced 30 minutes before the start). The aim: when the theme drops, skip all plumbing (auth, database, realtime, deploys, tests) and spend the whole clock on the assignment. One command (`bun run gen`) turns a theme's entities into a tested, permission-gated API plus live UI.

Read next: `docs/runbook.md` (hour-by-hour plan + freeze rule), `docs/judge-playbook.md` (how judges test + 15-min demo script), `docs/DESIGN.md` (design rules), `docs/rubric-checklist.md` (official judging criteria -> evidence), `PROGRESS.md` (latest session notes, newest first).

## Organizer rules that shape everything (from `web-e-thon-tentative.pdf`)

- **The website must be deployed to Vercel through a GitHub repository.** If the last Vercel build or the last commit lands between the submission deadline and evaluation -> instant disqualification. We freeze at T-30 (`bun run freeze <time>`).
- Any framework/language except WordPress or "any other script". SQL or NoSQL allowed. Docker optional.
- AI-assisted coding is allowed. Teams of 1-3. All members present at the 15-minute live evaluation.
- Judged on: completion of requirements, front/back-end validations, back-end architecture, visual simplicity + consistency, case-study analysis (requirements, technical analysis, constraints), design approach (OO/best practices, database design), technology selection reason, mapping design to code.

## Stack (final as of 2026-11-27)

| Layer | Choice | Where |
|---|---|---|
| Web | **Next.js 16** (App Router, React 19), TypeScript 7, Tailwind v4, **shadcn/ui on Base UI**, TanStack Query, react-hook-form, motion | `apps/web` -> **Vercel** |
| API | **Hono** on **Cloudflare Workers** | `apps/api` -> Cloudflare |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM**, migrations from schema | `apps/api/src/db`, `apps/api/migrations` |
| Realtime | **Durable Objects** WebSockets (hibernation), ticket auth | `apps/api/src/realtime` |
| Validation | **Zod 4** schemas shared by browser + API | `packages/shared` |
| Auth | Custom JWT in httpOnly cookie, PBKDF2, flat RBAC (`resource:action`), instant revocation | `apps/api/src/{lib,middleware,services}` |
| Tooling | **Bun** workspaces, Vitest in the real Workers runtime, Playwright e2e, GitHub Actions | root |
| Design | OKLCH tokens + 6 brand palette presets, light-first, Hanken Grotesk / Newsreader / JetBrains Mono, **Phosphor** icons, ⌘K command palette (cmdk), recharts | `apps/web/src/theme`, **`docs/DESIGN.md`** |
| AI | Assistant on **Groq** (`openai/gpt-oss-120b` default), streaming SSE, read-only tools run as the signed-in user | `apps/api/src/routes/ai.ts`, `services/ai.service.ts`, `features/app/Assistant.tsx` |
| i18n / offline | English + **Urdu (RTL)** app chrome; offline banner + service-worker offline page; custom 404/500 | `lib/i18n.tsx`, `public/sw.js`, `public/offline.html` |

How a request flows: browser -> Vercel (`/api/*` rewrite, same-origin cookie) -> Worker -> D1. WebSockets go straight to the Worker with a 60-second ticket (Vercel can't proxy them). Full diagram: `docs/architecture-diagram-template.md`.

The team Game Plan PDF (Downloads) still says FastAPI/AWS - it predates two stack changes (.NET/Azure, then this). This file wins.

## Repo map

```
apps/web/            Next.js app
  src/app/           routes: (public) landing, (auth) login/register, app/* (signed-in shell), app/[resource]/* (generated screens)
  src/features/      home (landing, ProductFrame, StatusPage), auth, app (AppShell, CommandMenu, Assistant, Dashboard, Users), resources (list/sheet/form)
  src/components/    ui/* (shadcn on Base UI + sheet), layout (Navbar, AuthShell, Preferences), feedback, data/Pagination, brand/Logo, ResourceIcon
  src/lib/           api-client, auth-context, route-guards, realtime, i18n, palette, theme-provider, boot-script, site-config (all copy + brand)
  src/theme/tokens.css  every color, shadow, radius and motion token
  public/            favicon, manifest, sw.js, offline.html
  e2e/               Playwright: auth.setup (one sign-in), fixtures (console/axe/overflow checks), golden-path
apps/api/            Cloudflare Worker
  src/app.ts         middleware + route mounting (GENERATOR markers)
  src/routes/        auth, users, realtime, resource-router (generic CRUD), resources/<name>.ts (generated)
  src/services/      AuthService, UserService, ResourceService
  src/db/schema/     core.ts (users, roles, permissions, audit_log) + one file per resource
  migrations/        drizzle-kit SQL, applied by wrangler
  test/              Vitest suites (auth/security + per-resource contract suite)
  scripts/seed.ts    syncs roles/permissions + admin (local/remote)
packages/shared/     resource definitions, Zod schemas, permissions, shared types
scripts/             generate.ts, setup.ts, cf-setup.ts, smoke.ts, freeze.ts
docs/                runbook, rubric checklist, case study, architecture/ERD, pitch deck, role split, theme kit
.claude/             skills, agents, hooks
```

## Commands (run from the repo root)

| Command | Does |
|---|---|
| `bun run setup` | first time on a machine: install, `.dev.vars` with random secret, local DB migrate + seed, git hooks |
| `bun run dev` | API on :8787 + web on :3000 |
| `bun run gen <name> <fields...>` | new entity end to end (see `resource-generator` skill) |
| `bun run check` | typecheck + API tests + production build (= CI) |
| `bun run test` / `bun run test:e2e` | API tests (workerd) / Playwright (desktop + mobile) |
| `bun run smoke [-- <url>]` | golden path against local or deployed |
| `bun run db:generate && bun run db:migrate` | after editing a Drizzle table by hand |
| `bun run seed` | re-sync roles/permissions + local accounts |
| `bun run freeze <ISO time>` | block pushes from the freeze moment |
| `bun run cf:setup -- --web <vercel-url>` | one-time Cloudflare provisioning (see `deploy` skill) |

Local accounts after setup: `admin@nullpointers.dev` / `Admin@12345` and `user@nullpointers.dev` / `User@12345` (dev only; production admin password comes from the `ADMIN_PASSWORD` secret).

## Status

| Area | Status |
|---|---|
| Monorepo, shared package, API, web port to Next.js | DONE, verified 2026-11-27 |
| Auth (cookie sessions, revocation, rate limit, CSRF, RBAC, audit) | DONE - 16 auth/security tests pass |
| Resource generator + generic CRUD API/UI | DONE - practice entities `projects`, `tasks` generated with it; contract suite passes |
| Realtime (Durable Objects) | DONE - verified live across two browser tabs |
| Tests | 32 API tests (workerd) + 35 Playwright (desktop + Pixel 7; zero console errors, axe WCAG A/AA, no overflow to 320px) passing against the production build, twice in a row; offline service worker verified; `bun audit` clean |
| UI redesign (design system, landing, auth, shell, ⌘K, dashboard, list/sheet/form, 404/500/offline, Urdu RTL, dark) | DONE 2026-11-27, browser-verified desktop + 390px |
| AI assistant | DONE - full pipeline verified with a local Groq-compatible mock; **real Groq key not tested yet** (add `GROQ_API_KEY`) |
| CI (`ci.yml`: check + e2e jobs) + API deploy (`deploy-api.yml`) + Vercel config | WRITTEN, not yet run on GitHub (needs the new repo + secrets) |
| Production deploy (Vercel + Cloudflare) | NOT DONE - needs the team's accounts; follow the `deploy` skill |
| Full practice run on a fake theme | NOT DONE |

## Hard rules

- **Freeze**: nothing is pushed, merged or deployed after the freeze time (`docs/runbook.md`). The pre-push hook, the deploy job and `.claude/settings.json` all enforce it once `.freeze-at` / `FREEZE_AT` is set.
- **Never commit secrets**: `.dev.vars`, `.env*` are gitignored; production secrets live in `wrangler secret`, Vercel env and GitHub secrets. CI runs gitleaks.
- **Single production environment** (one Vercel project, one Worker, one D1). Destructive remote D1 commands need explicit team agreement (hook asks first).
- **The API is the security boundary.** UI guards are UX only; every route checks the session and permission.
- **Validation lives in `packages/shared`.** Never hand-write a second copy of a rule in the UI or API.
- **Keep `GENERATOR:` markers** in `app.ts`, `db/schema/index.ts`, `resources/index.ts`.
- **No Claude/Anthropic attribution** (`Co-Authored-By` etc.) in commits or PRs in this repo - team instruction.

## Who's doing what

- **Raitaskeen** (lead; replaced Junaid on 2026-11-27) - backend, generator, auth, deploys, integration, freeze call. Skills: `resource-generator`, `backend-scaffold`, `auth-rbac`, `realtime`, `deploy`. Agent: `deploy-doctor`.
- **Shahzaib** (MERN background) - QA + deploy verification. Skills: `qa-testing`, `rubric-self-check`. Agents: `qa-runner`, `rubric-auditor`.
- **Rimza** (React/Tailwind) - theming, copy, UI polish. Skill: `frontend-theme` + design skills. Agent: `theme-rebrand`.

## Skills (`.claude/skills`)

| Skill | Use for |
|---|---|
| `resource-generator` | new theme entity in one command |
| `backend-scaffold` | custom endpoints, business rules, services |
| `auth-rbac` | roles, permissions, sessions, passwords |
| `realtime` | live updates over Durable Objects |
| `deploy` | Vercel + Cloudflare + GitHub setup, debugging, the freeze |
| `frontend-theme` | palette preset, copy, hero picture, polish generated screens |
| `ai-assistant` | Groq key/model, add read-only tools, debug answers |
| `qa-testing` | tests, smoke, e2e, breaking it on purpose |
| `rubric-self-check` / `presentation-prep` | judging readiness, demo script |
| Design: `impeccable`, `emil-design-eng`, `apple-design`, `taste-skill`, `animate`, `choreograph`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `remove-animations`, `animation-performance`, `animation-vocabulary`, `gestures`, `break-ui`, `prototype`, `pick-ui-library`, `ask-sonner`, `learn-taste`, `ask-emil` | UI/UX quality |

## Agents (`.claude/agents`)

`qa-runner` (full QA pass), `rubric-auditor` (rubric gaps), `theme-rebrand` (re-theme from a description), `deploy-doctor` (read-only production diagnosis).

## Hooks (`.claude/settings.json`)

Stop: reminds to update `PROGRESS.md`. PreToolUse(Bash): asks before destructive production commands; **denies** pushes/deploys once the freeze has started.

## Resuming a session

1. Read `PROGRESS.md` (top entry). 2. `git log -5 --oneline`. 3. `bun run dev` then `bun run smoke`. 4. Continue from the Status table.
