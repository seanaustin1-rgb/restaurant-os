import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadBenchmarks } from "@/lib/modules/benchmarks";
import { BenchmarksModule } from "@/components/modules/BenchmarksModule";

export default async function BenchmarksPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadBenchmarks(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Peer Benchmarks</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data?.hasData ? ` â€” ${data.periodLabel}` : ""} Â· your core operating ratios vs.{" "}
          {data?.cohort ?? "industry"} reference ranges.
        </p>
      </div>
      {data?.hasData ? (
        <BenchmarksModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No sales data yet. Sync or import sales data, then categorize bank transactions for direct costs and operating costs.
        </p>
      )}
    </main>
  );
}
