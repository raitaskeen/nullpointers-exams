import { ChartBar, Gear, Kanban, ListChecks, MagnifyingGlass, Plus, SquaresFour, Users } from "@phosphor-icons/react/dist/ssr";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const ROWS = [
  { title: "Confirm venue walkthrough", owner: "AK", status: "Doing", tone: "warn", due: "Nov 28" },
  { title: "Publish volunteer schedule", owner: "SR", status: "Done", tone: "ok", due: "Nov 27" },
  { title: "Order badges and lanyards", owner: "RM", status: "Todo", tone: "info", due: "Nov 29" },
  { title: "Run sound check with AV team", owner: "AK", status: "Doing", tone: "warn", due: "Nov 28" },
  { title: "Send judges the final agenda", owner: "SR", status: "Todo", tone: "info", due: "Nov 30" },
] as const;

const tone = {
  ok: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  info: "bg-brand-soft text-brand-ink",
};

/**
 * A faithful, code-drawn picture of the real app (same tokens, same components' look), used as the hero
 * visual. Drawn in code rather than screenshotted so it always matches the current theme and palette.
 */
export function ProductFrame({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The app's task list: five tasks with owners, status badges and due dates, live-synced across the team."
      className={cn("overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-lg", className)}
    >
      {/* window bar */}
      <div className="flex h-10 items-center gap-2 border-b border-border bg-surface-sunken px-4">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ms-3 hidden h-6 flex-1 items-center rounded-md bg-surface px-3 text-[11px] text-muted-foreground sm:flex sm:max-w-xs">
          app.nullpointers.dev/app/tasks
        </span>
      </div>

      <div className="flex min-h-[340px]">
        {/* sidebar */}
        <div className="hidden w-48 shrink-0 flex-col gap-1 border-e border-border bg-sidebar p-3 md:flex">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold">
            <LogoMark className="size-5" /> NullPointers
          </div>
          {[
            [SquaresFour, "Overview", false],
            [Kanban, "Projects", false],
            [ListChecks, "Tasks", true],
            [ChartBar, "Reports", false],
            [Users, "People", false],
            [Gear, "Settings", false],
          ].map(([Icon, label, active]) => {
            const I = Icon as typeof Kanban;
            return (
              <div
                key={label as string}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
                  active ? "bg-sidebar-active font-medium text-foreground shadow-xs" : "text-sidebar-muted-foreground",
                )}
              >
                <I className="size-4" />
                {label as string}
              </div>
            );
          })}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold tracking-tight">Tasks</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Live · 3 teammates here
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden h-8 w-44 items-center gap-2 rounded-lg border border-border px-2.5 text-xs text-muted-foreground lg:flex">
                <MagnifyingGlass className="size-3.5" /> Search tasks
                <span className="kbd ms-auto">⌘K</span>
              </div>
              <div className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-brand">
                <Plus weight="bold" className="size-3.5" /> New task
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-surface-sunken px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase sm:grid-cols-[1fr_5.5rem_4.5rem_2rem]">
              <span>Title</span>
              <span>Status</span>
              <span className="hidden sm:block">Due</span>
              <span className="hidden sm:block" />
            </div>
            {ROWS.map((r, i) => (
              <div
                key={r.title}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-3 py-2.5 text-[13px] last:border-0 sm:grid-cols-[1fr_5.5rem_4.5rem_2rem]",
                  i === 0 && "bg-brand-softer",
                )}
              >
                <span className="truncate font-medium">{r.title}</span>
                <span className={cn("inline-flex h-5 w-fit items-center rounded-full px-2 text-[11px] font-medium", tone[r.tone])}>{r.status}</span>
                <span className="hidden text-muted-foreground tabular-nums sm:block">{r.due}</span>
                <span className="hidden size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-foreground-soft sm:grid">
                  {r.owner}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
