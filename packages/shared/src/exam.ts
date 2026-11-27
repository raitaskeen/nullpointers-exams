import { z } from "zod";
import { emailSchema } from "./auth";

/**
 * Exam domain: one set of Zod schemas used by the browser forms AND the API, so every rule and message
 * is identical on both sides.
 */

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const QUESTION_TYPES = ["single", "multiple", "written"] as const;
export const SCHEMES = ["exact", "partial"] as const;
export const EXAM_STATUSES = ["draft", "published", "completed"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type ExamStatus = (typeof EXAM_STATUSES)[number];
/** What candidates and examiners see: "ongoing"/"upcoming" are derived from the window, never stored. */
export type ExamPhase = "draft" | "upcoming" | "ongoing" | "ended" | "completed";

export const TYPE_LABEL: Record<QuestionType, string> = {
  single: "Single answer",
  multiple: "Multiple select",
  written: "Written",
};

// ---- Questions ---------------------------------------------------------------------------------------------

const optionSchema = z.object({
  id: z.string().min(1).max(16),
  text: z.string().trim().min(1, "Option text can't be empty").max(500),
});

export const questionInputSchema = z
  .object({
    topic: z.string().trim().min(1, "Enter a topic").max(80),
    difficulty: z.enum(DIFFICULTIES, { error: "Choose a difficulty" }),
    type: z.enum(QUESTION_TYPES, { error: "Choose a question type" }),
    prompt: z.string().trim().min(5, "Write the question (at least 5 characters)").max(4000),
    options: z.array(optionSchema).max(8, "At most 8 options").default([]),
    correct: z.array(z.string()).default([]),
    marks: z.coerce.number({ error: "Enter marks" }).positive("Marks must be more than 0").max(100, "At most 100 marks"),
    scheme: z.enum(SCHEMES).default("exact"),
    explanation: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((q, ctx) => {
    if (q.type === "written") return;
    if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least 2 options" });
    const ids = new Set(q.options.map((o) => o.id));
    if (ids.size !== q.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Options must be unique" });
    const texts = new Set(q.options.map((o) => o.text.toLowerCase()));
    if (texts.size !== q.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Two options have the same text" });
    if (q.correct.some((c) => !ids.has(c))) ctx.addIssue({ code: "custom", path: ["correct"], message: "Correct answer must be one of the options" });
    if (q.type === "single" && q.correct.length !== 1) ctx.addIssue({ code: "custom", path: ["correct"], message: "Mark exactly one correct option" });
    if (q.type === "multiple" && q.correct.length < 1) ctx.addIssue({ code: "custom", path: ["correct"], message: "Mark at least one correct option" });
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

// ---- Exams ---------------------------------------------------------------------------------------------------

const isoDate = (label: string) =>
  z.string({ error: `Enter the ${label}` }).refine((v) => !Number.isNaN(Date.parse(v)), `Enter a valid ${label}`).transform((v) => new Date(v).toISOString());

const optionalCount = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).max(200).nullable());

export const examInputSchema = z
  .object({
    title: z.string().trim().min(3, "Give the exam a title (at least 3 characters)").max(140),
    instructions: z.string().trim().max(5000).default(""),
    startsAt: isoDate("start time"),
    endsAt: isoDate("end time"),
    durationMinutes: z.coerce.number({ error: "Enter a duration" }).int("Whole minutes only").min(1, "At least 1 minute").max(600, "At most 10 hours"),
    totalMarks: z.coerce.number({ error: "Enter total marks" }).positive("Total marks must be more than 0").max(10_000),
    passPercent: z.coerce.number().min(0).max(100).default(50),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
    /** Fair randomisation (innovation 5.2): draw this many questions per difficulty from the pool. Empty = use all. */
    drawEasy: optionalCount.default(null),
    drawMedium: optionalCount.default(null),
    drawHard: optionalCount.default(null),
    blockCopyPaste: z.boolean().default(true),
  })
  .superRefine((e, ctx) => {
    const start = Date.parse(e.startsAt);
    const end = Date.parse(e.endsAt);
    if (end <= start) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after the start time" });
    else if (end - start < e.durationMinutes * 60_000)
      ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "Duration is longer than the exam window" });
  });
export type ExamInput = z.infer<typeof examInputSchema>;

export const examQuestionsSchema = z.object({
  questionIds: z.array(z.number().int().positive()).max(500),
});

export const enrollSchema = z.object({
  emails: z.array(emailSchema).min(1, "Add at least one email").max(1000),
});

export const announcementSchema = z.object({
  message: z.string().trim().min(2, "Write a message").max(500, "Keep it under 500 characters"),
});

export const extendSchema = z.object({
  minutes: z.coerce.number().int().min(1, "At least 1 minute").max(60, "At most 60 minutes"),
  reason: z.string().trim().min(3, "Give a reason (it's recorded)").max(300),
});

// ---- Attempts ------------------------------------------------------------------------------------------------

export const saveAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  /** single: [optionId]; multiple: optionIds; written: text */
  response: z.union([z.array(z.string().max(16)).max(8), z.string().max(20_000)]).nullable(),
  flagged: z.boolean().optional(),
});

export const INCIDENT_TYPES = ["tab_hidden", "window_blur", "fullscreen_exit", "copy", "paste", "offline", "resumed", "multiple_sessions", "devtools"] as const;
export const incidentSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  detail: z.string().max(300).optional(),
});

export const scratchpadSchema = z.object({ text: z.string().max(50_000) });

// ---- Grading & results ---------------------------------------------------------------------------------------

export const gradeSchema = z.object({
  questionId: z.number().int().positive(),
  score: z.coerce.number({ error: "Enter a score" }).min(0, "Score can't be negative"),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

export const disputeSchema = z.object({
  questionId: z.number().int().positive().nullable().optional(),
  reason: z.string().trim().min(10, "Explain the problem in at least 10 characters").max(2000),
});

export const resolveDisputeSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  response: z.string().trim().min(5, "Explain the decision (the candidate will see it)").max(2000),
  /** New score for the disputed question when accepted. */
  newScore: z.coerce.number().min(0).optional().nullable(),
});

// ---- Bulk import ---------------------------------------------------------------------------------------------

export const candidateImportRowSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(100),
  email: emailSchema,
});

/** CSV columns: topic,difficulty,type,prompt,options(| separated),correct(| separated option numbers 1-based),marks,scheme */
export const questionImportRowSchema = z.object({
  topic: z.string().trim().min(1, "topic is required"),
  difficulty: z.enum(DIFFICULTIES, { error: "difficulty must be easy, medium or hard" }),
  type: z.enum(QUESTION_TYPES, { error: "type must be single, multiple or written" }),
  prompt: z.string().trim().min(5, "prompt is too short"),
  options: z.string().default(""),
  correct: z.string().default(""),
  marks: z.coerce.number({ error: "marks must be a number" }).positive("marks must be more than 0"),
  scheme: z.enum(SCHEMES).default("exact"),
});

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

// ---- Shapes returned by the API ------------------------------------------------------------------------------

export interface PaperQuestion {
  id: number;
  type: QuestionType;
  prompt: string;
  options: { id: string; text: string }[];
  marks: number;
  scheme: "exact" | "partial";
  topic: string;
  difficulty: Difficulty;
}

export function examPhase(e: { status: ExamStatus; startsAt: string; endsAt: string }, now = Date.now()): ExamPhase {
  if (e.status === "draft") return "draft";
  if (e.status === "completed") return "completed";
  if (now < Date.parse(e.startsAt)) return "upcoming";
  if (now <= Date.parse(e.endsAt)) return "ongoing";
  return "ended";
}

/**
 * Marking rules (also shown to candidates):
 * single - full marks if the one correct option is chosen.
 * multiple/exact - full marks only if the chosen set equals the correct set.
 * multiple/partial - marks × (correct chosen − wrong chosen) / total correct, never below 0.
 */
export function scoreObjective(
  q: { type: QuestionType; correct: string[]; marks: number; scheme: "exact" | "partial" },
  response: unknown,
): number {
  if (q.type === "written") return 0;
  const chosen = Array.isArray(response) ? new Set(response.map(String)) : new Set<string>();
  const correct = new Set(q.correct);
  if (q.type === "single") return chosen.size === 1 && correct.has([...chosen][0]!) ? q.marks : 0;
  if (q.scheme === "exact") {
    return chosen.size === correct.size && [...chosen].every((c) => correct.has(c)) ? q.marks : 0;
  }
  let right = 0;
  let wrong = 0;
  for (const c of chosen) (correct.has(c) ? right++ : wrong++);
  const raw = (q.marks * (right - wrong)) / Math.max(1, correct.size);
  return Math.max(0, Math.round(raw * 100) / 100);
}
