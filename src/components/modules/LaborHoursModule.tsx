"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Clock, TrendingUp, TrendingDown, Percent } from "lucide-react";
import type { LaborHoursData } from "@/lib/modules/labor-hours";
import { money, pct } from "@/lib/format";

const COPPER = "#C8873A";
const COPPER_SOFT = "#D9A35E";

const hrs = (n: number) => `${n.toFixed(1)}h`;

interface TipPayload {
  payload: { weekStart: string; hours: number; salesPerLaborHour: number; laborPct: number };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-[#E6E8E4]">week of {d.weekStart}</div>
      <div className="tnum text-copper-soft">{hrs(d.hours)}</div>
      <div className="tnum text-muted">{money(d.salesPerLaborHour)}/labor hr</div>
      <div className="tnum mt-0.5 border-t border-line/60 pt-0.5 text-[#E6E8E4]">{pct(d.laborPct)} of sales</div>
    </div>
  );
}

export function LaborHoursModule({ data }: { data: LaborHoursData }) {
  if (!data.hasData || !data.latest) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No labor data in this period yet. Run the Toast sync to pull daily labor hours.
      </div>
    );
  }

  const chart = data.weeks.map((w) => ({ ...w, label: w.weekStart.slice(5) }));
  const latest = data.latest;
  const delta = data.wowHoursDelta;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Clock size={12} className="text-copper-soft" /> Latest Week — Hours
          </span>
          <div className="tnum mt-1 text-2xl text-copper-soft">
            {hrs(latest.hours)}
            {latest.partial ? <span className="ml-1 align-middle text-[11px] text-muted">(partial)</span> : null}
          </div>
          {delta !== null ? (
            <div
              className={
                "mt-0.5 flex items-center gap-1 text-[11px] " +
                (delta <= 0 ? "text-health-green" : "text-health-red")
              }
            >
              {delta <= 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
              {delta >= 0 ? "+" : "−"}
              {Math.abs(delta).toFixed(1)}h vs prior full week
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <TrendingUp size={12} /> Sales / Labor Hour
          </span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{money(latest.salesPerLaborHour)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Percent size={12} /> Labor % of Sales
          </span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{pct(latest.laborPct)}</div>
        </div>
      </div>

      {/* Hours by week */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Actual hours by week</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fill: "#8A8F89", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#23262333" }} content={<ChartTip />} />
              <Bar dataKey="hours" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chart.map((w) => (
                  <Cell key={w.weekStart} fill={w.partial ? COPPER : COPPER_SOFT} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly table */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Week of</th>
              <th className="px-4 py-2 text-right font-medium">Hours</th>
              <th className="px-4 py-2 text-right font-medium">Labor $</th>
              <th className="px-4 py-2 text-right font-medium">$/Hr</th>
              <th className="px-4 py-2 text-right font-medium">Labor %</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.weekStart} className="border-b border-line/60 last:border-0">
                <td className="tnum px-4 py-2 text-muted">
                  {w.weekStart}
                  {w.partial ? <span className="ml-1 text-[10px]">(partial)</span> : null}
                </td>
                <td className="tnum px-4 py-2 text-right text-copper-soft">{hrs(w.hours)}</td>
                <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{money(w.laborCost)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{money(w.salesPerLaborHour)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{pct(w.laborPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Honest footnotes */}
      <p className="text-[11px] leading-relaxed text-muted">
        Actual worked hours from Toast. <span className="text-[#E6E8E4]">Scheduled-vs-actual variance</span> is
        coming once Sling scheduling is connected.
        {data.hasYoY ? "" : " Year-over-year hidden until a matching prior-year week exists."}
      </p>
    </div>
  );
}
