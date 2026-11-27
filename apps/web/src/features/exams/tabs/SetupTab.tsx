"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowCounterClockwise, CheckCircle, Eye, Lock, PaperPlaneTilt, StopCircle, Trash, WarningCircle } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Panel } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { api, apiErrorMessage } from "@/lib/api-client";
import { fmtMarks, type ExamDetail } from "@/lib/exams";
import { cn } from "@/lib/utils";
import { ExamForm, type ExamFormValues } from "../ExamForm";

function Check({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {ok ? (
        <CheckCircle weight="fill" className="mt-0.5 size-[1.125rem] shrink-0 text-success" aria-label="Done" />
      ) : (
        <WarningCircle weight="fill" className={cn("mt-0.5 size-[1.125rem] shrink-0", warn ? "text-warning" : "text-danger")} aria-label={warn ? "Recommended" : "Required"} />
      )}
      <span className={ok ? "text-foreground-soft" : "text-foreground"}>{children}</span>
    </li>
  );
}

export function SetupTab({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const router = useRouter();
  const draft = exam.status === "draft";
  const [confirm, setConfirm] = useState<null | "publish" | "close" | "delete" | "unpublish">(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["exam", exam.id] });
    qc.invalidateQueries({ queryKey: ["exams"] });
  };

  const save = useMutation({
    mutationFn: (v: ExamFormValues) => api(`/exams/${exam.id}`, { method: "PUT", json: v }),
    onSuccess: () => {
      refresh();
      toast.success("Settings saved");
    },
  });
  const action = async (path: string, ok: string) => {
    try {
      await api(`/exams/${exam.id}/${path}`, { method: "POST" });
      refresh();
      toast.success(ok);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      throw err;
    }
  };
  const sandbox = useMutation({
    mutationFn: () => api<{ attemptId: number }>(`/exams/${exam.id}/sandbox`, { method: "POST" }),
    onSuccess: (r) => router.push(`/exam?attempt=${r.attemptId}`),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const poolMarks = exam.pool.reduce((s, q) => s + q.marks, 0);
  const marksProblem = exam.problems.find((p) => p.includes("marks"));
  const drawProblem = exam.problems.find((p) => p.startsWith("Draw") || p.includes("same marks"));
  const windowProblem = exam.problems.find((p) => p.includes("window"));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel
        title="Exam settings"
        description={draft ? "Everything here can change until you publish." : "Published exams are locked so every candidate gets the same rules. Move it back to draft to edit (only before anyone starts)."}
        action={
          draft ? (
            <Button type="submit" form="exam-settings" size="sm" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Lock className="size-3.5" /> Locked</span>
          )
        }
      >
        <ExamForm
          id="exam-settings"
          exam={exam}
          disabled={!draft}
          onSubmit={(v, setErrors) =>
            save.mutateAsync(v).then(() => undefined, (err) => {
              if (!setErrors(err)) toast.error(apiErrorMessage(err));
            })
          }
        />
      </Panel>

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        {draft ? (
          <Panel title="Ready to publish?" description="Publishing is blocked until every check passes.">
            <ul className="space-y-3">
              <Check ok={exam.pool.length > 0}>{exam.pool.length ? `${exam.pool.length} questions in the pool` : "Add at least one question"}</Check>
              <Check ok={!drawProblem}>{drawProblem ?? "The draw plan can be met from the pool"}</Check>
              <Check ok={!marksProblem}>{marksProblem ?? `Every paper is worth ${fmtMarks(exam.totalMarks)} marks`}</Check>
              <Check ok={!windowProblem}>{windowProblem ?? "The window is in the future"}</Check>
              <Check ok={!!exam.instructions.trim()} warn>Instructions for candidates{exam.instructions.trim() ? "" : " (recommended)"}</Check>
            </ul>
            {exam.problems.filter((p) => p !== marksProblem && p !== drawProblem && p !== windowProblem && !p.startsWith("Add at least")).map((p) => (
              <p key={p} className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{p}</p>
            ))}
            <Button className="mt-5 w-full" disabled={exam.problems.length > 0} onClick={() => setConfirm("publish")}>
              <PaperPlaneTilt /> Publish exam
            </Button>
            {exam.pool.length > 0 && !marksProblem && (
              <p className="mt-2 text-center text-xs text-muted-foreground">Pool holds {fmtMarks(poolMarks)} marks in total.</p>
            )}
          </Panel>
        ) : (
          <Panel title="Lifecycle">
            <ol className="space-y-2.5 text-sm">
              {(["Draft", "Published", "Ongoing", "Completed"] as const).map((s, i) => {
                const at = { draft: 0, upcoming: 1, ongoing: 2, ended: 2, completed: 3 }[exam.phase];
                return (
                  <li key={s} className="flex items-center gap-3">
                    <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold", i < at ? "bg-success text-white" : i === at ? "bg-primary text-primary-foreground ring-4 ring-primary/15" : "bg-muted text-muted-foreground")}>
                      {i < at ? <CheckCircle weight="bold" className="size-3.5" /> : i + 1}
                    </span>
                    <span className={i === at ? "font-semibold" : "text-muted-foreground"}>{s}{i === 2 && exam.phase === "ended" ? " (window closed)" : ""}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 grid gap-2">
              {exam.status === "published" && (
                <>
                  <Button variant="outline" onClick={() => setConfirm("unpublish")}><ArrowCounterClockwise /> Back to draft</Button>
                  <Button variant="destructive-soft" onClick={() => setConfirm("close")}><StopCircle /> Close exam now</Button>
                </>
              )}
            </div>
          </Panel>
        )}

        <Panel title="Preview as a candidate" description="A private sandbox attempt with the real paper rules. It never counts towards results, analytics or reports.">
          <Button variant="outline" className="w-full" disabled={!exam.pool.length || sandbox.isPending} onClick={() => sandbox.mutate()}>
            <Eye /> {sandbox.isPending ? "Opening…" : "Open sandbox"}
          </Button>
        </Panel>

        {draft && (
          <Button variant="ghost" className="w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirm("delete")}>
            <Trash /> Delete draft
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={false}
        title="Publish this exam?"
        description="Enrolled candidates will see it in their schedule, and can start once the window opens. Settings and questions lock."
        confirmLabel="Publish"
        onConfirm={() => action("publish", "Exam published")}
      />
      <ConfirmDialog
        open={confirm === "unpublish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={false}
        title="Move back to draft?"
        description="Only possible while nobody has started. Candidates will no longer see it."
        confirmLabel="Back to draft"
        onConfirm={() => action("unpublish", "Moved back to draft")}
      />
      <ConfirmDialog
        open={confirm === "close"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Close the exam now?"
        description="Anyone still writing is submitted immediately with the answers already saved. This can't be undone."
        confirmLabel="Close exam"
        onConfirm={() => action("close", "Exam closed")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this draft?"
        description="The exam and its enrolments are removed. Questions stay in your bank."
        onConfirm={async () => {
          try {
            await api(`/exams/${exam.id}`, { method: "DELETE" });
            qc.invalidateQueries({ queryKey: ["exams"] });
            toast.success("Draft deleted");
            router.replace("/app/exams");
          } catch (err) {
            toast.error(apiErrorMessage(err));
            throw err;
          }
        }}
      />
    </div>
  );
}
