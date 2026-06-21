"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "./DashboardHeader";
import { HeartbeatStrip } from "./HeartbeatStrip";
import { RevenueRow } from "./RevenueRow";
import { GoLiveCoachCard } from "./GoLiveCoachCard";
import { TapGauges } from "./TapGauges";
import { BeverageCostGauges } from "./BeverageCostGauges";
import { ModuleGrid } from "./ModuleGrid";
import { QuickAccessStrip } from "./QuickAccessStrip";
import type { RoleKey } from "@/lib/mock/dashboard";
import type { DashboardData } from "@/lib/dashboard/data";
import { type ModuleDef } from "@/lib/modules";
import { orderModules, modulesByKeys, sanitizeModuleOrder } from "@/lib/dashboard/module-order";
import { saveDashboardLayout } from "@/app/dashboard/actions";

export function DashboardView({
  dashboards,
  moduleOrder,
  pinnedModules,
  demoMode = false,
}: {
  dashboards: DashboardData[];
  moduleOrder: string[] | null;
  pinnedModules: string[];
  demoMode?: boolean;
}) {
  const [activeId, setActiveId] = useState(dashboards[0]?.restaurantId ?? "");
  const [role, setRole] = useState<RoleKey>("OPERATOR");

  // Per-user module layout (persisted to the account). Order is the grid order;
  // pinned is the Quick Access strip. Both update optimistically and persist.
  const [order, setOrder] = useState<ModuleDef[]>(() => orderModules(moduleOrder));
  const [pinned, setPinned] = useState<string[]>(() => sanitizeModuleOrder(pinnedModules));

  const active = dashboards.find((d) => d.restaurantId === activeId) ?? dashboards[0];

  // Only live modules can be pinned (a "soon" tile has nowhere to go).
  const liveKeys = useMemo(() => new Set(order.filter((m) => m.status === "live" && m.href).map((m) => m.key)), [order]);
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

  if (!active) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-sm rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="font-display text-xl text-copper-soft">No restaurant yet</h1>
          <p className="mt-2 text-sm text-muted">Set up your restaurant to see your dashboard.</p>
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

  return (
    <div>
      <DashboardHeader
        restaurants={dashboards.map((d) => ({ id: d.restaurantId, name: d.name }))}
        activeId={active.restaurantId}
        onSelectRestaurant={setActiveId}
        role={role}
        onSelectRole={setRole}
        demoMode={demoMode}
      />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl text-[#E6E8E4]">{active.name}</h1>
          <span className="text-sm text-muted">{active.periodLabel}</span>
        </div>

        {/* Quick Access — pinned modules, one click away at the top. */}
        {!isInvestor && (
          <QuickAccessStrip items={pinnedList} onReorder={handleReorderPinned} onUnpin={handleUnpin} />
        )}

        {!active.hasData && (
          <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
            No data for this period yet.{" "}
            <Link href="/connections" className="text-copper-soft hover:underline">
              Connect a bank
            </Link>{" "}
            and sync, or add daily sales, to populate these metrics.
          </div>
        )}

        <HeartbeatStrip data={active.heartbeat} />
        <RevenueRow data={active.revenue} />
        <GoLiveCoachCard data={active.goLiveCoach} />

        {/* TAP gauges and modules are hidden from the investor (selected metrics only). */}
        {!isInvestor && <TapGauges gauges={active.gauges} base={active.revenue.revenueMTD} />}
        {!isInvestor && <BeverageCostGauges gauges={active.costRatios} />}
        {!isInvestor && (
          <ModuleGrid items={order} pinnedKeys={pinnedKeys} onReorder={handleReorder} onTogglePin={handleTogglePin} demoMode={demoMode} />
        )}
      </main>
    </div>
  );
}
