import { and, asc, count, desc, eq, gte, like, or, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { searchableFields, type Page, type ResourceDef } from "@np/shared";
import type { Db, SessionUser } from "../env";
import { AppError } from "../lib/errors";

/** Every generated resource table has these columns (see `bun run gen`). */
export type ResourceTable = SQLiteTable & {
  id: SQLiteColumn;
  createdBy: SQLiteColumn;
  createdAt: SQLiteColumn;
  updatedAt: SQLiteColumn;
};

type Row = Record<string, unknown> & { id: number; createdBy: number | null };

/**
 * Generic, permission-aware data access for one resource. Routes stay thin (parse -> service -> respond);
 * all querying, scoping and constraint handling lives here and is covered by the API test suite.
 */
export class ResourceService {
  constructor(
    private readonly db: Db,
    private readonly def: ResourceDef,
    private readonly table: ResourceTable,
  ) {}

  private col(key: string): SQLiteColumn {
    const c = (this.table as unknown as Record<string, SQLiteColumn | undefined>)[key];
    if (!c) throw new Error(`Column ${key} missing on table ${this.def.name}`);
    return c;
  }

  /** Owner-scoped resources: non-managers only ever touch their own rows. */
  private scope(user: SessionUser): SQL | undefined {
    if (this.def.scope !== "owner" || user.permissions.includes(`${this.def.name}:manage`)) return undefined;
    return eq(this.table.createdBy, user.id);
  }

  async list(
    user: SessionUser,
    query: Record<string, string | undefined>,
    paging: { page: number; pageSize: number; q?: string },
  ): Promise<Page<Row>> {
    const conditions: (SQL | undefined)[] = [this.scope(user)];

    if (paging.q) {
      const fields = searchableFields(this.def);
      if (fields.length) conditions.push(or(...fields.map((f) => like(this.col(f), `%${paging.q}%`))));
    }

    // Exact-match filters, e.g. ?status=done&projectId=3 - only on fields where that makes sense.
    for (const [key, field] of Object.entries(this.def.fields)) {
      const raw = query[key];
      if (raw === undefined || raw === "") continue;
      if (field.type === "enum") conditions.push(eq(this.col(key), raw));
      else if (field.type === "ref" || field.type === "int") conditions.push(eq(this.col(key), Number(raw)));
      else if (field.type === "boolean") conditions.push(eq(this.col(key), raw === "true"));
    }

    const sortable = new Set(["id", "createdAt", "updatedAt", ...Object.keys(this.def.fields)]);
    const sortKey = query.sort && sortable.has(query.sort) ? query.sort : "id";
    const order = query.dir === "asc" ? asc(this.col(sortKey)) : desc(this.col(sortKey));
    const where = and(...conditions);

    const [items, totals] = await this.db.batch([
      this.db
        .select()
        .from(this.table)
        .where(where)
        .orderBy(order)
        .limit(paging.pageSize)
        .offset((paging.page - 1) * paging.pageSize),
      this.db.select({ n: count() }).from(this.table).where(where),
    ]);
    return { items: items as Row[], total: totals[0]?.n ?? 0, page: paging.page, pageSize: paging.pageSize };
  }

  /**
   * Dashboard numbers, scoped exactly like list(): total, new this week, a 14-day daily series, and counts
   * per value of every enum/boolean field. One D1 round trip (batched).
   */
  async stats(user: SessionUser): Promise<{
    total: number;
    lastWeek: number;
    series: { date: string; count: number }[];
    breakdowns: { field: string; label: string; values: { value: string; count: number }[] }[];
  }> {
    const scope = this.scope(user);
    const day = sql<string>`substr(${this.table.createdAt}, 1, 10)`;
    const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const groupable = Object.entries(this.def.fields).filter(([, f]) => f.type === "enum" || f.type === "boolean");

    const [totals, week, series, ...groups] = await this.db.batch([
      this.db.select({ n: count() }).from(this.table).where(scope),
      this.db.select({ n: count() }).from(this.table).where(and(scope, gte(this.table.createdAt, since(6)))),
      this.db
        .select({ date: day, n: count() })
        .from(this.table)
        .where(and(scope, gte(this.table.createdAt, since(13))))
        .groupBy(day)
        .orderBy(day),
      ...groupable.map(([key]) =>
        this.db.select({ value: this.col(key), n: count() }).from(this.table).where(scope).groupBy(this.col(key)),
      ),
    ] as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

    const byDay = new Map((series as unknown as { date: string; n: number }[]).map((r) => [r.date, r.n]));
    const days = Array.from({ length: 14 }, (_, i) => since(13 - i));

    return {
      total: (totals as unknown as { n: number }[])[0]?.n ?? 0,
      lastWeek: (week as unknown as { n: number }[])[0]?.n ?? 0,
      series: days.map((date) => ({ date, count: byDay.get(date) ?? 0 })),
      breakdowns: groupable.map(([key, field], i) => {
        const rows = (groups[i] as unknown as { value: unknown; n: number }[]) ?? [];
        const values =
          field.type === "enum"
            ? field.options.map((o) => ({ value: o, count: rows.find((r) => r.value === o)?.n ?? 0 }))
            : [true, false].map((b) => ({ value: String(b), count: rows.find((r) => Boolean(r.value) === b)?.n ?? 0 }));
        return { field: key, label: field.label, values };
      }),
    };
  }

  /** Compact {id,label} list for dropdowns that reference this resource. */
  async options(user: SessionUser): Promise<{ id: number; label: string }[]> {
    const labelKey =
      Object.entries(this.def.fields).find(([, f]) => f.type === "string" || f.type === "email")?.[0] ?? "id";
    const rows = await this.db
      .select({ id: this.table.id, label: this.col(labelKey) })
      .from(this.table)
      .where(this.scope(user))
      .orderBy(asc(this.col(labelKey)))
      .limit(500);
    return rows.map((r) => ({ id: Number(r.id), label: String(r.label ?? `#${r.id}`) }));
  }

  async get(user: SessionUser, id: number): Promise<Row> {
    const row = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), this.scope(user)))
      .get();
    if (!row) throw AppError.notFound(this.def.singular);
    return row as Row;
  }

  async create(user: SessionUser, data: Record<string, unknown>): Promise<Row> {
    return this.guard(async () => {
      const row = await this.db
        .insert(this.table)
        .values({ ...data, createdBy: user.id } as never)
        .returning()
        .get();
      return row as Row;
    });
  }

  async update(user: SessionUser, id: number, data: Record<string, unknown>): Promise<Row> {
    await this.get(user, id); // 404 if missing or not theirs
    return this.guard(async () => {
      const row = await this.db
        .update(this.table)
        .set({ ...data, updatedAt: new Date().toISOString() } as never)
        .where(eq(this.table.id, id))
        .returning()
        .get();
      return row as Row;
    });
  }

  async remove(user: SessionUser, id: number): Promise<void> {
    await this.get(user, id);
    await this.guard(() => this.db.delete(this.table).where(eq(this.table.id, id)).run());
  }

  /** Turn SQLite constraint failures into clear 409/422 responses instead of a 500. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const msg = String((err as { cause?: unknown })?.cause ?? err);
      if (msg.includes("UNIQUE constraint failed")) {
        const column = msg.match(/UNIQUE constraint failed: \w+\.(\w+)/)?.[1];
        throw AppError.conflict("That value is already taken.", column ? { [camel(column)]: "Already taken" } : undefined);
      }
      if (msg.includes("FOREIGN KEY constraint failed")) {
        throw new AppError(422, "invalid_reference", "This record is linked to something that doesn't exist or is still in use.");
      }
      throw err;
    }
  }
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
