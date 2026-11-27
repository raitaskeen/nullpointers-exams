import { Hono } from "hono";
import { createSchema, updateSchema, type ResourceDef } from "@np/shared";
import type { AppEnv } from "../env";
import { audit } from "../lib/audit";
import { parseId, parseJson, parsePaging } from "../lib/validate";
import { requirePermission } from "../middleware/auth";
import { publish } from "../realtime/publish";
import { ResourceService, type ResourceTable } from "../services/resource.service";

/**
 * Full REST API for one resource, gated by `<name>:<action>` permissions:
 *   GET    /            list  (?page, pageSize, q, sort, dir, plus exact filters on enum/ref/int/boolean fields)
 *   GET    /options     {id,label}[] for dropdowns
 *   GET    /:id         one row
 *   POST   /            create  (201)
 *   PATCH  /:id         partial update
 *   DELETE /:id         delete  (204)
 * Generated route files call this, then add any custom endpoints for the theme on the returned router.
 */
export function resourceRouter(def: ResourceDef, table: ResourceTable) {
  const create = createSchema(def);
  const update = updateSchema(def);
  const p = (action: string) => requirePermission(`${def.name}:${action}`);
  const svc = (db: AppEnv["Variables"]["db"]) => new ResourceService(db, def, table);

  /** Owner-scoped rows aren't broadcast with data - other listeners may not be allowed to see them. */
  const notify = (c: Parameters<typeof publish>[0], type: "created" | "updated" | "deleted", id: number, data?: unknown) => {
    if (!def.realtime) return;
    publish(c, def.name, { type, id, by: c.get("user")?.id, data: def.scope === "global" ? data : undefined });
  };

  return new Hono<AppEnv>()
    .get("/", p("read"), async (c) => {
      const query = c.req.query();
      return c.json(await svc(c.get("db")).list(c.get("user")!, query, parsePaging(query)));
    })
    .get("/options", p("read"), async (c) => c.json(await svc(c.get("db")).options(c.get("user")!)))
    .get("/stats", p("read"), async (c) => c.json(await svc(c.get("db")).stats(c.get("user")!)))
    .get("/:id{[0-9]+}", p("read"), async (c) => c.json(await svc(c.get("db")).get(c.get("user")!, parseId(c))))
    .post("/", p("create"), async (c) => {
      const data = await parseJson(c, create);
      const row = await svc(c.get("db")).create(c.get("user")!, data);
      audit(c, "create", def.name, row.id);
      notify(c, "created", row.id, row);
      return c.json(row, 201);
    })
    .patch("/:id{[0-9]+}", p("update"), async (c) => {
      const id = parseId(c);
      const data = await parseJson(c, update);
      const row = await svc(c.get("db")).update(c.get("user")!, id, data);
      audit(c, "update", def.name, id);
      notify(c, "updated", id, row);
      return c.json(row);
    })
    .delete("/:id{[0-9]+}", p("delete"), async (c) => {
      const id = parseId(c);
      await svc(c.get("db")).remove(c.get("user")!, id);
      audit(c, "delete", def.name, id);
      notify(c, "deleted", id);
      return c.body(null, 204);
    });
}
