import { ALL_PERMISSIONS, ROLES, permissionsForRole } from "@np/shared";
import { hashPassword } from "../lib/password";

export interface SeedUser {
  email: string;
  fullName: string;
  password: string;
  role: string;
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

/**
 * Idempotent SQL that syncs roles + permissions from @np/shared and upserts the given users.
 * Used by scripts/seed.ts (local/remote D1) and by the test setup, so both always agree.
 */
export async function seedStatements(users: SeedUser[]): Promise<string[]> {
  const lines: string[] = [];
  for (const role of ROLES) {
    lines.push(`INSERT OR IGNORE INTO roles (name, description) VALUES (${q(role)}, ${q(role === "admin" ? "Full access" : "Standard user")})`);
  }
  for (const p of ALL_PERMISSIONS) lines.push(`INSERT OR IGNORE INTO permissions (name) VALUES (${q(p)})`);
  // Drop permissions that no longer exist in code (cascades to role_permissions).
  lines.push(`DELETE FROM permissions WHERE name NOT IN (${ALL_PERMISSIONS.map(q).join(", ")})`);
  lines.push(`DELETE FROM role_permissions`);
  for (const role of ROLES) {
    for (const p of permissionsForRole(role)) {
      lines.push(
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = ${q(role)} AND p.name = ${q(p)}`,
      );
    }
  }
  for (const u of users) {
    const hash = await hashPassword(u.password);
    lines.push(
      `INSERT INTO users (email, full_name, password_hash) VALUES (${q(u.email.toLowerCase())}, ${q(u.fullName)}, ${q(hash)}) ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, is_active = 1`,
      `INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.email = ${q(u.email.toLowerCase())} AND r.name = ${q(u.role)}`,
    );
  }
  return lines;
}
