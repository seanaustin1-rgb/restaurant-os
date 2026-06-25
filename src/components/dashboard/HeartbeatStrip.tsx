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

// The honest read that rides alongside the health color: how far the metric sits from
// its target, in plain percentage points. "2 pts over ≤32%" / "1.4 pts under ≤18%".
function costVerdict(value: number, target: number): string {
  const delta = value - target;
  const mag = Math.abs(delta);
  if (mag < 0.5) {
    if (delta > 0) return `just over ≤${target}%`;
    if (delta < 0) return `just under ≤${target}%`;
    return `at ≤${target}% limit`;
  }
  const pts = mag >= 10 ? mag.toFixed(0) : (Math.round(mag * 10) / 10).toString();
  return `${pts} pt${pts === "1" ? "" : "s"} ${delta > 0 ? "over" : "under"} ≤${target}%`;
}

function CostMetric({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <MetricCard
      label={label}
      value={pct(value)}
      health={costHealth(value, target)}
      healthDetail={costVerdict(value, target)}
    />
  );
}

export function HeartbeatStrip({ data }: { data: HeartbeatData }) {
  const spark = data.coversSparkline;
  const last = spark[spark.length - 1] ?? 0;
  const prev = spark[spark.length - 2] ?? last;
  const flow = last - prev;
  const flowPct = prev ? (flow / prev) * 100 : 0;

  return (
    <section>
      <h2 className="mb-2 font-display text-lg text-[#E6E8E4]">Heartbeat</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CostMetric label="Prime Cost" value={data.primeCostPct} target={60} />
        <CostMetric label="Labor Cost" value={data.laborPct} target={32} />
        <CostMetric label="Food Cost" value={data.foodPct} target={18} />
        <CostMetric label="Liquor Cost" value={data.liquorPct} target={12} />
        <CostMetric label="Beverage Cost" value={data.beveragePct} target={4} />
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
