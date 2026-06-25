"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { SalesMixData } from "@/lib/modules/sales-mix";
import { money, pct, count } from "@/lib/format";

// Copper-family palette for revenue-center slices (largest → smallest).
const SLICE_COLORS = ["#C8873A", "#D9A35E", "#7A5526", "#5FA777", "#8A8F89", "#C8643A", "#4A6B7A"];

interface TipPayload {
  payload: { revenueCenter: string; netSales: number; share: number; orders: number };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-ink-text">{d.revenueCenter}</div>
      <div className="tnum text-copper-soft">{money(d.netSales)}</div>
      <div className="tnum text-muted">{pct(d.share)} · {count(d.orders)} orders</div>
    </div>
  );
}

export function SalesMixModule({ data }: { data: SalesMixData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No revenue-center sales in this window yet. Run the sales-mix sync.
      </div>
    );
  }

  const chart = data.centers.map((c, i) => ({ ...c, color: SLICE_COLORS[i % SLICE_COLORS.length] }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Net Sales (window)</span>
          <div className="tnum mt-1 text-2xl text-ink-text">{money(data.totalNet)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Top Center</span>
          <div className="tnum mt-1 text-2xl text-copper-soft">{data.topCenter?.revenueCenter ?? "—"}</div>
          {data.topCenter ? (
            <div className="mt-0.5 text-[11px] text-muted">{pct(data.topCenter.share)} of sales</div>
          ) : null}
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Revenue Centers</span>
          <div className="tnum mt-1 text-2xl text-ink-text">{count(data.centers.length)}</div>
        </div>
      </div>

      {/* Donut + legend */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chart}
                dataKey="netSales"
                nameKey="revenueCenter"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={1.5}
                stroke="#141614"
                isAnimationActive={false}
              >
                {chart.map((c) => (
                  <Cell key={c.revenueCenter} fill={c.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col justify-center gap-2">
          {chart.map((c) => (
            <div key={c.revenueCenter} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="text-ink-text">{c.revenueCenter}</span>
              <span className="tnum ml-auto text-muted">{pct(c.share)}</span>
              <span className="tnum w-20 text-right text-copper-soft">{money(c.netSales)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Revenue Center</th>
              <th className="px-4 py-2 text-right font-medium">Net Sales</th>
              <th className="px-4 py-2 text-right font-medium">Share</th>
              <th className="px-4 py-2 text-right font-medium">Orders</th>
              <th className="px-4 py-2 text-right font-medium">Guests</th>
            </tr>
          </thead>
          <tbody>
            {data.centers.map((c) => (
              <tr key={c.revenueCenter} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2 text-ink-text">{c.revenueCenter}</td>
                <td className="tnum px-4 py-2 text-right text-copper-soft">{money(c.netSales)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{pct(c.share)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{count(c.orders)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{count(c.guests)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
