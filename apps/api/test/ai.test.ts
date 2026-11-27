import { describe, expect, it } from "vitest";
import { ADMIN, call, login } from "./helpers/client";


describe("assistant endpoints", () => {
  it("requires a session", async () => {
    expect((await call("/api/ai/status")).status).toBe(401);
    expect((await call("/api/ai/chat", { method: "POST", json: { messages: [{ role: "user", content: "hi" }] } })).status).toBe(401);
  });

  it("reports whether the assistant is configured", async () => {
    const cookie = await login(ADMIN);
    const res = await call("/api/ai/status", { cookie });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ enabled: false, model: expect.any(String) });
  });

  it("answers 503 (not a crash) when no Groq key is set", async () => {
    const cookie = await login(ADMIN);
    const res = await call("/api/ai/chat", { method: "POST", cookie, json: { messages: [{ role: "user", content: "hi" }] } });
    expect(res.status).toBe(503);
    expect(res.data.error.code).toBe("ai_not_configured");
  });
});
