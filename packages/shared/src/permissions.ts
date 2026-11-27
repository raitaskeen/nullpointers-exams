import { resourcePermissions, type Role } from "./resource";
import { allResources } from "./resources";

/**
 * Every permission in the exam system. Checked on the server on every request (requirePermission);
 * the UI only uses them to decide what to show.
 */
export const CORE_PERMISSIONS = [
  "users:read", // see the user directory
  "users:manage", // create users, change roles, deactivate, bulk-import candidates
  "questions:manage", // own question bank (admins: all)
  "exams:manage", // create/configure/publish own exams, enrol, monitor, grade, publish results (admins: all)
  "exams:take", // see assigned exams, attempt them, see own published results, raise disputes
  "platform:admin", // cross-examiner visibility + platform settings
] as const;
export type Permission = (typeof CORE_PERMISSIONS)[number];

export const ALL_PERMISSIONS: string[] = [...CORE_PERMISSIONS, ...allResources().flatMap((r) => resourcePermissions(r))];

const GRANTS: Record<Role, readonly string[]> = {
  admin: ALL_PERMISSIONS,
  examiner: ["questions:manage", "exams:manage", "users:read"],
  candidate: ["exams:take"],
};

/** Which permissions each role gets (deny by default). Synced into role_permissions by the seed. */
export function permissionsForRole(role: Role): string[] {
  const extra = role === "admin" ? [] : allResources().flatMap((r) => {
    const actions: readonly string[] = (r.access as Record<string, readonly string[] | undefined>)[role] ?? [];
    return actions.map((a) => `${r.name}:${a}`);
  });
  return [...new Set([...GRANTS[role], ...extra])];
}

export function hasPermission(user: { permissions: string[] } | null | undefined, permission: string): boolean {
  return !!user && user.permissions.includes(permission);
}
