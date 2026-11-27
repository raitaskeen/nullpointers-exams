"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api-client";

export type SaveStatus = "saved" | "saving" | "offline" | "error";
export interface PendingAnswer {
  questionId: number;
  response: string[] | string | null;
  flagged?: boolean;
}
interface SaveResult {
  savedAt: string;
  deadlineAt: string;
  serverNow: string;
}

/**
 * Failure-resilient answer saving (innovation 5.3):
 * - every change goes into a per-attempt queue persisted in localStorage before any network call,
 * - the queue keeps only the latest change per question, and replays in order,
 * - a network failure keeps the item and retries with backoff; going back online flushes at once,
 * - the server decides whether a save is still inside the deadline (409 = the attempt is closed).
 * So a refresh, a dropped connection or a crashed tab never loses an answer the candidate gave.
 */
export function useSaveQueue(attemptId: number, opts: { onSynced: (r: SaveResult) => void; onClosed: () => void; enabled: boolean }) {
  const key = `invigil-queue-${attemptId}`;
  const queue = useRef<Map<number, PendingAnswer>>(new Map());
  const flushing = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const backoff = useRef(1000);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [pending, setPending] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const cb = useRef(opts);
  cb.current = opts;

  const persist = useCallback(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...queue.current.values()]));
    } catch {
      // storage full or blocked: the in-memory queue still works for this tab
    }
    setPending(queue.current.size);
  }, [key]);

  const flush = useCallback(async () => {
    if (flushing.current || !cb.current.enabled) return;
    if (!queue.current.size) {
      setStatus("saved");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    flushing.current = true;
    setStatus("saving");
    try {
      while (queue.current.size) {
        const [qid, item] = queue.current.entries().next().value as [number, PendingAnswer];
        try {
          const r = await api<SaveResult>(`/attempts/${attemptId}/answer`, { method: "PUT", json: item });
          // Only drop it if nothing newer arrived for the same question while the request was in flight.
          if (queue.current.get(qid) === item) queue.current.delete(qid);
          persist();
          setLastSavedAt(r.savedAt);
          backoff.current = 1000;
          cb.current.onSynced(r);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            queue.current.clear();
            persist();
            cb.current.onClosed();
            return;
          }
          if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) {
            // The server rejected this answer (e.g. not part of the paper): drop it, keep going.
            queue.current.delete(qid);
            persist();
            setStatus("error");
            continue;
          }
          // Network error, 5xx or rate limit: keep everything, try again shortly.
          setStatus(navigator.onLine ? "error" : "offline");
          clearTimeout(retry.current);
          retry.current = setTimeout(() => void flush(), backoff.current);
          backoff.current = Math.min(15_000, backoff.current * 2);
          return;
        }
      }
      setStatus("saved");
    } finally {
      flushing.current = false;
    }
  }, [attemptId, persist]);

  const enqueue = useCallback(
    (item: PendingAnswer) => {
      const prev = queue.current.get(item.questionId);
      queue.current.delete(item.questionId); // re-insert at the end: order of last change
      queue.current.set(item.questionId, { ...item, flagged: item.flagged ?? prev?.flagged });
      persist();
      void flush();
    },
    [flush, persist],
  );

  // Restore anything left from a previous tab/session (e.g. the browser crashed while offline).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]") as PendingAnswer[];
      for (const s of saved) queue.current.set(s.questionId, s);
    } catch {
      // ignore corrupt storage
    }
    setPending(queue.current.size);
  }, [key]);

  useEffect(() => {
    if (opts.enabled) void flush();
  }, [opts.enabled, flush]);

  useEffect(() => {
    const on = () => {
      backoff.current = 1000;
      void flush();
    };
    const off = () => setStatus("offline");
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearTimeout(retry.current);
    };
  }, [flush]);

  /** Answers still waiting to reach the server, so the UI can show them as the candidate's latest. */
  const pendingFor = useCallback((qid: number) => queue.current.get(qid), []);

  return { status, pending, lastSavedAt, enqueue, flush, pendingFor };
}
