"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, Hourglass } from "@phosphor-icons/react";
import { gradeSchema } from "@np/shared";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { Segmented, inputCls, textareaCls } from "@/components/form/FormField";
import { Meter, Panel } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { ApiError, api, apiErrorMessage } from "@/lib/api-client";
import { fmtMarks, type ExamDetail, type GradingRow } from "@/lib/exams";
import { cn } from "@/lib/utils";

type Written = GradingRow["written"][number];

function GradeItem({ attemptId, item, onSaved }: { attemptId: number; item: Written; onSaved: () => void }) {
  const [score, setScore] = useState(item.manualScore == null ? "" : String(item.manualScore));
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setScore(item.manualScore == null ? "" : String(item.manualScore));
    setFeedback(item.feedback ?? "");
  }, [item.manualScore, item.feedback]);

  const save = useMutation({
    mutationFn: (body: { questionId: number; score: number; feedback: string | null }) => api(`/exams/attempts/${attemptId}/grade`, { method: "POST", json: body }),
    onSuccess: () => {
      onSaved();
      toast.success("Mark saved");
    },
    onError: (err) => setError(err instanceof ApiError && err.fields.score ? err.fields.score : apiErrorMessage(err)),
  });

  const submit = () => {
    setError(null);
    const parsed = gradeSchema.safeParse({ questionId: item.questionId, score: score === "" ? undefined : score, feedback: feedback || null });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the mark");
    if (parsed.data.score > item.marks) return setError(`The maximum for this question is ${item.marks} marks`);
    save.mutate({ questionId: item.questionId, score: parsed.data.score, feedback: parsed.data.feedback ?? null });
  };
  const graded = item.manualScore != null;
  const dirty = (item.manualScore == null ? "" : String(item.manualScore)) !== score || (item.feedback ?? "") !== feedback;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{item.prompt}</p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", graded ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>{graded ? "Graded" : "Needs a mark"}</span>
      </div>
      <blockquote className="mt-3 rounded-lg border-s-2 border-primary/40 bg-surface-sunken px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground-soft">
        {item.response.trim() ? item.response : <span className="text-muted-foreground">No answer given.</span>}
      </blockquote>
      <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-start">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Mark (max {fmtMarks(item.marks)})</span>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            type="number"
            inputMode="decimal"
            min={0}
            max={item.marks}
            step="0.5"
            aria-invalid={error ? true : undefined}
            className={cn(inputCls, "tabular-nums")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Feedback for the candidate</span>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={1} className={cn(textareaCls, "min-h-11 pointer-fine:min-h-10")} placeholder="Optional" />
        </label>
        <Button className="sm:mt-5" onClick={submit} disabled={save.isPending || (!dirty && graded)} variant={graded && !dirty ? "outline" : "default"}>
          {save.isPending ? "Saving…" : graded && !dirty ? <><CheckCircle weight="fill" className="text-success" /> Saved</> : "Save mark"}
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-[0.8125rem] font-medium text-danger">{error}</p>}
    </div>
  );
}

export function GradingTab({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const [show, setShow] = useState<"pending" | "all">("pending");
  const key = ["exam", exam.id, "grading"];
  const list = useQuery({ queryKey: key, queryFn: () => api<GradingRow[]>(`/exams/${exam.id}/grading`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["exams"] });
    qc.invalidateQueries({ queryKey: ["exam", exam.id, "analytics"] });
  };

  const rows = (list.data ?? []).filter((r) => r.written.length > 0);
  const totalItems = rows.reduce((s, r) => s + r.written.filter((w) => w.response.trim()).length, 0);
  const pending = rows.reduce((s, r) => s + r.pendingManual, 0);
  const visible = show === "pending" ? rows.filter((r) => r.pendingManual > 0) : rows;

  if (list.isLoading) return <LoadingRows rows={4} />;
  if (list.error) return <ErrorState onRetry={() => list.refetch()} />;
  if (!list.data?.length) return <EmptyState title="Nothing to grade yet" description="Submitted attempts appear here. Objective questions are marked automatically the moment a candidate submits." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {pending ? <Hourglass weight="duotone" className="size-[1.125rem] text-warning" /> : <CheckCircle weight="fill" className="size-[1.125rem] text-success" />}
            {pending ? `${pending} written answer${pending === 1 ? "" : "s"} still need a mark` : "Every written answer is graded"}
          </p>
          <Meter className="mt-3 max-w-md" value={totalItems - pending} max={Math.max(1, totalItems)} tone={pending ? "warning" : "success"} label="Grading progress" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented size="sm" label="Show" value={show} onChange={setShow} options={[{ value: "pending", label: "To grade" }, { value: "all", label: "All" }]} />
          {!pending && (
            <Button render={<Link href={`/app/exams/view?id=${exam.id}&tab=results`} />}>
              Review & publish <ArrowRight className="rtl:rotate-180" />
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No written questions in these papers" description="Every answer was marked automatically. Head to Results to review and publish." />
      ) : visible.length === 0 ? (
        <EmptyState title="All caught up" description="Switch to All to revise a mark." />
      ) : (
        visible.map((r) => (
          <Panel
            key={r.attemptId}
            title={r.fullName}
            description={`Current total ${fmtMarks(r.score)} of ${fmtMarks(r.maxScore)}${r.pendingManual ? ` · ${r.pendingManual} to mark` : ""}`}
            action={<Link href={`/app/results/view?attempt=${r.attemptId}`} className="text-sm font-medium text-primary hover:underline">Full paper</Link>}
            className="animate-[rise_320ms_var(--ease-out)_backwards]"
          >
            <div className="space-y-3">
              {r.written.map((w) => <GradeItem key={w.questionId} attemptId={r.attemptId} item={w} onSaved={refresh} />)}
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}
