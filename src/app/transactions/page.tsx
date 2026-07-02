import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_ROLES, roleListLabel } from "@/lib/access/roles";
import { TransactionsTable, type TxnRow } from "@/components/transactions/TransactionsTable";

export default async function TransactionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ADJUSTMENT_ROLES] } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const txns = role
    ? await prisma.transaction.findMany({
        where: { restaurantId: role.restaurantId },
        orderBy: { date: "desc" },
        take: 200,
      })
    : [];

  // Convert Prisma Decimal/Date to plain JSON before handing to the client table.
  const rows: TxnRow[] = txns.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    merchantName: t.merchantName,
    description: t.description,
    amount: Number(t.amount),
    bucket: t.bucket,
    isManualOverride: t.isManualOverride,
    confidence: t.confidence,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Transactions</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"} â€” {rows.length} most recent. Recategorize to correct the
          automatic mapping; your choice sticks across future syncs.
        </p>
      </div>
      {role ? (
        <TransactionsTable rows={rows} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need an {roleListLabel(ADJUSTMENT_ROLES)} role on a business to review transactions.
        </p>
      )}
    </main>
  );
}
