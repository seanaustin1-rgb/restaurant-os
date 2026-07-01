"use client";

import type React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Gauge, Info, Lock, PiggyBank, Star, Wallet } from "lucide-react";
import { money, pct } from "@/lib/format";
import type { Health } from "@/lib/demo/estimate";
import { HealthSignal } from "@/components/health/HealthSignal";
import {
  computeServiceEstimate,
  SERVICE_LOCKED_TILES,
  type ServiceEstimateInputs,
  type ServiceEstimateResult,
  type ServiceSoftware,
} from "@/lib/demo/service-estimate";
import { lookupReputation, type ReputationResult } from "../actions";
import { DemoModulePreview } from "../DemoModulePreview";

type FormState = Record<
  | "name"
  | "market"
  | "software"
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
  software: "housecall",
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
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-ink-text placeholder:text-muted/50 outline-none focus:border-copper-soft tnum";
const selectCls =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-ink-text outline-none focus:border-copper-soft";

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const word = (s: Health, g: string, y: string, r: string) => (s === "green" ? g : s === "yellow" ? y : r);

const EXPLAIN = {
  aura:
    "Your public rating, pulled live from Google. Service businesses win or lose jobs on reviews — a strong rating means more booked work at better prices.",
  delivery:
    "Delivery pressure = labor + materials + subcontractors as a share of revenue. Keep it near or below 60%; above that, fixed bills and profit get squeezed.",
  breakeven:
    "The weekly revenue you need just to cover delivery costs plus the fixed bills you entered. Below it you lose money; the cushion above funds profit and owner pay.",
  cash:
    "Money in minus money out for a rough month. Before owner pay, taxes, and any debt not entered as a fixed bill.",
  pf:
    "A starting split to set aside before you spend — Profit, Owner Pay, and Tax — so profit is not 'whatever is left.'",
} as const;

const num = (s: string): number => {
  const v = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};

const optNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = parseFloat(t.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : null;
};

function buildInputs(f: FormState): ServiceEstimateInputs {
  return {
    name: f.name.trim(),
    market: f.market.trim(),
    software: (f.software as ServiceSoftware) || "housecall",
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
  const [aura, setAura] = useState<ReputationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo(() => (view === "results" ? computeServiceEstimate(inputs) : null), [inputs, view]);

  // Prefill from a shared link a consultant sends, e.g.
  //   /demo/service?name=...&weeklyRevenue=45000&weeklyLabor=14000
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return;
    const keys: (keyof FormState)[] = [
      "name", "market", "software", "weeklyRevenue", "weeklyLabor", "weeklyMaterials", "weeklySubcontractors",
      "monthlyRent", "monthlyUtilities", "monthlyInsurance", "monthlyVehicles", "monthlySoftware", "monthlyDebt", "monthlyOther",
      "avgJobValue", "jobsPerWeek",
    ];
    const next: Partial<FormState> = {};
    for (const k of keys) { const v = sp.get(k); if (v != null) next[k] = v; }
    if (!Object.keys(next).length) return;
    const seeded = { ...INITIAL, ...next } as FormState;
    setF(seeded);
    const inp = buildInputs(seeded);
    if (inp.weeklyRevenue > 0) {
      setView("results");
      if (inp.name) startTransition(async () => setAura(await lookupReputation(inp.name, inp.market, "service")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = buildInputs(f);
    if (next.weeklyRevenue <= 0) return setError("Add average weekly revenue.");
    setError(null);
    setView("results");
    setAura(null);
    if (next.name) startTransition(async () => setAura(await lookupReputation(next.name, next.market, "service")));
  }

  if (view === "results" && result) {
    return <Results f={f} r={result} aura={aura} auraPending={pending} onEdit={() => setView("form")} />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl">
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
        <Field label="Field software / system" hint="Tells the demo what would light this up live">
          <select className={selectCls} value={f.software} onChange={upd("software")}>
            <option value="housecall">Housecall Pro</option>
            <option value="jobber">Jobber</option>
            <option value="servicetitan">ServiceTitan</option>
            <option value="quickbooks">QuickBooks</option>
            <option value="hubspot">HubSpot / CRM</option>
            <option value="spreadsheet">Spreadsheet / none</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="Known weekly numbers" hint="Revenue plus delivery costs gives the first pressure read" />
        <Field label="Average weekly revenue" required prefix="$">
          <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="45,000" value={f.weeklyRevenue} onChange={upd("weeklyRevenue")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

function Results({ f, r, aura, auraPending, onEdit }: { f: FormState; r: ServiceEstimateResult; aura: ReputationResult | null; auraPending: boolean; onEdit: () => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Service heartbeat estimate</div>
          <h2 className="font-display text-3xl text-ink-text">{f.name || "Your service business"}</h2>
          {f.market && <div className="text-sm text-muted">{f.market}</div>}
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink-text">
          <ArrowLeft size={14} /> Adjust numbers
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3 text-[13px] leading-relaxed text-ink-text-soft">
        This estimate treats labor, materials, and subcontractors as delivery costs. Profit starts after those weekly costs and monthly fixed bills are covered.
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Tile title="Reputation" icon={<Star size={12} className="text-copper-soft" />} explainer={EXPLAIN.aura}>
          {auraPending && <div className="text-sm text-muted">Looking up {f.name || "your business"} on Google…</div>}
          {!auraPending && aura?.found && (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="tnum text-4xl text-ink-text">{aura.rating?.toFixed(1)}</span>
                <Stars rating={aura.rating ?? 0} />
              </div>
              <div className="mt-1 text-sm text-muted">{aura.reviewCount.toLocaleString()} Google reviews</div>
              {aura.matchedName && <div className="mt-2 text-[11px] text-muted/80">Matched: {aura.matchedName}{aura.matchedAddress ? ` · ${aura.matchedAddress}` : ""}</div>}
            </div>
          )}
          {!auraPending && aura && !aura.found && <div className="text-sm text-muted">We couldn&apos;t auto-match a Google listing. In the full account, review sources fill this alongside the money read.</div>}
          {!auraPending && !aura && <div className="text-sm text-muted">Add a business name above to try a live Google rating match.</div>}
        </Tile>

        <Tile title="Delivery Pressure" icon={<Gauge size={12} className="text-copper-soft" />} explainer={EXPLAIN.delivery}>
          <div className="flex items-baseline gap-2">
            <span className={"tnum text-4xl " + HEALTH_TEXT[r.deliveryHealth]}>{pct(r.deliveryPressurePct)}</span>
            <span className="text-sm text-muted">of revenue</span>
          </div>
          <HealthSignal
            status={r.deliveryHealth}
            label={word(r.deliveryHealth, "On track", "Watch", "Heavy")}
            detail={Math.abs(r.deliveryPressurePct - 60) < 0.5 ? "right at ≤60% target" : `${Math.abs(r.deliveryPressurePct - 60).toFixed(1)} pts ${r.deliveryPressurePct > 60 ? "over" : "under"} ≤60%`}
            className="mt-2"
          />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Labor" value={money(r.monthlyLabor)} />
            <Stat label="Materials" value={money(r.monthlyMaterials)} />
            <Stat label="Subs" value={money(r.monthlySubcontractors)} />
          </div>
          <p className="mt-3 text-[11px] text-muted">Target starting point: keep delivery costs near or below 60% of revenue.</p>
        </Tile>

        <Tile title="Break-even Number" icon={<Wallet size={12} className="text-copper-soft" />} explainer={EXPLAIN.breakeven}>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-4xl text-ink-text">{money(r.weeklyBreakEven)}</span>
            <span className="text-sm text-muted">/ week before profit starts</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat label="Your weekly revenue" value={money(r.weeklyRevenue)} />
            <Stat
              label={r.dollarsAboveBreakEven >= 0 ? "Monthly cushion" : "Monthly shortfall"}
              value={money(Math.abs(r.dollarsAboveBreakEven))}
              tone={r.breakEvenHealth}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted">This covers delivery costs plus fixed bills entered below.</p>
        </Tile>

        <Tile title="Cash Flow (rough)" icon={<BriefcaseBusiness size={12} className="text-copper-soft" />} explainer={EXPLAIN.cash}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-center">
            <Stat label="In" value={money(r.cashIn)} />
            <Stat label="Out" value={money(r.cashOut)} />
            <Stat label="Left" value={money(r.cashLeft)} tone={r.marginHealth} />
          </div>
          <p className="mt-3 text-[11px] text-muted">Before owner pay, taxes, and debt service not entered as fixed bills.</p>
        </Tile>

        <Tile title="Profit First Set-asides" icon={<PiggyBank size={12} className="text-copper-soft" />} explainer={EXPLAIN.pf}>
          <div className="space-y-2">
            {r.pf.map((line) => (
              <div key={line.key} className="flex items-center justify-between rounded-lg border border-line bg-ink/50 px-3 py-2">
                <span className="text-sm text-ink-text">
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

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted"><Lock size={12} /> Deeper diagnostics outside this quick estimate</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SERVICE_LOCKED_TILES.map((t) => (
            <div key={t.key} className="rounded-lg border border-line bg-surface/40 px-3 py-3 opacity-60">
              <div className="flex items-center gap-1.5 text-sm text-muted"><Lock size={12} /> {t.label}</div>
              <div className="mt-1 text-[11px] text-muted/80">needs {t.needs}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-surface px-4 py-3 text-[11px] leading-relaxed text-muted">
        Source pipe: <span className="text-ink-text">{r.softwareLabel}</span>. {r.softwareNote}
      </div>

      <DemoModulePreview businessType="SERVICE" />

      <div className="mt-8 text-center">
        <Link href="/demo/tour" className="text-sm text-copper-soft hover:text-copper">
          Back to demo selector
        </Link>
      </div>
    </div>
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
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  prefix?: string;
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
      </span>
    </label>
  );
}
