"use client";

import { useEffect } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash, X } from "@phosphor-icons/react";
import type { z } from "zod";
import { DIFFICULTIES, questionInputSchema, TYPE_LABEL, type QuestionType } from "@np/shared";
import { FormField, Segmented, inputCls, textareaCls } from "@/components/form/FormField";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { api, apiErrorMessage, applyFieldErrors } from "@/lib/api-client";
import { DIFF_LABEL, type Question } from "@/lib/exams";
import { cn } from "@/lib/utils";

type FormIn = z.input<typeof questionInputSchema>;
type FormOut = z.output<typeof questionInputSchema>;
const LETTERS = "abcdefgh";

const blank = (): FormIn => ({
  topic: "",
  difficulty: "medium",
  type: "single",
  prompt: "",
  options: [
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ],
  correct: [],
  marks: 2,
  scheme: "exact",
  explanation: "",
});

/**
 * Create or edit a question. The same Zod schema the API uses validates here, so "mark exactly one correct
 * option" or "two options have the same text" show up before the request is even sent.
 */
export function QuestionEditor({
  open,
  onOpenChange,
  question,
  topics,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  question: Question | null;
  topics: string[];
  onDelete?: (q: Question) => void;
}) {
  const qc = useQueryClient();
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(questionInputSchema), mode: "onTouched", defaultValues: blank() });
  const { register, control, handleSubmit, reset, setValue, setError, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "options", keyName: "_key" });
  const type = useWatch({ control, name: "type" }) as QuestionType;
  const correct = (useWatch({ control, name: "correct" }) ?? []) as string[];

  useEffect(() => {
    if (!open) return;
    reset(
      question
        ? { topic: question.topic, difficulty: question.difficulty, type: question.type, prompt: question.prompt, options: question.options.length ? question.options : blank().options, correct: question.correct, marks: question.marks, scheme: question.scheme, explanation: question.explanation ?? "" }
        : blank(),
    );
  }, [open, question, reset]);

  const save = useMutation({
    mutationFn: (v: FormOut) => {
      const body = v.type === "written" ? { ...v, options: [], correct: [] } : v;
      return question ? api<Question>(`/questions/${question.id}`, { method: "PUT", json: body }) : api<Question>("/questions", { method: "POST", json: body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questions"] });
      toast.success(question ? "Question updated" : "Question added to the bank");
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyFieldErrors(err, setError)) toast.error(apiErrorMessage(err));
    },
  });

  const toggleCorrect = (id: string) => {
    const next = type === "single" ? [id] : correct.includes(id) ? correct.filter((c) => c !== id) : [...correct, id];
    setValue("correct", next, { shouldValidate: formState.isSubmitted, shouldDirty: true });
  };

  const err = formState.errors;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      className="sm:w-[min(40rem,100%)]"
      title={question ? `Edit question #${question.id}` : "New question"}
      description="Changes never affect attempts already in progress: each paper is a snapshot taken when the candidate starts."
      footer={
        <>
          {question && onDelete && (
            <Button type="button" variant="destructive-soft" className="sm:me-auto" onClick={() => onDelete(question)}>
              <Trash /> Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="question-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : question ? "Save changes" : "Add question"}
          </Button>
        </>
      }
    >
      <form id="question-form" noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-5">
        <FormField label="Question type">
          {() => (
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Segmented
                  label="Question type"
                  value={field.value as QuestionType}
                  onChange={(v) => {
                    field.onChange(v);
                    if (v === "single" && correct.length > 1) setValue("correct", correct.slice(0, 1));
                  }}
                  options={(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
                  className="w-full"
                />
              )}
            />
          )}
        </FormField>

        <FormField label="Question" required error={err.prompt?.message}>
          {(p) => <textarea {...p} {...register("prompt")} rows={3} className={textareaCls} placeholder="What does the A in ACID stand for?" />}
        </FormField>

        {type !== "written" && (
          <fieldset className="space-y-2.5">
            <legend className="mb-1.5 text-sm font-medium">
              Options <span className="font-normal text-muted-foreground">· {type === "single" ? "select the one correct answer" : "select every correct answer"}</span>
            </legend>
            <ul className="space-y-2">
              {fields.map((f, i) => {
                const id = f.id;
                const on = correct.includes(id);
                return (
                  <li key={f._key} className="flex items-center gap-2 animate-[rise_220ms_var(--ease-out)_backwards]">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(id)}
                      aria-pressed={on}
                      aria-label={`Mark option ${LETTERS[i]?.toUpperCase()} as correct`}
                      className={cn(
                        "grid size-11 shrink-0 place-items-center border-2 text-sm font-semibold uppercase transition-all duration-200 pointer-fine:size-10",
                        type === "single" ? "rounded-full" : "rounded-lg",
                        on ? "border-success bg-success text-white shadow-[0_0_0_3px_color-mix(in_oklch,var(--success)_18%,transparent)]" : "border-control-border text-muted-foreground hover:border-success/60",
                      )}
                    >
                      {LETTERS[i]}
                    </button>
                    <input {...register(`options.${i}.text`)} aria-label={`Option ${LETTERS[i]?.toUpperCase()}`} aria-invalid={err.options?.[i]?.text ? true : undefined} className={inputCls} placeholder={`Option ${LETTERS[i]?.toUpperCase()}`} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove option ${LETTERS[i]?.toUpperCase()}`}
                      disabled={fields.length <= 2}
                      onClick={() => {
                        setValue("correct", correct.filter((c) => c !== id));
                        remove(i);
                      }}
                    >
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ul>
            {(err.options?.message || err.options?.root?.message || err.correct?.message) && (
              <p role="alert" className="text-[0.8125rem] font-medium text-danger">{err.options?.message ?? err.options?.root?.message ?? err.correct?.message}</p>
            )}
            {fields.length < 8 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const used = new Set((form.getValues("options") ?? []).map((o) => o.id));
                  const id = [...LETTERS].find((l) => !used.has(l)) ?? `o${fields.length}`;
                  append({ id, text: "" });
                }}
              >
                <Plus /> Add option
              </Button>
            )}
          </fieldset>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Topic" required error={err.topic?.message}>
            {(p) => (
              <>
                <input {...p} {...register("topic")} list="topic-list" className={inputCls} placeholder="Transactions" autoComplete="off" />
                <datalist id="topic-list">{topics.map((t) => <option key={t} value={t} />)}</datalist>
              </>
            )}
          </FormField>
          <FormField label="Difficulty" error={err.difficulty?.message}>
            {(p) => (
              <NativeSelect {...p} {...register("difficulty")}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
              </NativeSelect>
            )}
          </FormField>
          <FormField label="Marks" required error={err.marks?.message}>
            {(p) => <input {...p} {...register("marks")} type="number" inputMode="decimal" step="0.5" min="0.5" className={inputCls} />}
          </FormField>
          {type === "multiple" && (
            <FormField label="Marking rule" hint="Shown to candidates on the question.">
              {(p) => (
                <NativeSelect {...p} {...register("scheme")}>
                  <option value="exact">All or nothing</option>
                  <option value="partial">Partial credit (right minus wrong)</option>
                </NativeSelect>
              )}
            </FormField>
          )}
        </div>

        <FormField label="Explanation" hint="Optional. For examiners only - never shown during the exam.">
          {(p) => <textarea {...p} {...register("explanation")} rows={2} className={textareaCls} />}
        </FormField>
      </form>
    </Sheet>
  );
}
