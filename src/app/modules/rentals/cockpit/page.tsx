import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PropertyCockpit } from "@/components/cockpit/PropertyCockpit";
import { loadRentalPropertyRollup } from "@/lib/modules/rental-property-rollup";
import { prisma } from "@/lib/prisma";

export default async function RentalPropertyCockpitPage({
  searchParams,
}: {
  searchParams?: { restaurantId?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: {
      clerkUserId: userId,
      ...(searchParams?.restaurantId ? { restaurantId: searchParams.restaurantId } : {}),
      restaurant: { businessType: "VACATION_RENTAL" },
    },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const data = role ? await loadRentalPropertyRollup(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link
          href="/modules/property-heartbeat"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-copper-soft"
        >
          <ArrowLeft size={14} /> Property heartbeat
        </Link>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Property Cockpit</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          Leadership macro view: booking revenue vs. owner proceeds, maintenance drag, guest Aura, occupancy, and the
          properties that need action first.
        </p>
      </div>

      {data && data.portfolio ? (
        <PropertyCockpit data={data} name={role?.restaurant?.name ?? "Your portfolio"} />
      ) : (
        <section className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No property cockpit data is available yet. Add a vacation-rental business, then import properties, bookings,
          owner statements, and maintenance.
        </section>
      )}
    </main>
  );
}
