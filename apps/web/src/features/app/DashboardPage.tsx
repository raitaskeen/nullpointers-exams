"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Plus, Pulse } from "@phosphor-icons/react";
import { allResources, type ResourceDef } from "@np/shared";
import { ResourceIcon } from "@/components/ResourceIcon";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useRealtimeTopics } from "@/lib/realtime";
import { cn, initials } from "@/lib/utils";
import { humanize } from "../resources/format";

interface Stats {
  total: number;
  lastWeek: number;
  series: { date: string; count: number }[];
  breakdowns: { field: string; label: string; values: { value: string; count: number }[] }[];
}
interface Activity {
  id: number;
  action: string;
  resource: string;
  resourceId: number | null;
  at: string;
  userName: string | null;
}

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const BAR_TONES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-border bg-card shadow-xs", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function useLiveDashboard(names: string[]) {
  const qc = useQueryClient();
  // One hibernating Durable Object socket per resource topic; refresh stats + feed on any change.
  useRealtimeTopics(names, (e) => {
    qc.invalidateQueries({ queryKey: ["resource", e.topic] });
    qc.invalidateQueries({ queryKey: ["activity"] });
  });
}

export function DashboardPage() {
  const { user, can } = useAuth();
  const { t, intl } = useI18n();
  const readable = useMemo(() => allResources().filter((r) => can(`${r.name}:read`)), [can]);
  const creatable = readable.find((r) => can(`${r.name}:create`));

  const stats = useQueries({
    queries: readable.map((r) => ({
      queryKey: ["resource", r.name, "stats"],
      queryFn: () => api<Stats>(`/${r.name}/stats`),
    })),
  });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api<{ items: Activity[] }>("/activity") });
  useLiveDashboard(readable.map((r) => r.name));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dash.morning") : hour < 18 ? t("dash.afternoon") : t("dash.evening");
  const dayFmt = new Intl.DateTimeFormat(intl, { month: "short", day: "numeric" });
  const numFmt = new Intl.NumberFormat(intl);
  const rel = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });

  const chartData = useMemo(() => {
    const days = stats[0]?.data?.series.map((s) => s.date) ?? [];
    return days.map((date, i) => {
      const row: Record<string, string | number> = { date };
      readable.forEach((r, j) => (row[r.name] = stats[j]?.data?.series[i]?.count ?? 0));
      return row;
    });
  }, [stats, readable]);

  const breakdown = useMemo(() => {
    for (let i = 0; i < readable.length; i++) {
      const b = stats[i]?.data?.breakdowns.find((x) => x.values.some((v) => v.count > 0));
      if (b) return { def: readable[i] as ResourceDef, ...b };
    }
    return null;
  }, [stats, readable]);

  const ago = (iso: string) => {
    const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const m = Math.round(s / 60);
    const h = Math.round(s / 3600);
    if (Math.abs(s) < 60) return rel.format(s, "second");
    if (Math.abs(m) < 60) return rel.format(m, "minute");
    if (Math.abs(h) < 24) return rel.format(h, "hour");
    return rel.format(Math.round(s / 86400), "day");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-3xl">
            {greeting}, {user?.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-foreground-soft">{t("dash.subtitle")}</p>
        </div>
        {creatable && (
          <Button render={<Link href={`/app/${creatable.name}/new`} />}>
            <Plus weight="bold" />
            {t("form.new", { singular: creatable.singular.toLowerCase() })}
          </Button>
        )}
      </div>

      {/* Totals */}
      <section aria-label={t("dash.total")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {readable.map((r, i) => {
          const s = stats[i];
          return (
            <Link
              key={r.name}
              href={`/app/${r.name}`}
              className="group rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-xs transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-2"
            >
              <div className="flex items-center justify-between text-sm text-foreground-soft">
                <span className="flex items-center gap-2 font-medium">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                    <ResourceIcon name={r.icon} weight="duotone" className="size-[1.125rem]" />
                  </span>
                  {r.plural}
                </span>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" aria-hidden="true" />
              </div>
              {s?.isLoading ? (
                <div className="skeleton mt-4 h-9 w-20 rounded-md" />
              ) : (
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-[2rem] leading-none font-semibold tracking-tight tabular-nums">{numFmt.format(s?.data?.total ?? 0)}</span>
                  {!!s?.data?.lastWeek && (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success tabular-nums">
                      {t("dash.week", { n: numFmt.format(s.data.lastWeek) })}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={t("dash.trend")}>
          {chartData.length ? (
            <div className="h-64" role="img" aria-label={t("dash.trend")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickFormatter={(d: string) => dayFmt.format(new Date(`${d}T00:00:00`))}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    reversed={false}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={40} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 10,
                      boxShadow: "var(--shadow-md)",
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    labelFormatter={(d) => dayFmt.format(new Date(`${String(d)}T00:00:00`))}
                  />
                  {readable.map((r, i) => (
                    <Bar
                      key={r.name}
                      dataKey={r.name}
                      name={r.plural}
                      stackId="all"
                      fill={SERIES_COLORS[i % 5]}
                      radius={i === readable.length - 1 ? [4, 4, 0, 0] : 0}
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="skeleton h-64 rounded-lg" />
          )}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {readable.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: SERIES_COLORS[i % 5] }} aria-hidden="true" />
                {r.plural}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={breakdown ? `${breakdown.def.plural} · ${t("dash.breakdown", { field: breakdown.label.toLowerCase() })}` : t("dash.total")}>
          {breakdown ? (
            <ul className="space-y-4">
              {(() => {
                const max = Math.max(1, ...breakdown.values.map((v) => v.count));
                const sum = breakdown.values.reduce((a, v) => a + v.count, 0) || 1;
                return breakdown.values.map((v, i) => (
                  <li key={v.value}>
                    <Link href={`/app/${breakdown.def.name}?${breakdown.field}=${v.value}`} className="group block rounded-md">
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium group-hover:underline">{humanize(v.value)}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {numFmt.format(v.count)} · {Math.round((v.count / sum) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", BAR_TONES[i % 5])} style={{ width: `${(v.count / max) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                ));
              })()}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("dash.activityEmpty")}</p>
          )}
        </Panel>
      </div>

      <Panel
        title={t("dash.activity")}
        action={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Pulse className="size-3.5 text-success" aria-hidden="true" /> {t("list.live")}
          </span>
        }
      >
        {activity.isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
        ) : !activity.data?.items.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("dash.activityEmpty")}</p>
        ) : (
          <ol className="-my-2 divide-y divide-border">
            {activity.data.items.map((a) => {
              const def = allResources().find((r) => r.name === a.resource);
              const verb = { create: "created", update: "updated", delete: "deleted", register: "joined" }[a.action] ?? a.action;
              const href = a.resourceId && a.action !== "delete" && def ? `/app/${def.name}?view=${a.resourceId}` : null;
              const label = `${def?.singular.toLowerCase() ?? a.resource} #${a.resourceId ?? ""}`;
              return (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground-soft">
                    {initials(a.userName ?? "?", "")}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground-soft">
                    <span className="font-medium text-foreground">{a.userName ?? "Someone"}</span> {verb}{" "}
                    {href ? <Link href={href} className="font-medium text-foreground hover:underline">{label}</Link> : <span>{label}</span>}
                  </p>
                  <time dateTime={a.at} className="shrink-0 text-xs text-muted-foreground">{ago(a.at)}</time>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </div>
  );
}
