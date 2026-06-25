import type { Metadata } from "next";
import Link from "next/link";
import { DemoEstimator } from "./DemoEstimator";

export const metadata: Metadata = {
  title: "Instant Estimate — OutFront Data",
  description:
    "See what your restaurant's numbers look like on the OutFront Data dashboard — a 60-second, no-login estimate.",
};

// Public Mode-2 demo: a prospect enters a few averages and watches a partial,
// personalized dashboard fill in. No auth, no database — the financial tiles
// compute client-side; only the optional Google reputation lookup hits the network.
export default function DemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 font-display text-4xl text-ink-text">What would your dashboard say?</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            A 60-second, no-login estimate from a few numbers you already know.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/demo/service" className="text-copper-soft hover:text-copper">
              Try the service estimate
            </Link>
            <Link href="/demo/real-estate" className="text-copper-soft hover:text-copper">
              Try the real estate brokerage estimate
            </Link>
            <Link href="/demo/retail" className="text-copper-soft hover:text-copper">
              Try the retail estimate
            </Link>
            <Link href="/demo/vacation-rental" className="text-copper-soft hover:text-copper">
              Try the vacation rental estimate
            </Link>
            <Link href="/demo/contractor" className="text-copper-soft hover:text-copper">
              Try the contractor estimate
            </Link>
          </div>
        </header>
        <DemoEstimator />
      </div>
    </main>
  );
}
