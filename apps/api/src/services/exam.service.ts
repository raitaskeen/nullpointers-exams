import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { examPhase, type ExamInput } from "@np/shared";
import {
  announcements,
  answers,
  attempts,
  enrollments,
  examQuestions,
  exams,
  incidents,
  questions,
  roles,
  userRoles,
  users,
} from "../db/schema";
import type { Db, SessionUser } from "../env";
import { AppError } from "../lib/errors";
import { isAdmin, managedExam, nowIso, asBatch } from "./access";

type Exam = typeof exams.$inferSelect;
type Q = typeof questions.$inferSelect;

/** How many questions a paper draws per difficulty (null = all of that difficulty in the pool). */
export function drawPlan(exam: Pick<Exam, "drawEasy" | "drawMedium" | "drawHard">) {
  return { easy: exam.drawEasy, medium: exam.drawMedium, hard: exam.drawHard } as Record<"easy" | "medium" | "hard", number | null>;
}

/**
 * Checks that every candidate gets a paper of the same size, difficulty mix and total marks
 * (innovation 5.2). Returns human-readable problems; empty = publishable.
 */
export function paperProblems(exam: Exam, pool: Q[]) {
  const problems: string[] = [];
  if (!pool.length) return ["Add at least one question to the exam."];
  const plan = drawPlan(exam);
  const stratified = Object.values(plan).some((v) => v !== null);
  let paperMarks = 0;
  for (const level of ["easy", "medium", "hard"] as const) {
    const inLevel = pool.filter((q) => q.difficulty === level);
    const draw = stratified ? (plan[level] ?? 0) : inLevel.length;
    if (draw > inLevel.length) problems.push(`Draw ${draw} ${level} question(s), but only ${inLevel.length} are in the pool.`);
    if (stratified && draw > 0 && draw < inLevel.length) {
      const marks = new Set(inLevel.map((q) => q.marks));
      if (marks.size > 1) problems.push(`All ${level} questions must carry the same marks when drawing a subset, so every paper is worth the same.`);
    }
    paperMarks += inLevel.slice(0, Math.min(draw, inLevel.length)).reduce((s, q) => s + q.marks, 0);
  }
  if (Math.abs(paperMarks - exam.totalMarks) > 0.001)
    problems.push(`Each paper is worth ${paperMarks} marks, but the exam's total is set to ${exam.totalMarks}.`);
  if (Date.parse(exam.endsAt) <= Date.now()) problems.push("The exam window has already ended. Move the end time into the future.");
  return problems;
}

export class ExamService {
  constructor(
    private readonly db: Db,
    private readonly user: SessionUser,
  ) {}

  /** Exams this examiner manages (admins: all), with the numbers the list needs. */
  async list() {
    if (!this.user.permissions.includes("exams:manage")) throw AppError.forbidden();
    const where = isAdmin(this.user) ? undefined : eq(exams.ownerId, this.user.id);
    const rows = await this.db
      .select({
        exam: exams,
        owner: users.fullName,
        questions: sql<number>`(select count(*) from exam_questions eq where eq.exam_id = ${exams.id})`,
        enrolled: sql<number>`(select count(*) from enrollments en where en.exam_id = ${exams.id})`,
        submitted: sql<number>`(select count(*) from attempts a where a.exam_id = ${exams.id} and a.is_sandbox = 0 and a.status != 'in_progress')`,
        active: sql<number>`(select count(*) from attempts a where a.exam_id = ${exams.id} and a.is_sandbox = 0 and a.status = 'in_progress')`,
        pending: sql<number>`(select coalesce(sum(a.pending_manual),0) from attempts a where a.exam_id = ${exams.id} and a.is_sandbox = 0)`,
      })
      .from(exams)
      .leftJoin(users, eq(users.id, exams.ownerId))
      .where(where)
      .orderBy(desc(exams.startsAt));
    return rows.map((r) => ({ ...r.exam, ownerName: r.owner, phase: examPhase(r.exam), counts: { questions: r.questions, enrolled: r.enrolled, submitted: r.submitted, active: r.active, pendingGrading: r.pending } }));
  }

  async get(id: number) {
    const exam = await managedExam(this.db, this.user, id);
    const pool = await this.pool(id);
    return { ...exam, phase: examPhase(exam), pool, problems: exam.status === "draft" ? paperProblems(exam, pool) : [] };
  }

  async pool(id: number) {
    const rows = await this.db
      .select({ q: questions, position: examQuestions.position })
      .from(examQuestions)
      .innerJoin(questions, eq(questions.id, examQuestions.questionId))
      .where(eq(examQuestions.examId, id))
      .orderBy(asc(examQuestions.position));
    return rows.map((r) => r.q);
  }

  async create(input: ExamInput) {
    if (!this.user.permissions.includes("exams:manage")) throw AppError.forbidden();
    return this.db.insert(exams).values({ ...input, ownerId: this.user.id }).returning().get();
  }

  async update(id: number, input: ExamInput) {
    const exam = await managedExam(this.db, this.user, id);
    if (exam.status !== "draft") throw AppError.conflict("Only draft exams can be edited. Move it back to draft first (allowed until someone starts it).");
    return this.db.update(exams).set({ ...input, updatedAt: nowIso() }).where(eq(exams.id, id)).returning().get();
  }

  async remove(id: number) {
    const exam = await managedExam(this.db, this.user, id);
    const started = await this.db.select({ n: count() }).from(attempts).where(and(eq(attempts.examId, id), eq(attempts.isSandbox, false))).get();
    if (exam.status !== "draft" || (started?.n ?? 0) > 0) throw AppError.conflict("Only draft exams nobody has attempted can be deleted.");
    await this.db.delete(exams).where(eq(exams.id, id)).run();
  }

  /** Replace the question pool (order = position). Only your own questions (admins: any). */
  async setQuestions(id: number, questionIds: number[]) {
    const exam = await managedExam(this.db, this.user, id);
    if (exam.status !== "draft") throw AppError.conflict("Questions can only change while the exam is a draft.");
    const unique = [...new Set(questionIds)];
    if (unique.length) {
      const owned = await this.db
        .select({ id: questions.id })
        .from(questions)
        .where(and(inArray(questions.id, unique), isAdmin(this.user) ? undefined : eq(questions.ownerId, this.user.id)));
      if (owned.length !== unique.length) throw AppError.badRequest("Some questions don't exist or aren't yours.");
    }
    const ops = [
      this.db.delete(examQuestions).where(eq(examQuestions.examId, id)),
      ...unique.map((qid, i) => this.db.insert(examQuestions).values({ examId: id, questionId: qid, position: i })),
    ];
    await this.db.batch(asBatch(ops));
    return this.get(id);
  }

  async publish(id: number) {
    const exam = await managedExam(this.db, this.user, id);
    if (exam.status !== "draft") throw AppError.conflict("This exam is already published.");
    const problems = paperProblems(exam, await this.pool(id));
    if (problems.length) throw new AppError(422, "not_ready", problems.join(" "));
    await this.db.update(exams).set({ status: "published", updatedAt: nowIso() }).where(eq(exams.id, id)).run();
    return this.get(id);
  }

  async unpublish(id: number) {
    const exam = await managedExam(this.db, this.user, id);
    const started = await this.db.select({ n: count() }).from(attempts).where(and(eq(attempts.examId, id), eq(attempts.isSandbox, false))).get();
    if (exam.status !== "published" || (started?.n ?? 0) > 0) throw AppError.conflict("Only published exams nobody has started can go back to draft.");
    await this.db.update(exams).set({ status: "draft", updatedAt: nowIso() }).where(eq(exams.id, id)).run();
    return this.get(id);
  }

  /** Close the exam: open attempts are finalised with what was saved. */
  async close(id: number, finalize: (attemptId: number) => Promise<unknown>) {
    const exam = await managedExam(this.db, this.user, id);
    if (exam.status !== "published") throw AppError.conflict("Only published exams can be closed.");
    const open = await this.db.select({ id: attempts.id }).from(attempts).where(and(eq(attempts.examId, id), eq(attempts.status, "in_progress")));
    await this.db.update(exams).set({ status: "completed", endsAt: exam.endsAt < nowIso() ? exam.endsAt : nowIso(), updatedAt: nowIso() }).where(eq(exams.id, id)).run();
    for (const a of open) await finalize(a.id);
    return this.get(id);
  }

  // ---- Enrolment ----------------------------------------------------------------------------------------------

  async enroll(id: number, emails: string[]) {
    await managedExam(this.db, this.user, id);
    const wanted = [...new Set(emails.map((e) => e.toLowerCase()))];
    const found = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(inArray(users.email, wanted), eq(roles.name, "candidate"), eq(users.isActive, true)));
    const byEmail = new Map(found.map((f) => [f.email, f.id]));
    const notFound = wanted.filter((e) => !byEmail.has(e));
    const existing = await this.db.select({ id: enrollments.candidateId }).from(enrollments).where(eq(enrollments.examId, id));
    const already = new Set(existing.map((e) => e.id));
    const toAdd = [...byEmail.values()].filter((cid) => !already.has(cid));
    if (toAdd.length) await this.db.batch(asBatch(toAdd.map((cid) => this.db.insert(enrollments).values({ examId: id, candidateId: cid }).onConflictDoNothing())));
    return { added: toAdd.length, alreadyEnrolled: byEmail.size - toAdd.length, notFound };
  }

  async unenroll(id: number, candidateId: number) {
    await managedExam(this.db, this.user, id);
    const a = await this.db.select({ id: attempts.id }).from(attempts).where(and(eq(attempts.examId, id), eq(attempts.candidateId, candidateId), eq(attempts.isSandbox, false))).get();
    if (a) throw AppError.conflict("This candidate has already started; their attempt must be kept.");
    await this.db.delete(enrollments).where(and(eq(enrollments.examId, id), eq(enrollments.candidateId, candidateId))).run();
  }

  async enrollments(id: number) {
    await managedExam(this.db, this.user, id);
    return this.db
      .select({
        candidateId: users.id,
        fullName: users.fullName,
        email: users.email,
        enrolledAt: enrollments.createdAt,
        attemptId: attempts.id,
        status: attempts.status,
        score: attempts.score,
        maxScore: attempts.maxScore,
        pendingManual: attempts.pendingManual,
        submittedAt: attempts.submittedAt,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.candidateId))
      .leftJoin(attempts, and(eq(attempts.examId, enrollments.examId), eq(attempts.candidateId, enrollments.candidateId), eq(attempts.isSandbox, false)))
      .where(eq(enrollments.examId, id))
      .orderBy(asc(users.fullName));
  }

  // ---- Monitoring ---------------------------------------------------------------------------------------------

  async monitor(id: number) {
    const exam = await managedExam(this.db, this.user, id);
    const rows = await this.db
      .select({
        attempt: attempts,
        fullName: users.fullName,
        email: users.email,
        answered: sql<number>`(select count(*) from answers an where an.attempt_id = ${attempts.id} and an.response is not null and an.response != '[]' and an.response != '""')`,
        flagged: sql<number>`(select count(*) from answers an where an.attempt_id = ${attempts.id} and an.flagged = 1)`,
        signals: sql<number>`(select count(*) from incidents i where i.attempt_id = ${attempts.id})`,
      })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .where(and(eq(attempts.examId, id), eq(attempts.isSandbox, false)))
      .orderBy(asc(users.fullName));
    const recent = await this.db
      .select({ id: incidents.id, type: incidents.type, detail: incidents.detail, at: incidents.at, attemptId: incidents.attemptId, fullName: users.fullName })
      .from(incidents)
      .innerJoin(attempts, eq(attempts.id, incidents.attemptId))
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .where(and(eq(attempts.examId, id), eq(attempts.isSandbox, false)))
      .orderBy(desc(incidents.id))
      .limit(50);
    const enrolled = await this.db.select({ n: count() }).from(enrollments).where(eq(enrollments.examId, id)).get();
    const notices = await this.db.select().from(announcements).where(eq(announcements.examId, id)).orderBy(desc(announcements.id)).limit(20);
    const now = Date.now();
    return {
      exam: { id: exam.id, title: exam.title, phase: examPhase(exam), endsAt: exam.endsAt, status: exam.status },
      enrolled: enrolled?.n ?? 0,
      attempts: rows.map((r) => ({
        id: r.attempt.id,
        candidateId: r.attempt.candidateId,
        fullName: r.fullName,
        email: r.email,
        status: r.attempt.status,
        startedAt: r.attempt.startedAt,
        deadlineAt: r.attempt.deadlineAt,
        extraMinutes: r.attempt.extraMinutes,
        submittedAt: r.attempt.submittedAt,
        lastSeenAt: r.attempt.lastSeenAt,
        online: r.attempt.status === "in_progress" && !!r.attempt.lastSeenAt && now - Date.parse(r.attempt.lastSeenAt) < 45_000,
        answered: r.answered,
        total: r.attempt.paper.length,
        flagged: r.flagged,
        signals: r.signals,
      })),
      incidents: recent,
      announcements: notices,
    };
  }

  async announce(id: number, message: string) {
    await managedExam(this.db, this.user, id);
    return this.db.insert(announcements).values({ examId: id, message, createdBy: this.user.id }).returning().get();
  }

  /** Innovation 5.3: compensate a verified disruption - examiner decision, reason recorded, never automatic. */
  async extend(attemptId: number, minutes: number, reason: string) {
    const attempt = await this.db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
    if (!attempt) throw AppError.notFound("Attempt");
    await managedExam(this.db, this.user, attempt.examId);
    if (attempt.status !== "in_progress") throw AppError.conflict("Time can only be added to an attempt that is still in progress.");
    const deadline = new Date(Date.parse(attempt.deadlineAt) + minutes * 60_000).toISOString();
    await this.db.batch([
      this.db.update(attempts).set({ deadlineAt: deadline, extraMinutes: attempt.extraMinutes + minutes, updatedAt: nowIso() }).where(eq(attempts.id, attemptId)),
      this.db.insert(incidents).values({ attemptId, type: "time_extended", detail: `+${minutes} min by ${this.user.fullName}: ${reason}` }),
    ]);
    return { deadlineAt: deadline };
  }

  // ---- Results ----------------------------------------------------------------------------------------------------

  async publishResults(id: number) {
    const exam = await managedExam(this.db, this.user, id);
    if (exam.status === "draft") throw AppError.conflict("Publish the exam first.");
    const [open, pending] = await this.db.batch([
      this.db.select({ n: count() }).from(attempts).where(and(eq(attempts.examId, id), eq(attempts.isSandbox, false), eq(attempts.status, "in_progress"))),
      this.db.select({ n: sql<number>`coalesce(sum(${attempts.pendingManual}),0)` }).from(attempts).where(and(eq(attempts.examId, id), eq(attempts.isSandbox, false))),
    ]);
    if ((open[0]?.n ?? 0) > 0) throw AppError.conflict("Some candidates are still writing. Close the exam or wait for the window to end.");
    if ((pending[0]?.n ?? 0) > 0) throw AppError.conflict(`${pending[0]!.n} written answer(s) still need grading.`);
    await this.db.update(exams).set({ resultsPublished: true, resultsPublishedAt: nowIso(), status: "completed", updatedAt: nowIso() }).where(eq(exams.id, id)).run();
    return this.get(id);
  }

  async unpublishResults(id: number) {
    await managedExam(this.db, this.user, id);
    await this.db.update(exams).set({ resultsPublished: false, updatedAt: nowIso() }).where(eq(exams.id, id)).run();
    return this.get(id);
  }

  /** Written answers waiting for (or already given) a mark. */
  async gradingQueue(id: number) {
    await managedExam(this.db, this.user, id);
    const rows = await this.db
      .select({ attempt: attempts, fullName: users.fullName })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .where(and(eq(attempts.examId, id), eq(attempts.isSandbox, false), sql`${attempts.status} != 'in_progress'`))
      .orderBy(desc(attempts.pendingManual), asc(users.fullName));
    const ids = rows.map((r) => r.attempt.id);
    const ans = ids.length ? await this.db.select().from(answers).where(inArray(answers.attemptId, ids)) : [];
    return rows.map((r) => ({
      attemptId: r.attempt.id,
      fullName: r.fullName,
      status: r.attempt.status,
      score: r.attempt.score,
      maxScore: r.attempt.maxScore,
      pendingManual: r.attempt.pendingManual,
      written: r.attempt.paper
        .filter((p) => p.type === "written")
        .map((p) => {
          const a = ans.find((x) => x.attemptId === r.attempt.id && x.questionId === p.id);
          return { questionId: p.id, prompt: p.prompt, marks: p.marks, response: typeof a?.response === "string" ? a.response : "", manualScore: a?.manualScore ?? null, feedback: a?.feedback ?? null };
        }),
    }));
  }
}
