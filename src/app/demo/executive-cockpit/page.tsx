/**
 * TEMPORARY dev-only, NO-AUTH preview of the brokerage Executive Cockpit.
 *
 * - Lives under /demo/* which is a PUBLIC route in middleware (no auth).
 * - 404s in production (NODE_ENV guard) — do not ship.
 * - Renders the FROZEN fixture (mock-first). Swap to Codex's real loader once the
 *   `BrokerageCockpitData` contract lands; the component does not change.
 */
import { notFound } from "next/navigation";
import { ExecutiveCockpit } from "@/components/cockpit/ExecutiveCockpit";
import { executiveCockpitFixture } from "@/components/cockpit/fixture";

export const dynamic = "force-dynamic";

export default function ExecutiveCockpitPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
        <strong>DEV PREVIEW — no auth, mock data.</strong> Brokerage Executive Cockpit rendered against a frozen
        <code className="mx-1">BrokerageCockpitData</code> fixture. Swaps to Codex&apos;s real loader when the contract
        lands. 404s in production.
      </div>

      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Leadership view</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Executive Cockpit</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          The five macro instruments of brokerage health — deal vs. ledger, company-dollar retention, cash oxygen, agent
          production, and market &amp; aura.
        </p>
      </div>

      <ExecutiveCockpit data={executiveCockpitFixture} />
    </main>
  );
}
