import type { Metadata } from "next";
import Link from "next/link";
import { Building2, BriefcaseBusiness, Hammer, Home, Store, Utensils } from "lucide-react";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";

export const metadata: Metadata = {
  title: "Choose a demo tour - OutFront Data",
  description: "Pick an industry and tour a realistic OutFront Data dashboard with no login required.",
};

const TOUR_OPTIONS = [
  {
    type: "restaurant",
    template: INDUSTRY_TEMPLATES.RESTAURANT,
    company: "Demo Bistro",
    icon: Utensils,
    detail: "Prime cost, sales momentum, covers, cash flow, and Aura.",
  },
  {
    type: "service",
    template: INDUSTRY_TEMPLATES.SERVICE,
    company: "Keystone Service Co.",
    icon: BriefcaseBusiness,
    detail: "Payroll load, delivery pressure, recurring cost, cash safety, and client momentum.",
  },
  {
    type: "contractor",
    template: INDUSTRY_TEMPLATES.CONTRACTOR,
    company: "Iron Ridge Field Services",
    icon: Hammer,
    detail: "Job margin, materials pressure, schedule momentum, receivables, and runway.",
  },
  {
    type: "real-estate",
    template: INDUSTRY_TEMPLATES.REAL_ESTATE_BROKERAGE,
    company: "Harbor & Main Realty",
    icon: Building2,
    detail: "Company Dollar, split pressure, pipeline, agent performance, and market energy.",
  },
  {
    type: "vacation-rental",
    template: INDUSTRY_TEMPLATES.VACATION_RENTAL,
    company: "Shoreline Stay Group",
    icon: Home,
    detail: "Occupancy, owner proceeds, maintenance drag, booking pace, and guest Aura.",
  },
  {
    type: "retail",
    template: INDUSTRY_TEMPLATES.RETAIL,
    company: "Copper Lane Goods",
    icon: Store,
    detail: "Gross margin, inventory pressure, traffic momentum, returns, and reviews.",
  },
] as const;

export default function DemoTourSelectorPage() {
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-copper-soft">OutFront Data tour</div>
          <h1 className="mt-2 text-balance font-display text-3xl leading-tight text-ink-text sm:text-4xl">What kind of business do you want to see?</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Pick a template and we will open a fictional company with realistic sample numbers already loaded.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TOUR_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.type}
                href={`/demo/tour/${option.type}`}
                className="group min-w-0 rounded-lg border border-line bg-surface p-5 transition hover:border-copper-dim"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2 text-sm text-copper-soft">
                      <Icon size={16} /> {option.template.label}
                    </div>
                    <h2 className="mt-2 break-words font-display text-2xl text-ink-text">{option.company}</h2>
                  </div>
                  <span className="shrink-0 rounded-md border border-copper-dim bg-copper/10 px-2 py-1 text-xs text-copper-soft group-hover:bg-copper/20">
                    Tour
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{option.detail}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 text-center text-sm">
          <p className="text-muted">Prefer to enter your own rough numbers?</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/demo" className="text-copper-soft hover:text-copper">
              Restaurant estimate
            </Link>
            <Link href="/demo/service" className="text-copper-soft hover:text-copper">
              Service estimate
            </Link>
            <Link href="/demo/real-estate" className="text-copper-soft hover:text-copper">
              Brokerage estimate
            </Link>
            <Link href="/demo/retail" className="text-copper-soft hover:text-copper">
              Retail estimate
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
