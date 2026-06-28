"use client";

import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { Activity, Banknote, CircleDollarSign, Gauge, Info, Megaphone } from "lucide-react";
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
  explainer: string;
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
  const hasBankActivity = data.goLiveCoach.transactionCount > 0;
  const cushionRatio =
    cash.currentCash != null && cash.minimumOperatingCash != null && cash.minimumOperatingCash > 0
      ? cash.currentCash / cash.minimumOperatingCash
      : null;
  return {
    key: "cash",
    label: "Cash oxygen",
    status,
    statusLabel: cash.ready ? "breathing room" : cash.hasAnchor ? "below floor" : "needs anchor",
    value: cushionRatio != null ? `${cushionRatio.toFixed(1)}x floor` : cash.currentCash != null ? money(cash.currentCash) : "Set anchor",
    detail:
      cash.currentCash != null && cash.minimumOperatingCash != null && cushionRatio != null
        ? `${money(cash.currentCash)} cash vs. ${money(cash.minimumOperatingCash)} floor. ${cushionRatio >= 1.5 ? "Healthy demo cushion." : cushionRatio >= 1 ? "Thin cushion." : "Below the floor."}`
        : hasBankActivity
          ? "Bank activity is connected. Add one starting cash balance/date so the app can estimate runway from the imported flow."
          : "Connect bank activity, then add one starting cash balance/date so the app can estimate runway.",
    explainer: "Cash oxygen is not a live bank-balance read. It starts with one known cash balance on one date, then adds and subtracts imported bank activity to estimate current operating cash and runway.",
    action: "set cash anchor",
    href: "/modules/cash-runway",
  };
}

function disciplineLens(data: DashboardData, demoMode: boolean): HeartbeatLens {
  const coach = data.goLiveCoach;
  if (demoMode) {
    return {
      key: "discipline",
      label: "Profit discipline",
      status: "yellow",
      statusLabel: "close gap",
      value: "90%",
      detail: "90% of dollars are categorized. Review the top uncategorized vendors and confirm the tax/owner-pay rules to get this to 100%.",
      explainer: "Profit discipline measures how much money can be safely routed into Profit First buckets. The call to action is to categorize the remaining dollars and confirm the rules before any automatic transfers go live.",
      action: "clean up categories",
      href: "/modules/go-live",
    };
  }
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
    explainer: "Profit discipline shows whether money is being separated into Profit First buckets before spending decisions happen.",
    action: "review readiness",
    href: "/modules/go-live",
  };
}

function demoPressureLens(data: DashboardData): HeartbeatLens | null {
  if (data.businessType === "SERVICE") {
    return {
      key: "pressure",
      label: "Delivery pressure",
      status: "yellow",
      statusLabel: "watch labor",
      value: "66.4%",
      detail: "Payroll, materials, and subcontractors are taking 66.4% of revenue this month.",
      explainer: "Delivery pressure is the service-business version of prime cost: direct labor plus job costs compared with revenue.",
      action: "enter service numbers",
      href: "/demo/service",
    };
  }
  if (data.businessType === "CONTRACTOR") {
    return {
      key: "pressure",
      label: "Job pressure",
      status: "yellow",
      statusLabel: "materials high",
      value: "31.8%",
      detail: "Materials are running 3.8 points above the target job budget across active work.",
      explainer: "Job pressure shows whether labor, materials, and subs are compressing job margin before invoices land.",
      action: "plan job sources",
      href: "/settings/sources",
    };
  }
  if (data.businessType === "REAL_ESTATE_BROKERAGE") {
    return {
      key: "pressure",
      label: "Split pressure",
      status: "yellow",
      statusLabel: "cap watch",
      value: "71.6%",
      detail: "Agent payouts, franchise fees, and referrals are passing through 71.6% of closed GCI. Practical watch band: 70-75%; above 80% is usually high pressure unless OpEx is very lean.",
      explainer: "Split pressure shows how much gross commission income leaves before the brokerage keeps Company Dollar. There is no universal industry standard because teams, caps, franchises, and agent mix vary, but a brokerage often wants retained Company Dollar around 25-30% or better.",
      action: "enter brokerage numbers",
      href: "/demo/real-estate",
    };
  }
  if (data.businessType === "VACATION_RENTAL") {
    return {
      key: "pressure",
      label: "Property pressure",
      status: "yellow",
      statusLabel: "2 watch",
      value: "22.4%",
      detail: "Maintenance and turn costs are elevated on 2 properties, led by Driftwood Condo.",
      explainer: "Property pressure rolls up maintenance drag, turn cost, issue count, and owner-proceeds pressure by property.",
      action: "inspect properties",
      href: "/modules/property-heartbeat",
    };
  }
  if (data.businessType === "RETAIL") {
    return {
      key: "pressure",
      label: "Margin pressure",
      status: "green",
      statusLabel: "healthy",
      value: "48.2%",
      detail: "Gross margin is holding at 48.2% after markdowns, returns, and inventory cost.",
      explainer: "Margin pressure shows whether product cost, markdowns, returns, and shrink are eating into retail gross margin.",
      action: "plan retail sources",
      href: "/settings/sources",
    };
  }
  return null;
}

function pressureLens(data: DashboardData, demoMode: boolean): HeartbeatLens {
  const demo = demoMode ? demoPressureLens(data) : null;
  if (demo) return demo;

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
      explainer: "Property pressure rolls up maintenance drag, turn cost, issue count, and owner-proceeds pressure by property.",
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
      explainer: "Split pressure shows how much gross commission income leaves before the brokerage keeps Company Dollar. There is no universal industry standard because teams, caps, franchises, and agent mix vary, but retained Company Dollar around 25-30% or better is a practical starting benchmark.",
      action: "plan brokerage sources",
      href: "/settings/sources",
    };
  }

  if (data.businessType === "CONTRACTOR") {
    return {
      key: "pressure",
      label: "Job pressure",
      status: "yellow",
      statusLabel: "needs jobs",
      value: "Waiting",
      detail: "Connect job revenue, labor, materials, and schedule data to read margin pressure by project.",
      explainer: "Job pressure shows whether labor, materials, and subs are compressing job margin before invoices land.",
      action: "plan job sources",
      href: "/settings/sources",
    };
  }

  if (data.businessType === "SERVICE") {
    return {
      key: "pressure",
      label: "Service pressure",
      status: "yellow",
      statusLabel: "needs clients",
      value: "Waiting",
      detail: "Connect bank, accounting, payroll, and CRM data to read payroll load, recurring cost, and client profitability.",
      explainer: "Delivery pressure is the service-business version of prime cost: direct labor plus job costs compared with revenue.",
      action: "plan service sources",
      href: "/settings/sources",
    };
  }

  if (data.businessType === "RETAIL") {
    return {
      key: "pressure",
      label: "Margin pressure",
      status: "yellow",
      statusLabel: "needs POS",
      value: "Waiting",
      detail: "Connect POS, inventory, bank, and ecommerce data to read gross margin, inventory pressure, and sell-through.",
      explainer: "Margin pressure shows whether product cost, markdowns, returns, and shrink are eating into retail gross margin.",
      action: "plan retail sources",
      href: "/settings/sources",
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
    explainer: "Operating pressure shows whether the largest controllable costs are consuming too much of current sales.",
    action: "inspect TAPs",
    href: "/dashboard",
  };
}

function demoMomentumLens(data: DashboardData): HeartbeatLens | null {
  if (data.businessType === "SERVICE") {
    return {
      key: "momentum",
      label: "Client momentum",
      status: "green",
      statusLabel: "booked",
      value: "$184,500",
      detail: "Booked work plus recurring clients cover 6.2 weeks of delivery capacity.",
      explainer: "Client momentum shows whether new leads, booked jobs, and recurring work are keeping the next few weeks full.",
      action: "enter service numbers",
      href: "/demo/service",
    };
  }
  if (data.businessType === "CONTRACTOR") {
    return {
      key: "momentum",
      label: "Schedule momentum",
      status: "green",
      statusLabel: "backlog",
      value: "$412,000",
      detail: "Weighted backlog covers 8.4 weeks with two jobs waiting on materials.",
      explainer: "Schedule momentum reads upcoming work, backlog quality, labor capacity, and cash timing.",
      action: "plan job sources",
      href: "/settings/sources",
    };
  }
  if (data.businessType === "REAL_ESTATE_BROKERAGE") {
    return {
      key: "momentum",
      label: "Pipeline momentum",
      status: "green",
      statusLabel: "closing",
      value: "$74,800",
      detail: "Weighted 45-90 day Company Dollar from pending deals is ahead of break-even.",
      explainer: "Pipeline momentum converts pending deals into expected retained Company Dollar after splits and close probability.",
      action: "enter brokerage numbers",
      href: "/demo/real-estate",
    };
  }
  if (data.businessType === "VACATION_RENTAL") {
    return {
      key: "momentum",
      label: "Booking momentum",
      status: "green",
      statusLabel: "ahead",
      value: "$286,400",
      detail: "Portfolio occupancy is 74% with 312 future booked nights in the next 60 days.",
      explainer: "Booking momentum tracks occupancy, ADR, booked nights, booking pace, and owner proceeds.",
      action: "inspect properties",
      href: "/modules/property-heartbeat",
    };
  }
  if (data.businessType === "RETAIL") {
    return {
      key: "momentum",
      label: "Traffic momentum",
      status: "yellow",
      statusLabel: "mixed",
      value: "$128,900",
      detail: "Store traffic is up 7%, but online conversion softened over the last 10 days.",
      explainer: "Traffic momentum combines sales pace, store traffic, ecommerce conversion, returns, and sell-through.",
      action: "plan retail sources",
      href: "/settings/sources",
    };
  }
  return null;
}

function momentumLens(data: DashboardData, demoMode: boolean): HeartbeatLens {
  const demo = demoMode ? demoMomentumLens(data) : null;
  if (demo) return demo;

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
      explainer: "Booking momentum tracks occupancy, ADR, booked nights, booking pace, and owner proceeds.",
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
      explainer: "Pipeline momentum converts pending deals into expected retained Company Dollar after splits and close probability.",
      action: "plan brokerage sources",
      href: "/settings/sources",
    };
  }

  if (data.businessType === "CONTRACTOR") {
    return {
      key: "momentum",
      label: "Schedule momentum",
      status: "yellow",
      statusLabel: "needs schedule",
      value: "Waiting",
      detail: "Connect jobs and schedule capacity to see upcoming work, backlog, labor load, and cash timing.",
      explainer: "Schedule momentum reads upcoming work, backlog quality, labor capacity, and cash timing.",
      action: "plan job sources",
      href: "/settings/sources",
    };
  }

  if (data.businessType === "SERVICE") {
    return {
      key: "momentum",
      label: "Client momentum",
      status: "yellow",
      statusLabel: "needs CRM",
      value: "Waiting",
      detail: "Connect CRM, invoicing, and recurring revenue data to see lead flow, booked work, and client profitability.",
      explainer: "Client momentum shows whether new leads, booked jobs, and recurring work are keeping the next few weeks full.",
      action: "plan service sources",
      href: "/settings/sources",
    };
  }

  if (data.businessType === "RETAIL") {
    return {
      key: "momentum",
      label: "Traffic momentum",
      status: "yellow",
      statusLabel: "needs sales",
      value: "Waiting",
      detail: "Connect POS and ecommerce data to see sales pace, sell-through, returns, and inventory turnover.",
      explainer: "Traffic momentum combines sales pace, store traffic, ecommerce conversion, returns, and sell-through.",
      action: "plan retail sources",
      href: "/settings/sources",
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
    explainer: "Sales momentum shows whether revenue and guest count are moving strongly enough to support current cost levels.",
    action: "view revenue",
    href: "/dashboard",
  };
}

function demoAuraLens(data: DashboardData): HeartbeatLens | null {
  if (data.businessType === "SERVICE") {
    return {
      key: "aura",
      label: "Aura",
      status: "green",
      statusLabel: "trusted",
      value: "4.8",
      detail: "Reviews, referral mentions, and quote requests are trending up this month.",
      explainer: "Aura is the outside-world signal: reviews, calls, searches, referrals, and other demand intent.",
      action: "open Aura",
      href: "/modules/aura",
    };
  }
  if (data.businessType === "CONTRACTOR") {
    return {
      key: "aura",
      label: "Aura",
      status: "yellow",
      statusLabel: "response lag",
      value: "4.5",
      detail: "Lead intent is strong, but response time is slipping on estimate requests.",
      explainer: "Aura is the outside-world signal: reviews, calls, searches, referrals, and other demand intent.",
      action: "open Aura",
      href: "/modules/aura",
    };
  }
  if (data.businessType === "REAL_ESTATE_BROKERAGE") {
    return {
      key: "aura",
      label: "Aura",
      status: "green",
      statusLabel: "intent rising",
      value: "82",
      detail: "Searches, showing demand, and profile actions are up against the prior 7 days.",
      explainer: "Aura is the outside-world signal: reviews, calls, searches, referrals, and other demand intent.",
      action: "open Aura",
      href: "/modules/aura",
    };
  }
  if (data.businessType === "VACATION_RENTAL") {
    return {
      key: "aura",
      label: "Guest Aura",
      status: "green",
      statusLabel: "strong",
      value: "86",
      detail: "Guest rating, response speed, and repeat-issue score are healthy across the portfolio.",
      explainer: "Guest Aura reads review score, response speed, issue themes, and repeat problems by property.",
      action: "inspect properties",
      href: "/modules/property-heartbeat",
    };
  }
  if (data.businessType === "RETAIL") {
    return {
      key: "aura",
      label: "Aura",
      status: "yellow",
      statusLabel: "reviews flat",
      value: "4.4",
      detail: "Foot traffic is rising, but review velocity and product mentions are flat.",
      explainer: "Aura is the outside-world signal: reviews, calls, searches, referrals, and other demand intent.",
      action: "open Aura",
      href: "/modules/aura",
    };
  }
  return null;
}

function auraLens(data: DashboardData, demoMode: boolean): HeartbeatLens {
  const demo = demoMode ? demoAuraLens(data) : null;
  if (demo) return demo;

  if (data.aura.hasAnyData && data.aura.overallRating != null) {
    const liveIntent = data.aura.intentMetrics.filter((metric) => metric.state === "live");
    const intentTotal = liveIntent.reduce((sum, metric) => sum + (metric.value ?? 0), 0);
    const intentError = data.aura.intentMetrics.some((metric) => metric.state === "error");
    return {
      key: "aura",
      label: "Aura",
      status: data.aura.health,
      statusLabel: data.aura.health === "green" ? "live" : data.aura.health === "red" ? "weak" : "watch",
      value: data.aura.overallRating.toFixed(1),
      detail:
        liveIntent.length > 0
          ? `${data.aura.totalReviews.toLocaleString()} reviews and ${intentTotal.toLocaleString()} Google intent actions in the last 30 days.`
          : intentError
            ? `${data.aura.totalReviews.toLocaleString()} reviews are live. Google Business Profile actions need authorization before calls, directions, clicks, and views can show.`
            : `${data.aura.totalReviews.toLocaleString()} reviews are live. Google Business Profile actions will add calls, directions, clicks, and profile views once authorized.`,
      explainer: "Aura is the outside-world signal: reviews, calls, searches, referrals, and other demand intent.",
      action: "open Aura",
      href: "/modules/aura",
    };
  }

  return {
    key: "aura",
    label: "Aura",
    status: "yellow",
    statusLabel: data.aura.configuredCount > 0 ? "check source" : "not connected",
    value: "Waiting",
    detail:
      data.aura.configuredCount > 0
        ? "A review source is configured, but no rating data is coming through yet. Open Aura to see the source error."
        : "Connect Google Places for reviews, then Google Business Profile for calls, directions, website clicks, and profile views.",
    explainer: "Aura is the outside-world signal: reviews, calls, searches, referrals, and other demand intent.",
    action: "open Aura",
    href: "/modules/aura",
  };
}

function buildLenses(data: DashboardData, demoMode: boolean): HeartbeatLens[] {
  return [cashLens(data), disciplineLens(data, demoMode), pressureLens(data, demoMode), momentumLens(data, demoMode), auraLens(data, demoMode)];
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
  const lenses = buildLenses(data, demoMode);
  const focus = nextAction(lenses);
  const [openInfo, setOpenInfo] = useState<LensKey | null>(null);

  return (
    <section className="rounded-lg border border-copper-dim/40 bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Heartbeat summary</p>
          <h2 className="mt-1 font-display text-2xl text-copper-soft">{headline(lenses)}</h2>
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
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpenInfo((current) => (current === lens.key ? null : lens.key));
                    }}
                    className="rounded-full text-muted hover:text-copper-soft"
                    title={lens.explainer}
                    aria-expanded={openInfo === lens.key}
                    aria-label={`What ${lens.label} means`}
                  >
                    <Info size={12} />
                  </button>
                  <span className={"text-[10px] uppercase tracking-wider " + STATUS_TEXT[lens.status]}>
                    {lens.statusLabel}
                  </span>
                </span>
              </div>
              <div className={"tnum mt-2 text-xl " + STATUS_TEXT[lens.status]}>{lens.value}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{lens.detail}</p>
              {openInfo === lens.key && (
                <div className="mt-2 rounded-md border border-line bg-ink/60 px-2 py-2 text-[11px] leading-relaxed text-ink-text-soft">
                  {lens.explainer}
                </div>
              )}
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
