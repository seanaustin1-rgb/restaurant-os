import { clsx } from "clsx";
import type { HealthStatus } from "@/lib/profit-first/calculator";

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
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  health?: HealthStatus;
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
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
