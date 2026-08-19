import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";
import { MembershipCodesManager, type CodeRow, type RedemptionRow } from "@/components/spirit-vault/MembershipCodesManager";

export const dynamic = "force-dynamic";

export default async function MembershipCodesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });
  if (!role) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          Membership codes are available to restaurant operators and managers.
        </p>
      </main>
    );
  }

  const [codesRaw, redemptionsRaw, memberCount, optedCount] = await Promise.all([
    prisma.membershipCode.findMany({
      where: { restaurantId: role.restaurantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        hint: true,
        label: true,
        status: true,
        grantDays: true,
        maxRedemptions: true,
        redemptionCount: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.membershipRedemption.findMany({
      where: { restaurantId: role.restaurantId },
      orderBy: { redeemedAt: "desc" },
      take: 25,
      select: { id: true, redeemedAt: true, guest: { select: { email: true } }, code: { select: { hint: true } } },
    }),
    prisma.guestMembership.count({ where: { restaurantId: role.restaurantId } }),
    prisma.guestMembership.count({ where: { restaurantId: role.restaurantId, guest: { marketingOptIn: true } } }),
  ]);

  const codes: CodeRow[] = codesRaw.map((c) => ({
    id: c.id,
    hint: c.hint,
    label: c.label,
    status: c.status,
    grantDays: c.grantDays,
    maxRedemptions: c.maxRedemptions,
    redemptionCount: c.redemptionCount,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));
  const redemptions: RedemptionRow[] = redemptionsRaw.map((r) => ({
    id: r.id,
    guestEmail: r.guest.email,
    codeHint: r.code.hint,
    redeemedAt: r.redeemedAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <Link href="/admin/spirit-vault" className="text-xs text-muted hover:text-copper-soft">
          Back to Spirit Vault
        </Link>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Membership codes</h1>
        <p className="mt-1 text-sm text-muted">
          {role.restaurant?.name ?? "Your bar"} — issue codes that grant a member a year of full vault access. A code is
          shown once when you generate it, then stored hashed; you can revoke it but never re-display it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <span className="text-ink-text">
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted">· {optedCount} opted in for marketing</span>
        <span className="ml-auto flex gap-4">
          <a href="/admin/spirit-vault/membership/export?opted=1" className="text-copper-soft hover:text-copper">
            Export opted-in (CSV)
          </a>
          <a href="/admin/spirit-vault/membership/export" className="text-muted hover:text-ink-text">
            Export all
          </a>
        </span>
      </div>

      <MembershipCodesManager codes={codes} redemptions={redemptions} />
    </main>
  );
}
