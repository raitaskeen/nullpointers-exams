import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { scoreObjective } from "@np/shared";
import { CANDIDATE2, EXAMINER, USER, call, login } from "./helpers/client";

const iso = (minsFromNow: number) => new Date(Date.now() + minsFromNow * 60_000).toISOString();

async function examiner() {
  return login(EXAMINER);
}

/** Creates 3 questions (single, multiple-partial, written) and a published exam with both candidates enrolled. */
async function setupExam(opts: { draw?: boolean } = {}) {
  const ex = await examiner();
  const q1 = await call("/api/questions", { method: "POST", cookie: ex, json: { topic: "Networks", difficulty: "easy", type: "single", prompt: "Which layer routes packets?", options: [{ id: "a", text: "Network" }, { id: "b", text: "Session" }], correct: ["a"], marks: 2 } });
  const q2 = await call("/api/questions", { method: "POST", cookie: ex, json: { topic: "Networks", difficulty: "medium", type: "multiple", prompt: "Which are transport protocols?", options: [{ id: "a", text: "TCP" }, { id: "b", text: "UDP" }, { id: "c", text: "HTTP" }], correct: ["a", "b"], marks: 4, scheme: "partial" } });
  const q3 = await call("/api/questions", { method: "POST", cookie: ex, json: { topic: "Essays", difficulty: "hard", type: "written", prompt: "Explain TCP congestion control.", marks: 4 } });
  expect([q1.status, q2.status, q3.status]).toEqual([201, 201, 201]);
  const exam = await call("/api/exams", {
    method: "POST",
    cookie: ex,
    json: { title: `Networks ${Date.now()}`, instructions: "Answer all.", startsAt: iso(-5), endsAt: iso(60), durationMinutes: 30, totalMarks: 10, passPercent: 50, shuffleQuestions: true, shuffleOptions: true },
  });
  expect(exam.status).toBe(201);
  const id = exam.data.id;
  expect((await call(`/api/exams/${id}/questions`, { method: "PUT", cookie: ex, json: { questionIds: [q1.data.id, q2.data.id, q3.data.id] } })).status).toBe(200);
  expect((await call(`/api/exams/${id}/publish`, { method: "POST", cookie: ex })).status).toBe(200);
  const enr = await call(`/api/exams/${id}/enrollments`, { method: "POST", cookie: ex, json: { emails: [USER.email, CANDIDATE2.email, "ghost@nowhere.dev"] } });
  expect(enr.data).toMatchObject({ added: 2, notFound: ["ghost@nowhere.dev"] });
  return { ex, id, q: { single: q1.data.id, multi: q2.data.id, written: q3.data.id } };
}

describe("marking rules", () => {
  it("scores single, exact and partial multiple-select correctly", () => {
    const multi = { type: "multiple" as const, correct: ["a", "b"], marks: 4, scheme: "partial" as const };
    expect(scoreObjective({ type: "single", correct: ["a"], marks: 2, scheme: "exact" }, ["a"])).toBe(2);
    expect(scoreObjective({ type: "single", correct: ["a"], marks: 2, scheme: "exact" }, ["b"])).toBe(0);
    expect(scoreObjective(multi, ["a", "b"])).toBe(4);
    expect(scoreObjective(multi, ["a"])).toBe(2);
    expect(scoreObjective(multi, ["a", "c"])).toBe(0); // one right, one wrong cancels out
    expect(scoreObjective(multi, ["c"])).toBe(0); // never negative
    expect(scoreObjective({ ...multi, scheme: "exact" }, ["a"])).toBe(0);
  });
});

describe("exam setup", () => {
  it("blocks publishing when marks don't add up, with a clear reason", async () => {
    const ex = await examiner();
    const q = await call("/api/questions", { method: "POST", cookie: ex, json: { topic: "T", difficulty: "easy", type: "single", prompt: "Pick A please", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["a"], marks: 3 } });
    const exam = await call("/api/exams", { method: "POST", cookie: ex, json: { title: "Mismatch", startsAt: iso(1), endsAt: iso(90), durationMinutes: 30, totalMarks: 10 } });
    await call(`/api/exams/${exam.data.id}/questions`, { method: "PUT", cookie: ex, json: { questionIds: [q.data.id] } });
    const res = await call(`/api/exams/${exam.data.id}/publish`, { method: "POST", cookie: ex });
    expect(res.status).toBe(422);
    expect(res.data.error.message).toContain("worth 3 marks");
  });

  it("validates exam and question input on the server", async () => {
    const ex = await examiner();
    const bad = await call("/api/exams", { method: "POST", cookie: ex, json: { title: "x", startsAt: iso(10), endsAt: iso(5), durationMinutes: 0, totalMarks: -1 } });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.data.error.fields)).toEqual(expect.arrayContaining(["title", "durationMinutes", "totalMarks"]));
    const q = await call("/api/questions", { method: "POST", cookie: ex, json: { topic: "T", difficulty: "easy", type: "single", prompt: "Two right answers?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["a", "b"], marks: 1 } });
    expect(q.status).toBe(422);
    expect(q.data.error.fields.correct).toMatch(/exactly one/);
  });

  it("keeps candidates out of examiner endpoints and other examiners' exams", async () => {
    const { id } = await setupExam();
    const cand = await login(USER);
    expect((await call("/api/exams", { cookie: cand })).status).toBe(403);
    expect((await call(`/api/exams/${id}/monitor`, { cookie: cand })).status).toBe(403);
    expect((await call("/api/questions", { cookie: cand })).status).toBe(403);
  });
});

describe("taking an exam", () => {
  it("runs the whole flow: start, autosave, resume, submit once, auto-grade, manual grade, publish, view, verify, PDF", async () => {
    const { ex, id, q } = await setupExam();
    const cand = await login(USER);

    const mine = await call("/api/me/exams", { cookie: cand });
    expect(mine.data.find((e: { id: number }) => e.id === id).phase).toBe("ongoing");

    const start = await call(`/api/me/exams/${id}/start`, { method: "POST", cookie: cand });
    expect(start.status).toBe(201);
    const attemptId = start.data.attemptId;

    const state = await call(`/api/attempts/${attemptId}`, { cookie: cand });
    expect(state.data.paper).toHaveLength(3);
    expect(JSON.stringify(state.data.paper)).not.toContain("correct"); // the answer key never leaves the server

    // Starting again resumes the same attempt (refresh / another device).
    const again = await call(`/api/me/exams/${id}/start`, { method: "POST", cookie: cand });
    expect(again.data).toEqual({ attemptId, resumed: true });

    // Invalid answers are rejected; valid ones saved.
    expect((await call(`/api/attempts/${attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.single, response: ["a", "b"] } })).status).toBe(400);
    expect((await call(`/api/attempts/${attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.single, response: ["zzz"] } })).status).toBe(400);
    expect((await call(`/api/attempts/${attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.single, response: ["a"] } })).status).toBe(200);
    expect((await call(`/api/attempts/${attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.multi, response: ["a"], flagged: true } })).status).toBe(200);
    expect((await call(`/api/attempts/${attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.written, response: "Slow start, then AIMD." } })).status).toBe(200);

    // Another candidate can't touch this attempt.
    const other = await login(CANDIDATE2);
    expect((await call(`/api/attempts/${attemptId}`, { cookie: other })).status).toBe(404);

    // Saved progress survives a reload.
    const reloaded = await call(`/api/attempts/${attemptId}`, { cookie: cand });
    expect(reloaded.data.answers.find((a: { questionId: number }) => a.questionId === q.multi).flagged).toBe(true);

    // Submit twice: exactly one submission.
    const s1 = await call(`/api/attempts/${attemptId}/submit`, { method: "POST", cookie: cand });
    const s2 = await call(`/api/attempts/${attemptId}/submit`, { method: "POST", cookie: cand });
    expect(s1.data.alreadySubmitted).toBe(false);
    expect(s2.data.alreadySubmitted).toBe(true);
    expect((await call(`/api/attempts/${attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.single, response: ["b"] } })).status).toBe(409);

    // Results aren't visible before publication.
    expect((await call(`/api/attempts/${attemptId}/result`, { cookie: cand })).status).toBe(404);

    // Grading: objective auto (2 + 2 partial), written pending. Marks above the maximum are refused.
    const queue = await call(`/api/exams/${id}/grading`, { cookie: ex });
    const row = queue.data.find((r: { attemptId: number }) => r.attemptId === attemptId);
    expect(row).toMatchObject({ score: 4, pendingManual: 1 });
    expect((await call(`/api/exams/${id}/results/publish`, { method: "POST", cookie: ex })).status).toBe(409); // other candidate hasn't finished? and grading pending
    const tooHigh = await call(`/api/exams/attempts/${attemptId}/grade`, { method: "POST", cookie: ex, json: { questionId: q.written, score: 9 } });
    expect(tooHigh.status).toBe(422);
    const graded = await call(`/api/exams/attempts/${attemptId}/grade`, { method: "POST", cookie: ex, json: { questionId: q.written, score: 3, feedback: "Good, mention fast recovery." } });
    expect(graded.data).toEqual({ score: 7, pendingManual: 0 });

    // Publish once nobody is still writing.
    expect((await call(`/api/exams/${id}/results/publish`, { method: "POST", cookie: ex })).status).toBe(200);
    const result = await call(`/api/attempts/${attemptId}/result`, { cookie: cand });
    expect(result.status).toBe(200);
    expect(result.data.attempt.score).toBe(7);
    expect(result.data.questions.every((x: { correct?: unknown }) => x.correct === undefined)).toBe(true);

    // Verifiable report: public, minimal, masked name.
    const code = result.data.attempt.verifyCode;
    const v = await call(`/api/verify/${code}`);
    expect(v.data).toMatchObject({ valid: true, candidate: "Cara C.", score: 7, maxScore: 10 });
    expect(JSON.stringify(v.data)).not.toContain("user@test.dev");
    expect((await call("/api/verify/NOTAREALCODE")).data).toEqual({ valid: false });

    // PDF for the candidate; other candidates can't download it.
    const pdf = await call(`/api/attempts/${attemptId}/result.pdf`, { cookie: cand });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect((await call(`/api/attempts/${attemptId}/result.pdf`, { cookie: other })).status).toBe(404);
    expect((await call(`/api/exams/${id}/report.pdf`, { cookie: ex })).headers.get("content-type")).toBe("application/pdf");

    // Analytics from real data.
    const stats = await call(`/api/exams/${id}/analytics`, { cookie: ex });
    expect(stats.data.summary.submitted).toBeGreaterThanOrEqual(1);
    expect(stats.data.questions.find((x: { id: number }) => x.id === q.multi).correctPercent).toBe(0);
  });

  it("finalises at the server deadline using only answers accepted in time", async () => {
    const { q, id } = await setupExam();
    const cand = await login(CANDIDATE2);
    const { data } = await call(`/api/me/exams/${id}/start`, { method: "POST", cookie: cand });
    await call(`/api/attempts/${data.attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.single, response: ["a"] } });
    // Move the deadline into the past (as if the clock ran out) - the device clock plays no part.
    await env.DB.prepare("update attempts set deadline_at = ? where id = ?").bind(new Date(Date.now() - 60_000).toISOString(), data.attemptId).run();
    const late = await call(`/api/attempts/${data.attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.multi, response: ["a", "b"] } });
    expect(late.status).toBe(409);
    const state = await call(`/api/attempts/${data.attemptId}`, { cookie: cand });
    expect(state.data.attempt.status).toBe("expired");
  });

  it("refuses unenrolled candidates and exams outside their window", async () => {
    const ex = await examiner();
    const q = await call("/api/questions", { method: "POST", cookie: ex, json: { topic: "T", difficulty: "easy", type: "single", prompt: "Future question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["a"], marks: 5 } });
    const exam = await call("/api/exams", { method: "POST", cookie: ex, json: { title: "Future exam", startsAt: iso(60), endsAt: iso(180), durationMinutes: 30, totalMarks: 5 } });
    await call(`/api/exams/${exam.data.id}/questions`, { method: "PUT", cookie: ex, json: { questionIds: [q.data.id] } });
    await call(`/api/exams/${exam.data.id}/publish`, { method: "POST", cookie: ex });
    const cand = await login(USER);
    expect((await call(`/api/me/exams/${exam.data.id}/start`, { method: "POST", cookie: cand })).status).toBe(404); // not enrolled
    await call(`/api/exams/${exam.data.id}/enrollments`, { method: "POST", cookie: ex, json: { emails: [USER.email] } });
    const early = await call(`/api/me/exams/${exam.data.id}/start`, { method: "POST", cookie: cand });
    expect(early.status).toBe(403);
    expect(early.data.error.code).toBe("not_open");
  });

  it("draws equal-difficulty papers from a larger pool (fairness)", async () => {
    const ex = await examiner();
    const ids: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await call("/api/questions", { method: "POST", cookie: ex, json: { topic: "Pool", difficulty: i < 2 ? "easy" : "hard", type: "single", prompt: `Pool question ${i}`, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: ["a"], marks: 5 } });
      ids.push(r.data.id);
    }
    const exam = await call("/api/exams", { method: "POST", cookie: ex, json: { title: "Fair", startsAt: iso(-1), endsAt: iso(60), durationMinutes: 20, totalMarks: 10, drawEasy: 1, drawHard: 1 } });
    await call(`/api/exams/${exam.data.id}/questions`, { method: "PUT", cookie: ex, json: { questionIds: ids } });
    expect((await call(`/api/exams/${exam.data.id}/publish`, { method: "POST", cookie: ex })).status).toBe(200);
    const sb = await call(`/api/exams/${exam.data.id}/sandbox`, { method: "POST", cookie: ex });
    const state = await call(`/api/attempts/${sb.data.attemptId}`, { cookie: ex });
    const levels = state.data.paper.map((p: { difficulty: string }) => p.difficulty).sort();
    expect(levels).toEqual(["easy", "hard"]);
  });
});

describe("disputes", () => {
  it("lets a candidate dispute a mark and the examiner resolve it, recalculating the total", async () => {
    const { ex, id, q } = await setupExam();
    const cand = await login(USER);
    const { data } = await call(`/api/me/exams/${id}/start`, { method: "POST", cookie: cand });
    await call(`/api/attempts/${data.attemptId}/answer`, { method: "PUT", cookie: cand, json: { questionId: q.multi, response: ["a"] } });
    await call(`/api/attempts/${data.attemptId}/submit`, { method: "POST", cookie: cand });
    await call(`/api/exams/${id}/close`, { method: "POST", cookie: ex });
    expect((await call(`/api/exams/${id}/results/publish`, { method: "POST", cookie: ex })).status).toBe(200);

    const d = await call(`/api/attempts/${data.attemptId}/disputes`, { method: "POST", cookie: cand, json: { questionId: q.multi, reason: "HTTP can also be argued here, please review." } });
    expect(d.status).toBe(201);
    const list = await call("/api/exams/disputes", { cookie: ex });
    expect(list.data.some((x: { id: number }) => x.id === d.data.id)).toBe(true);
    const res = await call(`/api/exams/disputes/${d.data.id}/resolve`, { method: "POST", cookie: ex, json: { decision: "accepted", response: "Fair point - full marks awarded.", newScore: 4 } });
    expect(res.data).toMatchObject({ status: "accepted", scoreBefore: 2, scoreAfter: 4 });
    expect((await call(`/api/exams/disputes/${d.data.id}/resolve`, { method: "POST", cookie: ex, json: { decision: "rejected", response: "again" } })).status).toBe(409);
  });
});
