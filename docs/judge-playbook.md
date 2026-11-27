# Judge playbook

How the 15-minute evaluation is likely to go, what earns marks, and how to answer the hard questions. Rehearse this on the **deployed Vercel URL**, never localhost.

## What they score (official criteria) and where our evidence is

| Criterion | What they look for | Our evidence - show it, don't describe it |
|---|---|---|
| Completion of requirements | Every requirement in the brief works | `docs/CASE_STUDY.md` requirement list, each one demoed live |
| Front-end / back-end validations | Bad input caught on both sides, clear messages | Empty submit (client message) → same rule from the API (422 under the same field). One Zod schema in `packages/shared` |
| Back-end architecture | Layering, separation, security | Route → Service → Model (`apps/api/src/routes`, `services`, `db/schema`), permission middleware, audit log, tests in the real runtime |
| Visual design: simplicity | Calm, uncluttered, one clear action per screen | Light-first, one brand color, generous spacing |
| Visual design: consistency | Same patterns everywhere | Every entity uses the same list/sheet/form; same empty/error/loading states; one icon family |
| Case study: analyze requirements | Unclear/contradictory points found and resolved | `CASE_STUDY.md` ambiguity table with our assumption for each |
| Case study: technical analysis + constraints | Tradeoffs stated, constraints named | "We chose X over Y because…", 10h clock, Vercel rule, team of 3 |
| Design approach: OO / best practices | Clear responsibilities, reuse | Service classes, one resource definition drives API + UI + tests, middleware composition |
| Database design | Sensible schema, keys, relationships | ERD in `docs/architecture-diagram-template.md`: FKs, unique keys, indexes, cascade rules, audit table |
| Technology selection reason | Why each tool | One sentence each - see below |
| Code and design gap | Diagram ↔ code match | Every diagram node names its file; open one live when asked |

## How judges usually test (be ready for each)

- **Break the forms**: empty submit, wrong email, short password, huge text, emoji, double-click save. → All handled; double submit is blocked; messages say how to fix.
- **Try to cheat access**: open an admin page as a normal user, paste another user's record URL. → "No access" state / 404; the API enforces it, not just the UI.
- **Refresh mid-task / press Back**: list filters, search, page and the open record all live in the URL.
- **Look at it on a phone**: hand them a phone or resize. → Cards instead of tables, drawer nav, 44px targets, nothing cut off down to 320px.
- **Ask "is it real-time?"**: two windows side by side.
- **Ask "what if the network drops?"**: offline banner, branded offline page, auto-reconnect.
- **Open DevTools**: zero console errors (CI checks this on every push).

## 15-minute demo script

| Min | Show | Rubric hit |
|---|---|---|
| 0:00 | One sentence: the problem from the brief and who it's for. Landing page on the projector. | Requirements |
| 1:00 | Register a new user: submit empty → field errors; fix → lands on dashboard. | Validations |
| 2:30 | Core flow of the theme end to end (create → list → open → edit). Use ⌘K to jump around. | Completion, UX |
| 5:00 | Two windows (admin + normal user in a private window): create in one, it appears in the other instantly. | Architecture, realtime |
| 6:30 | Normal user can't see People/admin pages; admin deactivates them → their session ends immediately. | Security, RBAC |
| 8:00 | Assistant: "How many tasks are in progress?" - it looks up live data, links each record. Say: read-only tools, user's own permissions. | Innovation |
| 9:30 | Switch to Urdu (RTL) and dark mode; show the phone layout. | Visual design, consistency |
| 10:30 | Architecture diagram + ERD, open one mapped file. CI: tests run in the real Workers runtime, e2e in real browsers on every push. | Design↔code, DB design, tech reasons |
| 12:00 | Case study: the ambiguities we found and how we resolved them; constraints; what we'd do next. | Case study analysis |
| 13:00 | Questions. | |

## Technology reasons (say these out loud)

- **Next.js on Vercel** - required by the rules, and gives us a preview URL for every change so we test before shipping.
- **Hono on Cloudflare Workers** - a tiny, fast API that runs close to every user with near-zero cold starts.
- **D1 + Drizzle** - a managed SQL database with a typed schema; migrations are generated from code, so the database can't drift from it.
- **Durable Objects** - real WebSockets that cost nothing when idle; no separate realtime service to run.
- **Shared Zod schemas** - one set of rules validates the browser form and the API, so they can never disagree.
- **Custom JWT in an httpOnly cookie + role/permission tables** - no third-party auth dependency on the day, scripts can't steal the session, and we can revoke it instantly.
- **Groq** - very low-latency inference, so assistant answers stream in under a second.

## Hard questions - short answers

- *"How is this secure?"* Sessions are httpOnly, Secure, SameSite cookies; passwords are PBKDF2-hashed with a per-user salt; every request re-checks the user's permissions on the server; sign-in is rate-limited; every write is in the audit log; secrets never touch git (CI scans for them).
- *"What stops the AI from leaking data?"* Its tools are read-only and run as the signed-in user, with the same permission and owner checks as the API. The key never reaches the browser.
- *"Why not just MongoDB/Firebase?"* The data is relational (records reference each other); SQL gives us foreign keys, constraints and an honest ERD.
- *"Did you build this in 10 hours?"* We prepared the foundation (auth, deploys, generator, design system) beforehand, which the rules allow; everything specific to this brief was built today - the git history shows it.
- *"What would you do with more time?"* Name 2-3 real next steps from `CASE_STUDY.md` - never "nothing".
- *"What was hardest?"* Pick one real problem from the day and how you solved it.

## Before the judges arrive

- [ ] Deployed URL open, logged in as admin; a private window logged in as a normal user.
- [ ] Realistic demo data entered through the UI (not "test123").
- [ ] Light mode, the brief's palette, zoom so the projector is readable.
- [ ] `docs/CASE_STUDY.md`, the diagram and ERD open in tabs.
- [ ] Projector converter tested. Phones charged. Everyone knows their section.
- [ ] Freeze is set; nobody pushes.
