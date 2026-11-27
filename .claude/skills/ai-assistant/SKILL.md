---
name: ai-assistant
description: Configure, extend or debug the in-app AI assistant (Groq, streaming, read-only tools over the user's own data). Use to set the Groq key, change the model, add a tool for a theme-specific question, change the system prompt, or fix "the assistant couldn't answer".
---

## How it works

- UI: `apps/web/src/features/app/Assistant.tsx` (⌘J, or "Ask" from ⌘K). Streams over SSE from `POST /api/ai/chat`, shows a chip per tool call, renders a safe markdown subset; links like `/app/tasks?view=3` open the record inside the app.
- API: `apps/api/src/routes/ai.ts` - auth required, per-user rate limit (`AI_LIMITER`, 20/min), validated input (≤30 messages, ≤4000 chars each). Calls Groq's OpenAI-compatible `chat/completions` with `stream: true`, runs tool calls (max 4 rounds), then streams the final answer.
- Tools: `apps/api/src/services/ai.service.ts` (`AiTools`) - `search_records`, `summarize_resource`, `get_record`. **Read-only, executed as the signed-in user** through `ResourceService`, so permissions and owner scoping apply. The prompt lists only resources the user can read.

## Configure

- Local: put the key in `apps/api/.dev.vars` → `GROQ_API_KEY=gsk_...` (gitignored), restart `bun run dev`.
- Production: `cd apps/api && bun x wrangler secret put GROQ_API_KEY`.
- Model: default `openai/gpt-oss-120b` (production tool-use model on Groq). Override with `GROQ_MODEL` (e.g. `llama-3.3-70b-versatile`). Check the Groq models/deprecations page on the day - models get retired.
- Without a key the assistant shows a calm "not configured" state and the API returns 503 - nothing breaks.

## Add a theme-specific tool (e.g. "free rooms on a date")

1. Add a spec to `TOOL_SPECS` (name, description written for the model, JSON-schema parameters).
2. Handle it in `AiTools.run` - reuse services, stay read-only, check `this.user.permissions`.
3. Add a test in `apps/api/test/ai.test.ts` proving it respects permissions.
4. Mention it in the system prompt rules if the model needs a nudge.

## Test without a key

`GROQ_BASE_URL` points the API at any OpenAI-compatible server - a tiny local mock that first returns a tool call and then streams text exercises the full path (see PROGRESS.md 2026-11-27). Restore `.dev.vars` afterwards.

## Pitfalls

- Never give the assistant write tools during the event - read-only is what makes prompt injection harmless.
- Keep tool results small (`slim()` trims to declared fields, long text cut at 400 chars) - big payloads slow answers and cost tokens.
- A 429 from Groq is shown as "busy, try again"; the daily free-tier limit can run out during heavy practice - have a second key ready.
