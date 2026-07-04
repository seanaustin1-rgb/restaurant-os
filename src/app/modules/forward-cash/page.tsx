import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadForwardCash } from "@/lib/modules/forward-cash";
import { ForwardCashModule } from "@/components/modules/ForwardCashModule";

export default async function ForwardCashPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadForwardCash(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Forward Cash</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"} · your operating balance projected 30 days out
          against upcoming bills, payroll, and Profit First sweeps.
        </p>
      </div>
      {data ? (
        <ForwardCashModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need a business to view forward cash. Complete onboarding first.
        </p>
      )}
    </main>
  );
}
