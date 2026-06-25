import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MISC_CATEGORY_NAME } from "@/lib/categorization/categories";
import { MiscReviewTable, type MiscRow, type CategoryOption } from "@/components/transactions/MiscReviewTable";

// "Name every dollar" cleanup view: the unassigned tail (Misc + null category),
// biggest dollars first, with bulk assign.
export default async function MiscReviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "MANAGER"] } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  let rows: MiscRow[] = [];
  let categories: CategoryOption[] = [];

  if (role) {
    const misc = await prisma.category.findFirst({
      where: { restaurantId: role.restaurantId, name: MISC_CATEGORY_NAME },
      select: { id: true },
    });

    const txns = await prisma.transaction.findMany({
      where: {
        restaurantId: role.restaurantId,
        OR: [{ categoryId: null }, ...(misc ? [{ categoryId: misc.id }] : [])],
      },
      orderBy: { amount: "desc" }, // biggest unnamed dollars first
      take: 300,
      select: { id: true, date: true, merchantName: true, description: true, amount: true },
    });
    rows = txns.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      merchantName: t.merchantName,
      description: t.description,
      amount: Number(t.amount),
    }));

    const cats = await prisma.category.findMany({
      where: { restaurantId: role.restaurantId, archivedAt: null, name: { not: MISC_CATEGORY_NAME } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    categories = cats.map((c) => ({ id: c.id, name: c.name }));
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Review — Unnamed Transactions</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} — everything still in Misc/Unassigned, biggest dollars first.
          Select rows and give them a category; your choice sticks and won&rsquo;t be re-swept by rules. Add a keyword{" "}
          <span className="text-ink-text">Rule</span> to auto-categorize these next time.
        </p>
      </div>
      {role ? (
        <MiscReviewTable rows={rows} categories={categories} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need an operator/manager role on a restaurant to review transactions.
        </p>
      )}
    </main>
  );
}
