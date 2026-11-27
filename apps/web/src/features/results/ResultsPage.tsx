"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, SealCheck } from "@phosphor-icons/react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { api } from "@/lib/api-client";
import { fmtDateTime, fmtMarks, type Dispute, type MyResult } from "@/lib/exams";
import { ScoreRing } from "./ScoreRing";

export function ResultsPage() {
  const results = useQuery({ queryKey: ["me", "results"], queryFn: () => api<MyResult[]>("/me/results") });
  const disputes = useQuery({ queryKey: ["me", "disputes"], queryFn: () => api<Dispute[]>("/me/disputes") });

  return (
    <div className="space-y-8">
      <PageHeader title="My results" description="Only results your examiners have published appear here. Each one comes with a report anyone can verify." />
      {results.isLoading ? (
        <LoadingRows rows={3} />
      ) : results.error ? (
        <ErrorState onRetry={() => results.refetch()} />
      ) : !results.data?.length ? (
        <EmptyState title="No published results yet" description="When an examiner publishes the results of an exam you sat, your score and feedback appear here." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {results.data.map((r, i) => (
            <li key={r.attemptId} className="animate-[rise_360ms_var(--ease-out)_backwards]" style={{ animationDelay: `${i * 40}ms` }}>
              <Link href={`/app/results/view?attempt=${r.attemptId}`} className="group flex items-center gap-5 rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm">
                <ScoreRing percent={r.percent} passed={r.passed} size={76} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold tracking-[-0.015em]">{r.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{fmtMarks(r.score)} of {fmtMarks(r.maxScore)} marks</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {r.passed ? <StatusBadge tone="success">Passed</StatusBadge> : <StatusBadge tone="danger">Below pass mark</StatusBadge>}
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground"><SealCheck className="size-3.5" aria-hidden="true" />{r.verifyCode}</span>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground rtl:rotate-180" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!!disputes.data?.length && (
        <Panel title="My disputes" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {disputes.data.map((d) => (
              <li key={d.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{d.exam}{d.question ? ` · Question ${d.question.number}` : ""}</p>
                  <StatusBadge tone={d.status === "open" ? "warning" : d.status === "accepted" ? "success" : "neutral"}>{d.status === "open" ? "Under review" : d.status === "accepted" ? "Accepted" : "Not upheld"}</StatusBadge>
                </div>
                <p className="mt-1.5 text-sm text-foreground-soft">{d.reason}</p>
                {d.response && (
                  <p className="mt-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm">
                    <span className="font-medium">Examiner:</span> {d.response}
                    {d.scoreAfter != null && d.scoreBefore != null && d.scoreAfter !== d.scoreBefore && <span className="text-muted-foreground"> · score {fmtMarks(d.scoreBefore)} → {fmtMarks(d.scoreAfter)}</span>}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">Raised {fmtDateTime(d.createdAt)}{d.resolvedAt ? ` · resolved ${fmtDateTime(d.resolvedAt)}` : ""}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
