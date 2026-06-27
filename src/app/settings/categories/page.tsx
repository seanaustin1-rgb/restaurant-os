import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES, roleListLabel } from "@/lib/access/roles";
import { CategoriesManager, type CategoryRow } from "@/components/categories/CategoriesManager";

export default async function CategoriesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const cats = role
    ? await prisma.category.findMany({
        where: { restaurantId: role.restaurantId, archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    : [];

  const counts = role
    ? await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { restaurantId: role.restaurantId },
        _count: true,
      })
    : [];
  const countByCat = new Map(counts.map((c) => [c.categoryId, c._count]));

  const rows: CategoryRow[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    tapBucket: c.tapBucket,
    isSystem: c.isSystem,
    txnCount: countByCat.get(c.id) ?? 0,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Categories</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} — name every dollar. Each category rolls up into a Profit First
          bucket; add your own. &ldquo;Misc&rdquo; is the catch-all, and &ldquo;Excluded&rdquo; keeps cash movements
          (register cash, tip-outs, transfers) out of the gauges.
        </p>
      </div>
      {role ? (
        <CategoriesManager rows={rows} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need an {roleListLabel(ADJUSTMENT_ROLES)} role on a restaurant to manage categories.
        </p>
      )}
    </main>
  );
}
