import { clsx } from "clsx";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { money, pct } from "@/lib/format";

export interface TapGauge {
  key: string;
  label: string;
  tapPct: number;
  target: number;
  spent: number;
  usagePct: number;
  health: HealthStatus;
}

const barColor: Record<HealthStatus, string> = {
  green: "bg-health-green",
  yellow: "bg-health-yellow",
  red: "bg-health-red",
};

export function TapGauges({ gauges, base }: { gauges: TapGauge[]; base: number }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-copper-soft">Profit First — TAP Allocations</h2>
        <span className="tnum text-xs text-muted">
          Total Sales {money(base)} · target = Sales × TAP%
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gauges.map((g) => (
          <div key={g.key} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[#E6E8E4]">{g.label}</span>
              <span className="tnum text-xs text-muted">{pct(g.tapPct, 0)}</span>
            </div>
            <div className="tnum mt-1 text-lg text-[#E6E8E4]">
              {money(g.spent)} <span className="text-muted">/ {money(g.target)}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink">
              <div
                className={clsx("h-full rounded-full transition-all", barColor[g.health])}
                style={{ width: `${Math.min(g.usagePct, 100)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[11px] text-muted">{pct(g.usagePct, 0)} of target</div>
          </div>
        ))}
      </div>
    </section>
  );
}
