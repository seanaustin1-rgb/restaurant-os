import type { Metadata } from "next";
import { VacationRentalEstimator } from "./VacationRentalEstimator";

export const metadata: Metadata = {
  title: "Vacation Rental Estimate - OutFront Data",
  description:
    "See RevPAR, owner proceeds, maintenance drag, break-even occupancy, and what your management fee really costs — a no-login read from a few averages.",
};

export default function VacationRentalDemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 font-display text-4xl text-[#E6E8E4]">Vacation rental estimate</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            A no-login read from occupancy, nightly rate, and your cost stack — owner proceeds, RevPAR, and the
            occupancy you need to break even.
          </p>
        </header>
        <VacationRentalEstimator />
      </div>
    </main>
  );
}
