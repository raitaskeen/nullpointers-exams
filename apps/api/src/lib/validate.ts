import type { Context } from "hono";
import type { z } from "zod";
import { AppError } from "./errors";

/** Parse + validate a JSON body with a shared Zod schema. Failures become a 422 with per-field messages. */
export async function parseJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw AppError.badRequest("Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw AppError.validation(result.error);
  return result.data;
}

export function parseId(c: Context, param = "id"): number {
  const id = Number(c.req.param(param));
  if (!Number.isSafeInteger(id) || id <= 0) throw AppError.notFound();
  return id;
}

export function parsePaging(query: Record<string, string | undefined>) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize) || 20)));
  const q = query.q?.trim().slice(0, 100) || undefined;
  return { page, pageSize, q };
}
