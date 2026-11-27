---
name: rubric-self-check
description: Walk every line of the competition's judging rubric and confirm the project has real evidence for it before the judges arrive. Use at each runbook checkpoint and in the last hour before the freeze.
---

## Purpose

Turn the organizers' Evaluation Criteria into a concrete, checkable pass over the actual project.

## Preconditions

Core features exist; `docs/CASE_STUDY.md` was filled in during the first 30 minutes (see `docs/runbook.md`).

## Steps

1. Open `docs/rubric-checklist.md` - every official criterion mapped to concrete evidence in this repo.
2. For each line, find the evidence (a working feature on the deployed URL, a file, a diagram node, a paragraph in `docs/CASE_STUDY.md`) and note it - or write the gap plus a one-line reason. Honest gaps beat silence.
3. Watch the easy-to-forget lines:
   - **Technology Selection Reason** - the pre-written paragraphs must still match what was built for this theme.
   - **Code and design gap** - architecture diagram nodes in `docs/architecture-diagram-template.md` name real files.
   - **Database Design** - regenerate the ERD from `apps/api/src/db/schema/*` after the last `bun run gen`.
   - **Validations** - show the same message appearing client-side and from the API (shared Zod).
4. Report the gaps as a short prioritized list to the team.

## Done when

Every rubric line has evidence or an explicitly accepted gap.

## Pitfalls

- Run it at every checkpoint, not only at the end - gaps found at hour 4 are fixable.
