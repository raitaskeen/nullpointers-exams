"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Circular score: the arc draws in once, color follows pass/fail (with text, never color alone). */
export function ScoreRing({ percent, passed, size = 120, className }: { percent: number; passed: boolean; size?: number; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);
  const stroke = Math.max(6, size / 12);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`${percent}%, ${passed ? "passed" : "below the pass mark"}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={passed ? "var(--success)" : "var(--danger)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, shown) / 100)}
          style={{ transition: "stroke-dashoffset 1s var(--ease-out)" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-semibold tracking-[-0.03em] tabular-nums" style={{ fontSize: size / 4.6 }}>
        {Math.round(percent)}%
      </span>
    </div>
  );
}
