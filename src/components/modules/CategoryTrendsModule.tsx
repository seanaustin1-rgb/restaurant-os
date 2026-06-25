"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { CategoryTrendsData, CategoryTrendRow } from "@/lib/modules/category-trends";
import { setCategoryBudget } from "@/app/settings/categories/actions";
import { money } from "@/lib/format";

export function CategoryTrendsModule({ data }: { data: CategoryTrendsData }) {
  const [rows, setRows] = useState(data.rows);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function saveBudget(categoryId: string, raw: string) {
    const parsed = raw.trim() === "" ? null : Number(raw.replace(/[^0-9.]/g, ""));
    const value = parsed != null && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
    setRows((rs) =>
      rs.map((r) =>
        r.categoryId === categoryId
          ? { ...r, budget: value, budgetUsedPct: value ? Math.round((r.current / value) * 1000) / 10 : null }
          : r,
      ),
    );
    setError(null);
    startTransition(async () => {
      try {
        await setCategoryBudget(categoryId, value);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save budget");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      <p className="rounded-lg border border-line bg-surface/60 px-4 py-3 text-xs text-muted">
        Each category&rsquo;s spend over the last {data.monthsLabels.length} months, newest on the right. MoM compares{" "}
        <span className="text-ink-text">{data.currentLabel}</span> to the prior month. Set a monthly budget to track
        budget-vs-actual — the bar turns yellow past 90% and red over 100%. Budgets are optional and OpEx sub-budgets
        are the common use.
      </p>

      <div className="space-y-2">
        {rows.map((r) => (
          <Row key={r.categoryId} r={r} labels={data.monthsLabels} onSaveBudget={saveBudget} />
        ))}
      </div>
    </div>
  );
}

function Row({
  r,
  labels,
  onSaveBudget,
}: {
  r: CategoryTrendRow;
  labels: { ym: string; label: string }[];
  onSaveBudget: (id: string, raw: string) => void;
}) {
  const peak = Math.max(...r.months.map((m) => m.total), 1);
  const used = r.budgetUsedPct;
  const usedTone = used == null ? "" : used <= 90 ? "text-health-green" : used <= 100 ? "text-health-yellow" : "text-health-red";
  const barTone = used == null ? "bg-copper-soft/60" : used <= 90 ? "bg-health-green" : used <= 100 ? "bg-health-yellow" : "bg-health-red";

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-[140px] flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-text">{r.name}</span>
            <Mom pct={r.momPct} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {money(r.current)} this month{r.prior > 0 ? ` · ${money(r.prior)} prior` : ""}
          </div>
        </div>

        {/* 6-month mini bars */}
        <div className="flex items-end gap-1" title={r.months.map((m) => `${m.label} ${money(m.total)}`).join("  ·  ")}>
          {r.months.map((m, i) => (
            <div key={m.ym} className="flex w-4 flex-col items-center gap-0.5">
              <div className="flex h-10 w-full items-end">
                <div
                  className={clsx("w-full rounded-sm", i === r.months.length - 1 ? "bg-copper-soft" : "bg-line")}
                  style={{ height: `${Math.max((m.total / peak) * 100, 2)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted">{m.label[0]}</span>
            </div>
          ))}
        </div>

        {/* Budget editor + used% */}
        <div className="w-40 shrink-0">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">Monthly budget</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-line bg-ink px-2">
              <span className="text-xs text-muted">$</span>
              <input
                defaultValue={r.budget ?? ""}
                inputMode="decimal"
                placeholder="—"
                onBlur={(e) => onSaveBudget(r.categoryId, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="w-20 rounded bg-transparent py-1 text-sm text-ink-text outline-none focus-visible:ring-1 focus-visible:ring-copper-soft"
              />
            </div>
            {used != null && <span className={clsx("tnum text-xs", usedTone)}>{used.toFixed(0)}%</span>}
          </div>
          {r.budget != null && (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink">
              <div className={clsx("h-full rounded-full", barTone)} style={{ width: `${Math.min(used ?? 0, 100)}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mom({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-[10px] text-muted">new</span>;
  const up = pct > 0.5;
  const down = pct < -0.5;
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  // For spend, up = more money out (amber), down = less (green), flat = muted.
  const tone = up ? "text-health-yellow" : down ? "text-health-green" : "text-muted";
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-[11px]", tone)}>
      <Icon size={11} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}
