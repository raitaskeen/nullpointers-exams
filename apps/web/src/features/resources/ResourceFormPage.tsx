"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors, type Resolver, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotch as Loader2 } from "@phosphor-icons/react";
import { createSchema, updateSchema, type FieldDef, type ResourceDef } from "@np/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, LoadingRows } from "@/components/feedback/States";
import { apiErrorMessage, applyFieldErrors } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { humanize, toDateTimeLocal } from "./format";
import { useOptions, useResourceItem, useSaveResource, type Row } from "./hooks";

type Values = Record<string, unknown>;

function emptyValue(field: FieldDef): unknown {
  return field.type === "boolean" ? false : "";
}

function toFormValue(field: FieldDef, value: unknown): unknown {
  if (value === null || value === undefined) return emptyValue(field);
  if (field.type === "datetime") return toDateTimeLocal(value);
  if (field.type === "ref" || field.type === "int" || field.type === "number") return String(value);
  return value;
}

function RefSelect({ field, id, register, invalid }: { field: Extract<FieldDef, { type: "ref" }>; id: string; register: ReturnType<UseFormRegister<Values>>; invalid: boolean }) {
  const { data, isLoading } = useOptions(field.to);
  return (
    <NativeSelect id={id} aria-invalid={invalid} disabled={isLoading} {...register}>
      <option value="">{isLoading ? "Loading..." : `Choose ${field.label.toLowerCase()}`}</option>
      {data?.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function FieldInput({ name, field, register, errors }: { name: string; field: FieldDef; register: UseFormRegister<Values>; errors: FieldErrors<Values> }) {
  const id = `f-${name}`;
  const error = errors[name]?.message as string | undefined;
  const invalid = !!error;
  const reg = register(name);
  const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : undefined;
  const common = { id, "aria-invalid": invalid, "aria-describedby": describedBy };

  if (field.type === "boolean") {
    return (
      <Field orientation="horizontal" className="sm:col-span-2">
        <input type="checkbox" className="size-4 accent-primary" {...common} {...reg} />
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      </Field>
    );
  }

  let control;
  switch (field.type) {
    case "text":
      control = <Textarea rows={4} {...common} {...reg} />;
      break;
    case "enum":
      control = (
        <NativeSelect {...common} {...reg}>
          <option value="">Choose {field.label.toLowerCase()}</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {humanize(o)}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    case "ref":
      control = <RefSelect field={field} id={id} register={reg} invalid={invalid} />;
      break;
    default: {
      const type = { int: "number", number: "number", email: "email", url: "url", date: "date", datetime: "datetime-local" }[field.type as string] ?? "text";
      control = (
        <Input
          type={type}
          step={field.type === "number" ? "any" : undefined}
          inputMode={field.type === "int" ? "numeric" : field.type === "number" ? "decimal" : undefined}
          {...common}
          {...reg}
        />
      );
    }
  }

  return (
    <Field data-invalid={invalid} className={cn(field.type === "text" && "sm:col-span-2")}>
      <FieldLabel htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive" aria-hidden="true">*</span>}
      </FieldLabel>
      {control}
      {field.help && !error && <FieldDescription id={`${id}-help`}>{field.help}</FieldDescription>}
      <FieldError id={`${id}-error`} errors={error ? [{ message: error }] : undefined} />
    </Field>
  );
}

function ResourceForm({ def, id, initial }: { def: ResourceDef; id: number | null; initial?: Row }) {
  const router = useRouter();
  const { t } = useI18n();
  const save = useSaveResource(def, id);
  const [formError, setFormError] = useState<string | null>(null);
  // Same schema the API validates with - one source of truth for every rule and message.
  const schema = useMemo(() => (id === null ? createSchema(def) : updateSchema(def)), [def, id]);
  const defaults = useMemo(() => {
    const v: Values = {};
    for (const [k, f] of Object.entries(def.fields)) v[k] = initial ? toFormValue(f, initial[k]) : emptyValue(f);
    return v;
  }, [def, initial]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema as never) as unknown as Resolver<Values>, defaultValues: defaults, mode: "onTouched" });

  useEffect(() => reset(defaults), [defaults, reset]);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await save.mutateAsync(values);
      router.push(`/app/${def.name}`);
    } catch (err) {
      if (!applyFieldErrors(err, setError)) setFormError(apiErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card className="shadow-xs">
        <CardContent className="space-y-6 p-5 sm:p-7">
          {formError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {Object.entries(def.fields).map(([name, field]) => (
              <FieldInput key={name} name={name} field={field} register={register} errors={errors} />
            ))}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
            <Button variant="outline" render={<Link href={`/app/${def.name}`} />}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || (id !== null && !isDirty)}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? t("form.saving") : id === null ? `${t("common.create")} ${def.singular.toLowerCase()}` : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export function ResourceFormPage({ def, id }: { def: ResourceDef; id: number | null }) {
  const item = useResourceItem(def, id);
  const { t } = useI18n();
  const title = id === null ? t("form.new", { singular: def.singular.toLowerCase() }) : t("form.edit", { singular: def.singular.toLowerCase() });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={title} breadcrumbs={[{ label: def.plural, to: `/app/${def.name}` }, { label: title }]} />
      {id !== null && item.isLoading ? (
        <LoadingRows rows={4} />
      ) : id !== null && item.error ? (
        <ErrorState title={`Couldn't load this ${def.singular.toLowerCase()}`} onRetry={() => item.refetch()} />
      ) : (
        <ResourceForm def={def} id={id} initial={item.data} />
      )}
    </div>
  );
}
