# Team Role Split

The actual split for this team. The short version also lives in `CLAUDE.md` ("Who's doing what") - update both together.

Junaid had to leave for a family emergency; **Raitaskeen** took over his role (lead, backend, integration) on 2026-11-27.

| | Raitaskeen | Shahzaib | Rimza |
|---|---|---|---|
| **Primary role** | Lead: backend, auth/RBAC, the resource generator, deploys, integration | QA + deployment verification | Frontend polish, theming |
| **Owns skills** | `resource-generator`, `backend-scaffold`, `auth-rbac`, `realtime`, `deploy` | `qa-testing`, `rubric-self-check` | `frontend-theme` (+ the design skills) |
| **Owns agents** | `deploy-doctor` | `qa-runner`, `rubric-auditor` | `theme-rebrand` |
| **Background fit** | Whole-stack owner | MERN background - full-stack enough to test both layers meaningfully | React/Tailwind/JS - direct match for the UI layer |
| **Local setup** | Bun, git, `wrangler login`, Vercel + Cloudflare accounts | Bun, git (`bun run setup` gives the full local stack) | Bun, git (`bun run setup`, or point `API_ORIGIN` at a teammate's API) |
| **Also does** | Floats across Shahzaib's and Rimza's work when they're stuck | - | - |

Everyone runs the full stack locally with one command (`bun run setup` then `bun run dev`) - no Docker or cloud account needed for local work.

## Sync cadence

At every checkpoint in `docs/runbook.md` (roughly every 2 hours, plus T3:30).

## Tie-break rule

The lead makes the final call on scope cuts and the freeze time. Disagreements are resolved in under a minute, not debated.

## Git workflow

Trunk-based: small commits straight to `main`, pulled often. Each push runs CI and deploys (Vercel + Worker). Deliberate speed tradeoff for a 10-hour team of 3. `bun run gen` edits shared registry files - only one person generates at a time, then pushes immediately so others pull it.
