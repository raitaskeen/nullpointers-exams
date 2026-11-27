"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, ArrowsIn, ArrowsOut, CaretDown, CheckCircle, CloudCheck, CloudSlash, Flag, GearSix, Megaphone, NotePencil,
  SquaresFour, Timer, Warning, WarningCircle, X, ArrowsClockwise,
} from "@phosphor-icons/react";
import type { PaperQuestion } from "@np/shared";
import { LogoMark } from "@/components/brand/Logo";
import { ErrorState } from "@/components/feedback/States";
import { ChoiceTile, Segmented } from "@/components/form/FormField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api, apiErrorMessage } from "@/lib/api-client";
import { fmtMarks, fmtTime, type AttemptState } from "@/lib/exams";
import { useRealtimeTopics } from "@/lib/realtime";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { Scratchpad } from "./Scratchpad";
import { useSaveQueue, type SaveStatus } from "./useSaveQueue";

type Response = string[] | string | null;
interface Prefs {
  size: "sm" | "md" | "lg" | "xl";
  layout: "one" | "list";
  contrast: "normal" | "high";
}
const PREFS_KEY = "invigil-workspace";
const SIZE_PX = { sm: 15, md: 17, lg: 19, xl: 22 };
const LETTERS = "ABCDEFGH";

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>({ size: "md", layout: "one", contrast: "normal" });
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
      if (p) setPrefs((d) => ({ ...d, ...p }));
    } catch {
      // ignore
    }
  }, []);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  return [prefs, update] as const;
}

const answered = (r: Response | undefined) => (Array.isArray(r) ? r.length > 0 : typeof r === "string" ? r.trim().length > 0 : false);
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function sessionId() {
  let id = sessionStorage.getItem("invigil-session");
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem("invigil-session", id);
  }
  return id;
}

// ---- Small pieces -----------------------------------------------------------------------------------------------

function SaveChip({ status, pending, online }: { status: SaveStatus; pending: number; online: boolean }) {
  const s = !online || status === "offline" ? "offline" : status;
  const conf = {
    saved: { icon: CloudCheck, text: "All answers saved", cls: "bg-success-soft text-success" },
    saving: { icon: ArrowsClockwise, text: "Saving…", cls: "bg-brand-soft text-brand-ink" },
    offline: { icon: CloudSlash, text: pending ? `Offline · ${pending} saved on this device` : "Offline · answers will save on this device", cls: "bg-warning-soft text-warning" },
    error: { icon: WarningCircle, text: pending ? `Retrying · ${pending} waiting` : "Couldn't save one answer", cls: "bg-danger-soft text-danger" },
  }[s];
  return (
    <span role="status" aria-live="polite" title={conf.text} className={cn("flex shrink-0 items-center gap-1.5 rounded-full p-1.5 text-xs font-medium transition-colors duration-300 md:px-2.5 md:py-1", conf.cls)}>
      <conf.icon weight="bold" className={cn("size-3.5", s === "saving" && "animate-spin")} aria-hidden="true" />
      <span className="sr-only md:not-sr-only">{conf.text}</span>
    </span>
  );
}

function TimerChip({ ms }: { ms: number }) {
  const low = ms < 5 * 60_000;
  const critical = ms < 60_000;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-[0.9375rem] font-semibold tabular-nums transition-colors duration-500",
        critical ? "bg-danger text-white" : low ? "bg-warning-soft text-warning" : "bg-foreground text-background",
      )}
      aria-label={`Time remaining ${clock(ms)}`}
      role="timer"
    >
      <Timer weight="bold" className="size-4" aria-hidden="true" />
      {clock(ms)}
    </span>
  );
}

function Navigator({
  paper,
  answers,
  flags,
  current,
  onGo,
}: {
  paper: PaperQuestion[];
  answers: Record<number, Response>;
  flags: Record<number, boolean>;
  current: number;
  onGo: (i: number) => void;
}) {
  const done = paper.filter((q) => answered(answers[q.id])).length;
  const flagged = paper.filter((q) => flags[q.id]).length;
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {paper.map((q, i) => {
          const a = answered(answers[q.id]);
          const f = flags[q.id];
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onGo(i)}
              aria-current={i === current ? "step" : undefined}
              aria-label={`Question ${i + 1}: ${a ? "answered" : "not answered"}${f ? ", marked for review" : ""}`}
              className={cn(
                "relative grid aspect-square place-items-center rounded-xl text-sm font-semibold tabular-nums transition-all duration-200",
                a ? "bg-primary text-primary-foreground" : "bg-surface text-foreground-soft ring-1 ring-border hover:ring-border-strong",
                f && !a && "bg-warning-soft text-warning ring-warning/40",
                i === current && "ring-[2.5px] ring-foreground ring-offset-2 ring-offset-background",
              )}
            >
              {i + 1}
              {f && <Flag weight="fill" className="absolute -end-1 -top-1 size-3.5 text-warning drop-shadow-[0_1px_0_var(--background)]" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <dl className="mt-5 space-y-2 text-[0.8125rem]">
        <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-muted-foreground"><span className="size-3 rounded bg-primary" />Answered</dt><dd className="font-semibold tabular-nums">{done}</dd></div>
        <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-muted-foreground"><span className="size-3 rounded bg-surface ring-1 ring-border-strong" />Not answered</dt><dd className="font-semibold tabular-nums">{paper.length - done}</dd></div>
        <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-muted-foreground"><Flag weight="fill" className="size-3 text-warning" />For review</dt><dd className="font-semibold tabular-nums">{flagged}</dd></div>
      </dl>
    </div>
  );
}

function QuestionBlock({
  q,
  index,
  total,
  response,
  flagged,
  onAnswer,
  onFlag,
  disabled,
  highContrast,
}: {
  q: PaperQuestion;
  index: number;
  total: number;
  response: Response | undefined;
  flagged: boolean;
  onAnswer: (r: Response, immediate?: boolean) => void;
  onFlag: () => void;
  disabled: boolean;
  highContrast: boolean;
}) {
  const chosen = Array.isArray(response) ? response : [];
  const words = typeof response === "string" ? response.trim().split(/\s+/).filter(Boolean).length : 0;
  const hint = q.type === "single" ? "Choose one answer" : q.type === "multiple" ? (q.scheme === "partial" ? "Choose all that apply · partial credit: right minus wrong" : "Choose all that apply · full marks only for the exact set") : "Written answer · marked by your examiner";
  return (
    <article aria-labelledby={`q-${q.id}`} className={cn("rounded-[1.25rem] border bg-card p-5 shadow-xs sm:p-8", highContrast ? "border-foreground" : "border-border")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-[0.8125rem] text-muted-foreground">
          <span className="font-semibold text-foreground">Question {index + 1}</span> of {total} · {fmtMarks(q.marks)} mark{q.marks === 1 ? "" : "s"} · {q.topic}
        </div>
        <Button variant={flagged ? "secondary" : "ghost"} size="sm" onClick={onFlag} aria-pressed={flagged} disabled={disabled} className={flagged ? "bg-warning-soft text-warning hover:bg-warning-soft" : undefined}>
          <Flag weight={flagged ? "fill" : "regular"} /> {flagged ? "Marked for review" : "Mark for review"}
        </Button>
      </header>
      <h2 id={`q-${q.id}`} className="mt-4 text-[1.2em] leading-snug font-medium tracking-[-0.01em] text-pretty whitespace-pre-line">{q.prompt}</h2>
      <p className="mt-2 text-[0.8125rem] text-muted-foreground">{hint}</p>
      <div className="mt-6">
        {q.type === "written" ? (
          <div>
            <label htmlFor={`a-${q.id}`} className="sr-only">Your answer</label>
            <textarea
              id={`a-${q.id}`}
              value={typeof response === "string" ? response : ""}
              onChange={(e) => onAnswer(e.target.value)}
              onBlur={(e) => onAnswer(e.target.value, true)}
              disabled={disabled}
              rows={9}
              spellCheck
              placeholder="Type your answer here"
              className={cn("w-full rounded-xl border bg-surface p-4 leading-relaxed outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25", highContrast ? "border-foreground" : "border-control-border/70")}
            />
            <p className="mt-1.5 text-end text-xs text-muted-foreground tabular-nums">{words} word{words === 1 ? "" : "s"}</p>
          </div>
        ) : (
          <fieldset className="space-y-2.5" disabled={disabled}>
            <legend className="sr-only">{hint}</legend>
            {q.options.map((o, i) => {
              const on = chosen.includes(o.id);
              return (
                <ChoiceTile
                  key={o.id}
                  type={q.type === "single" ? "radio" : "checkbox"}
                  name={`q-${q.id}`}
                  checked={on}
                  disabled={disabled}
                  marker={LETTERS[i]}
                  className={highContrast ? "border-foreground/70" : undefined}
                  onChange={() => onAnswer(q.type === "single" ? [o.id] : on ? chosen.filter((c) => c !== o.id) : [...chosen, o.id], true)}
                >
                  {o.text}
                </ChoiceTile>
              );
            })}
            {chosen.length > 0 && (
              <button type="button" onClick={() => onAnswer([], true)} className="mt-1 text-[0.8125rem] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Clear my answer
              </button>
            )}
          </fieldset>
        )}
      </div>
    </article>
  );
}

// ---- Page -------------------------------------------------------------------------------------------------------

type Phase = "work" | "review" | "done";

export function ExamWorkspace() {
  const router = useRouter();
  const attemptId = Number(useSearchParams().get("attempt")) || 0;
  const { resolvedTheme, setTheme } = useTheme();
  const [prefs, setPrefs] = usePrefs();

  const state = useQuery({ queryKey: ["attempt", attemptId], queryFn: () => api<AttemptState>(`/attempts/${attemptId}`), enabled: attemptId > 0, refetchOnWindowFocus: false, staleTime: Infinity });
  const s = state.data;

  const [answers, setAnswers] = useState<Record<number, Response>>({});
  const [flags, setFlags] = useState<Record<number, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<Phase>("work");
  const [deadline, setDeadline] = useState<number>(0);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [notices, setNotices] = useState<AttemptState["announcements"]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [otherSession, setOtherSession] = useState(false);
  const [scratch, setScratch] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [final, setFinal] = useState<{ status: string; submittedAt: string | null; auto: boolean } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const autoSubmitted = useRef(false);
  const warned = useRef<Set<number>>(new Set());
  const writeTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const syncClock = useCallback((serverNow: string, deadlineAt?: string) => {
    setOffset(Date.parse(serverNow) - Date.now());
    if (deadlineAt) setDeadline(Date.parse(deadlineAt));
  }, []);

  const closed = useCallback(() => {
    setPhase("done");
    void state.refetch();
  }, [state]);

  const queue = useSaveQueue(attemptId, {
    enabled: !!s && s.attempt.status === "in_progress" && phase !== "done",
    onSynced: (r) => syncClock(r.serverNow, r.deadlineAt),
    onClosed: closed,
  });

  // Load state once: server answers, overlaid with anything still waiting in this device's queue.
  useEffect(() => {
    if (!s) return;
    const a: Record<number, Response> = {};
    const f: Record<number, boolean> = {};
    for (const x of s.answers) {
      a[x.questionId] = x.response;
      f[x.questionId] = x.flagged;
    }
    for (const q of s.paper) {
      const p = queue.pendingFor(q.id);
      if (p) {
        a[q.id] = p.response;
        if (p.flagged !== undefined) f[q.id] = p.flagged;
      }
    }
    setAnswers(a);
    setFlags(f);
    setNotices(s.announcements);
    syncClock(s.serverNow, s.attempt.deadlineAt);
    if (s.attempt.status !== "in_progress") {
      setPhase("done");
      setFinal({ status: s.attempt.status, submittedAt: s.attempt.submittedAt, auto: s.attempt.status === "expired" });
    }
    try {
      const saved = Number(sessionStorage.getItem(`invigil-pos-${attemptId}`));
      if (saved >= 0 && saved < s.paper.length) setCurrent(saved);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`invigil-pos-${attemptId}`, String(current));
    } catch {
      // ignore
    }
  }, [current, attemptId]);

  // Ticking clock: server time = device time + measured offset. The device clock never decides anything.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = deadline ? deadline - (now + offset) : 0;
  const live = !!s && s.attempt.status === "in_progress" && phase !== "done";

  const submit = useCallback(
    async (auto: boolean) => {
      if (submitting) return;
      setSubmitting(true);
      Object.values(writeTimers.current).forEach(clearTimeout);
      try {
        await queue.flush();
        const r = await api<{ status: string; submittedAt: string | null }>(`/attempts/${attemptId}/submit`, { method: "POST" });
        try {
          localStorage.removeItem(`invigil-queue-${attemptId}`);
        } catch {
          // ignore
        }
        setFinal({ ...r, auto: auto || r.status === "expired" });
        setPhase("done");
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      } catch (err) {
        toast.error(err instanceof TypeError ? "You're offline. Your answers are safe on this device; we'll submit when you reconnect." : apiErrorMessage(err));
      } finally {
        setSubmitting(false);
        setConfirmSubmit(false);
      }
    },
    [attemptId, queue, submitting],
  );

  // Warnings and auto-submit at the deadline.
  useEffect(() => {
    if (!live || !deadline) return;
    for (const mark of [5, 1]) {
      if (remaining <= mark * 60_000 && remaining > 0 && !warned.current.has(mark)) {
        warned.current.add(mark);
        toast.warning(`${mark} minute${mark > 1 ? "s" : ""} left. Your answers are saved.`);
      }
    }
    if (remaining <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit(true);
    }
  }, [remaining, live, deadline, submit]);

  // Heartbeat: keeps the examiner's view honest, re-syncs the clock, catches a second open session.
  useEffect(() => {
    if (!live) return;
    const sid = sessionId();
    const beat = async () => {
      try {
        const r = await api<{ serverNow: string; deadlineAt: string; status: string; otherSession: boolean; announcements: AttemptState["announcements"] }>(`/attempts/${attemptId}/heartbeat`, { method: "POST", json: { sessionId: sid } });
        syncClock(r.serverNow, r.deadlineAt);
        setOtherSession(r.otherSession);
        if (r.status !== "in_progress") closed();
        setNotices((n) => {
          const ids = new Set(n.map((x) => x.id));
          const fresh = r.announcements.filter((x) => !ids.has(x.id));
          return fresh.length ? [...fresh, ...n] : n;
        });
      } catch {
        // offline: the save chip already says so
      }
    };
    void beat();
    const id = setInterval(beat, 15_000);
    return () => clearInterval(id);
  }, [live, attemptId, syncClock, closed]);

  // Realtime: announcements, examiner closing the exam, time added to this attempt.
  useRealtimeTopics(s && live ? [`exam-${s.attempt.examId}-live`, `attempt-${attemptId}`] : [], (e) => {
    if (e.type === "announcement" && e.data) {
      const a = e.data as AttemptState["announcements"][number];
      setNotices((n) => (n.some((x) => x.id === a.id) ? n : [a, ...n]));
      toast.info("New announcement from your examiner");
    } else if (e.type === "deadline" && e.data) {
      setDeadline(Date.parse((e.data as { deadlineAt: string }).deadlineAt));
      warned.current.clear();
      toast.success("Your examiner added time to your attempt.");
    } else if (e.type === "closed") {
      toast.info("The examiner closed the exam. Your saved answers were submitted.");
      closed();
    }
  });

  // Integrity signals (recorded for the examiner, never treated as proof). Throttled per type.
  const lastSignal = useRef<Record<string, number>>({});
  const signal = useCallback(
    (type: string, detail?: string) => {
      if (!live || s?.attempt.isSandbox) return;
      const t = Date.now();
      if (t - (lastSignal.current[type] ?? 0) < 8000) return;
      lastSignal.current[type] = t;
      void api(`/attempts/${attemptId}/incidents`, { method: "POST", json: { type, detail } }).catch(() => {});
    },
    [live, attemptId, s?.attempt.isSandbox],
  );

  useEffect(() => {
    if (!live) return;
    let hiddenAt = 0;
    let offlineAt = 0;
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt) signal("tab_hidden", `Away for ${Math.round((Date.now() - hiddenAt) / 1000)}s`);
    };
    const blur = () => !document.hidden && signal("window_blur", "Window lost focus");
    const off = () => {
      offlineAt = Date.now();
      setOnline(false);
    };
    const on = () => {
      setOnline(true);
      if (offlineAt) signal("offline", `Connection lost for ${Math.round((Date.now() - offlineAt) / 1000)}s`);
      offlineAt = 0;
    };
    const clip = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[aria-label='Scratchpad']")) return;
      signal(e.type === "paste" ? "paste" : "copy", e.type);
      if (s?.exam.blockCopyPaste) {
        e.preventDefault();
        toast.message("Copy and paste are turned off for this exam.");
      }
    };
    const fs = () => {
      const on = !!document.fullscreenElement;
      setFullscreen(on);
      if (!on) signal("fullscreen_exit", "Left full screen");
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (queue.pending > 0) e.preventDefault();
    };
    setOnline(navigator.onLine);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("blur", blur);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    document.addEventListener("copy", clip);
    document.addEventListener("cut", clip);
    document.addEventListener("paste", clip);
    document.addEventListener("fullscreenchange", fs);
    window.addEventListener("beforeunload", leave);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("blur", blur);
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
      document.removeEventListener("copy", clip);
      document.removeEventListener("cut", clip);
      document.removeEventListener("paste", clip);
      document.removeEventListener("fullscreenchange", fs);
      window.removeEventListener("beforeunload", leave);
    };
  }, [live, signal, s?.exam.blockCopyPaste, queue.pending]);

  // Keyboard: ← → move between questions when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (phase !== "work" || prefs.layout !== "one" || el.closest("input,textarea,[contenteditable]")) return;
      if (e.key === "ArrowRight") setCurrent((c) => Math.min((s?.paper.length ?? 1) - 1, c + 1));
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, prefs.layout, s?.paper.length]);

  const answer = (q: PaperQuestion, r: Response, immediate = false) => {
    setAnswers((a) => ({ ...a, [q.id]: r }));
    clearTimeout(writeTimers.current[q.id]);
    const send = () => queue.enqueue({ questionId: q.id, response: r, flagged: flags[q.id] });
    if (q.type === "written" && !immediate) writeTimers.current[q.id] = setTimeout(send, 700);
    else send();
  };
  const flag = (q: PaperQuestion) => {
    const next = !flags[q.id];
    setFlags((f) => ({ ...f, [q.id]: next }));
    queue.enqueue({ questionId: q.id, response: answers[q.id] ?? null, flagged: next });
  };

  const goto = (i: number) => {
    setPhase("work");
    setNavOpen(false);
    if (prefs.layout === "one") setCurrent(i);
    else document.getElementById(`block-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: prefs.layout === "one" ? "smooth" : "auto" });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => toast.message("Full screen isn't available in this browser."));
  };

  const stats = useMemo(() => {
    const paper = s?.paper ?? [];
    return {
      answered: paper.filter((q) => answered(answers[q.id])).length,
      unanswered: paper.filter((q) => !answered(answers[q.id])),
      flagged: paper.filter((q) => flags[q.id]),
    };
  }, [s, answers, flags]);

  // ---- Render states ----
  if (!attemptId) return <Centered><ErrorState title="No attempt selected" description="Open an exam from your overview." /></Centered>;
  if (state.isLoading)
    return (
      <Centered>
        <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground" role="status">
          <span className="size-8 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-primary" />
          Loading your paper…
        </div>
      </Centered>
    );
  if (state.error || !s)
    return (
      <Centered>
        <ErrorState
          title={state.error instanceof ApiError && state.error.status === 404 ? "This attempt isn't available" : "Couldn't load the exam"}
          description={state.error instanceof ApiError && state.error.status === 404 ? "It may belong to another account." : "Check your connection. Your saved answers are safe."}
          onRetry={() => state.refetch()}
        />
      </Centered>
    );

  const exitHref = s.attempt.isSandbox ? `/app/exams/view?id=${s.attempt.examId}` : "/app";

  if (phase === "done") {
    return (
      <Centered>
        <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-8 text-center shadow-md animate-[rise_500ms_var(--ease-out)_backwards]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success-soft text-success"><CheckCircle weight="fill" className="size-8" /></span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{final?.auto ? "Time's up - your exam was submitted" : "Exam submitted"}</h1>
          <p className="mt-2 text-foreground-soft">
            {s.exam.title}
            {final?.submittedAt ? ` · ${fmtTime(final.submittedAt)}` : ""}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {s.attempt.isSandbox
              ? "This was a sandbox preview. It isn't part of results, analytics or reports."
              : final?.auto
                ? "Every answer the server accepted before the deadline is included. You'll see your result here once your examiner publishes it."
                : "Your answers are locked in. You'll see your result once your examiner publishes it."}
          </p>
          <div className="mt-7 grid gap-2">
            <Button render={<Link href={exitHref} />}>{s.attempt.isSandbox ? "Back to exam setup" : "Back to my exams"}</Button>
            {s.attempt.isSandbox && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await api(`/attempts/${attemptId}/sandbox`, { method: "DELETE" }).catch(() => {});
                  router.push(exitHref);
                }}
              >
                Discard this sandbox attempt
              </Button>
            )}
          </div>
        </div>
      </Centered>
    );
  }

  const q = s.paper[current]!;
  const visibleNotices = notices.filter((n) => !dismissed.includes(n.id));
  const hc = prefs.contrast === "high";

  return (
    <div className={cn("min-h-dvh bg-background", hc && "[--muted-foreground:var(--foreground)] [--border:var(--border-strong)]")} style={{ fontSize: SIZE_PX[prefs.size] }}>
      <header className="sticky top-0 z-30 border-b border-[var(--glass-border)] bg-[var(--glass-strong)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 text-sm sm:px-5">
          <LogoMark className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold tracking-[-0.01em]">{s.exam.title}</p>
            <p className="truncate text-xs text-muted-foreground">{s.attempt.isSandbox ? "Sandbox preview · not recorded" : `${stats.answered} of ${s.paper.length} answered`}</p>
          </div>
          <SaveChip status={queue.status} pending={queue.pending} online={online} />
          <TimerChip ms={remaining} />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Scratchpad" aria-pressed={scratch} onClick={() => setScratch((v) => !v)}><NotePencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Workspace settings" onClick={() => setPrefsOpen(true)}><GearSix /></Button>
            <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>{fullscreen ? <ArrowsIn /> : <ArrowsOut />}</Button>
          </div>
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => setPhase("review")} disabled={submitting}>Review & submit</Button>
        </div>
        {(!online || queue.status === "offline") && (
          <div className="border-t border-warning/20 bg-warning-soft px-4 py-2 text-center text-[0.8125rem] font-medium text-warning" role="alert">
            <CloudSlash weight="bold" className="me-1.5 inline size-4 align-[-3px]" />
            You're offline. Keep answering - {queue.pending || "your"} answer{queue.pending === 1 ? " is" : "s are"} saved on this device and will sync automatically. The timer keeps running.
          </div>
        )}
        {otherSession && (
          <div className="border-t border-danger/20 bg-danger-soft px-4 py-2 text-center text-[0.8125rem] font-medium text-danger" role="alert">
            <Warning weight="bold" className="me-1.5 inline size-4 align-[-3px]" />
            This exam is also open in another tab or device. Use only one; this has been noted for your examiner.
          </div>
        )}
      </header>

      {visibleNotices.length > 0 && (
        <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-5">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-brand-softer px-4 py-3 animate-[rise_360ms_var(--ease-out)_backwards]" role="status" aria-live="polite">
            <Megaphone weight="duotone" className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-[0.9375rem]">
              <p className="text-xs font-semibold text-brand-ink">Announcement · {fmtTime(visibleNotices[0]!.at)}</p>
              <p className="mt-0.5">{visibleNotices[0]!.message}</p>
            </div>
            <Button variant="ghost" size="icon-xs" aria-label="Dismiss announcement" onClick={() => setDismissed((d) => [...d, visibleNotices[0]!.id])}><X /></Button>
          </div>
        </div>
      )}

      {phase === "review" ? (
        <main className="mx-auto max-w-3xl px-3 py-8 sm:px-5 animate-[rise_360ms_var(--ease-out)_backwards]">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em]">Review before submitting</h1>
          <p className="mt-1.5 text-foreground-soft">You can still change any answer. Time keeps running.</p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Answered</p><p className="mt-1 text-2xl font-semibold tabular-nums">{stats.answered}</p></div>
            <div className={cn("rounded-2xl border p-4", stats.unanswered.length ? "border-danger/30 bg-danger-soft/50" : "border-border bg-card")}><p className="text-xs text-muted-foreground">Not answered</p><p className="mt-1 text-2xl font-semibold tabular-nums">{stats.unanswered.length}</p></div>
            <div className={cn("rounded-2xl border p-4", stats.flagged.length ? "border-warning/30 bg-warning-soft/50" : "border-border bg-card")}><p className="text-xs text-muted-foreground">For review</p><p className="mt-1 text-2xl font-semibold tabular-nums">{stats.flagged.length}</p></div>
          </div>
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {s.paper.map((pq, i) => {
              const a = answered(answers[pq.id]);
              return (
                <li key={pq.id}>
                  <button type="button" onClick={() => goto(i)} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold", a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{pq.prompt}</span>
                    {flags[pq.id] && <Flag weight="fill" className="size-4 shrink-0 text-warning" aria-label="Marked for review" />}
                    <span className={cn("shrink-0 text-xs font-medium", a ? "text-success" : "text-danger")}>{a ? "Answered" : "Not answered"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setPhase("work")}><ArrowLeft className="rtl:rotate-180" /> Back to questions</Button>
            <Button size="lg" onClick={() => setConfirmSubmit(true)} disabled={submitting}>Submit exam</Button>
          </div>
        </main>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-6 px-3 py-6 sm:px-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:py-8">
          <main className="min-w-0">
            {prefs.layout === "one" ? (
              <div key={q.id} className="animate-[rise_300ms_var(--ease-out)_backwards]">
                <QuestionBlock q={q} index={current} total={s.paper.length} response={answers[q.id]} flagged={!!flags[q.id]} onAnswer={(r, im) => answer(q, r, im)} onFlag={() => flag(q)} disabled={submitting} highContrast={hc} />
                <div className="mt-5 flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}><ArrowLeft className="rtl:rotate-180" /> Previous</Button>
                  <span className="text-[0.8125rem] text-muted-foreground tabular-nums">{current + 1} / {s.paper.length}</span>
                  {current < s.paper.length - 1 ? (
                    <Button onClick={() => setCurrent((c) => c + 1)}>Next <ArrowRight className="rtl:rotate-180" /></Button>
                  ) : (
                    <Button onClick={() => setPhase("review")}>Review answers <ArrowRight className="rtl:rotate-180" /></Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {s.paper.map((pq, i) => (
                  <div key={pq.id} id={`block-${i}`} className="scroll-mt-24">
                    <QuestionBlock q={pq} index={i} total={s.paper.length} response={answers[pq.id]} flagged={!!flags[pq.id]} onAnswer={(r, im) => answer(pq, r, im)} onFlag={() => flag(pq)} disabled={submitting} highContrast={hc} />
                  </div>
                ))}
                <div className="flex justify-end"><Button onClick={() => setPhase("review")}>Review answers <ArrowRight className="rtl:rotate-180" /></Button></div>
              </div>
            )}
            {s.exam.instructions && (
              <details className="group mt-8 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">Exam instructions <CaretDown className="size-4 transition-transform group-open:rotate-180" /></summary>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-foreground-soft">{s.exam.instructions}</p>
              </details>
            )}
          </main>
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[1.25rem] border border-border bg-card p-5 shadow-xs">
              <p className="mb-4 text-sm font-semibold">Questions</p>
              <Navigator paper={s.paper} answers={answers} flags={flags} current={prefs.layout === "one" ? current : -1} onGo={goto} />
              <Button className="mt-6 w-full" variant="outline" onClick={() => setPhase("review")}>Review & submit</Button>
            </div>
          </aside>
        </div>
      )}

      {/* Phone: navigator + submit in a bottom bar */}
      {phase === "work" && (
        <div className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-[var(--glass-border)] bg-[var(--glass-strong)] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-2xl lg:hidden">
          <Button variant="outline" className="flex-1" onClick={() => setNavOpen(true)}><SquaresFour /> {stats.answered}/{s.paper.length} answered</Button>
          <Button className="flex-1" onClick={() => setPhase("review")}>Review & submit</Button>
        </div>
      )}

      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Questions</DialogTitle></DialogHeader>
          <Navigator paper={s.paper} answers={answers} flags={flags} current={prefs.layout === "one" ? current : -1} onGo={goto} />
        </DialogContent>
      </Dialog>

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace settings</DialogTitle>
            <DialogDescription>Saved on this device for every exam.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div><p className="mb-2 text-sm font-medium">Text size</p><Segmented label="Text size" value={prefs.size} onChange={(v) => setPrefs({ size: v })} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Default" }, { value: "lg", label: "Large" }, { value: "xl", label: "Largest" }]} className="w-full" /></div>
            <div><p className="mb-2 text-sm font-medium">Layout</p><Segmented label="Layout" value={prefs.layout} onChange={(v) => setPrefs({ layout: v })} options={[{ value: "one", label: "One at a time" }, { value: "list", label: "All on one page" }]} className="w-full" /></div>
            <div><p className="mb-2 text-sm font-medium">Contrast</p><Segmented label="Contrast" value={prefs.contrast} onChange={(v) => setPrefs({ contrast: v })} options={[{ value: "normal", label: "Standard" }, { value: "high", label: "High contrast" }]} className="w-full" /></div>
            <div><p className="mb-2 text-sm font-medium">Appearance</p><Segmented label="Appearance" value={resolvedTheme === "dark" ? "dark" : "light"} onChange={(v) => setTheme(v)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} className="w-full" /></div>
          </div>
          <DialogFooter><Button onClick={() => setPrefsOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSubmit} onOpenChange={(o) => !submitting && setConfirmSubmit(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your exam?</DialogTitle>
            <DialogDescription>
              {stats.unanswered.length ? `${stats.unanswered.length} question${stats.unanswered.length > 1 ? "s are" : " is"} not answered. ` : "Every question has an answer. "}
              You can't change anything after submitting.
            </DialogDescription>
          </DialogHeader>
          {queue.pending > 0 && <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{queue.pending} answer{queue.pending > 1 ? "s are" : " is"} still syncing. They'll be sent first.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)} disabled={submitting}>Keep working</Button>
            <Button onClick={() => submit(false)} disabled={submitting}>{submitting ? "Submitting…" : "Submit now"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Scratchpad attemptId={attemptId} initial={s.attempt.scratchpad || (typeof window !== "undefined" ? (localStorage.getItem(`invigil-notes-${attemptId}`) ?? "") : "")} open={scratch} onClose={() => setScratch(false)} readOnly={!live} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center bg-background px-4">{children}</div>;
}
