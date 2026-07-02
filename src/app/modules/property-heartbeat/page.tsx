import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadRentalPropertyRollup } from "@/lib/modules/rental-property-rollup";
import { PropertyHeartbeatModule } from "@/components/modules/PropertyHeartbeatModule";

export default async function PropertyHeartbeatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurant: { businessType: "VACATION_RENTAL" } },
    select: { restaurantId: true, restaurant: { select: { name: true, businessType: true } } },
  });

  const data = role ? await loadRentalPropertyRollup(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-copper-soft">Property Heartbeat</h1>
          <p className="mt-1 text-sm text-muted">
            {role?.restaurant?.name ?? "Your portfolio"}
            {data?.hasImportedRentalData ? ` - ${data.periodLabel}` : ""} - owner proceeds, maintenance drag,
            booking pace, and guest Aura from imported rental data.
          </p>
        </div>
        <Link
          href="/modules/rentals/cockpit"
          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-text hover:border-copper-dim"
        >
          Property Cockpit
        </Link>
      </div>
      {data ? (
        <PropertyHeartbeatModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need a vacation-rental business to view property heartbeat. Complete onboarding or switch businesses first.
        </p>
      )}
    </main>
  );
}
