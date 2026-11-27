"use client";

import { useRef, useState, type ReactNode } from "react";
import { CheckCircle, FileArrowUp, WarningCircle, DownloadSimple } from "@phosphor-icons/react";
import type { ZodType } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api-client";
import { readRows } from "@/lib/csv";
import { cn } from "@/lib/utils";

export interface RowCheck {
  row: number;
  data: Record<string, unknown>;
  error: string | null;
}

/**
 * Bulk import with a preview: the file is parsed in the browser and every row is checked against the same Zod
 * schema the API uses, so problems show per row before anything is sent. The server re-validates and reports
 * its own per-row errors (e.g. duplicates), which are shown in the same list.
 */
export function ImportDialog({
  open,
  onOpenChange,
  title,
  description,
  schema,
  normalize = (r) => r,
  columns,
  template,
  onImport,
  extra,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  schema: ZodType;
  normalize?: (row: Record<string, unknown>) => Record<string, unknown>;
  columns: { key: string; label: string }[];
  template: { filename: string; text: string };
  /** Sends the valid rows; returns a summary node to show (and the server's own row errors). */
  onImport: (rows: Record<string, unknown>[]) => Promise<{ summary: ReactNode; errors?: { row: number; message: string }[] }>;
  extra?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<RowCheck[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ summary: ReactNode; errors: { row: number; message: string }[] } | null>(null);
  const [drag, setDrag] = useState(false);

  const resetAll = () => {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setDone(null);
  };

  async function load(file: File) {
    resetAll();
    setFileName(file.name);
    try {
      const raw = await readRows(file);
      if (!raw.length) throw new Error("The file has no data rows.");
      if (raw.length > 500) throw new Error("At most 500 rows per import.");
      setRows(
        raw.map((r, i) => {
          const data = normalize(r);
          const parsed = schema.safeParse(data);
          return { row: i + 2, data, error: parsed.success ? null : parsed.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join("; ") };
        }),
      );
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Couldn't read this file.");
    }
  }

  const valid = rows.filter((r) => !r.error);
  const invalid = rows.length - valid.length;

  async function submit() {
    setBusy(true);
    try {
      const res = await onImport(valid.map((r) => r.data));
      // The server numbers rows within what we sent (valid rows only); map back to the file's row numbers.
      setDone({ summary: res.summary, errors: (res.errors ?? []).map((e) => ({ ...e, row: valid[e.row - 2]?.row ?? e.row })) });
    } catch (err) {
      setParseError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetAll();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-success">
              <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="text-sm text-foreground">{done.summary}</div>
            </div>
            {done.errors.length > 0 && <ErrorList errors={done.errors} />}
          </div>
        ) : (
          <div className="space-y-4">
            {extra}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) void load(f);
              }}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                drag ? "border-primary bg-brand-softer" : "border-border-strong bg-surface-sunken/50",
              )}
            >
              <FileArrowUp weight="duotone" className="size-8 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">{fileName ?? "Drop a .csv or .json file here"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Up to 500 rows. The first CSV row must be the column names.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
                  Choose file
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([template.text], { type: "text/csv" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = template.filename;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <DownloadSimple /> Template
                </Button>
              </div>
              <input
                ref={input}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="sr-only"
                aria-label="Choose a file to import"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void load(f);
                  e.target.value = "";
                }}
              />
            </div>

            {parseError && (
              <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                <WarningCircle weight="fill" className="size-4" aria-hidden="true" /> {parseError}
              </p>
            )}

            {rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-semibold text-success">{valid.length} ready</span>
                  {invalid > 0 && <span className="font-semibold text-danger"> · {invalid} with problems (skipped)</span>}
                </p>
                <div className="max-h-72 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-start text-[0.8125rem]">
                    <thead className="sticky top-0 bg-surface-sunken text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-start font-medium">Row</th>
                        {columns.map((c) => <th key={c.key} className="px-3 py-2 text-start font-medium">{c.label}</th>)}
                        <th className="px-3 py-2 text-start font-medium">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r) => (
                        <tr key={r.row} className={r.error ? "bg-danger-soft/40" : undefined}>
                          <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.row}</td>
                          {columns.map((c) => <td key={c.key} className="max-w-56 truncate px-3 py-2" title={String(r.data[c.key] ?? "")}>{String(r.data[c.key] ?? "")}</td>)}
                          <td className="px-3 py-2">{r.error ? <span className="text-danger">{r.error}</span> : <CheckCircle weight="fill" className="size-4 text-success" aria-label="Valid" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <>
              <Button variant="outline" onClick={resetAll}>Import another file</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!valid.length || busy}>
                {busy ? "Importing…" : `Import ${valid.length || ""} row${valid.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErrorList({ errors }: { errors: { row: number; message: string }[] }) {
  return (
    <div className="max-h-56 overflow-auto rounded-xl border border-border">
      <ul className="divide-y divide-border text-[0.8125rem]">
        {errors.map((e, i) => (
          <li key={i} className="flex gap-3 px-3 py-2">
            <span className="shrink-0 font-medium text-muted-foreground tabular-nums">Row {e.row}</span>
            <span className="text-danger">{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
