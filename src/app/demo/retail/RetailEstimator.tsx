"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Barcode, Gauge, PiggyBank, ShoppingBag, Wallet } from "lucide-react";
import { money, pct } from "@/lib/format";
import type { Health } from "@/lib/demo/estimate";
import {
  computeRetailEstimate,
  type RetailEstimateInputs,
  type RetailEstimateResult,
  type RetailPosProvider,
} from "@/lib/demo/retail-estimate";
import { DemoModulePreview } from "../DemoModulePreview";

type FormState = Record<
  | "name"
  | "market"
  | "posProvider"
  | "weeklySales"
  | "weeklyInventoryPurchases"
  | "weeklyPayroll"
  | "weeklyReturnsMarkdowns"
  | "monthlyRent"
  | "monthlyUtilities"
  | "monthlyInsurance"
  | "monthlySoftware"
  | "monthlyDebt"
  | "monthlyOther"
  | "currentInventoryValue"
  | "ecommerceSharePct",
  string
>;

const INITIAL: FormState = {
  name: "",
  market: "",
  posProvider: "square",
  weeklySales: "",
  weeklyInventoryPurchases: "",
  weeklyPayroll: "",
  weeklyReturnsMarkdowns: "",
  monthlyRent: "",
  monthlyUtilities: "",
  monthlyInsurance: "",
  monthlySoftware: "",
  monthlyDebt: "",
  monthlyOther: "",
  currentInventoryValue: "",
  ecommerceSharePct: "",
};

const POS_OPTIONS: { value: RetailPosProvider; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "clover", label: "Clover" },
  { value: "shopify", label: "Shopify POS" },
  { value: "lightspeed", label: "Lightspeed" },
  { value: "helcim", label: "Helcim" },
  { value: "godaddy", label: "GoDaddy POS" },
  { value: "revel", label: "Revel" },
  { value: "other", label: "Other POS" },
];

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

function buildInputs(f: FormState): RetailEstimateInputs {
  return {
    name: f.name.trim(),
    market: f.market.trim(),
    posProvider: f.posProvider as RetailPosProvider,
    weeklySales: num(f.weeklySales),
    weeklyInventoryPurchases: num(f.weeklyInventoryPurchases),
    weeklyPayroll: num(f.weeklyPayroll),
    weeklyReturnsMarkdowns: num(f.weeklyReturnsMarkdowns),
    monthlyFixedBills:
      num(f.monthlyRent) +
      num(f.monthlyUtilities) +
      num(f.monthlyInsurance) +
      num(f.monthlySoftware) +
      num(f.monthlyDebt) +
      num(f.monthlyOther),
    currentInventoryValue: optNum(f.currentInventoryValue),
    ecommerceSharePct: optNum(f.ecommerceSharePct),
  };
}

export function RetailEstimator() {
  const [f, setF] = useState<FormState>(INITIAL);
  const [view, setView] = useState<"form" | "results">("form");
  const [error, setError] = useState<string | null>(null);

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const inputs = useMemo(() => buildInputs(f), [f]);
  const result = useMemo(() => (view === "results" ? computeRetailEstimate(inputs) : null), [inputs, view]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = buildInputs(f);
    if (next.weeklySales <= 0) return setError("Add average weekly sales.");
    setError(null);
    setView("results");
  }

  if (view === "results" && result) {
    return <Results f={f} r={result} onEdit={() => setView("form")} />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl">
      <p className="text-sm text-muted">
        Enter the rough retail numbers you already know. The POS choice tells the demo what data pipe would light this up later.
      </p>

      <fieldset className="mt-6 space-y-4">
        <Legend n="1" title="Store identity" hint="Optional, used to personalize the estimate" />
        <Field label="Store name">
          <input className={inputCls} placeholder="Copper Lane Goods" value={f.name} onChange={upd("name")} />
        </Field>
        <Field label="City & state">
          <input className={inputCls} placeholder="York, PA" value={f.market} onChange={upd("market")} />
        </Field>
        <Field label="POS system">
          <select className={inputCls} value={f.posProvider} onChange={upd("posProvider")}>
            {POS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="2" title="Known weekly numbers" hint="Sales and margin pressure are the first read" />
        <Field label="Average weekly sales" required prefix="$">
          <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="52,000" value={f.weeklySales} onChange={upd("weeklySales")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Weekly inventory purchases / COGS" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="24,000" value={f.weeklyInventoryPurchases} onChange={upd("weeklyInventoryPurchases")} />
          </Field>
          <Field label="Weekly payroll + taxes" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="9,000" value={f.weeklyPayroll} onChange={upd("weeklyPayroll")} />
          </Field>
          <Field label="Weekly returns / markdowns" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="2,500" value={f.weeklyReturnsMarkdowns} onChange={upd("weeklyReturnsMarkdowns")} />
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          If you only know purchase orders or vendor bills, use those as a rough COGS stand-in. Live POS/inventory data sharpens this later.
        </p>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="3" title="Monthly fixed bills" hint="Use the bills you know; leave the rest blank" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rent / lease" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="8,000" value={f.monthlyRent} onChange={upd("monthlyRent")} />
          </Field>
          <Field label="Utilities" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="1,500" value={f.monthlyUtilities} onChange={upd("monthlyUtilities")} />
          </Field>
          <Field label="Insurance" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="1,800" value={f.monthlyInsurance} onChange={upd("monthlyInsurance")} />
          </Field>
          <Field label="Software / POS / ecommerce" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="1,200" value={f.monthlySoftware} onChange={upd("monthlySoftware")} />
          </Field>
          <Field label="Debt / loan payments" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="3,500" value={f.monthlyDebt} onChange={upd("monthlyDebt")} />
          </Field>
          <Field label="Other fixed bills" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="4,500" value={f.monthlyOther} onChange={upd("monthlyOther")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <Legend n="4" title="Inventory and channel detail" hint="Optional, used to explain the next data connection" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current inventory value" prefix="$">
            <input className={inputCls + " pl-7"} inputMode="numeric" placeholder="180,000" value={f.currentInventoryValue} onChange={upd("currentInventoryValue")} />
          </Field>
          <Field label="Online sales share" suffix="%">
            <input className={inputCls + " pr-8"} inputMode="numeric" placeholder="25" value={f.ecommerceSharePct} onChange={upd("ecommerceSharePct")} />
          </Field>
        </div>
      </fieldset>

      {error && <p className="mt-5 text-sm text-health-red">{error}</p>}

      <button
        type="submit"
        className="mt-7 w-full rounded-lg bg-copper px-5 py-3 font-medium text-ink transition hover:bg-copper-soft"
      >
        See retail heartbeat -&gt;
      </button>
      <p className="mt-3 text-center text-[11px] text-muted">
        Nothing is saved. This is a quick estimate, not a full diagnosis.
      </p>
    </form>
  );
}

function Results({ f, r, onEdit }: { f: FormState; r: RetailEstimateResult; onEdit: () => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Retail heartbeat estimate</div>
          <h2 className="font-display text-3xl text-[#E6E8E4]">{f.name || "Your retail business"}</h2>
          {f.market && <div className="text-sm text-muted">{f.market}</div>}
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-[#E6E8E4]">
          <ArrowLeft size={14} /> Adjust numbers
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3 text-[13px] leading-relaxed text-[#CFD2CC]">
        Retail pressure starts with product cost, returns/markdowns, payroll, and fixed bills. POS and inventory data turn this from a rough read into a live dashboard.
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Tile title="Gross Margin" icon={<Gauge size={12} className="text-copper-soft" />}>
          <div className="flex items-baseline gap-2">
            <span className={"tnum text-4xl " + HEALTH_TEXT[r.marginHealth]}>{pct(r.grossMarginPct)}</span>
            <span className="text-sm text-muted">after COGS, returns, markdowns</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Inventory / COGS" value={money(r.monthlyInventoryPurchases)} />
            <Stat label="Returns / markdowns" value={money(r.monthlyReturnsMarkdowns)} />
          </div>
        </Tile>

        <Tile title="Break-even Number" icon={<Wallet size={12} className="text-copper-soft" />}>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-4xl text-[#E6E8E4]">{money(r.weeklyBreakEven)}</span>
            <span className="text-sm text-muted">/ week before profit starts</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Your weekly sales" value={money(r.weeklySales)} />
            <Stat
              label={r.dollarsAboveBreakEven >= 0 ? "Monthly cushion" : "Monthly shortfall"}
              value={money(Math.abs(r.dollarsAboveBreakEven))}
              tone={r.breakEvenHealth}
            />
          </div>
        </Tile>

        <Tile title="Inventory Position" icon={<Barcode size={12} className="text-copper-soft" />}>
          <div className="flex items-baseline gap-2">
            <span className={"tnum text-4xl " + HEALTH_TEXT[r.inventoryHealth]}>
              {r.inventoryWeeksOnHand != null ? r.inventoryWeeksOnHand.toFixed(1) : "-"}
            </span>
            <span className="text-sm text-muted">weeks on hand</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Payroll load" value={pct(r.payrollPct)} tone={r.payrollHealth} />
            <Stat label="Online share" value={r.ecommerceSharePct != null ? pct(r.ecommerceSharePct, 0) : "-"} />
          </div>
        </Tile>

        <Tile title="POS Readiness" icon={<ShoppingBag size={12} className="text-copper-soft" />}>
          <div className="tnum text-3xl text-[#E6E8E4]">{r.posLabel}</div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">{r.posNote}</p>
          <p className="mt-3 text-[11px] leading-relaxed text-copper-soft">
            First import: sales, tenders, refunds, item/category sales, taxes, and inventory where available.
          </p>
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

      <DemoModulePreview businessType="RETAIL" />

      <div className="mt-8 text-center">
        <Link href="/demo/tour/retail" className="text-sm text-copper-soft hover:text-copper">
          Back to retail tour
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
