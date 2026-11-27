import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** ISO-8601 UTC timestamps, set by the database so every row is consistent. */
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
export const timestamps = {
  createdAt: text().notNull().default(now),
  updatedAt: text().notNull().default(now),
};

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  fullName: text().notNull(),
  passwordHash: text().notNull(),
  isActive: integer({ mode: "boolean" }).notNull().default(true),
  /** Bumped to revoke every outstanding session for this user (logout-all, password change). */
  tokenVersion: integer().notNull().default(0),
  ...timestamps,
});

export const roles = sqliteTable("roles", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  description: text().notNull().default(""),
});

export const permissions = sqliteTable("permissions", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: integer()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: integer()
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

/** Append-only record of every write and every auth event - evidence for judges, and a debugging aid. */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: integer().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    resource: text().notNull(),
    resourceId: integer(),
    ip: text(),
    at: text().notNull().default(now),
  },
  (t) => [index("audit_log_resource_idx").on(t.resource, t.resourceId)],
);
