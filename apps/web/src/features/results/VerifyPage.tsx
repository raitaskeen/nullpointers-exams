"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, SealCheck, ShieldWarning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api-client";
import { fmtDateTime, fmtMarks, type VerifyResult } from "@/lib/exams";
import { cn } from "@/lib/utils";

/** Public check for a result report (secondary 4.6): shows only what proves it is genuine. */
export function VerifyPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const code = (params.get("code") ?? "").toUpperCase();
  const [input, setInput] = useState(code);
  useEffect(() => setInput(code), [code]);

  const valid = /^[A-Z0-9]{6,16}$/.test(code);
  const check = useQuery({ queryKey: ["verify", code], queryFn: () => api<VerifyResult>(`/verify/${code}`), enabled: valid, retry: false });
  const r = check.data;

  return (
    <div className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-xl">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink"><SealCheck weight="duotone" className="size-6" /></span>
        <h1 className="mt-6 text-[clamp(2rem,5vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.04em]">Verify a result</h1>
        <p className="mt-3 text-lg text-foreground-soft">Enter the code printed on an Invigil result report, or scan its QR code. You'll see whether it is genuine and the score it records, and nothing more.</p>

        <form
          className="mt-8 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = input.trim().toUpperCase();
            router.replace(c ? `${pathname}?code=${encodeURIComponent(c)}` : pathname);
          }}
        >
          <label htmlFor="verify-code" className="sr-only">Verification code</label>
          <input
            id="verify-code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            placeholder="7KQ2MX9PHA"
            className="h-12 min-w-0 flex-1 rounded-xl border border-control-border/70 bg-surface px-4 font-mono text-lg tracking-[0.12em] uppercase shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
          />
          <Button type="submit" size="lg">Check</Button>
        </form>
        {code && !valid && <p role="alert" className="mt-3 text-sm font-medium text-danger">Codes are 6 to 16 letters and numbers.</p>}

        <div className="mt-8" aria-live="polite">
          {check.isLoading && valid && <div className="skeleton h-48 rounded-2xl" />}
          {check.error && (
            <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              {check.error instanceof ApiError && check.error.status === 429 ? "Too many checks from this connection. Wait a minute and try again." : "Couldn't check the code right now. Try again in a moment."}
            </p>
          )}
          {r && (
            <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm animate-[rise_400ms_var(--ease-out)_backwards]", r.valid ? "border-success/40" : "border-danger/40")}>
              <div className={cn("flex items-center gap-3 px-6 py-4", r.valid ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                {r.valid ? <CheckCircle weight="fill" className="size-6" /> : <ShieldWarning weight="fill" className="size-6" />}
                <p className="font-semibold">{r.valid ? "Genuine result report" : "No published result matches this code"}</p>
              </div>
              {r.valid ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-6 text-sm">
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">Exam</dt><dd className="mt-0.5 text-base font-semibold">{r.exam}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Candidate</dt><dd className="mt-0.5 font-medium">{r.candidate}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Result</dt><dd className="mt-0.5 font-medium tabular-nums">{fmtMarks(r.score)} / {fmtMarks(r.maxScore)} · {r.percent}% · {r.passed ? "Pass" : "Below pass mark"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Issued</dt><dd className="mt-0.5 font-medium">{fmtDateTime(r.issuedAt)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Last updated</dt><dd className="mt-0.5 font-medium">{fmtDateTime(r.lastUpdated)}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">Code</dt><dd className="mt-0.5 font-mono tracking-wider">{r.code}</dd></div>
                </dl>
              ) : (
                <p className="p-6 text-sm text-muted-foreground">Check the code for typos. A report also stops verifying if its results are withdrawn by the examiner.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
