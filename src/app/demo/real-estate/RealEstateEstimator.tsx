"use client";

import type React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Database, Gauge, Info, PiggyBank, Search, Star, TrendingUp, Wallet } from "lucide-react";
import { money, pct } from "@/lib/format";
import { HealthSignal } from "@/components/health/HealthSignal";
import { lookupReputation, type ReputationResult } from "../actions";
import {
  computeAgentPerformanceList,
  type AgentPerformanceResult,
} from "@/lib/demo/real-estate-agent-performance";
import {
  computeMarketAura,
  type MarketAuraResult,
} from "@/lib/demo/market-aura";
import {
  computeRealEstateEstimate,
  type RealEstateEstimateInputs,
  type RealEstateEstimateResult,
  type RealEstateSoftware,
} from "@/lib/demo/real-estate-estimate";
import type { Health } from "@/lib/demo/estimate";
import { DemoModulePreview } from "../DemoModulePreview";

type FormState = Record<
  | "name"
  | "market"
  | "software"
  | "monthlyGci"
  | "agentSplitPct"
  | "franchiseFeePct"
  | "referralFeePct"
  | "monthlyOpex"
  | "currentCash"
  | "pendingDeals"
  | "avgSalePrice"
  | "avgCommissionPct"
  | "expectedCloseRatePct"
  | "avgBrokerageSharePct"
  | "daysToClose",
  string
>;

// Believable sample brokerage so the demo opens to a live, coherent story
// (a ~12-agent independent shop that is profitable but tightening: split
// pressure and Company Dollar both land "yellow"). Prospects overwrite these
// with their own numbers; the placeholders mirror the same values.
const INITIAL: FormState = {
  name: "Keystone Ridge Realty",
  market: "York, PA",
  software: "brokermint",
  monthlyGci: "120000",
  agentSplitPct: "70",
  franchiseFeePct: "6",
  referralFeePct: "4",
  monthlyOpex: "22000",
  currentCash: "80000",
  pendingDeals: "12",
  avgSalePrice: "350000",
  avgCommissionPct: "2.5",
  expectedCloseRatePct: "80",
  avgBrokerageSharePct: "24",
  daysToClose: "60",
};

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const word = (s: Health, g: string, y: string, r: string) => (s === "green" ? g : s === "yellow" ? y : r);

const EXPLAIN = {
  aura:
    "Your public rating, pulled live from Google. A brokerage's reputation drives agent recruiting and client trust - it compounds into deal flow.",
  companydollar:
    "Company Dollar is what the brokerage keeps from GCI after agent payouts, franchise fees, and referral fees. GCI is vanity; Company Dollar is what pays the bills.",
  split:
    "Split pressure = the share of GCI that leaves before the brokerage keeps a dollar (agent splits + franchise + referral fees). Retained Company Dollar around 25-30% is a practical target because it is the money left to operate the brokerage.",
  breakeven:
    "The Company Dollar you need each month just to cover brokerage OpEx. Below it the brokerage loses money; the cushion above funds profit and owner pay.",
  runway:
    "Cash oxygen = days of operating cash at your current burn. Commissions are lumpy, so runway is the buffer that keeps payroll and rent covered between closings.",
  pipeline:
    "Pipeline momentum = expected Company Dollar from pending deals, weighted by close probability - a rough 45-90 day forward read before closings land.",
  pf:
    "Starting set-asides taken from Company Dollar (not GCI) - Profit, Owner Pay, and Tax - so profit is reserved first, not whatever is left.",
} as const;

const inputCls =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-ink-text placeholder:text-muted/50 outline-none focus:border-copper-soft tnum";
const selectCls =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-ink-text outline-none focus:border-copper-soft";

const num = (s: string): number => {
  const v = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};

function buildInputs(f: FormState): RealEstateEstimateInputs {
  return {
    name: f.name.trim(),
    market: f.market.trim(),
    software: (f.software as RealEstateSoftware) || "followupboss",
    monthlyGci: num(f.monthlyGci),
    agentSplitPct: num(f.agentSplitPct) || 70,
    franchiseFeePct: num(f.franchiseFeePct),
    referralFeePct: num(f.referralFeePct),
    monthlyOpex: num(f.monthlyOpex),
    currentCash: num(f.currentCash),
    pendingDeals: num(f.pendingDeals),
    avgSalePrice: num(f.avgSalePrice),
    avgCommissionPct: num(f.avgCommissionPct) || 2.5,
    expectedCloseRatePct: num(f.expectedCloseRatePct) || 75,
    avgBrokerageSharePct: num(f.avgBrokerageSharePct) || 25,
    daysToClose: num(f.daysToClose) || 60,
  };
}

export function RealEstateEstimator() {
  const [f, setF] = useState<FormState>(INITIAL);
  const [view, setView] = useState<"form" | "results">("form");
  const [error, setError] = useState<string | null>(null);
  const [aura, setAura] = useState<ReputationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo(() => (view === "results" ? computeRealEstateEstimate(inputs) : null), [inputs, view]);

  // Prefill from a shared link a consultant sends, e.g.
  //   /demo/real-estate?name=...&monthlyGci=120000&agentSplitPct=70
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return;
    const keys: (keyof FormState)[] = [
      "name", "market", "software", "monthlyGci", "agentSplitPct", "franchiseFeePct", "referralFeePct",
      "monthlyOpex", "currentCash", "pendingDeals", "avgSalePrice", "avgCommissionPct", "expectedCloseRatePct",
      "avgBrokerageSharePct", "daysToClose",
    ];
    const next: Partial<FormState> = {};
    for (const k of keys) { const v = sp.get(k); if (v != null) next[k] = v; }
    if (!Object.keys(next).length) return;
    const seeded = { ...INITIAL, ...next } as FormState;
    setF(seeded);
    const inp = buildInputs(seeded);
    if (inp.monthlyGci > 0 && inp.monthlyOpex > 0) {
      setView("results");
      if (inp.name) startTransition(async () => setAura(await lookupReputation(inp.name, inp.market, "real_estate")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = buildInputs(f);
    if (next.monthlyGci <= 0) return setError("Add monthly closed GCI.");
    if (next.monthlyOpex <= 0) return setError("Add monthly brokerage operating expenses.");
    setError(null);
    setView("results");
    setAura(null);
    if (next.name) startTransition(async () => setAura(await lookupReputation(next.name, next.market, "real_estate")));
  }

  if (view === "results" && result) {
    return <Results f={f} r={result} aura={aura} auraPending={pending} onEdit={() => setView("form")} />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl">
      <p className="text-sm text-muted">
        Enter rough brokerage numbers. The estimate separates pass-through commission money from Company Dollar.
      </p>

      <fieldset className="mt-6 space-y-4">
        <Legend n="1" title="Brokerage identity" hint="Optional, only used to personalize the estimate" />
        <Field label="Brokerage / team name">
          <input className={inputCls} placeholder="Main Street Realty" value={f.name} onChange={upd("name")} />
        </Field>
        <Field label="Market">
          <input className={inputCls} placeholder="York, PA" value={f.market} onChange={upd("market")} />
        </Field>
        <Field label="CRM / back office" hint="Tells the demo what would light this up live">
          <select className={selectCls} value={f.software} onChange={upd("software")}>
            <option value="followupboss">Follow Up Boss</option>
            <option value="boldtrail">BoldTrail / kvCORE</option>
            <option value="sierra">Sierra Interactive</option>
            <option value="lofty">Lofty (Chime)</option>
            <option value="brokermint">Brokermint</option>
            <option value="quickbooks">QuickBooks</option>
            <option value="spreadsheet">Spreadsheet / none</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="Closed commission economics" hint="Company Dollar is the money the brokerage keeps" />
        <Field label="Monthly closed GCI" required prefix="$">
          <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="120,000" value={f.monthlyGci} onChange={upd("monthlyGci")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Avg agent split" suffix="%">
            <input className={inputCls + " pr-8"} inputMode="numeric" placeholder="70" value={f.agentSplitPct} onChange={upd("agentSplitPct")} />
          </Field>
          <Field label="Franchise fee" suffix="%">
            <input className={inputCls + " pr-8"} inputMode="numeric" placeholder="6" value={f.franchiseFeePct} onChange={upd("franchiseFeePct")} />
          </Field>
          <Field label="Referral fees" suffix="%">
            <input className={inputCls + " pr-8"} inputMode="numeric" placeholder="4" value={f.referralFeePct} onChange={upd("referralFeePct")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="3" title="Brokerage safety" hint="Used for break-even and runway" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monthly fixed OpEx" required prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="22,000" value={f.monthlyOpex} onChange={upd("monthlyOpex")} />
          </Field>
          <Field label="Current operating cash" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="80,000" value={f.currentCash} onChange={upd("currentCash")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="4" title="45-90 day pipeline" hint="A rough forward read before closings land" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pending deals">
            <input className={inputCls} inputMode="numeric" placeholder="12" value={f.pendingDeals} onChange={upd("pendingDeals")} />
          </Field>
          <Field label="Average sale price" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="350,000" value={f.avgSalePrice} onChange={upd("avgSalePrice")} />
          </Field>
          <Field label="Average commission" suffix="%">
            <input className={inputCls + " pr-8"} inputMode="numeric" placeholder="2.5" value={f.avgCommissionPct} onChange={upd("avgCommissionPct")} />
          </Field>
          <Field label="Expected close rate" suffix="%">
            <input className={inputCls + " pr-8"} inputMode="numeric" placeholder="80" value={f.expectedCloseRatePct} onChange={upd("expectedCloseRatePct")} />
          </Field>
          <Field label="Brokerage retained share" suffix="%">
            <input className={inputCls + " pr-8"} inputMode="numeric" placeholder="24" value={f.avgBrokerageSharePct} onChange={upd("avgBrokerageSharePct")} />
          </Field>
          <Field label="Avg days to close">
            <input className={inputCls} inputMode="numeric" placeholder="60" value={f.daysToClose} onChange={upd("daysToClose")} />
          </Field>
        </div>
      </fieldset>

      {error && <p className="mt-5 text-sm text-health-red">{error}</p>}

      <button
        type="submit"
        className="mt-7 w-full rounded-lg bg-copper px-5 py-3 font-medium text-ink transition hover:bg-copper-soft"
      >
        See brokerage heartbeat {"->"}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted">
        Nothing is saved. This is a quick estimate, not a full diagnosis.
      </p>
    </form>
  );
}

function Results({ f, r, aura, auraPending, onEdit }: { f: FormState; r: RealEstateEstimateResult; aura: ReputationResult | null; auraPending: boolean; onEdit: () => void }) {
  const agentRows = computeAgentPerformanceList([
    {
      name: "Top producer near cap",
      closedGci: r.monthlyGci * 0.42,
      agentSplitPct: 92,
      capRemaining: 2_500,
      pendingDeals: Math.max(1, Math.round(num(f.pendingDeals) * 0.25)),
      avgDealGci: num(f.avgSalePrice) * ((num(f.avgCommissionPct) || 2.5) / 100),
      expectedCloseRatePct: num(f.expectedCloseRatePct) || 75,
      leadSpend: 1_500,
    },
    {
      name: "Core agent",
      closedGci: r.monthlyGci * 0.34,
      agentSplitPct: num(f.agentSplitPct) || 70,
      capRemaining: 14_000,
      pendingDeals: Math.max(1, Math.round(num(f.pendingDeals) * 0.4)),
      avgDealGci: num(f.avgSalePrice) * ((num(f.avgCommissionPct) || 2.5) / 100),
      expectedCloseRatePct: num(f.expectedCloseRatePct) || 75,
      leadSpend: 900,
    },
    {
      name: "Growth agent",
      closedGci: r.monthlyGci * 0.18,
      agentSplitPct: 65,
      capRemaining: 20_000,
      pendingDeals: Math.max(0, Math.round(num(f.pendingDeals) * 0.2)),
      avgDealGci: num(f.avgSalePrice) * ((num(f.avgCommissionPct) || 2.5) / 100),
      expectedCloseRatePct: Math.max(50, (num(f.expectedCloseRatePct) || 75) - 10),
      leadSpend: 2_400,
    },
  ]);
  const marketAura = computeMarketAura({
    market: f.market || "Local market",
    newListings7d: Math.max(45, Math.round(num(f.pendingDeals) * 8)),
    pendings7d: Math.max(20, Math.round(num(f.pendingDeals) * (r.pipelineHealth === "green" ? 7 : r.pipelineHealth === "yellow" ? 5 : 3))),
    avgDom: r.pipelineHealth === "green" ? 31 : r.pipelineHealth === "yellow" ? 48 : 72,
    domTrendPct: r.pipelineHealth === "green" ? -3 : r.pipelineHealth === "yellow" ? 8 : 24,
    priceDrops7d: r.pipelineHealth === "green" ? 8 : r.pipelineHealth === "yellow" ? 18 : 34,
    showingAppointments7d: r.pipelineHealth === "green" ? 145 : r.pipelineHealth === "yellow" ? 82 : 36,
    showingTrendPct: r.pipelineHealth === "green" ? 10 : r.pipelineHealth === "yellow" ? -4 : -19,
    mortgageRatePct: r.pipelineHealth === "green" ? 6.35 : r.pipelineHealth === "yellow" ? 6.95 : 7.55,
    mortgageRateChangeBps7d: r.pipelineHealth === "green" ? -4 : r.pipelineHealth === "yellow" ? 18 : 38,
    googleIntentTrendPct: r.pipelineHealth === "green" ? 14 : r.pipelineHealth === "yellow" ? 2 : -16,
  });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Brokerage heartbeat estimate</div>
          <h2 className="font-display text-3xl text-ink-text">{f.name || "Your brokerage"}</h2>
          {f.market && <div className="text-sm text-muted">{f.market}</div>}
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink-text">
          <ArrowLeft size={14} /> Adjust numbers
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3 text-[13px] leading-relaxed text-ink-text-soft">
        GCI is not the operating base. This estimate treats agent payouts, franchise fees, and referral fees as pass-through pressure,
        then runs Profit First and break-even from Company Dollar.
      </div>

      <SetupLeversPanel />

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReputationTile aura={aura} pending={auraPending} name={f.name} />
        <CompanyDollarTile r={r} />
        <SplitPressureTile r={r} />
        <BreakEvenTile r={r} />
        <RunwayTile r={r} />
        <PipelineTile r={r} />
        <ProfitFirstTile r={r} />
      </div>

      <AgentPerformancePreview rows={agentRows} />
      <LeadRoiPreview rows={agentRows} />
      <MarketAuraPreview market={marketAura} />
      <BrokerageSourceReadiness softwareLabel={r.softwareLabel} />

      <div className="mt-6 rounded-lg border border-line bg-surface px-4 py-3 text-[11px] leading-relaxed text-muted">
        Source pipe: <span className="text-ink-text">{r.softwareLabel}</span>. {r.softwareNote}
      </div>

      <DemoModulePreview businessType="REAL_ESTATE_BROKERAGE" />

      <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
        <div className="font-display text-xl text-ink-text">Paid add-on lanes</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AddOn title="Agent Performance" text="Company Dollar yield, cap pressure, pipeline, close velocity, and coaching flags." />
          <AddOn title="Market Intelligence" text="MLS velocity, DOM, price drops, rates, showing demand, and local market Aura." />
          <AddOn title="Brokerage Source Review" text="Consultant/accountant controls for splits, caps, referral fees, fixed OpEx, and pipeline assumptions." />
        </div>
        <Link href="/demo/tour" className="mt-4 inline-block text-sm text-copper-soft hover:text-copper">
          Back to business type chooser
        </Link>
      </div>
    </div>
  );
}

function Tile({ title, icon, explainer, children }: { title: string; icon: React.ReactNode; explainer?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          {icon} {title}
        </div>
        {explainer && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`What ${title} means`} className="rounded-full text-muted hover:text-copper-soft focus-visible:text-copper-soft focus-visible:outline-none">
            <Info size={13} />
          </button>
        )}
      </div>
      <div className="mt-3">{children}</div>
      {open && explainer && (
        <div className="mt-3 rounded-md border border-line bg-ink/60 px-3 py-2 text-[11px] leading-relaxed text-ink-text-soft">{explainer}</div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: Health }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={"tnum text-xl " + (tone ? HEALTH_TEXT[tone] : "text-ink-text")}>{value}</div>
    </div>
  );
}

function SetupLeversPanel() {
  const editable = [
    "Agent split by agent",
    "Annual cap and cap paid-to-date",
    "Franchise and referral fees",
    "Monthly OpEx and current cash",
    "Pending deals and close rate",
    "Average deal size and commission rate",
  ];
  const outcomes = [
    "Company Dollar",
    "Split pressure",
    "Break-even",
    "Cash oxygen",
    "Pipeline momentum",
    "Profit First set-asides",
  ];

  return (
    <div className="mt-5 rounded-xl border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">What you can manipulate</div>
          <h3 className="mt-1 font-display text-xl text-ink-text">Setup levers change the dashboard outcomes.</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            During setup, a brokerage should be able to edit the agent economics and operating assumptions below. The dashboard then turns those choices into the color-coded outcomes.
          </p>
        </div>
        <Link href="#agent-performance-levers" className="text-xs text-copper-soft hover:text-copper">
          See agent-level levers
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <LeverList title="Editable inputs" items={editable} />
        <LeverList title="Calculated outcomes" items={outcomes} />
      </div>
    </div>
  );
}

function LeverList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-line bg-ink/50 p-3">
      <div className="text-sm text-ink-text">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-line px-2 py-1 text-[11px] text-muted">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function WhatMovesThis({ items }: { items: string[] }) {
  return (
    <div className="mt-3 rounded-lg border border-copper-dim/30 bg-copper-dim/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-copper-soft">What moves this?</div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{items.join(", ")}.</p>
    </div>
  );
}

function ReputationTile({ aura, pending, name }: { aura: ReputationResult | null; pending: boolean; name: string }) {
  return (
    <Tile title="Reputation" icon={<Star size={12} className="text-copper-soft" />} explainer={EXPLAIN.aura}>
      {pending && <div className="text-sm text-muted">Looking up {name || "your brokerage"} on Google...</div>}
      {!pending && aura?.found && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-4xl text-ink-text">{aura.rating?.toFixed(1)}</span>
            <Stars rating={aura.rating ?? 0} />
          </div>
          <div className="mt-1 text-sm text-muted">{aura.reviewCount.toLocaleString()} Google reviews</div>
          {aura.matchedName && <div className="mt-2 text-[11px] text-muted/80">Matched: {aura.matchedName}{aura.matchedAddress ? ` - ${aura.matchedAddress}` : ""}</div>}
        </div>
      )}
      {!pending && aura && !aura.found && <div className="text-sm text-muted">We couldn&apos;t auto-match a Google listing. Market Aura below reads demand and intent; the full account adds review sources.</div>}
      {!pending && !aura && <div className="text-sm text-muted">Add a brokerage name above to try a live Google rating match. Market Aura below reads demand even without it.</div>}
    </Tile>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={16} className={i <= Math.round(rating) ? "text-copper-soft" : "text-line"} fill={i <= Math.round(rating) ? "#D9A35E" : "none"} />
      ))}
    </span>
  );
}

function CompanyDollarTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Company Dollar" icon={<Building2 size={12} className="text-copper-soft" />} explainer={EXPLAIN.companydollar}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.companyDollarHealth]}>{money(r.companyDollar)}</span>
        <span className="text-sm text-muted">/ month retained</span>
      </div>
      <HealthSignal status={r.companyDollarHealth} label={word(r.companyDollarHealth, "Healthy", "Thin", "Low")} detail={`${pct(r.companyDollarPct)} of GCI retained - target ~25-30%`} className="mt-2" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Closed GCI" value={money(r.monthlyGci)} />
        <Stat label="Retained share" value={pct(r.companyDollarPct)} tone={r.companyDollarHealth} />
      </div>
      <p className="mt-3 text-[11px] text-muted">Company Dollar is GCI after agent payouts, franchise fees, and referral fees.</p>
      <WhatMovesThis items={["monthly closed GCI", "agent split percentages", "franchise fee", "referral fee"]} />
    </Tile>
  );
}

function SplitPressureTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Split Pressure" icon={<Gauge size={12} className="text-copper-soft" />} explainer={EXPLAIN.split}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.splitPressureHealth]}>{pct(r.splitPressurePct)}</span>
        <span className="text-sm text-muted">of GCI passes through</span>
      </div>
      <HealthSignal status={r.splitPressureHealth} label={word(r.splitPressureHealth, "Lean", "Watch", "Heavy")} detail={`${pct(100 - r.splitPressurePct, 0)} kept as Company Dollar`} className="mt-2" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Agents" value={money(r.agentPayouts)} />
        <Stat label="Franchise" value={money(r.franchiseFees)} />
        <Stat label="Referral" value={money(r.referralFees)} />
      </div>
      <p className="mt-3 text-[11px] text-muted">Split pressure shows how much closed GCI passes through before the brokerage keeps Company Dollar.</p>
      <WhatMovesThis items={["agent splits", "agent cap remaining", "franchise fees", "referral fees", "which agents are closing the deals"]} />
    </Tile>
  );
}

function BreakEvenTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Break-even" icon={<Wallet size={12} className="text-copper-soft" />} explainer={EXPLAIN.breakeven}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-3xl text-ink-text">{money(r.breakEvenCompanyDollar)}</span>
        <span className="text-sm text-muted">Company Dollar needed</span>
      </div>
      <HealthSignal status={r.breakEvenHealth} label={word(r.breakEvenHealth, "Clear cushion", "Thin cushion", "At risk")} detail={r.breakEvenCushion >= 0 ? `${money(r.breakEvenCushion)} over OpEx` : `${money(Math.abs(r.breakEvenCushion))} short of OpEx`} className="mt-2" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="GCI needed" value={r.gciNeededToBreakEven != null ? money(r.gciNeededToBreakEven) : "-"} />
        <Stat
          label={r.breakEvenCushion >= 0 ? "Cushion" : "Shortfall"}
          value={money(Math.abs(r.breakEvenCushion))}
          tone={r.breakEvenCushion >= 0 ? "green" : "red"}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted">Profit starts after Company Dollar covers brokerage OpEx.</p>
      <WhatMovesThis items={["monthly OpEx", "retained Company Dollar", "agent split pressure", "franchise/referral fees"]} />
    </Tile>
  );
}

function RunwayTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Cash Oxygen" icon={<Wallet size={12} className="text-copper-soft" />} explainer={EXPLAIN.runway}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.cashRunwayHealth]}>
          {r.cashRunwayDays != null ? Math.round(r.cashRunwayDays).toLocaleString() : "-"}
        </span>
        <span className="text-sm text-muted">days runway</span>
      </div>
      {r.cashRunwayDays != null && (
        <HealthSignal status={r.cashRunwayHealth} label={word(r.cashRunwayHealth, "Comfortable", "Watch", "Tight")} detail="60+ days is a healthy buffer" className="mt-2" />
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Operating cash" value={money(r.currentCash)} />
        <Stat label="Monthly OpEx" value={money(r.monthlyOpex)} />
      </div>
      <WhatMovesThis items={["current operating cash", "monthly fixed OpEx", "expected closings", "timing of cash receipts"]} />
    </Tile>
  );
}

function PipelineTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Pipeline Momentum" icon={<TrendingUp size={12} className="text-copper-soft" />} explainer={EXPLAIN.pipeline}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.pipelineHealth]}>{money(r.expectedPipelineCompanyDollar)}</span>
        <span className="text-sm text-muted">weighted Company Dollar</span>
      </div>
      <HealthSignal status={r.pipelineHealth} label={word(r.pipelineHealth, "Ahead", "Building", "Thin")} detail={`${r.pipelineMonths.toFixed(1)} mo of forward coverage`} className="mt-2" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Weighted GCI" value={money(r.weightedPipelineGci)} />
        <Stat label="Pipeline span" value={`${r.pipelineMonths.toFixed(1)} mo`} />
      </div>
      <p className="mt-3 text-[11px] text-muted">This is the rough 45-90 day forward read before closings land.</p>
      <WhatMovesThis items={["pending deals", "average sale price", "commission rate", "expected close rate", "brokerage retained share", "days to close"]} />
    </Tile>
  );
}

function ProfitFirstTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Profit First" icon={<PiggyBank size={12} className="text-copper-soft" />} explainer={EXPLAIN.pf}>
      <p className="text-[11px] text-muted">Starting set-asides calculated from Company Dollar, not GCI:</p>
      <div className="mt-3 space-y-2">
        {r.pf.map((line) => (
          <div key={line.key} className="flex items-center justify-between rounded-lg border border-line bg-ink/50 px-3 py-2">
            <span className="text-sm text-ink-text">
              {line.label} <span className="text-muted">({line.pct}%)</span>
            </span>
            <span className="tnum text-base text-copper-soft">{money(line.amount)}</span>
          </div>
        ))}
      </div>
      <WhatMovesThis items={["Company Dollar", "Profit First target percentages", "owner pay target", "tax reserve target", "go-live stage"]} />
    </Tile>
  );
}

function AgentPerformancePreview({ rows }: { rows: AgentPerformanceResult[] }) {
  return (
    <div id="agent-performance-levers" className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Paid add-on preview</div>
          <h3 className="font-display text-xl text-ink-text">Agent Performance</h3>
        </div>
        <div className="text-[11px] text-muted">Sample rows generated from the brokerage estimate</div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3">
        {rows.map((row) => (
          <AgentRow key={row.name} row={row} />
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        In a live setup, these rows should be editable per agent: split %, annual cap, cap paid-to-date, pending deals, expected close rate, lead spend, and source. Cap remaining is the warning light for how much Company Dollar the brokerage can still collect before that agent's future deals retain less.
      </p>
    </div>
  );
}

function AgentRow({ row }: { row: AgentPerformanceResult }) {
  return (
    <div className="rounded-lg border border-line bg-ink/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-ink-text">{row.name}</div>
          <div className={"mt-0.5 text-[11px] " + HEALTH_TEXT[row.overallHealth]}>{row.note}</div>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(row.overallHealth)}>
          {row.overallHealth === "green" ? "healthy" : row.overallHealth === "yellow" ? "watch" : "pressure"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Stat label="Company Dollar" value={money(row.companyDollar)} tone={row.companyDollarYieldPct >= 25 ? "green" : row.companyDollarYieldPct >= 18 ? "yellow" : "red"} />
        <Stat label="Retained yield" value={pct(row.companyDollarYieldPct)} />
        <Stat label="Cap remaining" value={money(row.capRemaining)} tone={row.capPressureHealth} />
        <Stat label="Weighted pipeline" value={money(row.expectedPipelineCompanyDollar)} />
        <Stat label="Lead ROI" value={row.leadRoi != null ? `${row.leadRoi.toFixed(1)}x` : "-"} />
      </div>
    </div>
  );
}

function LeadRoiPreview({ rows }: { rows: AgentPerformanceResult[] }) {
  const leadRows = rows.filter((row) => row.leadSpend > 0);
  const totalLeadSpend = leadRows.reduce((sum, row) => sum + row.leadSpend, 0);
  const totalExpectedCompanyDollar = leadRows.reduce((sum, row) => sum + row.expectedPipelineCompanyDollar, 0);
  const roi = totalLeadSpend > 0 ? totalExpectedCompanyDollar / totalLeadSpend : null;
  const health: Health = roi == null || roi >= 3 ? "green" : roi >= 1.5 ? "yellow" : "red";

  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Paid add-on preview</div>
          <h3 className="font-display text-xl text-ink-text">Lead ROI</h3>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(health)}>
          {health === "green" ? "efficient spend" : health === "yellow" ? "watch spend" : "lead drag"}
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Lead spend" value={money(totalLeadSpend)} />
          <Stat label="Weighted Company Dollar" value={money(totalExpectedCompanyDollar)} tone={health} />
          <Stat label="Expected ROI" value={roi != null ? `${roi.toFixed(1)}x` : "-"} tone={health} />
        </div>
        <div className="mt-4 space-y-2">
          {leadRows.map((row) => (
            <div key={row.name} className="grid grid-cols-1 gap-2 rounded-lg border border-line bg-surface/80 p-3 sm:grid-cols-4">
              <div>
                <div className="text-sm text-ink-text">{row.name}</div>
                <div className="text-[11px] text-muted">lead source rollup</div>
              </div>
              <Stat label="Spend" value={money(row.leadSpend)} />
              <Stat label="Expected CD" value={money(row.expectedPipelineCompanyDollar)} />
              <Stat label="ROI" value={row.leadRoi != null ? `${row.leadRoi.toFixed(1)}x` : "-"} tone={row.leadRoi == null || row.leadRoi >= 3 ? "green" : row.leadRoi >= 1.5 ? "yellow" : "red"} />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Live version connects CRM lead source, ad spend, closed deals, and retained Company Dollar. A consultant can adjust attribution and close probability without owning API authorization.
      </p>
    </div>
  );
}

function MarketAuraPreview({ market }: { market: MarketAuraResult }) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Paid add-on preview</div>
          <h3 className="font-display text-xl text-ink-text">Market Intelligence</h3>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(market.marketAuraHealth)}>
          {market.marketAuraHealth === "green" ? "market tailwind" : market.marketAuraHealth === "yellow" ? "mixed market" : "market pressure"}
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-ink-text">
              <Search size={14} className="text-copper-soft" /> {market.market}
            </div>
            <div className={"mt-0.5 text-[11px] " + HEALTH_TEXT[market.marketAuraHealth]}>{market.note}</div>
          </div>
          <div className="tnum text-3xl text-ink-text">{Math.round(market.marketAuraScore)}</div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ScoreStat label="Contract velocity" value={market.contractVelocityScore} />
          <ScoreStat label="DOM pressure" value={market.domPressureScore} />
          <ScoreStat label="Price drop pressure" value={market.priceDropPressureScore} />
          <ScoreStat label="Showing demand" value={market.showingDemandScore} />
          <ScoreStat label="Rate pressure" value={market.ratePressureScore} />
          <ScoreStat label="Digital intent" value={market.digitalIntentScore} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Live version connects MLS/RESO, mortgage-rate data, ShowingTime, and Google Business Profile intent.
        </p>
      </div>
    </div>
  );
}

function BrokerageSourceReadiness({ softwareLabel }: { softwareLabel: string }) {
  const layers = [
    {
      label: "Accounting backbone",
      source: "QuickBooks / Xero",
      coverage: 70,
      note: "Fixed OpEx, bank reconciliation, owner pay, tax reserve, and Company Dollar checks.",
      health: "green" as Health,
    },
    {
      label: "Back-office commissions",
      source: "Brokermint / SkySlope / Dotloop",
      coverage: 62,
      note: "Splits, caps, referral fees, franchise fees, agent ledgers, and closed Company Dollar.",
      health: "yellow" as Health,
    },
    {
      label: "CRM pipeline",
      source: softwareLabel,
      coverage: 58,
      note: "Pending deals, expected close date, source attribution, and probability-weighted Company Dollar.",
      health: "yellow" as Health,
    },
    {
      label: "Market Aura",
      source: "MLS / RESO + Google intent",
      coverage: 45,
      note: "Listings, pendings, DOM, price reductions, showing demand, rates, and search activity.",
      health: "yellow" as Health,
    },
  ];

  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Source readiness</div>
          <h3 className="font-display text-xl text-ink-text">What Makes This Live</h3>
        </div>
        <span className="rounded-full border border-health-yellow/30 bg-health-yellow/10 px-2 py-0.5 text-[11px] text-health-yellow">
          staged connection path
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-ink-text">
              <Database size={14} className="text-copper-soft" /> Brokerage data foundation
            </div>
            <div className="mt-0.5 text-[11px] text-muted">Start with accounting and commission/back-office data; add CRM and market feeds when the core money model is trusted.</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {layers.map((layer) => (
            <div key={layer.label} className="rounded-lg border border-line bg-surface/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-ink-text">{layer.label}</div>
                <span className={"tnum text-sm " + HEALTH_TEXT[layer.health]}>{layer.coverage}%</span>
              </div>
              <div className="mt-1 text-[11px] text-copper-soft">{layer.source}</div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{layer.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Owner/operator authorizes sensitive sources. Consultants and accountants can review mappings, edit assumptions,
          and adjust split/cap details once access is granted.
        </p>
      </div>
    </div>
  );
}

function ScoreStat({ label, value }: { label: string; value: number }) {
  const health: Health = value >= 70 ? "green" : value >= 50 ? "yellow" : "red";
  return <Stat label={label} value={Math.round(value).toLocaleString()} tone={health} />;
}

function badgeCls(health: Health): string {
  if (health === "green") return "border-health-green/30 bg-health-green/10 text-health-green";
  if (health === "yellow") return "border-health-yellow/30 bg-health-yellow/10 text-health-yellow";
  return "border-health-red/30 bg-health-red/10 text-health-red";
}

function AddOn({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink/50 p-3">
      <div className="text-sm text-ink-text">{title}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Legend({ n, title, hint }: { n: string; title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-copper-dim/40 text-[11px] text-copper-soft">{n}</span>
      <span className="text-sm font-medium text-ink-text">{title}</span>
      <span className="text-[11px] text-muted">- {hint}</span>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">
        {label}
        {required && <span className="text-copper-soft"> *</span>}
        {hint && <span className="block text-[10px] text-muted/80">{hint}</span>}
      </span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>}
        {children}
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
