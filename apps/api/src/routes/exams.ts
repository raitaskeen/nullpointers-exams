import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  announcementSchema,
  disputeSchema,
  enrollSchema,
  examInputSchema,
  examQuestionsSchema,
  extendSchema,
  gradeSchema,
  incidentSchema,
  questionInputSchema,
  resolveDisputeSchema,
  saveAnswerSchema,
  scratchpadSchema,
} from "@np/shared";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../env";
import { audit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { parseId, parseJson, parsePaging } from "../lib/validate";
import { requireAuth, requirePermission } from "../middleware/auth";
import { publish } from "../realtime/publish";
import { AttemptService } from "../services/attempt.service";
import { ExamService } from "../services/exam.service";
import { QuestionService } from "../services/question.service";
import { ReportService } from "../services/report.service";

const u = (c: Context<AppEnv>) => c.get("user")!;
const db = (c: Context<AppEnv>) => c.get("db");
const monitorTopic = (examId: number) => `exam-${examId}`;
const liveTopic = (examId: number) => `exam-${examId}-live`;

// ---- Question bank ---------------------------------------------------------------------------------------------
export const questionRoutes = new Hono<AppEnv>()
  .use(requirePermission("questions:manage"))
  .get("/", async (c) => {
    const q = c.req.query();
    const p = parsePaging(q);
    return c.json(await new QuestionService(db(c), u(c)).list({ ...p, search: p.q, topic: q.topic, difficulty: q.difficulty, type: q.type }));
  })
  .get("/:id{[0-9]+}", async (c) => c.json(await new QuestionService(db(c), u(c)).get(parseId(c))))
  .post("/", async (c) => {
    const row = await new QuestionService(db(c), u(c)).create(await parseJson(c, questionInputSchema));
    audit(c, "create", "questions", row.id);
    return c.json(row, 201);
  })
  .put("/:id{[0-9]+}", async (c) => {
    const row = await new QuestionService(db(c), u(c)).update(parseId(c), await parseJson(c, questionInputSchema));
    audit(c, "update", "questions", row.id);
    return c.json(row);
  })
  .delete("/:id{[0-9]+}", async (c) => {
    await new QuestionService(db(c), u(c)).remove(parseId(c));
    audit(c, "delete", "questions", parseId(c));
    return c.body(null, 204);
  })
  .post("/import", async (c) => {
    const { rows } = await parseJson(c, z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1, "The file has no rows").max(500) }));
    const result = await new QuestionService(db(c), u(c)).import(rows);
    audit(c, "import", "questions", null);
    return c.json(result);
  });

// ---- Exams (examiner) -------------------------------------------------------------------------------------------
export const examRoutes = new Hono<AppEnv>()
  .use(requirePermission("exams:manage"))
  .get("/", async (c) => c.json(await new ExamService(db(c), u(c)).list()))
  .post("/", async (c) => {
    const row = await new ExamService(db(c), u(c)).create(await parseJson(c, examInputSchema));
    audit(c, "create", "exams", row.id);
    return c.json(row, 201);
  })
  .get("/:id{[0-9]+}", async (c) => c.json(await new ExamService(db(c), u(c)).get(parseId(c))))
  .put("/:id{[0-9]+}", async (c) => {
    const row = await new ExamService(db(c), u(c)).update(parseId(c), await parseJson(c, examInputSchema));
    audit(c, "update", "exams", row.id);
    return c.json(row);
  })
  .delete("/:id{[0-9]+}", async (c) => {
    await new ExamService(db(c), u(c)).remove(parseId(c));
    audit(c, "delete", "exams", parseId(c));
    return c.body(null, 204);
  })
  .put("/:id{[0-9]+}/questions", async (c) => {
    const { questionIds } = await parseJson(c, examQuestionsSchema);
    return c.json(await new ExamService(db(c), u(c)).setQuestions(parseId(c), questionIds));
  })
  .post("/:id{[0-9]+}/publish", async (c) => {
    const exam = await new ExamService(db(c), u(c)).publish(parseId(c));
    audit(c, "publish", "exams", exam.id);
    return c.json(exam);
  })
  .post("/:id{[0-9]+}/unpublish", async (c) => c.json(await new ExamService(db(c), u(c)).unpublish(parseId(c))))
  .post("/:id{[0-9]+}/close", async (c) => {
    const attemptsSvc = new AttemptService(db(c), u(c));
    const exam = await new ExamService(db(c), u(c)).close(parseId(c), async (attemptId) => {
      const { attempts } = await import("../db/schema");
      const a = await db(c).select().from(attempts).where(eq(attempts.id, attemptId)).get();
      if (a) await attemptsSvc.finalizeIfExpired({ ...a, deadlineAt: new Date(Date.now() - 60_000).toISOString() });
    });
    audit(c, "close", "exams", exam.id);
    publish(c, liveTopic(exam.id), { type: "closed" });
    publish(c, monitorTopic(exam.id), { type: "closed" });
    return c.json(exam);
  })
  .get("/:id{[0-9]+}/enrollments", async (c) => c.json(await new ExamService(db(c), u(c)).enrollments(parseId(c))))
  .post("/:id{[0-9]+}/enrollments", async (c) => {
    const { emails } = await parseJson(c, enrollSchema);
    const result = await new ExamService(db(c), u(c)).enroll(parseId(c), emails);
    audit(c, "enroll", "exams", parseId(c));
    return c.json(result);
  })
  .delete("/:id{[0-9]+}/enrollments/:candidateId{[0-9]+}", async (c) => {
    await new ExamService(db(c), u(c)).unenroll(parseId(c), parseId(c, "candidateId"));
    return c.body(null, 204);
  })
  .get("/:id{[0-9]+}/monitor", async (c) => c.json(await new ExamService(db(c), u(c)).monitor(parseId(c))))
  .post("/:id{[0-9]+}/announcements", async (c) => {
    const { message } = await parseJson(c, announcementSchema);
    const row = await new ExamService(db(c), u(c)).announce(parseId(c), message);
    publish(c, liveTopic(row.examId), { type: "announcement", data: row });
    audit(c, "announce", "exams", row.examId);
    return c.json(row, 201);
  })
  .post("/attempts/:attemptId{[0-9]+}/extend", async (c) => {
    const { minutes, reason } = await parseJson(c, extendSchema);
    const attemptId = parseId(c, "attemptId");
    const result = await new ExamService(db(c), u(c)).extend(attemptId, minutes, reason);
    audit(c, "extend_time", "attempts", attemptId);
    publish(c, `attempt-${attemptId}`, { type: "deadline", data: result });
    return c.json(result);
  })
  .get("/:id{[0-9]+}/grading", async (c) => c.json(await new ExamService(db(c), u(c)).gradingQueue(parseId(c))))
  .post("/attempts/:attemptId{[0-9]+}/grade", async (c) => {
    const input = await parseJson(c, gradeSchema);
    const attemptId = parseId(c, "attemptId");
    const result = await new AttemptService(db(c), u(c)).grade(attemptId, input.questionId, input.score, input.feedback);
    audit(c, "grade", "attempts", attemptId);
    return c.json(result);
  })
  .post("/:id{[0-9]+}/results/publish", async (c) => {
    const exam = await new ExamService(db(c), u(c)).publishResults(parseId(c));
    audit(c, "publish_results", "exams", exam.id);
    publish(c, liveTopic(exam.id), { type: "results" });
    return c.json(exam);
  })
  .post("/:id{[0-9]+}/results/unpublish", async (c) => c.json(await new ExamService(db(c), u(c)).unpublishResults(parseId(c))))
  .get("/:id{[0-9]+}/analytics", async (c) => c.json(await new ReportService(db(c), u(c)).analytics(parseId(c))))
  .get("/:id{[0-9]+}/report.pdf", async (c) => {
    const bytes = await new ReportService(db(c), u(c)).examPdf(parseId(c));
    audit(c, "download_report", "exams", parseId(c));
    return c.body(bytes as unknown as ArrayBuffer, 200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="exam-${parseId(c)}-report.pdf"`, "Cache-Control": "private, no-store" });
  })
  .post("/:id{[0-9]+}/sandbox", async (c) => c.json(await new AttemptService(db(c), u(c)).start(parseId(c), true), 201))
  .get("/disputes", async (c) => c.json(await new ReportService(db(c), u(c)).listDisputes({ examId: c.req.query("examId") ? Number(c.req.query("examId")) : undefined })))
  .post("/disputes/:disputeId{[0-9]+}/resolve", async (c) => {
    const input = await parseJson(c, resolveDisputeSchema);
    const row = await new ReportService(db(c), u(c)).resolveDispute(parseId(c, "disputeId"), input.decision, input.response, input.newScore);
    audit(c, `dispute_${input.decision}`, "disputes", row.id);
    return c.json(row);
  });

// ---- Candidate ----------------------------------------------------------------------------------------------------
export const candidateRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/exams", async (c) => c.json(await new AttemptService(db(c), u(c)).myExams()))
  .post("/exams/:id{[0-9]+}/start", async (c) => {
    const result = await new AttemptService(db(c), u(c)).start(parseId(c));
    if (!result.resumed) audit(c, "start", "attempts", result.attemptId);
    return c.json(result, result.resumed ? 200 : 201);
  })
  .get("/results", async (c) => c.json(await new AttemptService(db(c), u(c)).myResults()))
  .get("/disputes", async (c) => c.json(await new ReportService(db(c), u(c)).listDisputes({ mine: true })));

// ---- Attempt workspace (candidate or examiner sandbox) ----------------------------------------------------------
export const attemptRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/:id{[0-9]+}", async (c) => c.json(await new AttemptService(db(c), u(c)).state(parseId(c))))
  .put("/:id{[0-9]+}/answer", async (c) => {
    const result = await new AttemptService(db(c), u(c)).save(parseId(c), await parseJson(c, saveAnswerSchema));
    publish(c, monitorTopic(result.examId), { type: "progress", id: parseId(c) });
    return c.json(result);
  })
  .post("/:id{[0-9]+}/heartbeat", async (c) => {
    const { sessionId } = await parseJson(c, z.object({ sessionId: z.string().min(8).max(64) }));
    return c.json(await new AttemptService(db(c), u(c)).heartbeat(parseId(c), sessionId));
  })
  .post("/:id{[0-9]+}/incidents", async (c) => {
    const { type, detail } = await parseJson(c, incidentSchema);
    const svc = new AttemptService(db(c), u(c));
    const result = await svc.incident(parseId(c), type, detail);
    if (result.recorded) publish(c, monitorTopic(result.examId), { type: "incident", id: parseId(c), data: { type } });
    return c.json(result);
  })
  .put("/:id{[0-9]+}/scratchpad", async (c) => {
    const { text } = await parseJson(c, scratchpadSchema);
    return c.json(await new AttemptService(db(c), u(c)).scratchpad(parseId(c), text));
  })
  .post("/:id{[0-9]+}/submit", async (c) => {
    const svc = new AttemptService(db(c), u(c));
    const result = await svc.submit(parseId(c));
    if (!result.alreadySubmitted) {
      audit(c, "submit", "attempts", parseId(c));
      if (!result.isSandbox) publish(c, monitorTopic(result.examId), { type: "submitted", id: parseId(c) });
    }
    return c.json(result);
  })
  .delete("/:id{[0-9]+}/sandbox", async (c) => {
    await new AttemptService(db(c), u(c)).discardSandbox(parseId(c));
    return c.body(null, 204);
  })
  .get("/:id{[0-9]+}/result", async (c) => c.json(await new AttemptService(db(c), u(c)).result(parseId(c))))
  .get("/:id{[0-9]+}/result.pdf", async (c) => {
    const svc = new AttemptService(db(c), u(c));
    const result = await svc.result(parseId(c));
    if (result.attempt.isSandbox) throw AppError.badRequest("Sandbox attempts have no official report.");
    const candidate = await db(c).select({ name: users.fullName }).from(users).where(eq(users.id, result.attempt.candidateId)).get();
    const origin = new URL(c.req.url).origin;
    const bytes = await new ReportService(db(c), u(c)).resultPdf(result, candidate?.name ?? "Candidate", origin);
    audit(c, "download_result", "attempts", parseId(c));
    return c.body(bytes as unknown as ArrayBuffer, 200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="result-${result.attempt.id}.pdf"`, "Cache-Control": "private, no-store" });
  })
  .post("/:id{[0-9]+}/disputes", async (c) => {
    const input = await parseJson(c, disputeSchema);
    const row = await new ReportService(db(c), u(c)).raiseDispute(parseId(c), input.questionId, input.reason);
    audit(c, "dispute", "attempts", parseId(c));
    return c.json(row, 201);
  });

// ---- Public verification ----------------------------------------------------------------------------------------
export const verifyRoutes = new Hono<AppEnv>().get("/:code{[A-Za-z0-9]{6,16}}", async (c) => {
  const limited = await c.env.AUTH_LIMITER?.limit({ key: `verify:${c.req.header("cf-connecting-ip") ?? "local"}` });
  if (limited && !limited.success) throw AppError.tooMany();
  return c.json(await new ReportService(db(c), null).verify(c.req.param("code")));
});
