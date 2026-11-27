import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { timestamps, users } from "./core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** Reusable question bank. `correct` (the answer key) is never sent to candidates. */
export const questions = sqliteTable(
  "questions",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    ownerId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
    topic: text().notNull(),
    difficulty: text({ enum: ["easy", "medium", "hard"] }).notNull(),
    type: text({ enum: ["single", "multiple", "written"] }).notNull(),
    prompt: text().notNull(),
    options: text({ mode: "json" }).$type<{ id: string; text: string }[]>().notNull().default(sql`'[]'`),
    correct: text({ mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    marks: real().notNull(),
    scheme: text({ enum: ["exact", "partial"] }).notNull().default("exact"),
    explanation: text(),
    ...timestamps,
  },
  (t) => [index("questions_owner_idx").on(t.ownerId), index("questions_topic_idx").on(t.topic, t.difficulty)],
);

export const exams = sqliteTable(
  "exams",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    ownerId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    instructions: text().notNull().default(""),
    startsAt: text().notNull(),
    endsAt: text().notNull(),
    durationMinutes: integer().notNull(),
    totalMarks: real().notNull(),
    passPercent: real().notNull().default(50),
    status: text({ enum: ["draft", "published", "completed"] }).notNull().default("draft"),
    shuffleQuestions: integer({ mode: "boolean" }).notNull().default(true),
    shuffleOptions: integer({ mode: "boolean" }).notNull().default(true),
    drawEasy: integer(),
    drawMedium: integer(),
    drawHard: integer(),
    blockCopyPaste: integer({ mode: "boolean" }).notNull().default(true),
    resultsPublished: integer({ mode: "boolean" }).notNull().default(false),
    resultsPublishedAt: text(),
    ...timestamps,
  },
  (t) => [index("exams_owner_idx").on(t.ownerId), index("exams_window_idx").on(t.status, t.startsAt)],
);

/** The question pool assigned to an exam. Restrict delete: a question used by an exam can't vanish. */
export const examQuestions = sqliteTable(
  "exam_questions",
  {
    examId: integer().notNull().references(() => exams.id, { onDelete: "cascade" }),
    questionId: integer().notNull().references(() => questions.id, { onDelete: "restrict" }),
    position: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.questionId] })],
);

export const enrollments = sqliteTable(
  "enrollments",
  {
    examId: integer().notNull().references(() => exams.id, { onDelete: "cascade" }),
    candidateId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: text().notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.examId, t.candidateId] }), index("enrollments_candidate_idx").on(t.candidateId)],
);

export interface PaperItem {
  id: number;
  type: "single" | "multiple" | "written";
  prompt: string;
  options: { id: string; text: string }[];
  correct: string[];
  marks: number;
  scheme: "exact" | "partial";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

/**
 * One attempt per candidate per exam (partial unique index - sandbox attempts excluded). The paper is a
 * snapshot taken at start: later edits to questions never change a running or finished attempt.
 */
export const attempts = sqliteTable(
  "attempts",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    examId: integer().notNull().references(() => exams.id, { onDelete: "cascade" }),
    candidateId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
    isSandbox: integer({ mode: "boolean" }).notNull().default(false),
    status: text({ enum: ["in_progress", "submitted", "expired"] }).notNull().default("in_progress"),
    startedAt: text().notNull().default(now),
    deadlineAt: text().notNull(),
    extraMinutes: integer().notNull().default(0),
    submittedAt: text(),
    lastSeenAt: text(),
    sessionId: text(),
    paper: text({ mode: "json" }).$type<PaperItem[]>().notNull(),
    score: real(),
    maxScore: real().notNull(),
    pendingManual: integer().notNull().default(0),
    scratchpad: text().notNull().default(""),
    verifyCode: text().notNull().unique(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attempts_one_per_candidate").on(t.examId, t.candidateId).where(sql`is_sandbox = 0`),
    index("attempts_exam_idx").on(t.examId, t.status),
  ],
);

export const answers = sqliteTable(
  "answers",
  {
    attemptId: integer().notNull().references(() => attempts.id, { onDelete: "cascade" }),
    questionId: integer().notNull(),
    response: text({ mode: "json" }).$type<string[] | string | null>(),
    flagged: integer({ mode: "boolean" }).notNull().default(false),
    savedAt: text().notNull().default(now),
    autoScore: real(),
    manualScore: real(),
    feedback: text(),
    gradedBy: integer().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.questionId] })],
);

/** Monitoring signals - recorded for review, never treated as proof of misconduct. */
export const incidents = sqliteTable(
  "incidents",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    attemptId: integer().notNull().references(() => attempts.id, { onDelete: "cascade" }),
    type: text().notNull(),
    detail: text(),
    at: text().notNull().default(now),
  },
  (t) => [index("incidents_attempt_idx").on(t.attemptId)],
);

export const announcements = sqliteTable(
  "announcements",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    examId: integer().notNull().references(() => exams.id, { onDelete: "cascade" }),
    message: text().notNull(),
    createdBy: integer().references(() => users.id, { onDelete: "set null" }),
    at: text().notNull().default(now),
  },
  (t) => [index("announcements_exam_idx").on(t.examId)],
);

/** Innovation 5.4: transparent, accountable result disputes. */
export const disputes = sqliteTable(
  "disputes",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    attemptId: integer().notNull().references(() => attempts.id, { onDelete: "cascade" }),
    questionId: integer(),
    reason: text().notNull(),
    status: text({ enum: ["open", "accepted", "rejected"] }).notNull().default("open"),
    response: text(),
    resolvedBy: integer().references(() => users.id, { onDelete: "set null" }),
    resolvedAt: text(),
    scoreBefore: real(),
    scoreAfter: real(),
    createdAt: text().notNull().default(now),
  },
  (t) => [index("disputes_attempt_idx").on(t.attemptId), index("disputes_status_idx").on(t.status)],
);
