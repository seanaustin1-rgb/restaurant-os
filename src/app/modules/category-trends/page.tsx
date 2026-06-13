import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCategoryTrends } from "@/lib/modules/category-trends";
import { CategoryTrendsModule } from "@/components/modules/CategoryTrendsModule";

export default async function CategoryTrendsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadCategoryTrends(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Category Trends &amp; Budgets</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} · month-over-month spend by category, with optional budgets.
        </p>
      </div>
      {data?.hasData ? (
        <CategoryTrendsModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No categorized spend yet. Import transactions to see month-over-month category trends.
        </p>
      )}
    </main>
  );
}
