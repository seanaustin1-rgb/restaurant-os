import { clsx } from "clsx";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { AllocationData, VarianceLine } from "@/lib/modules/allocation";
import { money, pct } from "@/lib/format";

const SIGNAL_BAR: Record<VarianceLine["signal"], string> = {
  green: "bg-health-green",
  yellow: "bg-health-yellow",
  red: "bg-health-red",
};
const SIGNAL_TEXT: Record<VarianceLine["signal"], string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

export function AllocationVariance({ data }: { data: AllocationData }) {
  return (
    <div className="space-y-6">
      {/* Why a rolling window — the spec's core principle, stated honestly. */}
      <p className="rounded-lg border border-line bg-surface/60 px-4 py-3 text-xs text-muted">
        Profit First says set aside a fixed share of every sales dollar. This compares what each operating bucket{" "}
        <em>should</em> have set aside against what actually cleared, over a{" "}
        <span className="text-[#E6E8E4]">{data.windowLabel}</span>. We read the <strong>rolling week</strong>, not the
        day — a Monday deposit batches the weekend, so any single day looks lumpy; the week tells the truth.
      </p>

      {/* Operating buckets — the variance line. */}
      <section>
        <h2 className="mb-2 font-display text-lg text-copper-soft">Operating buckets — 7-day variance</h2>
        <div className="space-y-2">
          {data.variance.map((v) => (
            <VarianceRow key={v.key} v={v} />
          ))}
        </div>
      </section>

      {/* Accrue-only buckets. */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg text-copper-soft">Set-aside buckets</h2>
          <span className="text-xs text-muted">
            next sweep <span className="text-[#E6E8E4]">{data.nextSweep}</span> ({data.daysToSweep}d)
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {data.accrue.map((a) => (
            <div key={a.key} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#E6E8E4]">{a.label}</span>
                <span className="tnum text-xs text-muted">{pct(a.tapPct, 0)}</span>
              </div>
              <div className="tnum mt-1 text-lg text-[#E6E8E4]">{money(a.accrued)}</div>
              <div className="mt-1 text-[11px] text-muted">
                {a.tapPct > 0 ? "accrued this period" : "no allocation set yet"}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Profit &amp; Owner&rsquo;s Pay sweep on the 10th &amp; 25th (simulation — no real money moves). Spill is a
          marketing/renovation reserve, swept manually.
        </p>
      </section>

      {/* Persisted bucket ledger (production phase) — running balances + sweeps. */}
      {data.ledger?.hasLedger && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-lg text-copper-soft">Bucket balances</h2>
            <span className="text-xs text-muted">
              {data.ledger.allocationDays} day{data.ledger.allocationDays === 1 ? "" : "s"} allocated
              {data.ledger.lastAllocatedAt ? ` · through ${data.ledger.lastAllocatedAt}` : ""}
            </span>
          </div>
          <p className="mb-2 text-[11px] text-muted">
            Persisted running balances — each day&rsquo;s net sales is split across the TAPs and accrued; draw-down
            buckets net the spend that&rsquo;s cleared. Profit &amp; Owner&rsquo;s Pay zero out when swept (10th &amp; 25th).
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.ledger.balances.map((b) => (
              <div key={b.key} className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-[#E6E8E4]">{b.name}</span>
                  <span className="tnum text-sm text-[#E6E8E4]">{money(b.balance)}</span>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
                  {b.kind}
                  {b.lastSweptAt ? ` · swept ${b.lastSweptAt}` : ""}
                </div>
              </div>
            ))}
          </div>
          {data.ledger.recentSweeps.length > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              Recent sweeps:{" "}
              {data.ledger.recentSweeps.map((s, i) => (
                <span key={i}>
                  {i > 0 ? " · " : ""}
                  <span className="text-[#E6E8E4]">{s.key === "owner_pay" ? "Owner's Pay" : "Profit"}</span>{" "}
                  {money(s.amount)} ({s.sweptAt})
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {/* Tax Reserve — binary OK / SHORT (top-priority alert). */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg text-copper-soft">Tax Reserve</h2>
          <a href="/modules/tax-vault" className="text-xs text-copper-soft underline-offset-2 hover:underline">
            full Tax Vault →
          </a>
        </div>
        {(() => {
          const sourced = data.tax.salesSourced;
          const short = sourced && data.tax.salesStatus === "SHORT";
          const frame = !sourced
            ? "border-health-yellow/30 bg-health-yellow/5"
            : short
              ? "border-health-red/40 bg-health-red/5"
              : "border-health-green/30 bg-health-green/5";
          return (
            <div className={clsx("rounded-lg border px-4 py-3", frame)}>
              <div className="flex items-start gap-2">
                {sourced ? (
                  short ? (
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-health-red" />
                  ) : (
                    <ShieldCheck size={15} className="mt-0.5 shrink-0 text-health-green" />
                  )
                ) : (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-health-yellow" />
                )}
                <div className="text-xs text-muted">{data.tax.note}</div>
              </div>
              {sourced && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted">Collected</div>
                    <div className="tnum text-base text-[#E6E8E4]">{money(data.tax.salesCollected)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted">Pulled (Davo)</div>
                    <div className="tnum text-base text-[#E6E8E4]">{money(data.tax.salesCleared)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted">Reserve</div>
                    <div
                      className={clsx(
                        "tnum text-base",
                        short ? "text-health-red" : "text-health-green",
                      )}
                    >
                      {money(data.tax.salesReserve)}{" "}
                      <span className="text-xs">({data.tax.salesStatus})</span>
                    </div>
                  </div>
                </div>
              )}
              {!sourced && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted">Sales tax pulled</div>
                    <div className="tnum text-base text-[#E6E8E4]">{money(data.tax.salesCleared)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted">Payroll tax pulled</div>
                    <div className="tnum text-base text-[#E6E8E4]">{money(data.tax.payrollCleared)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>
    </div>
  );
}

function VarianceRow({ v }: { v: VarianceLine }) {
  // Gap as a share of the bar: clamp to ±100% for the visual. With no
  // obligations in the window (pctDiff null) but money set aside, show a full
  // "ahead" bar rather than an empty one that reads as no progress.
  const gapPct = v.pctDiff ?? (v.dollarGap > 0 ? 100 : 0);
  const width = Math.min(Math.abs(gapPct), 100);
  const ahead = v.dollarGap >= 0;

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-sm text-[#E6E8E4]">
          {v.label}
          <span className="tnum text-xs text-muted">{v.unbudgeted ? "no TAP %" : pct(v.tapPct, 0)}</span>
        </span>
        <span className={clsx("tnum text-sm font-medium", SIGNAL_TEXT[v.signal])}>
          {ahead ? "+" : ""}
          {money(v.dollarGap)}
          {v.pctDiff !== null && <span className="ml-1 text-xs opacity-80">({ahead ? "+" : ""}{pct(v.pctDiff, 0)})</span>}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
        <span>
          set aside <span className="tnum text-[#E6E8E4]">{money(v.allocated)}</span> · owed{" "}
          <span className="tnum text-[#E6E8E4]">{money(v.obligations)}</span>
        </span>
        <span className={SIGNAL_TEXT[v.signal]}>{v.signal.toUpperCase()}</span>
      </div>

      {/* Direction bar: centered, fills toward green (right, ahead) or red (left, behind). */}
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-ink">
        <div className="flex w-1/2 justify-end">
          {!ahead && <div className={clsx("h-full rounded-l-full", SIGNAL_BAR[v.signal])} style={{ width: `${width}%` }} />}
        </div>
        <div className="flex w-1/2 justify-start">
          {ahead && <div className={clsx("h-full rounded-r-full", SIGNAL_BAR[v.signal])} style={{ width: `${width}%` }} />}
        </div>
      </div>

      {v.unbudgeted && (
        <p className="mt-2 text-[11px] text-health-red/90">
          Real beer spend with no Profit First allocation behind it — set Beer&rsquo;s TAP % at{" "}
          <span className="underline">/settings/allocation</span> once the percentages are confirmed.
        </p>
      )}
    </div>
  );
}
