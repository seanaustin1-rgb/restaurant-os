"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CreditCard, AlertTriangle, Target, TrendingDown } from "lucide-react";
import type { ProcessingFeesData } from "@/lib/modules/processing-fees";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { money, money2, pct } from "@/lib/format";

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
const FC_COLORS = ["#C8873A", "#9C6B2E", "#7A5326", "#B5832F", "#6E4F25", "#8A6230"];

interface TipPayload {
  payload: { label: string; sales: number; fees: number; ratePct: number; partial: boolean };
}
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-[#E6E8E4]">
        {d.label}
        {d.partial ? <span className="ml-1 text-muted">(in progress)</span> : null}
      </div>
      <div className="tnum text-copper-soft">{pct(d.ratePct, 2)} of sales</div>
      <div className="tnum text-muted">{money(d.fees)} on {money(d.sales)}</div>
    </div>
  );
}

export function ProcessingFeesModule({ data }: { data: ProcessingFeesData }) {
  const chart = data.months.map((m) => ({ ...m }));
  const yMax = Math.max(data.targetRatePct, ...data.months.map((m) => m.ratePct), data.ratePct, 1) * 1.2;
  const over = data.ratePct > data.targetRatePct;
  const feeTotal = data.totalFees || 1;

  return (
    <div className="space-y-6">
      {/* Net-settlement / low-coverage warning */}
      {data.lowCoverage && (
        <div className="rounded-lg border border-health-yellow/40 bg-surface p-4">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-health-yellow">
            <AlertTriangle size={13} /> We may not be seeing all your fees
          </span>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            Detected fees come to just <span className="tnum text-[#E6E8E4]">{pct(data.ratePct, 2)}</span> of
            sales — well below the ~2.5–3% a card-accepting restaurant normally pays. That usually means your
            processor (often Toast) <span className="text-[#E6E8E4]">settles net</span> — deducting fees before
            the deposit — so they never appear as their own bank charge. To see the true rate, compare gross
            Toast sales against net bank deposits, or pull a processor statement. The figures below cover only
            fees billed as separate transactions.
          </p>
        </div>
      )}

      {/* Headline */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <CreditCard size={12} className="text-copper-soft" /> Effective Rate
          </span>
          <div className={"tnum mt-1 text-3xl " + HEALTH_TEXT[data.health]}>{pct(data.ratePct, 2)}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            <Target size={11} /> benchmark ≤ {pct(data.targetRatePct, 2)}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Fees Paid</span>
          <div className="tnum mt-1 text-2xl text-[#E6E8E4]">{money(data.totalFees)}</div>
          <div className="mt-0.5 text-[11px] text-muted">on {money(data.salesBase)} gross sales</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">Leak vs. Benchmark</span>
          <div className={"tnum mt-1 text-2xl " + (data.leakDollars > 0 ? "text-health-red" : "text-health-green")}>
            {data.leakDollars > 0 ? money(data.annualizedLeak) : money(0)}
            <span className="ml-1 text-xs text-muted">/yr</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {data.leakDollars > 0 ? `+${pct(data.leakPct, 2)} over benchmark` : "at or under benchmark"}
          </div>
        </div>
      </div>

      {/* Leak callout */}
      {!data.lowCoverage && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
              <TrendingDown size={12} className={over ? "text-health-red" : "text-health-green"} />
              {over ? "Running over benchmark" : "Within benchmark"}
            </span>
            <span className={"tnum text-sm " + (over ? "text-health-red" : "text-health-green")}>
              {over ? `${money(data.leakDollars)} over this window` : "no leak detected"}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {over
              ? `At ${pct(data.ratePct, 2)} you're paying ${pct(data.leakPct, 2)} above a ${pct(
                  data.targetRatePct,
                  2,
                )} benchmark — about ${money(data.annualizedLeak)}/yr. Common culprits: non-qualified downgrades,
                 PCI/statement junk fees, and assessment creep. A statement audit or processor re-quote is the lever.`
              : `At ${pct(data.ratePct, 2)} you're at or below the ${pct(
                  data.targetRatePct,
                  2,
                )} benchmark — no obvious leak. Watch the trend below for creep.`}
          </p>
        </div>
      )}

      {/* By processor */}
      {data.processors.length > 0 && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs uppercase tracking-wider text-muted">By processor</h2>
            <span className="tnum text-xs text-muted">{money(data.totalFees)}</span>
          </div>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-ink">
            {data.processors.map((p, i) => (
              <div
                key={p.processor}
                style={{ width: `${(p.amount / feeTotal) * 100}%`, backgroundColor: FC_COLORS[i % FC_COLORS.length] }}
                title={`${p.processor} ${money(p.amount)}`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.processors.slice(0, 6).map((p, i) => (
              <div key={p.processor} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: FC_COLORS[i % FC_COLORS.length] }}
                />
                <span className="truncate text-[11px] text-muted">
                  {p.processor} <span className="tnum text-[#E6E8E4]">{money(p.amount)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly rate trend */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted">Effective rate by month</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fill: "#8A8F89", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, yMax]} />
              <Tooltip cursor={{ fill: "#23262333" }} content={<ChartTip />} />
              <ReferenceLine y={data.targetRatePct} stroke="#8A8F89" strokeDasharray="4 4" />
              <Bar dataKey="ratePct" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chart.map((m) => (
                  <Cell
                    key={m.month}
                    fill={m.ratePct > data.targetRatePct ? HEALTH_HEX.red : m.partial ? "#9C6B2E" : "#D9A35E"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[10px] text-muted">
          Dashed line = benchmark ({pct(data.targetRatePct, 2)}). Bars above it are red. A rising line is rate
          creep — downgrades or new fees eating margin.
        </p>
      </div>

      {/* Detected fee line items (auditable) */}
      {data.lineItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="border-b border-line bg-surface px-4 py-2 text-[11px] uppercase tracking-wider text-muted">
            Detected fee charges — what&apos;s counted
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Processor</th>
                <th className="px-4 py-2 font-medium">Charge</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((li, i) => (
                <tr key={`${li.date}-${i}`} className="border-b border-line/60 last:border-0">
                  <td className="tnum px-4 py-2 text-muted">{li.date}</td>
                  <td className="px-4 py-2 text-copper-soft">{li.processor}</td>
                  <td className="max-w-[16rem] truncate px-4 py-2 text-muted">{li.merchant}</td>
                  <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{money2(li.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Honest footnotes */}
      <p className="text-[11px] leading-relaxed text-muted">
        Effective rate = detected card fees ÷ gross sales. Fees are matched from categorized bank transactions
        against known processors and card-fee descriptors — the table above is exactly what&apos;s counted, so
        you can audit it. Gross sales (incl. tax, excl. tips) is a proxy for card volume; true card volume is a
        bit higher, so your real effective rate is modestly <span className="text-[#E6E8E4]">lower</span> than
        shown. If your processor settles net (deducts fees before deposit), those fees won&apos;t appear here —
        compare gross Toast sales to net bank deposits to see them.
      </p>
    </div>
  );
}
