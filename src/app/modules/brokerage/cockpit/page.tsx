import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExecutiveCockpit } from "@/components/cockpit/ExecutiveCockpit";
import { loadBrokerageCockpit } from "@/lib/modules/brokerage-analytics";
import { ADJUSTMENT_ROLES } from "@/lib/access/roles";
import { prisma } from "@/lib/prisma";

export default async function BrokerageExecutiveCockpitPage({
  searchParams,
}: {
  searchParams?: { restaurantId?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Leadership-only (locked decision 7): the Executive Cockpit renders the named
  // per-agent leaderboard, which INVESTOR must never see. Scope the lookup to
  // leadership roles so an investor gets the empty state, never the data — even
  // if they reach this route directly.
  const role = await prisma.userRestaurantRole.findFirst({
    where: {
      clerkUserId: userId,
      role: { in: [...ADJUSTMENT_ROLES] },
      ...(searchParams?.restaurantId ? { restaurantId: searchParams.restaurantId } : {}),
      restaurant: { businessType: "REAL_ESTATE_BROKERAGE" },
    },
    select: { restaurantId: true },
    orderBy: { createdAt: "asc" },
  });

  const data = role ? await loadBrokerageCockpit(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link href="/modules/brokerage" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-copper-soft">
          <ArrowLeft size={14} /> Brokerage analytics
        </Link>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Brokerage Executive Cockpit</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          Leadership macro view: deal health, ledger health, Company Dollar retention, cash oxygen, agent production,
          market position, and Aura.
        </p>
      </div>

      {data ? (
        <ExecutiveCockpit data={data} />
      ) : (
        <section className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No brokerage cockpit data is available yet. Add a real-estate brokerage business, then import agents/deals or
          connect sources.
        </section>
      )}
    </main>
  );
}
