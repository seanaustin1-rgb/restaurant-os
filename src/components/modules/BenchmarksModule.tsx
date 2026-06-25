"use client";

import { Gauge } from "lucide-react";
import type { BenchmarksData, BenchmarkRow } from "@/lib/modules/benchmarks";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { pct } from "@/lib/format";

const HEALTH_HEX: Record<HealthStatus, string> = {
  green: "#5FA777",
  yellow: "#D9A35E",
  red: "#C8643A",
};
const HEALTH_TEXT: Record<HealthStatus, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};
const OVERALL_LABEL: Record<HealthStatus, string> = {
  green: "On benchmark",
  yellow: "Watch a few",
  red: "Off benchmark",
};

const clampPct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));

// Build the colored zone segments (green/yellow/red) for one metric's axis.
function zones(row: BenchmarkRow): { color: string; width: number }[] {
  const segs: { color: string; width: number }[] = [];
  const toPct = (v: number) => clampPct(v, row.scaleMax);
  if (row.lowerIsBetter && row.greenMax != null && row.yellowMax != null) {
    const g = toPct(row.greenMax);
    const y = toPct(row.yellowMax);
    segs.push({ color: HEALTH_HEX.green, width: g });
    segs.push({ color: HEALTH_HEX.yellow, width: y - g });
    segs.push({ color: HEALTH_HEX.red, width: 100 - y });
  } else if (!row.lowerIsBetter && row.greenMin != null && row.yellowMin != null) {
    const y = toPct(row.yellowMin);
    const g = toPct(row.greenMin);
    segs.push({ color: HEALTH_HEX.red, width: y });
    segs.push({ color: HEALTH_HEX.yellow, width: g - y });
    segs.push({ color: HEALTH_HEX.green, width: 100 - g });
  }
  return segs;
}

function MetricBar({ row }: { row: BenchmarkRow }) {
  const left = clampPct(row.value, row.scaleMax);
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-text">{row.label}</span>
        <span className={"tnum text-lg " + HEALTH_TEXT[row.status]}>{pct(row.value)}</span>
      </div>

      {/* Zone bar with value marker */}
      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ink">
        <div className="flex h-full w-full">
          {zones(row).map((z, i) => (
            <div key={i} style={{ width: `${z.width}%`, backgroundColor: z.color, opacity: 0.35 }} />
          ))}
        </div>
      </div>
      <div className="relative h-0">
        <div
          className="absolute top-[-13px] h-3 w-0.5 -translate-x-1/2 rounded bg-ink-text"
          style={{ left: `${left}%` }}
          title={`${row.label} ${pct(row.value)}`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted">
          typical <span className="tnum text-muted">{row.typicalLow}–{row.typicalHigh}%</span>
        </span>
        <span className={HEALTH_TEXT[row.status]}>{row.note}</span>
      </div>
    </div>
  );
}

export function BenchmarksModule({ data }: { data: BenchmarksData }) {
  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="rounded-lg border border-line bg-surface px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
              <Gauge size={12} className="text-copper-soft" /> Benchmark standing
            </span>
            <div className={"mt-1 text-2xl " + HEALTH_TEXT[data.overall]}>{OVERALL_LABEL[data.overall]}</div>
            <div className="mt-0.5 text-[11px] text-muted">
              {data.greenCount} of {data.rows.length} metrics within range · {data.cohort}
            </div>
          </div>
        </div>
      </div>

      {/* Metric bars */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.rows.map((row) => (
          <MetricBar key={row.key} row={row} />
        ))}
      </div>

      {/* Honest footnote */}
      <p className="text-[11px] leading-relaxed text-muted">
        Ranges are <span className="text-ink-text">static industry reference figures</span> for{" "}
        {data.cohort.toLowerCase()} (Prime ≤60%, COGS 28–32%, Labor 28–34%, Net Margin ≥6%) — not live peer data,
        so read them as guide-rails, not a leaderboard. They&apos;ll be replaced with real cohort percentiles
        once a peer dataset is connected. Your figures use the trailing 8-week window: net sales &amp; labor from
        Toast; COGS, operating costs &amp; debt service cash-basis from categorized transactions.
      </p>
    </div>
  );
}
