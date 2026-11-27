---
name: resource-generator
description: Scaffold a new domain entity end to end with one command - shared Zod definition, Drizzle/D1 table + migration, permission-checked Hono CRUD API with realtime + audit, API tests, and live UI (list/search/filter/create/edit/delete) at /app/<name>. The highest-leverage tool on competition day. Use whenever the theme needs a new entity, or to remove one.
---

## Purpose

The theme is unknown until 30 minutes before the clock starts. This turns "we need Bookings with a date, a status and a room" into a working, tested, permission-gated feature in under a minute.

## Command

```
bun run gen <name> <field>... [--scope owner|global] [--user read,create,update,delete|none] [--icon LucideName] [--singular Label] [--no-realtime] [--no-migrate]
bun run gen --remove <name>
```

Field syntax (append `!` for required). Use `/` between enum options (works in PowerShell and bash, no quoting needed):

| Type | Example | Stored as |
|---|---|---|
| string / text | `title:string!` `notes:text` | TEXT |
| email / url | `contact:email` `site:url` | TEXT, validated |
| int / number | `seats:int!` `price:number` | INTEGER / REAL |
| boolean | `paid:boolean` | INTEGER 0/1, defaults false |
| date / datetime | `day:date!` `startsAt:datetime` | ISO TEXT |
| enum | `status:enum=pending/confirmed/cancelled!` | TEXT with CHECK-like enum |
| ref | `roomId:ref=rooms!` | FK INTEGER (cascade if required, else set null) |

Example for a booking theme:
```
bun run gen rooms "name:string!" "capacity:int!" "floor:int" --scope global --user read --icon DoorOpen
bun run gen bookings "roomId:ref=rooms!" "day:date!" "status:enum=pending/confirmed/cancelled!" "notes:text" --icon CalendarCheck
```
Generate referenced resources first (rooms before bookings).

## What it writes

- `packages/shared/src/resources/<name>.ts` - the definition. **Edit this** for labels, `min`/`max`, `list`/`searchable` flags, `help` text and `access`. No migration needed for those.
- `apps/api/src/db/schema/<name>.ts` - Drizzle table (+ `id`, `createdBy`, `createdAt`, `updatedAt`, indexes on FK/enum columns)
- `apps/api/src/routes/resources/<name>.ts` - `resourceRouter(...)`: list (paging, `?q=` search, sort, exact filters), `/options`, get, create, PATCH, delete. Chain custom endpoints onto it.
- `apps/api/test/resources/<name>.test.ts` - the shared contract suite (401, 422, CRUD, partial update, permissions, owner scoping)
- Registers each one at its `GENERATOR:` marker, then runs `drizzle-kit generate`, local migrate and seed (new permissions exist immediately)

The web app needs no generated files: nav, dashboard count, list, form and edit pages come from the definition at `/app/<name>`. For a bespoke screen create `apps/web/src/app/app/<name>/page.tsx` - a static route beats the dynamic one.

## Access model

- Admins get every action on every resource.
- `--user` sets what the normal `user` role gets. `--scope owner` (default) means users only see rows they created; `global` means everyone with read sees all rows.
- Permission names are `<name>:read|create|update|delete|manage`. `manage` bypasses owner scope.

## Done when

`bun run test` passes (generated suite included) and `/app/<name>` lists, creates, edits and deletes in the browser.

## Pitfalls

- Changing columns after generating: edit `apps/api/src/db/schema/<name>.ts` and the definition together, then `bun run db:generate && bun run db:migrate`. Never edit an applied migration file.
- Names are kebab/plural (`order-items`); the TS export is camelCase (`orderItems`). Reserved: users, roles, permissions, auth, health, realtime, ws, new.
- Markers (`// GENERATOR:...`) must stay in place - the generator fails loudly rather than guessing if one is missing.
- `--remove` deletes source files only; run `bun run db:generate` afterwards for the DROP TABLE migration.
