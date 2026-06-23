"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Landmark, PiggyBank, ShieldCheck, ToggleRight, WalletCards } from "lucide-react";

const steps = [
  {
    title: "Sales land first",
    body: "The system starts with actual sales and cash movement, then separates money before it is accidentally spent.",
    icon: WalletCards,
  },
  {
    title: "Set-asides are calculated",
    body: "Profit, owner pay, tax reserve, direct costs, and operating expense targets are calculated from the dashboard numbers.",
    icon: PiggyBank,
  },
  {
    title: "The coach stays virtual",
    body: "Go-Live Coach rehearses the money movement first and flags when cash, categories, or targets are not ready.",
    icon: ShieldCheck,
  },
  {
    title: "Transfers can be enabled later",
    body: "When the owner chooses to go live, deposits can be pushed into separate bank accounts that match the plan.",
    icon: Landmark,
  },
];

export function ProfitFirstExplainer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-copper-dim/40 bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-wider text-copper-soft">Profit First operating system</p>
          <h2 className="mt-1 font-display text-lg text-[#E6E8E4]">
            Owner pay and profit get protected before the business spends the rest.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Profit First is the money discipline behind the dashboard. OutFront can run it virtually first, show what
            should be set aside, and only move real deposits into separate accounts when the business is ready and the
            owner turns that on.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-medium text-[#E6E8E4] hover:border-copper-dim"
            aria-expanded={open}
          >
            <ToggleRight size={15} className="text-copper-soft" />
            {open ? "Hide how it works" : "Show how it works"}
            <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          <Link
            href="/profit-first"
            className="inline-flex items-center rounded-md bg-copper px-3 py-2 text-xs font-medium text-ink hover:bg-copper-soft"
          >
            Know more
          </Link>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-md border border-line bg-[#0B0F0D] p-3">
                <div className="flex items-center gap-2 text-sm text-[#E6E8E4]">
                  <Icon size={15} className="text-copper-soft" />
                  <span>{step.title}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            );
          })}
          <div className="rounded-md border border-health-green/30 bg-health-green/5 p-3 md:col-span-4">
            <p className="text-xs leading-relaxed text-muted">
              Demo mode is guidance only. In a live account, transfers stay off until the owner chooses a pilot or
              go-live stage. The benefit is simple: taxes are not borrowed from, the owner gets paid, profit becomes a
              habit, and the business learns to operate on what is truly available.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
