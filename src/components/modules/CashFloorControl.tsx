"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { setCashFloor } from "@/app/modules/forward-cash/actions";
import { money } from "@/lib/format";

/**
 * Operator control for the cash floor (B6): the minimum operating balance to
 * keep. Forward Cash warns when the projection — or a scheduled sweep — dips
 * below it. Clearing the field and saving turns the floor warning off.
 */
export function CashFloorControl({ restaurantId, current }: { restaurantId: string; current: number | null }) {
  const [value, setValue] = useState(current != null ? String(current) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (next: number | null) => {
    setError(null);
    startTransition(async () => {
      try {
        await setCashFloor(restaurantId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  const submit = () => {
    if (!value.trim()) return save(null);
    const v = Number(value);
    if (Number.isNaN(v)) return setError("Enter the floor as a number.");
    if (v < 0) return setError("Cash floor can't be negative.");
    save(v);
  };

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        <ShieldCheck size={12} className="text-copper-soft" /> Cash floor
      </span>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        The minimum operating balance you want to keep. Forward Cash flags any day — or Profit First
        sweep — that would dip below it.
        {current != null ? <> Currently {money(current)}.</> : " Not set."}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">Floor ($)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 15000"
            className="mt-1 block w-40 rounded-md border border-line bg-transparent px-3 py-1.5 text-sm text-ink-text outline-none focus:border-copper"
          />
        </label>
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-md border border-copper bg-copper/10 px-4 py-1.5 text-sm text-copper-soft transition-colors hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save floor"}
        </button>
        {current != null ? (
          <button
            onClick={() => {
              setValue("");
              save(null);
            }}
            disabled={pending}
            className="text-[11px] text-muted underline-offset-2 transition-colors hover:text-copper-soft hover:underline disabled:opacity-50"
          >
            clear
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-health-red">{error}</p> : null}
    </div>
  );
}
