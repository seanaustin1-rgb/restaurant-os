import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadVendorSpend } from "@/lib/modules/vendor-spend";
import { VendorSpendModule } from "@/components/modules/VendorSpendModule";

export default async function VendorSpendPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadVendorSpend(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Vendor Spend</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"}
          {data ? ` — ${data.periodLabel}` : ""} · where your money went, biggest suppliers first.
        </p>
      </div>
      {data ? (
        <VendorSpendModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need a restaurant to view vendor spend. Complete onboarding first.
        </p>
      )}
    </main>
  );
}
