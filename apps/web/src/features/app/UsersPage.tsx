"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DownloadSimple, FileArrowUp, Key, UserPlus } from "@phosphor-icons/react";
import { candidateImportRowSchema, createUserSchema, ROLES, type AuthUser, type CreateUserInput, type Page } from "@np/shared";
import { ImportDialog } from "@/components/data/ImportDialog";
import { Pagination } from "@/components/data/Pagination";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { ErrorState, LoadingRows } from "@/components/feedback/States";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { FormField, Segmented, inputCls } from "@/components/form/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet } from "@/components/ui/sheet";
import { api, apiErrorMessage, applyFieldErrors } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { toCsv } from "@/lib/csv";
import { saveText } from "@/lib/exams";
import { initials } from "@/lib/utils";

type UserRow = Omit<AuthUser, "permissions"> & { createdAt?: string };
const PAGE_SIZE = 15;
const ROLE_LABEL: Record<string, string> = { admin: "Administrator", examiner: "Examiner", candidate: "Candidate" };

function genPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => a[b % a.length]).join("") + "7a";
}

/** Administration: accounts, roles and access. Every change is enforced and audited by the API. */
export function UsersPage() {
  const { user: me, can } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<"all" | (typeof ROLES)[number]>("all");
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toggling, setToggling] = useState<UserRow | null>(null);
  const canManage = can("users:manage");

  const list = useQuery({
    queryKey: ["users", page, role],
    queryFn: () => api<Page<UserRow>>(`/users?page=${page}&pageSize=${PAGE_SIZE}${role !== "all" ? `&role=${role}` : ""}`),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; roles?: string[]; isActive?: boolean }) => api<UserRow>(`/users/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Saved. The change applies to their next request.");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Accounts and roles. Deactivating someone signs them out everywhere, immediately; their exam records are kept."
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}><FileArrowUp /> Import candidates</Button>
              <Button onClick={() => setCreating(true)}><UserPlus /> Add person</Button>
            </>
          )
        }
      />

      <Segmented
        label="Role"
        size="sm"
        value={role}
        onChange={(v) => {
          setRole(v);
          setPage(1);
        }}
        options={[{ value: "all", label: "Everyone" }, { value: "admin", label: "Admins" }, { value: "examiner", label: "Examiners" }, { value: "candidate", label: "Candidates" }]}
      />

      {list.isLoading ? (
        <LoadingRows rows={6} />
      ) : list.error ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-xs">
            {(list.data?.items ?? []).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink">{initials(u.fullName, u.email)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.fullName}{u.id === me?.id && <span className="ms-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                </span>
                {u.isActive ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge tone="danger">Deactivated</StatusBadge>}
                {canManage && u.id !== me?.id ? (
                  <>
                    <NativeSelect aria-label={`Role for ${u.fullName}`} value={u.roles[0] ?? "candidate"} onChange={(e) => update.mutate({ id: u.id, roles: [e.target.value] })} className="w-40">
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </NativeSelect>
                    <Button variant={u.isActive ? "ghost" : "outline"} size="sm" onClick={() => setToggling(u)}>{u.isActive ? "Deactivate" : "Reactivate"}</Button>
                  </>
                ) : (
                  <span className="w-40 text-sm text-muted-foreground">{u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data?.total ?? 0} onPageChange={setPage} />
        </div>
      )}

      <CreateUser open={creating} onOpenChange={setCreating} onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })} />

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        destructive={!!toggling?.isActive}
        title={toggling?.isActive ? `Deactivate ${toggling?.fullName}?` : `Reactivate ${toggling?.fullName}?`}
        description={toggling?.isActive ? "They are signed out on every device right away and can't sign in until reactivated. Their exams and results stay." : "They can sign in again with their existing password."}
        confirmLabel={toggling?.isActive ? "Deactivate" : "Reactivate"}
        onConfirm={() => update.mutateAsync({ id: toggling!.id, isActive: !toggling!.isActive }).then(() => undefined)}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import candidates"
        description="Columns: fullName, email. Existing accounts are skipped; new ones get a one-time password you can download."
        schema={candidateImportRowSchema}
        normalize={(r) => ({ fullName: String(r.fullName ?? r.fullname ?? r.name ?? r.full_name ?? "").trim(), email: String(r.email ?? "").trim().toLowerCase() })}
        columns={[{ key: "fullName", label: "Name" }, { key: "email", label: "Email" }]}
        template={{ filename: "candidates-template.csv", text: toCsv(["fullName", "email"], [["Ayan Shah", "ayan.shah@student.example.edu"]]) }}
        onImport={async (rows) => {
          const res = await api<{ created: number; skipped: number; errors: { row: number; message: string }[]; credentials: { email: string; fullName: string; password: string }[] }>("/users/import", { method: "POST", json: { rows } });
          qc.invalidateQueries({ queryKey: ["users"] });
          return {
            summary: (
              <div className="space-y-2">
                <p><b>{res.created}</b> account{res.created === 1 ? "" : "s"} created, <b>{res.skipped}</b> already existed.</p>
                {res.credentials.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => saveText(toCsv(["fullName", "email", "password"], res.credentials.map((c) => [c.fullName, c.email, c.password])), "candidate-credentials.csv")}>
                    <DownloadSimple /> Download one-time passwords
                  </Button>
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

function CreateUser({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const form = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema), mode: "onTouched", defaultValues: { fullName: "", email: "", password: "", role: "candidate" } });
  const err = form.formState.errors;
  const save = useMutation({
    mutationFn: (v: CreateUserInput) => api("/users", { method: "POST", json: v }),
    onSuccess: (_r, v) => {
      toast.success(`${v.fullName} can sign in now`);
      form.reset({ fullName: "", email: "", password: "", role: v.role });
      onCreated();
      onOpenChange(false);
    },
    onError: (e) => {
      if (!applyFieldErrors(e, form.setError)) toast.error(apiErrorMessage(e));
    },
  });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add a person"
      description="Share the password with them privately; they can sign in straight away."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="create-user" disabled={save.isPending}>{save.isPending ? "Adding…" : "Add person"}</Button>
        </>
      }
    >
      <form id="create-user" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5">
        <FormField label="Full name" required error={err.fullName?.message}>{(p) => <input {...p} {...form.register("fullName")} className={inputCls} autoComplete="off" />}</FormField>
        <FormField label="Email" required error={err.email?.message}>{(p) => <input {...p} {...form.register("email")} type="email" className={inputCls} autoComplete="off" />}</FormField>
        <FormField label="Role" required error={err.role?.message}>
          {(p) => (
            <NativeSelect {...p} {...form.register("role")}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </NativeSelect>
          )}
        </FormField>
        <FormField label="Password" required error={err.password?.message} hint="At least 8 characters with a letter and a number.">
          {(p) => (
            <div className="flex gap-2">
              <input {...p} {...form.register("password")} type="text" className={`${inputCls} font-mono`} autoComplete="new-password" />
              <Button type="button" variant="outline" onClick={() => form.setValue("password", genPassword(), { shouldValidate: true })}><Key /> Generate</Button>
            </div>
          )}
        </FormField>
      </form>
    </Sheet>
  );
}
