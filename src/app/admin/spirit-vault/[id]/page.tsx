import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/access/roles";
import { SpiritEditForm } from "@/components/spirit-vault/SpiritEditForm";

export const dynamic = "force-dynamic";

const FLAVOR_AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const asFlavor = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  const src = (v && typeof v === "object" ? (v as Record<string, unknown>) : {}) ?? {};
  for (const a of FLAVOR_AXES) out[a] = typeof src[a] === "number" ? (src[a] as number) : 5;
  return out;
};

function spiritName(item: { definition: { displayName: string | null; brand: string; expression: string | null } }): string {
  return item.definition.displayName ?? [item.definition.brand, item.definition.expression].filter(Boolean).join(" ");
}

export default async function SpiritEditPage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...OPERATOR_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) redirect("/admin/spirit-vault");

  const item = await prisma.venueSpirit.findFirst({
    where: { id: params.id, restaurantId: role.restaurantId },
    include: { definition: true },
  });
  if (!item) notFound();

  // Venue presentation overrides win over the shared definition when present, so
  // the form shows the effective (guest-visible) values this tenant is editing.
  const ov = (item.overrides && typeof item.overrides === "object" ? item.overrides : {}) as {
    body?: number | null;
    finish?: number | null;
    flavor?: unknown;
    topNotes?: unknown;
    pairings?: unknown;
  };
  const ovTopNotes = asStrings(ov.topNotes);
  const ovPairings = asStrings(ov.pairings);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <div>
        <Link href="/admin/spirit-vault" className="text-xs text-muted hover:text-copper-soft">
          Back to the vault
        </Link>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">{spiritName(item)}</h1>
        <p className="mt-1 text-sm text-muted">
          {item.definition.category}
          {item.definition.style ? ` - ${item.definition.style}` : ""} -{" "}
          {item.definition.proofN?.toString() ?? item.definition.proofDisplay ?? "-"} proof
        </p>
      </div>

      <SpiritEditForm
        initial={{
          id: item.id,
          whyWeCarry: item.whyWeCarry ?? "",
          seanShort: item.seanShort ?? "",
          notes: item.notes ?? "",
          body: ov.body ?? item.definition.body,
          finish: ov.finish ?? item.definition.finish,
          flavor: asFlavor(ov.flavor ?? item.definition.flavor),
          topNotes: ovTopNotes.length ? ovTopNotes : item.definition.topNotes,
          pairings: ovPairings.length ? ovPairings : asStrings(item.definition.pairings),
          recordStatus: item.recordStatus,
          publicationStatus: item.publicationStatus,
        }}
      />
    </main>
  );
}
