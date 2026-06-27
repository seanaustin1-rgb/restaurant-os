import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES, roleListLabel } from "@/lib/access/roles";
import { BeverageSettingsForm } from "@/components/beverage/BeverageSettingsForm";

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export default async function BeverageSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const settings = role
    ? await prisma.targetSettings.findUnique({
        where: { restaurantId: role.restaurantId },
        select: {
          liquorSalesMixPct: true,
          beverageSalesMixPct: true,
          targetLiquorPourPct: true,
          targetBeveragePourPct: true,
        },
      })
    : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Beverage Cost Targets</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} — set your pour-cost goals and, until Toast is connected, the
          alcohol share of sales the ratios are measured against. These drive the Beverage Cost gauges on your dashboard.
        </p>
      </div>
      {role ? (
        <BeverageSettingsForm
          initial={{
            liquorSalesMixPct: num(settings?.liquorSalesMixPct),
            beverageSalesMixPct: num(settings?.beverageSalesMixPct),
            targetLiquorPourPct: num(settings?.targetLiquorPourPct),
            targetBeveragePourPct: num(settings?.targetBeveragePourPct),
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
