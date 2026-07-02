import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCoversFlow } from "@/lib/modules/covers-flow";
import { CoversFlowModule } from "@/components/modules/CoversFlowModule";

export default async function CoversFlowPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadCoversFlow(role.restaurantId) : null;
  const fromToast = data?.sources.includes("toast");

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Covers Flow</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data?.hasData ? ` â€” ${data.periodLabel}` : ""} Â· guests, orders &amp; average check by day
          {fromToast ? ", from Toast" : ""}.
        </p>
      </div>
      {data?.hasData ? (
        <CoversFlowModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No covers data yet. Run the Toast sync
          (<code className="text-copper-soft">scripts/sync-toast-metrics.ts</code>) to pull daily
          guests &amp; orders from Toast.
        </p>
      )}
    </main>
  );
}
