"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Gauge, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { money, pct } from "@/lib/format";
import {
  computeAgentPerformanceList,
  type AgentPerformanceResult,
} from "@/lib/demo/real-estate-agent-performance";
import {
  computeRealEstateEstimate,
  type RealEstateEstimateInputs,
  type RealEstateEstimateResult,
} from "@/lib/demo/real-estate-estimate";
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
