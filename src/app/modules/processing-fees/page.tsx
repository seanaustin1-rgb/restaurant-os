import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadProcessingFees } from "@/lib/modules/processing-fees";
import { ProcessingFeesModule } from "@/components/modules/ProcessingFeesModule";

export default async function ProcessingFeesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadProcessingFees(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Processing Fee Leak</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"}
          {data?.hasData ? ` — ${data.periodLabel}` : ""} · card-processing fees as a share of sales,
          vs. benchmark — where the swipe is leaking cash.
        </p>
      </div>
      {data?.hasData ? (
        <ProcessingFeesModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No sales data yet. Run the Toast sync
          (<code className="text-copper-soft">scripts/sync-toast-metrics.ts</code>) to pull daily sales, then
          categorize bank transactions so processing-fee charges can be detected.
        </p>
      )}
    </main>
  );
}
