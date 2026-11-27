import { DurableObject } from "cloudflare:workers";
import type { Bindings } from "../env";

/**
 * One Durable Object instance per topic. Uses the WebSocket Hibernation API, so idle sockets cost nothing:
 * the object sleeps between messages and Cloudflare keeps the connections open for it.
 */
export class RealtimeRoom extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    // Heartbeats are answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** Called by the Worker after it has authenticated the upgrade request. */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    const userId = request.headers.get("x-np-user") ?? "anon";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [`user:${userId}`]);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Clients are listeners only - anything that changes data goes through the authenticated REST API. */
  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message !== "ping") ws.send(JSON.stringify({ type: "error", message: "This socket is receive-only" }));
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  /** RPC: push one event to every socket on this topic. Returns how many sockets received it. */
  async broadcast(payload: string): Promise<number> {
    let sent = 0;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
        sent++;
      } catch {
        // socket went away mid-send; the runtime will fire webSocketClose
      }
    }
    return sent;
  }

  /** RPC: how many browsers are listening (shown on the dashboard as a live indicator). */
  async connections(): Promise<number> {
    return this.ctx.getWebSockets().length;
  }
}
