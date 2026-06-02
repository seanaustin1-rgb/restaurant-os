import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ConnectBankButton } from "@/components/plaid/ConnectBankButton";
import { SyncNowButton } from "@/components/plaid/SyncNowButton";

export default async function ConnectionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const connections = role
    ? await prisma.plaidConnection.findMany({
        where: { restaurantId: role.restaurantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          institution: true,
          isActive: true,
          lastSyncedAt: true,
          _count: { select: { transactions: true } },
        },
      })
    : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Bank connections</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} — link bank accounts via Plaid to pull transactions automatically.
        </p>
      </div>

      {!role && (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          You don&apos;t have a restaurant yet. Complete onboarding first.
        </div>
      )}

      {role && (
        <>
          <div className="space-y-3 rounded-lg border border-line bg-surface p-5">
            <ConnectBankButton />
            {connections.length > 0 && <SyncNowButton />}
          </div>

          <div className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-muted">Linked accounts</h2>
            {connections.length === 0 && (
              <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
                No bank connected yet.
              </div>
            )}
            {connections.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
                <div className="flex items-center gap-3">
                  <Landmark size={18} className="text-copper" />
                  <div>
                    <div className="text-sm text-[#E6E8E4]">{c.institution ?? "Bank"}</div>
                    <div className="text-xs text-muted">
                      {c._count.transactions} transactions ·{" "}
                      {c.lastSyncedAt ? `synced ${c.lastSyncedAt.toLocaleDateString()}` : "never synced"}
                    </div>
                  </div>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] " +
                    (c.isActive ? "bg-health-green/15 text-health-green" : "bg-line text-muted")
                  }
                >
                  {c.isActive ? "active" : "inactive"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
