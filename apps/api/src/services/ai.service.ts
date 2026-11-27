import { allResources, getResource, listFields, type ResourceDef } from "@np/shared";
import * as schema from "../db/schema";
import type { Db, SessionUser } from "../env";
import { ResourceService, type ResourceTable } from "./resource.service";

/**
 * The assistant's tools. All READ-ONLY and executed as the signed-in user: the same permission checks and
 * owner scoping as the REST API apply, so the model can never see a row the user couldn't open, and text
 * inside records (prompt injection) can't make it change anything.
 */

type ToolArgs = Record<string, unknown>;
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export const TOOL_SPECS = [
  {
    type: "function",
    function: {
      name: "search_records",
      description:
        "Search or list records of one resource the user can read. Use for any question about the user's data. Supports free-text query, exact filters on enum/boolean/ref fields, sorting and a small limit.",
      parameters: {
        type: "object",
        properties: {
          resource: { type: "string", description: "Resource name, e.g. 'tasks'." },
          query: { type: "string", description: "Optional free-text search." },
          filters: { type: "object", description: "Optional exact-match filters, e.g. {\"status\":\"done\"}.", additionalProperties: { type: "string" } },
          sort: { type: "string", description: "Optional field to sort by (default newest first)." },
          dir: { type: "string", enum: ["asc", "desc"] },
          limit: { type: "integer", minimum: 1, maximum: 25 },
        },
        required: ["resource"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_resource",
      description: "Totals and breakdowns (counts per value of every enum and boolean field) for one resource. Use for 'how many', 'what share', 'status overview' questions.",
      parameters: {
        type: "object",
        properties: { resource: { type: "string" } },
        required: ["resource"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_record",
      description: "Fetch one record by id with all its fields.",
      parameters: {
        type: "object",
        properties: { resource: { type: "string" }, id: { type: "integer" } },
        required: ["resource", "id"],
      },
    },
  },
] as const;

const tables = schema as unknown as Record<string, ResourceTable | undefined>;
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export class AiTools {
  constructor(
    private readonly db: Db,
    private readonly user: SessionUser,
  ) {}

  readable(): ResourceDef[] {
    return allResources().filter((r) => this.user.permissions.includes(`${r.name}:read`));
  }

  /** Short human label for the UI chip ("Looked up Tasks"). */
  label(call: ToolCall): string {
    try {
      const args = JSON.parse(call.arguments || "{}") as ToolArgs;
      const def = getResource(String(args.resource ?? ""));
      return def?.plural ?? String(args.resource ?? "your data");
    } catch {
      return "your data";
    }
  }

  private resolve(name: unknown): { def: ResourceDef; svc: ResourceService; table: ResourceTable } {
    const def = getResource(String(name ?? ""));
    if (!def || !this.user.permissions.includes(`${def.name}:read`)) {
      throw new Error(`Unknown or inaccessible resource "${String(name)}". Available: ${this.readable().map((r) => r.name).join(", ") || "none"}.`);
    }
    const table = tables[camel(def.name)];
    if (!table) throw new Error(`No table for ${def.name}`);
    return { def, table, svc: new ResourceService(this.db, def, table) };
  }

  async run(call: ToolCall): Promise<unknown> {
    let args: ToolArgs;
    try {
      args = JSON.parse(call.arguments || "{}") as ToolArgs;
    } catch {
      return { error: "Arguments were not valid JSON." };
    }
    try {
      switch (call.name) {
        case "search_records": {
          const { def, svc } = this.resolve(args.resource);
          const filters = (args.filters && typeof args.filters === "object" ? args.filters : {}) as Record<string, unknown>;
          const query: Record<string, string> = {};
          for (const [k, v] of Object.entries(filters)) if (k in def.fields) query[k] = String(v);
          if (typeof args.sort === "string") query.sort = args.sort;
          if (args.dir === "asc" || args.dir === "desc") query.dir = args.dir;
          const limit = Math.min(25, Math.max(1, Number(args.limit) || 10));
          const page = await svc.list(this.user, query, { page: 1, pageSize: limit, q: typeof args.query === "string" ? args.query.slice(0, 100) : undefined });
          return { resource: def.name, total: page.total, returned: page.items.length, items: page.items.map((r) => this.slim(def, r)) };
        }
        case "summarize_resource": {
          const { def, svc } = this.resolve(args.resource);
          return { resource: def.name, ...(await svc.stats(this.user)) };
        }
        case "get_record": {
          const { def, svc } = this.resolve(args.resource);
          return { resource: def.name, record: this.slim(def, await svc.get(this.user, Number(args.id)), true) };
        }
        default:
          return { error: `Unknown tool ${call.name}` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Tool failed" };
    }
  }

  /** Only fields the definition declares (+ id/dates): never internal columns. */
  private slim(def: ResourceDef, row: Record<string, unknown>, all = false) {
    const keys = all ? Object.keys(def.fields) : [...new Set([...listFields(def).map(([k]) => k), ...Object.keys(def.fields).slice(0, 6)])];
    const out: Record<string, unknown> = { id: row.id, link: `/app/${def.name}?view=${row.id}` };
    for (const k of keys) {
      const v = row[k];
      out[k] = typeof v === "string" && v.length > 400 ? `${v.slice(0, 400)}…` : v;
    }
    out.createdAt = row.createdAt;
    return out;
  }

  /** Prompt context: what this user can query, and the fields' shapes. */
  describe(): string {
    const lines = this.readable().map((r) => {
      const fields = Object.entries(r.fields)
        .map(([k, f]) => `${k}: ${f.type}${f.type === "enum" ? ` (${f.options.join("|")})` : ""}${f.type === "ref" ? ` -> ${f.to}` : ""}`)
        .join("; ");
      return `- ${r.name} ("${r.plural}"): ${fields}`;
    });
    return lines.length ? lines.join("\n") : "- (none - this user can't read any resources)";
  }
}

