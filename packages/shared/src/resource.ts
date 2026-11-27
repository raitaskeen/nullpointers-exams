import { z } from "zod";

/**
 * A resource is one domain entity (e.g. "projects", "bookings"). Its definition is the single source of
 * truth: the API derives validation + permissions from it, the web app derives forms, tables and nav from
 * it, and `bun run gen` writes the matching Drizzle table. Edit the definition, not three copies.
 */

export const ACTIONS = ["read", "create", "update", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const ROLES = ["admin", "examiner", "candidate"] as const;
export type Role = (typeof ROLES)[number];

interface BaseField {
  label: string;
  required?: boolean;
  /** Show as a column in the list table (default: true for the first 4 non-text fields). */
  list?: boolean;
  /** Included in the list endpoint's `?q=` search (string-like fields only). */
  searchable?: boolean;
  help?: string;
}

export type FieldDef =
  | (BaseField & { type: "string" | "text" | "email" | "url"; min?: number; max?: number })
  | (BaseField & { type: "int" | "number"; min?: number; max?: number })
  | (BaseField & { type: "boolean" })
  | (BaseField & { type: "date" | "datetime" })
  | (BaseField & { type: "enum"; options: readonly [string, ...string[]] })
  | (BaseField & { type: "ref"; to: string; display?: string });

export type FieldType = FieldDef["type"];

export interface ResourceDef {
  /** URL + table + permission prefix. Plural, lower_snake/kebab-free: "projects". */
  name: string;
  /** Human labels. */
  singular: string;
  plural: string;
  /** lucide-react icon name used in the app nav. */
  icon?: string;
  /**
   * "owner": non-admins only see and change rows they created (admins, or anyone with `<name>:manage`,
   * see everything). "global": everyone with `<name>:read` sees every row.
   */
  scope: "global" | "owner";
  /** Which actions each non-admin role gets. Admins always get every action. */
  access: Partial<Record<Exclude<Role, "admin">, readonly Action[]>>;
  /** Broadcast created/updated/deleted events on the realtime topic `<name>`. */
  realtime?: boolean;
  fields: Record<string, FieldDef>;
}

export function defineResource<const T extends ResourceDef>(def: T): T {
  return def;
}

// ---------------------------------------------------------------------------------------------------------
// Validation derived from the definition - runs identically in the browser (react-hook-form) and the API.
// ---------------------------------------------------------------------------------------------------------

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

function fieldSchema(field: FieldDef, forUpdate = false): z.ZodType {
  let s: z.ZodType;
  switch (field.type) {
    case "string":
    case "text": {
      let str = z.string().trim();
      str = str.min(field.min ?? (field.required ? 1 : 0), field.required ? `${field.label} is required` : undefined);
      str = str.max(field.max ?? (field.type === "text" ? 5000 : 255));
      s = str;
      break;
    }
    case "email":
      s = z.email(`Enter a valid email`).max(field.max ?? 255);
      break;
    case "url":
      s = z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" }).max(field.max ?? 2048);
      break;
    case "int":
    case "number": {
      let n = field.type === "int" ? z.number().int(`${field.label} must be a whole number`) : z.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      s = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), n);
      break;
    }
    case "boolean":
      s = z.preprocess((v) => (v === "true" || v === "on" ? true : v === "false" ? false : v), z.boolean());
      break;
    case "date":
      s = z.iso.date(`${field.label} must be a date`);
      break;
    case "datetime":
      s = z
        .string()
        .refine((v) => !Number.isNaN(Date.parse(v)), `${field.label} must be a date and time`)
        .transform((v) => new Date(v).toISOString());
      break;
    case "enum":
      s = z.enum(field.options, { error: `Choose a valid ${field.label.toLowerCase()}` });
      break;
    case "ref":
      s = z.preprocess(
        (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
        z.number().int().positive(`Choose a ${field.label.toLowerCase()}`),
      );
      break;
  }

  // No default on update: a PATCH that omits a checkbox must leave the stored value alone.
  if (field.type === "boolean") return field.required || forUpdate ? s : s.default(false);
  if (field.required) {
    // Empty inputs arrive as "" (forms) or null/undefined (API). Check presence first with a human message,
    // and only then run the type checks - otherwise users see "expected string, received null".
    const present = z.any().refine((v) => v !== null && v !== undefined, { message: `${field.label} is required`, abort: true });
    return z.preprocess(emptyToNull, present.pipe(s));
  }
  return z.preprocess(emptyToNull, s.nullable().optional());
}

export function createSchema(def: ResourceDef) {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(def.fields)) shape[key] = fieldSchema(field);
  return z.object(shape).strict();
}

/** Partial update: only the fields sent are validated and written. */
export function updateSchema(def: ResourceDef) {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(def.fields)) shape[key] = fieldSchema(field, true).optional();
  return z.object(shape).strict();
}

/** Fields shown as list-table columns. */
export function listFields(def: ResourceDef): [string, FieldDef][] {
  const entries = Object.entries(def.fields);
  const explicit = entries.filter(([, f]) => f.list);
  if (explicit.length) return explicit;
  return entries.filter(([, f]) => f.type !== "text").slice(0, 4);
}

export function searchableFields(def: ResourceDef): string[] {
  const entries = Object.entries(def.fields);
  const explicit = entries.filter(([, f]) => f.searchable).map(([k]) => k);
  if (explicit.length) return explicit;
  return entries.filter(([, f]) => f.type === "string" || f.type === "email").map(([k]) => k);
}

/** Every permission a resource defines. `manage` lets a holder bypass owner scoping. */
export function resourcePermissions(def: ResourceDef): string[] {
  return [...ACTIONS.map((a) => `${def.name}:${a}`), `${def.name}:manage`];
}
