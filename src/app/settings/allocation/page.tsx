import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES, roleListLabel } from "@/lib/access/roles";
import { AllocationSettingsForm } from "@/components/allocation/AllocationSettingsForm";

const num = (v: unknown, fallback: number): number => (v == null ? fallback : Number(v));

export default async function AllocationSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const settings = role
    ? await prisma.tapSettings.findUnique({
        where: { restaurantId: role.restaurantId },
        select: {
          profitPct: true,
          ownerPayPct: true,
          cogsFoodPct: true,
          cogsLiquorPct: true,
          laborPct: true,
          opexPct: true,
          simulationMode: true,
        },
      })
    : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Profit First — Allocation</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} — your Target Allocation Percentages (TAPs). These split every
          sales dollar across the Profit First buckets and set the targets on your dashboard gauges. They must total
          100%.
        </p>
      </div>
      {role ? (
        <AllocationSettingsForm
          initial={{
            profitPct: num(settings?.profitPct, 5),
            ownerPayPct: num(settings?.ownerPayPct, 5),
            cogsFoodPct: num(settings?.cogsFoodPct, 18),
            cogsLiquorPct: num(settings?.cogsLiquorPct, 12),
            laborPct: num(settings?.laborPct, 32),
            opexPct: num(settings?.opexPct, 28),
            simulationMode: settings?.simulationMode ?? true,
          }}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need an {roleListLabel(ADJUSTMENT_ROLES)} role on a restaurant to manage these settings.
        </p>
      )}
    </main>
  );
}
