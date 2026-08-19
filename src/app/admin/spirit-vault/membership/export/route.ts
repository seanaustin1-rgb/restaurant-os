import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";

// Staff-only CSV export of this venue's members, for dropping into Mailchimp / Toast.
// `?opted=1` limits to marketing-opted-in members (the CAN-SPAM-safe list).
export const dynamic = "force-dynamic";

function cell(v: string | null | undefined): string {
  return `"${(v ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...SPIRIT_VAULT_STAFF_ROLES] }, restaurant: { businessType: "RESTAURANT" } },
    select: { restaurantId: true },
  });
  if (!role) return new Response("Forbidden", { status: 403 });

  const optedOnly = new URL(req.url).searchParams.get("opted") === "1";

  const members = await prisma.guestMembership.findMany({
    where: { restaurantId: role.restaurantId, ...(optedOnly ? { guest: { marketingOptIn: true } } : {}) },
    orderBy: { startedAt: "desc" },
    select: {
      tier: true,
      status: true,
      startedAt: true,
      currentPeriodEnd: true,
      guest: { select: { email: true, displayName: true, marketingOptIn: true, marketingOptInAt: true } },
    },
  });

  const header = ["email", "name", "marketing_opt_in", "opted_in_at", "tier", "status", "member_since", "access_through"];
  const lines = members.map((m) =>
    [
      cell(m.guest.email),
      cell(m.guest.displayName),
      m.guest.marketingOptIn ? "yes" : "no",
      cell(m.guest.marketingOptInAt?.toISOString() ?? ""),
      cell(m.tier),
      cell(m.status),
      cell(m.startedAt.toISOString()),
      cell(m.currentPeriodEnd.toISOString()),
    ].join(","),
  );
  const csv = [header.join(","), ...lines].join("\r\n");

  const name = optedOnly ? "spirit-vault-members-opted-in.csv" : "spirit-vault-members.csv";
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
