import type { RealtimeEvent } from "@np/shared";
import type { Context } from "hono";
import type { AppEnv, Bindings } from "../env";

export function roomFor(env: Bindings, topic: string) {
  return env.REALTIME.get(env.REALTIME.idFromName(topic));
}

/** Broadcast an event to a topic after the response is sent (never blocks or fails the request). */
export function publish(c: Context<AppEnv>, topic: string, event: Omit<RealtimeEvent, "topic" | "at">) {
  const payload: RealtimeEvent = { ...event, topic, at: new Date().toISOString() };
  const p = roomFor(c.env, topic)
    .broadcast(JSON.stringify(payload))
    .catch((err: unknown) => console.error("realtime publish failed", err));
  try {
    c.executionCtx.waitUntil(p);
  } catch {
    // no execution context in some test paths
  }
}
