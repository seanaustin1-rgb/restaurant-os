"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Gauge, PiggyBank, Wallet } from "lucide-react";
import { money, pct } from "@/lib/format";
import type { Health } from "@/lib/demo/estimate";
import {
  computeServiceEstimate,
  type ServiceEstimateInputs,
  type ServiceEstimateResult,
} from "@/lib/demo/service-estimate";
import { DemoModulePreview } from "../DemoModulePreview";

type FormState = Record<
  | "name"
  | "market"
  | "weeklyRevenue"
  | "weeklyLabor"
  | "weeklyMaterials"
  | "weeklySubcontractors"
  | "monthlyRent"
  | "monthlyUtilities"
  | "monthlyInsurance"
  | "monthlyVehicles"
  | "monthlySoftware"
  | "monthlyDebt"
  | "monthlyOther"
  | "avgJobValue"
  | "jobsPerWeek",
  string
>;

const INITIAL: FormState = {
  name: "",
  market: "",
  weeklyRevenue: "",
  weeklyLabor: "",
  weeklyMaterials: "",
  weeklySubcontractors: "",
  monthlyRent: "",
  monthlyUtilities: "",
  monthlyInsurance: "",
  monthlyVehicles: "",
  monthlySoftware: "",
  monthlyDebt: "",
  monthlyOther: "",
  avgJobValue: "",
  jobsPerWeek: "",
};

const inputCls =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-[#E6E8E4] placeholder:text-muted/50 outline-none focus:border-copper-soft tnum";

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const num = (s: string): number => {
  const v = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};

const optNum = (s: string): number | null => {
  const v = num(s);
  return v > 0 ? v : null;
};

function buildInputs(f: FormState): ServiceEstimateInputs {
  return {
    name: f.name.trim(),
    market: f.market.trim(),
    weeklyRevenue: num(f.weeklyRevenue),
    weeklyLabor: num(f.weeklyLabor),
    weeklyMaterials: num(f.weeklyMaterials),
    weeklySubcontractors: num(f.weeklySubcontractors),
    monthlyFixedBills:
      num(f.monthlyRent) +
      num(f.monthlyUtilities) +
      num(f.monthlyInsurance) +
      num(f.monthlyVehicles) +
      num(f.monthlySoftware) +
      num(f.monthlyDebt) +
      num(f.monthlyOther),
    avgJobValue: optNum(f.avgJobValue),
    jobsPerWeek: optNum(f.jobsPerWeek),
  };
}

export function ServiceEstimator() {
  const [f, setF] = useState<FormState>(INITIAL);
  const [view, setView] = useState<"form" | "results">("form");
  const [error, setError] = useState<string | null>(null);

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo(() => (view === "results" ? computeServiceEstimate(inputs) : null), [inputs, view]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = buildInputs(f);
    if (next.weeklyRevenue <= 0) return setError("Add average weekly revenue.");
    setError(null);
    setView("results");
  }

  if (view === "results" && result) {
    return <Results f={f} r={result} onEdit={() => setView("form")} />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl">
      <p className="text-sm text-muted">
        Enter the rough weekly numbers you already know. Ballparks are fine, and blank fields are treated as unknown.
      </p>

      <fieldset className="mt-6 space-y-4">
        <Legend n="1" title="Optional identity" hint="Only used to personalize the estimate" />
        <Field label="Business name">
          <input className={inputCls} placeholder="Main Street Services" value={f.name} onChange={upd("name")} />
        </Field>
        <Field label="City & state">
          <input className={inputCls} placeholder="York, PA" value={f.market} onChange={upd("market")} />
        </Field>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="Known weekly numbers" hint="Revenue plus delivery costs gives the first pressure read" />
        <Field label="Average weekly revenue" required prefix="$">
          <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="45,000" value={f.weeklyRevenue} onChange={upd("weeklyRevenue")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Weekly payroll + taxes" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="14,000" value={f.weeklyLabor} onChange={upd("weeklyLabor")} />
          </Field>
          <Field label="Weekly materials / supplies" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="8,000" value={f.weeklyMaterials} onChange={upd("weeklyMaterials")} />
          </Field>
          <Field label="Weekly subcontractors" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="4,000" value={f.weeklySubcontractors} onChange={upd("weeklySubcontractors")} />
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          Payroll should include employer taxes and benefits if you know them. Subcontractors stay separate so you can see delivery pressure.
        </p>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="3" title="Monthly fixed bills" hint="Use the bills you know; leave the rest blank" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rent / lease" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="6,000" value={f.monthlyRent} onChange={upd("monthlyRent")} />
          </Field>
          <Field label="Utilities" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="1,200" value={f.monthlyUtilities} onChange={upd("monthlyUtilities")} />
          </Field>
          <Field label="Insurance" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="2,000" value={f.monthlyInsurance} onChange={upd("monthlyInsurance")} />
          </Field>
          <Field label="Vehicles / equipment" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="4,000" value={f.monthlyVehicles} onChange={upd("monthlyVehicles")} />
          </Field>
          <Field label="Software / phones" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="900" value={f.monthlySoftware} onChange={upd("monthlySoftware")} />
          </Field>
          <Field label="Debt / loan payments" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="3,500" value={f.monthlyDebt} onChange={upd("monthlyDebt")} />
          </Field>
          <Field label="Other fixed bills" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="5,000" value={f.monthlyOther} onChange={upd("monthlyOther")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="4" title="Job detail" hint="Optional, used to translate break-even into job count" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Average job value" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="2,500" value={f.avgJobValue} onChange={upd("avgJobValue")} />
          </Field>
          <Field label="Jobs per week">
            <input className={inputCls} inputMode="numeric" placeholder="18" value={f.jobsPerWeek} onChange={upd("jobsPerWeek")} />
          </Field>
        </div>
      </fieldset>

      {error && <p className="mt-5 text-sm text-health-red">{error}</p>}

      <button
        type="submit"
        className="mt-7 w-full rounded-lg bg-copper px-5 py-3 font-medium text-ink transition hover:bg-copper-soft"
      >
        See service heartbeat -&gt;
      </button>
      <p className="mt-3 text-center text-[11px] text-muted">
        Nothing is saved. This is a quick estimate, not a full diagnosis.
      </p>
    </form>
  );
}

function Results({ f, r, onEdit }: { f: FormState; r: ServiceEstimateResult; onEdit: () => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Service heartbeat estimate</div>
          <h2 className="font-display text-3xl text-[#E6E8E4]">{f.name || "Your service business"}</h2>
          {f.market && <div className="text-sm text-muted">{f.market}</div>}
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-[#E6E8E4]">
          <ArrowLeft size={14} /> Adjust numbers
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3 text-[13px] leading-relaxed text-[#CFD2CC]">
        This estimate treats labor, materials, and subcontractors as delivery costs. Profit starts after those weekly costs and monthly fixed bills are covered.
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Tile title="Delivery Pressure" icon={<Gauge size={12} className="text-copper-soft" />}>
          <div className="flex items-baseline gap-2">
            <span className={"tnum text-4xl " + HEALTH_TEXT[r.deliveryHealth]}>{pct(r.deliveryPressurePct)}</span>
            <span className="text-sm text-muted">of revenue</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Labor" value={money(r.monthlyLabor)} />
            <Stat label="Materials" value={money(r.monthlyMaterials)} />
            <Stat label="Subs" value={money(r.monthlySubcontractors)} />
          </div>
          <p className="mt-3 text-[11px] text-muted">Target starting point: keep delivery costs near or below 60% of revenue.</p>
        </Tile>

        <Tile title="Break-even Number" icon={<Wallet size={12} className="text-copper-soft" />}>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-4xl text-[#E6E8E4]">{money(r.weeklyBreakEven)}</span>
            <span className="text-sm text-muted">/ week before profit starts</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Your weekly revenue" value={money(r.weeklyRevenue)} />
            <Stat
              label={r.dollarsAboveBreakEven >= 0 ? "Monthly cushion" : "Monthly shortfall"}
              value={money(Math.abs(r.dollarsAboveBreakEven))}
              tone={r.breakEvenHealth}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted">This covers delivery costs plus fixed bills entered below.</p>
        </Tile>

        <Tile title="Cash Flow (rough)" icon={<BriefcaseBusiness size={12} className="text-copper-soft" />}>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="In" value={money(r.cashIn)} />
            <Stat label="Out" value={money(r.cashOut)} />
            <Stat label="Left" value={money(r.cashLeft)} tone={r.marginHealth} />
          </div>
          <p className="mt-3 text-[11px] text-muted">Before owner pay, taxes, and debt service not entered as fixed bills.</p>
        </Tile>

        <Tile title="Profit First Set-asides" icon={<PiggyBank size={12} className="text-copper-soft" />}>
          <div className="space-y-2">
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
      </div>

      {(r.avgJobValue || r.jobsPerWeek) && (
        <div className="mt-5 rounded-xl border border-line bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted">Job read</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Average job value" value={r.avgJobValue ? money(r.avgJobValue) : "-"} />
            <Stat label="Jobs per week" value={r.jobsPerWeek ? r.jobsPerWeek.toLocaleString() : "-"} />
            <Stat label="Break-even jobs / week" value={r.breakEvenJobsPerWeek ? r.breakEvenJobsPerWeek.toFixed(1) : "-"} />
          </div>
        </div>
      )}

      <DemoModulePreview businessType="SERVICE" />

      <div className="mt-8 text-center">
        <Link href="/demo/tour" className="text-sm text-copper-soft hover:text-copper">
          Back to full demo tour
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
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  prefix?: string;
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
      </span>
    </label>
  );
}
