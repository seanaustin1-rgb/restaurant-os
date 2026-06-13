import { prisma } from "@/lib/prisma";
import { signatureOf } from "@/lib/categorization/suggestions";

// Payment Watch module — flags likely double-pays and off-norm charges from
// bank transactions. Review lists, not verdicts: same-amount repeats can be
// legitimate (two invoices, two register runs), so everything links back to the
// underlying transactions for a human call.
//
// Duplicates, two tiers:
//   "likely"  — same vendor signature AND same exact amount within ≤3 days
//   "review"  — same exact amount ≥ $500 within ≤10 days (catches double-cashed
//               checks, where no vendor signature exists)
// Unusual charges: a transaction > 3× its vendor's median (vendor needs ≥4
// occurrences; charge ≥ $200) — the "why is this bill suddenly huge" catcher.
export interface DuplicatePair {
  tier: "likely" | "review";
  vendor: string | null; // null = signature-less (checks etc.)
  description: string; // second transaction's label
  firstDescription: string; // first transaction's label — for checks, distinct #s reveal it's NOT one cashed twice
  amount: number;
  firstDate: string;
  secondDate: string;
  gapDays: number;
  /** Both descriptions differ (e.g. CHECK #10451 vs #10465) — softens the duplicate signal. */
  distinctRefs: boolean;
}

export interface UnusualCharge {
  vendor: string;
  description: string;
  amount: number;
  date: string;
  medianAmount: number;
  ratio: number; // amount / vendor median
}

export interface PaymentWatchData {
  windowLabel: string;
  duplicates: DuplicatePair[]; // likely first, then review; newest first within tier
  unusual: UnusualCharge[]; // largest ratio first
  flaggedTotal: number; // $ across both lists
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const LIKELY_MAX_GAP_DAYS = 3;
const REVIEW_MAX_GAP_DAYS = 10;
const REVIEW_MIN_AMOUNT = 500;
const UNUSUAL_MIN_OCCURRENCES = 4;
const UNUSUAL_MIN_AMOUNT = 200;
const UNUSUAL_RATIO = 3;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function loadPaymentWatch(restaurantId: string): Promise<PaymentWatchData> {
  const txns = await prisma.transaction.findMany({
    where: { restaurantId, amount: { gt: 0 } }, // outflows
    orderBy: { date: "asc" },
    select: { date: true, amount: true, merchantName: true, description: true },
  });

  if (txns.length === 0) {
    return { windowLabel: "", duplicates: [], unusual: [], flaggedTotal: 0, hasData: false };
  }

  const enriched = txns.map((t) => ({
    date: t.date,
    amount: n(t.amount),
    sig: signatureOf(t.merchantName, t.description),
    desc: (t.merchantName ?? t.description ?? "—").slice(0, 60),
  }));

  // — Duplicates: consecutive same-amount hits per (signature|amount) cluster —
  const duplicates: DuplicatePair[] = [];
  const byAmount = new Map<string, typeof enriched>();
  for (const t of enriched) {
    const key = `${t.sig ?? "∅"}::${t.amount.toFixed(2)}`;
    const arr = byAmount.get(key) ?? [];
    arr.push(t);
    byAmount.set(key, arr);
  }
  for (const [, arr] of byAmount) {
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i - 1];
      const b = arr[i];
      const gapDays = Math.round((b.date.getTime() - a.date.getTime()) / DAY_MS);
      const sameVendor = a.sig != null; // cluster key already guarantees equal sigs
      const distinctRefs = a.desc !== b.desc;
      if (sameVendor && gapDays <= LIKELY_MAX_GAP_DAYS) {
        duplicates.push({
          tier: "likely",
          vendor: a.sig,
          description: b.desc,
          firstDescription: a.desc,
          amount: b.amount,
          firstDate: iso(a.date),
          secondDate: iso(b.date),
          gapDays,
          distinctRefs,
        });
      } else if (b.amount >= REVIEW_MIN_AMOUNT && gapDays <= REVIEW_MAX_GAP_DAYS) {
        duplicates.push({
          tier: "review",
          vendor: a.sig,
          description: b.desc,
          firstDescription: a.desc,
          amount: b.amount,
          firstDate: iso(a.date),
          secondDate: iso(b.date),
          gapDays,
          distinctRefs,
        });
      }
    }
  }
  duplicates.sort((x, y) =>
    x.tier !== y.tier ? (x.tier === "likely" ? -1 : 1) : y.secondDate.localeCompare(x.secondDate),
  );

  // — Unusual charges: way above the vendor's own norm —
  const bySig = new Map<string, typeof enriched>();
  for (const t of enriched) {
    if (!t.sig) continue;
    const arr = bySig.get(t.sig) ?? [];
    arr.push(t);
    bySig.set(t.sig, arr);
  }
  const unusual: UnusualCharge[] = [];
  for (const [sig, arr] of bySig) {
    if (arr.length < UNUSUAL_MIN_OCCURRENCES) continue;
    const med = median(arr.map((t) => t.amount));
    if (med <= 0) continue;
    for (const t of arr) {
      const ratio = t.amount / med;
      if (t.amount >= UNUSUAL_MIN_AMOUNT && ratio >= UNUSUAL_RATIO) {
        unusual.push({
          vendor: sig,
          description: t.desc,
          amount: t.amount,
          date: iso(t.date),
          medianAmount: med,
          ratio,
        });
      }
    }
  }
  unusual.sort((a, b) => b.ratio - a.ratio);

  const flaggedTotal =
    duplicates.reduce((s, d) => s + d.amount, 0) + unusual.reduce((s, u) => s + u.amount, 0);

  const windowLabel = `${fmtDay(enriched[0].date)} – ${fmtDay(enriched[enriched.length - 1].date)}`;

  return { windowLabel, duplicates, unusual, flaggedTotal, hasData: true };
}
