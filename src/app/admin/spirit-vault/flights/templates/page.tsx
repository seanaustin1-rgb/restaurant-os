import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { loadCustomTemplates } from "@/lib/spirit-vault/custom-templates.server";
import { loadFlightCandidatePours } from "@/lib/spirit-vault/flight-template-candidates.server";
import { CustomTemplateList } from "@/components/spirit-vault/CustomTemplateList";

export const dynamic = "force-dynamic";

export default async function CustomTemplatesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) redirect("/admin/spirit-vault/flights");

  const [templates, pours] = await Promise.all([
    loadCustomTemplates(role.restaurantId),
    loadFlightCandidatePours(role.restaurantId),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/spirit-vault/flights" className="text-xs text-muted hover:text-copper-soft">
            Back to flights
          </Link>
          <h1 className="mt-2 font-display text-2xl text-copper-soft">Custom Templates</h1>
          <p className="mt-1 text-sm text-muted">
            Create reusable flight templates with your own slot rules. Templates appear in the flight builder alongside the built-in set.
          </p>
        </div>
      </div>

      <CustomTemplateList templates={templates} pours={pours} />
    </main>
  );
}
