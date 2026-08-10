import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SPIRIT_VAULT_STAFF_ROLES } from "@/lib/access/roles";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Published",
  REVIEWED: "Reviewed",
  DRAFT: "Draft",
};

export default async function SpiritFlightsPage() {
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
          Spirit Vault flights are available to restaurant operators and managers.
        </p>
      </main>
    );
  }

  const flights = await prisma.spiritFlight.findMany({
    where: { restaurantId: role.restaurantId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/spirit-vault" className="text-xs text-muted hover:text-copper-soft">
            Back to Spirit Vault
          </Link>
          <h1 className="mt-2 font-display text-2xl text-copper-soft">Create a Flight</h1>
          <p className="mt-1 text-sm text-muted">
            {role.restaurant?.name ?? "Your bar"} - build Toast-trackable flights from existing vault spirits.
          </p>
        </div>
        <Link
          href="/admin/spirit-vault/flights/new"
          className="rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20"
        >
          New flight
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-medium">Flight</th>
              <th className="px-3 py-2 font-medium">Items</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {flights.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted">
                  No flights yet.
                </td>
              </tr>
            )}
            {flights.map((flight) => (
              <tr key={flight.id} className="border-b border-line/60 last:border-0 hover:bg-surface/60">
                <td className="px-3 py-2">
                  <div className="text-ink-text">{flight.name}</div>
                  {flight.description && <div className="mt-1 line-clamp-1 text-xs text-muted">{flight.description}</div>}
                </td>
                <td className="tnum px-3 py-2 text-muted">{flight._count.items}</td>
                <td className="px-3 py-2 text-muted">{STATUS_LABEL[flight.status] ?? flight.status}</td>
                <td className="px-3 py-2 text-muted">{flight.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
