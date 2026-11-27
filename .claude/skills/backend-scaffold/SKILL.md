---
name: backend-scaffold
description: Extend the Hono + Cloudflare Workers API beyond generated CRUD - custom endpoints, business rules, new services, config/bindings, error handling. Use when a feature needs logic a plain resource can't express (e.g. "book a room only if free", stats/aggregates, workflows). For a new entity use resource-generator first.
---

## Layout (apps/api)

```
src/index.ts                Worker entry (exports app + RealtimeRoom Durable Object)
src/app.ts                  middleware order + route mounting (GENERATOR markers)
src/env.ts                  Bindings (DB, REALTIME, AUTH_LIMITER, vars/secrets) + AppEnv
src/routes/*.ts             HTTP layer: parse -> call service -> respond. No SQL here.
src/routes/resource-router.ts  generic CRUD router every resource uses
src/services/*.service.ts   business logic classes (AuthService, UserService, ResourceService)
src/db/schema/*.ts          Drizzle tables (snake_case columns via casing)
src/lib/                    errors (AppError), validate (parseJson/parseId/parsePaging), tokens, password, audit
src/realtime/               Durable Object room + publish()
migrations/                 drizzle-kit output, applied by wrangler to D1
```

## Adding a custom endpoint (the common case)

Chain onto the generated router in `src/routes/resources/<name>.ts`:

```ts
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth";
import { parseJson } from "../../lib/validate";
import { AppError } from "../../lib/errors";
import { audit } from "../../lib/audit";
import { publish } from "../../realtime/publish";

bookingsRoutes.post("/:id{[0-9]+}/confirm", requirePermission("bookings:update"), async (c) => {
  const id = Number(c.req.param("id"));
  const db = c.get("db");
  // business rule -> throw AppError.conflict(...) / AppError.badRequest(...) with a human message
  ...
  audit(c, "confirm", "bookings", id);
  publish(c, "bookings", { type: "updated", id });
  return c.json(row);
});
```

Rules:
1. Validate every input with Zod (`parseJson(c, schema)`) - put reusable schemas in `packages/shared` so the web form uses the same one.
2. Gate with `requirePermission("<resource>:<action>")`. Add new permission strings to `CORE_PERMISSIONS` in `packages/shared/src/permissions.ts` (or rely on resource ones), then `bun run seed`.
3. Throw `AppError.*` for expected failures; never return ad-hoc error JSON. The global handler shapes everything as `{ error: { code, message, fields? } }`.
4. Keep SQL in a service class when it's more than a couple of lines - judges look for Route -> Service -> Model layering.
5. Use `db.batch([...])` for multi-statement writes that must succeed together (D1 has no interactive transactions).
6. Add an `it(...)` to `apps/api/test/resources/<name>.test.ts` next to `describeResource(...)` for each business rule.

## Config and secrets

- Non-secret config: `vars` in `apps/api/wrangler.jsonc` (prod) + `apps/api/.dev.vars` (local, gitignored). Add the key to `Bindings` in `src/env.ts`.
- Secrets: `bun x wrangler secret put NAME` (prod) and `.dev.vars` locally. Never commit them.

## Done when

`bun run typecheck && bun run test` pass and the endpoint works through the web origin (`http://localhost:3000/api/...`).

## Pitfalls

- `secureHeaders` is only on `/api/*` - a 101 WebSocket upgrade has immutable headers and would crash.
- Tests run in the real Workers runtime (workerd). Its compatibility date caps at what the test pool supports - keep `compatibility_date` in `wrangler.jsonc` at or below it.
- PBKDF2 is capped at 100,000 iterations on Workers - don't raise it.
- Never `await` slow side effects (audit, publish) in the request path - they use `waitUntil`.
