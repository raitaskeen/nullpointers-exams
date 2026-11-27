"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CaretLeft, CheckCircle, FilePdf, Gavel, MinusCircle, SealCheck, XCircle } from "@phosphor-icons/react";
import { disputeSchema } from "@np/shared";
import { ErrorState, LoadingRows } from "@/components/feedback/States";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { textareaCls } from "@/components/form/FormField";
import { Panel } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api, apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { TYPE_LABEL } from "@np/shared";
import { downloadFile, fmtDateTime, fmtMarks, pct, type Dispute, type ResultDetail } from "@/lib/exams";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";

type Q = ResultDetail["questions"][number];

function ResponseView({ q, examinerView }: { q: Q; examinerView: boolean }) {
  if (q.type === "written") {
    return (
      <blockquote className="rounded-lg border-s-2 border-border-strong bg-surface-sunken px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-foreground-soft">
        {typeof q.response === "string" && q.response.trim() ? q.response : <span className="text-muted-foreground">No answer given.</span>}
      </blockquote>
    );
  }
  const chosen = Array.isArray(q.response) ? q.response : [];
  return (
    <ul className="space-y-1.5">
      {q.options.map((o) => {
        const picked = chosen.includes(o.id);
        const right = q.correct?.includes(o.id);
        return (
          <li
            key={o.id}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
              examinerView && right ? "border-success/40 bg-success-soft/60" : picked ? "border-primary/40 bg-brand-softer" : "border-border",
            )}
          >
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", picked ? "border-primary bg-primary" : "border-control-border")}>
              {picked && <span className="size-1.5 rounded-full bg-primary-foreground" />}
            </span>
            <span className="flex-1">{o.text}</span>
            {picked && <span className="text-xs font-medium text-brand-ink">Chosen</span>}
            {examinerView && right && <span className="text-xs font-medium text-success">Correct</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function ResultDetailPage() {
  const id = Number(useSearchParams().get("attempt")) || 0;
  const qc = useQueryClient();
  const { can } = useAuth();
  const examinerView = can("exams:manage");
  const data = useQuery({ queryKey: ["result", id], queryFn: () => api<ResultDetail>(`/attempts/${id}/result`), enabled: id > 0 });
  const mine = useQuery({ queryKey: ["me", "disputes"], queryFn: () => api<Dispute[]>("/me/disputes"), enabled: !examinerView });
  const [disputing, setDisputing] = useState<Q | null | "general">(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const raise = useMutation({
    mutationFn: (body: { questionId: number | null; reason: string }) => api(`/attempts/${id}/disputes`, { method: "POST", json: body }),
    onSuccess: () => {
      toast.success("Dispute sent. You'll see the examiner's answer on your results page.");
      setDisputing(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["me", "disputes"] });
    },
    onError: (err) => setReasonError(err instanceof ApiError && err.fields.reason ? err.fields.reason : apiErrorMessage(err)),
  });

  if (data.isLoading) return <LoadingRows rows={6} />;
  if (data.error || !data.data)
    return <ErrorState title="Result not available" description="Results appear once the examiner publishes them. You can only see your own." onRetry={() => data.refetch()} />;

  const { attempt: a, exam, questions } = data.data;
  const percent = pct(a.score, a.maxScore);
  const passed = percent >= exam.passPercent;
  const openFor = (qid: number | null) => (mine.data ?? []).find((d) => d.attemptId === a.id && d.questionId === qid && d.status === "open");
  const canDispute = !examinerView && exam.resultsPublished && !a.isSandbox;

  const submitDispute = () => {
    setReasonError(null);
    const questionId = disputing && disputing !== "general" ? disputing.id : null;
    const parsed = disputeSchema.safeParse({ questionId, reason });
    if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message ?? "Check your reason");
    raise.mutate({ questionId, reason: parsed.data.reason });
  };

  return (
    <div className="space-y-6">
      <Link href={examinerView ? `/app/exams/view?id=${exam.id}&tab=results` : "/app/results"} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-fine:min-h-8">
        <CaretLeft className="size-4 rtl:rotate-180" aria-hidden="true" /> {examinerView ? "Results & analytics" : "My results"}
      </Link>

      <section className="flex flex-col gap-6 rounded-[1.25rem] border border-border bg-card p-6 shadow-xs sm:p-8 xl:flex-row xl:items-center">
        <ScoreRing percent={percent} passed={passed} size={128} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-[1.75rem]">{exam.title}</h1>
          <p className="mt-1 text-foreground-soft tabular-nums">{fmtMarks(a.score)} of {fmtMarks(a.maxScore)} marks · pass mark {exam.passPercent}%</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.pendingManual ? <StatusBadge tone="warning">{a.pendingManual} answer(s) still being marked</StatusBadge> : passed ? <StatusBadge tone="success">Passed</StatusBadge> : <StatusBadge tone="danger">Below pass mark</StatusBadge>}
            {a.isSandbox && <StatusBadge tone="neutral">Sandbox</StatusBadge>}
            {!exam.resultsPublished && <StatusBadge tone="neutral">Not published yet</StatusBadge>}
          </div>
          <p className="mt-3 text-[0.8125rem] text-muted-foreground">Submitted {fmtDateTime(a.submittedAt)}{exam.resultsPublishedAt ? ` · published ${fmtDateTime(exam.resultsPublishedAt)}` : ""}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row xl:w-56 xl:flex-col">
          {exam.resultsPublished && !a.isSandbox && (
            <Button
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadFile(`/attempts/${a.id}/result.pdf`, `result-${a.id}.pdf`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Download failed");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <FilePdf /> {downloading ? "Preparing…" : "Download PDF report"}
            </Button>
          )}
          {a.verifyCode && (
            <Link href={`/verify?code=${a.verifyCode}`} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <SealCheck className="size-4" aria-hidden="true" /> Verify · {a.verifyCode}
            </Link>
          )}
          {canDispute && (
            <Button variant="ghost" onClick={() => setDisputing("general")}><Gavel /> Dispute the result</Button>
          )}
        </div>
      </section>

      <Panel title="Question by question" description={examinerView ? "Correct options are highlighted. Candidates never see the answer key." : "Your answers, the marks awarded and any feedback."} bodyClassName="p-0">
        <ol className="divide-y divide-border">
          {questions.map((q) => {
            const full = q.awarded != null && q.awarded >= q.marks;
            const none = q.awarded === 0 || q.awarded == null;
            const open = openFor(q.id);
            return (
              <li key={q.id} className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:px-6">
                <div className="min-w-0 space-y-3">
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Question {q.number}</span> · {TYPE_LABEL[q.type]} · {q.topic}</p>
                  <p className="font-medium leading-snug">{q.prompt}</p>
                  <ResponseView q={q} examinerView={examinerView} />
                  {q.feedback && <p className="rounded-lg bg-brand-softer px-3 py-2 text-sm"><span className="font-medium text-brand-ink">Feedback:</span> {q.feedback}</p>}
                </div>
                <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                    {q.awarded == null ? <MinusCircle className="size-5 text-warning" aria-hidden="true" /> : full ? <CheckCircle weight="fill" className="size-5 text-success" aria-hidden="true" /> : none ? <XCircle weight="fill" className="size-5 text-danger" aria-hidden="true" /> : <CheckCircle weight="duotone" className="size-5 text-warning" aria-hidden="true" />}
                    {q.awarded == null ? "–" : fmtMarks(q.awarded)}<span className="text-sm font-normal text-muted-foreground">/{fmtMarks(q.marks)}</span>
                  </span>
                  {canDispute && (open ? <StatusBadge tone="warning">Dispute open</StatusBadge> : <Button variant="ghost" size="sm" onClick={() => setDisputing(q)}><Gavel /> Dispute</Button>)}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Dialog open={disputing !== null} onOpenChange={(o) => !o && setDisputing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{disputing && disputing !== "general" ? `Dispute question ${disputing.number}` : "Dispute this result"}</DialogTitle>
            <DialogDescription>Explain what you think is wrong. Your examiner reviews it and replies with a reason; an accepted dispute updates your score and your verifiable report.</DialogDescription>
          </DialogHeader>
          <label htmlFor="dispute-reason" className="text-sm font-medium">Reason</label>
          <textarea id="dispute-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={5} className={textareaCls} aria-invalid={reasonError ? true : undefined} placeholder="Option B is also correct because…" />
          {reasonError && <p role="alert" className="text-[0.8125rem] font-medium text-danger">{reasonError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputing(null)}>Cancel</Button>
            <Button onClick={submitDispute} disabled={raise.isPending}>{raise.isPending ? "Sending…" : "Send dispute"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
