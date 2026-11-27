import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { examPhase, scoreObjective, type PaperQuestion } from "@np/shared";
import {
  announcements,
  answers,
  attempts,
  enrollments,
  exams,
  incidents,
  type PaperItem,
} from "../db/schema";
import type { Db, SessionUser } from "../env";
import { AppError } from "../lib/errors";
import { isAdmin, managedExam, nowIso, randomCode, shuffle, asBatch } from "./access";
import { drawPlan, ExamService } from "./exam.service";

type Attempt = typeof attempts.$inferSelect;
/** Saves already in flight when the clock runs out still count (network latency), nothing later. */
const GRACE_MS = 5_000;

const strip = (p: PaperItem): PaperQuestion => ({
  id: p.id,
  type: p.type,
  prompt: p.prompt,
  options: p.options,
  marks: p.marks,
  scheme: p.scheme,
  topic: p.topic,
  difficulty: p.difficulty,
});

const isAnswered = (r: unknown) => (Array.isArray(r) ? r.length > 0 : typeof r === "string" ? r.trim().length > 0 : false);

/** Grades every objective question from the attempt's own snapshot and stores the totals. */
export async function gradeAttempt(db: Db, attempt: Attempt) {
  const rows = await db.select().from(answers).where(eq(answers.attemptId, attempt.id));
  let total = 0;
  let pending = 0;
  const updates = [];
  for (const item of attempt.paper) {
    const a = rows.find((r) => r.questionId === item.id);
    if (item.type === "written") {
      if (a?.manualScore != null) total += a.manualScore;
      else if (a && isAnswered(a.response)) pending++;
      continue;
    }
    const auto = scoreObjective(item, a?.response ?? null);
    const effective = a?.manualScore ?? auto; // a dispute override replaces the automatic mark
    total += effective;
    if (a) updates.push(db.update(answers).set({ autoScore: auto }).where(and(eq(answers.attemptId, attempt.id), eq(answers.questionId, item.id))));
  }
  updates.push(
    db.update(attempts).set({ score: Math.round(total * 100) / 100, pendingManual: pending, updatedAt: nowIso() }).where(eq(attempts.id, attempt.id)),
  );
  await db.batch(asBatch(updates));
  return { score: Math.round(total * 100) / 100, pendingManual: pending };
}

export class AttemptService {
  constructor(
    private readonly db: Db,
    private readonly user: SessionUser,
  ) {}

  // ---- Candidate home ---------------------------------------------------------------------------------------------

  async myExams() {
    if (!this.user.permissions.includes("exams:take")) throw AppError.forbidden();
    const rows = await this.db
      .select({ exam: exams, attempt: attempts })
      .from(enrollments)
      .innerJoin(exams, eq(exams.id, enrollments.examId))
      .leftJoin(attempts, and(eq(attempts.examId, exams.id), eq(attempts.candidateId, this.user.id), eq(attempts.isSandbox, false)))
      .where(and(eq(enrollments.candidateId, this.user.id), sql`${exams.status} != 'draft'`))
      .orderBy(asc(exams.startsAt));
    return rows.map(({ exam, attempt }) => ({
      id: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      passPercent: exam.passPercent,
      phase: examPhase(exam),
      resultsPublished: exam.resultsPublished,
      attempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            deadlineAt: attempt.deadlineAt,
            submittedAt: attempt.submittedAt,
            score: exam.resultsPublished ? attempt.score : null,
            maxScore: attempt.maxScore,
          }
        : null,
    }));
  }

  // ---- Start / resume ---------------------------------------------------------------------------------------------

  async start(examId: number, sandbox = false): Promise<{ attemptId: number; resumed: boolean }> {
    const exam = sandbox
      ? await managedExam(this.db, this.user, examId)
      : await this.db.select().from(exams).where(eq(exams.id, examId)).get();
    if (!exam) throw AppError.notFound("Exam");

    if (!sandbox) {
      if (!this.user.permissions.includes("exams:take")) throw AppError.forbidden();
      const enrolled = await this.db.select().from(enrollments).where(and(eq(enrollments.examId, examId), eq(enrollments.candidateId, this.user.id))).get();
      if (!enrolled || exam.status === "draft") throw AppError.notFound("Exam");
      const existing = await this.db.select().from(attempts).where(and(eq(attempts.examId, examId), eq(attempts.candidateId, this.user.id), eq(attempts.isSandbox, false))).get();
      if (existing) {
        const fresh = await this.finalizeIfExpired(existing);
        if (fresh.status !== "in_progress") throw AppError.conflict("You have already submitted this exam.");
        return { attemptId: existing.id, resumed: true };
      }
      const phase = examPhase(exam);
      if (phase === "upcoming") throw new AppError(403, "not_open", `This exam opens at ${exam.startsAt}.`);
      if (phase !== "ongoing") throw new AppError(403, "closed", "This exam is closed.");
    }

    const pool = await new ExamService(this.db, this.user).pool(examId);
    if (!pool.length) throw AppError.conflict("This exam has no questions yet.");

    // Fair randomisation (innovation 5.2): same number of questions from every difficulty for everyone.
    const plan = drawPlan(exam);
    const stratified = Object.values(plan).some((v) => v !== null);
    let chosen = pool;
    if (stratified) {
      chosen = (["easy", "medium", "hard"] as const).flatMap((level) => {
        const inLevel = pool.filter((q) => q.difficulty === level);
        return shuffle(inLevel).slice(0, plan[level] ?? 0);
      });
    }
    if (exam.shuffleQuestions) chosen = shuffle(chosen);
    const paper: PaperItem[] = chosen.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: exam.shuffleOptions && q.type !== "written" ? shuffle(q.options) : q.options,
      correct: q.correct,
      marks: q.marks,
      scheme: q.scheme,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    const now = Date.now();
    const byDuration = now + exam.durationMinutes * 60_000;
    const deadline = sandbox ? byDuration : Math.min(byDuration, Date.parse(exam.endsAt));
    try {
      const row = await this.db
        .insert(attempts)
        .values({
          examId,
          candidateId: this.user.id,
          isSandbox: sandbox,
          deadlineAt: new Date(deadline).toISOString(),
          paper,
          maxScore: paper.reduce((s, p) => s + p.marks, 0),
          verifyCode: randomCode(10),
          lastSeenAt: nowIso(),
        })
        .returning()
        .get();
      return { attemptId: row.id, resumed: false };
    } catch (err) {
      // Two tabs pressed Start at once: the unique index let exactly one through - resume it.
      if (String((err as { cause?: unknown })?.cause ?? err).includes("UNIQUE")) {
        const existing = await this.db.select().from(attempts).where(and(eq(attempts.examId, examId), eq(attempts.candidateId, this.user.id), eq(attempts.isSandbox, false))).get();
        if (existing) return { attemptId: existing.id, resumed: true };
      }
      throw err;
    }
  }

  // ---- Workspace --------------------------------------------------------------------------------------------------

  /** Load an attempt the current user may act on as the candidate (own attempt, or own sandbox). */
  private async own(attemptId: number) {
    const a = await this.db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
    if (!a || a.candidateId !== this.user.id) throw AppError.notFound("Attempt");
    return a;
  }

  /** Finalise an attempt whose time is up, using exactly the answers accepted before the deadline. */
  async finalizeIfExpired(a: Attempt): Promise<Attempt> {
    if (a.status !== "in_progress" || Date.now() <= Date.parse(a.deadlineAt) + GRACE_MS) return a;
    const updated = await this.db
      .update(attempts)
      .set({ status: "expired", submittedAt: a.deadlineAt, updatedAt: nowIso() })
      .where(and(eq(attempts.id, a.id), eq(attempts.status, "in_progress")))
      .returning()
      .get();
    if (updated) await gradeAttempt(this.db, updated);
    return (await this.db.select().from(attempts).where(eq(attempts.id, a.id)).get())!;
  }

  async state(attemptId: number) {
    const a = await this.finalizeIfExpired(await this.own(attemptId));
    const exam = await this.db.select().from(exams).where(eq(exams.id, a.examId)).get();
    const rows = await this.db.select().from(answers).where(eq(answers.attemptId, a.id));
    const notices = await this.db.select({ id: announcements.id, message: announcements.message, at: announcements.at }).from(announcements).where(eq(announcements.examId, a.examId)).orderBy(desc(announcements.id)).limit(20);
    return {
      attempt: {
        id: a.id,
        examId: a.examId,
        status: a.status,
        isSandbox: a.isSandbox,
        startedAt: a.startedAt,
        deadlineAt: a.deadlineAt,
        submittedAt: a.submittedAt,
        extraMinutes: a.extraMinutes,
        scratchpad: a.scratchpad,
      },
      exam: { id: exam!.id, title: exam!.title, instructions: exam!.instructions, totalMarks: exam!.totalMarks, blockCopyPaste: exam!.blockCopyPaste },
      // The answer key never leaves the server.
      paper: a.paper.map(strip),
      answers: rows.map((r) => ({ questionId: r.questionId, response: r.response, flagged: r.flagged, savedAt: r.savedAt })),
      announcements: notices,
      serverNow: nowIso(),
    };
  }

  async save(attemptId: number, input: { questionId: number; response: string[] | string | null; flagged?: boolean }) {
    const a = await this.finalizeIfExpired(await this.own(attemptId));
    if (a.status !== "in_progress") throw new AppError(409, "attempt_closed", "Time is up - this attempt has been submitted with your saved answers.");
    const item = a.paper.find((p) => p.id === input.questionId);
    if (!item) throw AppError.badRequest("That question isn't part of this paper.");

    let response = input.response;
    if (item.type === "written") {
      if (response !== null && typeof response !== "string") throw AppError.badRequest("Written answers must be text.");
    } else {
      if (response !== null && !Array.isArray(response)) throw AppError.badRequest("Choose from the options.");
      const valid = new Set(item.options.map((o) => o.id));
      const picked = [...new Set(response ?? [])];
      if (picked.some((p) => !valid.has(p))) throw AppError.badRequest("That option isn't part of this question.");
      if (item.type === "single" && picked.length > 1) throw AppError.badRequest("Choose only one option.");
      response = picked;
    }

    const savedAt = nowIso();
    const set: Partial<typeof answers.$inferInsert> = { response, savedAt };
    if (input.flagged !== undefined) set.flagged = input.flagged;
    await this.db.batch([
      this.db
        .insert(answers)
        .values({ attemptId: a.id, questionId: item.id, response, flagged: input.flagged ?? false, savedAt })
        .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set }),
      this.db.update(attempts).set({ lastSeenAt: savedAt }).where(eq(attempts.id, a.id)),
    ]);
    return { questionId: item.id, savedAt, deadlineAt: a.deadlineAt, serverNow: savedAt, examId: a.examId };
  }

  /** Heartbeat: keeps the examiner's online indicator honest and detects a second device/tab. */
  async heartbeat(attemptId: number, sessionId: string) {
    const a = await this.finalizeIfExpired(await this.own(attemptId));
    const now = nowIso();
    const ops = [this.db.update(attempts).set({ lastSeenAt: now, sessionId }).where(eq(attempts.id, a.id))];
    let otherSession = false;
    if (a.status === "in_progress" && a.sessionId && a.sessionId !== sessionId && a.lastSeenAt && Date.now() - Date.parse(a.lastSeenAt) < 20_000) {
      otherSession = true;
      ops.push(this.db.insert(incidents).values({ attemptId: a.id, type: "multiple_sessions", detail: "Attempt open in another tab or device" }) as never);
    }
    const gap = a.lastSeenAt ? Date.now() - Date.parse(a.lastSeenAt) : 0;
    if (a.status === "in_progress" && gap > 60_000) {
      ops.push(this.db.insert(incidents).values({ attemptId: a.id, type: "resumed", detail: `No contact for ${Math.round(gap / 1000)}s, then resumed` }) as never);
    }
    await this.db.batch(asBatch(ops));
    const since = await this.db.select({ id: announcements.id, message: announcements.message, at: announcements.at }).from(announcements).where(and(eq(announcements.examId, a.examId), gt(announcements.at, a.startedAt))).orderBy(desc(announcements.id)).limit(5);
    return { serverNow: now, deadlineAt: a.deadlineAt, status: a.status, otherSession, announcements: since };
  }

  async incident(attemptId: number, type: string, detail?: string) {
    const a = await this.own(attemptId);
    if (a.status !== "in_progress" || a.isSandbox) return { recorded: false, examId: a.examId };
    const n = await this.db.select({ n: sql<number>`count(*)` }).from(incidents).where(eq(incidents.attemptId, a.id)).get();
    if ((n?.n ?? 0) >= 300) return { recorded: false, examId: a.examId }; // cap noise
    await this.db.insert(incidents).values({ attemptId: a.id, type, detail: detail ?? null }).run();
    return { recorded: true, examId: a.examId };
  }

  async scratchpad(attemptId: number, text: string) {
    const a = await this.own(attemptId);
    if (a.status !== "in_progress") throw new AppError(409, "attempt_closed", "This attempt is closed.");
    await this.db.update(attempts).set({ scratchpad: text }).where(eq(attempts.id, a.id)).run();
    return { savedAt: nowIso() };
  }

  /** Idempotent: a double click, a retry or two tabs submit exactly once. */
  async submit(attemptId: number) {
    const a = await this.own(attemptId);
    const updated = await this.db
      .update(attempts)
      .set({ status: "submitted", submittedAt: nowIso(), updatedAt: nowIso() })
      .where(and(eq(attempts.id, a.id), eq(attempts.status, "in_progress")))
      .returning()
      .get();
    const final = updated ?? (await this.finalizeIfExpired(a));
    if (updated) await gradeAttempt(this.db, updated);
    const row = (await this.db.select().from(attempts).where(eq(attempts.id, a.id)).get())!;
    return { status: row.status, submittedAt: row.submittedAt ?? final.submittedAt, alreadySubmitted: !updated, examId: row.examId, isSandbox: row.isSandbox };
  }

  async discardSandbox(attemptId: number) {
    const a = await this.own(attemptId);
    if (!a.isSandbox) throw AppError.forbidden();
    await this.db.delete(attempts).where(eq(attempts.id, a.id)).run();
  }

  // ---- Results ----------------------------------------------------------------------------------------------------

  /** A candidate's own published results; examiners/admins may read any attempt of exams they manage. */
  async result(attemptId: number) {
    const a = await this.db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
    if (!a) throw AppError.notFound("Result");
    const exam = (await this.db.select().from(exams).where(eq(exams.id, a.examId)).get())!;
    const manager = this.user.permissions.includes("exams:manage") && (isAdmin(this.user) || exam.ownerId === this.user.id);
    const own = a.candidateId === this.user.id;
    if (!manager && !(own && exam.resultsPublished && !a.isSandbox)) throw AppError.notFound("Result");
    const rows = await this.db.select().from(answers).where(eq(answers.attemptId, a.id));
    return {
      attempt: { id: a.id, status: a.status, score: a.score, maxScore: a.maxScore, pendingManual: a.pendingManual, submittedAt: a.submittedAt, startedAt: a.startedAt, verifyCode: exam.resultsPublished ? a.verifyCode : null, isSandbox: a.isSandbox, candidateId: a.candidateId },
      exam: { id: exam.id, title: exam.title, passPercent: exam.passPercent, resultsPublished: exam.resultsPublished, resultsPublishedAt: exam.resultsPublishedAt },
      questions: a.paper.map((p, i) => {
        const r = rows.find((x) => x.questionId === p.id);
        const awarded = p.type === "written" ? (r?.manualScore ?? null) : (r?.manualScore ?? r?.autoScore ?? 0);
        return {
          number: i + 1,
          id: p.id,
          type: p.type,
          prompt: p.prompt,
          topic: p.topic,
          marks: p.marks,
          awarded,
          answered: isAnswered(r?.response),
          feedback: r?.feedback ?? null,
          // Examiners see the key and the response; candidates see their own response only (the key is protected).
          response: r?.response ?? null,
          options: p.options,
          correct: manager ? p.correct : undefined,
        };
      }),
    };
  }

  async myResults() {
    if (!this.user.permissions.includes("exams:take")) throw AppError.forbidden();
    const rows = await this.db
      .select({ a: attempts, exam: exams })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .where(and(eq(attempts.candidateId, this.user.id), eq(attempts.isSandbox, false), eq(exams.resultsPublished, true)))
      .orderBy(desc(exams.resultsPublishedAt));
    return rows.map(({ a, exam }) => ({
      attemptId: a.id,
      examId: exam.id,
      title: exam.title,
      score: a.score,
      maxScore: a.maxScore,
      percent: a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 1000) / 10 : 0,
      passed: a.maxScore ? ((a.score ?? 0) / a.maxScore) * 100 >= exam.passPercent : false,
      publishedAt: exam.resultsPublishedAt,
      verifyCode: a.verifyCode,
    }));
  }

  // ---- Manual grading (examiner) ------------------------------------------------------------------------------------

  async grade(attemptId: number, questionId: number, score: number, feedback: string | null | undefined) {
    const a = await this.db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
    if (!a) throw AppError.notFound("Attempt");
    await managedExam(this.db, this.user, a.examId);
    if (a.status === "in_progress") throw AppError.conflict("Wait until the candidate has submitted.");
    const item = a.paper.find((p) => p.id === questionId);
    if (!item) throw AppError.badRequest("That question isn't part of this paper.");
    if (item.type !== "written") throw AppError.badRequest("Objective questions are graded automatically (use a dispute to override).");
    if (score > item.marks) throw new AppError(422, "validation_failed", `The maximum for this question is ${item.marks} marks.`, { score: `Maximum is ${item.marks} marks` });
    await this.db
      .insert(answers)
      .values({ attemptId, questionId, response: null, manualScore: score, feedback: feedback ?? null, gradedBy: this.user.id })
      .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: { manualScore: score, feedback: feedback ?? null, gradedBy: this.user.id } })
      .run();
    const fresh = (await this.db.select().from(attempts).where(eq(attempts.id, attemptId)).get())!;
    return gradeAttempt(this.db, fresh);
  }

  async attemptsFor(examId: number) {
    await managedExam(this.db, this.user, examId);
    return this.db.select({ id: attempts.id }).from(attempts).where(and(eq(attempts.examId, examId), inArray(attempts.status, ["in_progress"])));
  }
}
