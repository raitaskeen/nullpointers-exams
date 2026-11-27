"use client";

import { useEffect } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { examInputSchema } from "@np/shared";
import { FormField, inputCls, textareaCls } from "@/components/form/FormField";
import { applyFieldErrors } from "@/lib/api-client";
import type { ExamRow } from "@/lib/exams";
import { cn } from "@/lib/utils";

type In = z.input<typeof examInputSchema>;
export type ExamFormValues = z.output<typeof examInputSchema>;

/** ISO -> value for <input type="datetime-local"> in the viewer's own timezone. */
export function toLocalInput(iso: string | Date) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaults(exam?: ExamRow | null): In {
  if (exam) {
    return {
      title: exam.title,
      instructions: exam.instructions,
      startsAt: toLocalInput(exam.startsAt),
      endsAt: toLocalInput(exam.endsAt),
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      passPercent: exam.passPercent,
      shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      blockCopyPaste: exam.blockCopyPaste,
      drawEasy: exam.drawEasy ?? "",
      drawMedium: exam.drawMedium ?? "",
      drawHard: exam.drawHard ?? "",
    } as In;
  }
  const start = new Date(Date.now() + 60 * 60_000);
  start.setMinutes(0, 0, 0);
  return {
    title: "",
    instructions: "",
    startsAt: toLocalInput(start),
    endsAt: toLocalInput(new Date(start.getTime() + 3 * 60 * 60_000)),
    durationMinutes: 60,
    totalMarks: 20,
    passPercent: 50,
    shuffleQuestions: true,
    shuffleOptions: true,
    blockCopyPaste: true,
    drawEasy: "",
    drawMedium: "",
    drawHard: "",
  } as In;
}

function Toggle({ label, hint, registration }: { label: string; hint: string; registration: UseFormRegisterReturn }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-sunken/60">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[0.8125rem] text-muted-foreground">{hint}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" {...registration} className="peer sr-only" />
        <span className="h-6 w-10 rounded-full bg-muted-foreground/30 shadow-[inset_0_1px_2px_oklch(0_0_0/0.15)] transition-colors duration-300 peer-checked:bg-success peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/35" />
        <span className="absolute top-0.5 start-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_oklch(0_0_0/0.25)] transition-transform duration-300 ease-[var(--ease-out)] peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

/**
 * Exam settings. Validated by the shared schema (end after start, duration fits the window...), and the same
 * schema re-validates on the API, whose field errors land under the same inputs.
 */
export function ExamForm({
  id,
  exam,
  disabled,
  onSubmit,
}: {
  id: string;
  exam?: ExamRow | null;
  disabled?: boolean;
  onSubmit: (values: ExamFormValues, setFieldErrors: (err: unknown) => boolean) => void | Promise<void>;
}) {
  const form = useForm<In, unknown, ExamFormValues>({ resolver: zodResolver(examInputSchema), mode: "onTouched", defaultValues: defaults(exam) });
  const { register, handleSubmit, reset, setError, control, formState } = form;
  const err = formState.errors;

  useEffect(() => {
    reset(defaults(exam));
  }, [exam, reset]);

  const [start, end, duration] = useWatch({ control, name: ["startsAt", "endsAt", "durationMinutes"] }) as [string, string, number];
  const windowMin = Math.round((Date.parse(end) - Date.parse(start)) / 60000);

  return (
    <form id={id} noValidate onSubmit={handleSubmit((v) => onSubmit(v, (e) => applyFieldErrors(e, setError)))}>
      <fieldset disabled={disabled} className="space-y-6 disabled:opacity-80">
        <FormField label="Title" required error={err.title?.message}>
          {(p) => <input {...p} {...register("title")} className={inputCls} placeholder="CS-301 Databases · Quiz 4" />}
        </FormField>
        <FormField label="Instructions" hint="Shown to candidates before they start, and inside the exam." error={err.instructions?.message}>
          {(p) => <textarea {...p} {...register("instructions")} rows={4} className={textareaCls} placeholder="Answer every question. Written answers are marked by hand." />}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Opens" required error={err.startsAt?.message}>
            {(p) => <input {...p} {...register("startsAt")} type="datetime-local" className={inputCls} />}
          </FormField>
          <FormField label="Closes" required error={err.endsAt?.message}>
            {(p) => <input {...p} {...register("endsAt")} type="datetime-local" className={inputCls} />}
          </FormField>
          <FormField
            label="Duration per attempt (minutes)"
            required
            error={err.durationMinutes?.message}
            hint={Number.isFinite(windowMin) && windowMin > 0 ? `The window is ${windowMin} min. Late starters get until it closes.` : undefined}
          >
            {(p) => <input {...p} {...register("durationMinutes")} type="number" inputMode="numeric" min={1} className={inputCls} />}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Total marks" required error={err.totalMarks?.message}>
              {(p) => <input {...p} {...register("totalMarks")} type="number" inputMode="decimal" step="0.5" className={inputCls} />}
            </FormField>
            <FormField label="Pass mark %" error={err.passPercent?.message}>
              {(p) => <input {...p} {...register("passPercent")} type="number" inputMode="numeric" min={0} max={100} className={inputCls} />}
            </FormField>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Fair random draw <span className="font-normal text-muted-foreground">· optional</span></p>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Questions drawn per difficulty for every paper. Leave all empty to give everyone the whole pool.</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {(["drawEasy", "drawMedium", "drawHard"] as const).map((k, i) => (
              <FormField key={k} label={["Easy", "Medium", "Hard"][i]} error={err[k]?.message}>
                {(p) => <input {...p} {...register(k)} type="number" inputMode="numeric" min={0} placeholder="All" className={cn(inputCls, "tabular-nums")} />}
              </FormField>
            ))}
          </div>
        </div>

        <div className="grid gap-2.5">
          <Toggle label="Shuffle question order" hint="Each candidate sees the questions in a different order." registration={register("shuffleQuestions")} />
          <Toggle label="Shuffle answer options" hint="Option order varies per candidate; marking follows the option, not its position." registration={register("shuffleOptions")} />
          <Toggle label="Discourage copy and paste" hint="Blocks clipboard in the workspace and records attempts as signals." registration={register("blockCopyPaste")} />
        </div>
        {Number.isFinite(duration) && duration > 0 && windowMin > 0 && duration > windowMin && (
          <p className="text-[0.8125rem] text-danger">Duration is longer than the window.</p>
        )}
      </fieldset>
    </form>
  );
}
