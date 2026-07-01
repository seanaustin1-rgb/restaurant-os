"use client";

import type React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { SignUpButton } from "@clerk/nextjs";
import {
  ArrowLeft,
  Gauge,
  Info,
  Lock,
  PiggyBank,
  Scale,
  Sparkles,
  Star,
  Utensils,
  Wallet,
} from "lucide-react";
import { HealthSignal } from "@/components/health/HealthSignal";
import {
  computeEstimate,
  LOCKED_TILES,
  type BenchRow,
  type EstimateInputs,
  type EstimateResult,
  type Health,
} from "@/lib/demo/estimate";
import { money, pct } from "@/lib/format";
import { lookupReputation, type ReputationResult } from "./actions";
import { DemoModulePreview } from "./DemoModulePreview";

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};
const HEALTH_HEX: Record<Health, string> = {
  green: "#5FA777",
  yellow: "#D9A35E",
  red: "#C8643A",
};
const BENCH_OVERALL_LABEL: Record<Health, string> = {
  green: "On benchmark",
  yellow: "Watch a few",
  red: "Off benchmark",
};

const word = (s: Health, g: string, y: string, r: string) => (s === "green" ? g : s === "yellow" ? y : r);

const EXPLAIN = {
  aura:
    "Your public guest rating, pulled live from Google. It is the outside-world signal that drives bookings — a strong rating lifts search ranking and lets you hold price. We read it next to the money because demand starts with reputation.",
  bench:
    "Where your prime cost, COGS, labor, and net margin sit against typical full-service ranges. Static reference figures, not live peer data — guide-rails, not a grade.",
  prime:
    "Prime cost = food + beverage + labor as a share of sales. It is the restaurant's master number, the biggest controllable cost. Full-service typically aims for 60% or below; above that, profit gets very hard.",
  breakeven:
    "The weekly sales you need just to cover variable costs plus the fixed bills you entered. Below it you lose money; the cushion above is what funds profit and owner pay.",
  pf:
    "A weekly starting split to set aside before you spend — Profit, Owner Pay, and Tax. Pay these first so profit is not 'whatever is left' (usually nothing).",
  cash:
    "Money in minus money out for a rough month. A quick read on whether the business breathes; before owner pay, taxes, and debt service.",
  mix:
    "How sales split between food/kitchen and bar/beverage. Beverage usually carries a higher margin, so the mix shifts your blended profitability.",
  covers:
    "Guests served. Covers per day and average check translate revenue into floor reality — how many tables you actually turn.",
} as const;

type FormState = Record<
  | "name" | "city" | "weeklySales" | "weeklyLabor" | "weeklyFood" | "weeklyAlcohol"
  | "monthlyRent" | "monthlyUtilities" | "monthlyInsurance" | "monthlyDebt" | "monthlySoftware" | "monthlyOtherFixed"
  | "avgCheck" | "seats" | "daysOpenPerWeek",
  string
>;

const INITIAL: FormState = {
  name: "", city: "", weeklySales: "", weeklyLabor: "", weeklyFood: "", weeklyAlcohol: "",
  monthlyRent: "", monthlyUtilities: "", monthlyInsurance: "", monthlyDebt: "", monthlySoftware: "", monthlyOtherFixed: "",
  avgCheck: "", seats: "", daysOpenPerWeek: "",
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

function buildInputs(f: FormState): EstimateInputs {
  const weeklySales = num(f.weeklySales);
  const weeklyLabor = num(f.weeklyLabor);
  const weeklyFood = num(f.weeklyFood);
  const weeklyAlcohol = num(f.weeklyAlcohol);
  const weeklyCogs = weeklyFood + weeklyAlcohol;
  const foodPct = weeklySales > 0 && weeklyCogs > 0 ? (weeklyCogs / weeklySales) * 100 : 30;
  const laborPct = weeklySales > 0 && weeklyLabor > 0 ? (weeklyLabor / weeklySales) * 100 : 30;
  const bevSharePct = weeklyCogs > 0 && weeklyAlcohol > 0 ? (weeklyAlcohol / weeklyCogs) * 100 : null;
  const fixedCosts =
    num(f.monthlyRent) +
    num(f.monthlyUtilities) +
    num(f.monthlyInsurance) +
    num(f.monthlyDebt) +
    num(f.monthlySoftware) +
    num(f.monthlyOtherFixed);

  return {
    name: f.name.trim(),
    city: f.city.trim(),
    monthlySales: weeklySales * 4.33,
    foodPct,
    laborPct,
    fixedCosts,
    bevSharePct,
    avgCheck: optNum(f.avgCheck),
    seats: optNum(f.seats),
    daysOpenPerWeek: optNum(f.daysOpenPerWeek),
  };
}

export function DemoEstimator() {
  const [f, setF] = useState<FormState>(INITIAL);
  const [view, setView] = useState<"form" | "results">("form");
  const [showOptional, setShowOptional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aura, setAura] = useState<ReputationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo<EstimateResult | null>(
    () => (view === "results" ? computeEstimate(inputs) : null),
    [view, inputs],
  );

  // Prefill from query params, e.g. a shareable link a rep sends a prospect:
  //   /demo?name=...&city=...&weeklySales=60000&weeklyLabor=18000&weeklyFood=12000&weeklyAlcohol=5000&rent=12000
  // When sales are present, jump straight to the populated results. Name/city
  // only improve the optional reputation lookup.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return;
    const map: [string, keyof FormState][] = [
      ["name", "name"], ["city", "city"], ["weeklySales", "weeklySales"], ["weeklyLabor", "weeklyLabor"],
      ["weeklyFood", "weeklyFood"], ["weeklyAlcohol", "weeklyAlcohol"], ["rent", "monthlyRent"],
      ["utilities", "monthlyUtilities"], ["insurance", "monthlyInsurance"], ["debt", "monthlyDebt"],
      ["software", "monthlySoftware"], ["otherFixed", "monthlyOtherFixed"],
      ["check", "avgCheck"], ["days", "daysOpenPerWeek"], ["seats", "seats"],
    ];
    const next: Partial<FormState> = {};
    for (const [q, k] of map) { const v = sp.get(q); if (v != null) next[k] = v; }
    if (!Object.keys(next).length) return;
    if (!next.weeklySales && sp.get("sales")) next.weeklySales = String(Math.round(num(sp.get("sales") ?? "") / 4.33));
    if (!next.weeklyLabor && sp.get("labor") && next.weeklySales) {
      next.weeklyLabor = String(Math.round((num(next.weeklySales) * num(sp.get("labor") ?? "")) / 100));
    }
    if (!next.weeklyFood && sp.get("food") && next.weeklySales) {
      next.weeklyFood = String(Math.round((num(next.weeklySales) * num(sp.get("food") ?? "")) / 100));
    }
    if (!next.monthlyOtherFixed && sp.get("overhead")) next.monthlyOtherFixed = sp.get("overhead") ?? "";
    if (!next.monthlyOtherFixed && sp.get("fixed")) next.monthlyOtherFixed = sp.get("fixed") ?? "";
    const seeded = { ...INITIAL, ...next } as FormState;
    setF(seeded);
    const inp = buildInputs(seeded);
    if (inp.monthlySales > 0) {
      setView("results");
      if (inp.name) startTransition(async () => setAura(await lookupReputation(inp.name, inp.city)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const inp = buildInputs(f);
    if (inp.monthlySales <= 0) return setError("Add your average weekly sales.");
    setError(null);
    setView("results");
    setAura(null);
    if (inp.name) {
      startTransition(async () => {
        const r = await lookupReputation(inp.name, inp.city);
        setAura(r);
      });
    }
  }

  if (view === "results" && result) {
    return (
      <Results
        f={f}
        r={result}
        aura={aura}
        auraPending={pending}
        onEdit={() => setView("form")}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl">
      <p className="text-sm text-muted">
        Enter the rough weekly numbers you already know. Ballparks are fine.
      </p>

      {/* Tier A — identity */}
      <fieldset className="mt-6 space-y-4">
        <Legend n="1" title="Optional identity" hint="Only used to try a live Google rating match" />
        <Field label="Restaurant name">
          <input className={inputCls} placeholder="Stone Grille & Taphouse" value={f.name} onChange={upd("name")} />
        </Field>
        <Field label="City & state">
          <input className={inputCls} placeholder="York, PA" value={f.city} onChange={upd("city")} />
        </Field>
      </fieldset>

      {/* Tier B — core economics */}
      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="Known weekly numbers" hint="Sales plus major weekly spend gives the clearest feedback" />
        <Field label="Average weekly sales" required prefix="$">
          <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="60,000" value={f.weeklySales} onChange={upd("weeklySales")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Weekly labor" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="18,000" value={f.weeklyLabor} onChange={upd("weeklyLabor")} />
          </Field>
          <Field label="Weekly food" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="12,000" value={f.weeklyFood} onChange={upd("weeklyFood")} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Weekly alcohol / beverage" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="5,000" value={f.weeklyAlcohol} onChange={upd("weeklyAlcohol")} />
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          Weekly sales plus labor, food, and beverage spend gives the first pressure read. Add fixed bills below for break-even.
        </p>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="3" title="Monthly fixed bills" hint="Use the bills you know; leave the rest blank" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rent / lease" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="12,000" value={f.monthlyRent} onChange={upd("monthlyRent")} />
          </Field>
          <Field label="Utilities" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="3,500" value={f.monthlyUtilities} onChange={upd("monthlyUtilities")} />
          </Field>
          <Field label="Insurance" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="2,000" value={f.monthlyInsurance} onChange={upd("monthlyInsurance")} />
          </Field>
          <Field label="Debt / loan payments" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="6,000" value={f.monthlyDebt} onChange={upd("monthlyDebt")} />
          </Field>
          <Field label="Software / services" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="1,500" value={f.monthlySoftware} onChange={upd("monthlySoftware")} />
          </Field>
          <Field label="Other fixed bills" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="10,000" value={f.monthlyOtherFixed} onChange={upd("monthlyOtherFixed")} />
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          These are monthly numbers. The demo converts them to a weekly target for break-even and cash flow.
        </p>
      </fieldset>

      {/* Tier C — optional */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowOptional((s) => !s)}
          className="text-sm text-copper-soft hover:text-copper"
        >
          {showOptional ? "– Hide" : "+ Add covers detail"} <span className="text-muted">(optional)</span>
        </button>
        {showOptional && (
          <fieldset className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Average check" prefix="$">
              <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="32" value={f.avgCheck} onChange={upd("avgCheck")} />
            </Field>
            <Field label="Days open / week">
              <input className={inputCls} inputMode="numeric" placeholder="7" value={f.daysOpenPerWeek} onChange={upd("daysOpenPerWeek")} />
            </Field>
            <Field label="Seats">
              <input className={inputCls} inputMode="numeric" placeholder="120" value={f.seats} onChange={upd("seats")} />
            </Field>
          </fieldset>
        )}
      </div>

      {error && <p className="mt-5 text-sm text-health-red">{error}</p>}

      <button
        type="submit"
        className="mt-7 w-full rounded-lg bg-copper px-5 py-3 font-medium text-ink transition hover:bg-copper-soft"
      >
        See my estimate →
      </button>
      <p className="mt-3 text-center text-[11px] text-muted">
        Nothing is saved. This is a quick estimate, not a full diagnosis.
      </p>
    </form>
  );
}

// ----------------------------------------------------------------------------
// Results
// ----------------------------------------------------------------------------

function Results({
  f, r, aura, auraPending, onEdit,
}: {
  f: FormState;
  r: EstimateResult;
  aura: ReputationResult | null;
  auraPending: boolean;
  onEdit: () => void;
}) {
  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Instant estimate</div>
          <h2 className="font-display text-3xl text-ink-text">{f.name || "Your restaurant"}</h2>
          {f.city && <div className="text-sm text-muted">{f.city}</div>}
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink-text">
          <ArrowLeft size={14} /> Adjust numbers
        </button>
      </div>

      {/* Honesty banner */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-copper-soft" />
        <p className="text-[13px] leading-relaxed text-ink-text-soft">
          This is a 60-second estimate from a handful of numbers — a taste, not a diagnosis. The{" "}
          <span className="text-health-green">highlighted tiles</span> are driven by what you entered. The{" "}
          <span className="text-muted">faded tiles</span> are intentionally left out of this quick demo because they need deeper detail.
        </p>
      </div>

      {/* Lit tiles */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <AuraTile aura={aura} pending={auraPending} name={f.name} />
        <BenchmarksTile r={r} />
        <PrimeCostTile r={r} />
        <BreakEvenTile r={r} />
        <ProfitFirstTile r={r} />
        <CashFlowTile r={r} />
        {r.salesMix && <SalesMixTile r={r} />}
        {r.covers && <CoversTile r={r} />}
      </div>

      {/* Locked tiles */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <Lock size={12} /> Deeper diagnostics outside this quick estimate
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {LOCKED_TILES.map((t) => (
            <div key={t.key} className="rounded-lg border border-line bg-surface/40 px-3 py-3 opacity-60">
              <div className="flex items-center gap-1.5 text-sm text-muted">
                <Lock size={12} /> {t.label}
              </div>
              <div className="mt-1 text-[11px] text-muted/70">needs {t.needs}</div>
            </div>
          ))}
        </div>
      </div>

      <DemoModulePreview businessType="RESTAURANT" />

      {/* CTA */}
      <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-5 text-center">
        <div className="font-display text-xl text-ink-text">Want the full picture?</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          The full account adds leak detection, cash runway, vendor spend, and more. No connection is needed to explore the demo first.
        </p>
        <SignUpButton forceRedirectUrl="/onboarding">
          <button
            type="button"
            className="mt-4 inline-block rounded-lg bg-copper px-5 py-2.5 font-medium text-ink transition hover:bg-copper-soft"
          >
            Get started
          </button>
        </SignUpButton>
        <span className="mt-3 block text-[11px] text-muted">
          Prefer to look around first?{" "}
          <a href="/demo/tour/restaurant" className="text-copper-soft hover:text-copper">
            Open the sample restaurant dashboard
          </a>
        </span>
      </div>
    </div>
  );
}

// ---- Lit tiles -------------------------------------------------------------

function Tile({
  title, icon, badge, explainer, children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  explainer?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          {icon} {title}
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full border border-health-green/30 bg-health-green/10 px-2 py-0.5 text-[10px] text-health-green">
              {badge}
            </span>
          )}
          {explainer && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`What ${title} means`} className="rounded-full text-muted hover:text-copper-soft focus-visible:text-copper-soft focus-visible:outline-none">
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

const YOURS = "Based on your numbers";
const WEEKS_PER_MONTH = 4.33;
const clampPct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));

function AuraTile({ aura, pending, name }: { aura: ReputationResult | null; pending: boolean; name: string }) {
  return (
    <Tile title="Reputation (Aura)" icon={<Star size={12} className="text-copper-soft" />} badge={aura?.found ? "Live from Google" : undefined} explainer={EXPLAIN.aura}>
      {pending && <div className="text-sm text-muted">Looking up {name || "your restaurant"} on Google…</div>}
      {!pending && aura?.found && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-4xl text-ink-text">{aura.rating?.toFixed(1)}</span>
            <Stars rating={aura.rating ?? 0} />
          </div>
          <div className="mt-1 text-sm text-muted">
            {aura.reviewCount.toLocaleString()} Google reviews
          </div>
          {aura.matchedName && (
            <div className="mt-2 text-[11px] text-muted/80">Matched: {aura.matchedName}{aura.matchedAddress ? ` · ${aura.matchedAddress}` : ""}</div>
          )}
        </div>
      )}
      {!pending && aura && !aura.found && (
        <div className="text-sm text-muted">
          We couldn&apos;t auto-match your Google listing. In the full account, reputation sources can fill this in
          alongside the financial read.
        </div>
      )}
      {!pending && !aura && <div className="text-sm text-muted">Reputation lookup queued…</div>}
    </Tile>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={16}
          className={i <= Math.round(rating) ? "text-copper-soft" : "text-line"}
          fill={i <= Math.round(rating) ? "#D9A35E" : "none"}
        />
      ))}
    </span>
  );
}

function ZoneBar({ row }: { row: BenchRow }) {
  const segs: { color: string; width: number }[] = [];
  const toPct = (v: number) => clampPct(v, row.scaleMax);
  if (row.lowerIsBetter) {
    const g = toPct(row.greenEdge);
    const y = toPct(row.yellowEdge);
    segs.push({ color: HEALTH_HEX.green, width: g });
    segs.push({ color: HEALTH_HEX.yellow, width: y - g });
    segs.push({ color: HEALTH_HEX.red, width: 100 - y });
  } else {
    const y = toPct(row.yellowEdge);
    const g = toPct(row.greenEdge);
    segs.push({ color: HEALTH_HEX.red, width: y });
    segs.push({ color: HEALTH_HEX.yellow, width: g - y });
    segs.push({ color: HEALTH_HEX.green, width: 100 - g });
  }
  const left = clampPct(row.value, row.scaleMax);
  return (
    <div className="mt-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-text">{row.label}</span>
        <span className={"tnum text-base " + HEALTH_TEXT[row.status]}>{pct(row.value)}</span>
      </div>
      <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink">
        <div className="flex h-full w-full">
          {segs.map((z, i) => (
            <div key={i} style={{ width: `${z.width}%`, backgroundColor: z.color, opacity: 0.35 }} />
          ))}
        </div>
      </div>
      <div className="relative h-0">
        <div className="absolute top-[-11px] h-3 w-0.5 -translate-x-1/2 rounded bg-ink-text" style={{ left: `${left}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="text-muted">typical {row.typicalLow}–{row.typicalHigh}%</span>
        <span className={HEALTH_TEXT[row.status]}>{row.note}</span>
      </div>
    </div>
  );
}

function BenchmarksTile({ r }: { r: EstimateResult }) {
  return (
    <Tile title="You vs. industry" icon={<Gauge size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.bench}>
      <div className={"text-2xl " + HEALTH_TEXT[r.benchOverall]}>{BENCH_OVERALL_LABEL[r.benchOverall]}</div>
      <div className="text-[11px] text-muted">{r.benchGreenCount} of {r.bench.length} within range · full-service / casual dining</div>
      <div className="mt-3 space-y-3">
        {r.bench.map((row) => <ZoneBar key={row.key} row={row} />)}
      </div>
    </Tile>
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

function PrimeCostTile({ r }: { r: EstimateResult }) {
  const weeklyCogs = r.cogs / WEEKS_PER_MONTH;
  const weeklyLabor = r.labor / WEEKS_PER_MONTH;

  return (
    <Tile title="Prime cost" icon={<Scale size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.prime}>
      <div className="flex items-baseline gap-2">
        <span className={"tnum text-4xl " + HEALTH_TEXT[r.primeHealth]}>{pct(r.primeCostPct)}</span>
        <span className="text-sm text-muted">of sales</span>
      </div>
      <HealthSignal
        status={r.primeHealth}
        label={word(r.primeHealth, "On track", "Watch", "Over")}
        detail={Math.abs(r.primeCostPct - 60) < 0.5 ? "right at ≤60% target" : `${Math.abs(r.primeCostPct - 60).toFixed(1)} pts ${r.primeCostPct > 60 ? "over" : "under"} ≤60%`}
        className="mt-2"
      />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Food + bev / week" value={money(weeklyCogs)} />
        <Stat label="Labor / week" value={money(weeklyLabor)} />
      </div>
      <p className="mt-3 text-[11px] text-muted">Target is ≤60%. This uses weekly food, beverage, and labor spend against weekly sales.</p>
    </Tile>
  );
}

function BreakEvenTile({ r }: { r: EstimateResult }) {
  const weeklySales = r.monthlySales / WEEKS_PER_MONTH;
  const weeklyBreakEven = r.monthlyBreakEven != null ? r.monthlyBreakEven / WEEKS_PER_MONTH : null;
  const weeklyCushion = r.dollarsAboveBreakEven / WEEKS_PER_MONTH;
  const marginLeft = Math.max(0, r.cmRatio * 100);

  return (
    <Tile title="Break-even number" icon={<Wallet size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.breakeven}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-3xl text-ink-text">{weeklyBreakEven != null ? money(weeklyBreakEven) : "—"}</span>
        <span className="text-sm text-muted">/ week before profit starts</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Your weekly sales" value={money(weeklySales)} />
        <Stat
          label={weeklyCushion >= 0 ? "Cushion / week" : "Shortfall / week"}
          value={money(Math.abs(weeklyCushion))}
          tone={weeklyCushion >= 0 ? "green" : "red"}
        />
        <Stat
          label="Left after prime cost"
          value={pct(marginLeft, 0)}
          tone={r.breakEvenHealth}
        />
        <Stat
          label="Monthly break-even"
          value={r.monthlyBreakEven != null ? money(r.monthlyBreakEven) : "—"}
          tone={r.dollarsAboveBreakEven >= 0 ? "green" : "red"}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted">
        {weeklyBreakEven != null
          ? `Profit starts after this covers the weekly labor, food/bev, and monthly fixed bills you entered. This does not include owner pay or taxes unless you include them as fixed bills.`
          : "Costs exceed sales — no break-even at these numbers."}
      </p>
    </Tile>
  );
}

function ProfitFirstTile({ r }: { r: EstimateResult }) {
  return (
    <Tile title="Profit First set-asides" icon={<PiggyBank size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.pf}>
      <p className="text-[11px] text-muted">A weekly starting point for dollars to set aside before the business spends a cent:</p>
      <div className="mt-3 space-y-2">
        {r.pf.map((p) => (
          <div key={p.key} className="flex items-center justify-between rounded-lg border border-line bg-ink/50 px-3 py-2">
            <span className="text-sm text-ink-text">{p.label} <span className="text-muted">({p.pct}%)</span></span>
            <span className="tnum text-base text-copper-soft">{money(p.amount / WEEKS_PER_MONTH)}</span>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function CashFlowTile({ r }: { r: EstimateResult }) {
  const weeklyCashIn = r.cashIn / WEEKS_PER_MONTH;
  const weeklyCashOut = r.cashOut / WEEKS_PER_MONTH;
  const weeklyCashLeft = r.cashLeft / WEEKS_PER_MONTH;

  return (
    <Tile title="Cash flow (rough)" icon={<Wallet size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.cash}>
      <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
        <div>
          <div className="text-[11px] text-muted">In / week</div>
          <div className="tnum text-base text-ink-text">{money(weeklyCashIn)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Out / week</div>
          <div className="tnum text-base text-ink-text">{money(weeklyCashOut)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Left / week</div>
          <div className={"tnum text-base " + (weeklyCashLeft >= 0 ? "text-health-green" : "text-health-red")}>{money(weeklyCashLeft)}</div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted">Monthly fixed bills are converted into a weekly estimate. Before owner pay, taxes, and debt service.</p>
    </Tile>
  );
}

function SalesMixTile({ r }: { r: EstimateResult }) {
  const m = r.salesMix!;
  return (
    <Tile title="Sales mix" icon={<Utensils size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.mix}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink">
        <div style={{ width: `${m.foodPct}%`, backgroundColor: HEALTH_HEX.green, opacity: 0.5 }} />
        <div style={{ width: `${m.bevPct}%`, backgroundColor: "#D9A35E", opacity: 0.6 }} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Food / kitchen" value={pct(m.foodPct, 0)} />
        <Stat label="Bar / beverage" value={pct(m.bevPct, 0)} />
      </div>
    </Tile>
  );
}

function CoversTile({ r }: { r: EstimateResult }) {
  const c = r.covers!;
  return (
    <Tile title="Covers" icon={<Utensils size={12} className="text-copper-soft" />} badge={YOURS} explainer={EXPLAIN.covers}>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-3xl text-ink-text">{Math.round(c.perDay).toLocaleString()}</span>
        <span className="text-sm text-muted">covers / day</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Avg check" value={money(c.avgCheck)} />
        <Stat label="Covers / month" value={Math.round(c.perMonth).toLocaleString()} />
      </div>
    </Tile>
  );
}

// ---- Small form primitives -------------------------------------------------

const inputCls =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-ink-text placeholder:text-muted/50 outline-none focus:border-copper-soft tnum";

function Legend({ n, title, hint }: { n: string; title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-copper-dim/40 text-[11px] text-copper-soft">{n}</span>
      <span className="text-sm font-medium text-ink-text">{title}</span>
      <span className="text-[11px] text-muted">· {hint}</span>
    </div>
  );
}

function Field({
  label, children, required, prefix, suffix,
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
        {label}{required && <span className="text-copper-soft"> *</span>}
      </span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>}
        {children}
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
