"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowDownLeft, ArrowUpRight, Database, Layers } from "lucide-react";
import { clsx } from "clsx";
import type { CashFlowData } from "@/lib/modules/cash-flow";
import type { LedgerReadSource } from "@/lib/financial-ledger/ledger-coverage";
import { money } from "@/lib/format";

const GREEN = "#5FA777";
const RED = "#C8643A";

interface TipPayload {
  payload: { date: string; inflow: number; outflow: number; net: number };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-ink-text">{d.date}</div>
      <div className="tnum text-health-green">in {money(d.inflow)}</div>
      <div className="tnum text-health-red">out {money(d.outflow)}</div>
      <div className="tnum mt-0.5 border-t border-line/60 pt-0.5 text-ink-text">net {money(d.net)}</div>
    </div>
  );
}

export function CashFlowModule({ data }: { data: CashFlowData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No transactions in this period yet. Import a statement or connect a bank to see your cash flow.
      </div>
    );
  }

  const chart = data.days.map((d) => ({ ...d, day: d.date.slice(8) }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <ArrowDownLeft size={12} className="text-health-green" /> Money In
          </span>
          <div className="tnum mt-1 text-2xl text-health-green">{money(data.totalIn)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <ArrowUpRight size={12} className="text-health-red" /> Money Out
          </span>
          <div className="tnum mt-1 text-2xl text-health-red">{money(data.totalOut)}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Net Cash</span>
          <div className={"tnum mt-1 text-2xl " + (data.net >= 0 ? "text-health-green" : "text-health-red")}>
            {data.net >= 0 ? "+" : "−"}
            {money(Math.abs(data.net))}
          </div>
        </div>
      </div>

      {/* Source-trust indicator — which spine served the figures. */}
      <SourceTrust source={data.source} label={data.sourceLabel} pending={data.pendingReviewCount} />

      {/* Daily net chart */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Net by day</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="day" tick={{ fill: "#8A8F89", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <ReferenceLine y={0} stroke="#232623" />
              <Tooltip cursor={{ fill: "#23262333" }} content={<ChartTip />} />
              <Bar dataKey="net" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chart.map((d) => (
                  <Cell key={d.date} fill={d.net >= 0 ? GREEN : RED} />
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
              <th className="px-4 py-2 text-right font-medium">In</th>
              <th className="px-4 py-2 text-right font-medium">Out</th>
              <th className="px-4 py-2 text-right font-medium">Net</th>
              <th className="px-4 py-2 text-right font-medium">Running</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d) => (
              <tr key={d.date} className="border-b border-line/60 last:border-0">
                <td className="tnum px-4 py-2 text-muted">{d.date}</td>
                <td className="tnum px-4 py-2 text-right text-health-green">{d.inflow ? money(d.inflow) : "—"}</td>
                <td className="tnum px-4 py-2 text-right text-health-red">{d.outflow ? money(d.outflow) : "—"}</td>
                <td className={"tnum px-4 py-2 text-right " + (d.net >= 0 ? "text-ink-text" : "text-health-red")}>{money(d.net)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{money(d.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-line/60 sm:hidden">
          {data.days.map((d) => (
            <div key={d.date} className="p-3">
              <div className="flex items-center justify-between">
                <span className="tnum text-sm text-ink-text">{d.date}</span>
                <span className={"tnum text-sm " + (d.net >= 0 ? "text-health-green" : "text-health-red")}>
                  {d.net >= 0 ? "+" : "−"}
                  {money(Math.abs(d.net))}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted">
                <span className="tnum text-health-green">in {d.inflow ? money(d.inflow) : "—"}</span>
                <span className="tnum text-health-red">out {d.outflow ? money(d.outflow) : "—"}</span>
                <span className="tnum ml-auto">bal {money(d.running)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SourceTrust({ source, label, pending }: { source: LedgerReadSource; label: string; pending: number }) {
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
      {pending > 0 && (
        <span className="text-muted">
          {pending} event{pending === 1 ? "" : "s"} pending review
        </span>
      )}
    </div>
  );
}
