import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import qrcode from "qrcode-generator";
import { answers, attempts, disputes, exams, users } from "../db/schema";
import type { Db, SessionUser } from "../env";
import { AppError } from "../lib/errors";
import { isAdmin, managedExam, maskName, nowIso } from "./access";
import { gradeAttempt } from "./attempt.service";

const pct = (s: number | null, m: number) => (m ? Math.round(((s ?? 0) / m) * 1000) / 10 : 0);
/** Standard PDF fonts only encode Latin-1: replace anything else so a name in Urdu can never crash a report. */
const safe = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

export class ReportService {
  constructor(
    private readonly db: Db,
    private readonly user: SessionUser | null,
  ) {}

  /** Exam- and question-level analytics from real, non-sandbox, finished attempts (3.8 + 4.5). */
  async analytics(examId: number) {
    if (!this.user) throw AppError.unauthorized();
    const exam = await managedExam(this.db, this.user, examId);
    const rows = await this.db
      .select({ a: attempts, name: users.fullName })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, false), sql`${attempts.status} != 'in_progress'`));
    const ids = rows.map((r) => r.a.id);
    const ans = ids.length ? await this.db.select().from(answers).where(inArray(answers.attemptId, ids)) : [];

    const scores = rows.map((r) => pct(r.a.score, r.a.maxScore)).sort((x, y) => x - y);
    const n = scores.length;
    const mean = n ? scores.reduce((s, x) => s + x, 0) / n : 0;
    const median = n ? (n % 2 ? scores[(n - 1) / 2]! : (scores[n / 2 - 1]! + scores[n / 2]!) / 2) : 0;
    const passed = scores.filter((s) => s >= exam.passPercent).length;
    const buckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i === 9 ? 100 : i * 10 + 9}`, count: 0 }));
    for (const s of scores) buckets[Math.min(9, Math.floor(s / 10))]!.count++;

    // Per question - only from papers that actually contained it (stratified draws differ per candidate).
    const qmap = new Map<number, { id: number; prompt: string; type: string; topic: string; difficulty: string; marks: number; served: number; answered: number; full: number; total: number; wrong: Map<string, number>; options: { id: string; text: string }[] }>();
    for (const r of rows) {
      for (const p of r.a.paper) {
        const s = qmap.get(p.id) ?? { id: p.id, prompt: p.prompt, type: p.type, topic: p.topic, difficulty: p.difficulty, marks: p.marks, served: 0, answered: 0, full: 0, total: 0, wrong: new Map(), options: p.options };
        s.served++;
        const a = ans.find((x) => x.attemptId === r.a.id && x.questionId === p.id);
        const answered = Array.isArray(a?.response) ? a.response.length > 0 : typeof a?.response === "string" && a.response.trim().length > 0;
        if (answered) s.answered++;
        const got = p.type === "written" ? (a?.manualScore ?? 0) : (a?.manualScore ?? a?.autoScore ?? 0);
        s.total += got;
        if (got >= p.marks - 1e-9) s.full++;
        if (answered && p.type !== "written" && Array.isArray(a?.response)) {
          for (const opt of a.response) if (!p.correct.includes(opt)) s.wrong.set(opt, (s.wrong.get(opt) ?? 0) + 1);
        }
        qmap.set(p.id, s);
      }
    }
    const questionStats = [...qmap.values()].map((s) => {
      const avg = s.served ? s.total / s.served : 0;
      const topWrong = [...s.wrong.entries()].sort((a, b) => b[1] - a[1])[0];
      const observed = s.served ? 1 - avg / s.marks : 0; // 0 = everyone got it, 1 = nobody did
      return {
        id: s.id,
        prompt: s.prompt,
        type: s.type,
        topic: s.topic,
        difficulty: s.difficulty,
        marks: s.marks,
        served: s.served,
        skippedPercent: s.served ? Math.round(((s.served - s.answered) / s.served) * 1000) / 10 : 0,
        correctPercent: s.served ? Math.round((s.full / s.served) * 1000) / 10 : 0,
        averageScore: Math.round(avg * 100) / 100,
        observedDifficulty: observed < 0.34 ? "easy" : observed < 0.67 ? "medium" : "hard",
        commonWrong: topWrong ? { text: s.options.find((o) => o.id === topWrong[0])?.text ?? topWrong[0], count: topWrong[1] } : null,
      };
    });

    const topics = new Map<string, { got: number; max: number }>();
    for (const r of rows)
      for (const p of r.a.paper) {
        const a = ans.find((x) => x.attemptId === r.a.id && x.questionId === p.id);
        const got = p.type === "written" ? (a?.manualScore ?? 0) : (a?.manualScore ?? a?.autoScore ?? 0);
        const t = topics.get(p.topic) ?? { got: 0, max: 0 };
        t.got += got;
        t.max += p.marks;
        topics.set(p.topic, t);
      }

    return {
      exam: { id: exam.id, title: exam.title, passPercent: exam.passPercent, totalMarks: exam.totalMarks, resultsPublished: exam.resultsPublished },
      summary: {
        submitted: n,
        meanPercent: Math.round(mean * 10) / 10,
        medianPercent: Math.round(median * 10) / 10,
        highestPercent: n ? scores[n - 1] : 0,
        lowestPercent: n ? scores[0] : 0,
        passRate: n ? Math.round((passed / n) * 1000) / 10 : 0,
        pendingGrading: rows.reduce((s, r) => s + r.a.pendingManual, 0),
      },
      distribution: buckets,
      topics: [...topics.entries()].map(([topic, t]) => ({ topic, percent: pct(t.got, t.max) })),
      candidates: rows
        .map((r) => ({ attemptId: r.a.id, fullName: r.name, score: r.a.score, maxScore: r.a.maxScore, percent: pct(r.a.score, r.a.maxScore), passed: pct(r.a.score, r.a.maxScore) >= exam.passPercent, status: r.a.status, pendingManual: r.a.pendingManual }))
        .sort((x, y) => y.percent - x.percent),
      questions: questionStats,
    };
  }

  /** Public verification (4.6): only what's needed to prove a report is genuine. */
  async verify(code: string) {
    const row = await this.db
      .select({ a: attempts, exam: exams, name: users.fullName })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .where(and(eq(attempts.verifyCode, code.toUpperCase()), eq(attempts.isSandbox, false)))
      .get();
    if (!row || !row.exam.resultsPublished) return { valid: false as const };
    return {
      valid: true as const,
      code: row.a.verifyCode,
      exam: row.exam.title,
      candidate: maskName(row.name),
      score: row.a.score,
      maxScore: row.a.maxScore,
      percent: pct(row.a.score, row.a.maxScore),
      passed: pct(row.a.score, row.a.maxScore) >= row.exam.passPercent,
      issuedAt: row.exam.resultsPublishedAt,
      lastUpdated: row.a.updatedAt,
    };
  }

  // ---- Disputes (innovation 5.4) ------------------------------------------------------------------------------------

  async raiseDispute(attemptId: number, questionId: number | null | undefined, reason: string) {
    if (!this.user) throw AppError.unauthorized();
    const a = await this.db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
    const exam = a ? await this.db.select().from(exams).where(eq(exams.id, a.examId)).get() : null;
    if (!a || !exam || a.candidateId !== this.user.id || a.isSandbox || !exam.resultsPublished) throw AppError.notFound("Result");
    if (questionId && !a.paper.some((p) => p.id === questionId)) throw AppError.badRequest("That question isn't part of your paper.");
    const open = await this.db.select({ id: disputes.id }).from(disputes).where(and(eq(disputes.attemptId, attemptId), eq(disputes.status, "open"))).all();
    if (open.length >= 5) throw AppError.conflict("You already have 5 open disputes for this exam.");
    return this.db.insert(disputes).values({ attemptId, questionId: questionId ?? null, reason, scoreBefore: a.score }).returning().get();
  }

  async listDisputes(scope: { examId?: number; mine?: boolean }) {
    if (!this.user) throw AppError.unauthorized();
    const conds = [];
    if (scope.mine) conds.push(eq(attempts.candidateId, this.user.id));
    else {
      if (!this.user.permissions.includes("exams:manage")) throw AppError.forbidden();
      if (!isAdmin(this.user)) conds.push(eq(exams.ownerId, this.user.id));
      if (scope.examId) conds.push(eq(exams.id, scope.examId));
    }
    const rows = await this.db
      .select({ d: disputes, exam: exams.title, examId: exams.id, candidate: users.fullName, paper: attempts.paper })
      .from(disputes)
      .innerJoin(attempts, eq(attempts.id, disputes.attemptId))
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .where(and(...conds))
      .orderBy(asc(sql`case ${disputes.status} when 'open' then 0 else 1 end`), desc(disputes.id));
    return rows.map((r) => {
      const q = r.d.questionId ? r.paper.find((p) => p.id === r.d.questionId) : null;
      return { ...r.d, exam: r.exam, examId: r.examId, candidate: r.candidate, question: q ? { id: q.id, prompt: q.prompt, marks: q.marks, number: r.paper.indexOf(q) + 1 } : null };
    });
  }

  async resolveDispute(id: number, decision: "accepted" | "rejected", response: string, newScore?: number | null) {
    if (!this.user) throw AppError.unauthorized();
    const d = await this.db.select().from(disputes).where(eq(disputes.id, id)).get();
    if (!d) throw AppError.notFound("Dispute");
    const a = (await this.db.select().from(attempts).where(eq(attempts.id, d.attemptId)).get())!;
    await managedExam(this.db, this.user, a.examId);
    if (d.status !== "open") throw AppError.conflict("This dispute has already been resolved.");
    let scoreAfter = a.score;
    if (decision === "accepted" && d.questionId != null && newScore != null) {
      const item = a.paper.find((p) => p.id === d.questionId)!;
      if (newScore > item.marks) throw new AppError(422, "validation_failed", `The maximum for this question is ${item.marks} marks.`, { newScore: `Maximum is ${item.marks}` });
      await this.db
        .insert(answers)
        .values({ attemptId: a.id, questionId: item.id, response: null, manualScore: newScore, feedback: `Dispute #${id}: ${response}`, gradedBy: this.user.id })
        .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: { manualScore: newScore, feedback: `Dispute #${id}: ${response}`, gradedBy: this.user.id } })
        .run();
      scoreAfter = (await gradeAttempt(this.db, a)).score;
    }
    return this.db
      .update(disputes)
      .set({ status: decision, response, resolvedBy: this.user.id, resolvedAt: nowIso(), scoreAfter })
      .where(eq(disputes.id, id))
      .returning()
      .get();
  }

  // ---- PDF (secondary 4.2) ------------------------------------------------------------------------------------------

  async resultPdf(result: { attempt: { id: number; score: number | null; maxScore: number; submittedAt: string | null; verifyCode: string | null }; exam: { title: string; passPercent: number; resultsPublishedAt: string | null }; questions: { number: number; topic: string; marks: number; awarded: number | null; type: string }[] }, candidateName: string, verifyBase: string) {
    const doc = await PDFDocument.create();
    doc.setTitle(`Result - ${result.exam.title}`);
    doc.setProducer("NullPointers Exams");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([595, 842]);
    const ink = rgb(0.11, 0.12, 0.16);
    const muted = rgb(0.38, 0.4, 0.46);
    const brand = rgb(0.18, 0.36, 0.83);

    const text = (p: PDFPage, s: string, x: number, y: number, size = 10, f: PDFFont = font, color = ink) => p.drawText(safe(s), { x, y, size, font: f, color });
    page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: brand });
    text(page, "NullPointers Exams  |  Official result report", 40, 823, 10, bold, rgb(1, 1, 1));
    text(page, result.exam.title.slice(0, 70), 40, 770, 18, bold);
    text(page, `Candidate: ${candidateName}`, 40, 745, 11);
    text(page, `Submitted: ${result.attempt.submittedAt ? new Date(result.attempt.submittedAt).toUTCString() : "-"}`, 40, 729, 10, font, muted);
    text(page, `Results published: ${result.exam.resultsPublishedAt ? new Date(result.exam.resultsPublishedAt).toUTCString() : "-"}`, 40, 715, 10, font, muted);

    const percent = pct(result.attempt.score, result.attempt.maxScore);
    const passed = percent >= result.exam.passPercent;
    page.drawRectangle({ x: 40, y: 640, width: 330, height: 56, color: rgb(0.96, 0.97, 0.99), borderColor: rgb(0.88, 0.9, 0.94), borderWidth: 1 });
    text(page, `${result.attempt.score ?? 0} / ${result.attempt.maxScore}`, 56, 664, 22, bold);
    text(page, `${percent}%  |  ${passed ? "PASS" : "NOT PASSED"} (pass mark ${result.exam.passPercent}%)`, 56, 648, 10, bold, passed ? rgb(0.1, 0.5, 0.25) : rgb(0.7, 0.15, 0.12));

    if (result.attempt.verifyCode) {
      const url = `${verifyBase}/verify?code=${result.attempt.verifyCode}`;
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      const count = qr.getModuleCount();
      const size = 92;
      const cell = size / count;
      const ox = 463;
      const oy = 620;
      for (let r = 0; r < count; r++)
        for (let c = 0; c < count; c++)
          if (qr.isDark(r, c)) page.drawRectangle({ x: ox + c * cell, y: oy + size - (r + 1) * cell, width: cell, height: cell, color: ink });
      text(page, "Scan to verify", ox + 14, oy - 12, 8, font, muted);
      text(page, `Code ${result.attempt.verifyCode}`, ox + 4, oy - 24, 8, bold, muted);
    }

    let y = 590;
    text(page, "Breakdown", 40, y, 12, bold);
    y -= 20;
    const header = () => {
      text(page, "#", 40, y, 9, bold, muted);
      text(page, "Topic", 70, y, 9, bold, muted);
      text(page, "Type", 300, y, 9, bold, muted);
      text(page, "Marks", 420, y, 9, bold, muted);
      text(page, "Awarded", 490, y, 9, bold, muted);
      y -= 6;
      page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
      y -= 14;
    };
    header();
    for (const q of result.questions) {
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 790;
        header();
      }
      text(page, String(q.number), 40, y, 9);
      text(page, q.topic.slice(0, 40), 70, y, 9);
      text(page, q.type, 300, y, 9);
      text(page, String(q.marks), 420, y, 9);
      text(page, q.awarded == null ? "pending" : String(q.awarded), 490, y, 9);
      y -= 16;
    }
    for (const [i, p] of doc.getPages().entries()) {
      p.drawText(`Generated ${new Date().toUTCString()}  |  Page ${i + 1} of ${doc.getPageCount()}  |  Answer keys are never included in reports.`, { x: 40, y: 24, size: 7, font, color: muted });
    }
    return doc.save();
  }

  async examPdf(examId: number) {
    const data = await this.analytics(examId);
    const doc = await PDFDocument.create();
    doc.setTitle(`Exam report - ${data.exam.title}`);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.11, 0.12, 0.16);
    const muted = rgb(0.38, 0.4, 0.46);
    let page = doc.addPage([595, 842]);
    let y = 790;
    const line = (s: string, size = 10, f: PDFFont = font, color = ink, x = 40) => {
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      page.drawText(safe(s), { x, y, size, font: f, color });
      y -= size + 6;
    };
    page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: rgb(0.18, 0.36, 0.83) });
    page.drawText("NullPointers Exams  |  Examination report (confidential)", { x: 40, y: 823, size: 10, font: bold, color: rgb(1, 1, 1) });
    line(data.exam.title.slice(0, 70), 18, bold);
    y -= 6;
    const s = data.summary;
    line(`Submitted attempts: ${s.submitted}    Mean: ${s.meanPercent}%    Median: ${s.medianPercent}%    Pass rate: ${s.passRate}%`, 10);
    line(`Highest: ${s.highestPercent}%    Lowest: ${s.lowestPercent}%    Pass mark: ${data.exam.passPercent}%    Pending grading: ${s.pendingGrading}`, 10, font, muted);
    y -= 10;
    line("Candidates", 12, bold);
    for (const c of data.candidates) line(`${c.fullName.slice(0, 40).padEnd(42)} ${String(c.score ?? 0).padStart(6)} / ${c.maxScore}   ${c.percent}%   ${c.passed ? "pass" : "-"}`, 9);
    y -= 10;
    line("Question analytics", 12, bold);
    for (const q of data.questions) {
      line(`${q.prompt.replace(/\s+/g, " ").slice(0, 90)}`, 9, bold);
      line(`   ${q.topic} | labelled ${q.difficulty}, observed ${q.observedDifficulty} | correct ${q.correctPercent}% | skipped ${q.skippedPercent}% | avg ${q.averageScore}/${q.marks}${q.commonWrong ? ` | most chosen wrong: "${q.commonWrong.text.slice(0, 30)}" (${q.commonWrong.count})` : ""}`, 8, font, muted);
    }
    for (const [i, p] of doc.getPages().entries()) p.drawText(`Generated ${new Date().toUTCString()}  |  Page ${i + 1} of ${doc.getPageCount()}`, { x: 40, y: 24, size: 7, font, color: muted });
    return doc.save();
  }
}
