import Link from "next/link";
import type React from "react";
import { Activity, Banknote, CircleDollarSign, Gauge, Megaphone } from "lucide-react";
import type { HealthStatus } from "@/lib/profit-first/calculator";
import type { DashboardData } from "@/lib/dashboard/data";
import { industryTemplateFor } from "@/lib/industry-templates";
import { money, pct } from "@/lib/format";

type LensKey = "cash" | "discipline" | "pressure" | "momentum" | "aura";

interface HeartbeatLens {
  key: LensKey;
  label: string;
  status: HealthStatus;
  statusLabel: string;
  value: string;
  detail: string;
  action: string;
  href: string;
}

const STATUS_TEXT: Record<HealthStatus, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const STATUS_BORDER: Record<HealthStatus, string> = {
  green: "border-health-green/35 bg-health-green/5",
  yellow: "border-health-yellow/35 bg-health-yellow/5",
  red: "border-health-red/40 bg-health-red/5",
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  green: "steady",
  yellow: "watch",
  red: "act",
};

const ICONS = {
  cash: Banknote,
  discipline: CircleDollarSign,
  pressure: Gauge,
  momentum: Activity,
  aura: Megaphone,
};

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("yellow")) return "yellow";
  return "green";
}

function cashLens(data: DashboardData): HeartbeatLens {
  const cash = data.goLiveCoach.cashSafety;
  const status: HealthStatus = cash.ready ? "green" : cash.hasAnchor ? "red" : "yellow";
  return {
    key: "cash",
    label: "Cash oxygen",
    status,
    statusLabel: cash.ready ? "breathing room" : cash.hasAnchor ? "below floor" : "needs anchor",
    value: cash.currentCash != null ? money(cash.currentCash) : "Unknown",
    detail:
      cash.currentCash != null && cash.minimumOperatingCash != null
        ? `${money(cash.minimumOperatingCash)} floor, ${money(cash.pilotSetAside)} virtual pilot set-aside`
        : "Set a cash anchor so the heartbeat can judge runway and pilot safety.",
    action: "open Go-Live Coach",
    href: "/modules/go-live",
  };
}

function disciplineLens(data: DashboardData): HeartbeatLens {
  const coach = data.goLiveCoach;
  const status: HealthStatus =
    coach.stage === "coach" ? "yellow" : coach.stage === "pilot_ready" || coach.stage === "enforce_ready" ? "green" : "yellow";
  const coverage = pct(coach.categorizationCoveragePct, 0);
  return {
    key: "discipline",
    label: "Profit discipline",
    status,
    statusLabel: coach.stageLabel.toLowerCase(),
    value: coverage,
    detail: `${coach.checks.find((c) => c.key === "categorization")?.detail ?? "Named-dollar coverage"}; ${coach.summary}`,
    action: "review readiness",
    href: "/modules/go-live",
  };
}

function pressureLens(data: DashboardData): HeartbeatLens {
  if (data.businessType === "VACATION_RENTAL") {
    const portfolio = data.rentalPropertyRollup?.portfolio;
    const status: HealthStatus = portfolio?.overallHealth ?? "yellow";
    return {
      key: "pressure",
      label: "Property pressure",
      status,
      statusLabel: STATUS_LABEL[status],
      value: portfolio ? pct(portfolio.maintenancePressurePct, 1) : "Waiting",
      detail: portfolio
        ? `${portfolio.pressureCount} properties need attention; ${portfolio.topPressure?.name ?? "no property"} is the top pressure point.`
        : "Import bookings, owner statements, expenses, maintenance, and reviews to read property pressure.",
      action: "inspect properties",
      href: "/modules/property-heartbeat",
    };
  }

  if (data.businessType === "REAL_ESTATE_BROKERAGE") {
    return {
      key: "pressure",
      label: "Split pressure",
      status: "yellow",
      statusLabel: "needs deals",
      value: "Waiting",
      detail: "Import agents, deals, splits, caps, and brokerage expenses to read Company Dollar pressure.",
      action: "review pilot plan",
      href: "/reports/rental-pilot",
    };
  }

  const status = worstStatus(data.gauges.map((g) => g.health));
  const worstGauge = [...data.gauges].sort((a, b) => b.usagePct - a.usagePct)[0];
  return {
    key: "pressure",
    label: "Operating pressure",
    status,
    statusLabel: STATUS_LABEL[status],
    value: pct(data.heartbeat.primeCostPct, 1),
    detail: worstGauge
      ? `${worstGauge.label} is using ${pct(worstGauge.usagePct, 0)} of its virtual target.`
      : "No operating pressure visible yet.",
    action: "inspect TAPs",
    href: "/dashboard",
  };
}

function momentumLens(data: DashboardData): HeartbeatLens {
  if (data.businessType === "VACATION_RENTAL") {
    const portfolio = data.rentalPropertyRollup?.portfolio;
    const status: HealthStatus = portfolio ? portfolio.overallHealth : "yellow";
    return {
      key: "momentum",
      label: "Booking momentum",
      status,
      statusLabel: portfolio ? STATUS_LABEL[status] : "waiting",
      value: portfolio ? money(portfolio.monthlyBookingRevenue) : "Waiting",
      detail: portfolio
        ? `${portfolio.propertyCount} properties, ${pct(portfolio.averageOccupancyPct, 0)} average occupancy, ${money(portfolio.ownerProceeds)} owner proceeds.`
        : "Import rental bookings to see occupancy, ADR, booking pace, and owner proceeds.",
      action: "import rental data",
      href: "/import/rentals",
    };
  }

  if (data.businessType === "REAL_ESTATE_BROKERAGE") {
    return {
      key: "momentum",
      label: "Pipeline momentum",
      status: "yellow",
      statusLabel: "needs pipeline",
      value: "Waiting",
      detail: "Import pending deals and expected close dates to see forward Company Dollar.",
      action: "review pilot plan",
      href: "/reports/rental-pilot",
    };
  }

  const spark = data.heartbeat.coversSparkline;
  const last = spark[spark.length - 1] ?? 0;
  const prev = spark[spark.length - 2] ?? last;
  const flow = last - prev;
  const status: HealthStatus = data.revenue.revenueMTD <= 0 ? "yellow" : flow < 0 ? "yellow" : "green";
  return {
    key: "momentum",
    label: "Sales momentum",
    status,
    statusLabel: flow < 0 ? "softening" : data.revenue.revenueMTD > 0 ? "moving" : "waiting",
    value: money(data.revenue.revenueMTD),
    detail:
      data.revenue.revenueMTD > 0
        ? `${pct(data.revenue.checkAverage > 0 ? (flow / Math.max(prev, 1)) * 100 : 0, 0)} latest cover flow; ${money(data.revenue.realRevenueMTD)} real revenue.`
        : "Connect POS sales to see demand momentum.",
    action: "view revenue",
    href: "/dashboard",
  };
}

function auraLens(): HeartbeatLens {
  return {
    key: "aura",
    label: "Aura",
    status: "yellow",
    statusLabel: "connect intent",
    value: "Waiting",
    detail: "Wire reviews plus Google calls, directions, website clicks, and profile views for the outside-world heartbeat.",
    action: "open Aura",
    href: "/modules/aura",
  };
}

function buildLenses(data: DashboardData): HeartbeatLens[] {
  return [cashLens(data), disciplineLens(data), pressureLens(data), momentumLens(data), auraLens()];
}

function headline(lenses: HeartbeatLens[]): string {
  const red = lenses.filter((l) => l.status === "red");
  const yellow = lenses.filter((l) => l.status === "yellow");
  if (red.length > 0) return `${red[0].label} needs attention first.`;
  if (yellow.length > 1) return `${yellow.length} heartbeat areas need watching.`;
  if (yellow.length === 1) return `${yellow[0].label} is the main watch item.`;
  return "Heartbeat is steady across the visible signals.";
}

function nextAction(lenses: HeartbeatLens[]): HeartbeatLens {
  return lenses.find((l) => l.status === "red") ?? lenses.find((l) => l.status === "yellow") ?? lenses[0];
}

export function HeartbeatSummary({ data, demoMode = false }: { data: DashboardData; demoMode?: boolean }) {
  const template = industryTemplateFor(data.businessType);
  const lenses = buildLenses(data);
  const focus = nextAction(lenses);

  return (
    <section className="rounded-lg border border-copper-dim/40 bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Heartbeat summary</p>
          <h2 className="mt-1 font-display text-xl text-copper-soft">{headline(lenses)}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            {template.label} template: cash, Profit First discipline, operating pressure, sales momentum, and market energy in one read.
          </p>
        </div>
        {demoMode ? (
          <span className="rounded-md border border-line px-3 py-1.5 text-xs text-copper-soft">
            Next: {focus.action}
          </span>
        ) : (
          <Link href={focus.href} className="rounded-md border border-line px-3 py-1.5 text-xs text-copper-soft hover:border-copper">
            Next: {focus.action}
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        {lenses.map((lens) => {
          const Icon = ICONS[lens.key];
          return (
            <LensCard
              key={lens.key}
              lens={lens}
              demoMode={demoMode}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
                  <Icon size={13} /> {lens.label}
                </span>
                <span className={"text-[10px] uppercase tracking-wider " + STATUS_TEXT[lens.status]}>
                  {lens.statusLabel}
                </span>
              </div>
              <div className={"tnum mt-2 text-xl " + STATUS_TEXT[lens.status]}>{lens.value}</div>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted">{lens.detail}</p>
            </LensCard>
          );
        })}
      </div>
    </section>
  );
}

function LensCard({
  lens,
  demoMode,
  children,
}: {
  lens: HeartbeatLens;
  demoMode: boolean;
  children: React.ReactNode;
}) {
  const className =
    "rounded-lg border px-3 py-3 transition-colors " + (!demoMode ? "hover:border-copper " : "") + STATUS_BORDER[lens.status];

  return demoMode ? (
    <div className={className}>{children}</div>
  ) : (
    <Link href={lens.href} className={className}>
      {children}
    </Link>
  );
}
