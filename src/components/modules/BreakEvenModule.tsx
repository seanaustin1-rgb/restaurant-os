"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Scale, ShieldCheck, ShieldAlert, Target, TrendingUp } from "lucide-react";
import type { BreakEvenData } from "@/lib/modules/break-even";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { money, pct } from "@/lib/format";
import { HealthSignal } from "@/components/health/HealthSignal";

// Margin-of-Safety reads as a cushion, not a budget — so its words diverge from the
// gauge vocabulary while the icon set stays constant.
const MOS_WORD: Record<HealthStatus, string> = {
  green: "Healthy",
  yellow: "Thin",
  red: "At risk",
};

const HEALTH_HEX: Record<HealthStatus, string> = {
  green: "#5FA777",
  yellow: "#D9A35E",
  red: "#C8643A",
};
const HEALTH_TEXT: Record<HealthStatus, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

interface TipPayload {
  payload: { weekStart: string; netSales: number; breakEven: number; cmRatio: number; partial: boolean };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const over = d.netSales >= d.breakEven;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-[#E6E8E4]">
        week of {d.weekStart}
        {d.partial ? <span className="ml-1 text-muted">(partial)</span> : null}
      </div>
      <div className="tnum text-copper-soft">{money(d.netSales)} net sales</div>
      <div className="tnum text-muted">break-even ≈ {money(d.breakEven)}</div>
      <div className={"tnum " + (over ? "text-health-green" : "text-health-red")}>
        {over ? "+" : "−"}
        {money(Math.abs(d.netSales - d.breakEven))} {over ? "above" : "below"}
      </div>
    </div>
  );
}

export function BreakEvenModule({ data }: { data: BreakEvenData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No sales data in this window yet. Run the Toast sync to pull daily net sales and labor cost.
      </div>
    );
  }

  // Variable costs exceed sales — no break-even exists at any volume.
  if (!data.cmPositive) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-health-red/40 bg-surface p-5">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-health-red">
            <ShieldAlert size={13} /> No break-even point
          </span>
          <p className="mt-2 text-sm leading-relaxed text-[#E6E8E4]">
            Variable costs (COGS + labor) are running at{" "}
            <span className="tnum text-health-red">{pct(data.primeCostPct)}</span> of sales — at or above 100%.
            Every additional sale loses money before a dollar reaches fixed costs, so no level of sales breaks
            even. The lever here is Prime Cost, not volume: pull COGS + labor below 100% of sales first.
          </p>
        </div>
      </div>
    );
  }

  const breakEvenPerWeek = data.breakEvenPerWeek ?? 0;
  const breakEvenPerDay = data.breakEvenPerDay ?? 0;
  const chart = data.weeks.map((w) => ({
    ...w,
    label: w.weekStart.slice(5),
    breakEven: breakEvenPerDay * w.days, // per-week break-even prorated to days present
  }));
  const yMax = Math.ceil(Math.max(breakEvenPerWeek, ...data.weeks.map((w) => w.netSales), 1) * 1.15);
  const above = data.dollarsAboveBreakEven >= 0;

  const fcTotal = data.fixedCost || 1;
  const FC_COLORS = ["#C8873A", "#9C6B2E", "#7A5326", "#B5832F", "#6E4F25", "#8A6230"];

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Scale size={12} className="text-copper-soft" /> Break-even / day
          </span>
          <div className="tnum mt-1 text-3xl text-copper-soft">{money(breakEvenPerDay)}</div>
          <div className="mt-0.5 text-[11px] text-muted">≈ {money(data.monthlyBreakEven ?? 0)}/mo</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted">Margin of Safety</span>
            <HealthSignal status={data.health} mode="badge" label={MOS_WORD[data.health]} />
          </div>
          <div className={"tnum mt-1 text-2xl " + HEALTH_TEXT[data.health]}>{pct(data.marginOfSafety)}</div>
          <div className="mt-0.5 text-[11px] text-muted">
            sales can fall this far before a loss
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Contribution Margin</span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{pct(data.cmRatio * 100)}</div>
          <div className="mt-0.5 text-[11px] text-muted">left after variable cost, per $1</div>
        </div>
      </div>

      {/* Cushion vs break-even */}
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            {above ? (
              <ShieldCheck size={12} className="text-health-green" />
            ) : (
              <ShieldAlert size={12} className="text-health-red" />
            )}
            {above ? "Above break-even" : "Below break-even"}
          </span>
          <span className={"tnum text-sm " + (above ? "text-health-green" : "text-health-red")}>
            {above ? "+" : "−"}
            {money(Math.abs(data.dollarsAboveBreakEven))} on {money(data.netSales)} sales
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          You needed {money(data.breakEvenSales ?? 0)} this window to cover {money(data.fixedCost)} of fixed
          costs at a {pct(data.cmRatio * 100, 0)} contribution margin.{" "}
          {above
            ? `You cleared it by ${money(data.dollarsAboveBreakEven)} — that surplus is what funds Profit & Owner Pay.`
            : `You came up ${money(Math.abs(data.dollarsAboveBreakEven))} short — fixed costs weren't fully covered by margin.`}
        </p>
        {data.targetBreakEvenSales != null && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
            <Target size={11} /> At your TAP cost targets ({pct(data.targetCmRatio * 100, 0)} margin), break-even
            would be {money(data.targetBreakEvenSales)}.
          </p>
        )}
      </div>

      {/* Fixed-cost anatomy */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs uppercase tracking-wider text-muted">Fixed costs — what break-even covers</h2>
          <span className="tnum text-xs text-muted">{money(data.fixedCost)}</span>
        </div>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-ink">
          {data.fixedCostLines.map((c, i) => (
            <div
              key={c.name}
              style={{ width: `${(c.amount / fcTotal) * 100}%`, backgroundColor: FC_COLORS[i % FC_COLORS.length] }}
              title={`${c.name} ${money(c.amount)}`}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.fixedCostLines.slice(0, 6).map((c, i) => (
            <div key={c.name} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: FC_COLORS[i % FC_COLORS.length] }}
              />
              <span className="truncate text-[11px] text-muted">
                {c.name} <span className="tnum text-[#E6E8E4]">{money(c.amount)}</span>
              </span>
            </div>
          ))}
        </div>
        {data.debtService > 0 && (
          <p className="mt-2 text-[10px] text-muted">
            Includes {money(data.debtService)} debt service — a fixed obligation, served from Profit
            distributions under Profit First.
          </p>
        )}
      </div>

      {/* Weekly sales vs break-even */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Net sales vs. break-even, by week</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fill: "#8A8F89", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, yMax]} />
              <Tooltip cursor={{ fill: "#23262333" }} content={<ChartTip />} />
              <ReferenceLine y={breakEvenPerWeek} stroke="#8A8F89" strokeDasharray="4 4" />
              <Bar dataKey="netSales" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chart.map((w) => (
                  <Cell key={w.weekStart} fill={w.netSales >= w.breakEven ? HEALTH_HEX.green : HEALTH_HEX.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[10px] text-muted">
          Dashed line = weekly break-even (≈ {money(breakEvenPerWeek)}). Bars below their week&apos;s break-even
          are red. Fixed costs are lumpy week to week, so read the window total as the stable figure.
        </p>
      </div>

      {/* Weekly table */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Week of</th>
              <th className="px-4 py-2 text-right font-medium">Net Sales</th>
              <th className="px-4 py-2 text-right font-medium">CM %</th>
              <th className="px-4 py-2 text-right font-medium">Break-even</th>
              <th className="px-4 py-2 text-right font-medium">+/−</th>
            </tr>
          </thead>
          <tbody>
            {chart.map((w) => {
              const delta = w.netSales - w.breakEven;
              return (
                <tr key={w.weekStart} className="border-b border-line/60 last:border-0">
                  <td className="tnum px-4 py-2 text-muted">
                    {w.weekStart}
                    {w.partial ? <span className="ml-1 text-[10px]">(partial)</span> : null}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{money(w.netSales)}</td>
                  <td className="tnum px-4 py-2 text-right text-muted">{pct(w.cmRatio * 100)}</td>
                  <td className="tnum px-4 py-2 text-right text-muted">{money(w.breakEven)}</td>
                  <td className={"tnum px-4 py-2 text-right " + (delta >= 0 ? "text-health-green" : "text-health-red")}>
                    {delta >= 0 ? "+" : "−"}
                    {money(Math.abs(delta))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Honest footnotes */}
      <p className="text-[11px] leading-relaxed text-muted">
        <TrendingUp size={11} className="mr-1 inline" />
        Break-even = Fixed Costs ÷ Contribution Margin. Variable costs are COGS + labor (Prime Cost), so each
        sales dollar leaves {pct(data.cmRatio * 100, 0)} to cover fixed costs and profit. Net sales &amp; labor
        come from Toast; COGS &amp; fixed costs are <span className="text-[#E6E8E4]">cash-basis</span> from
        categorized bank transactions. Labor is treated as fully variable — salaried labor is partly fixed, so
        your true break-even is modestly lower than shown.
      </p>
    </div>
  );
}
