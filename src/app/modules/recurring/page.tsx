import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadRecurring } from "@/lib/modules/recurring";
import { RecurringModule } from "@/components/modules/RecurringModule";

export default async function RecurringPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadRecurring(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Recurring &amp; Subscriptions</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data?.hasData ? ` â€” ${data.windowLabel}` : ""} Â· repeating charges from your bank
          transactions, with price-creep flags.
        </p>
      </div>
      {data?.hasData ? (
        <RecurringModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No recurring charges detected yet. Import more bank history to find repeating vendors.
        </p>
      )}
    </main>
  );
}
