import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadAllocation } from "@/lib/modules/allocation";
import { AllocationVariance } from "@/components/modules/AllocationVariance";

export default async function AllocationPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadAllocation(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Allocation &amp; Variance</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"}
          {data ? ` — ${data.periodLabel}` : ""} · Profit First set-aside vs. what actually cleared.
        </p>
      </div>
      {data && data.hasData ? (
        <AllocationVariance data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          {data
            ? "No sales data yet for this period — connect Toast or import sales so allocations can compute."
            : "You need a restaurant to view allocations. Complete onboarding first."}
        </p>
      )}
    </main>
  );
}
