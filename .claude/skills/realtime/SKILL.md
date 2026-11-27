---
name: realtime
description: Add or change live updates over WebSockets (Cloudflare Durable Objects) - live lists, dashboards, notifications, presence. Use when a feature needs push updates. Resources with realtime true already broadcast created/updated/deleted automatically.
---

## How it works

1. Browser asks `GET /api/realtime/ticket?topic=<t>` (same-origin, cookie auth). The API checks the user may read that topic (resource topics need `<topic>:read`) and returns a **60-second signed ticket** plus the socket URL.
2. Browser opens `wss://<worker>/ws/<topic>?ticket=...` directly (Vercel can't proxy WebSockets). The Worker checks the ticket and the Origin, then hands the socket to the `RealtimeRoom` Durable Object named after the topic.
3. Rooms use the **Hibernation API**: idle sockets cost nothing; `ping`/`pong` heartbeats are answered by the runtime without waking the object.
4. Any route calls `publish(c, topic, { type, id, data? })` - delivered after the response via `waitUntil`, so it never slows or fails a request.
5. Sockets are receive-only. All writes go through the authenticated REST API.

Owner-scoped resources broadcast without `data` (other listeners may not be allowed to see the row); clients just refetch, which re-applies the API's scoping.

## Using it in the UI

```tsx
import { useLiveResource, useRealtime } from "@/lib/realtime";

useLiveResource("bookings");                         // refetch bookings queries on any change
const { connected } = useRealtime("lobby", (e) => {  // custom topic
  toast(`${e.type} by user ${e.by}`);
});
```

## Custom topic from the API

```ts
import { publish } from "../realtime/publish";
publish(c, "announcements", { type: "posted", data: { text } });
```
Topic names: lowercase `a-z0-9_-`, max 64 chars.

## Done when

Two browser tabs: a change in one appears in the other without reload, and the list header shows "Live".

## Pitfalls

- Durable Objects need the `migrations` entry in `wrangler.jsonc` (already there for `RealtimeRoom`). A new DO class needs a new migration tag.
- In dev, React StrictMode opens the socket twice - expected, not a bug.
- Never broadcast secrets or other users' private rows on a shared topic.
