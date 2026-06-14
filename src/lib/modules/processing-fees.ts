import { prisma } from "@/lib/prisma";
import type { HealthStatus } from "@/lib/profit-first/calculator";

// Processing Fee Leak module — payment-processing (card) fees as a share of
// sales, banded against a benchmark to surface effective-rate creep, junk fees,
// and downgrades. Every tenth of a point of processing cost is real cash off the
// top of every card sale, so a 0.3-pt creep on a $1.5M house is ~$4.5k/yr gone.
//
//   Processing rate = card fees ÷ card volume.
//
// What we actually have vs. the ideal:
//   • Card fees come from categorized bank Transactions matched against a curated
//     list of processors (Toast, Square, Stripe, Heartland, Fiserv, …) plus generic
//     "merchant service / bankcard / discount fee" descriptors. We show the matched
//     line items so the number is auditable, not a black box.
//   • Card volume — we don't capture tender-level card vs. cash from Toast, so we
//     use GROSS sales as the denominator (the closest proxy: it's the charged base
//     incl. tax). Tips aren't in our sales base, so true card volume is a bit higher
//     and the real effective rate is modestly *lower* than shown — footnoted.
//
// Net-settlement caveat: many processors (incl. Toast) deduct fees BEFORE the
// deposit, so the fee never lands as its own bank transaction. When detected fees
// are implausibly small vs. sales we flag `lowCoverage` rather than report a
// falsely rosy rate — the honest signal is "we may not be seeing your fees."

export interface FeeProcessorLine {
  processor: string;
  amount: number;
  count: number;
}

export interface FeeMonth {
  month: string; // YYYY-MM
  label: string; // "Mar"
  sales: number; // gross sales (denominator base)
  fees: number;
  ratePct: number; // fees / sales × 100
  partial: boolean; // the in-progress current month
}

export interface FeeLineItem {
  date: string; // YYYY-MM-DD
  processor: string;
  merchant: string;
  amount: number;
}

export interface ProcessingFeesData {
  periodLabel: string;
  windowDays: number;
  salesBase: number; // gross sales over the window (card-volume proxy)
  netSales: number;
  totalFees: number;
  ratePct: number; // totalFees / salesBase × 100
  targetRatePct: number;
  leakPct: number; // max(0, ratePct − target)
  leakDollars: number; // leakPct of salesBase over the window
  annualizedLeak: number; // leakDollars scaled to a full year
  months: FeeMonth[]; // oldest → newest
  processors: FeeProcessorLine[]; // largest first
  lineItems: FeeLineItem[]; // detected fee txns, largest first (capped)
  lowCoverage: boolean; // detected fees implausibly low → likely net settlement
  health: HealthStatus;
  hasData: boolean;
}

// Benchmark bands (whole-number percents of sales). All-in card processing for a
// full-service restaurant runs ~2.5–3.0% of card volume; as a share of gross sales
// (incl. tax, excl. tips) ~2.75% is a fair target. Cost metric — lower is better.
export const TARGET_FEE_RATE_PCT = 2.75;
export const FEE_CREEP_PCT = 0.5; // target..+creep = yellow; above = red
// Below this, detected fees almost certainly understate reality (net settlement).
export const MIN_PLAUSIBLE_RATE_PCT = 1.0;

export function bandFeeRate(ratePct: number): HealthStatus {
  if (ratePct <= TARGET_FEE_RATE_PCT) return "green";
  if (ratePct <= TARGET_FEE_RATE_PCT + FEE_CREEP_PCT) return "yellow";
  return "red";
}

// Curated processor detection. Specific processors first; the generic card-fee
// descriptors last so a named processor wins the label. Matched against
// `${merchantName} ${description}`.
const PROCESSOR_PATTERNS: { re: RegExp; label: string }[] = [
  // Payroll/tax Toast lines are excluded upstream by the negative lookahead.
  { re: /toast(?!\s*payroll)\b|toast,?\s*inc|toast\s*\/\s*eom/i, label: "Toast" },
  { re: /\bsquare\b|squareup|sq\s*\*/i, label: "Square" },
  { re: /\bstripe\b/i, label: "Stripe" },
  { re: /\bclover\b/i, label: "Clover" },
  { re: /heartland/i, label: "Heartland" },
  { re: /fiserv|first\s*data/i, label: "Fiserv / First Data" },
  { re: /worldpay|vantiv/i, label: "Worldpay" },
  { re: /\btsys\b/i, label: "TSYS" },
  { re: /elavon/i, label: "Elavon" },
  { re: /global\s*payments/i, label: "Global Payments" },
  { re: /shift\s*4|shift4/i, label: "Shift4" },
  { re: /paymentech|chase\s*merchant/i, label: "Chase / Paymentech" },
  { re: /banc?\s*of\s*america\s*merch|bofa\s*merch/i, label: "BofA Merchant" },
  // Generic card-processing descriptors.
  {
    re: /merch(ant)?\s*(svc|serv|service|fee|disc|bankcard)|bankcard|card\s*(processing|fees?)|discount\s*fee|interchange|cc\s*fees?|visa\/mc|mc\/visa/i,
    label: "Card Processing",
  },
];

export function detectProcessor(merchant: string | null, description: string | null): string | null {
  const hay = `${merchant ?? ""} ${description ?? ""}`.trim();
  if (!hay) return null;
  for (const p of PROCESSOR_PATTERNS) if (p.re.test(hay)) return p.label;
  return null;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LINE_ITEM_CAP = 25;
const DAYS_PER_YEAR = 365;

const empty = (periodLabel = ""): ProcessingFeesData => ({
  periodLabel,
  windowDays: 0,
  salesBase: 0,
  netSales: 0,
  totalFees: 0,
  ratePct: 0,
  targetRatePct: TARGET_FEE_RATE_PCT,
  leakPct: 0,
  leakDollars: 0,
  annualizedLeak: 0,
  months: [],
  processors: [],
  lineItems: [],
  lowCoverage: false,
  health: "green",
  hasData: false,
});

export async function loadProcessingFees(restaurantId: string, months = 6): Promise<ProcessingFeesData> {
  // Anchor on the latest day with sales data; window = `months` calendar months.
  const latestRow = await prisma.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latestRow) return empty();

  const ref = latestRow.date;
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1)); // exclusive
  const windowStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - (months - 1), 1));
  const currentMonthKey = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;

  const [salesRows, txns] = await Promise.all([
    prisma.dailySales.findMany({
      where: { restaurantId, date: { gte: windowStart, lt: end } },
      select: { date: true, grossSales: true, netSales: true },
    }),
    prisma.transaction.findMany({
      where: { restaurantId, date: { gte: windowStart, lt: end } },
      select: { date: true, amount: true, merchantName: true, description: true },
    }),
  ]);

  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  interface MBucket {
    sales: number;
    fees: number;
  }
  const mk = (): MBucket => ({ sales: 0, fees: 0 });
  const monthBuckets = new Map<string, MBucket>();
  // Seed every month in the window so the trend has no gaps.
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1));
    monthBuckets.set(monthKey(d), mk());
  }

  let salesBase = 0;
  let netSales = 0;
  for (const r of salesRows) {
    const gross = n(r.grossSales) || n(r.netSales);
    salesBase += gross;
    netSales += n(r.netSales);
    const b = monthBuckets.get(monthKey(r.date)) ?? mk();
    b.sales += gross;
    monthBuckets.set(monthKey(r.date), b);
  }

  const procAgg = new Map<string, { amount: number; count: number }>();
  const lineItems: FeeLineItem[] = [];
  let totalFees = 0;
  for (const t of txns) {
    const amt = n(t.amount);
    if (amt <= 0) continue; // outflows are positive; ignore credits/refunds
    const processor = detectProcessor(t.merchantName, t.description);
    if (!processor) continue;
    totalFees += amt;
    const b = monthBuckets.get(monthKey(t.date)) ?? mk();
    b.fees += amt;
    monthBuckets.set(monthKey(t.date), b);
    const pa = procAgg.get(processor) ?? { amount: 0, count: 0 };
    pa.amount += amt;
    pa.count += 1;
    procAgg.set(processor, pa);
    lineItems.push({
      date: t.date.toISOString().slice(0, 10),
      processor,
      merchant: t.merchantName ?? t.description ?? processor,
      amount: amt,
    });
  }

  const months_ = [...monthBuckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, b]) => ({
      month,
      label: MONTHS[Number(month.slice(5)) - 1],
      sales: b.sales,
      fees: b.fees,
      ratePct: b.sales > 0 ? (b.fees / b.sales) * 100 : 0,
      partial: month === currentMonthKey,
    }));

  const ratePct = salesBase > 0 ? (totalFees / salesBase) * 100 : 0;
  const leakPct = Math.max(0, ratePct - TARGET_FEE_RATE_PCT);
  const leakDollars = (leakPct / 100) * salesBase;

  // Window length in days (for annualizing the leak).
  const windowDays = Math.max(
    1,
    Math.round((end.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const annualizedLeak = leakDollars * (DAYS_PER_YEAR / windowDays);

  const processors = [...procAgg.entries()]
    .map(([processor, v]) => ({ processor, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  lineItems.sort((a, b) => b.amount - a.amount);

  const periodMonths = months_.filter((m) => m.sales > 0);
  const periodLabel =
    periodMonths.length > 0
      ? `${periodMonths[0].label}–${periodMonths[periodMonths.length - 1].label} ${ref.getUTCFullYear()}`
      : `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  // Low coverage: we have sales but detected fees imply a sub-plausible rate —
  // almost certainly net settlement (fees deducted before deposit).
  const lowCoverage = salesBase > 0 && ratePct < MIN_PLAUSIBLE_RATE_PCT;

  return {
    periodLabel,
    windowDays,
    salesBase,
    netSales,
    totalFees,
    ratePct,
    targetRatePct: TARGET_FEE_RATE_PCT,
    leakPct,
    leakDollars,
    annualizedLeak,
    months: months_,
    processors,
    lineItems: lineItems.slice(0, LINE_ITEM_CAP),
    lowCoverage,
    health: lowCoverage ? "yellow" : bandFeeRate(ratePct),
    hasData: salesBase > 0,
  };
}
