# Judging Rubric Self-Check

Every line below is from the organizers' official "Evaluation Criteria" (`web-e-thon-tentative.pdf`). For each: point at real evidence, or write the gap and why. An honest "didn't get to X, here's why" reads better than silence - and is itself Case Study Analysis.

Run it after each runbook checkpoint (`rubric-self-check` skill / `rubric-auditor` agent), not only at the end.

---

## Completion of requirements

- [ ] Every requirement in `docs/CASE_STUDY.md` has a working feature on the **deployed Vercel URL**.
- Evidence: _____________________________________________

## Front-end / Back-end Validations

- [ ] One Zod schema per form, shared by browser and API (`packages/shared/src/resource.ts` `createSchema`, `packages/shared/src/auth.ts`). Same rule, same message, both sides.
- [ ] Server errors map onto the right field (`applyFieldErrors` in `apps/web/src/lib/api-client.ts`); 409/422 never show as a blank failure.
- [ ] Demo: submit an empty form (client message), then send the same bad data with curl (same message from the API, 422).
- Evidence: _____________________________________________

## Back-end Architecture

- [ ] Route -> Service -> Model layering: `apps/api/src/routes/*` -> `services/*.service.ts` -> `db/schema/*`.
- [ ] Permission-based RBAC, deny by default: `requirePermission("resource:action")` on every route; normalized roles/permissions tables.
- [ ] Security: httpOnly/Secure/SameSite session cookie, PBKDF2 + constant-time compare, instant revocation (token_version), rate-limited login, CSRF + CORS allowlist, secure headers, body limit, audit log.
- [ ] Realtime via Durable Objects with ticket auth (`apps/api/src/realtime/*`).
- [ ] Tested in the real Workers runtime (`apps/api/test/*`, `bun run test`).
- Evidence: _____________________________________________

## Visual Design

### Simplicity
- [ ] One type family (Inter), tokens only (`apps/web/src/theme/tokens.css`), no ad hoc inline colors.
- Evidence: _____________________________________________

### Consistency
- [ ] Every app screen uses the shared shell + `components/ui/*` + generated resource pages, so list/form/empty/error/loading states look identical everywhere.
- Evidence: _____________________________________________

## Case Study Analysis

### Analyzing requirements
- [ ] `docs/CASE_STUDY.md` lists requirements verbatim, every unclear/incomplete/ambiguous/contradictory point, and the assumption made to resolve each.
- Evidence: _____________________________________________

### Perform technical analysis
- [ ] `docs/CASE_STUDY.md` states the approach and its tradeoffs ("chose X over Y because...").
- Evidence: _____________________________________________

### Find constraints
- [ ] Constraints listed: 10-hour clock, 3 people, Vercel deployment required, no WordPress/scripts, submission freeze, plus the theme's own domain constraints.
- [ ] Deliberate simplicity tradeoffs cited as constraint-awareness: one database (D1) instead of a cluster, owner-scoped rows instead of complex ACLs, generated CRUD where it's enough instead of bespoke screens.
- Evidence: _____________________________________________

## Design Approach

### OO Analysis/Design or best practices of the relevant technology
- [ ] Classes with single responsibilities (`AuthService`, `UserService`, `ResourceService`, `RealtimeRoom`), typed boundaries (`AppEnv`, shared types), one definition per entity driving API + UI (no duplication), middleware composition for cross-cutting concerns.
- Evidence: _____________________________________________

### Database Design
- [ ] ERD in `docs/architecture-diagram-template.md` matches `apps/api/src/db/schema/*` for this theme: FKs, unique keys, indexes on FK/enum columns, cascade rules chosen deliberately.
- Evidence: _____________________________________________

## Technology Selection Reason

- [ ] One sentence per choice, ready to say out loud:
  - **Next.js on Vercel**: required by the rules; React 19 with file routing; a preview URL per PR for QA.
  - **Hono on Cloudflare Workers**: tiny, fast at the edge, near-zero cold starts, standard Web APIs; the free tier covers the event.
  - **D1 + Drizzle**: managed SQLite with zero ops, typed schema, migrations generated from code.
  - **Durable Objects**: real WebSockets with hibernation - live updates without a separate realtime service.
  - **Shared Zod schemas**: validation rules written once, enforced on both sides.
  - **Bun**: one fast tool for installs, scripts, the generator and seeding.
  - **Custom JWT-in-cookie + RBAC**: full control, no third-party auth account mid-event, instant revocation.
- [ ] Re-read them against the actual theme - don't recite on autopilot if the theme pushed something else.
- Evidence: _____________________________________________

## Code and design gap

### Mapping design to code
- [ ] Every node in `docs/architecture-diagram-template.md` names the file that implements it; be ready to open any of them live.
- Evidence: _____________________________________________

---

**Readiness verdict** (fill in before evaluation): ____ / 11 lines covered. Biggest remaining risk: _____________________________________________
