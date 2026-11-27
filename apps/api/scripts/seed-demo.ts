/**
 * Demo data for judging: fictional people, questions and exams that show every part of the product.
 *   bun scripts/seed-demo.ts --local
 *   bun scripts/seed-demo.ts --remote
 * Re-runnable: it replaces only its own rows (exam ids 500-599, question ids 1000-1099, attempt ids 9000-9999)
 * and re-centres the "live" exam on the current time, so run it again right before a demo.
 * Passwords are demo-only and listed in the README (the brief asks for test credentials per role).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreObjective } from "@np/shared";
import { seedStatements, type SeedUser } from "../src/db/seed-sql";

const remote = process.argv.includes("--remote");
const q = (s: string | number | null) => (s === null ? "NULL" : typeof s === "number" ? String(s) : `'${s.replaceAll("'", "''")}'`);
const j = (v: unknown) => q(JSON.stringify(v));
const iso = (ms: number) => new Date(ms).toISOString();
const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");

// ---- People ----------------------------------------------------------------------------------------------------
const PW = { admin: "Admin@Demo2026", examiner: "Examiner@Demo2026", candidate: "Candidate@Demo2026" };
const examiners = [
  { email: "ayesha.khan@nullpointers.dev", fullName: "Dr. Ayesha Khan" },
  { email: "bilal.ahmed@nullpointers.dev", fullName: "Bilal Ahmed" },
];
const candidates = [
  ["hamza.iqbal", "Hamza Iqbal"],
  ["sana.malik", "Sana Malik"],
  ["usman.tariq", "Usman Tariq"],
  ["fatima.noor", "Fatima Noor"],
  ["ali.raza", "Ali Raza"],
  ["zainab.hussain", "Zainab Hussain"],
  ["omar.farooq", "Omar Farooq"],
  ["mariam.siddiqui", "Mariam Siddiqui"],
].map(([u, n]) => ({ email: `${u}@student.nullpointers.dev`, fullName: n! }));

const users: SeedUser[] = [
  { email: "admin@nullpointers.dev", fullName: "Platform Admin", password: PW.admin, role: "admin" },
  ...examiners.map((e) => ({ ...e, password: PW.examiner, role: "examiner" })),
  ...candidates.map((c) => ({ ...c, password: PW.candidate, role: "candidate" })),
];
const uid = (email: string) => `(SELECT id FROM users WHERE email = ${q(email)})`;

// ---- Question bank ---------------------------------------------------------------------------------------------
type Type = "single" | "multiple" | "written";
type Diff = "easy" | "medium" | "hard";
interface Q {
  id: number;
  owner: string;
  topic: string;
  difficulty: Diff;
  type: Type;
  prompt: string;
  options: string[];
  correct: number[]; // 0-based
  marks: number;
  scheme?: "exact" | "partial";
  explanation?: string;
}
const A = examiners[0]!.email;
const B = examiners[1]!.email;
const bank: Q[] = [
  // Data Structures (exam 501)
  { id: 1001, owner: A, topic: "Data Structures", difficulty: "easy", type: "single", prompt: "Which data structure removes items in last-in, first-out order?", options: ["Queue", "Stack", "Binary heap", "Hash table"], correct: [1], marks: 2 },
  { id: 1002, owner: A, topic: "Data Structures", difficulty: "easy", type: "single", prompt: "What is the worst-case time to find a value in an unsorted array of n items?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], correct: [2], marks: 2 },
  { id: 1003, owner: A, topic: "Sorting", difficulty: "medium", type: "multiple", scheme: "partial", prompt: "Which of these sorting algorithms are stable?", options: ["Merge sort", "Quick sort (Lomuto)", "Insertion sort", "Heap sort"], correct: [0, 2], marks: 4 },
  { id: 1004, owner: A, topic: "Trees", difficulty: "medium", type: "single", prompt: "A perfect binary tree has 31 nodes. How many levels does it have?", options: ["4", "5", "6", "16"], correct: [1], marks: 3 },
  { id: 1005, owner: A, topic: "Trees", difficulty: "medium", type: "single", prompt: "Which traversal of a binary search tree visits the keys in ascending order?", options: ["Pre-order", "Post-order", "In-order", "Level-order"], correct: [2], marks: 3 },
  { id: 1006, owner: A, topic: "Complexity", difficulty: "hard", type: "single", prompt: "A dynamic array doubles its capacity when full. What is the amortised cost of one append?", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], correct: [0], marks: 4 },
  { id: 1007, owner: A, topic: "Hashing", difficulty: "hard", type: "multiple", scheme: "exact", prompt: "Which statements about a hash table with separate chaining are true?", options: ["Average lookup is O(1) with a good hash function", "Worst-case lookup is O(n)", "The load factor can be greater than 1", "Keys must be integers"], correct: [0, 1, 2], marks: 5 },
  { id: 1008, owner: A, topic: "Data Structures", difficulty: "medium", type: "written", prompt: "Explain the difference between a stack and a queue, and give one real use for each.", options: [], correct: [], marks: 6 },
  { id: 1009, owner: A, topic: "Graphs", difficulty: "hard", type: "written", prompt: "Describe how Dijkstra's algorithm finds shortest paths, and explain why it can fail when an edge has a negative weight.", options: [], correct: [], marks: 8 },
  // Databases (exam 502, stratified draw: 3 easy x2, 2 medium x3, 1 hard x5 = 17 marks)
  { id: 1021, owner: A, topic: "SQL", difficulty: "easy", type: "single", prompt: "Which SQL clause filters groups after GROUP BY?", options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], correct: [1], marks: 2 },
  { id: 1022, owner: A, topic: "Keys", difficulty: "easy", type: "single", prompt: "Which key uniquely identifies every row of a table?", options: ["Foreign key", "Primary key", "Sort key", "Partial index"], correct: [1], marks: 2 },
  { id: 1023, owner: A, topic: "SQL", difficulty: "easy", type: "single", prompt: "Which statement removes every row but keeps the table and its structure?", options: ["DROP TABLE", "TRUNCATE TABLE", "ALTER TABLE", "CREATE TABLE"], correct: [1], marks: 2 },
  { id: 1024, owner: A, topic: "Transactions", difficulty: "easy", type: "single", prompt: "What does the A in ACID stand for?", options: ["Availability", "Atomicity", "Accuracy", "Authorisation"], correct: [1], marks: 2 },
  { id: 1025, owner: A, topic: "SQL", difficulty: "easy", type: "single", prompt: "Which join returns only the rows that have a match in both tables?", options: ["LEFT JOIN", "INNER JOIN", "FULL OUTER JOIN", "CROSS JOIN"], correct: [1], marks: 2 },
  { id: 1026, owner: A, topic: "Normalisation", difficulty: "medium", type: "single", prompt: "A table is already in 2NF. What else must hold for it to be in 3NF?", options: ["No partial dependencies on the key", "No transitive dependencies on the key", "Every column is indexed", "No column allows NULL"], correct: [1], marks: 3 },
  { id: 1027, owner: A, topic: "Transactions", difficulty: "medium", type: "multiple", scheme: "partial", prompt: "Which of these are isolation levels defined by the SQL standard?", options: ["Read committed", "Repeatable read", "Serializable", "Eventually consistent"], correct: [0, 1, 2], marks: 3 },
  { id: 1028, owner: A, topic: "Indexing", difficulty: "medium", type: "single", prompt: "Which index type best supports range queries such as BETWEEN?", options: ["Hash index", "B-tree index", "No index", "Full-text index"], correct: [1], marks: 3 },
  { id: 1029, owner: A, topic: "Keys", difficulty: "medium", type: "single", prompt: "What does a foreign key declared with ON DELETE CASCADE do?", options: ["Blocks deleting the parent row", "Deletes the child rows when the parent row is deleted", "Sets the child column to NULL", "Copies the parent row into the child table"], correct: [1], marks: 3 },
  { id: 1030, owner: A, topic: "Normalisation", difficulty: "hard", type: "single", prompt: "R(A, B, C) has key A and the dependencies A → B and B → C. What is the highest normal form R satisfies?", options: ["1NF", "2NF", "3NF", "BCNF"], correct: [1], marks: 5 },
  { id: 1031, owner: A, topic: "Transactions", difficulty: "hard", type: "written", prompt: "Two transactions move money between the same two accounts at the same time. Explain how a lost update can happen and one way to prevent it.", options: [], correct: [], marks: 5 },
  // Web Security (draft exam 503) and Networks (upcoming exam 504)
  { id: 1041, owner: B, topic: "Web Security", difficulty: "easy", type: "single", prompt: "Which cookie attribute stops page scripts from reading a session cookie?", options: ["Secure", "HttpOnly", "SameSite", "Path"], correct: [1], marks: 2 },
  { id: 1042, owner: B, topic: "Web Security", difficulty: "medium", type: "multiple", scheme: "partial", prompt: "Which measures help prevent SQL injection?", options: ["Parameterised queries", "Escaping output in HTML only", "A least-privilege database account", "A client-side length limit only"], correct: [0, 2], marks: 4 },
  { id: 1043, owner: B, topic: "Web Security", difficulty: "medium", type: "single", prompt: "What does a Content-Security-Policy header mainly defend against?", options: ["Cross-site scripting", "Cross-site request forgery", "Denial of service", "Password guessing"], correct: [0], marks: 3 },
  { id: 1044, owner: B, topic: "Web Security", difficulty: "hard", type: "written", prompt: "Explain how a cross-site request forgery attack works and describe two defences.", options: [], correct: [], marks: 6 },
  { id: 1051, owner: B, topic: "Networks", difficulty: "easy", type: "single", prompt: "Which OSI layer does IP belong to?", options: ["Transport", "Network", "Data link", "Session"], correct: [1], marks: 2 },
  { id: 1052, owner: B, topic: "Networks", difficulty: "medium", type: "single", prompt: "How many usable host addresses does a /26 IPv4 subnet have?", options: ["30", "62", "64", "126"], correct: [1], marks: 3 },
  { id: 1053, owner: B, topic: "Networks", difficulty: "medium", type: "multiple", scheme: "exact", prompt: "Which of these protocols normally run over TCP?", options: ["HTTP/1.1", "DNS lookups", "SMTP", "SSH"], correct: [0, 2, 3], marks: 3 },
];
const LETTERS = "abcdefgh";
const opts = (x: Q) => x.options.map((text, i) => ({ id: LETTERS[i]!, text }));
const key = (x: Q) => x.correct.map((i) => LETTERS[i]!);
const byId = new Map(bank.map((x) => [x.id, x]));
const paperItem = (x: Q) => ({ id: x.id, type: x.type, prompt: x.prompt, options: opts(x), correct: key(x), marks: x.marks, scheme: x.scheme ?? "exact", topic: x.topic, difficulty: x.difficulty });

// ---- Exams -----------------------------------------------------------------------------------------------------
interface Exam {
  id: number;
  owner: string;
  title: string;
  instructions: string;
  startsAt: number;
  endsAt: number;
  duration: number;
  total: number;
  pass: number;
  status: "draft" | "published" | "completed";
  pool: number[];
  draw?: [number, number, number];
  results?: boolean;
  enrol: number[]; // candidate indexes
}
const sum = (ids: number[]) => ids.reduce((s, i) => s + byId.get(i)!.marks, 0);
const dsPool = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009];
const dbPool = [1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031];
const exams: Exam[] = [
  { id: 501, owner: A, title: "CS-201 Data Structures · Midterm", instructions: "Answer every question. Written answers are marked by hand; multiple-select questions say how they are marked. You may use the scratchpad for working.", startsAt: NOW - 30 * HOUR, endsAt: NOW - 26 * HOUR, duration: 60, total: sum(dsPool), pass: 50, status: "completed", pool: dsPool, results: true, enrol: [0, 1, 2, 3, 4, 5, 6, 7] },
  { id: 502, owner: A, title: "CS-301 Databases · Quiz 3", instructions: "Each paper draws 3 easy, 2 medium and 1 hard question from a larger pool, so every paper carries the same difficulty and marks. Your answers save as you go, even if the connection drops.", startsAt: NOW - 1 * HOUR, endsAt: NOW + 8 * HOUR, duration: 45, total: 17, pass: 50, status: "published", pool: dbPool, draw: [3, 2, 1], enrol: [0, 1, 2, 3, 4, 5, 6, 7] },
  { id: 503, owner: B, title: "SE-410 Web Security · Final", instructions: "Closed book. Two hours.", startsAt: NOW + 3 * 24 * HOUR, endsAt: NOW + 3 * 24 * HOUR + 3 * HOUR, duration: 120, total: 20, pass: 50, status: "draft", pool: [1041, 1042, 1043, 1044], enrol: [] },
  { id: 504, owner: B, title: "CS-330 Computer Networks · Quiz 1", instructions: "A short quiz on addressing and protocols.", startsAt: NOW + 22 * HOUR, endsAt: NOW + 26 * HOUR, duration: 20, total: sum([1051, 1052, 1053]), pass: 40, status: "published", pool: [1051, 1052, 1053], enrol: [0, 1, 2, 3, 4, 5, 6, 7] },
];

// ---- Attempts --------------------------------------------------------------------------------------------------
type Resp = string[] | string | null;
interface Graded { score: number; feedback: string }
interface Attempt {
  id: number;
  exam: number;
  cand: number;
  status: "in_progress" | "submitted";
  startedAt: number;
  paper: number[];
  answers: Record<number, Resp>;
  manual?: Record<number, Graded>;
  flagged?: number[];
  incidents?: [string, string, number][];
}
const W = {
  stackGood: "A stack is last-in, first-out: the most recent item comes out first, like the undo history in an editor. A queue is first-in, first-out: items leave in arrival order, like print jobs waiting for a printer.",
  stackOk: "Stack is LIFO and queue is FIFO. Stack is used for function calls.",
  dijkGood: "Dijkstra keeps a priority queue of tentative distances, repeatedly takes the closest unvisited node and relaxes its edges. Once a node is taken its distance is final. A negative edge can later make an already-final node cheaper, so the greedy choice is no longer safe.",
  dijkOk: "It picks the nearest node each time and updates neighbours. Negative edges break it because distances can go down.",
};
const ds: Attempt[] = [
  { id: 9001, exam: 501, cand: 0, status: "submitted", startedAt: NOW - 29 * HOUR, paper: dsPool, answers: { 1001: ["b"], 1002: ["c"], 1003: ["a", "c"], 1004: ["b"], 1005: ["c"], 1006: ["a"], 1007: ["a", "b", "c"], 1008: W.stackGood, 1009: W.dijkGood }, manual: { 1008: { score: 6, feedback: "Clear and complete." }, 1009: { score: 7, feedback: "Good. Mention the relaxation invariant explicitly." } } },
  { id: 9002, exam: 501, cand: 1, status: "submitted", startedAt: NOW - 29 * HOUR, paper: dsPool, answers: { 1001: ["b"], 1002: ["c"], 1003: ["a"], 1004: ["b"], 1005: ["c"], 1006: ["c"], 1007: ["a", "b"], 1008: W.stackOk, 1009: W.dijkOk }, manual: { 1008: { score: 4, feedback: "Correct definitions; the queue example is missing." }, 1009: { score: 5, feedback: "Right idea, explain why a settled node can't change." } } },
  { id: 9003, exam: 501, cand: 2, status: "submitted", startedAt: NOW - 28.8 * HOUR, paper: dsPool, answers: { 1001: ["a"], 1002: ["c"], 1003: ["a", "b"], 1004: ["c"], 1005: ["c"], 1006: ["a"], 1007: ["a", "b", "c"], 1008: W.stackOk, 1009: "" }, manual: { 1008: { score: 3, feedback: "Only the stack use is given." }, 1009: { score: 0, feedback: "Not answered." } } },
  { id: 9004, exam: 501, cand: 3, status: "submitted", startedAt: NOW - 29 * HOUR, paper: dsPool, answers: { 1001: ["b"], 1002: ["c"], 1003: ["a", "c"], 1004: ["b"], 1005: ["c"], 1006: ["a"], 1007: ["a", "c"], 1008: W.stackGood, 1009: W.dijkOk }, manual: { 1008: { score: 6, feedback: "Excellent examples." }, 1009: { score: 6, feedback: "Good explanation of the failure case." } } },
  { id: 9005, exam: 501, cand: 4, status: "submitted", startedAt: NOW - 28.5 * HOUR, paper: dsPool, answers: { 1001: ["b"], 1002: ["b"], 1003: ["c"], 1004: ["a"], 1005: ["a"], 1006: ["c"], 1007: ["d"], 1008: W.stackOk, 1009: W.dijkOk }, manual: { 1008: { score: 3, feedback: "Definitions only." }, 1009: { score: 4, feedback: "Partly correct." } }, incidents: [["tab_hidden", "Tab hidden for 12s", 29 * HOUR - 20 * MIN], ["window_blur", "Window lost focus", 29 * HOUR - 19 * MIN]] },
  { id: 9006, exam: 501, cand: 5, status: "submitted", startedAt: NOW - 29 * HOUR, paper: dsPool, answers: { 1001: ["b"], 1002: ["c"], 1003: ["a", "c", "d"], 1004: ["b"], 1005: ["c"], 1006: ["a"], 1007: ["a", "b", "c"], 1008: W.stackGood, 1009: W.dijkGood }, manual: { 1008: { score: 5, feedback: "Good." }, 1009: { score: 8, feedback: "Excellent." } } },
];
// Live exam: fixed papers that respect the 3/2/1 draw.
const live: Attempt[] = [
  { id: 9101, exam: 502, cand: 0, status: "in_progress", startedAt: NOW - 18 * MIN, paper: [1023, 1021, 1028, 1025, 1030, 1027], answers: { 1021: ["b"], 1023: ["b"], 1025: ["b"], 1028: ["b"] }, flagged: [1030], incidents: [["window_blur", "Window lost focus", 9 * MIN]] },
  { id: 9102, exam: 502, cand: 1, status: "in_progress", startedAt: NOW - 25 * MIN, paper: [1022, 1026, 1024, 1031, 1029, 1021], answers: { 1022: ["b"], 1024: ["b"], 1026: ["b"], 1029: ["b"], 1021: ["a"] } },
  { id: 9103, exam: 502, cand: 3, status: "in_progress", startedAt: NOW - 8 * MIN, paper: [1025, 1027, 1022, 1030, 1023, 1028], answers: { 1025: ["b"] }, incidents: [["offline", "Connection lost for 40s", 4 * MIN], ["resumed", "No contact for 41s, then resumed", 3 * MIN]] },
  { id: 9104, exam: 502, cand: 6, status: "submitted", startedAt: NOW - 50 * MIN, paper: [1024, 1029, 1021, 1026, 1031, 1022], answers: { 1024: ["b"], 1029: ["b"], 1021: ["b"], 1026: ["a"], 1022: ["b"], 1031: "T1 and T2 both read the balance, each adds its change and writes back, so one write is lost. Locking the row with SELECT ... FOR UPDATE prevents it." } },
];

// ---- SQL -------------------------------------------------------------------------------------------------------
const lines: string[] = [
  "DELETE FROM exams WHERE id BETWEEN 500 AND 599",
  "DELETE FROM attempts WHERE id BETWEEN 9000 AND 9999",
  "DELETE FROM questions WHERE id BETWEEN 1000 AND 1099",
];
lines.push(...(await seedStatements(users)));

for (const x of bank) {
  lines.push(
    `INSERT INTO questions (id, owner_id, topic, difficulty, type, prompt, options, correct, marks, scheme, explanation, created_at, updated_at) VALUES (${x.id}, ${uid(x.owner)}, ${q(x.topic)}, ${q(x.difficulty)}, ${q(x.type)}, ${q(x.prompt)}, ${j(opts(x))}, ${j(key(x))}, ${x.marks}, ${q(x.scheme ?? "exact")}, ${q(x.explanation ?? null)}, ${q(iso(NOW - 3 * 24 * HOUR))}, ${q(iso(NOW - 3 * 24 * HOUR))})`,
  );
}
for (const e of exams) {
  const [de, dm, dh] = e.draw ?? [null, null, null];
  const publishedAt = e.results ? iso(NOW - 20 * HOUR) : null;
  lines.push(
    `INSERT INTO exams (id, owner_id, title, instructions, starts_at, ends_at, duration_minutes, total_marks, pass_percent, status, shuffle_questions, shuffle_options, draw_easy, draw_medium, draw_hard, block_copy_paste, results_published, results_published_at, created_at, updated_at) VALUES (${e.id}, ${uid(e.owner)}, ${q(e.title)}, ${q(e.instructions)}, ${q(iso(e.startsAt))}, ${q(iso(e.endsAt))}, ${e.duration}, ${e.total}, ${e.pass}, ${q(e.status)}, 1, 1, ${de ?? "NULL"}, ${dm ?? "NULL"}, ${dh ?? "NULL"}, 1, ${e.results ? 1 : 0}, ${q(publishedAt)}, ${q(iso(NOW - 2 * 24 * HOUR))}, ${q(iso(NOW - 2 * 24 * HOUR))})`,
  );
  e.pool.forEach((qid, i) => lines.push(`INSERT INTO exam_questions (exam_id, question_id, position) VALUES (${e.id}, ${qid}, ${i})`));
  for (const c of e.enrol) lines.push(`INSERT INTO enrollments (exam_id, candidate_id, created_at) VALUES (${e.id}, ${uid(candidates[c]!.email)}, ${q(iso(NOW - 2 * 24 * HOUR))})`);
}

for (const a of [...ds, ...live]) {
  const exam = exams.find((e) => e.id === a.exam)!;
  const paper = a.paper.map((id) => paperItem(byId.get(id)!));
  const max = paper.reduce((s, p) => s + p.marks, 0);
  const deadline = Math.min(a.startedAt + exam.duration * MIN, exam.endsAt);
  let score = 0;
  let pending = 0;
  const answerRows: string[] = [];
  for (const p of paper) {
    const resp = a.answers[p.id];
    const manual = a.manual?.[p.id];
    const auto = p.type === "written" ? null : scoreObjective(p, resp ?? null);
    if (p.type === "written") {
      if (manual) score += manual.score;
      else if (typeof resp === "string" && resp.trim() && a.status !== "in_progress") pending++;
    } else score += auto ?? 0;
    if (resp === undefined && !manual) continue;
    const flagged = a.flagged?.includes(p.id) ? 1 : 0;
    const savedAt = iso(Math.min(deadline, a.startedAt + 5 * MIN + answerRows.length * 2 * MIN));
    answerRows.push(
      `INSERT INTO answers (attempt_id, question_id, response, flagged, saved_at, auto_score, manual_score, feedback, graded_by) VALUES (${a.id}, ${p.id}, ${resp === undefined ? "NULL" : j(resp)}, ${flagged}, ${q(savedAt)}, ${a.status === "in_progress" ? "NULL" : (auto ?? "NULL")}, ${manual ? manual.score : "NULL"}, ${q(manual?.feedback ?? null)}, ${manual ? uid(exam.owner) : "NULL"})`,
    );
  }
  const done = a.status !== "in_progress";
  const submittedAt = done ? iso(Math.min(deadline, a.startedAt + 41 * MIN)) : null;
  const lastSeen = done ? submittedAt : iso(NOW - 10_000);
  lines.push(
    `INSERT INTO attempts (id, exam_id, candidate_id, is_sandbox, status, started_at, deadline_at, extra_minutes, submitted_at, last_seen_at, session_id, paper, score, max_score, pending_manual, scratchpad, verify_code, created_at, updated_at) VALUES (${a.id}, ${a.exam}, ${uid(candidates[a.cand]!.email)}, 0, ${q(a.status)}, ${q(iso(a.startedAt))}, ${q(iso(deadline))}, 0, ${q(submittedAt)}, ${q(lastSeen)}, ${q(`seed-${a.id}`)}, ${j(paper)}, ${done ? Math.round(score * 100) / 100 : "NULL"}, ${max}, ${pending}, '', ${q(code())}, ${q(iso(a.startedAt))}, ${q(submittedAt ?? iso(NOW))})`,
    ...answerRows,
  );
  for (const [type, detail, ago] of a.incidents ?? []) lines.push(`INSERT INTO incidents (attempt_id, type, detail, at) VALUES (${a.id}, ${q(type)}, ${q(detail)}, ${q(iso(NOW - ago))})`);
}

// A live announcement and an open dispute on the published midterm (innovation 5.4).
lines.push(`INSERT INTO announcements (exam_id, message, created_by, at) VALUES (502, 'Reminder: in SQL, BETWEEN includes both ends of the range.', ${uid(A)}, ${q(iso(NOW - 12 * MIN))})`);
lines.push(`INSERT INTO disputes (attempt_id, question_id, reason, status, score_before, created_at) VALUES (9002, 1007, 'I picked two of the three true statements and none of the false one, but all-or-nothing marking gave me 0 of 5. The question did not say in the prompt that it is all-or-nothing, so I think partial credit is fairer.', 'open', (SELECT score FROM attempts WHERE id = 9002), ${q(iso(NOW - 6 * HOUR))})`);

const dir = mkdtempSync(join(tmpdir(), "np-demo-"));
const file = join(dir, "demo.sql");
writeFileSync(file, lines.map((s) => `${s};`).join("\n"));
const result = spawnSync(process.execPath, ["x", "wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", `--file=${file}`, "--yes"], {
  stdio: ["ignore", "pipe", "inherit"],
  cwd: fileURLToPath(new URL("..", import.meta.url).href),
});
rmSync(dir, { recursive: true, force: true });
if (result.status !== 0) {
  console.error(String(result.stdout ?? ""));
  process.exit(result.status ?? 1);
}
console.log(`Demo data loaded (${remote ? "remote" : "local"}): ${users.length} users, ${bank.length} questions, ${exams.length} exams, ${ds.length + live.length} attempts.`);
