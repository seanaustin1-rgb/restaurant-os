/**
 * Property Cockpit — leadership macro view for the vacation-rental / property vertical.
 * The rentals analogue of the brokerage ExecutiveCockpit: same hero + "one thing" +
 * macro tiles + ranked lists, but the unit of analysis is PROPERTIES, not agents.
 *
 * View-only — every value is read straight off the existing `RentalPropertyRollupData`
 * contract (data lane owns the property/portfolio math in property-portfolio.ts). The
 * only view logic is presentation ordering (red/yellow properties raised to the top as
 * early-action items) and tile tone bands that mirror property-heartbeat.ts thresholds.
 *
 * Rendered in the OutFront Data design system (DESIGN.md): matte Ink ground, Surface
 * panels, hairline Line borders, Space Mono figures via `.tnum`, serif (font-display)
 * headings, health vocabulary that never relies on color alone, and copper rationed to
 * the single "one thing" callout.
 */
import type { ReactNode } from "react";
import { Banknote, Building2, Percent, Scale, Star, Wrench } from "lucide-react";
import { HealthSignal } from "@/components/health/HealthSignal";
import { money, pct } from "@/lib/format";
import type { RentalPropertyRollupData } from "@/lib/modules/rental-property-rollup";
import type { PropertyHeartbeatResult } from "@/lib/demo/property-heartbeat";
import type { Health } from "@/lib/demo/estimate";

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const HEALTH_WORD: Record<Health, string> = { green: "On track", yellow: "Watch", red: "Off target" };

// Tinted status pill (DESIGN status-badge shape).
const BADGE: Record<Health, string> = {
  green: "border-health-green/30 bg-health-green/10 text-health-green",
  yellow: "border-health-yellow/30 bg-health-yellow/10 text-health-yellow",
  red: "border-health-red/35 bg-health-red/10 text-health-red",
};

// Severity order so red/yellow properties float to the top of the action list.
const HEALTH_RANK: Record<Health, number> = { red: 2, yellow: 1, green: 0 };

// Presentation tone bands — mirror the per-property thresholds in property-heartbeat.ts
// so a tile's tone matches how each property's own health was scored.
function proceedsTone(pctValue: number): Health {
  return pctValue >= 45 ? "green" : pctValue >= 30 ? "yellow" : "red";
}
function maintenanceTone(pctValue: number): Health {
  return pctValue <= 20 ? "green" : pctValue <= 28 ? "yellow" : "red";
}
function auraTone(score: number): Health {
  return score >= 75 ? "green" : score >= 55 ? "yellow" : "red";
}

function compactMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return money(n);
}

function PropertyCard({
  icon,
  label,
  value,
  tone,
  detail,
  signal,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: Health;
  detail?: string;
  signal?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-ink/40 p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        <span className="text-muted">{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`tnum mt-3 text-2xl ${tone ? HEALTH_TEXT[tone] : "text-ink-text"}`}>{value}</div>
      {signal ?? null}
      {detail ? <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p> : null}
    </section>
  );
}

function PropertyLine({ property }: { property: PropertyHeartbeatResult }) {
  const dot =
    property.overallHealth === "green"
      ? "bg-health-green"
      : property.overallHealth === "yellow"
        ? "bg-health-yellow"
        : "bg-health-red";
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate text-ink-text">{property.name}</span>
      </span>
      <span className="tnum shrink-0 text-ink-text">{compactMoney(property.ownerProceeds)}</span>
    </li>
  );
}

export function PropertyCockpit({ data, name }: { data: RentalPropertyRollupData; name: string }) {
  const portfolio = data.portfolio;
  if (!portfolio) return null;

  const flagged = portfolio.pressureCount + portfolio.watchCount;
  const one = portfolio.topPressure;
  const proceeds = proceedsTone(portfolio.ownerProceedsPct);

  // Early-action list: unhealthy properties raised to the top (red before yellow, then
  // thinnest owner proceeds first). Falls back to lowest proceeds when everything is green.
  const needsAction = [...portfolio.properties]
    .filter((p) => p.overallHealth !== "green")
    .sort((a, b) => HEALTH_RANK[b.overallHealth] - HEALTH_RANK[a.overallHealth] || a.ownerProceeds - b.ownerProceeds)
    .slice(0, 4);
  const lowestProceeds = [...portfolio.properties].sort((a, b) => a.ownerProceeds - b.ownerProceeds).slice(0, 4);
  const topPerformers = [...portfolio.properties].sort((a, b) => b.ownerProceeds - a.ownerProceeds).slice(0, 4);

  return (
    <article className="rounded-lg border border-line bg-surface p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Property Cockpit</div>
          <h2 className="mt-2 font-display text-2xl text-ink-text">{name}</h2>
          <p className="mt-1 text-sm text-muted">{data.periodLabel} · portfolio</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${BADGE[portfolio.overallHealth]}`}>
          {flagged > 0 ? (
            <>
              <span className="tnum">
                {flagged}/{portfolio.propertyCount}
              </span>{" "}
              need attention
            </>
          ) : (
            <>
              <span className="tnum">{portfolio.propertyCount}</span> healthy
            </>
          )}
        </span>
      </div>

      {/* The One Thing — the single rationed copper callout */}
      {one && one.overallHealth !== "green" ? (
        <div className="mt-5 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-copper-soft">The one thing</div>
          <p className="mt-1 text-sm leading-relaxed text-ink-text">
            <span className="font-medium">{one.name}</span> — {one.note}
          </p>
        </div>
      ) : null}

      {/* HERO — Booking revenue vs. owner proceeds (the honest-signal split) */}
      <section className="mt-5 rounded-lg border border-line bg-ink/40 p-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          <Scale className="h-4 w-4 text-copper-soft" aria-hidden="true" />
          <span>Bookings vs. owner proceeds</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted">What the bookings bring</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="tnum text-2xl text-ink-text">{compactMoney(portfolio.monthlyBookingRevenue)}</span>
              <span className="text-sm text-muted">booking revenue</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              <span className="tnum">{pct(portfolio.averageOccupancyPct, 0)}</span> avg occupancy ·{" "}
              <span className="tnum">{portfolio.propertyCount}</span> properties
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted">What the owner keeps</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`tnum text-2xl ${HEALTH_TEXT[proceeds]}`}>{compactMoney(portfolio.ownerProceeds)}</span>
              <span className="text-sm text-muted">owner proceeds</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              <span className="tnum">{pct(portfolio.ownerProceedsPct, 1)}</span> of revenue ·{" "}
              <span className="tnum">{compactMoney(portfolio.maintenanceCosts)}</span> upkeep
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Gross bookings only matter if they reach the owner. Watch the gap between booking revenue and retained owner
          proceeds.
        </p>
      </section>

      {/* Four macro tiles */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PropertyCard
          icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
          label="Owner proceeds"
          value={pct(portfolio.ownerProceedsPct, 1)}
          tone={proceeds}
          signal={<HealthSignal status={proceeds} label={HEALTH_WORD[proceeds]} detail="target 45%+" className="mt-2" />}
          detail="Revenue kept after cleaning, upkeep, platform, and management fees."
        />
        <PropertyCard
          icon={<Wrench className="h-4 w-4" aria-hidden="true" />}
          label="Maintenance drag"
          value={pct(portfolio.maintenancePressurePct, 1)}
          tone={maintenanceTone(portfolio.maintenancePressurePct)}
          signal={
            <HealthSignal
              status={maintenanceTone(portfolio.maintenancePressurePct)}
              label={HEALTH_WORD[maintenanceTone(portfolio.maintenancePressurePct)]}
              detail="of revenue"
              className="mt-2"
            />
          }
          detail="Cleaning + upkeep as a share of booking revenue."
        />
        <PropertyCard
          icon={<Star className="h-4 w-4" aria-hidden="true" />}
          label="Guest Aura"
          value={`${Math.round(portfolio.averageGuestAuraScore)}`}
          tone={auraTone(portfolio.averageGuestAuraScore)}
          signal={
            <HealthSignal
              status={auraTone(portfolio.averageGuestAuraScore)}
              label={HEALTH_WORD[auraTone(portfolio.averageGuestAuraScore)]}
              detail="of 100"
              className="mt-2"
            />
          }
          detail="Reviews, response time, and repeat-issue pressure across the portfolio."
        />
        <PropertyCard
          icon={<Percent className="h-4 w-4" aria-hidden="true" />}
          label="Occupancy"
          value={pct(portfolio.averageOccupancyPct, 0)}
          detail="Portfolio average booked nights against available nights."
        />
      </div>

      {/* Property production — ranked lists, unhealthy floated to the top */}
      <section className="mt-4 rounded-lg border border-line bg-ink/40 p-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          <Building2 className="h-4 w-4 text-copper-soft" aria-hidden="true" />
          <span>Property production</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          <span className="tnum">{portfolio.propertyCount}</span> properties ·{" "}
          <span className="tnum">{compactMoney(portfolio.ownerProceeds)}</span> owner proceeds · ranked by owner proceeds
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted">
              {needsAction.length ? "Needs attention" : "Watch"}
            </div>
            <ul className="mt-1 divide-y divide-line">
              {(needsAction.length ? needsAction : lowestProceeds).map((property) => (
                <PropertyLine key={property.name} property={property} />
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Top performers</div>
            <ul className="mt-1 divide-y divide-line">
              {topPerformers.map((property) => (
                <PropertyLine key={property.name} property={property} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Portfolio note footnote */}
      <p className="mt-4 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs leading-relaxed text-muted">
        {portfolio.note}
        {data.hasImportedRentalData ? "" : " Using onboarding assumptions until rental data is imported."}
      </p>
    </article>
  );
}
