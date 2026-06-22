import type { Metadata } from "next";
import { RealEstateEstimator } from "./RealEstateEstimator";

export const metadata: Metadata = {
  title: "Brokerage Heartbeat Estimate - OutFront Data",
  description:
    "See Company Dollar, split pressure, break-even, runway, and pipeline momentum for a real estate brokerage.",
};

export default function RealEstateDemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 font-display text-4xl text-[#E6E8E4]">Brokerage heartbeat estimate</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            A no-login read on Company Dollar, split pressure, break-even, runway, and 45-90 day pipeline.
          </p>
        </header>
        <RealEstateEstimator />
      </div>
    </main>
  );
}
