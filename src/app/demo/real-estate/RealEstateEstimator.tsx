"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Database, Gauge, Home, PiggyBank, Search, Star, TrendingUp, Wallet } from "lucide-react";
import { money, pct } from "@/lib/format";
import {
  computeAgentPerformanceList,
  type AgentPerformanceResult,
} from "@/lib/demo/real-estate-agent-performance";
import {
  computeMarketAura,
  type MarketAuraResult,
} from "@/lib/demo/market-aura";
import {
  buildPropertyActionQueue,
  type PropertyActionItem,
} from "@/lib/demo/property-action-queue";
import {
  computePropertyHeartbeat,
  type PropertyHeartbeatResult,
} from "@/lib/demo/property-heartbeat";
import {
  computePropertyPortfolio,
  type PropertyPortfolioResult,
} from "@/lib/demo/property-portfolio";
import {
  computeRealEstateEstimate,
  type RealEstateEstimateInputs,
  type RealEstateEstimateResult,
} from "@/lib/demo/real-estate-estimate";
import {
  computeVacationRentalImportReadiness,
  type VacationRentalImportReadinessResult,
} from "@/lib/demo/vacation-rental-import-readiness";
import type { Health } from "@/lib/demo/estimate";

type FormState = Record<
  | "name"
  | "market"
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

const INITIAL: FormState = {
  name: "",
  market: "",
  monthlyGci: "",
  agentSplitPct: "",
  franchiseFeePct: "",
  referralFeePct: "",
  monthlyOpex: "",
  currentCash: "",
  pendingDeals: "",
  avgSalePrice: "",
  avgCommissionPct: "",
  expectedCloseRatePct: "",
  avgBrokerageSharePct: "",
  daysToClose: "",
};

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const inputCls =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-[#E6E8E4] placeholder:text-muted/50 outline-none focus:border-copper-soft tnum";

const num = (s: string): number => {
  const v = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};

function buildInputs(f: FormState): RealEstateEstimateInputs {
  return {
    name: f.name.trim(),
    market: f.market.trim(),
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

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo(() => (view === "results" ? computeRealEstateEstimate(inputs) : null), [inputs, view]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = buildInputs(f);
    if (next.monthlyGci <= 0) return setError("Add monthly closed GCI.");
    if (next.monthlyOpex <= 0) return setError("Add monthly brokerage operating expenses.");
    setError(null);
    setView("results");
  }

  if (view === "results" && result) {
    return <Results f={f} r={result} onEdit={() => setView("form")} />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl">
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
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="Closed commission economics" hint="Company Dollar is the money the brokerage keeps" />
        <Field label="Monthly closed GCI" required prefix="$">
          <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="120,000" value={f.monthlyGci} onChange={upd("monthlyGci")} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
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

function Results({ f, r, onEdit }: { f: FormState; r: RealEstateEstimateResult; onEdit: () => void }) {
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
  const property = computePropertyHeartbeat({
    name: "Managed owner property",
    monthlyBookingRevenue: Math.max(7_500, r.expectedPipelineCompanyDollar * 0.55),
    occupancyPct: 68,
    averageDailyRate: Math.max(175, num(f.avgSalePrice) / 1_250),
    cleaningCosts: 1_900,
    maintenanceCosts: r.breakEvenCushion < 0 ? 2_800 : 1_300,
    platformFees: Math.max(500, r.expectedPipelineCompanyDollar * 0.025),
    managementFeePct: 18,
    ownerReserveTarget: Math.max(4_500, r.monthlyOpex * 0.2),
    openIssues: r.breakEvenCushion < 0 ? 4 : 1,
    repeatIssues: r.breakEvenCushion < 0 ? 1 : 0,
    avgResponseHours: r.breakEvenCushion < 0 ? 18 : 4,
    reviewRating: r.breakEvenCushion < 0 ? 4.1 : 4.8,
    futureBookedNights: Math.max(8, Math.round(num(f.pendingDeals) * 1.5)),
    next30AvailableNights: 28,
  });
  const propertyPortfolio = computePropertyPortfolio([
    {
      name: "Lake House",
      monthlyBookingRevenue: Math.max(15_000, r.expectedPipelineCompanyDollar * 0.45),
      occupancyPct: 72,
      averageDailyRate: 325,
      cleaningCosts: 2_100,
      maintenanceCosts: 1_400,
      platformFees: 900,
      managementFeePct: 18,
      ownerReserveTarget: 8_000,
      openIssues: 1,
      repeatIssues: 0,
      avgResponseHours: 3,
      reviewRating: 4.8,
      futureBookedNights: 18,
      next30AvailableNights: 28,
    },
    {
      name: "Beach Cottage",
      monthlyBookingRevenue: Math.max(18_000, r.expectedPipelineCompanyDollar * 0.5),
      occupancyPct: 78,
      averageDailyRate: 410,
      cleaningCosts: 2_400,
      maintenanceCosts: 1_100,
      platformFees: 1_100,
      managementFeePct: 18,
      ownerReserveTarget: 9_500,
      openIssues: 0,
      repeatIssues: 0,
      avgResponseHours: 2,
      reviewRating: 4.9,
      futureBookedNights: 21,
      next30AvailableNights: 27,
    },
    {
      name: "Downtown Condo",
      monthlyBookingRevenue: r.breakEvenCushion < 0 ? 8_500 : 11_000,
      occupancyPct: r.breakEvenCushion < 0 ? 42 : 58,
      averageDailyRate: 180,
      cleaningCosts: 1_700,
      maintenanceCosts: r.breakEvenCushion < 0 ? 2_600 : 1_200,
      platformFees: 650,
      managementFeePct: 20,
      ownerReserveTarget: 5_000,
      openIssues: r.breakEvenCushion < 0 ? 5 : 2,
      repeatIssues: r.breakEvenCushion < 0 ? 2 : 0,
      avgResponseHours: r.breakEvenCushion < 0 ? 24 : 8,
      reviewRating: r.breakEvenCushion < 0 ? 3.9 : 4.4,
      futureBookedNights: r.breakEvenCushion < 0 ? 7 : 13,
      next30AvailableNights: 25,
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
  const importReadiness = computeVacationRentalImportReadiness({
    unitCount: 1_000,
    annualBookings: 14_000,
    sources: [
      {
        name: "Escapia",
        capabilities: ["propertyManagers", "unitInventory", "rates", "feesTaxes", "bookingRestrictions", "bookingChannels"],
      },
    ],
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Brokerage heartbeat estimate</div>
          <h2 className="font-display text-3xl text-[#E6E8E4]">{f.name || "Your brokerage"}</h2>
          {f.market && <div className="text-sm text-muted">{f.market}</div>}
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-[#E6E8E4]">
          <ArrowLeft size={14} /> Adjust numbers
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3 text-[13px] leading-relaxed text-[#CFD2CC]">
        GCI is not the operating base. This estimate treats agent payouts, franchise fees, and referral fees as pass-through pressure,
        then runs Profit First and break-even from Company Dollar.
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <CompanyDollarTile r={r} />
        <SplitPressureTile r={r} />
        <BreakEvenTile r={r} />
        <RunwayTile r={r} />
        <PipelineTile r={r} />
        <ProfitFirstTile r={r} />
      </div>

      <AgentPerformancePreview rows={agentRows} />
      <MarketAuraPreview market={marketAura} />
      <PropertyHeartbeatPreview property={property} />
      <PropertyPortfolioPreview portfolio={propertyPortfolio} />
      <ImportReadinessPreview readiness={importReadiness} />

      <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
        <div className="font-display text-xl text-[#E6E8E4]">Paid add-on lanes</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AddOn title="Agent Performance" text="Company Dollar yield, cap pressure, pipeline, close velocity, and coaching flags." />
          <AddOn title="Market Intelligence" text="MLS velocity, DOM, price drops, rates, showing demand, and local market Aura." />
          <AddOn title="Property Heartbeat" text="Vacation rental owner portal, maintenance pressure, guest Aura, and owner proceeds." />
        </div>
        <Link href="/demo" className="mt-4 inline-block text-sm text-copper-soft hover:text-copper">
          Back to restaurant demo
        </Link>
      </div>
    </div>
  );
}

function Tile({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        {icon} {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: Health }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={"tnum text-xl " + (tone ? HEALTH_TEXT[tone] : "text-[#E6E8E4]")}>{value}</div>
    </div>
  );
}

function CompanyDollarTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Company Dollar" icon={<Building2 size={12} className="text-copper-soft" />}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.companyDollarHealth]}>{money(r.companyDollar)}</span>
        <span className="text-sm text-muted">/ month retained</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Closed GCI" value={money(r.monthlyGci)} />
        <Stat label="Retained share" value={pct(r.companyDollarPct)} tone={r.companyDollarHealth} />
      </div>
      <p className="mt-3 text-[11px] text-muted">Company Dollar is GCI after agent payouts, franchise fees, and referral fees.</p>
    </Tile>
  );
}

function SplitPressureTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Split Pressure" icon={<Gauge size={12} className="text-copper-soft" />}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.splitPressureHealth]}>{pct(r.splitPressurePct)}</span>
        <span className="text-sm text-muted">of GCI passes through</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Agents" value={money(r.agentPayouts)} />
        <Stat label="Franchise" value={money(r.franchiseFees)} />
        <Stat label="Referral" value={money(r.referralFees)} />
      </div>
      <p className="mt-3 text-[11px] text-muted">This is the real estate version of prime-cost pressure.</p>
    </Tile>
  );
}

function BreakEvenTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Break-even" icon={<Wallet size={12} className="text-copper-soft" />}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-3xl text-[#E6E8E4]">{money(r.breakEvenCompanyDollar)}</span>
        <span className="text-sm text-muted">Company Dollar needed</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="GCI needed" value={r.gciNeededToBreakEven != null ? money(r.gciNeededToBreakEven) : "-"} />
        <Stat
          label={r.breakEvenCushion >= 0 ? "Cushion" : "Shortfall"}
          value={money(Math.abs(r.breakEvenCushion))}
          tone={r.breakEvenCushion >= 0 ? "green" : "red"}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted">Profit starts after Company Dollar covers brokerage OpEx.</p>
    </Tile>
  );
}

function RunwayTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Cash Oxygen" icon={<Wallet size={12} className="text-copper-soft" />}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.cashRunwayHealth]}>
          {r.cashRunwayDays != null ? Math.round(r.cashRunwayDays).toLocaleString() : "-"}
        </span>
        <span className="text-sm text-muted">days runway</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Operating cash" value={money(r.currentCash)} />
        <Stat label="Monthly OpEx" value={money(r.monthlyOpex)} />
      </div>
    </Tile>
  );
}

function PipelineTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Pipeline Momentum" icon={<TrendingUp size={12} className="text-copper-soft" />}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.pipelineHealth]}>{money(r.expectedPipelineCompanyDollar)}</span>
        <span className="text-sm text-muted">weighted Company Dollar</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Weighted GCI" value={money(r.weightedPipelineGci)} />
        <Stat label="Pipeline span" value={`${r.pipelineMonths.toFixed(1)} mo`} />
      </div>
      <p className="mt-3 text-[11px] text-muted">This is the rough 45-90 day forward read before closings land.</p>
    </Tile>
  );
}

function ProfitFirstTile({ r }: { r: RealEstateEstimateResult }) {
  return (
    <Tile title="Profit First" icon={<PiggyBank size={12} className="text-copper-soft" />}>
      <p className="text-[11px] text-muted">Starting set-asides calculated from Company Dollar, not GCI:</p>
      <div className="mt-3 space-y-2">
        {r.pf.map((line) => (
          <div key={line.key} className="flex items-center justify-between rounded-lg border border-line bg-ink/50 px-3 py-2">
            <span className="text-sm text-[#E6E8E4]">
              {line.label} <span className="text-muted">({line.pct}%)</span>
            </span>
            <span className="tnum text-base text-copper-soft">{money(line.amount)}</span>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function AgentPerformancePreview({ rows }: { rows: AgentPerformanceResult[] }) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Paid add-on preview</div>
          <h3 className="font-display text-xl text-[#E6E8E4]">Agent Performance</h3>
        </div>
        <div className="text-[11px] text-muted">Sample rows generated from the brokerage estimate</div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3">
        {rows.map((row) => (
          <AgentRow key={row.name} row={row} />
        ))}
      </div>
    </div>
  );
}

function AgentRow({ row }: { row: AgentPerformanceResult }) {
  return (
    <div className="rounded-lg border border-line bg-ink/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-[#E6E8E4]">{row.name}</div>
          <div className={"mt-0.5 text-[11px] " + HEALTH_TEXT[row.overallHealth]}>{row.note}</div>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(row.overallHealth)}>
          {row.overallHealth === "green" ? "healthy" : row.overallHealth === "yellow" ? "watch" : "pressure"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Company Dollar" value={money(row.companyDollar)} tone={row.companyDollarYieldPct >= 25 ? "green" : row.companyDollarYieldPct >= 18 ? "yellow" : "red"} />
        <Stat label="Retained yield" value={pct(row.companyDollarYieldPct)} />
        <Stat label="Cap remaining" value={money(row.capRemaining)} tone={row.capPressureHealth} />
        <Stat label="Weighted pipeline" value={money(row.expectedPipelineCompanyDollar)} />
        <Stat label="Lead ROI" value={row.leadRoi != null ? `${row.leadRoi.toFixed(1)}x` : "-"} />
      </div>
    </div>
  );
}

function PropertyHeartbeatPreview({ property }: { property: PropertyHeartbeatResult }) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Paid add-on preview</div>
          <h3 className="font-display text-xl text-[#E6E8E4]">Property Heartbeat</h3>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(property.overallHealth)}>
          {property.overallHealth === "green" ? "healthy property" : property.overallHealth === "yellow" ? "watch property" : "property pressure"}
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-[#E6E8E4]">
              <Home size={14} className="text-copper-soft" /> {property.name}
            </div>
            <div className={"mt-0.5 text-[11px] " + HEALTH_TEXT[property.overallHealth]}>{property.note}</div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Star size={12} className="text-copper-soft" /> Mini Aura {Math.round(property.guestAuraScore)}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Owner proceeds" value={money(property.ownerProceeds)} tone={property.ownerProceedsHealth} />
          <Stat label="Maintenance drag" value={pct(property.maintenancePressurePct)} tone={property.maintenanceHealth} />
          <Stat label="Booking pace" value={pct(property.bookingPacePct, 0)} tone={property.bookingMomentumHealth} />
          <Stat
            label={property.reserveCushion >= 0 ? "Reserve cushion" : "Reserve gap"}
            value={money(Math.abs(property.reserveCushion))}
            tone={property.reserveCushion >= 0 ? "green" : "red"}
          />
          <Stat label="Occupancy" value={pct(property.occupancyPct, 0)} />
          <Stat label="ADR" value={money(property.averageDailyRate)} />
          <Stat label="RevPAR" value={money(property.revPar)} />
          <Stat label="Open issues" value={Math.round(property.openIssues).toLocaleString()} tone={property.maintenanceHealth} />
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        The owner-facing version would connect PMS, reviews, owner statements, cleaning, and maintenance reports per property.
      </p>
    </div>
  );
}

function PropertyPortfolioPreview({ portfolio }: { portfolio: PropertyPortfolioResult }) {
  const actionQueue = buildPropertyActionQueue(portfolio.properties, 4);

  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Portfolio view</div>
          <h3 className="font-display text-xl text-[#E6E8E4]">Rental Property Rollup</h3>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(portfolio.overallHealth)}>
          {portfolio.pressureCount > 0 ? `${portfolio.pressureCount} needs attention` : "portfolio healthy"}
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Properties" value={portfolio.propertyCount.toLocaleString()} />
          <Stat label="Booking revenue" value={money(portfolio.monthlyBookingRevenue)} />
          <Stat label="Owner proceeds" value={money(portfolio.ownerProceeds)} tone={portfolio.ownerProceedsPct >= 45 ? "green" : portfolio.ownerProceedsPct >= 30 ? "yellow" : "red"} />
          <Stat label="Maintenance drag" value={pct(portfolio.maintenancePressurePct)} tone={portfolio.maintenancePressurePct <= 20 ? "green" : portfolio.maintenancePressurePct <= 28 ? "yellow" : "red"} />
          <Stat label="Avg Aura" value={Math.round(portfolio.averageGuestAuraScore).toLocaleString()} tone={portfolio.averageGuestAuraScore >= 75 ? "green" : portfolio.averageGuestAuraScore >= 55 ? "yellow" : "red"} />
        </div>
        <p className={"mt-3 text-[11px] leading-relaxed " + HEALTH_TEXT[portfolio.overallHealth]}>{portfolio.note}</p>
        <div className="mt-4 space-y-2">
          {portfolio.properties.map((property) => (
            <div key={property.name} className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface/80 p-3 sm:grid-cols-5">
              <div>
                <div className="text-sm text-[#E6E8E4]">{property.name}</div>
                <div className={"text-[11px] " + HEALTH_TEXT[property.overallHealth]}>
                  {portfolio.topPressure?.name === property.name ? "highest pressure" : "property heartbeat"}
                </div>
              </div>
              <Stat label="Owner proceeds" value={money(property.ownerProceeds)} tone={property.ownerProceedsHealth} />
              <Stat label="Maintenance" value={pct(property.maintenancePressurePct)} tone={property.maintenanceHealth} />
              <Stat label="Aura" value={Math.round(property.guestAuraScore).toLocaleString()} tone={property.guestAuraHealth} />
              <Stat label="Booking pace" value={pct(property.bookingPacePct, 0)} tone={property.bookingMomentumHealth} />
            </div>
          ))}
        </div>
        {actionQueue.length > 0 && <PropertyActionQueue items={actionQueue} />}
      </div>
    </div>
  );
}

function PropertyActionQueue({ items }: { items: PropertyActionItem[] }) {
  return (
    <div className="mt-4 rounded-lg border border-copper-dim/40 bg-copper-dim/10 p-3">
      <div className="text-[11px] uppercase tracking-wider text-copper-soft">Operator action queue</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={`${item.propertyName}-${item.kind}`} className="rounded-lg border border-line bg-ink/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm text-[#E6E8E4]">{item.title}</div>
                <div className="text-[11px] text-muted">{item.propertyName}</div>
              </div>
              <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(item.priority)}>
                {item.priority === "red" ? "urgent" : "watch"}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketAuraPreview({ market }: { market: MarketAuraResult }) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Paid add-on preview</div>
          <h3 className="font-display text-xl text-[#E6E8E4]">Market Intelligence</h3>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(market.marketAuraHealth)}>
          {market.marketAuraHealth === "green" ? "market tailwind" : market.marketAuraHealth === "yellow" ? "mixed market" : "market pressure"}
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-[#E6E8E4]">
              <Search size={14} className="text-copper-soft" /> {market.market}
            </div>
            <div className={"mt-0.5 text-[11px] " + HEALTH_TEXT[market.marketAuraHealth]}>{market.note}</div>
          </div>
          <div className="tnum text-3xl text-[#E6E8E4]">{Math.round(market.marketAuraScore)}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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

function ImportReadinessPreview({ readiness }: { readiness: VacationRentalImportReadinessResult }) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Pilot import preview</div>
          <h3 className="font-display text-xl text-[#E6E8E4]">Vacation Rental Import Readiness</h3>
        </div>
        <span className={"rounded-full border px-2 py-0.5 text-[11px] " + badgeCls(readiness.overallHealth)}>
          {Math.round(readiness.overallCoveragePct)}% mapped
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-[#E6E8E4]">
              <Database size={14} className="text-copper-soft" /> Escapia-like PMS foundation
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {readiness.connectedSources.join(", ")} connected for {readiness.unitCount.toLocaleString()} units and{" "}
              {readiness.annualBookings.toLocaleString()} annual bookings.
            </div>
          </div>
          <div className={"tnum text-3xl " + HEALTH_TEXT[readiness.overallHealth]}>
            {Math.round(readiness.overallCoveragePct)}%
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {readiness.layers.map((layer) => (
            <div key={layer.key} className="rounded-lg border border-line bg-surface/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-[#E6E8E4]">{layer.label}</div>
                <span className={"tnum text-sm " + HEALTH_TEXT[layer.health]}>{Math.round(layer.coveragePct)}%</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{layer.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Next best source: <span className="text-copper-soft">{readiness.nextBestSource}</span>. Escapia gives the operating
          structure; bookings, owner statements, expenses, maintenance, and reviews complete the money and Aura layers.
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
      <div className="text-sm text-[#E6E8E4]">{title}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Legend({ n, title, hint }: { n: string; title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-copper-dim/40 text-[11px] text-copper-soft">{n}</span>
      <span className="text-sm font-medium text-[#E6E8E4]">{title}</span>
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
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">
        {label}
        {required && <span className="text-copper-soft"> *</span>}
      </span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>}
        {children}
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
