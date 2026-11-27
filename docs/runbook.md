# Competition-Day Runbook

The hour-by-hour plan for the 10-hour clock. This file is authoritative.

## The hard rule

**Organizers' rule:** "The website must be deployed to Vercel through a GitHub repository. If the last build on Vercel or the last GitHub commit is made between the submission deadline and the evaluation period, the team will be disqualified immediately."

We self-enforce a **freeze at T9:30** (30 minutes before the deadline): no commits, no pushes, no merges, no Worker deploys after it, whatever breaks. Set it the moment the deadline is announced:

```
bun run freeze <deadline minus 30 min, e.g. 2026-11-29T05:30:00+05:00>
```
and set the same value as the GitHub variable `FREEZE_AT`. The pre-push hook, the API deploy job and Claude's hooks then refuse to push or deploy after that time.

## Before the clock starts (T-30 to T0:00)

- Theme announced: read it together, out loud. 10-minute brainstorm on entities, fields, who uses it and what they need to see live.
- Confirm roles (`docs/role-split-template.md`).
- `git pull`, `bun install`, `bun run dev`, then `bun run smoke -- https://<app>.vercel.app` - baseline healthy before building on it.
- Set the freeze time.

## The 10 hours

| Time | What happens |
|---|---|
| **T0:00-0:30** | **Write** `docs/CASE_STUDY.md`: requirements verbatim, unclear/ambiguous/contradictory points + the assumption for each, constraints. Graded directly (Case Study Analysis). |
| **T0:30-1:30** | Generator sprint: `bun run gen` the core entities (referenced ones first), set `access`/`scope`/labels in `packages/shared/src/resources/*`, remove the practice `tasks`/`projects` (`bun run gen --remove tasks`, then `projects`). `bun run check`, push - prove the pipeline end to end on the live URL early. |
| **T1:30-3:30** | Build block 1 - core business rules as custom endpoints (`backend-scaffold` skill) + any bespoke screens. |
| **T3:30-3:45** | Checkpoint: sync, re-scope, run `rubric-auditor`. |
| **T3:45-5:45** | Build block 2 - remaining features, the realtime moment worth demoing (`realtime` skill), validation edge cases. |
| **T5:45-6:45** | Visual pass (`frontend-theme` skill / `theme-rebrand` agent): tokens, gradients, `site-config.ts` copy, hero screenshot, polish with the design skills. |
| **T6:45-7:45** | Stretch goals - **only if blocks 1-2 are solid**. |
| **T7:45-8:30** | QA (`qa-testing` skill / `qa-runner` agent) against the **deployed Vercel URL**: `bun run smoke -- <url>`, `E2E_BASE_URL=<url> bun run test:e2e`, `break-ui`. P0 bugs only from here. |
| **T8:30-9:00** | Presentation prep (`presentation-prep` skill): deck, diagrams + ERD, rubric self-check. Seed realistic demo data through the UI. |
| **T9:00-9:30** | Hard buffer. No new features. Last push; wait for Vercel + Deploy API to go green; final smoke on the live URL. |
| **T9:30** | **FREEZE.** Zero commits, pushes, merges, deploys. |
| **T9:30-10:00** | Standby: rehearse the pitch out loud. Pre-open tabs: live app as admin, live app as normal user (private window), deck, repo. Check the projector converter. |
| **Evaluation** | 15-minute live walkthrough on the deployed app. All three of us present (required by the rules). |

## If something breaks after the freeze

Nothing in code can fix it - that's the point. Explain it calmly in the pitch: "we found X in QA, here's the fix we'd ship next" demonstrates constraint awareness. A calm explanation beats a disqualification.
