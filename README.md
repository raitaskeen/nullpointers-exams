# Invigil - Secure Examination Management System

Team **NullPointers** · Technoverse 5.0 Web-e-Thon (COMSATS Lahore, 27 Nov 2026).

Invigil lets institutions create, run, monitor and evaluate online exams: a reusable question bank, fair randomised papers, a candidate workspace that keeps saving through network drops, live monitoring, grading, analytics, PDF reports anyone can verify, and a dispute process with a paper trail.

**Live:** https://nullpointers-exams.np-api.workers.dev  
**How it is built (diagrams):** https://nullpointers-exams.np-api.workers.dev/architecture  
**Case study (requirements, ambiguities, decisions):** [`docs/CASE_STUDY.md`](docs/CASE_STUDY.md)

## Test accounts (fictional demo data)

The sign-in page has one-click buttons for the first three.

| Role | Email | Password |
|---|---|---|
| Examiner | `ayesha.khan@nullpointers.dev` | `Examiner@Demo2026` |
| Candidate | `hamza.iqbal@student.nullpointers.dev` | `Candidate@Demo2026` |
| Administrator | `admin@nullpointers.dev` | `Admin@Demo2026` |
| Second examiner | `bilal.ahmed@nullpointers.dev` | `Examiner@Demo2026` |
| More candidates | `sana.malik`, `usman.tariq`, `fatima.noor`, `ali.raza`, `zainab.hussain`, `omar.farooq`, `mariam.siddiqui` `@student.nullpointers.dev` | `Candidate@Demo2026` |

What the demo data contains:
- **CS-301 Databases · Quiz 3** - live now (window centred on the time the seed ran), stratified draw 3 easy / 2 medium / 1 hard, three candidates mid-attempt with signals, one announcement. Zainab, Ali, Usman and Mariam haven't started, so you can sit it as them.
- **CS-201 Data Structures · Midterm** - completed, graded (including written answers), results published, one open dispute.
- **CS-330 Computer Networks · Quiz 1** - published, opens tomorrow.
- **SE-410 Web Security · Final** - a draft whose publish checklist fails (paper worth 15, total set to 20).

Re-centre the live exam before a demo: `cd apps/api && bun run demo:remote` (or `demo:local`).

## What's implemented

| Brief | Where to see it |
|---|---|
| 3.1 Auth & authorisation | httpOnly session cookie, PBKDF2, rate-limited sign-in, role permissions checked on every API route (`requirePermission`), admins manage users/roles at **People** |
| 3.2 Exam management | **Exams** → New exam; Setup tab with publish checklist; draft → published → ongoing (derived) → completed |
| 3.3 Question bank | **Question bank**: topics, difficulty, single / multi-select (all-or-nothing or partial) / written; shuffled questions and options; papers snapshotted at start |
| 3.4 Candidates | Candidates tab (enrol by email or file); candidate **Overview** shows available / upcoming / completed with instructions; entry only inside the window |
| 3.5 Exam workspace | `/exam`: server-owned timer, navigator (answered / unanswered / for review), autosave, resume after refresh or on another device, review screen, submit, auto-submit at expiry |
| 3.6 Monitoring | Monitor tab: live progress, online status, signals (neutral wording, "not proof"), announcements, add time with a recorded reason |
| 3.7 Grading | Objective answers auto-marked on submit; Grading tab for written answers with mark limits; review before publishing |
| 3.8 Results & analytics | Results tab: publish/unpublish, mean/median/pass rate, distribution, topics, candidate table; candidates see only their own published results |
| 4.1 Network-aware UI | Save chip (Saved / Saving / Offline · n on this device), offline banner, app-wide connection banner |
| 4.2 PDF reports | Candidate result PDF (with QR) and examiner exam report PDF, generated on the server after access checks |
| 4.3 Sandbox | Setup tab → "Open sandbox": a real attempt flagged as sandbox, excluded from results, analytics and reports |
| 4.4 Bulk import | Questions (CSV/JSON) and candidates (CSV/JSON, creates accounts, downloadable one-time passwords) with per-row preview and errors |
| 4.5 Question analytics | Per question: full-marks %, skipped %, average, most common wrong option, labelled vs observed difficulty |
| 4.6 Verifiable reports | `/verify?code=…` (also the QR target): valid/invalid, exam, masked name, score, dates - nothing else |
| 4.7 Customisable workspace | Text size, one-at-a-time or all-on-one-page, high contrast, light/dark - remembered on the device |
| 4.8 Scratchpad | Notes (saved to the attempt) and a sketch canvas, never marked |

## Innovation challenges

**5.3 Failure-resilient examinations (primary).** The server owns the clock: the deadline is `min(start + duration, window end)`, and the browser only renders it using a measured offset, so changing the device clock does nothing. Every answer goes into a per-attempt queue in `localStorage` *before* the network is tried; the queue keeps the latest change per question, replays in order, retries with backoff and flushes the moment the browser is back online. A crash or refresh restores the queue. The server accepts a save only while the attempt is open and `now ≤ deadline + 5 s` (in-flight grace), and finalises an expired attempt with exactly what it accepted. A heartbeat every 15 s re-syncs the clock, feeds the examiner's online indicator and detects a second open session. Lost time is only ever compensated by an examiner, per attempt, with a recorded reason. Code: `apps/web/src/features/workspace/useSaveQueue.ts`, `apps/api/src/services/attempt.service.ts`.

**5.2 Fairness of randomised papers.** Examiners set how many easy / medium / hard questions each paper draws from a larger pool. Publishing is refused unless the pool can satisfy the plan and every possible paper is worth exactly the configured total (subsets of a level must share marks). Papers vary, difficulty and marks don't. Question analytics then flag questions whose observed difficulty differs from their label. Code: `paperProblems()` and `start()` in `apps/api/src/services`.

**5.4 Trust & dispute resolution.** Candidates dispute a specific question (or the whole result) on a published result. Examiners must accept or reject with a reason the candidate reads; an accepted dispute sets a new mark (validated against the question's marks), recalculates the total, is written to the audit log, and the public verification record shows the updated score and "last updated" date.

## Run it locally

Needs [Bun](https://bun.sh) 1.3+ and git. No Docker or cloud account.

```bash
bun run setup                        # install, local secrets, local D1, git hooks
cd apps/api && bun run demo:local    # fictional demo data (accounts above)
cd ../.. && bun run dev              # web http://localhost:3000 · api http://localhost:8787
```

Checks:

```bash
bun run check      # typecheck + API tests in the real Workers runtime + production build
bun run test:e2e   # Playwright (desktop + mobile)
bun run smoke -- https://nullpointers-exams.np-api.workers.dev
```

## Stack and why

| Layer | Choice | Reason |
|---|---|---|
| Hosting | One **Cloudflare Worker** serving the static Next.js export, the API and WebSockets | One origin: first-party session cookie, no CORS surface, one deploy |
| API | **Hono** + TypeScript | Small, fast, middleware chain for auth → permission → validation |
| Database | **Cloudflare D1** (SQLite) + **Drizzle** | Relational integrity (FKs, unique keys) enforces rules like one attempt per candidate |
| Realtime | **Durable Objects** WebSockets with 60 s tickets | Live monitor, announcements, time extensions; costs nothing when idle |
| Validation | **Zod** schemas in `packages/shared` | The browser form and the API run the same rules and messages |
| Web | **Next.js 16** static export, React 19, Tailwind 4, TanStack Query, Phosphor icons, Geist | Fast first load, works on low-end phones |
| PDF | **pdf-lib** in the Worker | Access is checked before any data is rendered |

No required feature depends on a paid API. Repo map and conventions: [`CLAUDE.md`](CLAUDE.md).

## Deploy (Cloudflare)

```bash
cd apps/api
bun x wrangler login
bun x wrangler d1 create nullpointers-db          # put the id in wrangler.jsonc
bun x wrangler d1 migrations apply DB --remote
bun x wrangler secret put JWT_SECRET              # 48+ random characters
bun run demo:remote                               # demo accounts + data
cd ../web && bun run build && cd ../api && bun x wrangler deploy
```
