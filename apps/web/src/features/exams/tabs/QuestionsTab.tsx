"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Lock, MagnifyingGlass, Minus, Plus } from "@phosphor-icons/react";
import { DIFFICULTIES, type Difficulty } from "@np/shared";
import { inputCls } from "@/components/form/FormField";
import { Panel } from "@/components/layout/Panel";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { api, apiErrorMessage } from "@/lib/api-client";
import { DIFF_LABEL, fmtMarks, type ExamDetail, type Question, type QuestionPage } from "@/lib/exams";
import { cn } from "@/lib/utils";
import { DifficultyPill, TYPE_ICON } from "@/features/questions/QuestionBankPage";

/** Mirrors the API's publish check, so the examiner sees the paper value change as they pick questions. */
function paperSummary(exam: ExamDetail, pool: Question[]) {
  const plan = { easy: exam.drawEasy, medium: exam.drawMedium, hard: exam.drawHard };
  const stratified = Object.values(plan).some((v) => v !== null);
  return DIFFICULTIES.map((level) => {
    const inLevel = pool.filter((q) => q.difficulty === level);
    const draw = stratified ? (plan[level] ?? 0) : inLevel.length;
    const marks = [...new Set(inLevel.map((q) => q.marks))];
    const subset = stratified && draw > 0 && draw < inLevel.length;
    return {
      level,
      have: inLevel.length,
      draw,
      short: draw > inLevel.length,
      mixed: subset && marks.length > 1,
      marks: inLevel.slice(0, Math.min(draw, inLevel.length)).reduce((s, q) => s + q.marks, 0),
    };
  });
}

export function QuestionsTab({ exam }: { exam: ExamDetail }) {
  const qc = useQueryClient();
  const draft = exam.status === "draft";
  const [pool, setPool] = useState<Question[]>(exam.pool);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [difficulty, setDifficulty] = useState("");
  useEffect(() => setPool(exam.pool), [exam.pool]);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const bank = useQuery({
    queryKey: ["questions", "picker", debounced, difficulty],
    queryFn: () => api<QuestionPage>(`/questions?pageSize=50${debounced ? `&q=${encodeURIComponent(debounced)}` : ""}${difficulty ? `&difficulty=${difficulty}` : ""}`),
    placeholderData: keepPreviousData,
    enabled: draft,
  });

  const ids = useMemo(() => new Set(pool.map((q) => q.id)), [pool]);
  const dirty = pool.length !== exam.pool.length || pool.some((q, i) => exam.pool[i]?.id !== q.id);
  const summary = paperSummary(exam, pool);
  const paperMarks = summary.reduce((s, l) => s + l.marks, 0);
  const balanced = Math.abs(paperMarks - exam.totalMarks) < 0.001 && !summary.some((l) => l.short || l.mixed);

  const save = useMutation({
    mutationFn: () => api<ExamDetail>(`/exams/${exam.id}/questions`, { method: "PUT", json: { questionIds: pool.map((q) => q.id) } }),
    onSuccess: (fresh) => {
      qc.setQueryData(["exam", exam.id], fresh);
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Question pool saved");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const toggle = (q: Question) => setPool((p) => (ids.has(q.id) ? p.filter((x) => x.id !== q.id) : [...p, q]));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title={`Paper pool · ${pool.length} question${pool.length === 1 ? "" : "s"}`}
        description={draft ? "Every candidate's paper is drawn from this pool." : "Locked: the exam is published."}
        action={
          draft ? (
            <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>{save.isPending ? "Saving…" : dirty ? "Save pool" : "Saved"}</Button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Lock className="size-3.5" /> Locked</span>
          )
        }
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-3 border-b border-border">
          {summary.map((l) => (
            <div key={l.level} className={cn("border-e border-border px-4 py-3.5 last:border-e-0", (l.short || l.mixed) && "bg-danger-soft/50")}>
              <p className="text-xs font-medium text-muted-foreground">{DIFF_LABEL[l.level]}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {l.draw === l.have ? `${l.have} used` : `${l.draw} of ${l.have}`}
                <span className="font-normal text-muted-foreground"> · {fmtMarks(l.marks)}m</span>
              </p>
              {l.short && <p className="mt-1 text-xs text-danger">Need {l.draw - l.have} more</p>}
              {l.mixed && <p className="mt-1 text-xs text-danger">Marks must match</p>}
            </div>
          ))}
        </div>
        <div className={cn("flex items-center justify-between gap-3 px-5 py-3 text-sm", balanced ? "bg-success-soft/60" : "bg-warning-soft/60")}>
          <span className="flex items-center gap-2 font-medium">
            {balanced ? <Check weight="bold" className="size-4 text-success" /> : <Minus weight="bold" className="size-4 text-warning" />}
            Each paper: {fmtMarks(paperMarks)} of {fmtMarks(exam.totalMarks)} marks
          </span>
          {!balanced && draft && <Link href={`/app/exams/view?id=${exam.id}&tab=setup`} className="text-xs font-medium text-primary hover:underline">Adjust total or draw</Link>}
        </div>
        {pool.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">No questions yet. Pick some from your bank.</p>
        ) : (
          <ul className="max-h-[34rem] divide-y divide-border overflow-y-auto">
            {DIFFICULTIES.flatMap((d: Difficulty) => pool.filter((q) => q.difficulty === d)).map((q) => {
              const Icon = TYPE_ICON[q.type];
              return (
                <li key={q.id} className="flex items-start gap-3 px-5 py-3.5 animate-[rise_240ms_var(--ease-out)_backwards]">
                  <Icon weight="duotone" className="mt-0.5 size-[1.125rem] shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-snug">{q.prompt}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><DifficultyPill d={q.difficulty} /> {q.topic} · {q.marks} marks</p>
                  </div>
                  {draft && (
                    <Button variant="ghost" size="icon-sm" aria-label="Remove from pool" onClick={() => toggle(q)}>
                      <Minus />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {draft && (
        <Panel title="Your question bank" action={<Link href="/app/questions?new=1" className="text-sm font-medium text-primary hover:underline">New question</Link>} bodyClassName="p-0">
          <div className="flex gap-2 border-b border-border p-3">
            <label className="relative flex-1">
              <span className="sr-only">Search the bank</span>
              <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions or topics" className={cn(inputCls, "ps-9")} />
            </label>
            <NativeSelect aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-36">
              <option value="">Any level</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
            </NativeSelect>
          </div>
          {bank.isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : !bank.data?.items.length ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">No questions match.</p>
          ) : (
            <ul className="max-h-[38rem] divide-y divide-border overflow-y-auto">
              {bank.data.items.map((q) => {
                const on = ids.has(q.id);
                return (
                  <li key={q.id}>
                    <button type="button" onClick={() => toggle(q)} aria-pressed={on} className={cn("flex w-full items-start gap-3 px-5 py-3.5 text-start transition-colors", on ? "bg-brand-softer" : "hover:bg-muted/50")}>
                      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-all duration-200", on ? "border-primary bg-primary text-primary-foreground" : "border-control-border")}>
                        {on ? <Check weight="bold" className="size-3.5" /> : <Plus weight="bold" className="size-3 text-muted-foreground" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm leading-snug">{q.prompt}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><DifficultyPill d={q.difficulty} /> {q.topic} · {q.marks} marks</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
