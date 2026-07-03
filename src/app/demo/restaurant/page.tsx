import type { Metadata } from "next";
import { DemoEstimator } from "../DemoEstimator";

export const metadata: Metadata = {
  title: "Restaurant Estimate — OutFront Data",
  description:
    "See prime cost, break-even, covers, and Profit First set-asides for a restaurant — a 60-second, no-login estimate.",
};

export default function RestaurantDemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 text-balance font-display text-3xl leading-tight text-ink-text sm:text-4xl">Restaurant estimate</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            A no-login read from seats, covers, average check, food &amp; beverage, labor, and fixed bills.
          </p>
        </header>
        <DemoEstimator />
      </div>
    </main>
  );
}
