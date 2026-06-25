"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MenuEngineeringData, MenuItemStat, Quadrant } from "@/lib/modules/menu-engineering";
import { money, money2, count } from "@/lib/format";

const QUADRANTS: Record<Quadrant, { label: string; color: string; hint: string }> = {
  star: { label: "Stars", color: "#5FA777", hint: "popular & high revenue — protect & feature" },
  workhorse: { label: "Workhorses", color: "#D9A35E", hint: "popular, lower revenue — nudge price/pairings" },
  puzzle: { label: "Puzzles", color: "#4A6B7A", hint: "high revenue, low volume — promote or reposition" },
  dog: { label: "Dogs", color: "#C8643A", hint: "low volume & revenue — candidates to cut" },
};

interface TipPayload {
  payload: MenuItemStat;
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-ink-text">{d.name}</div>
      <div className="tnum text-copper-soft">{money(d.netSales)} · {count(d.quantity)} sold</div>
      <div className="tnum text-muted">{money2(d.avgPrice)} avg · {QUADRANTS[d.quadrant].label.replace(/s$/, "")}</div>
    </div>
  );
}

export function MenuEngineeringModule({ data }: { data: MenuEngineeringData }) {
  const [filter, setFilter] = useState<Quadrant | "all">("all");

  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No menu-item sales in this window yet. Run the menu sync.
      </div>
    );
  }

  const visible = filter === "all" ? data.items : data.items.filter((i) => i.quadrant === filter);

  return (
    <div className="space-y-6">
      {/* Quadrant summary cards (click to filter the table) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(QUADRANTS) as Quadrant[]).map((q) => (
          <button
            key={q}
            onClick={() => setFilter(filter === q ? "all" : q)}
            className={
              "rounded-lg border bg-surface px-4 py-3 text-left transition-colors " +
              (filter === q ? "border-copper" : "border-line hover:border-line/80")
            }
          >
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: QUADRANTS[q].color }} />
              {QUADRANTS[q].label}
            </span>
            <div className="tnum mt-1 text-2xl" style={{ color: QUADRANTS[q].color }}>
              {count(data.counts[q])}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted">{QUADRANTS[q].hint}</div>
          </button>
        ))}
      </div>

      {/* Scatter: popularity (x) × revenue (y) */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">
          Items by quantity sold &amp; net revenue · medians split the quadrants
        </h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke="#232623" strokeDasharray="2 4" />
              <XAxis
                type="number"
                dataKey="quantity"
                name="qty"
                tick={{ fill: "#8A8F89", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="netSales"
                name="net"
                tick={{ fill: "#8A8F89", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${Math.round(v / 100) / 10}k`}
              />
              <ReferenceLine x={data.medianQuantity} stroke="#3A3E3A" />
              <ReferenceLine y={data.medianNetSales} stroke="#3A3E3A" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTip />} />
              <Scatter data={data.items} isAnimationActive={false}>
                {data.items.map((i) => (
                  <Cell key={i.menuItemGuid} fill={QUADRANTS[i.quadrant].color} fillOpacity={0.85} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Item table (filtered by selected quadrant) */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">
                Item {filter !== "all" ? `· ${QUADRANTS[filter].label}` : `· top ${Math.min(visible.length, 25)}`}
              </th>
              <th className="px-4 py-2 text-right font-medium">Sold</th>
              <th className="px-4 py-2 text-right font-medium">Net Sales</th>
              <th className="px-4 py-2 text-right font-medium">Avg Price</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 25).map((i) => (
              <tr key={i.menuItemGuid} className="border-b border-line/60 last:border-0">
                <td className="flex items-center gap-2 px-4 py-2 text-ink-text">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: QUADRANTS[i.quadrant].color }} />
                  {i.name}
                </td>
                <td className="tnum px-4 py-2 text-right text-muted">{count(i.quantity)}</td>
                <td className="tnum px-4 py-2 text-right text-copper-soft">{money(i.netSales)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{money2(i.avgPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Honest footnote */}
      <p className="text-[11px] leading-relaxed text-muted">
        Quadrants split on <span className="text-ink-text">median quantity ({count(data.medianQuantity)})</span> and{" "}
        <span className="text-ink-text">median net revenue ({money(data.medianNetSales)})</span>. Classic menu
        engineering uses contribution <span className="text-ink-text">margin</span>; item costs aren&apos;t available
        from Toast Analytics, so this is popularity × revenue — directional, not a margin verdict. $0-revenue items
        (water, comps) are excluded.
      </p>
    </div>
  );
}
