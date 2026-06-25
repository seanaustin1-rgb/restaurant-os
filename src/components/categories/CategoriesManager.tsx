"use client";

import { useState, useTransition } from "react";
import type { TapBucket } from "@prisma/client";
import { Plus, Archive } from "lucide-react";
import { TAP_BUCKETS } from "@/lib/categorization/categories";
import { createCategory, renameCategory, remapCategory, archiveCategory } from "@/app/settings/categories/actions";

export interface CategoryRow {
  id: string;
  name: string;
  tapBucket: TapBucket;
  isSystem: boolean;
  txnCount: number;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function CategoriesManager({ rows }: { rows: CategoryRow[] }) {
  const [list, setList] = useState<CategoryRow[]>(rows);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTap, setNewTap] = useState<TapBucket>("OPEX");
  const [pending, startTransition] = useTransition();

  function add() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        const created = await createCategory(name, newTap);
        setList((l) => [...l, { ...created, isSystem: false, txnCount: 0 }]);
        setNewName("");
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function rename(id: string, name: string) {
    const row = list.find((r) => r.id === id);
    const trimmed = name.trim();
    if (!row || !trimmed || row.name === trimmed) {
      // nothing to do — restore the canonical name in case it was blanked
      if (row) setList((l) => l.map((r) => (r.id === id ? { ...r, name: row.name } : r)));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await renameCategory(id, trimmed);
        setList((l) => l.map((r) => (r.id === id ? { ...r, name: trimmed } : r)));
      } catch (e) {
        setError(errMsg(e));
        setList((l) => l.map((r) => (r.id === id ? { ...r, name: row.name } : r)));
      }
    });
  }

  function remap(id: string, tap: TapBucket) {
    const prev = list.find((r) => r.id === id)?.tapBucket;
    setList((l) => l.map((r) => (r.id === id ? { ...r, tapBucket: tap } : r)));
    setError(null);
    startTransition(async () => {
      try {
        await remapCategory(id, tap);
      } catch (e) {
        setError(errMsg(e));
        if (prev) setList((l) => l.map((r) => (r.id === id ? { ...r, tapBucket: prev } : r)));
      }
    });
  }

  function archive(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await archiveCategory(id);
        setList((l) => l.filter((r) => r.id !== id));
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  // ── Per-field renderers ──────────────────────────────────────
  // Shared by the desktop table and the mobile card layout so the two never
  // drift (same responsive table→cards pattern as the rules screen).
  function nameField(row: CategoryRow) {
    return (
      <input
        value={row.name}
        onChange={(e) => setList((l) => l.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))}
        onBlur={(e) => rename(row.id, e.target.value)}
        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[#E6E8E4] outline-none hover:border-line focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
      />
    );
  }

  function tapSelect(row: CategoryRow) {
    return (
      <select
        value={row.tapBucket}
        disabled={pending}
        onChange={(e) => remap(row.id, e.target.value as TapBucket)}
        className="w-full rounded-md border border-line bg-ink px-2 py-1 text-xs text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft disabled:opacity-50 sm:w-auto"
      >
        {TAP_BUCKETS.map((b) => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
      </select>
    );
  }

  function archiveBtn(row: CategoryRow) {
    return (
      <button
        onClick={() => archive(row.id)}
        disabled={pending || row.txnCount > 0 || row.name === "Misc"}
        title={row.name === "Misc" ? "The catch-all can't be archived" : row.txnCount > 0 ? "Reassign its transactions first" : "Archive"}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Archive size={13} />
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Add a category */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3">
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">New category</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="e.g. Live Music"
            className="w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">Rolls into</label>
          <select
            value={newTap}
            onChange={(e) => setNewTap(e.target.value as TapBucket)}
            className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          >
            {TAP_BUCKETS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={add}
          disabled={pending || !newName.trim()}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Category list — table on desktop, stacked cards on phone/tablet */}
      <div className="overflow-hidden rounded-lg border border-line">
        {/* Desktop: aligned table */}
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Rolls into (TAP)</th>
              <th className="px-4 py-2 text-right font-medium"># txns</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2">{nameField(row)}</td>
                <td className="px-4 py-2">{tapSelect(row)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{row.txnCount}</td>
                <td className="px-4 py-2 text-right">{archiveBtn(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Phone/tablet: stacked cards */}
        <div className="divide-y divide-line/60 sm:hidden">
          {list.map((row) => (
            <div key={row.id} className="p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">{nameField(row)}</div>
                <span className="tnum shrink-0 text-xs text-muted">{row.txnCount} txns</span>
                {archiveBtn(row)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="w-20 shrink-0 text-[11px] uppercase tracking-wider text-muted">Rolls into</span>
                {tapSelect(row)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">
        Rename inline (click the name). Change &ldquo;Rolls into&rdquo; to remap a category to a different Profit First
        bucket. Archiving is blocked while a category still has transactions, so no dollar is left unnamed.
      </p>
    </div>
  );
}
