import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadSalesMix } from "@/lib/modules/sales-mix";
import { SalesMixModule } from "@/components/modules/SalesMixModule";

export default async function SalesMixPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadSalesMix(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Sales Mix</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data?.hasData ? ` â€” ${data.windowLabel}` : ""} Â· net sales by revenue center, from Toast.
        </p>
      </div>
      {data?.hasData ? (
        <SalesMixModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No sales-mix data yet. Run the sales-mix sync
          (<code className="text-copper-soft">scripts/sync-toast-sales-mix.ts</code>) to pull the
          revenue-center breakdown from Toast.
        </p>
      )}
    </main>
  );
}
