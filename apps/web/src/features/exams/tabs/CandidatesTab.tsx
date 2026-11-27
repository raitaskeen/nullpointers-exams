"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DownloadSimple, FileArrowUp, UserMinus, UserPlus } from "@phosphor-icons/react";
import { candidateImportRowSchema, emailSchema } from "@np/shared";
import { ImportDialog } from "@/components/data/ImportDialog";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { textareaCls } from "@/components/form/FormField";
import { Panel } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { api, apiErrorMessage } from "@/lib/api-client";
import { toCsv } from "@/lib/csv";
import { fmtDateTime, fmtMarks, pct, saveText, type Enrollment, type ExamDetail } from "@/lib/exams";
import { initials } from "@/lib/utils";

export function AttemptStatus({ e }: { e: Pick<Enrollment, "status" | "pendingManual"> }) {
  if (!e.status) return <StatusBadge tone="neutral">Not started</StatusBadge>;
  if (e.status === "in_progress") return <StatusBadge tone="success">Writing</StatusBadge>;
  if (e.pendingManual) return <StatusBadge tone="warning">To grade</StatusBadge>;
  return <StatusBadge tone="info">{e.status === "expired" ? "Time ran out" : "Submitted"}</StatusBadge>;
}

/** "sana.malik22@x.edu" -> "Sana Malik": a readable default name for an account created from an email. */
function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? email;
  const words = local.replace(/\d+/g, " ").split(/[._+\s-]+/).filter(Boolean);
  const name = words.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(" ").trim();
  return (name || local).slice(0, 100);
}

export function CandidatesTab({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const [emails, setEmails] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [removing, setRemoving] = useState<Enrollment | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [issued, setIssued] = useState<{ email: string; fullName: string; password: string }[]>([]);
  const list = useQuery({ queryKey: ["exam", exam.id, "enrollments"], queryFn: () => api<Enrollment[]>(`/exams/${exam.id}/enrollments`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["exam", exam.id, "enrollments"] });
    qc.invalidateQueries({ queryKey: ["exams"] });
  };

  const enroll = useMutation({
    mutationFn: (list: string[]) => api<{ added: number; alreadyEnrolled: number; notFound: string[] }>(`/exams/${exam.id}/enrollments`, { method: "POST", json: { emails: list } }),
    onSuccess: (r) => {
      refresh();
      setEmails("");
      setMissing(r.notFound);
      if (r.added || r.alreadyEnrolled) toast.success(`${r.added} enrolled${r.alreadyEnrolled ? ` · ${r.alreadyEnrolled} already enrolled` : ""}`);
    },
    onError: (err) => setEmailError(apiErrorMessage(err)),
  });

  /** Unknown addresses: create candidate accounts (one-time passwords shown once) and enrol them in one step. */
  const createAndEnroll = useMutation({
    mutationFn: (list: string[]) =>
      api<{ created: number; errors: { row: number; message: string }[]; credentials: { email: string; fullName: string; password: string }[]; enrolled: { added: number; notFound: string[] } | null }>("/users/import", {
        method: "POST",
        json: { rows: list.map((email) => ({ fullName: nameFromEmail(email), email })), examId: exam.id },
      }),
    onSuccess: (r) => {
      refresh();
      setIssued(r.credentials);
      const stillMissing = r.enrolled?.notFound ?? [];
      setMissing([]);
      if (stillMissing.length) setEmailError(`These addresses belong to accounts that aren't active candidates (e.g. an examiner or a deactivated account): ${stillMissing.join(", ")}`);
      toast.success(`${r.created} account${r.created === 1 ? "" : "s"} created · ${r.enrolled?.added ?? 0} enrolled`);
    },
    onError: (err) => setEmailError(apiErrorMessage(err)),
  });

  const submitEmails = () => {
    setEmailError(null);
    setMissing([]);
    const parts = [...new Set(emails.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
    if (!parts.length) return setEmailError("Add at least one email.");
    const bad = parts.filter((p) => !emailSchema.safeParse(p).success);
    if (bad.length) return setEmailError(`Not valid email addresses: ${bad.join(", ")}`);
    enroll.mutate(parts);
  };

  const rows = list.data ?? [];
  const started = rows.filter((r) => r.status).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel
        title={`Enrolled · ${rows.length}`}
        description={rows.length ? `${started} started · ${rows.length - started} not started` : undefined}
        action={
          rows.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => saveText(toCsv(["name", "email", "status", "score", "max"], rows.map((r) => [r.fullName, r.email, r.status ?? "not started", r.score ?? "", r.maxScore ?? ""])), `${exam.title.replace(/[^\w]+/g, "-")}-candidates.csv`)}
            >
              <DownloadSimple /> CSV
            </Button>
          )
        }
        bodyClassName="p-0"
      >
        {list.isLoading ? (
          <LoadingRows rows={5} className="p-4" />
        ) : list.error ? (
          <ErrorState onRetry={() => list.refetch()} className="m-4" />
        ) : !rows.length ? (
          <EmptyState className="m-4 border-dashed shadow-none" title="Nobody is enrolled yet" description="Add existing candidates by email, or import a file to create their accounts and enrol them in one step." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.candidateId} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground-soft">{initials(r.fullName, r.email)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                </span>
                <span className="hidden text-end text-xs text-muted-foreground sm:block">
                  {r.submittedAt ? `Submitted ${fmtDateTime(r.submittedAt)}` : r.status === "in_progress" ? "In progress" : `Enrolled ${fmtDateTime(r.enrolledAt)}`}
                </span>
                {r.score != null && r.status !== "in_progress" && (
                  <Link href={`/app/results/view?attempt=${r.attemptId}`} className="w-16 text-end text-sm font-semibold tabular-nums hover:underline">
                    {pct(r.score, r.maxScore)}%<span className="block text-xs font-normal text-muted-foreground">{fmtMarks(r.score)}/{fmtMarks(r.maxScore)}</span>
                  </Link>
                )}
                <AttemptStatus e={r} />
                {!r.status && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.fullName}`} onClick={() => setRemoving(r)}>
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="space-y-6">
        <Panel title="Enrol by email" description="One per line, or separated by commas. Anyone without an account can be given one here.">
          <label htmlFor="enrol-emails" className="sr-only">Candidate emails</label>
          <textarea
            id="enrol-emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={5}
            className={textareaCls}
            placeholder={"sana.malik@student.nullpointers.dev\nali.raza@student.nullpointers.dev"}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "enrol-err" : undefined}
          />
          {emailError && <p id="enrol-err" role="alert" className="mt-2 text-[0.8125rem] font-medium text-danger">{emailError}</p>}
          {missing.length > 0 && (
            <div className="mt-3 rounded-xl border border-warning/30 bg-warning-soft/60 p-3 text-[0.8125rem] animate-[rise_240ms_var(--ease-out)_backwards]" role="status">
              <p className="font-medium text-foreground">No candidate account yet for:</p>
              <ul className="mt-1 space-y-0.5 break-all text-foreground-soft">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => createAndEnroll.mutate(missing)} disabled={createAndEnroll.isPending}>
                  <UserPlus /> {createAndEnroll.isPending ? "Creating…" : `Create account${missing.length > 1 ? "s" : ""} and enrol`}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMissing([])}>Not now</Button>
              </div>
            </div>
          )}
          {issued.length > 0 && (
            <div className="mt-3 rounded-xl border border-success/30 bg-success-soft/60 p-3 text-[0.8125rem] animate-[rise_240ms_var(--ease-out)_backwards]" role="status">
              <p className="font-medium text-foreground">Accounts created. Share each password privately - it is shown only now.</p>
              <ul className="mt-2 space-y-1.5">
                {issued.map((c) => (
                  <li key={c.email} className="rounded-lg bg-surface px-2.5 py-1.5">
                    <span className="block break-all text-foreground-soft">{c.email}</span>
                    <span className="font-mono font-medium tracking-wide">{c.password}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => saveText(toCsv(["fullName", "email", "password"], issued.map((c) => [c.fullName, c.email, c.password])), "candidate-credentials.csv")}>
                  <DownloadSimple /> Download CSV
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIssued([])}>Done</Button>
              </div>
            </div>
          )}
          <Button className="mt-3 w-full" onClick={submitEmails} disabled={enroll.isPending}>
            <UserPlus /> {enroll.isPending ? "Enrolling…" : "Enrol"}
          </Button>
        </Panel>
        <Panel title="Import from a file" description="CSV or JSON with fullName and email. New accounts are created with a one-time password you can download.">
          <Button variant="outline" className="w-full" onClick={() => setImportOpen(true)}>
            <FileArrowUp /> Import candidates
          </Button>
        </Panel>
      </div>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.fullName}?`}
        description="They won't see this exam any more. Their account is kept."
        confirmLabel="Remove"
        onConfirm={async () => {
          try {
            await api(`/exams/${exam.id}/enrollments/${removing!.candidateId}`, { method: "DELETE" });
            refresh();
            toast.success("Removed from this exam");
          } catch (err) {
            toast.error(apiErrorMessage(err));
            throw err;
          }
        }}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import candidates"
        description="Columns: fullName, email. Existing accounts are reused; everyone in the file is enrolled in this exam."
        schema={candidateImportRowSchema}
        normalize={(r) => ({ fullName: String(r.fullName ?? r.fullname ?? r.name ?? r.full_name ?? "").trim(), email: String(r.email ?? "").trim().toLowerCase() })}
        columns={[{ key: "fullName", label: "Name" }, { key: "email", label: "Email" }]}
        template={{ filename: "candidates-template.csv", text: toCsv(["fullName", "email"], [["Ayan Shah", "ayan.shah@student.example.edu"], ["Hira Javed", "hira.javed@student.example.edu"]]) }}
        onImport={async (rows) => {
          const res = await api<{ created: number; skipped: number; errors: { row: number; message: string }[]; credentials: { email: string; fullName: string; password: string }[]; enrolled: { added: number } | null }>(
            "/users/import",
            { method: "POST", json: { rows, examId: exam.id } },
          );
          refresh();
          return {
            summary: (
              <div className="space-y-2">
                <p><b>{res.created}</b> new account{res.created === 1 ? "" : "s"} created, <b>{res.skipped}</b> existing reused, <b>{res.enrolled?.added ?? 0}</b> newly enrolled.</p>
                {res.credentials.length > 0 && (
                  <>
                    <p className="text-muted-foreground">One-time passwords are shown only now. Download them and share each privately.</p>
                    <Button size="sm" variant="outline" onClick={() => saveText(toCsv(["fullName", "email", "password"], res.credentials.map((c) => [c.fullName, c.email, c.password])), "candidate-credentials.csv")}>
                      <DownloadSimple /> Download credentials
                    </Button>
                  </>
                )}
              </div>
            ),
            errors: res.errors,
          };
        }}
      />
    </div>
  );
}
