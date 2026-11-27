"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import { Broadcast, ClockClockwise, Info, Megaphone, PaperPlaneRight, Pulse } from "@phosphor-icons/react";
import { announcementSchema, extendSchema } from "@np/shared";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { FormField, inputCls, textareaCls } from "@/components/form/FormField";
import { Meter, Panel, Stat } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiErrorMessage, applyFieldErrors } from "@/lib/api-client";
import { SIGNAL_LABEL, ago, fmtTime, type ExamDetail, type MonitorData } from "@/lib/exams";
import { useRealtime } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { useNow } from "@/features/app/DashboardPage";

type Attempt = MonitorData["attempts"][number];

function left(deadline: string, now: number) {
  const s = Math.max(0, Math.round((Date.parse(deadline) - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MonitorTab({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const now = useNow(1000);
  const key = ["exam", exam.id, "monitor"];
  const data = useQuery({ queryKey: key, queryFn: () => api<MonitorData>(`/exams/${exam.id}/monitor`), refetchInterval: 15_000 });
  const [flash, setFlash] = useState<number | null>(null);
  const { connected } = useRealtime(`exam-${exam.id}`, (e) => {
    if (e.id) {
      setFlash(e.id);
      setTimeout(() => setFlash(null), 1600);
    }
    qc.invalidateQueries({ queryKey: key });
    if (e.type === "submitted") qc.invalidateQueries({ queryKey: ["exams"] });
  });
  const [extending, setExtending] = useState<Attempt | null>(null);

  const d = data.data;
  const writing = d?.attempts.filter((a) => a.status === "in_progress") ?? [];
  const submitted = d?.attempts.filter((a) => a.status !== "in_progress") ?? [];
  const signals = d?.attempts.reduce((s, a) => s + a.signals, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("relative flex size-2", !connected && "opacity-50")}>
            {connected && <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />}
            <span className={cn("relative size-2 rounded-full", connected ? "bg-success" : "bg-muted-foreground")} />
          </span>
          {connected ? "Live: updates arrive the moment candidates save or submit" : "Connecting to live updates…"}
        </p>
        <p className="text-sm text-muted-foreground">Window closes {fmtTime(exam.endsAt)}</p>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Writing now" value={writing.length} tone={writing.length ? "success" : "default"} hint={`${writing.filter((a) => a.online).length} online`} />
        <Stat label="Submitted" value={submitted.length} hint={`of ${d?.enrolled ?? "–"} enrolled`} />
        <Stat label="Not started" value={Math.max(0, (d?.enrolled ?? 0) - (d?.attempts.length ?? 0))} />
        <Stat label="Signals recorded" value={signals} tone={signals ? "warning" : "default"} hint="For review, not proof" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Panel title="Attempts" bodyClassName="p-0">
          {data.isLoading ? (
            <LoadingRows rows={5} className="p-4" />
          ) : data.error ? (
            <ErrorState className="m-4" onRetry={() => data.refetch()} />
          ) : !d?.attempts.length ? (
            <EmptyState className="m-4 border-dashed shadow-none" title="Nobody has started yet" description="Attempts appear here the moment a candidate begins." />
          ) : (
            <ul className="divide-y divide-border">
              {[...writing, ...submitted].map((a) => {
                const live = a.status === "in_progress";
                return (
                  <li key={a.id} className={cn("grid gap-3 px-5 py-4 transition-colors duration-700 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center", flash === a.id && "bg-brand-softer")}>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className={cn("size-2 shrink-0 rounded-full", live ? (a.online ? "bg-success" : "bg-warning") : "bg-muted-foreground/40")} title={live ? (a.online ? "Online" : "No contact in the last 45s") : "Finished"} />
                        <span className="truncate">{a.fullName}</span>
                        {a.signals > 0 && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-warning">{a.signals} signal{a.signals > 1 ? "s" : ""}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {live ? `${a.online ? "Online" : `Last seen ${ago(a.lastSeenAt, now)}`} · started ${fmtTime(a.startedAt)}` : `${a.status === "expired" ? "Time ran out" : "Submitted"} ${fmtTime(a.submittedAt)}`}
                        {a.extraMinutes > 0 && ` · +${a.extraMinutes} min added`}
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="tabular-nums">{a.answered}/{a.total} answered</span>
                        {a.flagged > 0 && <span>{a.flagged} flagged</span>}
                      </div>
                      <Meter className="mt-1.5" value={a.answered} max={Math.max(1, a.total)} tone={live ? "brand" : "muted"} label={`${a.fullName} progress`} />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {live ? (
                        <>
                          <span className={cn("font-mono text-sm font-medium tabular-nums", Date.parse(a.deadlineAt) - now < 5 * 60_000 && "text-danger")}>{left(a.deadlineAt, now)}</span>
                          <Button variant="outline" size="sm" onClick={() => setExtending(a)}>
                            <ClockClockwise /> Add time
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Done</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Announce exam={exam} history={d?.announcements ?? []} onSent={() => qc.invalidateQueries({ queryKey: key })} />
          <Panel title={<span className="flex items-center gap-2"><Pulse className="size-4 text-warning" aria-hidden="true" /> Signals</span>} bodyClassName="p-0">
            <p className="flex gap-2 border-b border-border bg-surface-sunken/60 px-5 py-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Browser events worth a look, not evidence of misconduct. Many have innocent causes, like a notification or a weak connection.
            </p>
            {!d?.incidents.length ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No signals recorded.</p>
            ) : (
              <ol className="max-h-96 divide-y divide-border overflow-y-auto">
                {d.incidents.map((i) => (
                  <li key={i.id} className="px-5 py-3 text-sm animate-[rise_300ms_var(--ease-out)_backwards]">
                    <p><span className="font-medium">{i.fullName}</span> <span className="text-foreground-soft">· {SIGNAL_LABEL[i.type] ?? i.type}</span></p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ago(i.at, now)}{i.detail ? ` · ${i.detail}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <ExtendDialog examId={exam.id} attempt={extending} onClose={() => setExtending(null)} onDone={() => qc.invalidateQueries({ queryKey: key })} />
    </div>
  );
}

function Announce({ exam, history, onSent }: { exam: ExamDetail; history: MonitorData["announcements"]; onSent: () => void }) {
  const form = useForm<z.input<typeof announcementSchema>, unknown, z.output<typeof announcementSchema>>({ resolver: zodResolver(announcementSchema), defaultValues: { message: "" } });
  const send = useMutation({
    mutationFn: (v: z.output<typeof announcementSchema>) => api(`/exams/${exam.id}/announcements`, { method: "POST", json: v }),
    onSuccess: () => {
      form.reset({ message: "" });
      onSent();
      toast.success("Sent to every candidate in the exam");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
  return (
    <Panel title={<span className="flex items-center gap-2"><Megaphone className="size-4 text-primary" aria-hidden="true" /> Announcement</span>} description="Appears instantly in every candidate's workspace.">
      <form noValidate onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3">
        <FormField label="Message" error={form.formState.errors.message?.message}>
          {(p) => <textarea {...p} {...form.register("message")} rows={3} className={textareaCls} placeholder="Question 4: BETWEEN includes both ends of the range." />}
        </FormField>
        <Button type="submit" className="w-full" disabled={send.isPending}>
          <PaperPlaneRight /> {send.isPending ? "Sending…" : "Send to candidates"}
        </Button>
      </form>
      {history.length > 0 && (
        <ol className="mt-5 space-y-3 border-t border-border pt-4">
          {history.slice(0, 4).map((a) => (
            <li key={a.id} className="flex gap-2.5 text-sm">
              <Broadcast className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span><span className="text-foreground-soft">{a.message}</span> <span className="text-xs text-muted-foreground">· {fmtTime(a.at)}</span></span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function ExtendDialog({ examId, attempt, onClose, onDone }: { examId: number; attempt: Attempt | null; onClose: () => void; onDone: () => void }) {
  const form = useForm<z.input<typeof extendSchema>, unknown, z.output<typeof extendSchema>>({ resolver: zodResolver(extendSchema), defaultValues: { minutes: 5, reason: "" } });
  const save = useMutation({
    mutationFn: (v: z.output<typeof extendSchema>) => api(`/exams/attempts/${attempt!.id}/extend`, { method: "POST", json: v }),
    onSuccess: () => {
      toast.success(`Time added for ${attempt!.fullName}`);
      form.reset({ minutes: 5, reason: "" });
      onDone();
      onClose();
    },
    onError: (err) => {
      if (!applyFieldErrors(err, form.setError)) toast.error(apiErrorMessage(err));
    },
  });
  void examId;
  return (
    <Dialog open={!!attempt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add time for {attempt?.fullName}</DialogTitle>
          <DialogDescription>For a verified disruption only. The reason is recorded with the attempt and shown in the signals log.</DialogDescription>
        </DialogHeader>
        <form id="extend-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <FormField label="Minutes" required error={form.formState.errors.minutes?.message}>
            {(p) => <input {...p} {...form.register("minutes")} type="number" min={1} max={60} inputMode="numeric" className={inputCls} />}
          </FormField>
          <FormField label="Reason" required error={form.formState.errors.reason?.message}>
            {(p) => <textarea {...p} {...form.register("reason")} rows={3} className={textareaCls} placeholder="Power cut in the exam hall from 10:20 to 10:31, confirmed by the invigilator." />}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="extend-form" disabled={save.isPending}>{save.isPending ? "Adding…" : "Add time"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
