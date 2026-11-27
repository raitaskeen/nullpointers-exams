---
name: auth-rbac
description: Change authentication, sessions, roles or permissions - adding a role, changing what a role can do, password rules, session lifetime, the seeded admin. Use when auth behaviour itself changes. For gating a new endpoint just use requirePermission("<resource>:<action>"); for a resource's role access edit its `access` in packages/shared.
---

## How it works

- **Sessions**: login/register sets `np_session`, an HS256 JWT in an **httpOnly, Secure, SameSite=Lax** cookie (12h). JavaScript never sees it. The web app calls same-origin `/api/*`; Next.js rewrites to the Worker, so the cookie is first-party. Bearer tokens are also accepted (scripts/tests).
- **Every request re-loads** the user, roles and permissions from D1 (one batched round trip). So deactivation, role changes and logout-all apply instantly. The token carries `tv` (token version); bumping `users.token_version` revokes every session.
- **Passwords**: PBKDF2-SHA256, 100k iterations, random 16-byte salt, constant-time compare, dummy hash for unknown emails (same timing and error either way). Rules live in `passwordSchema` (`packages/shared/src/auth.ts`).
- **RBAC**: tables `roles`, `permissions`, `user_roles`, `role_permissions`. Permission strings `resource:action`. Deny by default via `requirePermission`. Roles come from `ROLES` in `packages/shared/src/resource.ts`; grants are computed by `permissionsForRole` and synced by the seed.
- **Abuse protection**: Workers Rate Limiting binding `AUTH_LIMITER` (10/min per IP+email) on login/register; CSRF via SameSite + `hono/csrf` origin check; CORS allowlist from `WEB_ORIGINS`; body limit 1MB; audit log for login, failed login, register, logout-all and every write.

## Common changes

| Want | Do |
|---|---|
| New role (e.g. `staff`) | Add to `ROLES`; give resources `access: { user: [...], staff: [...] }`; `bun run seed` |
| Change what users can do on a resource | Edit `access` in `packages/shared/src/resources/<name>.ts`; `bun run seed` |
| Hand-written permission | Add to `CORE_PERMISSIONS` in `packages/shared/src/permissions.ts`; grant in `permissionsForRole`; seed |
| Admin email/password | Local: `ADMIN_EMAIL`/`ADMIN_PASSWORD` env then `bun run seed`. Prod: GitHub secret `ADMIN_PASSWORD` (seeded on every API deploy) |
| Session length | `SESSION_TTL_SECONDS` in `apps/api/src/lib/tokens.ts` |
| UI gating | `useAuth().can("x:y")` / `<RequirePermission permission="x:y">` - UX only; the API is the real boundary |

## Done when

`bun run test` passes (auth suite covers cookie flags, revocation, tampering, CSRF, role guard rails) and the change is visible after re-login.

## Pitfalls

- Never put the session token in localStorage or a readable cookie.
- An admin can't remove their own admin role or deactivate themselves (guard in `routes/users.ts`) - keep it, it saves demos.
- `JWT_SECRET` must be 32+ chars; rotating it logs everyone out.
- Redirect targets after login go through `safeNext()` (blocks open redirects) - keep using it.
