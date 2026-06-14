import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadBreakEven } from "@/lib/modules/break-even";
import { BreakEvenModule } from "@/components/modules/BreakEvenModule";

export default async function BreakEvenPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadBreakEven(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Break-even</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"}
          {data?.hasData ? ` — ${data.periodLabel}` : ""} · the sales you need to cover fixed costs,
          and how much cushion you have above it.
        </p>
      </div>
      {data?.hasData ? (
        <BreakEvenModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No sales data yet. Run the Toast sync
          (<code className="text-copper-soft">scripts/sync-toast-metrics.ts</code>) to pull daily net sales
          and labor cost, then categorize bank transactions for COGS and operating expenses.
        </p>
      )}
    </main>
  );
}
