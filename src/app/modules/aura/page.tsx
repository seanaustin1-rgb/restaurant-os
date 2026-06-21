import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadAura } from "@/lib/modules/aura";
import { loadReputationTrend } from "@/lib/modules/reputation-trend";
import { AuraModule } from "@/components/modules/AuraModule";

// Reputation aggregates from external review APIs; cache the page hourly (the
// providers also cache their fetches) so we don't hammer Google/Yelp/Meta.
export const revalidate = 3600;

export default async function AuraPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurant: { select: { name: true } } },
  });

  const [data, trend] = await Promise.all([loadAura(), loadReputationTrend()]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Aura — Reputation</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} · your standing across Google, Yelp &amp; Facebook in
          one place. Connect a source and it lights up here.
        </p>
      </div>
      <AuraModule data={data} trend={trend} />
    </main>
  );
}
