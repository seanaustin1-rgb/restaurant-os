"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Users, Receipt, TrendingUp } from "lucide-react";
import type { CoversFlowData } from "@/lib/modules/covers-flow";
import { money2, count } from "@/lib/format";

const COPPER = "#C8873A";
const COPPER_SOFT = "#D9A35E";

interface TipPayload {
  payload: { date: string; covers: number; orders: number; avgCheck: number };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-ink-text">{d.date}</div>
      <div className="tnum text-copper-soft">{count(d.covers)} covers</div>
      <div className="tnum text-muted">{count(d.orders)} orders</div>
      <div className="tnum mt-0.5 border-t border-line/60 pt-0.5 text-ink-text">{money2(d.avgCheck)} avg check</div>
    </div>
  );
}

export function CoversFlowModule({ data }: { data: CoversFlowData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No covers data in this period yet. Run the Toast sync to pull daily guests &amp; orders.
      </div>
    );
  }

  const chart = data.days.map((d) => ({ ...d, day: d.date.slice(8) }));
  const busiestDate = data.busiest?.date;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Users size={12} className="text-copper-soft" /> Avg Covers / Day
          </span>
          <div className="tnum mt-1 text-2xl text-copper-soft">{count(Math.round(data.avgCoversPerDay))}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Receipt size={12} /> Avg Check
          </span>
          <div className="tnum mt-1 text-2xl text-ink-text">{money2(data.avgCheck)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <TrendingUp size={12} /> Total Covers
          </span>
          <div className="tnum mt-1 text-2xl text-ink-text">{count(data.totalCovers)}</div>
          {data.busiest ? (
            <div className="mt-0.5 text-[11px] text-muted">
              busiest {data.busiest.date} · {count(data.busiest.covers)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Covers by day */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Covers by day</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="day"
                tick={{ fill: "#8A8F89", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip cursor={{ fill: "#23262333" }} content={<ChartTip />} />
              <Bar dataKey="covers" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chart.map((d) => (
                  <Cell key={d.date} fill={d.date === busiestDate ? COPPER_SOFT : COPPER} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily breakdown — table on desktop, cards on phone/tablet */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 text-right font-medium">Covers</th>
              <th className="px-4 py-2 text-right font-medium">Orders</th>
              <th className="px-4 py-2 text-right font-medium">Avg Check</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d) => (
              <tr key={d.date} className="border-b border-line/60 last:border-0">
                <td className="tnum px-4 py-2 text-muted">{d.date}</td>
                <td className="tnum px-4 py-2 text-right text-copper-soft">{count(d.covers)}</td>
                <td className="tnum px-4 py-2 text-right text-ink-text">{count(d.orders)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{d.avgCheck ? money2(d.avgCheck) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-line/60 sm:hidden">
          {data.days.map((d) => (
            <div key={d.date} className="p-3">
              <div className="flex items-center justify-between">
                <span className="tnum text-sm text-ink-text">{d.date}</span>
                <span className="tnum text-sm text-copper-soft">{count(d.covers)} covers</span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted">
                <span className="tnum">{count(d.orders)} orders</span>
                <span className="tnum ml-auto">{d.avgCheck ? money2(d.avgCheck) : "—"} avg</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
