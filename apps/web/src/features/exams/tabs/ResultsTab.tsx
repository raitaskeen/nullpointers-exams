"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowsDownUp, Eye, EyeSlash, FilePdf, Lock, Scales, SealCheck } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Meter, Panel, Stat } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { api, apiErrorMessage } from "@/lib/api-client";
import { DIFF_LABEL, downloadFile, fmtDateTime, fmtMarks, type Analytics, type ExamDetail } from "@/lib/exams";
import { cn } from "@/lib/utils";
import { DifficultyPill } from "@/features/questions/QuestionBankPage";

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, boxShadow: "var(--shadow-md)", fontSize: 12, color: "var(--foreground)" };

export function ResultsTab({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const key = ["exam", exam.id, "analytics"];
  const data = useQuery({ queryKey: key, queryFn: () => api<Analytics>(`/exams/${exam.id}/analytics`) });
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);
  const [sort, setSort] = useState<"order" | "hardest" | "skipped">("order");
  const [downloading, setDownloading] = useState(false);

  const a = data.data;
  if (data.isLoading) return <LoadingRows rows={6} />;
  if (data.error || !a) return <ErrorState onRetry={() => data.refetch()} />;

  const s = a.summary;
  const canPublish = s.submitted > 0 && s.pendingGrading === 0 && exam.phase !== "ongoing";
  const blocker = s.submitted === 0 ? "Nobody has submitted yet." : s.pendingGrading ? `${s.pendingGrading} written answer(s) still need grading.` : exam.phase === "ongoing" ? "The exam is still running. Close it, or wait for the window to end." : null;
  const questions = [...a.questions].sort((x, y) => (sort === "hardest" ? x.correctPercent - y.correctPercent : sort === "skipped" ? y.skippedPercent - x.skippedPercent : 0));

  const publish = async (on: boolean) => {
    try {
      await api(`/exams/${exam.id}/results/${on ? "publish" : "unpublish"}`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["exam", exam.id] });
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success(on ? "Results published. Candidates can see their scores now." : "Results hidden from candidates");
    } catch (err) {
      toast.error(apiErrorMessage(err));
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn("flex flex-col gap-4 rounded-[var(--radius-card)] border p-5 shadow-xs sm:flex-row sm:items-center", a.exam.resultsPublished ? "border-success/30 bg-success-soft/50" : "border-border bg-card")}>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", a.exam.resultsPublished ? "bg-success text-white" : "bg-muted text-muted-foreground")}>
          {a.exam.resultsPublished ? <SealCheck weight="fill" className="size-6" /> : <Lock weight="duotone" className="size-6" />}
        </span>
        <div className="flex-1">
          <p className="font-semibold">{a.exam.resultsPublished ? `Published ${fmtDateTime(exam.resultsPublishedAt)}` : "Results are private"}</p>
          <p className="text-sm text-muted-foreground">
            {a.exam.resultsPublished ? "Candidates can see their own score, download a verifiable PDF and raise a dispute." : blocker ?? "Review the scores below, then publish when you're happy."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={downloading || !s.submitted}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadFile(`/exams/${exam.id}/report.pdf`, `exam-${exam.id}-report.pdf`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Download failed");
              } finally {
                setDownloading(false);
              }
            }}
          >
            <FilePdf /> {downloading ? "Preparing…" : "Exam report PDF"}
          </Button>
          {a.exam.resultsPublished ? (
            <Button variant="outline" onClick={() => setConfirm("unpublish")}><EyeSlash /> Unpublish</Button>
          ) : (
            <Button disabled={!canPublish} onClick={() => setConfirm("publish")}><Eye /> Publish results</Button>
          )}
        </div>
      </div>

      {!s.submitted ? (
        <EmptyState title="No submissions yet" description="Performance summaries are built from real submitted attempts, so they appear once candidates finish." />
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Submitted" value={s.submitted} />
            <Stat label="Average" value={`${s.meanPercent}%`} tone="brand" />
            <Stat label="Median" value={`${s.medianPercent}%`} />
            <Stat label="Pass rate" value={`${s.passRate}%`} tone={s.passRate >= 50 ? "success" : "warning"} hint={`Pass mark ${a.exam.passPercent}%`} />
            <Stat label="Highest" value={`${s.highestPercent}%`} />
            <Stat label="Lowest" value={`${s.lowestPercent}%`} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Panel title="Score distribution" description="Number of candidates in each 10% band.">
              <div className="h-64" role="img" aria-label={`Score distribution: ${a.distribution.filter((d) => d.count).map((d) => `${d.count} in ${d.range}%`).join(", ")}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.distribution} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="18%">
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="range" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval={0} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} formatter={(v) => [`${v} candidate(s)`, "Count"]} labelFormatter={(l) => `${l}%`} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={700}>
                      {a.distribution.map((d, i) => (
                        <Cell key={d.range} fill={i * 10 >= a.exam.passPercent ? "var(--primary)" : "color-mix(in oklch, var(--primary) 35%, var(--muted))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> At or above pass mark</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[color-mix(in_oklch,var(--primary)_35%,var(--muted))]" /> Below</span>
              </p>
            </Panel>
            <Panel title="By topic" description="Share of available marks earned.">
              <ul className="space-y-4">
                {a.topics.sort((x, y) => x.percent - y.percent).map((t) => (
                  <li key={t.topic}>
                    <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{t.topic}</span><span className="text-muted-foreground tabular-nums">{t.percent}%</span></div>
                    <Meter value={t.percent} tone={t.percent < 50 ? "warning" : "brand"} label={t.topic} />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Candidates" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b border-border bg-surface-sunken/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 text-start font-medium">#</th>
                    <th className="px-3 py-2.5 text-start font-medium">Candidate</th>
                    <th className="px-3 py-2.5 text-end font-medium">Score</th>
                    <th className="w-48 px-3 py-2.5 text-start font-medium">Percent</th>
                    <th className="px-5 py-2.5 text-end font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {a.candidates.map((c, i) => (
                    <tr key={c.attemptId} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-3"><Link href={`/app/results/view?attempt=${c.attemptId}`} className="font-medium hover:underline">{c.fullName}</Link></td>
                      <td className="px-3 py-3 text-end tabular-nums">{fmtMarks(c.score)} / {fmtMarks(c.maxScore)}</td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><Meter className="flex-1" value={c.percent} tone={c.passed ? "success" : "danger"} label={`${c.fullName} percent`} /><span className="w-12 text-end tabular-nums">{c.percent}%</span></div></td>
                      <td className="px-5 py-3 text-end">{c.pendingManual ? <StatusBadge tone="warning">To grade</StatusBadge> : c.passed ? <StatusBadge tone="success">Pass</StatusBadge> : <StatusBadge tone="danger">Below pass</StatusBadge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Question analytics"
            description="Which questions were skipped, missed, or harder than labelled."
            action={
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowsDownUp className="size-4" aria-hidden="true" />
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground pointer-fine:h-8" aria-label="Sort questions">
                  <option value="order">Paper order</option>
                  <option value="hardest">Hardest first</option>
                  <option value="skipped">Most skipped first</option>
                </select>
              </label>
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {questions.map((q) => {
                const mismatch = q.served > 0 && q.observedDifficulty !== q.difficulty;
                return (
                  <li key={q.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium">{q.prompt}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <DifficultyPill d={q.difficulty} /> {q.topic} · {q.marks} marks · served {q.served}×
                        {mismatch && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">Played as {DIFF_LABEL[q.observedDifficulty].toLowerCase()}</span>}
                      </p>
                      {q.commonWrong && <p className="mt-1.5 text-xs text-muted-foreground">Most common wrong answer: <span className="font-medium text-foreground-soft">{q.commonWrong.text}</span> ({q.commonWrong.count}×)</p>}
                    </div>
                    <dl className="grid grid-cols-3 gap-3 text-xs">
                      <div><dt className="text-muted-foreground">Full marks</dt><dd className="mt-1 font-semibold tabular-nums">{q.correctPercent}%</dd><Meter className="mt-1" value={q.correctPercent} tone="success" label="Full marks" /></div>
                      <div><dt className="text-muted-foreground">Skipped</dt><dd className="mt-1 font-semibold tabular-nums">{q.skippedPercent}%</dd><Meter className="mt-1" value={q.skippedPercent} tone="warning" label="Skipped" /></div>
                      <div><dt className="text-muted-foreground">Avg score</dt><dd className="mt-1 font-semibold tabular-nums">{fmtMarks(q.averageScore)}/{q.marks}</dd><Meter className="mt-1" value={q.averageScore} max={q.marks} label="Average" /></div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Link href={`/app/disputes?exam=${exam.id}`} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <Scales className="size-4" aria-hidden="true" /> Disputes raised on this exam
          </Link>
        </>
      )}

      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={false}
        title="Publish results?"
        description="Each candidate will see only their own score and feedback, and can download a verifiable report. Answer keys stay private."
        confirmLabel="Publish results"
        onConfirm={() => publish(true)}
      />
      <ConfirmDialog
        open={confirm === "unpublish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Hide results again?"
        description="Candidates lose access to their scores and reports until you publish again. Verification codes stop validating."
        confirmLabel="Unpublish"
        onConfirm={() => publish(false)}
      />
    </div>
  );
}
