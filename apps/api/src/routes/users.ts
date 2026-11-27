import { Hono } from "hono";
import { z } from "zod";
import { candidateImportRowSchema, emailSchema, passwordSchema, ROLES, type ImportResult } from "@np/shared";
import type { AppEnv } from "../env";
import { audit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { hashPassword } from "../lib/password";
import { parseId, parseJson, parsePaging } from "../lib/validate";
import { requirePermission } from "../middleware/auth";
import { randomCode } from "../services/access";
import { ExamService } from "../services/exam.service";
import { UserService } from "../services/user.service";

const patchUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    roles: z.array(z.enum(ROLES)).min(1).optional(),
  })
  .strict();

const createUserSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a name").max(100),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES, { error: "Choose a role" }),
});

/** Readable one-time password: 4 groups, letters + digits, satisfies the password rules. */
const tempPassword = () => `${randomCode(4)}-${randomCode(4)}-${Math.floor(10 + Math.random() * 89)}`;

export const userRoutes = new Hono<AppEnv>()
  .get("/", requirePermission("users:read"), async (c) => {
    const role = c.req.query("role");
    return c.json(await new UserService(c.get("db")).list({ ...parsePaging(c.req.query()), role: role && (ROLES as readonly string[]).includes(role) ? role : undefined }));
  })
  .post("/", requirePermission("users:manage"), async (c) => {
    const input = await parseJson(c, createUserSchema);
    const svc = new UserService(c.get("db"));
    if (await svc.findByEmail(input.email)) throw AppError.conflict("A user with this email already exists.", { email: "Already registered" });
    const created = await svc.create({ email: input.email, fullName: input.fullName, passwordHash: await hashPassword(input.password) }, [input.role]);
    audit(c, "create", "users", created.id);
    return c.json(svc.toPublic(created), 201);
  })
  /**
   * Bulk candidate import (secondary 4.4). Admins and examiners. Each row is validated; existing emails are
   * skipped (and still enrolled); new accounts get a one-time password returned ONCE in this response so
   * the examiner can distribute it. Optionally enrols everyone into an exam.
   */
  .post("/import", async (c) => {
    const user = c.get("user");
    if (!user) throw AppError.unauthorized();
    if (!user.permissions.includes("users:manage") && !user.permissions.includes("exams:manage")) throw AppError.forbidden();
    const { rows, examId } = await parseJson(
      c,
      z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1, "The file has no rows").max(1000), examId: z.number().int().positive().optional() }),
    );
    const svc = new UserService(c.get("db"));
    const result: ImportResult & { credentials: { email: string; fullName: string; password: string }[] } = { created: 0, skipped: 0, errors: [], credentials: [] };
    const emails: string[] = [];
    const seen = new Set<string>();
    for (const [i, raw] of rows.entries()) {
      const rowNo = i + 2;
      const parsed = candidateImportRowSchema.safeParse(raw);
      if (!parsed.success) {
        result.errors.push({ row: rowNo, message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
        continue;
      }
      const { fullName, email } = parsed.data;
      if (seen.has(email)) {
        result.errors.push({ row: rowNo, message: `email: ${email} appears twice in the file` });
        continue;
      }
      seen.add(email);
      emails.push(email);
      if (await svc.findByEmail(email)) {
        result.skipped++;
        continue;
      }
      const password = tempPassword();
      await svc.create({ email, fullName, passwordHash: await hashPassword(password) }, ["candidate"]);
      result.created++;
      result.credentials.push({ email, fullName, password });
    }
    let enrolled: Awaited<ReturnType<ExamService["enroll"]>> | null = null;
    if (examId && emails.length) enrolled = await new ExamService(c.get("db"), user).enroll(examId, emails);
    audit(c, "import", "users", null);
    return c.json({ ...result, enrolled });
  })
  .patch("/:id{[0-9]+}", requirePermission("users:manage"), async (c) => {
    const id = parseId(c);
    const input = await parseJson(c, patchUserSchema);
    const self = c.get("user")!;
    // Guard rails: an admin can't lock themselves out mid-demo.
    if (id === self.id && (input.isActive === false || (input.roles && !input.roles.includes("admin")))) {
      throw AppError.badRequest("You can't deactivate yourself or remove your own admin role.");
    }
    const svc = new UserService(c.get("db"));
    const { roles, ...patch } = input;
    if (Object.keys(patch).length) await svc.update(id, patch);
    if (roles) await svc.setRoles(id, roles);
    audit(c, "update", "users", id);
    const updated = await svc.loadSessionUser(id);
    if (!updated) throw AppError.notFound("User");
    const { tokenVersion: _tv, ...publicUser } = updated;
    return c.json(publicUser);
  });
