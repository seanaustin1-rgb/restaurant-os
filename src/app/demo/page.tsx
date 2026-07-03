import type { Metadata } from "next";
import Link from "next/link";
import { Building2, BriefcaseBusiness, Hammer, Home, Store, Utensils } from "lucide-react";

export const metadata: Metadata = {
  title: "Instant Estimate — OutFront Data",
  description:
    "See what your business numbers look like on the OutFront Data dashboard — a 60-second, no-login estimate.",
};

// Public Mode-2 demo entry: a prospect picks their industry, then enters a few
// averages and watches a partial, personalized dashboard fill in. No auth, no
// database — each estimator computes client-side; only the optional Google
// reputation lookup hits the network.
const ESTIMATORS = [
  {
    href: "/demo/restaurant",
    label: "Restaurant / hospitality",
    icon: Utensils,
    detail: "Prime cost, break-even, covers, and Profit First set-asides.",
  },
  {
    href: "/demo/service",
    label: "Service business",
    icon: BriefcaseBusiness,
    detail: "Delivery pressure, break-even, cash left, and set-asides.",
  },
  {
    href: "/demo/contractor",
    label: "Contractor / field service",
    icon: Hammer,
    detail: "Job margin, materials pressure, break-even, and runway.",
  },
  {
    href: "/demo/real-estate",
    label: "Real estate brokerage",
    icon: Building2,
    detail: "Company Dollar, break-even, pipeline, and lead ROI.",
  },
  {
    href: "/demo/vacation-rental",
    label: "Vacation rental",
    icon: Home,
    detail: "Occupancy, break-even nights, owner proceeds, and guest Aura.",
  },
  {
    href: "/demo/retail",
    label: "Retail",
    icon: Store,
    detail: "Gross margin, break-even, inventory, and POS readiness.",
  },
] as const;

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data</div>
          <h1 className="mt-2 text-balance font-display text-3xl leading-tight text-ink-text sm:text-4xl">What would your dashboard say?</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Pick your business and enter a few numbers you already know — a 60-second, no-login estimate.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ESTIMATORS.map((option) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.href}
                href={option.href}
                className="group min-w-0 rounded-lg border border-line bg-surface p-5 transition hover:border-copper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <div className="flex items-center gap-2 text-sm text-copper-soft">
                  <Icon size={16} aria-hidden /> {option.label}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{option.detail}</p>
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          Prefer a pre-loaded sample instead?{" "}
          <Link href="/demo/tour" className="text-copper-soft hover:text-copper">
            Tour a sample dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
