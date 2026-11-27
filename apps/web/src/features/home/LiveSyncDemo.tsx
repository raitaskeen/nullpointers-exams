"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Pause, Play } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const ITEMS = ["Book the main hall", "Print 300 lanyards", "Brief the volunteers", "Test the projector"];

function Window({ who, rows, fresh, saving }: { who: string; rows: string[]; fresh: string | null; saving?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-md">
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-2.5">
        <span className="text-sm font-medium">{who}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" /> Live
        </span>
      </div>
      <ul className="min-h-[12.25rem] divide-y divide-border">
        {rows.map((r) => (
          <li
            key={r}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors duration-700",
              r === fresh ? "bg-brand-soft" : "bg-transparent",
            )}
            style={r === fresh ? { animation: "rise 520ms var(--ease-out) backwards" } : undefined}
          >
            <span className="truncate">{r}</span>
            {r === fresh && saving && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                <CheckCircle weight="fill" className="size-3.5" /> Saved
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The one authored motion moment on the landing page: a record saved by you lands on your teammate's screen. */
export function LiveSyncDemo() {
  const [step, setStep] = useState(1);
  const [stage, setStage] = useState<"mine" | "theirs">("theirs");
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const id = setInterval(() => {
      setStage((s) => {
        if (s === "mine") return "theirs";
        setStep((n) => (n % ITEMS.length) + 1);
        return "mine";
      });
    }, 1700);
    return () => clearInterval(id);
  }, [paused, reduced]);

  const mine = ITEMS.slice(0, step).reverse();
  const theirs = (stage === "theirs" ? ITEMS.slice(0, step) : ITEMS.slice(0, step - 1)).reverse();
  const fresh = ITEMS[step - 1] ?? null;

  return (
    <div className="relative">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <Window who="You" rows={mine} fresh={fresh} saving />
        <Window who="Ayesha · teammate" rows={theirs} fresh={stage === "theirs" ? fresh : null} />
      </div>
      {!reduced && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-pressed={paused}
        >
          {paused ? <Play weight="fill" className="size-3" /> : <Pause weight="fill" className="size-3" />}
          {paused ? "Play the demo" : "Pause the demo"}
        </button>
      )}
    </div>
  );
}
