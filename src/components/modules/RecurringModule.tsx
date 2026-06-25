"use client";

import { RefreshCw, TrendingUp, Repeat } from "lucide-react";
import type { RecurringData, Cadence } from "@/lib/modules/recurring";
import { money, money2, count } from "@/lib/format";

const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "daily",
  weekly: "weekly",
  biweekly: "every 2 wks",
  monthly: "monthly",
  irregular: "irregular",
  unknown: "—",
};

export function RecurringModule({ data }: { data: RecurringData }) {
  if (!data.hasData) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No recurring charges detected yet. Import more bank history to find repeating vendors.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <RefreshCw size={12} className="text-copper-soft" /> Est. Monthly Recurring
          </span>
          <div className="tnum mt-1 text-2xl text-copper-soft">{money(data.totalEstMonthly)}</div>
          <div className="mt-0.5 text-[11px] text-muted">{money(data.totalEstMonthly * 12)} / year</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Repeat size={12} /> Recurring Vendors
          </span>
          <div className="tnum mt-1 text-2xl text-ink-text">{count(data.vendors.length)}</div>
          <div className="mt-0.5 text-[11px] text-muted">
            {count(data.subscriptionCount)} subscription-like (fixed price)
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <TrendingUp size={12} className={data.creepCount > 0 ? "text-health-red" : ""} /> Price Creep
          </span>
          <div className={"tnum mt-1 text-2xl " + (data.creepCount > 0 ? "text-health-red" : "text-health-green")}>
            {count(data.creepCount)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {data.creepCount > 0 ? "vendor(s) charging more than before" : "no rising charges detected"}
          </div>
        </div>
      </div>

      {/* Vendor table — desktop */}
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Cadence</th>
              <th className="px-4 py-2 text-right font-medium">Hits</th>
              <th className="px-4 py-2 text-right font-medium">Avg</th>
              <th className="px-4 py-2 text-right font-medium">Last</th>
              <th className="px-4 py-2 text-right font-medium">Est / Mo</th>
            </tr>
          </thead>
          <tbody>
            {data.vendors.map((v) => (
              <tr key={v.vendor} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2">
                  <span className="text-ink-text">{v.vendor}</span>
                  {v.subscriptionLike ? (
                    <span className="ml-2 rounded bg-line/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                      sub
                    </span>
                  ) : null}
                  {v.creepPct != null && v.creepPct > 0 ? (
                    <span className="tnum ml-2 rounded bg-health-red/15 px-1.5 py-0.5 text-[10px] text-health-red">
                      ▲ {v.creepPct.toFixed(0)}%
                    </span>
                  ) : null}
                  {v.categoryName ? (
                    <div className="text-[11px] text-muted">{v.categoryName}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-muted">{CADENCE_LABEL[v.cadence]}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{count(v.count)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{money2(v.avgAmount)}</td>
                <td className="tnum px-4 py-2 text-right text-ink-text">{money2(v.lastAmount)}</td>
                <td className="tnum px-4 py-2 text-right text-copper-soft">{money(v.estMonthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="divide-y divide-line/60 sm:hidden">
          {data.vendors.map((v) => (
            <div key={v.vendor} className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-text">
                  {v.vendor}
                  {v.creepPct != null && v.creepPct > 0 ? (
                    <span className="tnum ml-2 text-[10px] text-health-red">▲ {v.creepPct.toFixed(0)}%</span>
                  ) : null}
                </span>
                <span className="tnum text-sm text-copper-soft">{money(v.estMonthly)}/mo</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                <span>{CADENCE_LABEL[v.cadence]}</span>
                <span className="tnum">{count(v.count)}×</span>
                <span className="tnum ml-auto">last {money2(v.lastAmount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Honest footnote */}
      <p className="text-[11px] leading-relaxed text-muted">
        Detected from repeating vendor charges (≥3 at a steady interval) plus known recurring vendors.
        &ldquo;Est / Mo&rdquo; projects the cadence to 30 days. Variable pulls (payroll, sales-tax, supplier
        deliveries) are recurring but not subscriptions — the <span className="text-ink-text">sub</span> badge marks
        fixed-price charges, where price creep is meaningful.
        {data.shortHistory ? (
          <>
            {" "}
            <span className="text-health-yellow">
              Only {data.windowDays} days of bank history — monthly subscriptions may appear once and cadence/creep
              calls are tentative; import more statements to firm them up.
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
