import type { Metadata } from "next";
import { ContractorEstimator } from "./ContractorEstimator";

export const metadata: Metadata = {
  title: "Contractor Estimate - OutFront Data",
  description:
    "See job margin, weeks of backlog, your cash gap, overhead break-even, and the single biggest lever — a no-login read from a few averages.",
};

export default function ContractorDemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 text-balance font-display text-3xl leading-tight text-ink-text sm:text-4xl">Contractor estimate</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            A no-login read from revenue, job costs, backlog, and receivables — job margin, weeks of work booked,
            and where your cash is stuck.
          </p>
        </header>
        <ContractorEstimator />
      </div>
    </main>
  );
}
