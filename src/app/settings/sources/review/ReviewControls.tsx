"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { approveFinancialEventAction, excludeFinancialEventAction, bulkResolveGroupAction } from "./actions";

export interface CategoryOption {
  id: string;
  name: string;
}

const KEEP = "Keep current mapping";

const SELECT_CLASS =
  "max-w-[180px] rounded-md border border-line bg-ink/40 px-2 py-1.5 text-xs text-ink-text focus:border-copper focus:outline-none";

/** Per-row controls: re-type category + optional save-as-rule, approve, exclude. */
export function RowActions({
  eventId,
  categories,
  defaultCategoryId,
}: {
  eventId: string;
  categories: CategoryOption[];
  defaultCategoryId: string | null;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-end justify-end gap-2">
      <form action={excludeFinancialEventAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-health-red hover:text-health-red"
        >
          <XCircle size={13} /> Exclude
        </button>
      </form>
      <form action={approveFinancialEventAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-muted">
          Category
          <select name="categoryId" defaultValue={defaultCategoryId ?? ""} className={SELECT_CLASS}>
            <option value="">{KEEP}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 pb-1.5 text-[11px] text-muted">
          <input type="checkbox" name="saveRule" className="accent-copper" /> Save as rule
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20"
        >
          <CheckCircle2 size={13} /> Approve to ledger
        </button>
      </form>
    </div>
  );
}

/** Bulk controls for a whole group: approve-all-as-category or exclude-all. A group
 * touching more than the confirm threshold prompts a native confirm before submit. */
export function BulkGroupForm({
  eventIds,
  count,
  categories,
  defaultCategoryId,
  confirmThreshold = 10,
}: {
  eventIds: string[];
  count: number;
  categories: CategoryOption[];
  defaultCategoryId: string | null;
  confirmThreshold?: number;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");

  const onApprove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!categoryId) {
      e.preventDefault();
      window.alert("Pick a category before approving a whole group — bulk approve never blanket-confirms the import's guess.");
      return;
    }
    if (count > confirmThreshold && !window.confirm(`Approve all ${count} items in this group as the chosen category?`)) {
      e.preventDefault();
    }
  };

  const onExclude = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (count > confirmThreshold && !window.confirm(`Exclude all ${count} items in this group? This can't be undone in one click.`)) {
      e.preventDefault();
    }
  };

  return (
    <form action={bulkResolveGroupAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="eventIds" value={eventIds.join(",")} />
      <select
        name="categoryId"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">{KEEP}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        name="action"
        value="approve"
        onClick={onApprove}
        className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-2.5 py-1.5 text-[11px] text-copper-soft hover:bg-copper/20"
      >
        <CheckCircle2 size={12} /> Approve all ({count})
      </button>
      <button
        type="submit"
        name="action"
        value="exclude"
        onClick={onExclude}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] text-muted hover:border-health-red hover:text-health-red"
      >
        <XCircle size={12} /> Exclude all
      </button>
    </form>
  );
}
