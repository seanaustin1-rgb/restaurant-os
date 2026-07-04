"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Database, Layers } from "lucide-react";
import { clsx } from "clsx";
import type { SpendingByCategoryData } from "@/lib/modules/spending-by-category";
import type { LedgerReadSource } from "@/lib/financial-ledger/ledger-coverage";
import { money, pct } from "@/lib/format";

const PROFIT_COLOR = "#5FA777";
const GROUP_COLORS: Record<string, string> = {
  "Food & Beverage (COGS)": "#C8643A",
  Labor: "#D89A5B",
  "Operating Expenses": "#7C8B9E",
  "Owner's Pay": "#9B7BB8",
  Taxes: "#A8915F",
  "Other / Uncategorized": "#5A5F58",
};
const colorFor = (name: string) => GROUP_COLORS[name] ?? "#5A5F58";

interface Slice {
  name: string;
  value: number;
  color: string;
  share: number;
}

interface TipPayload {
  payload: Slice;
}
function PieTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="text-ink-text">{s.name}</div>
      <div className="tnum mt-0.5 text-muted">
        {money(s.value)} · {pct(s.share, 0)}
      </div>
    </div>
  );
}

export function SpendingByCategoryModule({ data }: { data: SpendingByCategoryData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No transactions in this period yet. Import a statement or connect a bank to see where your money goes.
      </div>
    );
  }

  const profitable = data.profit > 0;
  // Pie = spending groups, plus a profit slice when there's profit left over.
  const slices: Slice[] = data.groups.map((g) => ({
    name: g.group,
    value: g.total,
    color: colorFor(g.group),
    share: g.share,
  }));
  if (profitable) {
    slices.push({ name: "Profit", value: data.profit, color: PROFIT_COLOR, share: data.profitMargin });
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Money In</span>
          <div className="tnum mt-1 text-2xl text-health-green">{money(data.revenue)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Spending</span>
          <div className="tnum mt-1 text-2xl text-health-red">{money(data.totalSpend)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">{profitable ? "Profit" : "Loss"}</span>
          <div className={"tnum mt-1 text-2xl " + (profitable ? "text-health-green" : "text-health-red")}>
            {profitable ? "" : "−"}
            {money(Math.abs(data.profit))}
            {data.revenue > 0 && (
              <span className="ml-1.5 text-sm text-muted">{pct(Math.abs(data.profitMargin), 0)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Source-trust indicator — which spine served the figures. */}
      <SourceTrust
        source={data.source}
        label={data.sourceLabel}
        pending={data.pendingReviewCount}
        unmapped={data.unmappedCount}
      />

      {/* Donut + legend */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
        <div className="relative h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={1.5}
                stroke="none"
                isAnimationActive={false}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] uppercase tracking-wider text-muted">{profitable ? "Profit" : "Loss"}</span>
            <span className={"tnum text-xl " + (profitable ? "text-health-green" : "text-health-red")}>
              {profitable ? "" : "−"}
              {money(Math.abs(data.profit))}
            </span>
            {data.revenue > 0 && <span className="tnum text-xs text-muted">{pct(Math.abs(data.profitMargin), 0)} margin</span>}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col justify-center gap-1.5">
          {slices.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-ink-text">{s.name}</span>
              <span className="tnum shrink-0 text-muted">{money(s.value)}</span>
              <span className="tnum w-10 shrink-0 text-right text-muted">{pct(s.share, 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {!profitable && (
        <p className="rounded-lg border border-health-red/30 bg-health-red/5 px-4 py-2.5 text-xs text-muted">
          Spending exceeded money in by {money(Math.abs(data.profit))} this period — operating at a loss on a cash basis.
        </p>
      )}

      {/* Detailed category table — table on desktop, cards on phone/tablet */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Group</th>
              <th className="px-4 py-2 text-right font-medium">Spend</th>
              <th className="px-4 py-2 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c) => (
              <tr key={c.name} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2 text-ink-text">{c.name}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colorFor(c.group) }} />
                    {c.group}
                  </span>
                </td>
                <td className="tnum px-4 py-2 text-right text-ink-text">{money(c.total)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{pct(c.share, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-line/60 sm:hidden">
          {data.categories.map((c) => (
            <div key={c.name} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 break-words text-ink-text">{c.name}</span>
                <span className="tnum shrink-0 text-ink-text">{money(c.total)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colorFor(c.group) }} />
                <span>{c.group}</span>
                <span className="tnum ml-auto">{pct(c.share, 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SourceTrust({
  source,
  label,
  pending,
  unmapped,
}: {
  source: LedgerReadSource;
  label: string;
  pending: number;
  unmapped: number;
}) {
  const tone =
    source === "ledger"
      ? "border-health-green/30 text-health-green"
      : source === "legacy"
        ? "border-copper-dim text-copper-soft"
        : "border-line text-muted";
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", tone)}>
        {source === "ledger" ? <Database size={12} /> : <Layers size={12} />}
        Source: {label}
      </span>
      {unmapped > 0 && (
        <span className="text-copper-soft">
          {unmapped} unmapped spend line{unmapped === 1 ? "" : "s"}
        </span>
      )}
      {pending > 0 && (
        <span className="text-muted">
          {pending} event{pending === 1 ? "" : "s"} pending review
        </span>
      )}
    </div>
  );
}
