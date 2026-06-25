"use client";

import { useState, useTransition } from "react";
import type { TransactionBucket } from "@prisma/client";
import { BUCKETS } from "@/lib/buckets";
import { setTransactionBucket } from "@/app/transactions/actions";
import { money2 } from "@/lib/format";

export interface TxnRow {
  id: string;
  date: string;
  merchantName: string | null;
  description: string | null;
  amount: number;
  bucket: TransactionBucket;
  isManualOverride: boolean;
  confidence: number | null;
}

interface RowState {
  bucket: TransactionBucket;
  overridden: boolean;
}

export function TransactionsTable({ rows }: { rows: TxnRow[] }) {
  // Row state lives here (one source of truth) so the desktop table and the
  // mobile cards stay in sync — same responsive table→cards pattern as the
  // settings screens, but state is lifted because each row is rendered twice.
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { bucket: r.bucket, overridden: r.isManualOverride }])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onChange(id: string, next: TransactionBucket) {
    const prev = state[id]?.bucket;
    setState((s) => ({ ...s, [id]: { ...s[id], bucket: next } }));
    setPendingId(id);
    startTransition(async () => {
      try {
        await setTransactionBucket(id, next);
        setState((s) => ({ ...s, [id]: { ...s[id], overridden: true } }));
      } catch {
        if (prev) setState((s) => ({ ...s, [id]: { ...s[id], bucket: prev } })); // revert on failure
      } finally {
        setPendingId(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No transactions yet. Connect a bank on the Connections page, then sync.
      </div>
    );
  }

  // Shared cell renderers (one source of truth for both layouts).
  const merchant = (r: TxnRow) => (
    <>
      <span className="text-ink-text">{r.merchantName ?? r.description ?? "—"}</span>
      {state[r.id]?.overridden && (
        <span className="ml-2 rounded bg-copper/15 px-1.5 py-0.5 text-[10px] text-copper-soft">edited</span>
      )}
    </>
  );
  const categorySelect = (r: TxnRow) => (
    <select
      value={state[r.id]?.bucket}
      disabled={pendingId === r.id}
      onChange={(e) => onChange(r.id, e.target.value as TransactionBucket)}
      className="w-full rounded-md border border-line bg-ink px-2 py-1 text-xs text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft disabled:opacity-50 sm:w-auto"
    >
      {BUCKETS.map((b) => (
        <option key={b.value} value={b.value}>{b.label}</option>
      ))}
    </select>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {/* Desktop: aligned table */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Merchant</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            <th className="px-4 py-2 font-medium">Category</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60 last:border-0">
              <td className="tnum whitespace-nowrap px-4 py-2 text-muted">{r.date}</td>
              <td className="px-4 py-2">{merchant(r)}</td>
              <td className="tnum px-4 py-2 text-right text-ink-text">{money2(r.amount)}</td>
              <td className="px-4 py-2">{categorySelect(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone/tablet: stacked cards */}
      <div className="divide-y divide-line/60 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 break-words">{merchant(r)}</span>
              <span className="tnum shrink-0 text-ink-text">{money2(r.amount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="tnum text-xs text-muted">{r.date}</span>
              {categorySelect(r)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
