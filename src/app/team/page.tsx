import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamAccess, TeamAccessDenied } from "@/lib/team/access";
import { listMyTeamTenants } from "@/lib/team/tenants";

export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams: { restaurantId?: string } }) {
  const restaurantId = searchParams.restaurantId;
  const tenants = await listMyTeamTenants();
  if (restaurantId) {
    const viewer = await requireTeamAccess(restaurantId).catch((error: unknown) => {
      if (error instanceof TeamAccessDenied) notFound();
      throw error;
    });
    const tenant = tenants.find((row) => row.id === restaurantId);
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        <div>
          <p className="text-xs uppercase tracking-widest text-copper-soft">Team Hub</p>
          <h1 className="mt-2 font-display text-3xl">{tenant?.name ?? "Your team"}</h1>
          <p className="mt-2 text-sm text-muted">Your team learning space is being prepared.</p>
        </div>
        {viewer.role === "MANAGER" && (
          <Link className="inline-block rounded-md border border-copper-dim px-4 py-2 text-copper-soft" href={`/team/manage?restaurantId=${encodeURIComponent(restaurantId)}`}>
            Manage roster
          </Link>
        )}
      </main>
    );
  }
  if (tenants.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-5 py-10">
        <h1 className="font-display text-3xl">No active Team access</h1>
        <p className="text-sm text-muted">Your Team access is no longer active. Ask your manager if you expected to see a team here.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-5 py-10">
      <h1 className="font-display text-3xl">Team Hub</h1>
      <p className="text-sm text-muted">Choose a team to open.</p>
      <div className="grid gap-3">
        {tenants.map((tenant) => (
          <Link key={tenant.id} href={`/team?restaurantId=${encodeURIComponent(tenant.id)}`} className="rounded-lg border border-line bg-surface px-5 py-4 hover:border-copper-dim">
            {tenant.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
