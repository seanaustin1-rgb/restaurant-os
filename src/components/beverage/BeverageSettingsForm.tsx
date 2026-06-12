"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateBeverageSettings, type BeverageSettings } from "@/app/settings/beverage/actions";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

// "" ↔ null so a blank field clears the value rather than storing 0.
function toNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const v = Number(t);
  return Number.isNaN(v) ? null : v;
}
function toStr(v: number | null): string {
  return v == null ? "" : String(v);
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="tnum w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim"
        />
        <span className="text-sm text-muted">%</span>
      </div>
      <span className="mt-1 block text-xs text-muted">{hint}</span>
    </label>
  );
}

export function BeverageSettingsForm({ initial }: { initial: BeverageSettings }) {
  const [liquorMix, setLiquorMix] = useState(toStr(initial.liquorSalesMixPct));
  const [bevMix, setBevMix] = useState(toStr(initial.beverageSalesMixPct));
  const [liquorTarget, setLiquorTarget] = useState(toStr(initial.targetLiquorPourPct));
  const [bevTarget, setBevTarget] = useState(toStr(initial.targetBeveragePourPct));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateBeverageSettings({
          liquorSalesMixPct: toNum(liquorMix),
          beverageSalesMixPct: toNum(bevMix),
          targetLiquorPourPct: toNum(liquorTarget),
          targetBeveragePourPct: toNum(bevTarget),
        });
        setSaved(true);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-[#E6E8E4]">Sales mix (manual fallback)</h2>
        <p className="mt-1 text-xs text-muted">
          What share of net sales is alcohol. Used as the denominator for the cost ratios until Toast supplies the
          per-day split — then your real numbers take over automatically. Leave blank if you don&rsquo;t track it yet.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Liquor sales" hint="liquor as % of net sales" value={liquorMix} onChange={setLiquorMix} />
          <Field label="Beer / beverage sales" hint="beer & wine as % of net sales" value={bevMix} onChange={setBevMix} />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-[#E6E8E4]">Cost targets</h2>
        <p className="mt-1 text-xs text-muted">
          Your goal pour cost — cost as a % of that category&rsquo;s <strong>own</strong> sales (not total revenue). The
          gauge turns yellow near the target and red over it.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Liquor pour cost" hint="liquor COGS ÷ liquor sales" value={liquorTarget} onChange={setLiquorTarget} />
          <Field label="Beer / beverage cost" hint="beer/bev COGS ÷ beer/bev sales" value={bevTarget} onChange={setBevTarget} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-sm text-health-green">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
