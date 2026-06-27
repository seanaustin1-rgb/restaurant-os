import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AccessManagementForm } from "@/components/access/AccessManagementForm";

export default async function AccessSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const operatorRole = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: "OPERATOR" },
    select: {
      restaurantId: true,
      restaurant: { select: { name: true } },
    },
  });

  if (!operatorRole) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <h1 className="font-display text-2xl text-copper-soft">Access Management</h1>
          <p className="mt-1 text-sm text-muted">
            Access management is owner/operator controlled.
          </p>
        </div>
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You do not have operator access to a business yet.
        </p>
      </main>
    );
  }

  const rows = await prisma.userRestaurantRole.findMany({
    where: { restaurantId: operatorRole.restaurantId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      clerkUserId: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="rounded-lg border border-copper-dim/40 bg-surface p-5">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          <ShieldCheck size={14} /> Owner controls
        </p>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Access Management</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {operatorRole.restaurant.name} can grant advisors setup access, managers operating access, and investors
          guaranteed read-only matrix access. Sensitive bank and Google authorizations remain owner/operator controlled.
        </p>
      </div>

      <AccessManagementForm
        currentUserId={userId}
        rows={rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toLocaleDateString(),
        }))}
      />
    </main>
  );
}
