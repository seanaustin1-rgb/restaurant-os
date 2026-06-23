import Link from "next/link";
import { AlertTriangle, Home, Search, Wrench } from "lucide-react";
import { money, pct } from "@/lib/format";
import { buildPropertyActionQueue } from "@/lib/demo/property-action-queue";
import type { RentalPropertyRollupData } from "@/lib/modules/rental-property-rollup";
import type { Health } from "@/lib/demo/estimate";

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

function badgeCls(health: Health): string {
  if (health === "green") return "border-health-green/30 bg-health-green/10 text-health-green";
  if (health === "yellow") return "border-health-yellow/30 bg-health-yellow/10 text-health-yellow";
  return "border-health-red/30 bg-health-red/10 text-health-red";
}

export function PropertyHeartbeatModule({ data }: { data: RentalPropertyRollupData }) {
  const portfolio = data.portfolio;

  if (!portfolio) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line text-copper-soft">
          <Home size={18} />
        </div>
        <p className="mt-3 text-sm text-muted">No rental property imports yet.</p>
        <Link href="/import/rentals" className="mt-4 inline-block rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft">
          Import rental data
        </Link>
      </div>
    );
  }

  const actions = buildPropertyActionQueue(portfolio.properties, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
              <Home size={12} className="text-copper-soft" /> Portfolio heartbeat
            </span>
            <div className={"mt-1 text-2xl " + HEALTH_TEXT[portfolio.overallHealth]}>{portfolio.note}</div>
            <div className="mt-0.5 text-[11px] text-muted">
              {portfolio.propertyCount} properties - {portfolio.healthyCount} healthy - {portfolio.watchCount} watch - {portfolio.pressureCount} pressure
            </div>
          </div>
          <Link href="/import/rentals" className="text-xs text-copper-soft hover:underline">
            Import more data
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Booking revenue" value={money(portfolio.monthlyBookingRevenue)} />
          <Stat label="Owner proceeds" value={money(portfolio.ownerProceeds)} tone={portfolio.ownerProceedsPct >= 45 ? "green" : portfolio.ownerProceedsPct >= 30 ? "yellow" : "red"} />
          <Stat label="Proceeds %" value={pct(portfolio.ownerProceedsPct)} />
          <Stat label="Maintenance drag" value={pct(portfolio.maintenancePressurePct)} tone={portfolio.maintenancePressurePct <= 20 ? "green" : portfolio.maintenancePressurePct <= 28 ? "yellow" : "red"} />
          <Stat label="Avg Aura" value={Math.round(portfolio.averageGuestAuraScore).toLocaleString()} tone={portfolio.averageGuestAuraScore >= 75 ? "green" : portfolio.averageGuestAuraScore >= 55 ? "yellow" : "red"} />
        </div>
      </div>

      {actions.length > 0 && (
        <div className="rounded-lg border border-copper-dim/40 bg-copper-dim/10 p-4">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-copper-soft">
            <AlertTriangle size={12} /> Operator action queue
          </span>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {actions.map((item) => (
              <div key={`${item.propertyName}-${item.kind}`} className="rounded-lg border border-line bg-ink/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm text-[#E6E8E4]">{item.title}</div>
                    <div className="text-[11px] text-muted">{item.propertyName}</div>
                  </div>
                  <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(item.priority)}>
                    {item.priority === "red" ? "urgent" : "watch"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {portfolio.properties.map((property) => (
          <div key={property.name} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-sm text-[#E6E8E4]">
                  <Home size={14} className="text-copper-soft" /> {property.name}
                </div>
                <div className={"mt-0.5 text-[11px] " + HEALTH_TEXT[property.overallHealth]}>{property.note}</div>
              </div>
              <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(property.overallHealth)}>
                {portfolio.topPressure?.name === property.name ? "highest pressure" : property.overallHealth}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              <Stat label="Revenue" value={money(property.monthlyBookingRevenue)} />
              <Stat label="Owner proceeds" value={money(property.ownerProceeds)} tone={property.ownerProceedsHealth} />
              <Stat label="Occupancy" value={pct(property.occupancyPct, 0)} />
              <Stat label="ADR" value={money(property.averageDailyRate)} />
              <Stat label="Maintenance" value={pct(property.maintenancePressurePct)} tone={property.maintenanceHealth} />
              <Stat label="Aura" value={Math.round(property.guestAuraScore).toLocaleString()} tone={property.guestAuraHealth} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Wrench size={12} className="text-copper-soft" /> {property.openIssues} open issues
              </span>
              <span className="flex items-center gap-1">
                <Search size={12} className="text-copper-soft" /> Booking pace {pct(property.bookingPacePct, 0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: Health }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={"tnum text-xl " + (tone ? HEALTH_TEXT[tone] : "text-[#E6E8E4]")}>{value}</div>
    </div>
  );
}
