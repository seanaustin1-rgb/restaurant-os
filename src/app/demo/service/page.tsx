import type { Metadata } from "next";
import { ServiceEstimator } from "./ServiceEstimator";

export const metadata: Metadata = {
  title: "Service Business Estimate - OutFront Data",
  description:
    "See delivery pressure, break-even, cash left, and Profit First set-asides for a service business.",
};

export default function ServiceDemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 text-balance font-display text-3xl leading-tight text-ink-text sm:text-4xl">Service business estimate</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            A no-login read from weekly revenue, labor, materials, subcontractors, and fixed bills.
          </p>
        </header>
        <ServiceEstimator />
      </div>
    </main>
  );
}
