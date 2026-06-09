import { MetricCard } from "./MetricCard";
import { Sparkline } from "./Sparkline";
import { getHealthStatus, type HealthStatus } from "@/lib/profit-first/calculator";
import { count, pct } from "@/lib/format";

export interface HeartbeatData {
  primeCostPct: number;
  laborPct: number;
  foodPct: number;
  liquorPct: number;
  beveragePct: number;
  coversMTD: number;
  coversSparkline: number[];
}

// For cost metrics, lower is better — derive health from how the value tracks a target.
function costHealth(value: number, target: number): HealthStatus {
  // usage = value/target as a %; reuse the same green/yellow/red bands.
  return getHealthStatus((value / target) * 100);
}

export function HeartbeatStrip({ data }: { data: HeartbeatData }) {
  const spark = data.coversSparkline;
  const last = spark[spark.length - 1] ?? 0;
  const prev = spark[spark.length - 2] ?? last;
  const flow = last - prev;
  const flowPct = prev ? (flow / prev) * 100 : 0;

  return (
    <section>
      <h2 className="mb-2 font-display text-lg text-copper-soft">Heartbeat</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Prime Cost" value={pct(data.primeCostPct)} health={costHealth(data.primeCostPct, 60)} sub="target ≤ 60%" />
        <MetricCard label="Labor Cost" value={pct(data.laborPct)} health={costHealth(data.laborPct, 32)} sub="target ≤ 32%" />
        <MetricCard label="Food Cost" value={pct(data.foodPct)} health={costHealth(data.foodPct, 18)} sub="target ≤ 18%" />
        <MetricCard label="Liquor Cost" value={pct(data.liquorPct)} health={costHealth(data.liquorPct, 12)} sub="target ≤ 12%" />
        <MetricCard label="Beverage Cost" value={pct(data.beveragePct)} health={costHealth(data.beveragePct, 4)} sub="target ≤ 4%" />
        <MetricCard label="Covers" value={count(data.coversMTD)} sub="month to date">
          <div className="flex flex-col items-end gap-1">
            <Sparkline data={spark} />
            <span
              className={
                "tnum rounded px-1.5 py-0.5 text-[10px] " +
                (flow >= 0 ? "bg-health-green/15 text-health-green" : "bg-health-red/15 text-health-red")
              }
            >
              {flow >= 0 ? "▲" : "▼"} {Math.abs(flowPct).toFixed(0)}%
            </span>
          </div>
        </MetricCard>
      </div>
    </section>
  );
}
