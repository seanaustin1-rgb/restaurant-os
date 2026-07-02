import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCashRunway } from "@/lib/modules/cash-runway";
import { CashRunwayModule } from "@/components/modules/CashRunwayModule";

export default async function CashRunwayPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadCashRunway(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Cash Runway</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"} Â· days of cash at the current burn rate,
          from your bank transactions.
        </p>
      </div>
      {data ? (
        <CashRunwayModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need a business to view cash runway. Complete onboarding first.
        </p>
      )}
    </main>
  );
}
