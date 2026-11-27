import { Hono, type Context } from "hono";
import { and, eq } from "drizzle-orm";
import { attempts, enrollments } from "../db/schema";
import { managedExam } from "../services/access";
import { TOPIC_PATTERN, getResource, type RealtimeTicket } from "@np/shared";
import type { AppEnv } from "../env";
import { AppError } from "../lib/errors";
import { assertSecret, signWsTicket, verifyWsTicket } from "../lib/tokens";
import { requireAuth } from "../middleware/auth";
import { roomFor } from "../realtime/publish";
import { allowedOrigins } from "../lib/origins";

/**
 * Who may listen to which topic:
 *   exam-<id>        live monitoring feed     -> that exam's examiner or an admin
 *   exam-<id>-live   announcements/close      -> the examiner, admins, or a candidate enrolled in it
 *   attempt-<id>     deadline changes         -> the candidate who owns the attempt
 *   <resource>       generic resources        -> <resource>:read
 */
async function checkTopic(c: Context<AppEnv>, topic: string) {
  const user = c.get("user")!;
  if (!TOPIC_PATTERN.test(topic)) throw AppError.badRequest("Invalid topic name.");
  const exam = topic.match(/^exam-(\d+)(-live)?$/);
  if (exam) {
    const examId = Number(exam[1]);
    const manages = await managedExam(c.get("db"), user, examId).then(() => true, () => false);
    if (manages) return;
    if (exam[2]) {
      const enrolled = await c.get("db").select().from(enrollments).where(and(eq(enrollments.examId, examId), eq(enrollments.candidateId, user.id))).get();
      if (enrolled) return;
    }
    throw AppError.forbidden();
  }
  const attempt = topic.match(/^attempt-(\d+)$/);
  if (attempt) {
    const a = await c.get("db").select({ candidateId: attempts.candidateId }).from(attempts).where(eq(attempts.id, Number(attempt[1]))).get();
    if (a?.candidateId === user.id) return;
    throw AppError.forbidden();
  }
  if (getResource(topic) && !user.permissions.includes(`${topic}:read`)) throw AppError.forbidden();
}

/** Step 1 (cookie-authenticated, same origin): get a 60-second ticket for one topic. */
export const realtimeRoutes = new Hono<AppEnv>().get("/ticket", requireAuth, async (c) => {
  const user = c.get("user")!;
  const topic = c.req.query("topic") ?? "";
  await checkTopic(c, topic);
  const { ticket, expiresIn } = await signWsTicket(user.id, topic, assertSecret(c.env.JWT_SECRET));
  const base = (c.env.PUBLIC_API_URL || new URL(c.req.url).origin).replace(/^http/, "ws");
  const body: RealtimeTicket = { ticket, expiresIn, url: `${base}/ws/${topic}?ticket=${encodeURIComponent(ticket)}` };
  return c.json(body);
});

/** Step 2 (direct to the Worker - Vercel can't proxy WebSockets): upgrade with the ticket. */
export const wsRoutes = new Hono<AppEnv>().get("/:topic", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") throw new AppError(426, "upgrade_required", "WebSocket only.");
  // Cross-site WebSocket hijacking guard: browsers always send Origin on upgrades.
  const origin = c.req.header("origin");
  if (origin && !allowedOrigins(c.env).includes(origin)) throw AppError.forbidden("Origin not allowed.");

  const topic = c.req.param("topic");
  const claims = await verifyWsTicket(c.req.query("ticket") ?? "", assertSecret(c.env.JWT_SECRET));
  if (!claims || claims.topic !== topic) throw AppError.unauthorized("Invalid or expired realtime ticket.");

  const headers = new Headers(c.req.raw.headers);
  headers.set("x-np-user", String(claims.userId));
  return roomFor(c.env, topic).fetch(new Request(c.req.raw.url, { headers }));
});
