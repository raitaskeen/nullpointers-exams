import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema";
import type { RealtimeRoom } from "./realtime/room";

export interface Bindings {
  DB: D1Database;
  REALTIME: DurableObjectNamespace<RealtimeRoom>;
  /** Optional so tests and older local runtimes work without it. */
  AUTH_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  AI_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  JWT_SECRET: string;
  /** Optional: enables the AI assistant (wrangler secret put GROQ_API_KEY). */
  GROQ_API_KEY?: string;
  /** Optional model override, default openai/gpt-oss-120b. */
  GROQ_MODEL?: string;
  /** Optional OpenAI-compatible base URL (tests/mocks). Default https://api.groq.com/openai/v1. */
  GROQ_BASE_URL?: string;
  WEB_ORIGINS: string;
  PUBLIC_API_URL: string;
  ENVIRONMENT: string;
}

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
}

export type Db = DrizzleD1Database<typeof schema>;

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    db: Db;
    user: SessionUser | null;
  };
}
