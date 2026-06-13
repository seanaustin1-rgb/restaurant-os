"use client";

import { ShieldCheck, Copy, Zap } from "lucide-react";
import type { PaymentWatchData } from "@/lib/modules/payment-watch";
import { money, money2, count } from "@/lib/format";

export function PaymentWatchModule({ data }: { data: PaymentWatchData }) {
  const likely = data.duplicates.filter((d) => d.tier === "likely");
  const review = data.duplicates.filter((d) => d.tier === "review");
  const allClear = data.duplicates.length === 0 && data.unusual.length === 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Copy size={12} className={data.duplicates.length ? "text-health-red" : ""} /> Possible Duplicates
          </span>
          <div className={"tnum mt-1 text-2xl " + (data.duplicates.length ? "text-health-red" : "text-health-green")}>
            {count(data.duplicates.length)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {count(likely.length)} likely · {count(review.length)} worth a look
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Zap size={12} className={data.unusual.length ? "text-health-yellow" : ""} /> Unusual Charges
          </span>
          <div className={"tnum mt-1 text-2xl " + (data.unusual.length ? "text-health-yellow" : "text-health-green")}>
            {count(data.unusual.length)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">3×+ the vendor&apos;s usual charge</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <ShieldCheck size={12} className={allClear ? "text-health-green" : "text-copper-soft"} /> Flagged Total
          </span>
          <div className={"tnum mt-1 text-2xl " + (allClear ? "text-health-green" : "text-copper-soft")}>
            {money(data.flaggedTotal)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">{allClear ? "all clear this window" : "review before assuming"}</div>
        </div>
      </div>

      {allClear ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No duplicate or off-norm payments detected in this window. The watch re-runs on every
          page load as new statements are imported.
        </div>
      ) : (
        <>
          {/* Duplicates */}
          {data.duplicates.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2 font-medium">Possible duplicate</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-right font-medium">First</th>
                    <th className="px-4 py-2 text-right font-medium">Again</th>
                    <th className="px-4 py-2 text-right font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duplicates.map((d, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2">
                        <span className="text-[#E6E8E4]">{d.vendor ?? d.description}</span>
                        <span
                          className={
                            "ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide " +
                            (d.tier === "likely" ? "bg-health-red/15 text-health-red" : "bg-line/60 text-muted")
                          }
                        >
                          {d.tier === "likely" ? "likely" : "look"}
                        </span>
                        {/* Show both references; distinct check #s mean it's two payments, not one cashed twice. */}
                        {d.distinctRefs ? (
                          <div className="text-[11px] text-muted">
                            {d.firstDescription} <span className="text-muted/70">→</span> {d.description}
                            <span className="ml-1 text-muted/70">(different references)</span>
                          </div>
                        ) : d.vendor ? (
                          <div className="text-[11px] text-muted">{d.description}</div>
                        ) : null}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-copper-soft">{money2(d.amount)}</td>
                      <td className="tnum px-4 py-2 text-right text-muted">{d.firstDate}</td>
                      <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{d.secondDate}</td>
                      <td className="tnum px-4 py-2 text-right text-muted">{d.gapDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Unusual */}
          {data.unusual.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2 font-medium">Unusual charge</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-right font-medium">Vendor usual</th>
                    <th className="px-4 py-2 text-right font-medium">Ratio</th>
                    <th className="px-4 py-2 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unusual.map((u, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2">
                        <span className="text-[#E6E8E4]">{u.vendor}</span>
                        <div className="text-[11px] text-muted">{u.description}</div>
                      </td>
                      <td className="tnum px-4 py-2 text-right text-health-yellow">{money2(u.amount)}</td>
                      <td className="tnum px-4 py-2 text-right text-muted">{money2(u.medianAmount)}</td>
                      <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{u.ratio.toFixed(1)}×</td>
                      <td className="tnum px-4 py-2 text-right text-muted">{u.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      {/* Honest footnote */}
      <p className="text-[11px] leading-relaxed text-muted">
        Review lists, not verdicts — same-amount repeats can be legitimate (two invoices, two register runs) and a
        big charge can be a real one-off order. <span className="text-[#E6E8E4]">Likely</span> = same vendor &amp;
        exact amount within 3 days. <span className="text-[#E6E8E4]">Look</span> = same amount ≥ $500 within 10 days
        (catches double-cashed checks, which carry no vendor name). Unusual = 3×+ the vendor&apos;s median across ≥4
        charges.
      </p>
    </div>
  );
}
