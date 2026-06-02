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

export function TransactionsTable({ rows }: { rows: TxnRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        No transactions yet. Connect a bank on the Connections page, then sync.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
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
            <Row key={r.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: TxnRow }) {
  const [bucket, setBucket] = useState<TransactionBucket>(row.bucket);
  const [overridden, setOverridden] = useState(row.isManualOverride);
  const [pending, startTransition] = useTransition();

  function onChange(next: TransactionBucket) {
    const prev = bucket;
    setBucket(next);
    startTransition(async () => {
      try {
        await setTransactionBucket(row.id, next);
        setOverridden(true);
      } catch {
        setBucket(prev); // revert on failure
      }
    });
  }

  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="tnum whitespace-nowrap px-4 py-2 text-muted">{row.date}</td>
      <td className="px-4 py-2 text-[#E6E8E4]">
        {row.merchantName ?? row.description ?? "—"}
        {overridden && (
          <span className="ml-2 rounded bg-copper/15 px-1.5 py-0.5 text-[10px] text-copper-soft">edited</span>
        )}
      </td>
      <td className="tnum px-4 py-2 text-right text-[#E6E8E4]">{money2(row.amount)}</td>
      <td className="px-4 py-2">
        <select
          value={bucket}
          disabled={pending}
          onChange={(e) => onChange(e.target.value as TransactionBucket)}
          className="rounded-md border border-line bg-ink px-2 py-1 text-xs text-[#E6E8E4] outline-none focus:border-copper-dim disabled:opacity-50"
        >
          {BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
