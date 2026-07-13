import { clsx } from "clsx";
import { AlertTriangle, CalendarClock, Info, ShieldCheck, TrendingDown } from "lucide-react";
import type { ForwardCashData, ObligationKind } from "@/lib/modules/forward-cash";
import { CashFloorControl } from "@/components/modules/CashFloorControl";
import { money } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

const KIND_LABEL: Record<ObligationKind, string> = {
  payroll: "Payroll",
  sweep: "Sweep",
  recurring: "Recurring",
};

export function ForwardCashModule({ data }: { data: ForwardCashData }) {
  if (!data.hasAnchor) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        {data.note}
      </div>
    );
  }

  const start = data.startBalance ?? 0;
  const low = data.lowPoint;
  const breach = data.breachesZero;
  // Bar strip scaling: floor at 0 so a negative day reads as an empty (red) column.
  const maxBal = Math.max(start, ...data.days.map((d) => d.balance), 1);
  const obligationDays = data.days.filter((d) => d.obligations.length > 0);

  return (
    <div className="space-y-6">
      {/* Honest source banner. */}
      <p className="flex items-start gap-2 rounded-lg border border-line bg-surface/60 px-4 py-3 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-copper-soft" />
        <span>
          {data.note}
          {data.staleDays != null && data.staleDays > 3 ? ` Starting balance is ${data.staleDays} days old.` : ""}
        </span>
      </p>

      {/* The beat: the low-point. */}
      <section
        className={clsx(
          "rounded-lg border px-4 py-4",
          breach ? "border-health-red/40 bg-health-red/5" : "border-line bg-surface",
        )}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <TrendingDown size={13} className={breach ? "text-health-red" : "text-copper-soft"} />
          Projected low-point · next {data.windowDays} days
        </div>
        {low ? (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={clsx("tnum text-2xl", breach ? "text-health-red" : "text-ink-text")}>
              {money(low.balance)}
            </span>
            <span className="text-sm text-muted">on {dayLabel(low.date)}</span>
            {breach && (
              <span className="inline-flex items-center gap-1 text-xs text-health-red">
                <AlertTriangle size={13} /> goes negative
              </span>
            )}
          </div>
        ) : (
          <div className="mt-1 text-sm text-muted">No dated obligations found to project.</div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Starting cash" value={money(start)} />
          <Stat label="Scheduled out" value={money(data.totalScheduledOut)} />
          <Stat label={`End (day ${data.windowDays})`} value={money(data.endBalance ?? start)} />
        </div>
      </section>

      {/* Cash floor + sweep safety (B6). */}
      <section className="space-y-3">
        {data.floor?.state === "breach" && (
          <p className="flex items-start gap-2 rounded-lg border border-health-red/40 bg-health-red/5 px-4 py-3 text-xs leading-relaxed text-health-red">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{data.floor.readout}</span>
          </p>
        )}
        {data.floor?.state === "ok" && (
          <p className="flex items-start gap-2 rounded-lg border border-health-green/30 bg-health-green/5 px-4 py-3 text-xs leading-relaxed text-health-green">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <span>{data.floor.readout}</span>
          </p>
        )}
        <CashFloorControl current={data.cashFloor} />
      </section>

      {/* 30-day balance strip. */}
      <section>
        <h2 className="mb-2 font-display text-lg text-ink-text">Projected balance</h2>
        <div className="flex h-28 items-end gap-[3px] rounded-lg border border-line bg-surface px-3 py-3">
          {data.days.map((day) => {
            const isLow = low != null && day.date === low.date;
            const hasOb = day.obligations.length > 0;
            const h = Math.max(2, (Math.max(0, day.balance) / maxBal) * 100);
            return (
              <div
                key={day.date}
                className="group relative flex h-full flex-1 items-end"
                title={`${dayLabel(day.date)}: ${money(day.balance)}${hasOb ? ` — ${day.obligations.map((o) => o.label).join(", ")}` : ""}`}
              >
                <div
                  className={clsx(
                    "w-full rounded-sm",
                    day.balance < 0
                      ? "bg-health-red/70"
                      : isLow
                        ? "bg-health-red/60"
                        : hasOb
                          ? "bg-copper-soft/70"
                          : "bg-line",
                  )}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-copper-soft/70" /> obligation day</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-health-red/60" /> low-point</span>
        </div>
      </section>

      {/* Obligation timeline. */}
      {obligationDays.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg text-ink-text">What&rsquo;s coming</h2>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <tbody>
                {obligationDays.flatMap((day) =>
                  day.obligations.map((o, i) => (
                    <tr key={`${day.date}-${i}`} className="border-b border-line/60 last:border-0">
                      <td className="w-16 px-4 py-2 text-xs text-muted">{i === 0 ? dayLabel(day.date) : ""}</td>
                      <td className="px-4 py-2 text-ink-text">{o.label}</td>
                      <td className="px-2 py-2">
                        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                          {KIND_LABEL[o.kind]}
                        </span>
                      </td>
                      <td className={clsx("tnum px-4 py-2 text-right", o.amount < 0 ? "text-health-green" : "text-ink-text")}>
                        {o.amount < 0 ? `+${money(-o.amount)}` : `−${money(o.amount)}`}
                      </td>
                      <td className="tnum px-4 py-2 text-right text-muted">{i === 0 ? money(day.balance) : ""}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
            <CalendarClock size={12} /> {data.obligationCount} scheduled item{data.obligationCount === 1 ? "" : "s"} over the window · timing inferred from history.
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="tnum mt-0.5 text-base text-ink-text">{value}</div>
    </div>
  );
}
