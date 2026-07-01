import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadBrokerageAnalytics } from "@/lib/modules/brokerage-analytics";
import { BrokerageAnalyticsModule } from "@/components/modules/BrokerageAnalyticsModule";

export default async function BrokerageAnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurant: { businessType: "REAL_ESTATE_BROKERAGE" } },
    select: { restaurantId: true, restaurant: { select: { name: true, businessType: true } } },
  });

  const data = role ? await loadBrokerageAnalytics(role.restaurantId) : null;
  const isBrokerage = role?.restaurant.businessType === "REAL_ESTATE_BROKERAGE";

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-copper-soft">Brokerage Analytics</h1>
          <p className="mt-1 text-sm text-muted">
            {role?.restaurant?.name ?? "Your brokerage"}
            {data ? ` - ${data.periodLabel}` : ""} - Company Dollar, pipeline, agent performance, market intelligence, and lead ROI.
          </p>
        </div>
        <Link href="/settings/sources?intro=1" className="rounded-md border border-copper-dim px-3 py-1.5 text-xs text-copper-soft hover:border-copper">
          Plan brokerage sources
        </Link>
        <Link href="/modules/brokerage/cockpit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-text hover:border-copper-dim">
          Executive Cockpit
        </Link>
        <Link href="/modules/brokerage/agent-cockpit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-text hover:border-copper-dim">
          Agent Cockpit
        </Link>
      </div>

      {!isBrokerage && (
        <div className="rounded-lg border border-copper-dim/40 bg-copper-dim/10 px-4 py-3 text-sm leading-relaxed text-muted">
          This module is designed for real estate brokerage accounts. Change the business template to Real estate broker / agent team to use it as the primary dashboard surface.
        </div>
      )}

      {data ? (
        <BrokerageAnalyticsModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need a business account to view brokerage analytics. Complete onboarding first.
        </p>
      )}
    </main>
  );
}
