import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadMenuEngineering } from "@/lib/modules/menu-engineering";
import { MenuEngineeringModule } from "@/components/modules/MenuEngineeringModule";

export default async function MenuEngineeringPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadMenuEngineering(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Menu Engineering</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data?.hasData ? ` â€” ${data.windowLabel}` : ""} Â· items by popularity &amp; revenue, from Toast.
        </p>
      </div>
      {data?.hasData ? (
        <MenuEngineeringModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No menu-item data yet. Run the menu sync
          (<code className="text-copper-soft">scripts/sync-toast-menu-items.ts</code>) to pull
          item-level sales from Toast.
        </p>
      )}
    </main>
  );
}
