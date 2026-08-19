import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { TemplatedFlightBuilder } from "@/components/spirit-vault/TemplatedFlightBuilder";
import { FLIGHT_TEMPLATES } from "@/lib/spirit-vault/flight-templates";
import { loadFlightCandidatePours } from "@/lib/spirit-vault/flight-template-candidates";

export const dynamic = "force-dynamic";

export default async function NewSpiritFlightPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) redirect("/admin/spirit-vault/flights");

  const pours = await loadFlightCandidatePours(role.restaurantId);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <Link href="/admin/spirit-vault/flights" className="text-xs text-muted hover:text-copper-soft">
          Back to flights
        </Link>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">New Flight</h1>
        <p className="mt-1 text-sm text-muted">
          Start from a template or build from scratch. Up to 4 pours, priced as 1 oz components from the selected source pour.
        </p>
      </div>

      {pours.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No priced published vault pours are available yet.
        </p>
      ) : (
        <TemplatedFlightBuilder pours={pours} templates={FLIGHT_TEMPLATES} />
      )}
    </main>
  );
}
