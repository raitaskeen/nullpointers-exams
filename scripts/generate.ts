#!/usr/bin/env bun
/**
 * Resource generator - one command per domain entity on competition day.
 *
 *   bun run gen <name> <field>... [options]
 *   bun run gen --remove <name>
 *
 * Fields (append ! for required):
 *   title:string!   notes:text   email:email   site:url   qty:int   price:number   done:boolean
 *   due:date   startsAt:datetime   status:enum=todo/doing/done!   projectId:ref=projects
 *
 * Options:
 *   --singular Task      label override (default: derived from the name)
 *   --scope owner        "owner" (users see only their rows, default) or "global" (everyone sees all rows)
 *   --user read,create   actions the normal "user" role gets (default: read,create,update,delete; "none" for admin-only)
 *   --icon ListChecks    Phosphor icon name (see apps/web/src/components/ResourceIcon.tsx)
 *   --no-realtime        don't broadcast changes over WebSockets
 *   --no-migrate         only write files; skip drizzle-kit generate + local migrate + seed
 *
 * Writes:
 *   packages/shared/src/resources/<name>.ts          definition (validation, labels, permissions)  <- edit this
 *   apps/api/src/db/schema/<name>.ts                 Drizzle table
 *   apps/api/src/routes/resources/<name>.ts          CRUD routes (+ room for custom endpoints)
 *   apps/api/test/resources/<name>.test.ts           API tests
 * and registers each one at its `GENERATOR:` marker. The web app picks the resource up automatically
 * (nav, list, create, edit pages) from the shared definition - no frontend files are generated.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const P = {
  def: (f: string) => join(ROOT, "packages/shared/src/resources", `${f}.ts`),
  defIndex: join(ROOT, "packages/shared/src/resources/index.ts"),
  table: (f: string) => join(ROOT, "apps/api/src/db/schema", `${f}.ts`),
  schemaIndex: join(ROOT, "apps/api/src/db/schema/index.ts"),
  route: (f: string) => join(ROOT, "apps/api/src/routes/resources", `${f}.ts`),
  app: join(ROOT, "apps/api/src/app.ts"),
  test: (f: string) => join(ROOT, "apps/api/test/resources", `${f}.test.ts`),
};

const FIELD_TYPES = ["string", "text", "email", "url", "int", "number", "boolean", "date", "datetime", "enum", "ref"] as const;
type FieldType = (typeof FIELD_TYPES)[number];
const RESERVED = new Set(["users", "roles", "permissions", "user-roles", "role-permissions", "audit-log", "auth", "health", "realtime", "ws", "new"]);
const ACTIONS = ["read", "create", "update", "delete"];

interface Field {
  key: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  to?: string;
}

function fail(msg: string): never {
  console.error(`\n  x ${msg}\n`);
  process.exit(1);
}

// ---- naming ------------------------------------------------------------------------------------------------
const words = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
const camel = (s: string) => words(s).map((w, i) => (i ? w[0]!.toUpperCase() + w.slice(1) : w)).join("");
const kebab = (s: string) => words(s).join("-");
const snake = (s: string) => words(s).join("_");
const title = (s: string) => {
  const w = words(s).join(" ");
  return w[0]!.toUpperCase() + w.slice(1);
};
const singularize = (s: string) =>
  s.endsWith("ies") ? `${s.slice(0, -3)}y` : /(ses|xes|zes|ches|shes)$/.test(s) ? s.slice(0, -2) : s.endsWith("s") ? s.slice(0, -1) : s;

// ---- marker editing: fail loudly, never guess -----------------------------------------------------------------
function insertBefore(file: string, marker: string, line: string) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const idx = lines.findIndex((l) => l.includes(`GENERATOR:${marker}`));
  if (idx === -1) fail(`Marker GENERATOR:${marker} is missing from ${file}. Restore it (see git history) and re-run.`);
  if (src.includes(line.trim())) return;
  const indent = lines[idx]!.match(/^\s*/)![0];
  lines.splice(idx, 0, indent + line.trim());
  writeFileSync(file, lines.join("\n"));
}

function removeLine(file: string, line: string) {
  const src = readFileSync(file, "utf8");
  writeFileSync(file, src.split("\n").filter((l) => l.trim() !== line.trim()).join("\n"));
}

function write(file: string, content: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`  + ${file.slice(ROOT.length + 1).replaceAll("\\", "/")}`);
}

function run(cmd: string[], cwd: string) {
  console.log(`  $ ${cmd.join(" ")}`);
  const r = spawnSync(process.execPath, cmd, { cwd, stdio: "inherit" });
  if (r.status !== 0) fail(`Command failed: ${cmd.join(" ")}`);
}

// ---- parse args ----------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = new Map<string, string | true>();
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (["singular", "scope", "user", "icon", "remove"].includes(key) && next && !next.startsWith("--")) {
      flags.set(key, next);
      i++;
    } else flags.set(key, true);
  } else positional.push(a);
}

if (flags.has("remove")) {
  removeResource(String(flags.get("remove")));
  process.exit(0);
}

const [rawName, ...rawFields] = positional;
if (!rawName || rawFields.length === 0) {
  console.log(readFileSync(import.meta.path, "utf8").split("*/")[0]!.replace(/^#!.*\n\/\*\*?/, "").replace(/^ \* ?/gm, ""));
  process.exit(rawName ? 1 : 0);
}

const name = kebab(rawName);
const key = camel(rawName);
const tableName = snake(rawName);
if (!/^[a-z][a-z0-9-]*$/.test(name)) fail(`"${rawName}" isn't a valid resource name - use letters and numbers, e.g. bookings or order-items.`);
if (RESERVED.has(name)) fail(`"${name}" is reserved by the core app. Pick another name.`);
if (existsSync(P.def(name))) fail(`Resource "${name}" already exists. Edit packages/shared/src/resources/${name}.ts, or run: bun run gen --remove ${name}`);

const fields: Field[] = rawFields.map((spec) => {
  const m = spec.match(/^([A-Za-z][A-Za-z0-9]*):([a-z]+)(?:=([^!]+))?(!)?$/);
  if (!m) fail(`Can't read field "${spec}". Format: name:type, name:type!, status:enum=a/b/c, projectId:ref=projects`);
  const [, k, t, arg, bang] = m;
  if (!FIELD_TYPES.includes(t as FieldType)) fail(`Unknown type "${t}" in "${spec}". Types: ${FIELD_TYPES.join(", ")}`);
  const f: Field = { key: camel(k!), type: t as FieldType, required: !!bang };
  if (["id", "createdBy", "createdAt", "updatedAt"].includes(f.key)) fail(`"${f.key}" is added automatically - remove it.`);
  if (f.type === "enum") {
    f.options = (arg ?? "").split("/").map((o) => o.trim()).filter(Boolean);
    if (f.options.length < 1) fail(`Enum "${k}" needs options, e.g. ${k}:enum=draft/live/closed`);
  }
  if (f.type === "ref") {
    if (!arg) fail(`Ref "${k}" needs a target, e.g. ${k}:ref=projects`);
    f.to = kebab(arg);
    if (!existsSync(P.def(f.to))) fail(`Ref "${k}" points at "${f.to}", which doesn't exist yet. Generate it first.`);
  }
  return f;
});
if (new Set(fields.map((f) => f.key)).size !== fields.length) fail("Two fields have the same name.");

const scope = flags.get("scope") === "global" ? "global" : "owner";
const userFlag = String(flags.get("user") ?? ACTIONS.join(","));
const userActions = userFlag === "none" ? [] : userFlag.split(",").map((s) => s.trim());
for (const a of userActions) if (!ACTIONS.includes(a)) fail(`Unknown action "${a}" in --user. Use: ${ACTIONS.join(",")} or none`);
const singular = typeof flags.get("singular") === "string" ? String(flags.get("singular")) : title(singularize(name));
const plural = title(name);
const icon = typeof flags.get("icon") === "string" ? String(flags.get("icon")) : "Cube";
const realtime = !flags.has("no-realtime");

// ---- 1. shared definition --------------------------------------------------------------------------------------
const fieldLabel = (f: Field) => (f.type === "ref" ? title(f.key.replace(/Id$/, "")) : title(f.key));
const fieldDef = (f: Field) => {
  const parts = [`type: "${f.type}"`, `label: "${fieldLabel(f)}"`];
  if (f.required) parts.push("required: true");
  if (f.type === "enum") parts.push(`options: [${f.options!.map((o) => `"${o}"`).join(", ")}]`);
  if (f.type === "ref") parts.push(`to: "${f.to}"`);
  return `    ${f.key}: { ${parts.join(", ")} },`;
};

write(
  P.def(name),
  `import { defineResource } from "../resource";

/** ${plural}. Generated by \`bun run gen\` - edit freely: labels, limits (min/max), list/searchable flags, access. */
export const ${key} = defineResource({
  name: "${name}",
  singular: "${singular}",
  plural: "${plural}",
  icon: "${icon}",
  scope: "${scope}",
  access: { user: [${userActions.map((a) => `"${a}"`).join(", ")}] },
  realtime: ${realtime},
  fields: {
${fields.map(fieldDef).join("\n")}
  },
});
`,
);
insertBefore(P.defIndex, "IMPORTS", `import { ${key} } from "./${name}";`);
insertBefore(P.defIndex, "ENTRIES", `${key},`);

// ---- 2. Drizzle table ------------------------------------------------------------------------------------------
const col = (f: Field) => {
  let c: string;
  switch (f.type) {
    case "int":
      c = "integer()";
      break;
    case "number":
      c = "real()";
      break;
    case "boolean":
      c = "integer({ mode: \"boolean\" })";
      break;
    case "enum":
      c = `text({ enum: [${f.options!.map((o) => `"${o}"`).join(", ")}] })`;
      break;
    case "ref":
      c = `integer().references(() => ${camel(f.to!)}.id, { onDelete: "${f.required ? "cascade" : "set null"}" })`;
      break;
    default:
      c = "text()";
  }
  if (f.type === "boolean") return `  ${f.key}: ${c}.notNull().default(false),`;
  return `  ${f.key}: ${c}${f.required ? ".notNull()" : ""},`;
};
const refs = [...new Set(fields.filter((f) => f.type === "ref").map((f) => f.to!))];
const indexed = fields.filter((f) => f.type === "ref" || f.type === "enum");

write(
  P.table(name),
  `import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps, users } from "./core";
${refs.map((r) => `import { ${camel(r)} } from "./${r}";`).join("\n")}

export const ${key} = sqliteTable(
  "${tableName}",
  {
    id: integer().primaryKey({ autoIncrement: true }),
${fields.map((f) => `  ${col(f)}`).join("\n")}
    createdBy: integer().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("${tableName}_created_by_idx").on(t.createdBy),
${indexed.map((f) => `    index("${tableName}_${snake(f.key)}_idx").on(t.${f.key}),`).join("\n")}
  ],
);
`.replace(/\n\n\n/g, "\n\n"),
);
insertBefore(P.schemaIndex, "SCHEMA", `export * from "./${name}";`);

// ---- 3. API routes -----------------------------------------------------------------------------------------------
write(
  P.route(name),
  `import { resources } from "@np/shared";
import { ${key} } from "../../db/schema";
import { resourceRouter } from "../resource-router";

/**
 * /api/${name} - list, options, get, create, update, delete (permission-checked, validated, audited${realtime ? ", broadcast live" : ""}).
 * Add theme-specific endpoints by chaining onto this router, e.g.
 *   ${key}Routes.get("/stats", requirePermission("${name}:read"), async (c) => c.json(...));
 */
export const ${key}Routes = resourceRouter(resources.${key}, ${key});
`,
);
insertBefore(P.app, "ROUTE_IMPORTS", `import { ${key}Routes } from "./routes/resources/${name}";`);
insertBefore(P.app, "ROUTES", `app.route("/api/${name}", ${key}Routes);`);

// ---- 4. tests ----------------------------------------------------------------------------------------------------
write(
  P.test(name),
  `import { describeResource } from "../helpers/resource-suite";

describeResource("${name}");
`,
);

console.log(`\n  Generated "${name}".`);

if (!flags.has("no-migrate")) {
  const api = join(ROOT, "apps/api");
  run(["x", "drizzle-kit", "generate", "--name", tableName], api);
  run(["x", "wrangler", "d1", "migrations", "apply", "DB", "--local"], api);
  run(["scripts/seed.ts", "--local"], api);
}

console.log(`
  Next:
    - Tweak labels/limits/access in packages/shared/src/resources/${name}.ts (no migration needed for those)
    - UI is live at /app/${name} - restart nothing, Next.js hot-reloads
    - bun run test      (runs the generated API tests)
    - Changed the table later? edit apps/api/src/db/schema/${name}.ts, then: bun run db:generate && bun run db:migrate
`);

// ---- remove -----------------------------------------------------------------------------------------------------
function removeResource(raw: string) {
  const n = kebab(raw);
  const k = camel(raw);
  if (!existsSync(P.def(n))) fail(`No resource "${n}".`);
  for (const f of [P.def(n), P.table(n), P.route(n), P.test(n)]) rmSync(f, { force: true });
  removeLine(P.defIndex, `import { ${k} } from "./${n}";`);
  removeLine(P.defIndex, `${k},`);
  removeLine(P.schemaIndex, `export * from "./${n}";`);
  removeLine(P.app, `import { ${k}Routes } from "./routes/resources/${n}";`);
  removeLine(P.app, `app.route("/api/${n}", ${k}Routes);`);
  console.log(`  Removed "${n}" source files. Run \`bun run db:generate\` to create the DROP TABLE migration, then \`bun run db:migrate\`.`);
}
