import { clsx } from "clsx";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { HealthSignal } from "@/components/health/HealthSignal";

const healthText: Record<HealthStatus, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

export function MetricCard({
  label,
  value,
  sub,
  health,
  healthLabel,
  healthDetail,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  health?: HealthStatus;
  /** Word override for the HealthSignal (defaults to On track / Watch / Over). */
  healthLabel?: string;
  /** Honest magnitude for the verdict line, e.g. "2 pts over ≤32%". */
  healthDetail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-start justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
        {children}
      </div>
      <div className={clsx("tnum mt-1 text-2xl", health ? healthText[health] : "text-[#E6E8E4]")}>
        {value}
      </div>
      {/* A health tile carries its verdict in words+icon (color-not-alone); a plain
          tile keeps its muted sub. */}
      {health ? (
        <HealthSignal status={health} label={healthLabel} detail={healthDetail ?? sub} className="mt-1" />
      ) : (
        sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>
      )}
    </div>
  );
}
