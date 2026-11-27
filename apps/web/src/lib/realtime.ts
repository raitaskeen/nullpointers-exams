"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeEvent, RealtimeTicket } from "@np/shared";
import { api } from "./api-client";

/**
 * One socket per topic. Gets a 60s ticket through the same-origin API (cookie auth), then connects
 * straight to the Worker (Vercel can't proxy WebSockets). Reconnects with jittered backoff, pings every 25s.
 * Returns a cleanup function.
 */
function connectTopic(topic: string, onEvent: (e: RealtimeEvent) => void, onState: (open: boolean) => void) {
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const scheduleReconnect = () => {
    if (stopped) return;
    const delay = Math.min(30_000, 1_000 * 2 ** attempt++) + Math.random() * 500;
    retry = setTimeout(connect, delay);
  };

  async function connect() {
    try {
      const { url } = await api<RealtimeTicket>(`/realtime/ticket?topic=${encodeURIComponent(topic)}`);
      if (stopped) return;
      ws = new WebSocket(url);
      ws.onopen = () => {
        attempt = 0;
        onState(true);
        heartbeat = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send("ping"), 25_000);
      };
      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        try {
          onEvent(JSON.parse(String(e.data)) as RealtimeEvent);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        onState(false);
        clearInterval(heartbeat);
        scheduleReconnect();
      };
    } catch {
      scheduleReconnect();
    }
  }

  void connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(heartbeat);
    ws?.close();
  };
}

/** Subscribe to one or more topics. `connected` is true once every socket is open. */
export function useRealtimeTopics(topics: string[], onEvent: (event: RealtimeEvent) => void) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const key = topics.join("|");

  useEffect(() => {
    if (!key) return;
    const list = key.split("|");
    const stops = list.map((t) =>
      connectTopic(t, (e) => handler.current(e), (o) => setOpen((s) => ({ ...s, [t]: o }))),
    );
    return () => stops.forEach((s) => s());
  }, [key]);

  return { connected: topics.length > 0 && topics.every((t) => open[t]) };
}

export function useRealtime(topic: string | null, onEvent: (event: RealtimeEvent) => void) {
  return useRealtimeTopics(topic ? [topic] : [], onEvent);
}

/** Keep a resource's queries fresh: any create/update/delete by anyone refetches its lists and rows. */
export function useLiveResource(name: string, enabled = true) {
  const queryClient = useQueryClient();
  return useRealtime(enabled ? name : null, () => {
    queryClient.invalidateQueries({ queryKey: ["resource", name] });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
  });
}
