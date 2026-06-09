import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { money, pct } from "@/lib/format";

export interface CategorySpend {
  name: string;
  amount: number;
}

export interface TapGauge {
  key: string;
  label: string;
  tapPct: number;
  target: number;
  spent: number;
  usagePct: number;
  health: HealthStatus;
  categories: CategorySpend[];
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
          <GaugeCard key={g.key} g={g} />
        ))}
      </div>
    </section>
  );
}

function GaugeCard({ g }: { g: TapGauge }) {
  const hasDrill = g.categories.length > 0;
  // Share of the gauge's actual spend each category represents.
  const total = g.categories.reduce((s, c) => s + c.amount, 0);

  return (
    <details
      className={clsx(
        "group rounded-lg border border-line bg-surface px-4 py-3",
        hasDrill && "cursor-pointer",
      )}
    >
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-1 text-sm text-[#E6E8E4]">
            {hasDrill && (
              <ChevronRight
                size={13}
                className="text-muted transition-transform group-open:rotate-90"
              />
            )}
            {g.label}
          </span>
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
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
          <span>{hasDrill ? `${g.categories.length} categor${g.categories.length === 1 ? "y" : "ies"}` : ""}</span>
          <span>{pct(g.usagePct, 0)} of target</span>
        </div>
      </summary>

      {hasDrill && (
        <ul className="mt-2 space-y-1 border-t border-line/60 pt-2">
          {g.categories.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-[#E6E8E4]">{c.name}</span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="tnum text-muted">{total > 0 ? pct((c.amount / total) * 100, 0) : "—"}</span>
                <span className="tnum w-20 text-right text-[#E6E8E4]">{money(c.amount)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
