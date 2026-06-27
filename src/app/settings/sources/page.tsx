import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PlugZap, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { industryTemplateFor } from "@/lib/industry-templates";
import { sourceMapFor } from "@/lib/source-map";
import { loadSourceConfigSnapshots } from "@/lib/source-status";
import { SourceMapPlanner } from "@/components/sources/SourceMapPlanner";

const ACCESS_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

export default async function SourceMapPage({
  searchParams,
}: {
  searchParams?: { google?: string; reason?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ACCESS_ROLES] } },
    select: { role: true, restaurantId: true, restaurant: { select: { name: true, businessType: true } } },
  });

  if (!role) redirect("/dashboard");

  const template = industryTemplateFor(role.restaurant.businessType);
  const sourceMap = sourceMapFor(role.restaurant.businessType);
  const configs = await loadSourceConfigSnapshots(role.restaurantId, prisma);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Setup</p>
          <h1 className="mt-1 font-display text-2xl text-copper-soft">Source Onboarding</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {role.restaurant.name} is using the {template.label.toLowerCase()} template. Pick the systems the business
            uses; the app handles OAuth where possible and support/admin setup where a provider still requires technical credentials.
          </p>
        </div>
        <span className="rounded-full border border-copper-dim px-3 py-1 text-xs text-copper-soft">
          {role.role.toLowerCase()} view
        </span>
      </div>

      <section className="rounded-lg border border-copper-dim/40 bg-surface p-4">
        <div className="flex items-start gap-2">
          <PlugZap size={18} className="mt-0.5 text-copper-soft" />
          <div>
            <h2 className="text-sm font-medium text-ink-text">Minimum useful path</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{sourceMap.minimumAutoInput}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 text-health-green" />
          <div>
            <h2 className="text-sm font-medium text-ink-text">Customer promise</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Customers should not hunt for API keys, account IDs, or location IDs. They connect accounts, confirm the
              business we found, and support handles anything that still requires provider credentials.
            </p>
          </div>
        </div>
      </section>

      {searchParams?.google && (
        <section
          className={
            "rounded-lg border px-4 py-3 text-sm " +
            (searchParams.google === "connected"
              ? "border-health-green/40 bg-health-green/5 text-health-green"
              : "border-health-yellow/40 bg-health-yellow/5 text-health-yellow")
          }
        >
          {searchParams.google === "connected"
            ? "Google Business Profile is authorized. We found a location and saved it for Aura."
            : searchParams.google === "needs_location"
              ? "Google authorized successfully, but no Business Profile location was found. Support should confirm the account."
              : `Google authorization needs attention${searchParams.reason ? `: ${searchParams.reason}` : "."}`}
        </section>
      )}

      <SourceMapPlanner sourceMap={sourceMap} initialConfigs={configs} />
    </main>
  );
}
