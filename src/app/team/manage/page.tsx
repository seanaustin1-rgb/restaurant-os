import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamAccess, TeamAccessDenied } from "@/lib/team/access";
import { teamDb } from "@/lib/team/db";
import { listMyTeamTenants } from "@/lib/team/tenants";
import { TeamRoster } from "./roster";

export const dynamic = "force-dynamic";

export default async function TeamManagePage({ searchParams }: { searchParams: { restaurantId?: string } }) {
  const restaurantId = searchParams.restaurantId;
  if (!restaurantId) {
    const tenants = (await listMyTeamTenants()).filter((row) => row.viewer.role === "MANAGER");
    return (
      <main className="mx-auto max-w-3xl space-y-5 px-5 py-10">
        <h1 className="font-display text-3xl">Manage team</h1>
        {tenants.map((tenant) => (
          <Link key={tenant.id} href={`/team/manage?restaurantId=${encodeURIComponent(tenant.id)}`} className="block rounded-lg border border-line px-5 py-4 hover:border-copper-dim">
            {tenant.name}
          </Link>
        ))}
        {tenants.length === 0 && <p className="text-muted">You do not manage an enabled team.</p>}
      </main>
    );
  }
  await requireTeamAccess(restaurantId, "MANAGER").catch((error: unknown) => {
    if (error instanceof TeamAccessDenied) notFound();
    throw error;
  });
  const members = await teamDb(restaurantId).teamMembership.findMany({
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    select: { id: true, displayName: true, phoneE164: true, departments: true, role: true, status: true },
  });
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <Link href={`/team?restaurantId=${encodeURIComponent(restaurantId)}`} className="text-sm text-copper-soft">← Team Hub</Link>
      <div>
        <h1 className="font-display text-3xl">Team roster</h1>
        <p className="mt-1 text-sm text-muted">Add staff by phone, then text each invitation link. A verified phone code activates their membership.</p>
      </div>
      <Link className="inline-flex min-h-11 items-center rounded border border-copper-dim px-4 text-sm text-copper-soft" href={`/team/manage/new?restaurantId=${encodeURIComponent(restaurantId)}`}>New lesson</Link>
      <TeamRoster restaurantId={restaurantId} members={members} />
    </main>
  );
}
