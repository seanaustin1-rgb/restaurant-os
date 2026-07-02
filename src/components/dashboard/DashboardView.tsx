"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BusinessType } from "@prisma/client";
import { Building2, Home, Search, Users } from "lucide-react";
import { money, pct } from "@/lib/format";
import { AdvisorBrief } from "./AdvisorBrief";
import { DashboardHeader } from "./DashboardHeader";
import { HeartbeatSummary } from "./HeartbeatSummary";
import { HeartbeatStrip } from "./HeartbeatStrip";
import { RevenueRow } from "./RevenueRow";
import { GoLiveCoachCard } from "./GoLiveCoachCard";
import { SetupOverviewCard } from "./SetupOverviewCard";
import { TapGauges } from "./TapGauges";
import { BeverageCostGauges } from "./BeverageCostGauges";
import { ModuleGrid } from "./ModuleGrid";
import { QuickAccessStrip } from "./QuickAccessStrip";
import { ProfitFirstExplainer } from "@/components/profit-first/ProfitFirstExplainer";
import type { RoleKey } from "@/lib/mock/dashboard";
import type { DashboardData, SourceSetupSummary } from "@/lib/dashboard/data";
import { type ModuleDef } from "@/lib/modules";
import { orderModules, modulesByKeys, sanitizeModuleOrder } from "@/lib/dashboard/module-order";
import { industryTemplateFor } from "@/lib/industry-templates";
import { sourceMapFor } from "@/lib/source-map";
import { saveDashboardLayout } from "@/app/dashboard/actions";

function previewSourceSetup(type: BusinessType): SourceSetupSummary {
  const sourceMap = sourceMapFor(type);
  const minimumOptions = sourceMap.groups.flatMap((group) => group.options.filter((option) => option.minimum).map((option) => option.name));

  return {
    minimumAutoInput: sourceMap.minimumAutoInput,
    requiredCount: minimumOptions.length,
    connectedCount: 0,
    plannedCount: minimumOptions.length,
    blockedCount: 0,
    notNeededCount: 0,
    missingRequired: minimumOptions,
  };
}

function previewBusinessName(type: BusinessType, fallback: string): string {
  if (type === "REAL_ESTATE_BROKERAGE") return "Harbor & Main Realty";
  if (type === "VACATION_RENTAL") return "Shoreline Stay Group";
  if (type === "CONTRACTOR") return "Iron Ridge Field Services";
  if (type === "SERVICE") return "Keystone Service Co.";
  if (type === "RETAIL") return "Copper Lane Goods";
  return fallback;
}

function noDataMessage(type: BusinessType): { text: string; href: string; cta: string } {
  if (type === "VACATION_RENTAL") {
    return {
      text: "No rental data imported yet.",
      href: "/import/rentals",
      cta: "Import rental data",
    };
  }
  if (type === "REAL_ESTATE_BROKERAGE") {
    return {
      text: "No brokerage data imported yet.",
      href: "/import/brokerage",
      cta: "Import brokerage data",
    };
  }
  if (type === "CONTRACTOR") {
    return {
      text: "No job or field-service data imported yet.",
      href: "/settings/sources",
      cta: "Plan job sources",
    };
  }
  if (type === "SERVICE") {
    return {
      text: "No service-business data imported yet.",
      href: "/settings/sources",
      cta: "Plan service sources",
    };
  }
  if (type === "RETAIL") {
    return {
      text: "No retail data imported yet.",
      href: "/settings/sources",
      cta: "Plan retail sources",
    };
  }
  return {
    text: "No data for this period yet.",
    href: "/connections",
    cta: "Connect a source",
  };
}

export function DashboardView({
  dashboards,
  moduleOrder,
  pinnedModules,
  demoMode = false,
  initialPreviewType,
  roleAssignments,
}: {
  dashboards: DashboardData[];
  moduleOrder: string[] | null;
  pinnedModules: string[];
  demoMode?: boolean;
  initialPreviewType?: BusinessType;
  roleAssignments?: { restaurantId: string; role: RoleKey }[];
}) {
  const [activeId, setActiveId] = useState(dashboards[0]?.restaurantId ?? "");
  const roleByRestaurant = useMemo(() => {
    return new Map((roleAssignments ?? []).map((assignment) => [assignment.restaurantId, assignment.role]));
  }, [roleAssignments]);
  const initialRole = demoMode ? "OPERATOR" : (dashboards[0] ? roleByRestaurant.get(dashboards[0].restaurantId) : undefined) ?? "OPERATOR";
  const [role, setRole] = useState<RoleKey>(initialRole);

  // Per-user module layout (persisted to the account). Order is the grid order;
  // pinned is the Quick Access strip. Both update optimistically and persist.
  const [order, setOrder] = useState<ModuleDef[]>(() => orderModules(moduleOrder));
  const [pinned, setPinned] = useState<string[]>(() => sanitizeModuleOrder(pinnedModules));

  const active = dashboards.find((d) => d.restaurantId === activeId) ?? dashboards[0];
  const [previewType, setPreviewType] = useState<BusinessType>(initialPreviewType ?? active?.businessType ?? "RESTAURANT");

  useEffect(() => {
    setPreviewType(initialPreviewType ?? active?.businessType ?? "RESTAURANT");
  }, [active?.restaurantId, active?.businessType, initialPreviewType]);

  useEffect(() => {
    if (demoMode || !active) return;
    setRole(roleByRestaurant.get(active.restaurantId) ?? "OPERATOR");
  }, [active, demoMode, roleByRestaurant]);

  const isTemplatePreview = Boolean(active && previewType !== active.businessType);
  const displayName = active ? (isTemplatePreview ? previewBusinessName(previewType, active.name) : active.name) : "";
  const displayActive = useMemo<DashboardData | undefined>(() => {
    if (!active) return undefined;
    if (!isTemplatePreview) return active;
    return {
      ...active,
      name: displayName,
      businessType: previewType,
      sourceSetup: previewSourceSetup(previewType),
      aura: {
        configuredCount: 0,
        liveCount: 0,
        overallRating: null,
        totalReviews: 0,
        health: "yellow",
        hasAnyData: false,
        intentMetrics: [],
      },
    };
  }, [active, displayName, isTemplatePreview, previewType]);

  const template = industryTemplateFor(displayActive?.businessType);
  const templateModuleKeys = useMemo(() => new Set(template.defaultModuleKeys), [template]);
  const visibleOrder = useMemo(() => order.filter((m) => templateModuleKeys.has(m.key)), [order, templateModuleKeys]);

  // Only live modules can be pinned (a "soon" tile has nowhere to go).
  const liveKeys = useMemo(() => new Set(visibleOrder.filter((m) => m.status === "live" && m.href).map((m) => m.key)), [visibleOrder]);
  const pinnedKeys = useMemo(() => new Set(pinned), [pinned]);
  const pinnedList = useMemo(() => modulesByKeys(pinned).filter((m) => liveKeys.has(m.key)), [pinned, liveKeys]);

  function persist(nextOrder: ModuleDef[], nextPinned: string[]) {
    // The public demo has no authenticated session to persist a layout to.
    if (demoMode) return;
    void saveDashboardLayout(nextOrder.map((m) => m.key), nextPinned).catch(() => {});
  }
  function handleReorder(next: ModuleDef[]) {
    setOrder(next);
    persist(next, pinned);
  }
  function handleTogglePin(key: string) {
    if (!liveKeys.has(key)) return;
    const next = pinned.includes(key) ? pinned.filter((k) => k !== key) : [...pinned, key];
    setPinned(next);
    persist(order, next);
  }
  function handleReorderPinned(nextKeys: string[]) {
    setPinned(nextKeys);
    persist(order, nextKeys);
  }
  function handleUnpin(key: string) {
    const next = pinned.filter((k) => k !== key);
    setPinned(next);
    persist(order, next);
  }

  if (!displayActive) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-sm rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="font-display text-xl text-copper-soft">No business yet</h1>
          <p className="mt-2 text-sm text-muted">Set up your business to see your dashboard.</p>
          <Link
            href="/onboarding"
            className="mt-4 inline-block rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft"
          >
            Start onboarding
          </Link>
        </div>
      </main>
    );
  }

  const isInvestor = role === "INVESTOR";
  const isAdvisor = role === "CONSULTANT" || role === "MANAGER";
  const isRestaurantTemplate = displayActive.businessType === "RESTAURANT";
  const emptyState = noDataMessage(displayActive.businessType);
  const headerRestaurants = dashboards.map((d) => ({
    id: d.restaurantId,
    name: d.restaurantId === activeId ? displayActive.name : d.name,
  }));
  // Union of the viewer's real business types (not the preview) so vertical nav
  // links only surface for tenants that actually operate that vertical.
  const navBusinessTypes = [...new Set(dashboards.map((d) => d.businessType))];

  return (
    <div>
      <DashboardHeader
        restaurants={headerRestaurants}
        activeId={displayActive.restaurantId}
        onSelectRestaurant={setActiveId}
        role={role}
        onSelectRole={setRole}
        roleOptions={demoMode ? undefined : [roleByRestaurant.get(displayActive.restaurantId) ?? role]}
        businessTypes={navBusinessTypes}
        demoMode={demoMode}
      />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl text-ink-text">{displayActive.name}</h1>
          <span className="text-sm text-muted">{displayActive.periodLabel}</span>
        </div>

        {/* Heartbeat first (Principle #1): the at-a-glance read leads, before any
            setup or source config — the owner should see the state on first scan. */}
        <HeartbeatSummary data={displayActive} demoMode={demoMode} />
        {isAdvisor && <AdvisorBrief data={displayActive} demoMode={demoMode} />}

        {!displayActive.hasData && isInvestor && (
          <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
            The investor matrix is available, but live operating data has not been loaded for this period yet.
          </div>
        )}

        {!displayActive.hasData && !isInvestor && (
          <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
            {emptyState.text}{" "}
            <Link href={emptyState.href} className="text-copper-soft hover:underline">
              {emptyState.cta}
            </Link>{" "}
            to populate these metrics.
          </div>
        )}

        {/* Setup + industry preview switcher follow the heartbeat, not precede it. */}
        {!isInvestor && (
          <SetupOverviewCard
            data={displayActive}
            previewType={previewType}
            onPreviewTypeChange={setPreviewType}
            isPreview={isTemplatePreview}
            demoMode={demoMode}
          />
        )}

        {/* Public demo stays read-only: no pinned shortcuts into protected app pages. */}
        {!demoMode && !isInvestor && (
          <QuickAccessStrip items={pinnedList} onReorder={handleReorderPinned} onUnpin={handleUnpin} />
        )}

        {isRestaurantTemplate ? (
          <>
            <HeartbeatStrip data={displayActive.heartbeat} />
            <RevenueRow data={displayActive.revenue} />
          </>
        ) : (
          <IndustryHeartbeatPreview data={displayActive} />
        )}
        <GoLiveCoachCard data={displayActive.goLiveCoach} demoMode={demoMode} businessType={displayActive.businessType} />
        {!isInvestor && <ProfitFirstExplainer />}

        {/* TAP gauges and modules are hidden from the investor (selected metrics only). */}
        {!isInvestor && isRestaurantTemplate && <TapGauges gauges={displayActive.gauges} base={displayActive.revenue.revenueMTD} />}
        {!isInvestor && isRestaurantTemplate && <BeverageCostGauges gauges={displayActive.costRatios} demoMode={demoMode} />}
        {!isInvestor && (
          <ModuleGrid items={visibleOrder} pinnedKeys={pinnedKeys} onReorder={handleReorder} onTogglePin={handleTogglePin} demoMode={demoMode} />
        )}
      </main>
    </div>
  );
}

function IndustryHeartbeatPreview({ data }: { data: DashboardData }) {
  const businessType = data.businessType;
  if (businessType === "REAL_ESTATE_BROKERAGE") {
    return (
      <section>
        <h2 className="mb-2 font-display text-lg text-ink-text">Brokerage heartbeat</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <PreviewCard icon={<Building2 size={15} />} title="Company Dollar" detail="Retained Company Dollar is the operating base. Practical target: about 25-30%+ of GCI after splits, referrals, and fees." />
          <PreviewCard icon={<Users size={15} />} title="Agent Performance" detail="Company Dollar yield, cap pressure, pipeline, and lead ROI by agent." />
          <PreviewCard icon={<Search size={15} />} title="Market Intelligence" detail="MLS velocity, DOM, price drops, rates, showing demand, and intent." />
          <PreviewCard icon={<GaugeIcon />} title="Lead ROI" detail="Lead spend compared with expected retained Company Dollar, by agent and source." />
        </div>
      </section>
    );
  }

  if (businessType === "VACATION_RENTAL") {
    const portfolio = data.rentalPropertyRollup?.portfolio;
    if (portfolio) {
      return (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg text-ink-text">Property heartbeat</h2>
            <Link href="/import/rentals" className="text-xs text-copper-soft hover:underline">
              Import rental data
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <PreviewCard
              icon={<Home size={15} />}
              title="Owner Proceeds"
              detail={`${money(portfolio.ownerProceeds)} this period, ${pct(portfolio.ownerProceedsPct)} of booking revenue.`}
            />
            <PreviewCard
              icon={<GaugeIcon />}
              title="Maintenance Drag"
              detail={`${pct(portfolio.maintenancePressurePct)} of revenue. ${portfolio.pressureCount} properties need attention.`}
            />
            <PreviewCard
              icon={<Search size={15} />}
              title="Guest Aura"
              detail={`Average Aura ${Math.round(portfolio.averageGuestAuraScore)} across ${portfolio.propertyCount} properties.`}
            />
            <PreviewCard
              icon={<Building2 size={15} />}
              title="Booking Pace"
              detail={`Average occupancy ${pct(portfolio.averageOccupancyPct, 0)}. Highest pressure: ${portfolio.topPressure?.name ?? "none"}.`}
            />
          </div>
        </section>
      );
    }
    return (
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-ink-text">Property heartbeat</h2>
          <Link href="/import/rentals" className="text-xs text-copper-soft hover:underline">
            Import rental data
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <PreviewCard icon={<Home size={15} />} title="Owner Proceeds" detail="Booking revenue after cleaning, maintenance, platform fees, and management fees." />
          <PreviewCard icon={<GaugeIcon />} title="Maintenance Drag" detail="Open issues, repeat issues, and repair cost pressure by property." />
          <PreviewCard icon={<Search size={15} />} title="Guest Aura" detail="Review score, response time, complaint themes, and repeat issue signals." />
          <PreviewCard icon={<Building2 size={15} />} title="Booking Pace" detail="Occupancy, ADR, RevPAR, future booked nights, and seasonality." />
        </div>
      </section>
    );
  }

  if (businessType === "CONTRACTOR") {
    return (
      <section>
        <h2 className="mb-2 font-display text-lg text-ink-text">Contractor heartbeat</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <PreviewCard
            icon={<GaugeIcon />}
            title="Job Margin"
            detail="32.6% blended margin across active jobs. Two jobs are under target after labor and materials."
          />
          <PreviewCard
            icon={<Building2 size={15} />}
            title="Backlog"
            detail="$412,000 weighted backlog, covering about 8.4 weeks of crew capacity."
          />
          <PreviewCard
            icon={<Users size={15} />}
            title="Labor Load"
            detail="76% crew utilization. Overtime is starting to pressure two crews next week."
          />
          <PreviewCard
            icon={<Search size={15} />}
            title="Receivables"
            detail="$68,500 open AR, with $18,200 past 30 days and one progress bill needing follow-up."
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-2 font-display text-lg text-ink-text">Industry heartbeat</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PreviewCard icon={<Building2 size={15} />} title="Cash Safety" detail="Runway, recurring spend, and source coverage for this business type." />
        <PreviewCard icon={<Users size={15} />} title="Operating Pressure" detail="Industry-specific pressure metrics replace restaurant food and cover metrics." />
        <PreviewCard icon={<Search size={15} />} title="Market Aura" detail="Reputation, demand, and external intent signals for the selected template." />
      </div>
    </section>
  );
}

function GaugeIcon() {
  return <span className="inline-block h-3.5 w-3.5 rounded-full border border-current" />;
}

function PreviewCard({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-sm text-ink-text">
        <span className="text-copper-soft">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}
