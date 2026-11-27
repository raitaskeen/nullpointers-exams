---
name: presentation-prep
description: Fill in the pitch deck and architecture diagram and rehearse the 15-minute judge walkthrough on the deployed Vercel URL. Use in the hour before the freeze, after rubric-self-check has surfaced gaps.
---

## Steps

Use `docs/judge-playbook.md` - it has the 15-minute script mapped to every rubric line, the technology reasons and short answers to hard questions.

1. Fill `docs/pitch-deck-template.md`: problem (from the theme), target user, solution, architecture (embed the diagram), key technical decisions, demo script, "what we'd do with more time" (shows constraint awareness - don't skip).
2. Update `docs/architecture-diagram-template.md` - mermaid nodes labeled with the real files; regenerate the ERD from the Drizzle schema.
3. Demo script beats to show (each maps to a rubric line):
   - Register a new user -> show live field validation (same rule enforced by the API).
   - Core theme flow end to end.
   - Two windows side by side: a change in one appears live in the other (realtime).
   - Log in as a normal user -> show they can't see admin pages or other users' rows (RBAC, owner scope).
   - Admin deactivates a user -> their open session is cut off immediately.
   - Mention: tests run in the real Workers runtime, CI gates every deploy, secrets never in git.
4. Rehearse start to finish on the **deployed Vercel URL**, not localhost.
5. Before the freeze, pre-open tabs: the live app (logged in as admin in one window, normal user in a private window), the deck, the GitHub repo.
6. Check the projector converter/cable - the rules make it the team's job.

## Done when

A full dry run completes using only the deployed URL and the deck, without touching code.

## Pitfalls

- Rehearsing on localhost hides deploy-only problems (env vars, origins, cookies).
- Seed realistic demo data through the UI before the freeze - an empty app demos badly.
