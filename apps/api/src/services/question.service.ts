import { and, asc, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import {
  questionImportRowSchema,
  questionInputSchema,
  type ImportResult,
  type QuestionInput,
} from "@np/shared";
import { examQuestions, questions } from "../db/schema";
import type { Db, SessionUser } from "../env";
import { AppError } from "../lib/errors";
import { isAdmin, asBatch } from "./access";

const LETTERS = "abcdefgh";

/** Reusable question bank. Examiners see and edit their own questions; admins see all. */
export class QuestionService {
  constructor(
    private readonly db: Db,
    private readonly user: SessionUser,
  ) {
    if (!user.permissions.includes("questions:manage")) throw AppError.forbidden();
  }

  private scope(): SQL | undefined {
    return isAdmin(this.user) ? undefined : eq(questions.ownerId, this.user.id);
  }

  async list(q: { search?: string; topic?: string; difficulty?: string; type?: string; page: number; pageSize: number }) {
    const conds: (SQL | undefined)[] = [this.scope()];
    if (q.search) conds.push(or(like(questions.prompt, `%${q.search}%`), like(questions.topic, `%${q.search}%`)));
    if (q.topic) conds.push(eq(questions.topic, q.topic));
    if (q.difficulty) conds.push(eq(questions.difficulty, q.difficulty as "easy"));
    if (q.type) conds.push(eq(questions.type, q.type as "single"));
    const where = and(...conds);
    const [items, total, topics] = await this.db.batch([
      this.db
        .select()
        .from(questions)
        .where(where)
        .orderBy(desc(questions.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(questions).where(where),
      this.db.selectDistinct({ topic: questions.topic }).from(questions).where(this.scope()).orderBy(asc(questions.topic)),
    ]);
    return { items, total: total[0]?.n ?? 0, page: q.page, pageSize: q.pageSize, topics: topics.map((t) => t.topic) };
  }

  async get(id: number) {
    const row = await this.db.select().from(questions).where(and(eq(questions.id, id), this.scope())).get();
    if (!row) throw AppError.notFound("Question");
    return row;
  }

  private normalize(input: QuestionInput) {
    return {
      topic: input.topic,
      difficulty: input.difficulty,
      type: input.type,
      prompt: input.prompt,
      options: input.type === "written" ? [] : input.options,
      correct: input.type === "written" ? [] : input.correct,
      marks: input.marks,
      scheme: input.type === "multiple" ? input.scheme : ("exact" as const),
      explanation: input.explanation ?? null,
    };
  }

  async create(input: QuestionInput) {
    return this.db.insert(questions).values({ ...this.normalize(input), ownerId: this.user.id }).returning().get();
  }

  /** Editing is safe even for questions in use: running attempts use their own snapshot. */
  async update(id: number, input: QuestionInput) {
    await this.get(id);
    return this.db
      .update(questions)
      .set({ ...this.normalize(input), updatedAt: new Date().toISOString() })
      .where(eq(questions.id, id))
      .returning()
      .get();
  }

  async remove(id: number) {
    await this.get(id);
    const used = await this.db.select({ n: count() }).from(examQuestions).where(eq(examQuestions.questionId, id)).get();
    if ((used?.n ?? 0) > 0) throw AppError.conflict("This question is used in an exam. Remove it from the exam first.");
    await this.db.delete(questions).where(eq(questions.id, id)).run();
  }

  async byIds(ids: number[]) {
    if (!ids.length) return [];
    return this.db.select().from(questions).where(and(inArray(questions.id, ids), this.scope()));
  }

  /**
   * Bulk import (secondary 4.4). Every row is validated with the same rules as the form; valid rows are
   * created, invalid rows are reported with their row number and the exact problem. Nothing half-saves.
   */
  async import(rows: Record<string, unknown>[]): Promise<ImportResult> {
    if (rows.length > 500) throw AppError.badRequest("Import at most 500 questions at a time.");
    const errors: ImportResult["errors"] = [];
    const valid: QuestionInput[] = [];
    rows.forEach((raw, i) => {
      const rowNo = i + 2; // +1 header, +1 one-based
      const parsed = questionImportRowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({ row: rowNo, message: parsed.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join("; ") });
        return;
      }
      const r = parsed.data;
      const optionTexts = r.options.split("|").map((s) => s.trim()).filter(Boolean);
      const options = optionTexts.map((text, k) => ({ id: LETTERS[k] ?? `o${k}`, text }));
      const correct = r.correct
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (/^\d+$/.test(s) ? LETTERS[Number(s) - 1] : s.toLowerCase()))
        .filter((s): s is string => !!s);
      const q = questionInputSchema.safeParse({ ...r, options, correct, explanation: null });
      if (!q.success) {
        errors.push({ row: rowNo, message: q.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join("; ") });
        return;
      }
      valid.push(q.data);
    });
    if (valid.length) {
      const values = valid.map((v) => ({ ...this.normalize(v), ownerId: this.user.id }));
      // D1 limits bound parameters per statement - insert in small chunks inside one batch.
      const chunks = [];
      for (let i = 0; i < values.length; i += 8) chunks.push(this.db.insert(questions).values(values.slice(i, i + 8)));
      await this.db.batch(asBatch(chunks));
    }
    return { created: valid.length, skipped: rows.length - valid.length, errors };
  }
}
