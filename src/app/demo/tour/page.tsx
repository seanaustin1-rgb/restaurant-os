import type { Metadata } from "next";
import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { getDemoBistroId } from "@/lib/demo/demo-tenant";
import { demoPrisma } from "@/lib/demo/demo-prisma";
import { loadDashboardData } from "@/lib/dashboard/data";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "Live demo - OutFront Data",
  description: "Tour the full OutFront Data dashboard with a sample business - no login required.",
};

// Read-only and always dynamic. NEVER seeds; if the sample tenant is not prepared,
// it shows a friendly state. Seeding is a deliberate operator action.
export const dynamic = "force-dynamic";

// Public Mode-1 tour: the complete dashboard for a seeded sample tenant, no login.
export default async function DemoTourPage() {
  // Reads from the SEPARATE demo database only. If it is not configured/seeded,
  // fall through to the "being prepared" state; the production DB is never used.
  const db = demoPrisma;
  const restaurantId = db ? await getDemoBistroId(db) : null;

  if (!restaurantId || !db) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="font-display text-2xl text-copper-soft">The live demo is being prepared</h1>
          <p className="mt-2 text-sm text-muted">
            Our sample business is warming up. In the meantime, see your own numbers in 60 seconds.
          </p>
          <Link
            href="/demo"
            className="mt-5 inline-block rounded-lg bg-copper px-5 py-2.5 font-medium text-ink hover:bg-copper-soft"
          >
            Try the instant estimate {"->"}
          </Link>
        </div>
      </main>
    );
  }

  const data = await loadDashboardData(restaurantId, db);

  return (
    <div>
      <div className="border-b border-copper-dim/40 bg-copper-dim/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          <p className="text-[13px] text-[#CFD2CC]">
            <span className="font-medium text-copper-soft">Live demo</span> - a sample business with realistic
            data. Use it to see the shape of the dashboard, then enter rough weekly numbers for your own first read.
          </p>
          <div className="flex items-center gap-3 text-[13px]">
            <Link href="/demo" className="rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 font-medium text-copper-soft hover:bg-copper/20">
              Restaurant estimate
            </Link>
            <Link href="/demo/real-estate" className="rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 font-medium text-copper-soft hover:bg-copper/20">
              Brokerage estimate
            </Link>
            <SignUpButton forceRedirectUrl="/onboarding">
              <button
                type="button"
                className="rounded-md bg-copper px-3 py-1.5 font-medium text-ink hover:bg-copper-soft"
              >
                Start free
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>

      <DashboardView dashboards={[data]} moduleOrder={null} pinnedModules={[]} demoMode />
    </div>
  );
}
