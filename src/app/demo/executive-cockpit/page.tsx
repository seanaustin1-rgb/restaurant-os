/**
 * TEMPORARY dev-only, NO-AUTH preview of the brokerage Executive Cockpit.
 *
 * - Lives under /demo/* which is a PUBLIC route in middleware (no auth).
 * - 404s in production (NODE_ENV guard) — do not ship.
 * - Wired to Codex's REAL `loadBrokerageCockpit` loader against the first
 *   REAL_ESTATE_BROKERAGE tenant in the DB (run `npm run seed:brokerage` to
 *   create one). No mock fixture.
 */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadBrokerageCockpit } from "@/lib/modules/brokerage-analytics";
import { ExecutiveCockpit } from "@/components/cockpit/ExecutiveCockpit";

export const dynamic = "force-dynamic";

export default async function ExecutiveCockpitPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  // Pick a brokerage tenant that actually has deal data (skips mis-typed/empty
  // tenants); newest first so a fresh `seed:brokerage` run wins.
  const restaurant = await prisma.restaurant.findFirst({
    where: { businessType: "REAL_ESTATE_BROKERAGE", brokerageDeals: { some: {} } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const data = restaurant ? await loadBrokerageCockpit(restaurant.id) : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
        <strong>DEV PREVIEW — no auth.</strong> Brokerage Executive Cockpit wired to the real{" "}
        <code className="mx-1">loadBrokerageCockpit</code> loader. 404s in production.
      </div>

      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Leadership view</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Executive Cockpit</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          The five macro instruments of brokerage health — deal vs. ledger, company-dollar retention, cash oxygen,
          reputation, market position, and agent production.
        </p>
      </div>

      {!data ? (
        <section className="rounded-lg border border-orange-500/45 bg-orange-500/10 p-6">
          <h2 className="text-xl font-semibold text-white">No brokerage tenant found</h2>
          <p className="mt-2 text-sm leading-6 text-orange-200">
            No <code>REAL_ESTATE_BROKERAGE</code> tenant on this DB (or the brokerage migration isn&apos;t applied). Run{" "}
            <code>npm run seed:brokerage</code> after the <code>20260630125000_add_brokerage_source_identity</code>{" "}
            migration is applied.
          </p>
        </section>
      ) : (
        <ExecutiveCockpit data={data} />
      )}
    </main>
  );
}
