import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import { money, pct } from "@/lib/format";
import { HealthSignal } from "@/components/health/HealthSignal";

export interface CategorySpend {
  name: string;
  amount: number;
}

// A second drill-down level: a named sub-bucket within a gauge (e.g. COGS →
// Food / Wine & Spirits / Beer) that itself expands to its vendor categories.
export interface SubGroup {
  key: string;
  label: string;
  amount: number;
  categories: CategorySpend[];
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
  // When present, the card drills into these sub-buckets first (each expands to
  // its own categories) instead of the flat `categories` list. Used by COGS.
  subGroups?: SubGroup[];
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
        <h2 className="font-display text-lg text-ink-text">Profit First — TAP Allocations</h2>
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
  const subGroups = g.subGroups ?? [];
  const hasSubs = subGroups.length > 0;
  const hasDrill = hasSubs || g.categories.length > 0;
  // Share of the gauge's actual spend each row represents (sub-buckets when
  // present, else flat categories).
  const total = hasSubs
    ? subGroups.reduce((s, sg) => s + sg.amount, 0)
    : g.categories.reduce((s, c) => s + c.amount, 0);

  // The honest read beside the health-colored bar (color-not-alone): how spend tracks
  // the virtual target. Over → the dollar overage; within → share of target consumed.
  const overTarget = g.spent - g.target;
  const verdict = g.usagePct > 100
    ? `${money(overTarget)} over target (${pct(g.usagePct, 0)})`
    : `${pct(g.usagePct, 0)} of target`;
  const breakdown = hasSubs
    ? subGroups.map((s) => s.label).join(" · ")
    : hasDrill
      ? `${g.categories.length} categor${g.categories.length === 1 ? "y" : "ies"}`
      : "";

  return (
    <details
      className={clsx(
        "group rounded-lg border border-line bg-surface px-4 py-3",
        hasDrill && "cursor-pointer",
      )}
    >
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-1 text-sm text-ink-text">
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
        <div className="tnum mt-1 text-lg text-ink-text">
          {money(g.spent)} <span className="text-muted">/ {money(g.target)}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink">
          <div
            className={clsx("h-full rounded-full transition-all", barColor[g.health])}
            style={{ width: `${Math.min(g.usagePct, 100)}%` }}
          />
        </div>
        <HealthSignal status={g.health} detail={verdict} className="mt-1.5" />
        {breakdown && <div className="mt-1 text-[11px] text-muted">{breakdown}</div>}
      </summary>

      {hasSubs && (
        <div className="mt-2 border-t border-line/60 pt-2">
          {/* Two-level deep-dive: COGS → Food / Wine & Spirits / Beer, each
              expanding to its vendor categories. Beer (COGS_BEVERAGE) has no TAP %
              of its own yet — it's included in the COGS total but the target stays
              the Food+Liquor TAP until percentages are set at /settings/allocation. */}
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
            <span>Breakdown</span>
            <span>Share · Spend</span>
          </div>
          <div className="space-y-1">
            {subGroups.map((sg) => (
              <SubGroupRow key={sg.key} sg={sg} total={total} />
            ))}
          </div>
        </div>
      )}

      {!hasSubs && hasDrill && (
        <div className="mt-2 border-t border-line/60 pt-2">
          {/* Visibility only — each category's share of this gauge's spend + the
              dollars. No per-category targets (operator decision: v1 is sightlines,
              not sub-budgets). For OpEx this share reads as "% of OpEx". */}
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
            <span>Category</span>
            <span>Share · Spend</span>
          </div>
          <ul className="space-y-1">
            {g.categories.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-ink-text">{c.name}</span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="tnum text-muted">{total > 0 ? pct((c.amount / total) * 100, 0) : "—"}</span>
                  <span className="tnum w-20 text-right text-ink-text">{money(c.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

// One sub-bucket inside a gauge's deep-dive (e.g. "Wine & Spirits" within COGS).
// Its own <details> so expanding it doesn't toggle the parent card; named group
// (`sub`) keeps its chevron independent of the card's chevron.
function SubGroupRow({ sg, total }: { sg: SubGroup; total: number }) {
  const hasCats = sg.categories.length > 0;
  const catTotal = sg.categories.reduce((s, c) => s + c.amount, 0);
  return (
    <details className="group/sub">
      <summary
        className={clsx(
          "flex list-none items-center justify-between gap-2 text-xs [&::-webkit-details-marker]:hidden",
          hasCats && "cursor-pointer",
        )}
      >
        <span className="flex items-center gap-1 text-ink-text">
          {hasCats && (
            <ChevronRight
              size={11}
              className="text-muted transition-transform group-open/sub:rotate-90"
            />
          )}
          {sg.label}
        </span>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="tnum text-muted">{total > 0 ? pct((sg.amount / total) * 100, 0) : "—"}</span>
          <span className="tnum w-20 text-right text-ink-text">{money(sg.amount)}</span>
        </span>
      </summary>
      {hasCats && (
        <ul className="ml-4 mt-1 space-y-1 border-l border-line/40 pl-2">
          {sg.categories.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted">{c.name}</span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="tnum text-muted/70">{catTotal > 0 ? pct((c.amount / catTotal) * 100, 0) : "—"}</span>
                <span className="tnum w-20 text-right text-ink-text">{money(c.amount)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
