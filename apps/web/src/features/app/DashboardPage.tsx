"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight, Broadcast, CalendarBlank, CheckCircle, ClipboardText, Clock, Hourglass, Plus, Scales, SealCheck, Warning,
} from "@phosphor-icons/react";
import type { Page } from "@np/shared";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { Meter, Panel, Stat } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  PHASE_LABEL, PHASE_TONE, type Analytics, fmtDateTime, fmtMarks, fmtTime, fmtWindow, pct, until, type Dispute, type ExamListRow, type MyExam,
} from "@/lib/exams";
import { cn } from "@/lib/utils";

function Greeting({ subtitle, action }: { subtitle: string; action?: React.ReactNode }) {
  const { user } = useAuth();
  const [today, setToday] = useState("");
  useEffect(() => setToday(new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())), []);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{today}{user ? ` · ${user.fullName}` : ""}</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] sm:text-3xl">Overview</h1>
        <p className="mt-1.5 text-foreground-soft">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

/** Re-render every `ms` so countdowns and "live" labels stay honest without refetching. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ---- Examiner / admin --------------------------------------------------------------------------------------------

function ExaminerDashboard() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const exams = useQuery({ queryKey: ["exams"], queryFn: () => api<ExamListRow[]>("/exams"), refetchInterval: 20_000 });
  const disputes = useQuery({ queryKey: ["disputes"], queryFn: () => api<Dispute[]>("/exams/disputes") });
  const people = useQuery({
    queryKey: ["users", "counts"],
    enabled: isAdmin,
    queryFn: async () => {
      const [c, e] = await Promise.all([
        api<Page<unknown>>("/users?role=candidate&pageSize=1"),
        api<Page<unknown>>("/users?role=examiner&pageSize=1"),
      ]);
      return { candidates: c.total, examiners: e.total };
    },
  });

  const list = exams.data ?? [];
  const live = list.filter((e) => e.phase === "ongoing");
  const upcoming = list.filter((e) => e.phase === "upcoming").sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const drafts = list.filter((e) => e.phase === "draft");
  const toGrade = list.filter((e) => e.counts.pendingGrading > 0);
  const readyToPublish = list.filter((e) => !e.resultsPublished && e.counts.submitted > 0 && e.counts.pendingGrading === 0 && e.counts.active === 0 && (e.phase === "ended" || e.phase === "completed"));
  const openDisputes = (disputes.data ?? []).filter((d) => d.status === "open");
  const pending = toGrade.reduce((s, e) => s + e.counts.pendingGrading, 0);
  const activeNow = live.reduce((s, e) => s + e.counts.active, 0);

  return (
    <div className="space-y-8">
      <Greeting
        subtitle={live.length ? `${live.length} exam${live.length > 1 ? "s are" : " is"} running right now with ${activeNow} candidate${activeNow === 1 ? "" : "s"} writing.` : "Nothing is running right now. Here is what needs you next."}
        action={
          <Button render={<Link href="/app/exams?new=1" />}>
            <Plus weight="bold" /> New exam
          </Button>
        }
      />

      <section aria-label="At a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Live now" value={live.length} hint={`${activeNow} writing`} tone={live.length ? "success" : "default"} href={live[0] ? `/app/exams/view?id=${live[0].id}&tab=monitor` : undefined} />
        <Stat label="Scheduled" value={upcoming.length} hint={upcoming[0] ? `Next ${until(upcoming[0].startsAt)}` : "None scheduled"} />
        <Stat label="Answers to grade" value={pending} hint={`${toGrade.length} exam${toGrade.length === 1 ? "" : "s"}`} tone={pending ? "warning" : "default"} href={toGrade[0] ? `/app/exams/view?id=${toGrade[0].id}&tab=grading` : undefined} />
        <Stat label="Open disputes" value={openDisputes.length} hint="Raised on published results" tone={openDisputes.length ? "warning" : "default"} href="/app/disputes" />
      </section>

      {exams.isLoading ? (
        <LoadingRows rows={4} />
      ) : exams.error ? (
        <ErrorState onRetry={() => exams.refetch()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Panel
              title={<span className="flex items-center gap-2"><Broadcast weight="duotone" className="size-4 text-success" aria-hidden="true" /> Live now</span>}
              action={<Link href="/app/exams" className="text-sm font-medium text-primary hover:underline">All exams</Link>}
              bodyClassName="p-0"
            >
              {live.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No exam window is open at the moment.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {live.map((e) => (
                    <li key={e.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <Link href={`/app/exams/view?id=${e.id}&tab=monitor`} className="font-medium hover:underline">{e.title}</Link>
                        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Closes {fmtTime(e.endsAt)} · {e.durationMinutes} min per attempt</p>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                          <span><b className="block text-base font-semibold text-foreground tabular-nums">{e.counts.active}</b>writing</span>
                          <span><b className="block text-base font-semibold text-foreground tabular-nums">{e.counts.submitted}</b>submitted</span>
                          <span><b className="block text-base font-semibold text-foreground tabular-nums">{Math.max(0, e.counts.enrolled - e.counts.active - e.counts.submitted)}</b>not started</span>
                        </div>
                        <Meter className="mt-3" value={e.counts.active + e.counts.submitted} max={Math.max(1, e.counts.enrolled)} tone="success" label="Started" />
                      </div>
                      <Button variant="outline" size="sm" render={<Link href={`/app/exams/view?id=${e.id}&tab=monitor`} />}>
                        Monitor <ArrowRight className="rtl:rotate-180" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Coming up" bodyClassName="p-0">
              {upcoming.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No exams are scheduled. Publish a draft to schedule it.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <Link href={`/app/exams/view?id=${e.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                          <CalendarBlank weight="duotone" className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{e.title}</span>
                          <span className="block text-[0.8125rem] text-muted-foreground">{fmtWindow(e.startsAt, e.endsAt)} · {e.counts.enrolled} enrolled</span>
                        </span>
                        <span className="text-xs font-medium text-brand-ink tabular-nums">{until(e.startsAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Needs your attention" bodyClassName="p-0">
              {!toGrade.length && !readyToPublish.length && !openDisputes.length && !drafts.length ? (
                <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="size-4 text-success" aria-hidden="true" /> All caught up.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {toGrade.map((e) => (
                    <Todo key={`g${e.id}`} href={`/app/exams/view?id=${e.id}&tab=grading`} icon={<Hourglass weight="duotone" />} tone="warning" title={`${e.counts.pendingGrading} written answer${e.counts.pendingGrading === 1 ? "" : "s"} to grade`} meta={e.title} />
                  ))}
                  {readyToPublish.map((e) => (
                    <Todo key={`p${e.id}`} href={`/app/exams/view?id=${e.id}&tab=results`} icon={<SealCheck weight="duotone" />} tone="brand" title="Results ready to publish" meta={e.title} />
                  ))}
                  {openDisputes.slice(0, 3).map((d) => (
                    <Todo key={`d${d.id}`} href="/app/disputes" icon={<Scales weight="duotone" />} tone="warning" title={`Dispute from ${d.candidate}`} meta={`${d.exam}${d.question ? ` · Q${d.question.number}` : ""}`} />
                  ))}
                  {drafts.slice(0, 3).map((e) => (
                    <Todo key={`r${e.id}`} href={`/app/exams/view?id=${e.id}`} icon={<ClipboardText weight="duotone" />} tone="muted" title="Draft, not published" meta={e.title} />
                  ))}
                </ul>
              )}
            </Panel>

            <RecentResults exams={list} />

            {isAdmin && (
              <Panel title="Platform" action={<Link href="/app/users" className="text-sm font-medium text-primary hover:underline">People</Link>}>
                <dl className="grid grid-cols-3 gap-4 text-center">
                  <div><dt className="text-xs text-muted-foreground">Candidates</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{people.data?.candidates ?? "–"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Examiners</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{people.data?.examiners ?? "–"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Exams</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{list.length}</dd></div>
                </dl>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Average and pass rate of finished exams, from the same analytics the Results tab uses. */
function RecentResults({ exams }: { exams: ExamListRow[] }) {
  const finished = exams.filter((e) => e.counts.submitted > 0 && (e.phase === "ended" || e.phase === "completed" || e.resultsPublished)).slice(0, 5);
  const stats = useQueries({ queries: finished.map((e) => ({ queryKey: ["exam", e.id, "analytics"], queryFn: () => api<Analytics>(`/exams/${e.id}/analytics`), staleTime: 60_000 })) });
  if (!finished.length) return null;
  return (
    <Panel title="Recent results" description="Average score, with the pass rate underneath.">
      <ul className="space-y-5">
        {finished.map((e, i) => {
          const s = stats[i]?.data?.summary;
          return (
            <li key={e.id}>
              <Link href={`/app/exams/view?id=${e.id}&tab=results`} className="group block">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium group-hover:underline">{e.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{s ? `${s.meanPercent}%` : "–"}</span>
                </div>
                <Meter className="mt-2 h-2" value={s?.meanPercent ?? 0} label={`${e.title} average`} />
                <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{s ? `${s.passRate}% passed · ${s.submitted} submitted${e.resultsPublished ? " · published" : ""}` : "Loading…"}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Todo({ href, icon, title, meta, tone }: { href: string; icon: React.ReactNode; title: string; meta: string; tone: "warning" | "brand" | "muted" }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[1.125rem]",
            tone === "warning" && "bg-warning-soft text-warning",
            tone === "brand" && "bg-brand-soft text-brand-ink",
            tone === "muted" && "bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block truncate text-[0.8125rem] text-muted-foreground">{meta}</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </li>
  );
}

// ---- Candidate ---------------------------------------------------------------------------------------------------

export function useStartExam() {
  const router = useRouter();
  return useMutation({
    mutationFn: (examId: number) => api<{ attemptId: number; resumed: boolean }>(`/me/exams/${examId}/start`, { method: "POST" }),
    onSuccess: (r) => router.push(`/exam?attempt=${r.attemptId}`),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

function CandidateDashboard() {
  const now = useNow(15_000);
  const params = useSearchParams();
  const exams = useQuery({ queryKey: ["me", "exams"], queryFn: () => api<MyExam[]>("/me/exams"), refetchInterval: 30_000 });
  const [confirm, setConfirm] = useState<MyExam | null>(null);
  const start = useStartExam();

  const focus = Number(params.get("exam")) || null;
  const list = exams.data ?? [];
  const isOpen = (e: MyExam) => Date.parse(e.startsAt) <= now && now <= Date.parse(e.endsAt) && e.phase !== "completed" && e.phase !== "draft";
  const available = list.filter((e) => isOpen(e) && (!e.attempt || e.attempt.status === "in_progress"));
  const upcoming = list.filter((e) => Date.parse(e.startsAt) > now && !e.attempt);
  const done = list.filter((e) => e.attempt && e.attempt.status !== "in_progress");
  const missed = list.filter((e) => !e.attempt && Date.parse(e.endsAt) < now);

  return (
    <div className="space-y-8">
      <Greeting subtitle={available.length ? `You have ${available.length} exam${available.length > 1 ? "s" : ""} open right now.` : upcoming.length ? `Your next exam opens ${until(upcoming[0]!.startsAt, now)}.` : "No exams are open for you right now."} />

      {exams.isLoading ? (
        <LoadingRows rows={3} />
      ) : exams.error ? (
        <ErrorState onRetry={() => exams.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="No exams assigned yet" description="When an examiner enrols you in an exam it appears here, with its schedule and instructions." />
      ) : (
        <>
          <section aria-labelledby="available-h" className="space-y-3">
            <h2 id="available-h" className="text-sm font-semibold">Available now</h2>
            {available.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-dashed border-border-strong px-5 py-6 text-sm text-muted-foreground">Nothing is open. Upcoming exams unlock automatically when their window starts.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {available.map((e) => {
                  const resuming = e.attempt?.status === "in_progress";
                  const deadline = resuming ? Date.parse(e.attempt!.deadlineAt) : Math.min(now + e.durationMinutes * 60_000, Date.parse(e.endsAt));
                  const shortened = !resuming && deadline < now + e.durationMinutes * 60_000;
                  return (
                    <article key={e.id} className={cn("flex flex-col rounded-[var(--radius-card)] border bg-card p-5 shadow-sm", focus === e.id ? "border-primary ring-2 ring-primary/20" : "border-border")}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg leading-snug font-semibold tracking-[-0.015em]">{e.title}</h3>
                        <StatusBadge tone={resuming ? "warning" : "success"}>{resuming ? "In progress" : "Open"}</StatusBadge>
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div><dt className="text-xs text-muted-foreground">Duration</dt><dd className="mt-0.5 font-medium tabular-nums">{e.durationMinutes} min</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Marks</dt><dd className="mt-0.5 font-medium tabular-nums">{fmtMarks(e.totalMarks)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">{resuming ? "Ends at" : "Closes"}</dt><dd className="mt-0.5 font-medium tabular-nums">{fmtTime(resuming ? e.attempt!.deadlineAt : e.endsAt)}</dd></div>
                      </dl>
                      {shortened && (
                        <p className="mt-4 flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[0.8125rem] text-warning">
                          <Warning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          The window closes at {fmtTime(e.endsAt)}, so you would have {Math.max(1, Math.round((deadline - now) / 60000))} minutes instead of {e.durationMinutes}.
                        </p>
                      )}
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                        <span className="text-[0.8125rem] text-muted-foreground">{resuming ? "Your answers are saved. Pick up where you left off." : "The timer starts when you begin."}</span>
                        <Button onClick={() => (resuming ? start.mutate(e.id) : setConfirm(e))} disabled={start.isPending}>
                          {resuming ? "Resume" : "Start exam"} <ArrowRight className="rtl:rotate-180" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Upcoming" bodyClassName="p-0">
              {upcoming.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((e) => (
                    <li key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                        <Clock weight="duotone" className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="block text-[0.8125rem] text-muted-foreground">{fmtWindow(e.startsAt, e.endsAt)} · {e.durationMinutes} min</span>
                      </span>
                      <span className="text-xs font-medium text-brand-ink tabular-nums">Opens {until(e.startsAt, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Completed" action={<Link href="/app/results" className="text-sm font-medium text-primary hover:underline">All results</Link>} bodyClassName="p-0">
              {done.length + missed.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Exams you finish appear here.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {done.map((e) => (
                    <li key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="block text-[0.8125rem] text-muted-foreground">Submitted {fmtDateTime(e.attempt!.submittedAt)}{e.attempt!.status === "expired" ? " (time ran out)" : ""}</span>
                      </span>
                      {e.resultsPublished && e.attempt!.score != null ? (
                        <Link href={`/app/results/view?attempt=${e.attempt!.id}`} className="text-end">
                          <span className="block text-sm font-semibold tabular-nums">{pct(e.attempt!.score, e.attempt!.maxScore)}%</span>
                          <span className="text-xs text-primary hover:underline">View result</span>
                        </Link>
                      ) : (
                        <StatusBadge tone="neutral">Awaiting results</StatusBadge>
                      )}
                    </li>
                  ))}
                  {missed.map((e) => (
                    <li key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="block text-[0.8125rem] text-muted-foreground">Closed {fmtDateTime(e.endsAt)}</span>
                      </span>
                      <StatusBadge tone="neutral">Not attempted</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>Start {confirm.title}?</DialogTitle>
                <DialogDescription>
                  You have {confirm.durationMinutes} minutes once you start{Date.parse(confirm.endsAt) < now + confirm.durationMinutes * 60_000 ? `, but the exam closes at ${fmtTime(confirm.endsAt)}` : ""}. The clock runs on the server, so closing the tab does not pause it.
                </DialogDescription>
              </DialogHeader>
              {confirm.instructions && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-sunken p-4 text-sm leading-relaxed whitespace-pre-line text-foreground-soft">{confirm.instructions}</div>
              )}
              <ul className="space-y-1.5 text-[0.8125rem] text-muted-foreground">
                <li>Answers save automatically, and wait on your device if the connection drops.</li>
                <li>Switching tabs or leaving full screen is noted for the examiner, not treated as cheating.</li>
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirm(null)}>Not yet</Button>
                <Button onClick={() => start.mutate(confirm.id)} disabled={start.isPending}>
                  {start.isPending ? "Starting…" : "Start now"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DashboardPage() {
  const { can } = useAuth();
  return can("exams:manage") ? <ExaminerDashboard /> : <CandidateDashboard />;
}

export { PHASE_LABEL, PHASE_TONE };
