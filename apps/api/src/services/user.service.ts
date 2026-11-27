import { and, asc, count, eq, inArray, like, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Page } from "@np/shared";
import { permissions, rolePermissions, roles, userRoles, users } from "../db/schema";
import type { Db, SessionUser } from "../env";
import { AppError } from "../lib/errors";

type UserRow = typeof users.$inferSelect;

export class UserService {
  constructor(private readonly db: Db) {}

  /** User + role names + effective permissions in one D1 round trip. */
  async loadSessionUser(userId: number): Promise<(SessionUser & { tokenVersion: number }) | null> {
    const [userRows, roleRows, permRows] = await this.db.batch([
      this.db.select().from(users).where(eq(users.id, userId)).limit(1),
      this.db
        .select({ name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userId)),
      this.db
        .selectDistinct({ name: permissions.name })
        .from(userRoles)
        .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(eq(userRoles.userId, userId)),
    ]);
    const u = userRows[0];
    if (!u) return null;
    return {
      ...this.toPublic(u),
      roles: roleRows.map((r) => r.name),
      permissions: permRows.map((p) => p.name),
      tokenVersion: u.tokenVersion,
    };
  }

  findByEmail(email: string) {
    return this.db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }

  async list(opts: { page: number; pageSize: number; q?: string; role?: string }): Promise<Page<Omit<SessionUser, "permissions">>> {
    const where = and(
      opts.q ? or(like(users.email, `%${opts.q}%`), like(users.fullName, `%${opts.q}%`)) : undefined,
      opts.role
        ? sql`${users.id} in (select ur.user_id from user_roles ur join roles r on r.id = ur.role_id where r.name = ${opts.role})`
        : undefined,
    );
    const [rows, totals] = await this.db.batch([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(asc(users.id))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
      this.db.select({ n: count() }).from(users).where(where),
    ]);
    const ids = rows.map((r) => r.id);
    const roleRows = ids.length
      ? await this.db
          .select({ userId: userRoles.userId, name: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(inArray(userRoles.userId, ids))
      : [];
    return {
      items: rows.map((u) => ({ ...this.toPublic(u), roles: roleRows.filter((r) => r.userId === u.id).map((r) => r.name) })),
      total: totals[0]?.n ?? 0,
      page: opts.page,
      pageSize: opts.pageSize,
    };
  }

  async create(input: { email: string; fullName: string; passwordHash: string }, roleNames: string[]) {
    const created = await this.db
      .insert(users)
      .values({ email: input.email.toLowerCase(), fullName: input.fullName, passwordHash: input.passwordHash })
      .returning()
      .get();
    await this.setRoles(created.id, roleNames);
    return created;
  }

  async setRoles(userId: number, roleNames: string[]) {
    const roleRows = roleNames.length ? await this.db.select().from(roles).where(inArray(roles.name, roleNames)) : [];
    if (roleRows.length !== roleNames.length) throw AppError.badRequest("Unknown role", { roles: "One or more roles don't exist" });
    // One atomic batch: the user is never left with zero roles if the insert half fails.
    const ops = [
      this.db.delete(userRoles).where(eq(userRoles.userId, userId)),
      ...roleRows.map((r) => this.db.insert(userRoles).values({ userId, roleId: r.id })),
    ];
    await this.db.batch(ops as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }

  async update(userId: number, patch: { isActive?: boolean; fullName?: string }) {
    const set: Partial<UserRow> = { ...patch, updatedAt: new Date().toISOString() };
    // Deactivating also revokes every live session immediately.
    if (patch.isActive === false) {
      const u = await this.db.select({ tv: users.tokenVersion }).from(users).where(eq(users.id, userId)).get();
      if (u) set.tokenVersion = u.tv + 1;
    }
    const row = await this.db.update(users).set(set).where(eq(users.id, userId)).returning().get();
    if (!row) throw AppError.notFound("User");
    return row;
  }

  async bumpTokenVersion(userId: number) {
    const u = await this.db.select({ tv: users.tokenVersion }).from(users).where(and(eq(users.id, userId))).get();
    if (u) await this.db.update(users).set({ tokenVersion: u.tv + 1 }).where(eq(users.id, userId)).run();
  }

  toPublic(u: UserRow) {
    return { id: u.id, email: u.email, fullName: u.fullName, isActive: u.isActive, createdAt: u.createdAt };
  }
}
