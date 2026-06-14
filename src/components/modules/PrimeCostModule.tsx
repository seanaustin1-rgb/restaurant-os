"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flame, TrendingUp, TrendingDown, Target } from "lucide-react";
import type { PrimeCostData } from "@/lib/modules/prime-cost";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { money, pct } from "@/lib/format";

const COPPER = "#C8873A";
const COPPER_SOFT = "#D9A35E";
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
  payload: { weekStart: string; primeCostPct: number; cogsPct: number; laborPct: number; partial: boolean };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-[#E6E8E4]">
        week of {d.weekStart}
        {d.partial ? <span className="ml-1 text-muted">(partial)</span> : null}
      </div>
      <div className="tnum text-copper-soft">{pct(d.primeCostPct)} prime cost</div>
      <div className="tnum text-muted">{pct(d.cogsPct)} COGS · {pct(d.laborPct)} labor</div>
    </div>
  );
}

export function PrimeCostModule({ data }: { data: PrimeCostData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No sales data in this window yet. Run the Toast sync to pull daily net sales and labor cost.
      </div>
    );
  }

  const chart = data.weeks.map((w) => ({ ...w, label: w.weekStart.slice(5) }));
  const yMax = Math.ceil(Math.max(data.targetPct, ...data.weeks.map((w) => w.primeCostPct), 1) * 1.15);
  const over = data.varianceVsTargetPts > 0;
  const ns = data.composition.netSales || 1;
  const comp = [
    { key: "food", label: "Food", amount: data.composition.cogsFood, color: "#C8873A" },
    { key: "liquor", label: "Wine & Spirits", amount: data.composition.cogsLiquor, color: "#9C6B2E" },
    { key: "beer", label: "Beer", amount: data.composition.cogsBeverage, color: "#7A5326" },
    { key: "labor", label: "Labor", amount: data.composition.labor, color: "#D9A35E" },
  ].filter((c) => c.amount > 0);

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Flame size={12} className="text-copper-soft" /> Prime Cost
          </span>
          <div className={"tnum mt-1 text-3xl " + HEALTH_TEXT[data.health]}>{pct(data.primeCostPct)}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            <Target size={11} /> target ≤ {pct(data.targetPct, 0)}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">COGS % of Sales</span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{pct(data.cogsPct)}</div>
          <div className="mt-0.5 text-[11px] text-muted">{money(data.cogs)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Labor % of Sales</span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{pct(data.laborPct)}</div>
          <div className="mt-0.5 text-[11px] text-muted">{money(data.laborCost)}</div>
        </div>
      </div>

      {/* Variance vs target */}
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            {over ? <TrendingUp size={12} className="text-health-red" /> : <TrendingDown size={12} className="text-health-green" />}
            {over ? "Over target" : "Under target"}
          </span>
          <span className={"tnum text-sm " + (over ? "text-health-red" : "text-health-green")}>
            {over ? "+" : "−"}
            {Math.abs(data.varianceVsTargetPts).toFixed(1)} pts ({over ? "+" : "−"}
            {money(Math.abs(data.dollarsVsTarget))} on {money(data.netSales)} sales)
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Every point of prime cost is {money(data.netSales / 100)} over this window. {over
            ? "Pulling prime back to target frees that cash for Profit & Owner Pay."
            : "You're running leaner than your TAP target — that headroom is real margin."}
        </p>
      </div>

      {/* Composition: where prime cost comes from */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Anatomy — share of net sales</h2>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-ink">
          {comp.map((c) => (
            <div key={c.key} style={{ width: `${(c.amount / ns) * 100}%`, backgroundColor: c.color }} title={`${c.label} ${pct((c.amount / ns) * 100)}`} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {comp.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="text-[11px] text-muted">
                {c.label} <span className="tnum text-[#E6E8E4]">{pct((c.amount / ns) * 100)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly trend with target line */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Prime cost by week</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fill: "#8A8F89", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, yMax]} />
              <Tooltip cursor={{ fill: "#23262333" }} content={<ChartTip />} />
              <ReferenceLine y={data.targetPct} stroke="#8A8F89" strokeDasharray="4 4" />
              <Bar dataKey="primeCostPct" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chart.map((w) => (
                  <Cell
                    key={w.weekStart}
                    fill={w.primeCostPct > data.targetPct ? HEALTH_HEX.red : w.partial ? COPPER : COPPER_SOFT}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[10px] text-muted">Dashed line = target ({pct(data.targetPct, 0)}). Bars over target are red.</p>
      </div>

      {/* Weekly table */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Week of</th>
              <th className="px-4 py-2 text-right font-medium">Net Sales</th>
              <th className="px-4 py-2 text-right font-medium">COGS %</th>
              <th className="px-4 py-2 text-right font-medium">Labor %</th>
              <th className="px-4 py-2 text-right font-medium">Prime %</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.weekStart} className="border-b border-line/60 last:border-0">
                <td className="tnum px-4 py-2 text-muted">
                  {w.weekStart}
                  {w.partial ? <span className="ml-1 text-[10px]">(partial)</span> : null}
                </td>
                <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{money(w.netSales)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{pct(w.cogsPct)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{pct(w.laborPct)}</td>
                <td className={"tnum px-4 py-2 text-right " + (w.primeCostPct > data.targetPct ? "text-health-red" : "text-copper-soft")}>
                  {pct(w.primeCostPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Honest footnotes */}
      <p className="text-[11px] leading-relaxed text-muted">
        Prime Cost = (COGS + Labor) ÷ Net Sales — the share of every sales dollar consumed before rent,
        utilities, and other fixed costs. Net sales &amp; labor come from Toast; COGS is{" "}
        <span className="text-[#E6E8E4]">cash-basis</span> (counted when paid), so a large invoice can make a
        single week spike — the window total is the stable read. Beer COGS is included in actual prime cost but
        has no TAP target of its own yet.
      </p>
    </div>
  );
}
