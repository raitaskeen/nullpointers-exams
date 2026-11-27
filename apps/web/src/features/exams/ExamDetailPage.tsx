"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarBlank, CaretLeft, Clock, Exam as ExamIcon } from "@phosphor-icons/react";
import { ErrorState, LoadingRows } from "@/components/feedback/States";
import { CountBadge, TabBar } from "@/components/layout/Panel";
import { ApiError, api } from "@/lib/api-client";
import { fmtMarks, fmtWindow, type ExamDetail } from "@/lib/exams";
import { PhaseBadge } from "./ExamsPage";
import { CandidatesTab } from "./tabs/CandidatesTab";
import { GradingTab } from "./tabs/GradingTab";
import { MonitorTab } from "./tabs/MonitorTab";
import { QuestionsTab } from "./tabs/QuestionsTab";
import { ResultsTab } from "./tabs/ResultsTab";
import { SetupTab } from "./tabs/SetupTab";

export type Tab = "setup" | "questions" | "candidates" | "monitor" | "grading" | "results";

export function useExam(id: number) {
  return useQuery({ queryKey: ["exam", id], queryFn: () => api<ExamDetail>(`/exams/${id}`), enabled: id > 0 });
}

/** One exam, every stage of its life in tabs. The tab lives in the URL, so refresh and Back keep your place. */
export function ExamDetailPage() {
  const params = useSearchParams();
  const id = Number(params.get("id")) || 0;
  const exam = useExam(id);
  const e = exam.data;
  const draft = e?.status === "draft";
  const tab = (params.get("tab") as Tab) || "setup";

  if (exam.isLoading) return <LoadingRows rows={6} />;
  if (exam.error || !e)
    return exam.error instanceof ApiError && exam.error.status === 404 ? (
      <ErrorState title="Exam not found" description="It may have been deleted, or it belongs to another examiner." />
    ) : (
      <ErrorState onRetry={() => exam.refetch()} />
    );

  const href = (t: Tab) => `/app/exams/view?id=${id}&tab=${t}`;
  const tabs: { id: Tab; label: string; badge?: React.ReactNode; hidden?: boolean }[] = [
    { id: "setup", label: "Setup", badge: draft && e.problems.length ? <CountBadge n={e.problems.length} tone="warning" /> : undefined },
    { id: "questions", label: "Questions", badge: <CountBadge n={e.pool.length} /> },
    { id: "candidates", label: "Candidates" },
    { id: "monitor", label: "Monitor", hidden: draft },
    { id: "grading", label: "Grading", hidden: draft },
    { id: "results", label: "Results & analytics", hidden: draft },
  ];
  const active = tabs.find((t) => t.id === tab && !t.hidden)?.id ?? "setup";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/exams" className="inline-flex min-h-10 items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground pointer-fine:min-h-8">
          <CaretLeft className="size-4 rtl:rotate-180" aria-hidden="true" /> Exams
        </Link>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-ink shadow-[var(--glass-edge)] sm:grid">
              <ExamIcon weight="duotone" className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-[1.75rem]">{e.title}</h1>
                <PhaseBadge phase={e.phase} />
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarBlank className="size-3.5" aria-hidden="true" />{fmtWindow(e.startsAt, e.endsAt)}</span>
                <span className="flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden="true" />{e.durationMinutes} min · {fmtMarks(e.totalMarks)} marks · pass {e.passPercent}%</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <TabBar active={active} tabs={tabs.filter((t) => !t.hidden).map((t) => ({ id: t.id, label: t.label, href: href(t.id), badge: t.badge }))} />

      <div key={active} className="animate-[rise_360ms_var(--ease-out)_backwards]">
        {active === "setup" && <SetupTab exam={e} />}
        {active === "questions" && <QuestionsTab exam={e} />}
        {active === "candidates" && <CandidatesTab exam={e} />}
        {active === "monitor" && <MonitorTab exam={e} />}
        {active === "grading" && <GradingTab exam={e} />}
        {active === "results" && <ResultsTab exam={e} />}
      </div>
    </div>
  );
}
