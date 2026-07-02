import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCashFlow } from "@/lib/modules/cash-flow";
import { CashFlowModule } from "@/components/modules/CashFlowModule";

export default async function CashFlowPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadCashFlow(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Cash Flow</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data ? ` â€” ${data.periodLabel}` : ""} Â· money in vs. out, by day, from your bank transactions.
        </p>
      </div>
      {data ? (
        <CashFlowModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need a business to view cash flow. Complete onboarding first.
        </p>
      )}
    </main>
  );
}
