import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadSpendingByCategory } from "@/lib/modules/spending-by-category";
import { SpendingByCategoryModule } from "@/components/modules/SpendingByCategoryModule";

export default async function SpendingByCategoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadSpendingByCategory(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Spending by Category</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"}
          {data ? ` — ${data.periodLabel}` : ""} · where every dollar goes, and what&apos;s left as profit.
        </p>
      </div>
      {data ? (
        <SpendingByCategoryModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need a restaurant to view spending. Complete onboarding first.
        </p>
      )}
    </main>
  );
}
