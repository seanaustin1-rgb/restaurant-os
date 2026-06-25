"use client";

import Link from "next/link";
import type { BusinessType } from "@prisma/client";
import { ChevronDown, Info, Lock } from "lucide-react";
import { useState } from "react";
import { industryTemplateFor } from "@/lib/industry-templates";
import { MODULES } from "@/lib/modules";

const TOUR_HREF: Record<BusinessType, string> = {
  RESTAURANT: "/demo/tour/restaurant",
  SERVICE: "/demo/tour/service",
  CONTRACTOR: "/demo/tour/contractor",
  REAL_ESTATE_BROKERAGE: "/demo/tour/real-estate",
  VACATION_RENTAL: "/demo/tour/vacation-rental",
  RETAIL: "/demo/tour/retail",
};

const RESULT_GUIDES: Partial<Record<BusinessType, { title: string; body: string }[]>> = {
  RESTAURANT: [
    {
      title: "Reputation (Aura)",
      body: "Shows the outside-world signal when a restaurant name can be matched: rating, review volume, and whether demand signals may help or hurt the financial read.",
    },
    {
      title: "You vs. industry",
      body: "Compares the entered food, beverage, labor, and margin numbers against practical restaurant ranges so the owner can see what is normal, tight, or dangerous.",
    },
    {
      title: "Prime cost",
      body: "Combines weekly food, beverage, and labor against weekly sales. This is the main restaurant pressure gauge because those costs usually decide whether profit is possible.",
    },
    {
      title: "Break-even number",
      body: "Estimates the weekly sales needed to cover labor, food/beverage, and fixed monthly bills converted to a weekly target. Profit starts after this line is covered.",
    },
    {
      title: "Profit First set-asides",
      body: "Shows a starting point for carving out profit, owner pay, and tax reserve before the business spends the rest.",
    },
    {
      title: "Cash flow (rough)",
      body: "Shows the quick in/out/left read from the numbers entered. Live bank and POS data sharpen this into daily runway and leak detection.",
    },
    {
      title: "Sales mix",
      body: "Uses the food and beverage inputs to show where sales are likely coming from and whether the mix is helping or squeezing margin.",
    },
    {
      title: "Covers",
      body: "Uses optional average check and open-day detail to estimate guest volume. If those fields are blank, the tile stays out because the demo does not want to fake precision.",
    },
  ],
  SERVICE: [
    {
      title: "Delivery pressure",
      body: "Shows how much revenue is being consumed by payroll, subcontractors, materials, and delivery costs before overhead is considered.",
    },
    {
      title: "Break-even number",
      body: "Estimates the weekly revenue needed to cover delivery costs plus fixed monthly bills. This is the line where the company stops funding operations out of cushion.",
    },
    {
      title: "Cash flow (rough)",
      body: "Shows the quick cash left after the major weekly outflows entered. A live account turns this into receivables, runway, and recurring-cost pressure.",
    },
    {
      title: "Profit First set-asides",
      body: "Shows what should be protected for profit, owner pay, and tax reserve before operating spend eats the whole deposit.",
    },
  ],
  RETAIL: [
    {
      title: "Gross margin",
      body: "Shows what is left after inventory cost, returns, and markdowns. POS and inventory feeds later turn this from a rough estimate into category-level margin feedback.",
    },
    {
      title: "Break-even number",
      body: "Estimates weekly sales needed to cover product cost, payroll, returns/markdowns, and fixed monthly bills before profit starts.",
    },
    {
      title: "Inventory position",
      body: "Uses current inventory value, sales, and purchases to estimate weeks on hand. This helps spot cash trapped on shelves or stock that is too thin.",
    },
    {
      title: "POS readiness",
      body: "Explains what the selected POS can usually provide: sales, tenders, refunds, taxes, item/category sales, and inventory detail where available.",
    },
    {
      title: "Profit First set-asides",
      body: "Shows the starting discipline for profit, owner pay, taxes, inventory, payroll, and operating cash.",
    },
  ],
  REAL_ESTATE_BROKERAGE: [
    {
      title: "Company Dollar",
      body: "Separates pass-through commission money from the brokerage's real operating revenue after agent splits, franchise fees, and referral fees.",
    },
    {
      title: "Split pressure",
      body: "Shows whether agent splits, caps, and fees are compressing the brokerage's retained margin. The higher the pressure, the less Company Dollar is left to run the firm.",
    },
    {
      title: "Break-even",
      body: "Estimates the Company Dollar needed to cover brokerage operating expenses before profit starts. It should not be based on full GCI.",
    },
    {
      title: "Cash Oxygen",
      body: "Shows how much operating runway exists from current cash and monthly operating expense. This is the safety buffer before forced money movement goes live.",
    },
    {
      title: "Pipeline Momentum",
      body: "Uses pending deals, close rate, expected share, and days to close to estimate whether future Company Dollar is strengthening or softening.",
    },
    {
      title: "Profit First",
      body: "Applies Profit First to Company Dollar, not GCI, so owner pay, tax reserve, and profit are calculated from money the brokerage actually keeps.",
    },
  ],
};

export function DemoModulePreview({ businessType }: { businessType: BusinessType }) {
  const [showGuide, setShowGuide] = useState(false);
  const template = industryTemplateFor(businessType);
  const resultGuides = RESULT_GUIDES[businessType] ?? [];
  const modules = template.defaultModuleKeys
    .map((key) => MODULES.find((module) => module.key === key))
    .filter((module): module is NonNullable<typeof module> => Boolean(module));

  return (
    <section className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Dashboard modules</div>
          <h3 className="mt-1 font-display text-xl text-ink-text">{template.label} module map</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            Your quick estimate lights up the first read. These are the modules the full dashboard uses as live sources are connected.
            Use the tour below to understand the tiles without losing the numbers you entered.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-xs font-medium text-copper-soft hover:bg-copper/20"
            aria-expanded={showGuide}
          >
            Tour these results
            <ChevronDown size={13} className={showGuide ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          <Link href={TOUR_HREF[businessType]} className="text-xs text-muted hover:text-copper-soft">
            Open sample dashboard
          </Link>
        </div>
      </div>

      {showGuide && resultGuides.length > 0 && (
        <div className="mt-4 rounded-lg border border-copper-dim/40 bg-copper/5 p-4">
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Tour of your result tiles</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            This keeps the estimate you entered on screen. The sample dashboard link is only for seeing a fictional company with deeper connected-data modules.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {resultGuides.map((guide) => (
              <div key={guide.title} className="rounded-md border border-line bg-ink/50 p-3">
                <div className="text-sm text-ink-text">{guide.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{guide.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const live = module.status === "live";
          return (
            <div key={module.key} className={"rounded-lg border px-3 py-3 " + (live ? "border-line bg-ink/50" : "border-line/70 bg-ink/30")}>
              <div className="flex items-start justify-between gap-2">
                <div className={live ? "text-sm text-ink-text" : "text-sm text-muted"}>{module.name}</div>
                <span className={"inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] " + (live ? "border-health-green/30 text-health-green" : "border-line text-muted")}>
                  {live ? <Info size={9} /> : <Lock size={9} />}
                  {live ? "live" : "needs data"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{module.description}</p>
              {!live && module.blockedBy && <p className="mt-2 text-[10px] text-muted/70">Unlocks with {module.blockedBy}.</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
