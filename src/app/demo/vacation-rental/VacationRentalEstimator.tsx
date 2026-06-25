"use client";

import type React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { SignUpButton } from "@clerk/nextjs";
import { ArrowLeft, Gauge, Home, Info, Lock, PiggyBank, Scale, Sparkles, Star, Wallet } from "lucide-react";
import {
  computeVacationRentalEstimate,
  VR_LOCKED_TILES,
  type AdrBasis,
  type Season,
  type VacationRentalEstimateInputs,
  type VacationRentalEstimateResult,
  type VacationRentalPms,
  type VrBenchRow,
} from "@/lib/demo/vacation-rental-estimate";
import type { Health } from "@/lib/demo/estimate";
import { HealthSignal } from "@/components/health/HealthSignal";
import { money, pct } from "@/lib/format";
import { lookupReputation, type ReputationResult } from "../actions";

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};
const HEALTH_HEX: Record<Health, string> = { green: "#5FA777", yellow: "#D9A35E", red: "#C8643A" };
const BENCH_OVERALL_LABEL: Record<Health, string> = { green: "On benchmark", yellow: "Watch a few", red: "Off benchmark" };

// Plain-language explainers — every tile teaches what it shows (Principle #2).
const EXPLAIN = {
  aura:
    "Your public guest rating, pulled live from Google. It is the outside-world signal that drives bookings: higher ratings lift search ranking and let you hold rate. We weight it next to the money read because demand and pricing power start with reputation.",
  revpar:
    "RevPAR = Revenue Per Available Rental night = your nightly rate multiplied by how full you are. It folds price and occupancy into one number, so a $300 night at 50% full and a $200 night at 75% are revealed as equal ($150 each). It is the cleanest way to compare properties or track a portfolio over time.",
  proceeds:
    "What the owner actually keeps: booking revenue minus the pass-through stack — platform fees, management fee, cleaning, maintenance, and utilities — before your own mortgage. Revenue is vanity; proceeds are reality. Typical short-term-rental range runs 25–40% of bookings.",
  drag:
    "Repairs and upkeep as a share of revenue. A little is healthy; rising drag signals aging units or deferred work quietly turning a property unprofitable. It is the slowest leak to notice — under about 6% is in check.",
  breakeven:
    "The share of nights you would need filled, at your current rate, just to cover costs. Below this line you are subsidizing the property; the gap above it is your margin of safety when the season softens. It turns 'are we okay?' into one number to watch.",
  selfmanage:
    "What your management fee costs in real dollars, and what owner proceeds would be without it. This is not advice to fire your manager — many earn it in occupancy and headaches saved — but you should know the price to judge the trade.",
  pf:
    "A starting split to move into separate buckets before you spend — Profit, Owner Pay, Tax, and a Furnishing/Capex reserve for the refreshes rentals always need. Pay these first so the business runs on what is left, instead of profit being 'whatever is left over' (usually nothing).",
  bench:
    "Where your occupancy, owner proceeds, and maintenance sit against typical short-term-rental ranges. These are static reference figures, not live peer data — guide-rails, not a leaderboard — so read them as 'is this roughly normal?', not a grade.",
  cash:
    "Money in (after platform fees) minus money out (management plus operating costs) for a typical month. A quick read on whether the portfolio breathes; it is before your mortgage, taxes, and owner draws.",
} as const;

const word = (s: Health, g: string, y: string, r: string) => (s === "green" ? g : s === "yellow" ? y : r);

type FormState = Record<
  | "name" | "market" | "pms" | "properties" | "adr" | "occupancy" | "adrBasis" | "season" | "nights"
  | "platformFee" | "managementFee" | "cleaning" | "maintenance" | "utilities" | "fixed",
  string
>;

const INITIAL: FormState = {
  name: "", market: "", pms: "guesty", properties: "", adr: "", occupancy: "",
  adrBasis: "gross", season: "typical", nights: "",
  platformFee: "", managementFee: "", cleaning: "", maintenance: "", utilities: "", fixed: "",
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

function buildInputs(f: FormState): VacationRentalEstimateInputs {
  return {
    name: f.name.trim(),
    market: f.market.trim(),
    pms: (f.pms as VacationRentalPms) || "guesty",
    properties: num(f.properties),
    adr: num(f.adr),
    occupancyPct: num(f.occupancy),
    adrBasis: (f.adrBasis as AdrBasis) || "gross",
    season: (f.season as Season) || "typical",
    nightsPerMonth: optNum(f.nights),
    platformFeePct: optNum(f.platformFee),
    managementFeePct: optNum(f.managementFee),
    cleaningMonthly: optNum(f.cleaning),
    maintenanceMonthly: optNum(f.maintenance),
    utilitiesSuppliesMonthly: optNum(f.utilities),
    monthlyFixedBills: optNum(f.fixed),
  };
}

export function VacationRentalEstimator() {
  const [f, setF] = useState<FormState>(INITIAL);
  const [view, setView] = useState<"form" | "results">("form");
  const [error, setError] = useState<string | null>(null);
  const [aura, setAura] = useState<ReputationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const updText = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo<VacationRentalEstimateResult | null>(
    () => (view === "results" ? computeVacationRentalEstimate(inputs) : null),
    [view, inputs],
  );

  // Prefill from a shared link, e.g. a consultant sends:
  //   /demo/vacation-rental?name=...&properties=6&adr=250&occupancy=70&mgmt=20
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return;
    const map: [string, keyof FormState][] = [
      ["name", "name"], ["market", "market"], ["pms", "pms"], ["properties", "properties"],
      ["adr", "adr"], ["occupancy", "occupancy"], ["basis", "adrBasis"], ["season", "season"],
      ["nights", "nights"], ["platform", "platformFee"], ["mgmt", "managementFee"],
      ["cleaning", "cleaning"], ["maintenance", "maintenance"], ["utilities", "utilities"], ["fixed", "fixed"],
    ];
    const next: Partial<FormState> = {};
    for (const [q, k] of map) { const v = sp.get(q); if (v != null) next[k] = v; }
    if (!Object.keys(next).length) return;
    const seeded = { ...INITIAL, ...next } as FormState;
    setF(seeded);
    const inp = buildInputs(seeded);
    if (inp.properties > 0 && inp.adr > 0 && inp.occupancyPct > 0) {
      setView("results");
      if (inp.name) startTransition(async () => setAura(await lookupReputation(inp.name, inp.market)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const inp = buildInputs(f);
    if (inp.properties <= 0 || inp.adr <= 0 || inp.occupancyPct <= 0) {
      return setError("Add doors, average nightly rate, and occupancy to see the read.");
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
    <form onSubmit={onSubmit} className="mx-auto max-w-xl">
      <p className="text-sm text-muted">Enter a typical month for the portfolio. Doors, rate, and occupancy are enough for the first read.</p>

      <fieldset className="mt-6 space-y-4">
        <Legend n="1" title="Portfolio & demand" hint="The revenue engine: occupancy × ADR × doors" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Group / company name"><input className={inputCls} placeholder="Shoreline Stay Group" value={f.name} onChange={updText("name")} /></Field>
          <Field label="Market"><input className={inputCls} placeholder="York, PA" value={f.market} onChange={updText("market")} /></Field>
        </div>
        <Field label="Property manager / PMS" hint="Tells the demo what would light this up live">
          <select className={selectCls} value={f.pms} onChange={updText("pms")}>
            <option value="guesty">Guesty</option>
            <option value="hostaway">Hostaway</option>
            <option value="ownerrez">OwnerRez</option>
            <option value="hospitable">Hospitable</option>
            <option value="airbnb_vrbo">Airbnb / VRBO direct</option>
            <option value="spreadsheet">Spreadsheet / none</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Properties (doors)" required><input className={inputCls} inputMode="numeric" placeholder="6" value={f.properties} onChange={updText("properties")} /></Field>
          <Field label="Avg nightly rate" required prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="250" value={f.adr} onChange={updText("adr")} /></Field>
          <Field label="Occupancy" required suffix="%"><input className={inputCls + " pr-7"} inputMode="numeric" placeholder="70" value={f.occupancy} onChange={updText("occupancy")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Is that rate gross or net?" hint="Gross = guest pays; net = hits your account">
            <select className={selectCls} value={f.adrBasis} onChange={updText("adrBasis")}>
              <option value="gross">Gross (what the guest pays)</option>
              <option value="net">Net (after platform fee)</option>
            </select>
          </Field>
          <Field label="This month is…" hint="Labels the read; we don't scale your numbers">
            <select className={selectCls} value={f.season} onChange={updText("season")}>
              <option value="typical">Typical</option>
              <option value="peak">Peak</option>
              <option value="slow">Slow</option>
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="The cost stack" hint="What stands between bookings and owner proceeds" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Platform fee (Airbnb/VRBO)" suffix="%"><input className={inputCls + " pr-7"} inputMode="numeric" placeholder="3" value={f.platformFee} onChange={updText("platformFee")} /></Field>
          <Field label="Management fee" suffix="%" hint="0 if you self-manage"><input className={inputCls + " pr-7"} inputMode="numeric" placeholder="20" value={f.managementFee} onChange={updText("managementFee")} /></Field>
          <Field label="Cleaning / turns / mo" prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="4,000" value={f.cleaning} onChange={updText("cleaning")} /></Field>
          <Field label="Maintenance / mo" prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="1,800" value={f.maintenance} onChange={updText("maintenance")} /></Field>
          <Field label="Utilities + supplies / mo" prefix="$"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="1,200" value={f.utilities} onChange={updText("utilities")} /></Field>
          <Field label="Other fixed / mo" prefix="$" hint="Insurance, PMS software — not mortgage"><input className={inputCls + " pl-7"} inputMode="numeric" placeholder="2,500" value={f.fixed} onChange={updText("fixed")} /></Field>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">Owner proceeds are read before your own mortgage or debt, matching how the dashboard frames them. Leave anything blank you do not know — it just widens what stays locked.</p>
      </fieldset>

      {error && <p className="mt-5 text-sm text-health-red">{error}</p>}

      <button type="submit" className="mt-7 w-full rounded-lg bg-copper px-5 py-3 font-medium text-ink transition hover:bg-copper-soft">
        See my estimate →
      </button>
      <p className="mt-3 text-center text-[11px] text-muted">Nothing is saved. A quick estimate, not a full diagnosis.</p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function Results({ f, r, aura, auraPending, onEdit }: {
  f: FormState; r: VacationRentalEstimateResult; aura: ReputationResult | null; auraPending: boolean; onEdit: () => void;
}) {
  const seasonNote = r.season === "peak" ? "You marked this a peak month — annual proceeds will run lower." : r.season === "slow" ? "You marked this a slow month — annual proceeds will run higher." : null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Instant estimate</div>
          <h2 className="font-display text-3xl text-ink-text">{f.name || "Your rental portfolio"}</h2>
          <div className="text-sm text-muted">{r.properties} {r.properties === 1 ? "property" : "properties"}{f.market ? ` · ${f.market}` : ""}</div>
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink-text"><ArrowLeft size={14} /> Adjust numbers</button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-copper-soft" />
        <p className="text-[13px] leading-relaxed text-ink-text-soft">
          A 60-second read from a few averages. <span className="text-health-green">Lit tiles</span> are driven by what you entered; <span className="text-muted">faded tiles</span> need per-property and channel data the full account connects. Tap any{" "}
          <Info size={12} className="inline" /> to see what a number means.
          {seasonNote && <span className="mt-1 block text-muted">{seasonNote}</span>}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <AuraTile aura={aura} pending={auraPending} name={f.name} />
        <BookingPaceTile r={r} />
        <OwnerProceedsTile r={r} />
        <MaintenanceTile r={r} />
        <BreakEvenTile r={r} />
        {r.managed && <SelfManageTile r={r} />}
        <BenchmarksTile r={r} />
        <ProfitFirstTile r={r} />
        <CashFlowTile r={r} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted"><Lock size={12} /> Deeper diagnostics outside this quick estimate</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {VR_LOCKED_TILES.map((t) => (
            <div key={t.key} className="rounded-lg border border-line bg-surface/40 px-3 py-3 opacity-60">
              <div className="flex items-center gap-1.5 text-sm text-muted"><Lock size={12} /> {t.label}</div>
              <div className="mt-1 text-[11px] text-muted/80">needs {t.needs}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-surface px-4 py-3 text-[11px] leading-relaxed text-muted">
        Source pipe: <span className="text-ink-text">{r.pmsLabel}</span>. {r.pmsNote}
      </div>

      <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5 text-center">
        <div className="font-display text-xl text-ink-text">Want the per-property picture?</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">The full account adds per-door P&L, channel mix, pricing gaps, and owner statements — no connection needed to explore first.</p>
        <SignUpButton forceRedirectUrl="/onboarding">
          <button type="button" className="mt-4 inline-block rounded-lg bg-copper px-5 py-2.5 font-medium text-ink transition hover:bg-copper-soft">Get started</button>
        </SignUpButton>
        <span className="mt-3 block text-[11px] text-muted">
          Prefer to look around first? <a href="/demo/tour/vacation-rental" className="text-copper-soft hover:text-copper">Open the sample rental dashboard</a>
        </span>
      </div>
    </div>
  );
}

// ---- Tiles -----------------------------------------------------------------

const YOURS = "Based on your numbers";

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
    <Tile title="Guest Aura" icon={<Star size={12} className="text-copper-soft" />} badge={aura?.found ? "Live from Google" : undefined} explainer={EXPLAIN.aura}>
      {pending && <div className="text-sm text-muted">Looking up {name || "your listing"} on Google…</div>}
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
      {!pending && aura && !aura.found && <div className="text-sm text-muted">We couldn&apos;t auto-match a Google listing. In the full account, guest-review sources fill this alongside the money read.</div>}
      {!pending && !aura && <div className="text-sm text-muted">Add a name above to try a live Google rating match.</div>}
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

function BookingPaceTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="Booking pace · RevPAR" icon={<Gauge size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.revpar}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.occupancyHealth]}>{money(r.revPar)}</span>
        <span className="text-sm text-muted">RevPAR / night</span>
      </div>
      <HealthSignal status={r.occupancyHealth} label={word(r.occupancyHealth, "Strong demand", "Soft", "Low")} detail={`${pct(r.occupancyPct, 0)} occupancy · ${money(r.adrGross)} ADR`} className="mt-2" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Booked nights / mo" value={Math.round(r.bookedNightsPerMonth).toLocaleString()} />
        <Stat label="Gross bookings / mo" value={money(r.grossBookingRevenue)} />
      </div>
    </Tile>
  );
}

function OwnerProceedsTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="Owner proceeds" icon={<Home size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.proceeds}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.ownerProceedsHealth]}>{pct(r.ownerProceedsPct)}</span>
        <span className="text-sm text-muted">of bookings kept</span>
      </div>
      <HealthSignal status={r.ownerProceedsHealth} label={word(r.ownerProceedsHealth, "Healthy", "Thin", "Low")} detail={`${money(r.ownerProceeds)}/mo · typical 25–40%`} className="mt-2" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Per property / mo" value={money(r.ownerProceedsPerProperty)} />
        <Stat label="After platform fee" value={money(r.revenueAfterPlatform)} />
      </div>
    </Tile>
  );
}

function MaintenanceTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="Maintenance drag" icon={<Scale size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.drag}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.maintenanceHealth]}>{pct(r.maintenanceDragPct, 1)}</span>
        <span className="text-sm text-muted">of revenue</span>
      </div>
      <HealthSignal status={r.maintenanceHealth} label={word(r.maintenanceHealth, "In check", "Creeping", "High")} detail={`${money(r.maintenance)}/mo on upkeep · target ≤ 6%`} className="mt-2" />
    </Tile>
  );
}

function BreakEvenTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="Break-even occupancy" icon={<Wallet size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.breakeven}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-4xl text-ink-text">{r.breakEvenOccupancyPct != null ? pct(r.breakEvenOccupancyPct, 0) : "—"}</span>
        <span className="text-sm text-muted">full to cover costs</span>
      </div>
      <HealthSignal status={r.breakEvenHealth} label={word(r.breakEvenHealth, "Safe cushion", "Thin cushion", "At risk")} detail={`you run ${pct(r.occupancyPct, 0)} · ${pct(Math.max(0, r.marginOfSafetyPct), 0)} margin of safety`} className="mt-2" />
      <p className="mt-3 text-[11px] leading-relaxed text-muted">At {money(r.adrGross)} ADR you cover costs once {r.breakEvenOccupancyPct != null ? pct(r.breakEvenOccupancyPct, 0) : "—"} of nights are booked. Everything above that funds profit and owner pay.</p>
    </Tile>
  );
}

function SelfManageTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="Self-managed vs. managed" icon={<PiggyBank size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.selfmanage}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-3xl text-copper-soft">{money(r.managementFeeMonthlyCost)}</span>
        <span className="text-sm text-muted">/ mo management fee</span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-text-soft">
        Self-managing would lift owner proceeds from <span className={"tnum " + HEALTH_TEXT[r.ownerProceedsHealth]}>{pct(r.ownerProceedsPct, 0)}</span> to{" "}
        <span className="tnum text-health-green">{pct(r.selfManagedOwnerProceedsPct, 0)}</span> — about <span className="tnum text-ink-text">{money(r.managementFeeMonthlyCost * 12)}</span> a year. Worth it only if your manager earns it back in occupancy.
      </p>
    </Tile>
  );
}

function ZoneBar({ row }: { row: VrBenchRow }) {
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

function BenchmarksTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="You vs. typical" icon={<Gauge size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.bench}>
      <div className={"text-2xl " + HEALTH_TEXT[r.benchOverall]}>{BENCH_OVERALL_LABEL[r.benchOverall]}</div>
      <div className="text-[11px] text-muted">{r.benchGreenCount} of {r.bench.length} within range · short-term rental</div>
      <div className="mt-3 space-y-3">{r.bench.map((row) => <ZoneBar key={row.key} row={row} />)}</div>
    </Tile>
  );
}

function ProfitFirstTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="Profit First set-asides" icon={<PiggyBank size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.pf}>
      <p className="text-[11px] text-muted">A monthly starting point to set aside from collected rent before spending:</p>
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

function CashFlowTile({ r }: { r: VacationRentalEstimateResult }) {
  return (
    <Tile title="Cash flow (rough)" icon={<Wallet size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.cash}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><div className="text-[11px] text-muted">In / mo</div><div className="tnum text-base text-ink-text">{money(r.cashIn)}</div></div>
        <div><div className="text-[11px] text-muted">Out / mo</div><div className="tnum text-base text-ink-text">{money(r.cashOut)}</div></div>
        <div><div className="text-[11px] text-muted">Left / mo</div><div className={"tnum text-base " + (r.cashLeft >= 0 ? "text-health-green" : "text-health-red")}>{money(r.cashLeft)}</div></div>
      </div>
      <p className="mt-3 text-[11px] text-muted">After platform fees; before mortgage, taxes, and owner draws.</p>
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

function Field({ label, children, required, prefix, suffix, hint }: {
  label: string; children: React.ReactNode; required?: boolean; prefix?: string; suffix?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}{required && <span className="text-copper-soft"> *</span>}{hint && <span className="block text-[10px] text-muted/80">{hint}</span>}</span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>}
        {children}
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
