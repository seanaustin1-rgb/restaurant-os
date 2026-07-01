import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BrokerageImportPilot } from "@/components/import/BrokerageImportPilot";

export default async function BrokerageImportPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const roles = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "MANAGER", "CONSULTANT"] } },
    select: { restaurantId: true, restaurant: { select: { name: true, businessType: true } } },
    orderBy: { restaurant: { name: "asc" } },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Import brokerage data</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Paste a brokerage export to preview agents, closed and pending deals, splits, caps, and lead spend before
          anything is saved. Company Dollar is derived from GCI minus agent splits, franchise fees, and referral fees
          when the export does not already carry it.
        </p>
      </div>
      <BrokerageImportPilot
        businesses={roles.map((role) => ({
          id: role.restaurantId,
          name: role.restaurant.name,
          businessType: role.restaurant.businessType,
        }))}
      />
    </main>
  );
}
