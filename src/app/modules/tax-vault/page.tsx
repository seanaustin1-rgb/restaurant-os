import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadTaxVault } from "@/lib/modules/tax-vault";
import { TaxVaultModule } from "@/components/modules/TaxVaultModule";

export default async function TaxVaultPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const data = role ? await loadTaxVault(role.restaurantId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Tax Vault</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your business"}
          {data?.hasData ? ` â€” ${data.periodLabel}` : ""} Â· sales &amp; payroll tax set aside vs. pulled.
        </p>
      </div>
      {data?.hasData ? (
        <TaxVaultModule data={data} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No tax data yet. Sync sales from Toast, then run
          (<code className="text-copper-soft">scripts/sync-toast-sales-tax.ts</code>) to pull collected
          sales tax.
        </p>
      )}
    </main>
  );
}
