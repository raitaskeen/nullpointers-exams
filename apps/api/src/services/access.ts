import type { BatchItem } from "drizzle-orm/batch";
import { eq } from "drizzle-orm";
import { exams } from "../db/schema";
import type { Db, SessionUser } from "../env";
import { AppError } from "../lib/errors";

export const isAdmin = (u: SessionUser) => u.permissions.includes("platform:admin");

/** Examiners manage their own exams; admins manage all. Anything else is a 404 (don't reveal existence). */
export async function managedExam(db: Db, user: SessionUser, examId: number) {
  if (!user.permissions.includes("exams:manage")) throw AppError.forbidden();
  const exam = await db.select().from(exams).where(eq(exams.id, examId)).get();
  if (!exam || (!isAdmin(user) && exam.ownerId !== user.id)) throw AppError.notFound("Exam");
  return exam;
}

export function randomCode(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I - easy to read aloud
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Fisher-Yates with crypto randomness. */
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const nowIso = () => new Date().toISOString();

/** "A. Khan" style masking for public verification pages. */
export function maskName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p : `${p[0]}.`))
    .join(" ");
}

/** D1 batch: several statements in one atomic round trip. Drizzle's tuple type is too strict for built lists. */
export const asBatch = (ops: unknown[]) => ops as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
