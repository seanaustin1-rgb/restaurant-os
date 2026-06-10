"use client";

import { useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { money } from "@/lib/format";
import { assignCategoryBulk } from "@/app/transactions/misc/actions";

export interface MiscRow {
  id: string;
  date: string;
  merchantName: string | null;
  description: string | null;
  amount: number;
}

export interface CategoryOption {
  id: string;
  name: string;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function MiscReviewTable({ rows, categories }: { rows: MiscRow[]; categories: CategoryOption[] }) {
  const [list, setList] = useState<MiscRow[]>(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCat, setTargetCat] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalCount = list.length;
  const totalAmount = useMemo(() => list.reduce((s, r) => s + r.amount, 0), [list]);
  const selectedAmount = useMemo(
    () => list.filter((r) => selected.has(r.id)).reduce((s, r) => s + r.amount, 0),
    [list, selected],
  );
  const allSelected = list.length > 0 && selected.size === list.length;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === list.length ? new Set() : new Set(list.map((r) => r.id))));
  }

  function assign() {
    const ids = [...selected];
    if (ids.length === 0 || !targetCat) return;
    const catName = categories.find((c) => c.id === targetCat)?.name ?? "category";
    setError(null);
    setDone(null);
    startTransition(async () => {
      try {
        const { count } = await assignCategoryBulk(ids, targetCat);
        setList((l) => l.filter((r) => !selected.has(r.id)));
        setSelected(new Set());
        setDone(`Assigned ${count} transaction${count === 1 ? "" : "s"} to ${catName}.`);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  if (totalCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        🎉 Nothing unnamed — every dollar has a category.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      {done && (
        <div className="rounded-md border border-health-green/40 bg-health-green/10 px-3 py-2 text-sm text-health-green">{done}</div>
      )}

      {/* Action bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/95 p-3 backdrop-blur">
        <span className="text-sm text-muted">
          <span className="tnum text-[#E6E8E4]">{selected.size}</span> selected
          {selected.size > 0 && <span className="tnum"> · {money(selectedAmount)}</span>}
        </span>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <select
            value={targetCat}
            onChange={(e) => setTargetCat(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-dim sm:flex-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={pending || selected.size === 0 || !targetCat}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
          >
            <Check size={14} /> Assign {selected.size > 0 ? selected.size : ""}
          </button>
        </div>
      </div>

      {/* Table — rows on desktop, cards on phone/tablet */}
      <div className="overflow-hidden rounded-lg border border-line">
        {/* Desktop */}
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="w-10 px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={"cursor-pointer border-b border-line/60 last:border-0 " + (isSel ? "bg-copper/10" : "hover:bg-surface")}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label="Select row" />
                  </td>
                  <td className="tnum px-3 py-2 text-muted">{r.date}</td>
                  <td className="px-3 py-2 text-[#E6E8E4]">{r.description || r.merchantName || "—"}</td>
                  <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{money(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Phone/tablet */}
        <div className="divide-y divide-line/60 sm:hidden">
          {list.map((r) => {
            const isSel = selected.has(r.id);
            return (
              <div
                key={r.id}
                onClick={() => toggle(r.id)}
                className={"flex cursor-pointer items-start gap-3 p-3 " + (isSel ? "bg-copper/10" : "")}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select row"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 break-words text-[#E6E8E4]">{r.description || r.merchantName || "—"}</span>
                    <span className="tnum shrink-0 text-[#E6E8E4]">{money(r.amount)}</span>
                  </div>
                  <span className="tnum mt-1 block text-xs text-muted">{r.date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted">
        {totalCount} unnamed · {money(totalAmount)} total. Click a row to select; assign the biggest ones first to drive
        Misc toward zero.
      </p>
    </div>
  );
}
