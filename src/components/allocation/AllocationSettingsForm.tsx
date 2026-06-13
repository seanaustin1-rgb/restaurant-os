"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";
import { updateTapSettings, type TapSettingsInput } from "@/app/settings/allocation/actions";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

function toNum(s: string): number {
  const v = Number(s.trim());
  return Number.isNaN(v) ? 0 : v;
}

const ROUND = (n: number) => Math.round(n * 100) / 100;

interface FieldDef {
  key: keyof Omit<TapSettingsInput, "simulationMode">;
  label: string;
  hint: string;
}

// The six TAP buckets the operator can tune. COGS shows as Food + Wine & Spirits
// here (the two with TAP %s today); Beer rolls up under COGS on the dashboard but
// has no separate % until the allocation engine adds one.
const FIELDS: FieldDef[] = [
  { key: "profitPct", label: "Profit", hint: "accrue-only, swept twice monthly" },
  { key: "ownerPayPct", label: "Owner Pay", hint: "accrue-only, swept twice monthly" },
  { key: "cogsFoodPct", label: "COGS — Food", hint: "food cost target" },
  { key: "cogsLiquorPct", label: "COGS — Wine & Spirits", hint: "PLCB / state-store target" },
  { key: "laborPct", label: "Labor", hint: "payroll + payroll checks" },
  { key: "opexPct", label: "OpEx", hint: "operating expenses (+ Spill, for now)" },
];

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
          placeholder="0"
          className="tnum w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim"
        />
        <span className="text-sm text-muted">%</span>
      </div>
      <span className="mt-1 block text-xs text-muted">{hint}</span>
    </label>
  );
}

export function AllocationSettingsForm({ initial }: { initial: TapSettingsInput }) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(initial[f.key])])),
  );
  const [simulationMode, setSimulationMode] = useState(initial.simulationMode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = ROUND(FIELDS.reduce((s, f) => s + toNum(vals[f.key]), 0));
  const balanced = Math.abs(total - 100) <= 0.01;

  const set = (key: string, v: string) => {
    setVals((p) => ({ ...p, [key]: v }));
    setSaved(false);
  };

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateTapSettings({
          profitPct: toNum(vals.profitPct),
          ownerPayPct: toNum(vals.ownerPayPct),
          cogsFoodPct: toNum(vals.cogsFoodPct),
          cogsLiquorPct: toNum(vals.cogsLiquorPct),
          laborPct: toNum(vals.laborPct),
          opexPct: toNum(vals.opexPct),
          simulationMode,
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
        <h2 className="text-sm font-medium text-[#E6E8E4]">Target Allocation Percentages</h2>
        <p className="mt-1 text-xs text-muted">
          Each TAP is a share of total sales. Change a number and the dashboard gauge targets follow. The six must
          total 100%.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} value={vals[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </div>

        {/* Running total — the one rule that makes the split valid. */}
        <div
          className={clsx(
            "mt-4 flex items-center justify-between rounded-md border px-3 py-2 text-sm",
            balanced
              ? "border-health-green/40 bg-health-green/10 text-health-green"
              : "border-health-red/40 bg-health-red/10 text-health-red",
          )}
        >
          <span>Total</span>
          <span className="tnum">
            {total}% {balanced ? "✓" : `— must equal 100% (${total > 100 ? "over" : "under"} by ${ROUND(Math.abs(100 - total))})`}
          </span>
        </div>

        <p className="mt-3 text-[11px] text-muted">
          <strong className="text-[#E6E8E4]">Beer</strong> and a dedicated <strong className="text-[#E6E8E4]">Spill</strong>{" "}
          reserve get their own percentages when the Allocation &amp; Variance engine ships; for now Beer rolls up under
          COGS and Spill sits inside OpEx.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-[#E6E8E4]">Simulation mode</span>
            <span className="mt-0.5 block text-xs text-muted">
              Allocations are virtual (no real money moves). Stays on until you go live with ACH.
            </span>
          </span>
          <input
            type="checkbox"
            checked={simulationMode}
            onChange={(e) => {
              setSimulationMode(e.target.checked);
              setSaved(false);
            }}
            className="h-4 w-4 accent-copper"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending || !balanced}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {!balanced && !pending && <span className="text-xs text-muted">Balance to 100% to save</span>}
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-sm text-health-green">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
