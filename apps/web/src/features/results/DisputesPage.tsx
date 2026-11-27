"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, Gavel, XCircle } from "@phosphor-icons/react";
import { resolveDisputeSchema } from "@np/shared";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Segmented, inputCls, textareaCls } from "@/components/form/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api, apiErrorMessage } from "@/lib/api-client";
import { ago, fmtDateTime, fmtMarks, type Dispute } from "@/lib/exams";
import { cn } from "@/lib/utils";

/** Innovation 5.4: every dispute gets a reasoned, recorded decision the candidate can read. */
export function DisputesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const examId = params.get("exam");
  const show = (params.get("show") as "open" | "resolved" | "all") ?? "open";
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["disputes", examId], queryFn: () => api<Dispute[]>(`/exams/disputes${examId ? `?examId=${examId}` : ""}`) });
  const [resolving, setResolving] = useState<Dispute | null>(null);

  const rows = (list.data ?? []).filter((d) => (show === "all" ? true : show === "open" ? d.status === "open" : d.status !== "open"));
  const openCount = (list.data ?? []).filter((d) => d.status === "open").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disputes"
        description="Candidates can challenge a published mark. Each decision needs a reason the candidate will read, and accepted changes recalculate the total and update the verifiable report."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Show"
          size="sm"
          value={show}
          onChange={(v) => {
            const next = new URLSearchParams(params);
            next.set("show", v);
            router.replace(`${pathname}?${next}`, { scroll: false });
          }}
          options={[{ value: "open", label: <>Open <span className="text-muted-foreground tabular-nums">{openCount}</span></> }, { value: "resolved", label: "Resolved" }, { value: "all", label: "All" }]}
        />
        {examId && <Link href="/app/disputes" className="text-sm font-medium text-primary hover:underline">Show every exam</Link>}
      </div>

      {list.isLoading ? (
        <LoadingRows rows={4} />
      ) : list.error ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <EmptyState title={show === "open" ? "No open disputes" : "Nothing here"} description="When a candidate disputes a published result it shows up here." />
      ) : (
        <ul className="space-y-3">
          {rows.map((d, i) => (
            <li key={d.id} className="rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-xs animate-[rise_320ms_var(--ease-out)_backwards]" style={{ animationDelay: `${i * 35}ms` }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{d.candidate} <span className="font-normal text-muted-foreground">· {d.exam}</span></p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Raised {ago(d.createdAt)} · score at the time {fmtMarks(d.scoreBefore)}</p>
                </div>
                <StatusBadge tone={d.status === "open" ? "warning" : d.status === "accepted" ? "success" : "neutral"}>{d.status === "open" ? "Open" : d.status === "accepted" ? "Accepted" : "Rejected"}</StatusBadge>
              </div>
              {d.question && <p className="mt-3 text-sm"><span className="font-medium">Question {d.question.number}</span> <span className="text-muted-foreground">({d.question.marks} marks)</span> · {d.question.prompt}</p>}
              <blockquote className="mt-3 rounded-lg border-s-2 border-warning/60 bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-foreground-soft">{d.reason}</blockquote>
              {d.status !== "open" ? (
                <p className="mt-3 text-sm"><span className="font-medium">Decision:</span> {d.response} <span className="text-muted-foreground">· {fmtDateTime(d.resolvedAt)}{d.scoreAfter !== d.scoreBefore ? ` · ${fmtMarks(d.scoreBefore)} → ${fmtMarks(d.scoreAfter)}` : ""}</span></p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setResolving(d)}><Gavel /> Review and decide</Button>
                  <Button size="sm" variant="ghost" render={<Link href={`/app/results/view?attempt=${d.attemptId}`} />}>Open the paper</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ResolveDialog dispute={resolving} onClose={() => setResolving(null)} onDone={() => qc.invalidateQueries({ queryKey: ["disputes"] })} />
    </div>
  );
}

function ResolveDialog({ dispute, onClose, onDone }: { dispute: Dispute | null; onClose: () => void; onDone: () => void }) {
  const [decision, setDecision] = useState<"accepted" | "rejected">("accepted");
  const [response, setResponse] = useState("");
  const [score, setScore] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: unknown) => api(`/exams/disputes/${dispute!.id}/resolve`, { method: "POST", json: body }),
    onSuccess: () => {
      toast.success("Decision recorded and shared with the candidate");
      setResponse("");
      setScore("");
      onDone();
      onClose();
    },
    onError: (err) => (err instanceof ApiError && Object.keys(err.fields).length ? setErrors(err.fields) : toast.error(apiErrorMessage(err))),
  });
  const submit = () => {
    setErrors({});
    const body = { decision, response, newScore: decision === "accepted" && dispute?.question && score !== "" ? score : null };
    const parsed = resolveDisputeSchema.safeParse(body);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    if (dispute?.question && parsed.data.newScore != null && parsed.data.newScore > dispute.question.marks) return setErrors({ newScore: `Maximum is ${dispute.question.marks}` });
    save.mutate(parsed.data);
  };
  return (
    <Dialog open={!!dispute} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decide on {dispute?.candidate}&apos;s dispute</DialogTitle>
          <DialogDescription>The candidate sees your decision and reason. Everything is kept in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["accepted", "rejected"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDecision(d)}
                aria-pressed={decision === d}
                className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors", decision === d ? (d === "accepted" ? "border-success bg-success-soft text-success" : "border-danger bg-danger-soft text-danger") : "border-border hover:bg-muted")}
              >
                {d === "accepted" ? <CheckCircle weight="fill" className="size-4" /> : <XCircle weight="fill" className="size-4" />}
                {d === "accepted" ? "Accept" : "Reject"}
              </button>
            ))}
          </div>
          {decision === "accepted" && dispute?.question && (
            <label className="block">
              <span className="text-sm font-medium">New mark for question {dispute.question.number} <span className="font-normal text-muted-foreground">(max {dispute.question.marks})</span></span>
              <input value={score} onChange={(e) => setScore(e.target.value)} type="number" min={0} max={dispute.question.marks} step="0.5" inputMode="decimal" className={cn(inputCls, "mt-1.5")} aria-invalid={errors.newScore ? true : undefined} />
              {errors.newScore && <span role="alert" className="mt-1 block text-[0.8125rem] font-medium text-danger">{errors.newScore}</span>}
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium">Reason the candidate will see</span>
            <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} className={cn(textareaCls, "mt-1.5")} aria-invalid={errors.response ? true : undefined} placeholder="Agreed: the prompt didn't say all-or-nothing, so partial credit applies." />
            {errors.response && <span role="alert" className="mt-1 block text-[0.8125rem] font-medium text-danger">{errors.response}</span>}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Record decision"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
