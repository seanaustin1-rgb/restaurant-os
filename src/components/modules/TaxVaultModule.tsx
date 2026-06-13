import { clsx } from "clsx";
import { AlertTriangle, ShieldCheck, Info } from "lucide-react";
import type { TaxVaultData } from "@/lib/modules/tax-vault";
import { money, pct } from "@/lib/format";

export function TaxVaultModule({ data }: { data: TaxVaultData }) {
  const { sales, payroll, sourced } = data;
  const short = sourced && sales.status === "SHORT";
  const maxDay = data.daily.reduce((m, d) => Math.max(m, d.collected), 0);

  return (
    <div className="space-y-6">
      {/* Honest source banner. */}
      <p className="flex items-start gap-2 rounded-lg border border-line bg-surface/60 px-4 py-3 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-copper-soft" />
        <span>{data.note}</span>
      </p>

      {/* Sales tax — reserve OK / SHORT. */}
      <section>
        <h2 className="mb-2 font-display text-lg text-copper-soft">Sales tax</h2>
        <div
          className={clsx(
            "rounded-lg border px-4 py-4",
            !sourced
              ? "border-line bg-surface"
              : short
                ? "border-health-red/40 bg-health-red/5"
                : "border-health-green/30 bg-health-green/5",
          )}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Collected" value={sourced ? money(sales.collected) : "—"} />
            <Stat label="Pulled (Davo)" value={money(sales.pulled)} />
            <Stat
              label="Reserve"
              value={sourced ? money(sales.reserve) : "—"}
              tone={!sourced ? undefined : short ? "red" : "green"}
            />
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted">Status</div>
              {sourced ? (
                <div
                  className={clsx(
                    "mt-0.5 flex items-center gap-1 text-base font-medium",
                    short ? "text-health-red" : "text-health-green",
                  )}
                >
                  {short ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
                  {sales.status}
                </div>
              ) : (
                <div className="mt-0.5 text-base text-muted">n/a</div>
              )}
            </div>
          </div>
          {sourced && sales.effectiveRatePct !== null && (
            <p className="mt-3 text-[11px] text-muted">
              Effective rate <span className="tnum text-[#E6E8E4]">{pct(sales.effectiveRatePct, 2)}</span> of net
              sales — below PA&rsquo;s 6% because alcohol is sales-tax exempt (no liquor-by-drink tax in York County).
            </p>
          )}
        </div>
      </section>

      {/* Payroll tax — pulls only (honest about the missing accrual feed). */}
      <section>
        <h2 className="mb-2 font-display text-lg text-copper-soft">Payroll tax</h2>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[#E6E8E4]">Pulled this period</span>
            <span className="tnum text-base text-[#E6E8E4]">{money(payroll.pulled)}</span>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Forward payroll-tax accrual (employer FICA/FUTA/SUTA + withholdings per pay run) needs a payroll feed —
            not yet connected. Shown here: payroll-tax debits that cleared the bank.
          </p>
        </div>
      </section>

      {/* Daily collected — small bar list (only when sourced). */}
      {sourced && data.daily.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg text-copper-soft">Collected by day</h2>
          <div className="space-y-1.5 rounded-lg border border-line bg-surface px-4 py-3">
            {data.daily.map((d) => (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="w-14 shrink-0 text-muted">{d.label}</span>
                <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-ink">
                  <div
                    className="h-full rounded-full bg-copper-soft/70"
                    style={{ width: `${maxDay > 0 ? (d.collected / maxDay) * 100 : 0}%` }}
                  />
                </div>
                <span className="tnum w-16 shrink-0 text-right text-[#E6E8E4]">{money(d.collected)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div
        className={clsx(
          "tnum mt-0.5 text-base",
          tone === "red" ? "text-health-red" : tone === "green" ? "text-health-green" : "text-[#E6E8E4]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
