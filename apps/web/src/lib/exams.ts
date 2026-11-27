import type { Difficulty, ExamPhase, ExamStatus, PaperQuestion, QuestionType } from "@np/shared";

/**
 * Shapes the exam API returns (see apps/api/src/services/*). Kept in one place so every screen agrees.
 */

export interface Question {
  id: number;
  ownerId: number;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  options: { id: string; text: string }[];
  correct: string[];
  marks: number;
  scheme: "exact" | "partial";
  explanation: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface QuestionPage {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
  topics: string[];
}

export interface ExamRow {
  id: number;
  ownerId: number;
  title: string;
  instructions: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  totalMarks: number;
  passPercent: number;
  status: ExamStatus;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  drawEasy: number | null;
  drawMedium: number | null;
  drawHard: number | null;
  blockCopyPaste: boolean;
  resultsPublished: boolean;
  resultsPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  phase: ExamPhase;
}
export interface ExamListRow extends ExamRow {
  ownerName: string | null;
  counts: { questions: number; enrolled: number; submitted: number; active: number; pendingGrading: number };
}
export interface ExamDetail extends ExamRow {
  pool: Question[];
  problems: string[];
}

export interface Enrollment {
  candidateId: number;
  fullName: string;
  email: string;
  enrolledAt: string;
  attemptId: number | null;
  status: AttemptStatus | null;
  score: number | null;
  maxScore: number | null;
  pendingManual: number | null;
  submittedAt: string | null;
}

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export interface MonitorData {
  exam: { id: number; title: string; phase: ExamPhase; endsAt: string; status: ExamStatus };
  enrolled: number;
  attempts: {
    id: number;
    candidateId: number;
    fullName: string;
    email: string;
    status: AttemptStatus;
    startedAt: string;
    deadlineAt: string;
    extraMinutes: number;
    submittedAt: string | null;
    lastSeenAt: string | null;
    online: boolean;
    answered: number;
    total: number;
    flagged: number;
    signals: number;
  }[];
  incidents: { id: number; type: string; detail: string | null; at: string; attemptId: number; fullName: string }[];
  announcements: { id: number; examId: number; message: string; at: string }[];
}

export interface GradingRow {
  attemptId: number;
  fullName: string;
  status: AttemptStatus;
  score: number | null;
  maxScore: number;
  pendingManual: number;
  written: { questionId: number; prompt: string; marks: number; response: string; manualScore: number | null; feedback: string | null }[];
}

export interface Analytics {
  exam: { id: number; title: string; passPercent: number; totalMarks: number; resultsPublished: boolean };
  summary: { submitted: number; meanPercent: number; medianPercent: number; highestPercent: number; lowestPercent: number; passRate: number; pendingGrading: number };
  distribution: { range: string; count: number }[];
  topics: { topic: string; percent: number }[];
  candidates: { attemptId: number; fullName: string; score: number | null; maxScore: number; percent: number; passed: boolean; status: AttemptStatus; pendingManual: number }[];
  questions: {
    id: number;
    prompt: string;
    type: QuestionType;
    topic: string;
    difficulty: Difficulty;
    marks: number;
    served: number;
    skippedPercent: number;
    correctPercent: number;
    averageScore: number;
    observedDifficulty: Difficulty;
    commonWrong: { text: string; count: number } | null;
  }[];
}

export interface MyExam {
  id: number;
  title: string;
  instructions: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  totalMarks: number;
  passPercent: number;
  phase: ExamPhase;
  resultsPublished: boolean;
  attempt: { id: number; status: AttemptStatus; deadlineAt: string; submittedAt: string | null; score: number | null; maxScore: number } | null;
}

export interface MyResult {
  attemptId: number;
  examId: number;
  title: string;
  score: number | null;
  maxScore: number;
  percent: number;
  passed: boolean;
  publishedAt: string | null;
  verifyCode: string;
}

export interface ResultDetail {
  attempt: { id: number; status: AttemptStatus; score: number | null; maxScore: number; pendingManual: number; submittedAt: string | null; startedAt: string; verifyCode: string | null; isSandbox: boolean; candidateId: number };
  exam: { id: number; title: string; passPercent: number; resultsPublished: boolean; resultsPublishedAt: string | null };
  questions: {
    number: number;
    id: number;
    type: QuestionType;
    prompt: string;
    topic: string;
    marks: number;
    awarded: number | null;
    answered: boolean;
    feedback: string | null;
    response: string[] | string | null;
    options: { id: string; text: string }[];
    correct?: string[];
  }[];
}

export interface Dispute {
  id: number;
  attemptId: number;
  questionId: number | null;
  reason: string;
  status: "open" | "accepted" | "rejected";
  response: string | null;
  resolvedBy: number | null;
  resolvedAt: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  createdAt: string;
  exam: string;
  examId: number;
  candidate: string;
  question: { id: number; prompt: string; marks: number; number: number } | null;
}

export interface AttemptState {
  attempt: { id: number; examId: number; status: AttemptStatus; isSandbox: boolean; startedAt: string; deadlineAt: string; submittedAt: string | null; extraMinutes: number; scratchpad: string };
  exam: { id: number; title: string; instructions: string; totalMarks: number; blockCopyPaste: boolean };
  paper: PaperQuestion[];
  answers: { questionId: number; response: string[] | string | null; flagged: boolean; savedAt: string }[];
  announcements: { id: number; message: string; at: string }[];
  serverNow: string;
}

export interface VerifyResult {
  valid: boolean;
  code?: string;
  exam?: string;
  candidate?: string;
  score?: number | null;
  maxScore?: number;
  percent?: number;
  passed?: boolean;
  issuedAt?: string | null;
  lastUpdated?: string;
}

// ---- Presentation helpers ------------------------------------------------------------------------------------

export const PHASE_LABEL: Record<ExamPhase, string> = {
  draft: "Draft",
  upcoming: "Scheduled",
  ongoing: "Live now",
  ended: "Window closed",
  completed: "Completed",
};
export const PHASE_TONE: Record<ExamPhase, "neutral" | "info" | "success" | "warning"> = {
  draft: "neutral",
  upcoming: "info",
  ongoing: "success",
  ended: "warning",
  completed: "neutral",
};
export const DIFF_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export const SIGNAL_LABEL: Record<string, string> = {
  tab_hidden: "Switched away from the tab",
  window_blur: "Window lost focus",
  fullscreen_exit: "Left full screen",
  copy: "Copy attempted",
  paste: "Paste attempted",
  offline: "Connection lost",
  resumed: "Resumed after a gap",
  multiple_sessions: "Opened on a second device or tab",
  devtools: "Developer tools opened",
  time_extended: "Time extended",
};

const dtf = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const tf = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
export const fmtDateTime = (iso: string | null | undefined) => (iso ? dtf.format(new Date(iso)) : "-");
export const fmtTime = (iso: string | null | undefined) => (iso ? tf.format(new Date(iso)) : "-");
export function fmtWindow(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay ? `${dtf.format(s)} – ${tf.format(e)}` : `${dtf.format(s)} – ${dtf.format(e)}`;
}
export const pct = (score: number | null | undefined, max: number | null | undefined) =>
  max ? Math.round(((score ?? 0) / max) * 1000) / 10 : 0;
export const fmtMarks = (n: number | null | undefined) => (n == null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "never";
  const s = Math.round((Date.parse(iso) - now) / 1000);
  if (Math.abs(s) < 45) return "just now";
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, "minute");
  const h = Math.round(s / 3600);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(s / 86400), "day");
}
export function until(iso: string, now = Date.now()) {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "now";
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h} h ${m % 60} min`;
  return `in ${Math.round(h / 24)} days`;
}

/** Download an authenticated file (PDF) from the API without exposing anything in the URL. */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!res.ok) {
    let message = "Couldn't download the file.";
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Save text as a file (credentials CSV after an import). */
export function saveText(text: string, filename: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
