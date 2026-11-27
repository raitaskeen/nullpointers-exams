"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Books, CheckSquare, FileArrowUp, MagnifyingGlass, PencilSimpleLine, Plus, RadioButton, TextAlignLeft } from "@phosphor-icons/react";
import { z } from "zod";
import { DIFFICULTIES, QUESTION_TYPES, TYPE_LABEL, questionImportRowSchema, questionInputSchema, type QuestionType } from "@np/shared";
import { ImportDialog } from "@/components/data/ImportDialog";
import { Pagination } from "@/components/data/Pagination";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { inputCls } from "@/components/form/FormField";
import { api, apiErrorMessage } from "@/lib/api-client";
import { toCsv } from "@/lib/csv";
import { DIFF_LABEL, type Question, type QuestionPage } from "@/lib/exams";
import { cn } from "@/lib/utils";
import { QuestionEditor } from "./QuestionEditor";

const PAGE_SIZE = 15;
const LETTERS = "abcdefgh";
export const TYPE_ICON: Record<QuestionType, typeof RadioButton> = { single: RadioButton, multiple: CheckSquare, written: TextAlignLeft };

export function DifficultyPill({ d }: { d: "easy" | "medium" | "hard" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium",
        d === "easy" && "bg-success-soft text-success",
        d === "medium" && "bg-warning-soft text-warning",
        d === "hard" && "bg-danger-soft text-danger",
      )}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-2.5 w-1 rounded-full", i <= DIFFICULTIES.indexOf(d) ? "bg-current" : "bg-current/25")} />
        ))}
      </span>
      {DIFF_LABEL[d]}
    </span>
  );
}

/** Same conversion as the API's importer, so the preview shows exactly the errors the server would. */
const importSchema = questionImportRowSchema.transform((r, ctx) => {
  const options = r.options.split("|").map((s) => s.trim()).filter(Boolean).map((text, k) => ({ id: LETTERS[k] ?? `o${k}`, text }));
  const correct = r.correct.split("|").map((s) => s.trim()).filter(Boolean).map((s) => (/^\d+$/.test(s) ? LETTERS[Number(s) - 1] : s.toLowerCase())).filter((s): s is string => !!s);
  const full = questionInputSchema.safeParse({ ...r, options, correct, explanation: null });
  if (!full.success) {
    for (const issue of full.error.issues) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path as PropertyKey[] });
    return z.NEVER;
  }
  return full.data;
});

const normalizeRow = (r: Record<string, unknown>) => {
  const join = (v: unknown) => (Array.isArray(v) ? v.join("|") : v == null ? "" : String(v));
  return { topic: join(r.topic), difficulty: join(r.difficulty).toLowerCase(), type: join(r.type).toLowerCase(), prompt: join(r.prompt), options: join(r.options), correct: join(r.correct), marks: join(r.marks), scheme: join(r.scheme || "exact").toLowerCase() };
};

const TEMPLATE = toCsv(
  ["topic", "difficulty", "type", "prompt", "options", "correct", "marks", "scheme"],
  [
    ["SQL", "easy", "single", "Which clause filters groups after GROUP BY?", "WHERE|HAVING|ORDER BY|LIMIT", "2", 2, "exact"],
    ["Transactions", "medium", "multiple", "Which are SQL isolation levels?", "Read committed|Repeatable read|Serializable|Eventually consistent", "1|2|3", 3, "partial"],
    ["Transactions", "hard", "written", "Explain how a lost update happens and how to prevent it.", "", "", 5, "exact"],
  ],
);

export function QuestionBankPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();

  const page = Number(params.get("page")) || 1;
  const q = params.get("q") ?? "";
  const topic = params.get("topic") ?? "";
  const difficulty = params.get("difficulty") ?? "";
  const type = params.get("type") ?? "";
  const [search, setSearch] = useState(q);
  const [editing, setEditing] = useState<Question | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  useEffect(() => {
    const id = setTimeout(() => search !== q && setParams({ q: search || null }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (params.get("new")) {
      setEditing(null);
      setEditorOpen(true);
      setParams({ new: null });
    }
    if (params.get("import")) {
      setImportOpen(true);
      setParams({ import: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const query = useMemo(() => {
    const s = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) s.set("q", q);
    if (topic) s.set("topic", topic);
    if (difficulty) s.set("difficulty", difficulty);
    if (type) s.set("type", type);
    return s.toString();
  }, [page, q, topic, difficulty, type]);

  const list = useQuery({ queryKey: ["questions", query], queryFn: () => api<QuestionPage>(`/questions?${query}`), placeholderData: keepPreviousData });
  const topics = list.data?.topics ?? [];
  const filtered = !!(q || topic || difficulty || type);

  const open = (row: Question | null) => {
    setEditing(row);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question bank"
        description="Reusable questions you can pull into any exam. Editing a question never changes a paper a candidate has already started."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileArrowUp /> Import
            </Button>
            <Button onClick={() => open(null)}>
              <Plus weight="bold" /> New question
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by question or topic" className={cn(inputCls, "ps-9")} type="search" />
        </label>
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <NativeSelect aria-label="Topic" value={topic} onChange={(e) => setParams({ topic: e.target.value || null })} className="lg:w-44">
            <option value="">All topics</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Difficulty" value={difficulty} onChange={(e) => setParams({ difficulty: e.target.value || null })} className="lg:w-36">
            <option value="">Any difficulty</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Type" value={type} onChange={(e) => setParams({ type: e.target.value || null })} className="lg:w-40">
            <option value="">Any type</option>
            {QUESTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </NativeSelect>
        </div>
      </div>

      {list.isLoading ? (
        <LoadingRows rows={6} />
      ) : list.error ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : !list.data?.items.length ? (
        filtered ? (
          <EmptyState title="No questions match" description="Try another search or clear the filters." action={<Button variant="outline" onClick={() => { setSearch(""); router.replace(pathname); }}>Clear filters</Button>} />
        ) : (
          <EmptyState
            title="Your bank is empty"
            description="Add questions one by one, or import a CSV or JSON file with many at once."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}><FileArrowUp /> Import</Button>
                <Button onClick={() => open(null)}><Plus weight="bold" /> New question</Button>
              </div>
            }
          />
        )
      ) : (
        <div className={cn("space-y-4 transition-opacity", list.isFetching && !list.isLoading && "opacity-70")}>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-xs">
            {list.data.items.map((row, i) => {
              const Icon = TYPE_ICON[row.type];
              return (
                <li key={row.id} className="animate-[rise_320ms_var(--ease-out)_backwards]" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                  <button type="button" onClick={() => open(row)} className="group flex w-full items-start gap-4 px-4 py-4 text-start transition-colors hover:bg-muted/50 sm:px-5">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground-soft" title={TYPE_LABEL[row.type]}>
                      <Icon weight="duotone" className="size-[1.125rem]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[0.9375rem] leading-snug font-medium text-foreground">{row.prompt}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem] text-muted-foreground">
                        <span className="font-medium text-foreground-soft">{row.topic}</span>
                        <DifficultyPill d={row.difficulty} />
                        <span>{TYPE_LABEL[row.type]}{row.type === "multiple" ? ` · ${row.scheme === "partial" ? "partial credit" : "all or nothing"}` : ""}</span>
                        {row.type !== "written" && <span>{row.options.length} options</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block text-base font-semibold tabular-nums">{row.marks}</span>
                      <span className="text-xs text-muted-foreground">marks</span>
                    </span>
                    <PencilSimpleLine className="mt-1 hidden size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={(p) => setParams({ page: String(p) })} />
        </div>
      )}

      <QuestionEditor open={editorOpen} onOpenChange={setEditorOpen} question={editing} topics={topics} onDelete={(row) => setDeleting(row)} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this question?"
        description="It's removed from your bank. Questions that are part of an exam can't be deleted - remove them from the exam first."
        onConfirm={async () => {
          try {
            await api(`/questions/${deleting!.id}`, { method: "DELETE" });
            toast.success("Question deleted");
            setEditorOpen(false);
            qc.invalidateQueries({ queryKey: ["questions"] });
          } catch (err) {
            toast.error(apiErrorMessage(err));
            throw err;
          }
        }}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import questions"
        description={<>Columns: topic, difficulty, type, prompt, options (separated by |), correct (option numbers, separated by |), marks, scheme. JSON works too.</>}
        schema={importSchema}
        normalize={normalizeRow}
        columns={[{ key: "prompt", label: "Question" }, { key: "type", label: "Type" }, { key: "difficulty", label: "Difficulty" }, { key: "marks", label: "Marks" }]}
        template={{ filename: "questions-template.csv", text: TEMPLATE }}
        onImport={async (rows) => {
          const res = await api<{ created: number; skipped: number; errors: { row: number; message: string }[] }>("/questions/import", { method: "POST", json: { rows } });
          qc.invalidateQueries({ queryKey: ["questions"] });
          return { summary: <><b>{res.created}</b> question{res.created === 1 ? "" : "s"} added to your bank.{res.skipped ? ` ${res.skipped} skipped.` : ""}</>, errors: res.errors };
        }}
      />
    </div>
  );
}

export { Books };
