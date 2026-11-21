// Period totals for both financial spines, reduced to the canonical bucket
// vocabulary. Extracted from scripts/compare-spines.ts so the CLI and the nightly
// clean-day check run the exact same queries (one definition of "spines agree").
// Read-only.
import type { LedgerAccount, PrismaClient, TapBucket } from "@prisma/client";
import {
  ledgerAccountToCanonical,
  tapBucketToCanonical,
  type CanonicalBucket,
  type SpineTotals,
} from "./spine-compare";

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/** Legacy (Transaction → TapBucket) and clean-ledger (LedgerEntry) totals for [from, to). */
export async function loadSpineTotals(
  db: PrismaClient,
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<{ legacy: SpineTotals; ledger: SpineTotals }> {
  // ── Legacy spine: Transaction → Category.tapBucket ──────────
  const [txns, cats] = await Promise.all([
    db.transaction.findMany({
      where: { restaurantId, date: { gte: from, lt: to } },
      select: { amount: true, categoryId: true },
    }),
    db.category.findMany({ where: { restaurantId }, select: { id: true, tapBucket: true } }),
  ]);
  const tapByCat = new Map<string, TapBucket>(cats.map((c) => [c.id, c.tapBucket]));
  const legacy: SpineTotals = {};
  for (const t of txns) {
    const amt = n(t.amount);
    if (amt === 0) continue;
    // Inflows are stored negative → REVENUE; outflows run the category's bucket.
    const bucket: CanonicalBucket =
      amt < 0 ? "REVENUE" : tapBucketToCanonical(t.categoryId ? tapByCat.get(t.categoryId) ?? null : null);
    legacy[bucket] = (legacy[bucket] ?? 0) + Math.abs(amt);
  }

  // ── Clean-ledger spine: LedgerEntry by account ─────────────
  const lines = await db.ledgerEntry.findMany({
    where: { restaurantId, ledgerDate: { gte: from, lt: to } },
    select: { ledgerAccount: true, debit: true, credit: true },
  });
  const ledger: SpineTotals = {};
  for (const line of lines) {
    const bucket = ledgerAccountToCanonical(line.ledgerAccount as LedgerAccount);
    if (bucket == null) continue; // OPERATING_CASH — the cash contra side
    // Non-cash lines carry the value in exactly one of debit (expense) / credit (revenue).
    ledger[bucket] = (ledger[bucket] ?? 0) + n(line.debit) + n(line.credit);
  }

  return { legacy, ledger };
}
