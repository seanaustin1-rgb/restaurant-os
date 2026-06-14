"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "./DashboardHeader";
import { HeartbeatStrip } from "./HeartbeatStrip";
import { RevenueRow } from "./RevenueRow";
import { TapGauges } from "./TapGauges";
import { BeverageCostGauges } from "./BeverageCostGauges";
import { ModuleGrid } from "./ModuleGrid";
import type { RoleKey } from "@/lib/mock/dashboard";
import type { DashboardData } from "@/lib/dashboard/data";

export function DashboardView({
  dashboards,
  moduleOrder,
}: {
  dashboards: DashboardData[];
  moduleOrder: string[] | null;
}) {
  const [activeId, setActiveId] = useState(dashboards[0]?.restaurantId ?? "");
  const [role, setRole] = useState<RoleKey>("OPERATOR");

  const active = dashboards.find((d) => d.restaurantId === activeId) ?? dashboards[0];

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
      />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl text-[#E6E8E4]">{active.name}</h1>
          <span className="text-sm text-muted">{active.periodLabel}</span>
        </div>

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

        {/* TAP gauges and modules are hidden from the investor (selected metrics only). */}
        {!isInvestor && <TapGauges gauges={active.gauges} base={active.revenue.revenueMTD} />}
        {!isInvestor && <BeverageCostGauges gauges={active.costRatios} />}
        {!isInvestor && <ModuleGrid initialOrder={moduleOrder} />}
      </main>
    </div>
  );
}
