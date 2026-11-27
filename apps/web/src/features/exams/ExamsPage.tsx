"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, CalendarBlank, Clock, Plus, Users } from "@phosphor-icons/react";
import type { ExamPhase } from "@np/shared";
import { Segmented } from "@/components/form/FormField";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Meter } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api, apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { PHASE_LABEL, PHASE_TONE, fmtMarks, fmtWindow, until, type ExamListRow, type ExamRow } from "@/lib/exams";
import { cn } from "@/lib/utils";
import { ExamForm, type ExamFormValues } from "./ExamForm";

type Filter = "all" | "live" | "upcoming" | "draft" | "past";
const matches = (f: Filter, p: ExamPhase) =>
  f === "all" || (f === "live" && p === "ongoing") || (f === "upcoming" && p === "upcoming") || (f === "draft" && p === "draft") || (f === "past" && (p === "ended" || p === "completed"));

export function PhaseBadge({ phase }: { phase: ExamPhase }) {
  return (
    <StatusBadge tone={PHASE_TONE[phase]} className={phase === "ongoing" ? "ps-1.5" : undefined}>
      {PHASE_LABEL[phase]}
    </StatusBadge>
  );
}

export function ExamsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const filter = (params.get("show") as Filter) || "all";
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (params.get("new")) {
      setCreating(true);
      router.replace(pathname, { scroll: false });
    }
  }, [params, pathname, router]);

  const exams = useQuery({ queryKey: ["exams"], queryFn: () => api<ExamListRow[]>("/exams"), refetchInterval: 30_000 });
  const rows = useMemo(() => (exams.data ?? []).filter((e) => matches(filter, e.phase)), [exams.data, filter]);
  const count = (f: Filter) => (exams.data ?? []).filter((e) => matches(f, e.phase)).length;

  const create = useMutation({
    mutationFn: (v: ExamFormValues) => api<ExamRow>("/exams", { method: "POST", json: v }),
    onSuccess: (exam) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Draft created. Add questions next.");
      router.push(`/app/exams/view?id=${exam.id}&tab=questions`);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description={hasRole("admin") ? "Every exam on the platform, from every examiner." : "Draft, schedule, run and grade your exams."}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus weight="bold" /> New exam
          </Button>
        }
      />

      <Segmented<Filter>
        label="Show"
        size="sm"
        value={filter}
        onChange={(v) => router.replace(v === "all" ? pathname : `${pathname}?show=${v}`, { scroll: false })}
        options={[
          { value: "all", label: <>All <span className="text-muted-foreground tabular-nums">{count("all")}</span></> },
          { value: "live", label: <>Live <span className="text-muted-foreground tabular-nums">{count("live")}</span></> },
          { value: "upcoming", label: <>Scheduled <span className="text-muted-foreground tabular-nums">{count("upcoming")}</span></> },
          { value: "draft", label: <>Drafts <span className="text-muted-foreground tabular-nums">{count("draft")}</span></> },
          { value: "past", label: <>Past <span className="text-muted-foreground tabular-nums">{count("past")}</span></> },
        ]}
        className="w-full overflow-x-auto sm:w-auto"
      />

      {exams.isLoading ? (
        <LoadingRows rows={5} />
      ) : exams.error ? (
        <ErrorState onRetry={() => exams.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          title={filter === "all" ? "No exams yet" : "Nothing here"}
          description={filter === "all" ? "Create a draft, add questions from your bank, enrol candidates and publish when the checklist is green." : "No exams in this group right now."}
          action={filter === "all" ? <Button onClick={() => setCreating(true)}><Plus weight="bold" /> New exam</Button> : undefined}
        />
      ) : (
        <ul className="grid gap-3">
          {rows.map((e, i) => (
            <li key={e.id} className="animate-[rise_360ms_var(--ease-out)_backwards]" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <Link
                href={`/app/exams/view?id=${e.id}${e.phase === "ongoing" ? "&tab=monitor" : ""}`}
                className="group grid gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="truncate text-base font-semibold tracking-[-0.015em]">{e.title}</h2>
                    <PhaseBadge phase={e.phase} />
                    {e.resultsPublished && <StatusBadge tone="success">Results published</StatusBadge>}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><CalendarBlank className="size-3.5" aria-hidden="true" />{fmtWindow(e.startsAt, e.endsAt)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden="true" />{e.durationMinutes} min · {fmtMarks(e.totalMarks)} marks</span>
                    <span className="flex items-center gap-1.5"><Users className="size-3.5" aria-hidden="true" />{e.counts.enrolled} enrolled</span>
                    {hasRole("admin") && e.ownerName && <span>by {e.ownerName}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  {e.phase === "draft" ? (
                    <span className="text-[0.8125rem] text-muted-foreground">{e.counts.questions} question{e.counts.questions === 1 ? "" : "s"} in pool</span>
                  ) : e.phase === "upcoming" ? (
                    <span className="text-[0.8125rem] font-medium text-brand-ink">Opens {until(e.startsAt)}</span>
                  ) : (
                    <div className="w-44">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{e.counts.submitted} of {e.counts.enrolled} submitted</span>
                        {e.counts.active > 0 && <span className="font-medium text-success">{e.counts.active} live</span>}
                      </div>
                      <Meter className="mt-1.5" value={e.counts.submitted} max={Math.max(1, e.counts.enrolled)} tone={e.counts.pendingGrading ? "warning" : "brand"} label="Submitted" />
                      {e.counts.pendingGrading > 0 && <p className="mt-1.5 text-xs font-medium text-warning">{e.counts.pendingGrading} to grade</p>}
                    </div>
                  )}
                  <ArrowRight className={cn("size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground rtl:rotate-180")} aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={creating}
        onOpenChange={setCreating}
        className="sm:w-[min(40rem,100%)]"
        title="New exam"
        description="It starts as a draft. Nothing is visible to candidates until you publish."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" form="new-exam" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create draft"}</Button>
          </>
        }
      >
        <ExamForm
          id="new-exam"
          onSubmit={(v, setErrors) =>
            create.mutateAsync(v).then(
              () => setCreating(false),
              (err) => {
                if (!setErrors(err)) toast.error(apiErrorMessage(err));
              },
            )
          }
        />
      </Sheet>
    </div>
  );
}
