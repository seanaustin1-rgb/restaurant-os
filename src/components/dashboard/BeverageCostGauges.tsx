import { clsx } from "clsx";
import Link from "next/link";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { money, pct } from "@/lib/format";

// A beverage cost ratio = alcohol COGS ÷ matching alcohol sales (a "pour cost"),
// judged against an operator-set target where lower is better. Split into liquor
// and beer/beverage per the operator decision — two gauges, not one combined.
export interface CostRatioGauge {
  key: string; // "liquor" | "beverage"
  label: string;
  cogs: number; // numerator $
  sales: number; // denominator $ (0 when unknown)
  costPct: number | null; // cogs/sales*100, null when no denominator
  target: number | null; // target pour %, null when unset
  health: HealthStatus;
  // Where the denominator came from: real per-day POS split, estimated from the
  // manual sales-mix %, or nothing yet (prompt the operator to set it up).
  basis: "actual" | "estimated" | "none";
}

const barColor: Record<HealthStatus, string> = {
  green: "bg-health-green",
  yellow: "bg-health-yellow",
  red: "bg-health-red",
};

export function BeverageCostGauges({ gauges, demoMode = false }: { gauges: CostRatioGauge[]; demoMode?: boolean }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg text-copper-soft">Beverage Cost Ratios</h2>
        <span className="text-xs text-muted">cost ÷ alcohol sales · lower is better</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {gauges.map((g) => (
          <RatioCard key={g.key} g={g} demoMode={demoMode} />
        ))}
      </div>
    </section>
  );
}

function RatioCard({ g, demoMode }: { g: CostRatioGauge; demoMode: boolean }) {
  const hasRatio = g.costPct != null;
  const hasTarget = g.target != null;
  // Fill = how much of target the ratio uses (lower is better). Capped for the bar.
  const fill = hasRatio && hasTarget && g.target! > 0 ? Math.min((g.costPct! / g.target!) * 100, 100) : 0;

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-[#E6E8E4]">{g.label}</span>
        <span className="tnum text-xs text-muted">{hasTarget ? `target ≤ ${pct(g.target!, 0)}` : "no target"}</span>
      </div>

      {hasRatio ? (
        <>
          <div className="tnum mt-1 text-lg text-[#E6E8E4]">
            {pct(g.costPct!, 1)}
            <span className="ml-2 text-xs text-muted">{money(g.cogs)} / {money(g.sales)}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink">
            <div
              className={clsx("h-full rounded-full transition-all", hasTarget ? barColor[g.health] : "bg-line")}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {g.basis === "actual"
              ? "of alcohol sales · from POS"
              : "of alcohol sales · estimated from your sales mix"}
            {g.basis === "estimated" && !demoMode && (
              <>
                {" "}
                <Link href="/settings/beverage" className="text-copper-soft hover:underline">
                  adjust
                </Link>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-2 text-xs text-muted">
          No alcohol-sales figure yet.{" "}
          {demoMode ? (
            "Set your sales mix"
          ) : (
            <Link href="/settings/beverage" className="text-copper-soft hover:underline">
              Set your sales mix
            </Link>
          )}{" "}
          to see this ratio (or connect Toast).
        </div>
      )}
    </div>
  );
}
