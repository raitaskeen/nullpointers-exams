import { describe, expect, it } from "vitest";
import { getResource, type FieldDef, type ResourceDef } from "@np/shared";
import { ADMIN, call, login, registerFresh } from "./client";

/** A valid value for each field type (creating referenced rows first, as admin). */
async function sampleValue(field: FieldDef, cookie: string): Promise<unknown> {
  switch (field.type) {
    case "string":
      return `Sample ${field.label}`;
    case "text":
      return `Longer sample text for ${field.label}.`;
    case "email":
      return "sample@example.com";
    case "url":
      return "https://example.com";
    case "int":
      return field.min ?? 1;
    case "number":
      return field.min ?? 1.5;
    case "boolean":
      return true;
    case "date":
      return "2026-11-28";
    case "datetime":
      return "2026-11-28T10:00:00.000Z";
    case "enum":
      return field.options[0];
    case "ref": {
      const target = getResource(field.to)!;
      const res = await call(`/api/${target.name}`, { method: "POST", cookie, json: await samplePayload(target, cookie) });
      if (res.status !== 201) throw new Error(`could not create ${field.to}: ${JSON.stringify(res.data)}`);
      return res.data.id;
    }
  }
}

export async function samplePayload(def: ResourceDef, cookie: string) {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(def.fields)) out[key] = await sampleValue(field, cookie);
  return out;
}

/**
 * Standard contract every generated resource must satisfy. Generated test files call this; add
 * theme-specific `it(...)` blocks next to it for custom endpoints and business rules.
 */
export function describeResource(name: string) {
  const def = getResource(name);
  if (!def) throw new Error(`Unknown resource ${name}`);
  const base = `/api/${def.name}`;
  const userCan = (a: string) => (((def.access as Record<string, readonly string[] | undefined>).candidate ?? []) as readonly string[]).includes(a);

  describe(`${def.plural} API`, () => {
    it("rejects anonymous requests", async () => {
      expect((await call(base)).status).toBe(401);
    });

    it("validates input with field-level errors", async () => {
      const admin = await login(ADMIN);
      const hasRequired = Object.values(def.fields).some((f) => f.required);
      const res = await call(base, { method: "POST", cookie: admin, json: { notAField: 1 } });
      expect(res.status).toBe(422);
      expect(res.data.error.fields).toBeTruthy();
      if (hasRequired) expect(Object.keys(res.data.error.fields).length).toBeGreaterThan(0);
    });

    it("supports full CRUD for admins", async () => {
      const admin = await login(ADMIN);
      const payload = await samplePayload(def, admin);

      const created = await call(base, { method: "POST", cookie: admin, json: payload });
      expect(created.status).toBe(201);
      const id = created.data.id;

      const list = await call(`${base}?pageSize=100`, { cookie: admin });
      expect(list.status).toBe(200);
      expect(list.data.items.some((r: { id: number }) => r.id === id)).toBe(true);

      expect((await call(`${base}/${id}`, { cookie: admin })).status).toBe(200);
      expect((await call(`${base}/options`, { cookie: admin })).status).toBe(200);

      const firstKey = Object.keys(def.fields)[0]!;
      const patched = await call(`${base}/${id}`, { method: "PATCH", cookie: admin, json: { [firstKey]: payload[firstKey] } });
      expect(patched.status).toBe(200);
      // A partial update must leave every field it didn't send exactly as it was (incl. booleans).
      for (const key of Object.keys(def.fields)) expect(patched.data[key]).toEqual(created.data[key]);

      expect((await call(`${base}/${id}`, { method: "DELETE", cookie: admin })).status).toBe(204);
      expect((await call(`${base}/${id}`, { cookie: admin })).status).toBe(404);
    });

    it("enforces the role's permissions", async () => {
      const { cookie } = await registerFresh();
      const res = await call(base, { cookie });
      expect(res.status).toBe(userCan("read") ? 200 : 403);
      if (!userCan("create")) {
        const admin = await login(ADMIN);
        const denied = await call(base, { method: "POST", cookie, json: await samplePayload(def, admin) });
        expect(denied.status).toBe(403);
      }
    });

    if (def.scope === "owner" && userCan("read")) {
      it("hides other users' rows (owner scope)", async () => {
        const admin = await login(ADMIN);
        const created = await call(base, { method: "POST", cookie: admin, json: await samplePayload(def, admin) });
        const { cookie } = await registerFresh();
        expect((await call(`${base}/${created.data.id}`, { cookie })).status).toBe(404);
        const list = await call(`${base}?pageSize=100`, { cookie });
        expect(list.data.items.some((r: { id: number }) => r.id === created.data.id)).toBe(false);
      });
    }
  });
}
