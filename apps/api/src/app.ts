import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import type { AppEnv } from "./env";
import { AppError } from "./lib/errors";
import { isAllowedOrigin } from "./lib/origins";
import { loadUser } from "./middleware/auth";
import { activityRoutes } from "./routes/activity";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { realtimeRoutes, wsRoutes } from "./routes/realtime";
import { userRoutes } from "./routes/users";
import { attemptRoutes, candidateRoutes, examRoutes, questionRoutes, verifyRoutes } from "./routes/exams";
// GENERATOR:ROUTE_IMPORTS (bun run gen adds imports above this line - keep it)

export const app = new Hono<AppEnv>();

// ---- Security + plumbing, applied to every request --------------------------------------------------------
app.use(requestId());
// HSTS, nosniff, frame-deny, strict referrer, CORP... Not on /ws/*: a 101 upgrade response has immutable headers.
app.use("/api/*", secureHeaders());
app.use("/api/*", cors({ origin: (o, c) => (isAllowedOrigin(c, o) ? o : null), credentials: true, maxAge: 600 }));
app.use("/api/*", csrf({ origin: (o, c) => isAllowedOrigin(c, o) }));
app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024, onError: () => { throw new AppError(413, "too_large", "Request body is too large."); } }));
app.use(async (c, next) => {
  c.set("db", drizzle(c.env.DB, { schema, casing: "snake_case" }));
  await next();
});
app.use("/api/*", loadUser);

// ---- Routes ------------------------------------------------------------------------------------------------
app.get("/api/health", async (c) => {
  await c.get("db").run(sql`select 1`);
  return c.json({ status: "ok", db: "ok", environment: c.env.ENVIRONMENT, time: new Date().toISOString() });
});
app.route("/api/auth", authRoutes);
app.route("/api/users", userRoutes);
app.route("/api/realtime", realtimeRoutes);
app.route("/api/activity", activityRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/questions", questionRoutes);
app.route("/api/exams", examRoutes);
app.route("/api/me", candidateRoutes);
app.route("/api/attempts", attemptRoutes);
app.route("/api/verify", verifyRoutes);
app.route("/ws", wsRoutes);
// GENERATOR:ROUTES (bun run gen adds resource routes above this line - keep it)

// ---- Errors: one JSON shape for everything (ApiErrorBody in @np/shared) -----------------------------------
app.notFound((c) => c.json({ error: { code: "not_found", message: "Route not found." } }, 404));
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status);
  }
  // Hono's own HTTPExceptions (e.g. CSRF rejection) carry a status.
  const status = (err as { status?: number }).status;
  if (status === 403) return c.json({ error: { code: "forbidden", message: "Request blocked." } }, 403);
  console.error(`[${c.get("requestId")}]`, err);
  return c.json({ error: { code: "internal", message: "Something went wrong on our side." } }, 500);
});
