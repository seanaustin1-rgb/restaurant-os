import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadVendorSetup } from "@/lib/onboarding/vendor-setup";
import { VendorSetupWizard } from "@/components/onboarding/VendorSetupWizard";

export default async function VendorSetupPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "MANAGER"] } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadVendorSetup(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Set up your vendors</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} · confirm where your biggest vendors belong. Each one you
          confirm teaches the system a rule, so future imports self-categorize.
        </p>
      </div>
      {data?.hasData ? (
        <VendorSetupWizard
          rows={data.rows}
          categories={data.categories}
          totalSpend={data.totalSpend}
          coveredPct={data.coveredPct}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No vendor spend yet. Import a bank statement or connect your bank, then come back to map your top vendors.
        </p>
      )}
    </main>
  );
}
