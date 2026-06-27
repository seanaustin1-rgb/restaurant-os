"use client";

import type React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { SignUpButton } from "@clerk/nextjs";
import { AlertOctagon, AlertTriangle, ArrowLeft, CalendarClock, CircleCheck, Gauge, Info, Lock, PiggyBank, Scale, Sparkles, Star, Wallet } from "lucide-react";
import {
  computeContractorEstimate,
  CONTRACTOR_LOCKED_TILES,
  type ContractorEstimateInputs,
  type ContractorEstimateResult,
  type ContractorSoftware,
  type ContractorBenchRow,
} from "@/lib/demo/contractor-estimate";
import type { Health } from "@/lib/demo/estimate";
import { HealthSignal } from "@/components/health/HealthSignal";
import { money, pct } from "@/lib/format";
import { lookupReputation, type ReputationResult } from "../actions";

const HEALTH_TEXT: Record<Health, string> = { green: "text-health-green", yellow: "text-health-yellow", red: "text-health-red" };
const HEALTH_HEX: Record<Health, string> = { green: "#5FA777", yellow: "#D9A35E", red: "#C8643A" };
const HEALTH_ICON: Record<Health, typeof CircleCheck> = { green: CircleCheck, yellow: AlertTriangle, red: AlertOctagon };
const BENCH_OVERALL_LABEL: Record<Health, string> = { green: "On benchmark", yellow: "Watch a few", red: "Off benchmark" };

const EXPLAIN = {
  aura:
    "Your public rating, pulled live from Google. Contractors win or lose jobs on reviews — a strong rating lets you charge more and close faster. We read it next to the money because reputation is lead flow.",
  jobmargin:
    "What is left of each revenue dollar after the job's own costs — materials, field labor, and subcontractors — before office overhead. It is the contractor's core number: thin job margin means no amount of volume reaches profit. Healthy runs about 35% or better.",
  lever:
    "The single pressure costing you the most right now, picked from margin, materials, labor, backlog, and cash. Fix this one first — it moves the needle more than the rest combined.",
  backlog:
    "Signed work divided by how fast your crews produce — how many weeks you are booked. Under about 4 weeks you are selling just to keep crews busy; 8+ is comfortable runway. It is the difference between pricing from strength and pricing to survive.",
  cashgap:
    "How long your money sits in unpaid invoices (days to cash). You front materials and payroll, then wait — a long gap is why profitable contractors still run out of cash. Under 30 days is healthy; past 45 it is a working-capital problem.",
  breakeven:
    "The revenue your job margin needs to produce just to cover office overhead. Below it, every job is subsidizing the business; the cushion above is your margin of safety.",
  pf:
    "A starting split to set aside before you spend — Profit, Owner Pay, Tax, and an Equipment/Warranty reserve for trucks, tools, and callbacks. Pay these first so profit is not 'whatever is left.'",
  bench:
    "Where your job margin, materials, labor, and net margin sit against typical contractor ranges. Static reference figures, not live peer data — guide-rails, not a grade. Margins vary by trade; we refine by trade once connected.",
  cash:
    "Money in minus money out (job costs plus overhead) for the month. A rough read on whether the shop breathes; before owner draws, taxes, and debt.",
} as const;

const word = (s: Health, g: string, y: string, r: string) => (s === "green" ? g : s === "yellow" ? y : r);

type FormState = Record<
  | "name" | "market" | "software" | "revenue" | "materials" | "labor" | "subs"
  | "overhead" | "backlog" | "capacity" | "receivables" | "receivablesOver30",
  string
>;

const INITIAL: FormState = {
  name: "", market: "", software: "jobber", revenue: "", materials: "", labor: "", subs: "",
  overhead: "", backlog: "", capacity: "", receivables: "", receivablesOver30: "",
};

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

function buildInputs(f: FormState): ContractorEstimateInputs {
  return {
    name: f.name.trim(),
    market: f.market.trim(),
    software: (f.software as ContractorSoftware) || "jobber",
    monthlyRevenue: num(f.revenue),
    materials: num(f.materials),
    fieldLabor: num(f.labor),
    subcontractors: optNum(f.subs),
    monthlyOverhead: optNum(f.overhead),
    backlog: optNum(f.backlog),
    monthlyCapacity: optNum(f.capacity),
    openReceivables: optNum(f.receivables),
    receivablesOver30: optNum(f.receivablesOver30),
  };
}

export function ContractorEstimator() {
  const [f, setF] = useState<FormState>(INITIAL);
  const [view, setView] = useState<"form" | "results">("form");
  const [error, setError] = useState<string | null>(null);
  const [aura, setAura] = useState<ReputationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo<ContractorEstimateResult | null>(
    () => (view === "results" ? computeContractorEstimate(inputs) : null),
    [view, inputs],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return;
    const map: [string, keyof FormState][] = [
      ["name", "name"], ["market", "market"], ["software", "software"], ["revenue", "revenue"],
      ["materials", "materials"], ["labor", "labor"], ["subs", "subs"], ["overhead", "overhead"],
      ["backlog", "backlog"], ["capacity", "capacity"], ["ar", "receivables"], ["arOver30", "receivablesOver30"],
    ];
    const next: Partial<FormState> = {};
    for (const [q, k] of map) { const v = sp.get(q); if (v != null) next[k] = v; }
    if (!Object.keys(next).length) return;
    const seeded = { ...INITIAL, ...next } as FormState;
    setF(seeded);
    const inp = buildInputs(seeded);
    if (inp.monthlyRevenue > 0 && inp.materials >= 0 && inp.fieldLabor >= 0 && (inp.materials > 0 || inp.fieldLabor > 0)) {
      setView("results");
      if (inp.name) startTransition(async () => setAura(await lookupReputation(inp.name, inp.market)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const inp = buildInputs(f);
    if (inp.monthlyRevenue <= 0 || (inp.materials <= 0 && inp.fieldLabor <= 0)) {
      return setError("Add monthly revenue and your job costs (materials + field labor) to see the read.");
    }
    setError(null);
    setView("results");
    setAura(null);
    if (inp.name) startTransition(async () => setAura(await lookupReputation(inp.name, inp.market)));
  }

  if (view === "results" && result) {
    return <Results f={f} r={result} aura={aura} auraPending={pending} onEdit={() => setView("form")} />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl">
      <p className="text-sm text-muted">Enter a typical month. Revenue plus your job costs is enough for the first read on margin.</p>

      <fieldset className="mt-6 space-y-4">
        <Legend n="1" title="Job economics" hint="Revenue and the three job-cost levers" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name"><input className={inputCls} placeholder="Iron Ridge Field Services" value={f.name} onChange={upd("name")} /></Field>
          <Field label="Market"><input className={inputCls} placeholder="York, PA" value={f.market} onChange={upd("market")} /></Field>
        </div>
        <Field label="Field software / system" hint="Tells the demo what would light this up live">
          <select className={selectCls} value={f.software} onChange={upd("software")}>
            <option value="jobber">Jobber</option>
            <option value="servicetitan">ServiceTitan</option>
            <option value="buildertrend">Buildertrend</option>
            <option value="housecall">Housecall Pro</option>
            <option value="quickbooks">QuickBooks</option>
            <option value="spreadsheet">Spreadsheet / none</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Monthly revenue (billed work)" required prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="200,000" value={f.revenue} onChange={upd("revenue")} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Materials / mo" required prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="70,000" value={f.materials} onChange={upd("materials")} /></Field>
          <Field label="Field labor / mo" required prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="64,000" value={f.labor} onChange={upd("labor")} /></Field>
          <Field label="Subs / mo" prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="12,000" value={f.subs} onChange={upd("subs")} /></Field>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="Overhead & pipeline" hint="What overhead must be recovered, and how much work is booked" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Monthly overhead" prefix="$" hint="Office, trucks, insurance, admin"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="30,000" value={f.overhead} onChange={upd("overhead")} /></Field>
          <Field label="Signed backlog" prefix="$" hint="Awarded, not yet built"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="412,000" value={f.backlog} onChange={upd("backlog")} /></Field>
          <Field label="Crew capacity / mo" prefix="$" hint="Work you can produce"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="220,000" value={f.capacity} onChange={upd("capacity")} /></Field>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="3" title="Getting paid" hint="Open receivables drive the cash gap" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Open receivables (AR)" prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="120,000" value={f.receivables} onChange={upd("receivables")} /></Field>
          <Field label="…of that, past 30 days" prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="18,200" value={f.receivablesOver30} onChange={upd("receivablesOver30")} /></Field>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">Leave backlog, capacity, or AR blank if you do not have them handy — those tiles just prompt instead of showing.</p>
      </fieldset>

      {error && <p className="mt-5 text-sm text-health-red">{error}</p>}

      <button type="submit" className="mt-7 w-full rounded-lg bg-copper px-5 py-3 font-medium text-ink transition hover:bg-copper-soft">See my estimate →</button>
      <p className="mt-3 text-center text-[11px] text-muted">Nothing is saved. A quick estimate, not a full diagnosis.</p>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Results({ f, r, aura, auraPending, onEdit }: {
  f: FormState; r: ContractorEstimateResult; aura: ReputationResult | null; auraPending: boolean; onEdit: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Instant estimate</div>
          <h2 className="font-display text-3xl text-ink-text">{f.name || "Your contracting business"}</h2>
          {f.market && <div className="text-sm text-muted">{f.market}</div>}
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink-text"><ArrowLeft size={14} /> Adjust numbers</button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-copper-soft" />
        <p className="text-[13px] leading-relaxed text-ink-text-soft">
          A 60-second read from a few averages. <span className="text-health-green">Lit tiles</span> are driven by what you entered; <span className="text-muted">faded tiles</span> need job-level data the full account connects. Tap any <Info size={12} className="inline" /> to see what a number means.
        </p>
      </div>

      <LeverCallout lever={r.biggestLever} />

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <AuraTile aura={aura} pending={auraPending} name={f.name} />
        <JobMarginTile r={r} />
        <BacklogTile r={r} />
        <CashGapTile r={r} />
        <BreakEvenTile r={r} />
        <BenchmarksTile r={r} />
        <ProfitFirstTile r={r} />
        <CashFlowTile r={r} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted"><Lock size={12} /> Deeper diagnostics outside this quick estimate</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CONTRACTOR_LOCKED_TILES.map((t) => (
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

      <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5 text-center">
        <div className="font-display text-xl text-ink-text">Want the per-job picture?</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">The full account adds per-job profitability, change-order leakage, WIP, and AR aging — no connection needed to explore first.</p>
        <SignUpButton forceRedirectUrl="/onboarding">
          <button type="button" className="mt-4 inline-block rounded-lg bg-copper px-5 py-2.5 font-medium text-ink transition hover:bg-copper-soft">Get started</button>
        </SignUpButton>
        <span className="mt-3 block text-[11px] text-muted">
          Prefer to look around first? <a href="/demo/tour/contractor" className="text-copper-soft hover:text-copper">Open the sample contractor dashboard</a>
        </span>
      </div>
    </div>
  );
}

// ---- Tiles -----------------------------------------------------------------

const YOURS = "Based on your numbers";

function LeverCallout({ lever }: { lever: ContractorEstimateResult["biggestLever"] }) {
  const Icon = HEALTH_ICON[lever.tone];
  const ring = lever.tone === "red" ? "border-health-red/40 bg-health-red/5" : lever.tone === "yellow" ? "border-health-yellow/35 bg-health-yellow/5" : "border-health-green/35 bg-health-green/5";
  return (
    <div className={"mt-5 rounded-xl border px-4 py-4 " + ring}>
      <div className="flex items-start gap-2.5">
        <Icon size={18} className={"mt-0.5 shrink-0 " + HEALTH_TEXT[lever.tone]} aria-hidden />
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">Biggest lever right now</div>
          <div className={"mt-0.5 font-display text-lg " + HEALTH_TEXT[lever.tone]}>{lever.title}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-text-soft">{lever.detail}</p>
        </div>
      </div>
    </div>
  );
}

function Tile({ title, icon, badge, explainer, children }: {
  title: string; icon: React.ReactNode; badge?: string; explainer?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">{icon} {title}</div>
        <div className="flex items-center gap-2">
          {badge && <span className="rounded-full border border-health-green/30 bg-health-green/10 px-2 py-0.5 text-[10px] text-health-green">{badge}</span>}
          {explainer && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`What ${title} means`} className="rounded-full text-muted hover:text-copper-soft">
              <Info size={13} />
            </button>
          )}
        </div>
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

function AuraTile({ aura, pending, name }: { aura: ReputationResult | null; pending: boolean; name: string }) {
  return (
    <Tile title="Reputation" icon={<Star size={12} className="text-copper-soft" />} badge={aura?.found ? "Live from Google" : undefined} explainer={EXPLAIN.aura}>
      {pending && <div className="text-sm text-muted">Looking up {name || "your business"} on Google…</div>}
      {!pending && aura?.found && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-4xl text-ink-text">{aura.rating?.toFixed(1)}</span>
            <Stars rating={aura.rating ?? 0} />
          </div>
          <div className="mt-1 text-sm text-muted">{aura.reviewCount.toLocaleString()} Google reviews</div>
          {aura.matchedName && <div className="mt-2 text-[11px] text-muted/80">Matched: {aura.matchedName}{aura.matchedAddress ? ` · ${aura.matchedAddress}` : ""}</div>}
        </div>
      )}
      {!pending && aura && !aura.found && <div className="text-sm text-muted">We couldn&apos;t auto-match a Google listing. In the full account, review sources fill this alongside the money read.</div>}
      {!pending && !aura && <div className="text-sm text-muted">Add a company name above to try a live Google rating match.</div>}
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

function JobMarginTile({ r }: { r: ContractorEstimateResult }) {
  return (
    <Tile title="Job margin" icon={<Gauge size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.jobmargin}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.jobMarginHealth]}>{pct(r.jobMarginPct)}</span>
        <span className="text-sm text-muted">after job costs</span>
      </div>
      <HealthSignal status={r.jobMarginHealth} label={word(r.jobMarginHealth, "Healthy", "Thin", "Low")} detail={`${money(r.monthlyRevenue - r.jobCost)}/mo to overhead · typical 30–45%`} className="mt-2" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Materials" value={pct(r.materialsPct, 0)} />
        <Stat label="Labor" value={pct(r.laborPct, 0)} />
        <Stat label="Subs" value={pct(r.subsPct, 0)} />
      </div>
    </Tile>
  );
}

function BacklogTile({ r }: { r: ContractorEstimateResult }) {
  return (
    <Tile title="Backlog coverage" icon={<CalendarClock size={12} className="text-copper-soft" />} badge={r.hasBacklog ? YOURS : undefined} explainer={EXPLAIN.backlog}>
      {r.hasBacklog && r.backlogWeeks != null ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className={"tnum text-4xl " + HEALTH_TEXT[r.backlogHealth]}>{r.backlogWeeks.toFixed(1)}</span>
            <span className="text-sm text-muted">weeks booked</span>
          </div>
          <HealthSignal status={r.backlogHealth} label={word(r.backlogHealth, "Comfortable runway", "Getting short", "Thin pipeline")} detail={`target 8+ weeks of crew capacity`} className="mt-2" />
        </>
      ) : (
        <div className="text-sm text-muted">Add signed backlog and crew capacity to see how many weeks of work are booked.</div>
      )}
    </Tile>
  );
}

function CashGapTile({ r }: { r: ContractorEstimateResult }) {
  return (
    <Tile title="Cash gap" icon={<Wallet size={12} className="text-copper-soft" />} badge={r.hasReceivables ? YOURS : undefined} explainer={EXPLAIN.cashgap}>
      {r.hasReceivables && r.daysToCash != null ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className={"tnum text-4xl " + HEALTH_TEXT[r.cashGapHealth]}>{Math.round(r.daysToCash)}</span>
            <span className="text-sm text-muted">days to cash</span>
          </div>
          <HealthSignal status={r.cashGapHealth} label={word(r.cashGapHealth, "Paid promptly", "Slowing", "Stuck in AR")} detail={`${money(r.openReceivables)} outstanding${r.receivablesOver30 > 0 ? ` · ${money(r.receivablesOver30)} past 30` : ""}`} className="mt-2" />
        </>
      ) : (
        <div className="text-sm text-muted">Add open receivables to see how long your money sits in unpaid invoices.</div>
      )}
    </Tile>
  );
}

function BreakEvenTile({ r }: { r: ContractorEstimateResult }) {
  return (
    <Tile title="Overhead break-even" icon={<Scale size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.breakeven}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-3xl text-ink-text">{r.monthlyBreakEven != null ? money(r.monthlyBreakEven) : "—"}</span>
        <span className="text-sm text-muted">/ mo to cover overhead</span>
      </div>
      <HealthSignal status={r.breakEvenHealth} label={word(r.breakEvenHealth, "Clear cushion", "Thin cushion", "At risk")} detail={`you bill ${money(r.monthlyRevenue)} · ${pct(Math.max(0, r.marginOfSafetyPct), 0)} margin of safety`} className="mt-2" />
      <p className="mt-3 text-[11px] leading-relaxed text-muted">At a {pct(r.jobMarginPct, 0)} job margin you need {r.monthlyBreakEven != null ? money(r.monthlyBreakEven) : "—"} of work a month just to cover overhead. Everything above funds profit and owner pay.</p>
    </Tile>
  );
}

function ZoneBar({ row }: { row: ContractorBenchRow }) {
  const clamp = (v: number) => Math.max(0, Math.min(100, (v / row.scaleMax) * 100));
  const segs: { color: string; width: number }[] = [];
  if (row.lowerIsBetter) {
    const g = clamp(row.greenEdge), y = clamp(row.yellowEdge);
    segs.push({ color: HEALTH_HEX.green, width: g }, { color: HEALTH_HEX.yellow, width: y - g }, { color: HEALTH_HEX.red, width: 100 - y });
  } else {
    const y = clamp(row.yellowEdge), g = clamp(row.greenEdge);
    segs.push({ color: HEALTH_HEX.red, width: y }, { color: HEALTH_HEX.yellow, width: g - y }, { color: HEALTH_HEX.green, width: 100 - g });
  }
  const left = clamp(row.value);
  return (
    <div className="mt-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-text">{row.label}</span>
        <span className={"tnum text-base " + HEALTH_TEXT[row.status]}>{pct(row.value)}</span>
      </div>
      <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink">
        <div className="flex h-full w-full">{segs.map((z, i) => <div key={i} style={{ width: `${z.width}%`, backgroundColor: z.color, opacity: 0.35 }} />)}</div>
      </div>
      <div className="relative h-0"><div className="absolute top-[-11px] h-3 w-0.5 -translate-x-1/2 rounded bg-ink-text" style={{ left: `${left}%` }} /></div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="text-muted">typical {row.typicalLow}–{row.typicalHigh}%</span>
        <span className={HEALTH_TEXT[row.status]}>{row.note}</span>
      </div>
    </div>
  );
}

function BenchmarksTile({ r }: { r: ContractorEstimateResult }) {
  return (
    <Tile title="You vs. typical" icon={<Gauge size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.bench}>
      <div className={"text-2xl " + HEALTH_TEXT[r.benchOverall]}>{BENCH_OVERALL_LABEL[r.benchOverall]}</div>
      <div className="text-[11px] text-muted">{r.benchGreenCount} of {r.bench.length} within range · trades blended</div>
      <div className="mt-3 space-y-3">{r.bench.map((row) => <ZoneBar key={row.key} row={row} />)}</div>
    </Tile>
  );
}

function ProfitFirstTile({ r }: { r: ContractorEstimateResult }) {
  return (
    <Tile title="Profit First set-asides" icon={<PiggyBank size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.pf}>
      <p className="text-[11px] text-muted">A monthly starting point to set aside before the business spends a cent:</p>
      <div className="mt-3 space-y-2">
        {r.pf.map((p) => (
          <div key={p.key} className="flex items-center justify-between rounded-lg border border-line bg-ink/50 px-3 py-2">
            <span className="text-sm text-ink-text">{p.label} <span className="text-muted">({p.pct}%)</span></span>
            <span className="tnum text-base text-copper-soft">{money(p.amount)}</span>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function CashFlowTile({ r }: { r: ContractorEstimateResult }) {
  return (
    <Tile title="Cash flow (rough)" icon={<Wallet size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.cash}>
      <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
        <div><div className="text-[11px] text-muted">In / mo</div><div className="tnum text-base text-ink-text">{money(r.cashIn)}</div></div>
        <div><div className="text-[11px] text-muted">Out / mo</div><div className="tnum text-base text-ink-text">{money(r.cashOut)}</div></div>
        <div><div className="text-[11px] text-muted">Left / mo</div><div className={"tnum text-base " + (r.cashLeft >= 0 ? "text-health-green" : "text-health-red")}>{money(r.cashLeft)}</div></div>
      </div>
      <p className="mt-3 text-[11px] text-muted">Job costs + overhead out; before owner draws, taxes, and debt service.</p>
    </Tile>
  );
}

// ---- Form primitives -------------------------------------------------------

const inputCls = "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-ink-text placeholder:text-muted/50 outline-none focus:border-copper-soft tnum";
const selectCls = "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-ink-text outline-none focus:border-copper-soft";

function Legend({ n, title, hint }: { n: string; title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-copper-dim/40 text-[11px] text-copper-soft">{n}</span>
      <span className="text-sm font-medium text-ink-text">{title}</span>
      <span className="text-[11px] text-muted">· {hint}</span>
    </div>
  );
}

function Field({ label, children, required, prefix, hint }: {
  label: string; children: React.ReactNode; required?: boolean; prefix?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}{required && <span className="text-copper-soft"> *</span>}{hint && <span className="block text-[10px] text-muted/80">{hint}</span>}</span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>}
        {children}
      </span>
    </label>
  );
}
