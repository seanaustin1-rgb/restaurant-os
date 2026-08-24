import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/access/roles";
import { SpiritListTable, type SpiritRow } from "@/components/spirit-vault/SpiritListTable";

export const dynamic = "force-dynamic";

function spiritName(item: {
  definition: { displayName: string | null; brand: string; expression: string | null };
}): string {
  return item.definition.displayName ?? [item.definition.brand, item.definition.expression].filter(Boolean).join(" ");
}

export default async function SpiritVaultAdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...OPERATOR_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  if (!role) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          The Spirit Vault editor is available to restaurant operators.
        </p>
      </main>
    );
  }

  const items = await prisma.venueSpirit.findMany({
    where: { restaurantId: role.restaurantId },
    orderBy: [{ publicationStatus: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      recordStatus: true,
      publicationStatus: true,
      whyWeCarry: true,
      seanShort: true,
      notes: true,
      definition: {
        select: {
          brand: true,
          expression: true,
          displayName: true,
          category: true,
          proofN: true,
          proofDisplay: true,
        },
      },
    },
  });

  const rows: SpiritRow[] = items.map((i) => ({
    id: i.id,
    recordStatus: i.recordStatus,
    publicationStatus: i.publicationStatus,
    hasVoice: !!(i.whyWeCarry || i.seanShort || i.notes),
    name: spiritName(i),
    category: i.definition.category,
    proof: i.definition.proofN?.toString() ?? i.definition.proofDisplay ?? "-",
  }));

  const total = rows.length;
  const published = rows.filter((r) => r.publicationStatus === "PUBLISHED" && r.recordStatus === "PUBLISHED").length;
  const needsVoice = rows.filter((r) => !r.hasVoice).length;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-display text-2xl text-copper-soft">Spirits</h1>
          <Link
            href="/admin/spirit-vault/flights/new"
            className="rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-sm text-copper-soft hover:bg-copper/20"
          >
            Create a Flight
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          {role.restaurant?.name ?? "Your bar"} — edit dossiers, add your voice, and publish. Published records go live
          on the guest vault immediately. Use the checkboxes to include or exclude spirits from the vault.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded border border-line px-2 py-1">{total} bottles</span>
          <span className="rounded border border-line px-2 py-1">{published} live</span>
          <span className="rounded border border-line px-2 py-1">{needsVoice} awaiting your voice</span>
        </div>
      </div>

      <SpiritListTable items={rows} />
    </main>
  );
}
