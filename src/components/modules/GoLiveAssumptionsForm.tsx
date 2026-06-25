"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { updateGoLiveAssumptions } from "@/app/modules/go-live/actions";
import type { GoLiveAssumptions } from "@/lib/modules/go-live-coach";

export function GoLiveAssumptionsForm({ assumptions }: { assumptions: GoLiveAssumptions }) {
  const [floor, setFloor] = useState(assumptions.operatingCashFloor != null ? String(assumptions.operatingCashFloor) : "");
  const [profitPct, setProfitPct] = useState(String(assumptions.pilotProfitPct));
  const [investorPct, setInvestorPct] = useState(String(assumptions.investorReturnPct));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    const floorValue = floor.trim() ? Number(floor) : null;
    const profitValue = Number(profitPct);
    const investorValue = Number(investorPct);
    if (floorValue != null && Number.isNaN(floorValue)) return setError("Cash floor must be a number.");
    if (Number.isNaN(profitValue)) return setError("Pilot profit skim must be a number.");
    if (Number.isNaN(investorValue)) return setError("Investor return must be a number.");

    startTransition(async () => {
      try {
        await updateGoLiveAssumptions({
          operatingCashFloor: floorValue,
          pilotProfitPct: profitValue,
          investorReturnPct: investorValue,
        });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save assumptions.");
      }
    });
  }

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-lg text-[#E6E8E4]">
            <SlidersHorizontal size={16} /> Go-Live assumptions
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            These only tune the virtual coach. They do not move money or change allocation targets.
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted">
          cash floor: {assumptions.operatingCashFloorSource}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">Operating cash floor ($)</span>
          <input
            type="number"
            min="0"
            step="100"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="Auto"
            className="mt-1 w-full rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">Pilot profit skim (%)</span>
          <input
            type="number"
            min="0"
            max="20"
            step="0.25"
            value={profitPct}
            onChange={(e) => setProfitPct(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">Investor return model (%)</span>
          <input
            type="number"
            min="0"
            max="20"
            step="0.25"
            value={investorPct}
            onChange={(e) => setInvestorPct(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-md border border-copper bg-copper/10 px-4 py-1.5 text-sm text-copper-soft transition-colors hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save assumptions"}
        </button>
        {saved ? <span className="text-xs text-health-green">Saved. The coach will refresh with these assumptions.</span> : null}
        {error ? <span className="text-xs text-health-red">{error}</span> : null}
      </div>
    </section>
  );
}
