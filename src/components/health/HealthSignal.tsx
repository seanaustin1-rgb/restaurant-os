import { clsx } from "clsx";
import { AlertOctagon, AlertTriangle, CircleCheck } from "lucide-react";
import type { HealthStatus } from "@/lib/profit-first/calculator";

// The one place green/yellow/red turns into something a color-blind user can still
// read. PRODUCT.md hard rule: financial status never relies on color alone — so every
// signal pairs the health hue with a distinct-shaped icon AND a word. The number stays
// health-colored elsewhere (the fast read); this carries the honest read.
//
// Two render modes share one vocabulary:
//   - "inline"  → a verdict line under a value (the calm default, like the Benchmarks note)
//   - "badge"   → a tinted status pill for standalone hero numbers (DESIGN.md status-badge)
//
// `label` overrides the default word per context (cost tiles say "Over", Benchmarks
// "Off benchmark", a heartbeat lens "Act") while the icon set stays constant.

const DEFAULT_WORD: Record<HealthStatus, string> = {
  green: "On track",
  yellow: "Watch",
  red: "Over",
};

const ICON: Record<HealthStatus, typeof CircleCheck> = {
  green: CircleCheck,
  yellow: AlertTriangle,
  red: AlertOctagon,
};

const TEXT: Record<HealthStatus, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

// Tinted pill: health/10 fill, /30 border, health text — the documented status badge.
const BADGE: Record<HealthStatus, string> = {
  green: "border-health-green/30 bg-health-green/10 text-health-green",
  yellow: "border-health-yellow/30 bg-health-yellow/10 text-health-yellow",
  red: "border-health-red/35 bg-health-red/10 text-health-red",
};

export function HealthSignal({
  status,
  label,
  detail,
  mode = "inline",
  size = 13,
  className,
}: {
  status: HealthStatus;
  /** Override the default word for this context. Icon stays fixed by status. */
  label?: string;
  /** The honest magnitude, e.g. "2 pts over ≤32%" or "$2,400 over target (108%)". */
  detail?: string;
  mode?: "inline" | "badge";
  size?: number;
  className?: string;
}) {
  const Icon = ICON[status];
  const word = label ?? DEFAULT_WORD[status];

  if (mode === "badge") {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium",
          BADGE[status],
          className,
        )}
      >
        <Icon size={size - 2} aria-hidden />
        {word}
      </span>
    );
  }

  return (
    <span className={clsx("flex items-center gap-1.5 text-xs", TEXT[status], className)}>
      <Icon size={size} aria-hidden className="shrink-0" />
      <span className="font-medium">{word}</span>
      {detail && <span className="font-normal text-muted">· {detail}</span>}
    </span>
  );
}
