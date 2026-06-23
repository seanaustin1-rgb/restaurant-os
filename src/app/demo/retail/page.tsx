import type { Metadata } from "next";
import { RetailEstimator } from "./RetailEstimator";

export const metadata: Metadata = {
  title: "Retail Estimate - OutFront Data",
  description:
    "See retail margin pressure, break-even, inventory position, POS readiness, and Profit First set-asides.",
};

export default function RetailDemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 font-display text-4xl text-[#E6E8E4]">Retail estimate</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            A no-login read from sales, inventory purchases, payroll, returns, fixed bills, and your POS.
          </p>
        </header>
        <RetailEstimator />
      </div>
    </main>
  );
}
