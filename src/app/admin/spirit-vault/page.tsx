import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/access/roles";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Published",
  REVIEWED: "Reviewed",
  DRAFT: "Draft",
};

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

  const total = items.length;
  const published = items.filter((i) => i.publicationStatus === "PUBLISHED" && i.recordStatus === "PUBLISHED").length;
  const needsVoice = items.filter((i) => !i.whyWeCarry && !i.seanShort && !i.notes).length;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Spirit Vault</h1>
        <p className="mt-1 text-sm text-muted">
          {role.restaurant?.name ?? "Your bar"} - edit dossiers, add your voice, and publish. Published records go live
          on the guest vault immediately.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded border border-line px-2 py-1">{total} bottles</span>
          <span className="rounded border border-line px-2 py-1">{published} live</span>
          <span className="rounded border border-line px-2 py-1">{needsVoice} awaiting your voice</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-medium">Bottle</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Proof</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Voice</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const live = i.publicationStatus === "PUBLISHED" && i.recordStatus === "PUBLISHED";
              const hasVoice = !!(i.whyWeCarry || i.seanShort || i.notes);
              return (
                <tr key={i.id} className="border-b border-line/60 last:border-0 hover:bg-surface/60">
                  <td className="px-3 py-2">
                    <Link href={`/admin/spirit-vault/${i.id}`} className="text-ink-text hover:text-copper-soft">
                      {spiritName(i)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{i.definition.category}</td>
                  <td className="tnum px-3 py-2 text-muted">
                    {i.definition.proofN?.toString() ?? i.definition.proofDisplay ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={live ? "text-health-green" : "text-muted"}>
                      {STATUS_LABEL[i.publicationStatus] ?? i.publicationStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{hasVoice ? "Yes" : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
