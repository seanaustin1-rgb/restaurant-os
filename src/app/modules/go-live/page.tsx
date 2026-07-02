import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadGoLiveCoach } from "@/lib/modules/go-live-coach";
import { GoLiveCoachModule } from "@/components/modules/GoLiveCoachModule";

export default async function GoLiveCoachPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadGoLiveCoach(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Go-Live Coach</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data?.hasData ? ` - ${data.periodLabel}` : ""} - virtual Profit First readiness before real account setup.
        </p>
      </div>
      {data?.hasData ? (
        <GoLiveCoachModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No heartbeat data yet. Connect POS and bank feeds so Go-Live Coach can simulate what Profit First would
          have done before any real account setup.
        </p>
      )}
    </main>
  );
}
