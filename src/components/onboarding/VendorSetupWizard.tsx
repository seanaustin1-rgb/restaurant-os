"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Check, Sparkles, Wand2 } from "lucide-react";
import type { VendorSetupRow, CategoryOption } from "@/lib/onboarding/vendor-setup";
import { confirmVendorMappings, type ConfirmResult } from "@/app/onboarding/vendors/actions";
import { money } from "@/lib/format";

export function VendorSetupWizard({
  rows,
  categories,
  totalSpend,
  coveredPct,
}: {
  rows: VendorSetupRow[];
  categories: CategoryOption[];
  totalSpend: number;
  coveredPct: number;
}) {
  const [sel, setSel] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.signature, r.guessCategoryId ?? ""])),
  );
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = useMemo(() => rows.filter((r) => sel[r.signature]), [rows, sel]);

  function save() {
    const mappings = chosen.map((r) => ({ signature: r.signature, categoryId: sel[r.signature] }));
    if (mappings.length === 0) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await confirmVendorMappings(mappings));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save mappings");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Coverage */}
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-[#E6E8E4]">Spend already categorized</span>
          <span className="tnum text-copper-soft">{coveredPct.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink">
          <div className="h-full rounded-full bg-copper-soft/70" style={{ width: `${Math.min(coveredPct, 100)}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Your top {rows.length} vendors by spend ({money(totalSpend)} total). Confirm each one — biggest first, so a
          few clicks fix most of the gauges. <Sparkles size={11} className="inline text-copper-soft" /> = a suggested
          guess you should double-check.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      {result && (
        <div className="rounded-md border border-health-green/30 bg-health-green/5 px-4 py-3 text-sm text-[#E6E8E4]">
          <Check size={14} className="mr-1 inline text-health-green" />
          Mapped {result.vendorsMapped} vendor{result.vendorsMapped === 1 ? "" : "s"} ·{" "}
          {result.rulesCreated} rule{result.rulesCreated === 1 ? "" : "s"} created
          {result.rulesUpdated ? `, ${result.rulesUpdated} updated` : ""} ·{" "}
          {result.txnsRecategorized} transaction{result.txnsRecategorized === 1 ? "" : "s"} recategorized. Future
          imports of these vendors will self-categorize.
        </div>
      )}

      {/* Vendor list */}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="divide-y divide-line/60">
          {rows.map((r) => (
            <div key={r.signature} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[160px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-[#E6E8E4]" title={r.label}>{r.label}</span>
                  {r.hasRule && (
                    <span className="rounded bg-copper/10 px-1.5 py-0.5 text-[10px] text-copper-soft">rule</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  <span className="tnum text-[#E6E8E4]">{money(r.total)}</span> · {r.count} txn
                  {r.count === 1 ? "" : "s"} · keyword <span className="text-muted">{r.signature}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {r.guessSource === "rule" && sel[r.signature] === r.guessCategoryId && (
                  <span title="System guess — confirm or change" className="shrink-0">
                    <Sparkles size={13} className="text-copper-soft" />
                  </span>
                )}
                <select
                  value={sel[r.signature] ?? ""}
                  disabled={pending}
                  onChange={(e) => setSel((s) => ({ ...s, [r.signature]: e.target.value }))}
                  className="w-52 rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim disabled:opacity-50"
                >
                  <option value="">— choose category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{chosen.length} of {rows.length} ready to confirm</span>
        <button
          onClick={save}
          disabled={pending || chosen.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          <Wand2 size={15} /> {pending ? "Saving…" : "Confirm & teach rules"}
        </button>
      </div>
    </div>
  );
}
