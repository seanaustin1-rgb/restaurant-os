import { prisma } from "@/lib/prisma";
import { signatureOf } from "@/lib/categorization/suggestions";

// Recurring & Subscriptions module — the zombie-subscription killer. Groups
// outflows by vendor signature (same logic as Vendor Spend / the rules engine)
// across full transaction history, then identifies recurring relationships two
// ways: data-driven cadence (≥3 occurrences at a steady interval) OR the
// vendor-map's isRecurring flag (catches monthly vendors that appear once in a
// short history). Subscription-like = low amount variability (fixed price);
// price creep = latest charge above the average of the prior ones.
export type Cadence = "daily" | "weekly" | "biweekly" | "monthly" | "irregular" | "unknown";

export interface RecurringVendor {
  vendor: string;
  count: number;
  total: number;
  avgAmount: number;
  lastAmount: number;
  lastDate: string; // YYYY-MM-DD
  cadence: Cadence;
  medianIntervalDays: number | null;
  subscriptionLike: boolean; // low amount variability — fixed-price feel
  estMonthly: number; // estimated monthly cost
  creepPct: number | null; // latest vs prior avg, % (subscription-like only)
  flaggedByVendorMap: boolean;
  categoryName: string | null;
}

export interface RecurringData {
  windowLabel: string;
  windowDays: number;
  shortHistory: boolean; // < 60 days of data — cadence/creep are tentative
  vendors: RecurringVendor[]; // estMonthly desc
  totalEstMonthly: number;
  subscriptionCount: number;
  creepCount: number;
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const DAY_MS = 86_400_000;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function cadenceOf(intervalDays: number | null): Cadence {
  if (intervalDays == null) return "unknown";
  if (intervalDays <= 2) return "daily";
  if (intervalDays <= 9) return "weekly";
  if (intervalDays <= 18) return "biweekly";
  if (intervalDays <= 35) return "monthly";
  return "irregular";
}

export async function loadRecurring(restaurantId: string): Promise<RecurringData> {
  const [txns, cats] = await Promise.all([
    prisma.transaction.findMany({
      where: { restaurantId, amount: { gt: 0 } }, // outflows only
      orderBy: { date: "asc" },
      select: {
        date: true,
        amount: true,
        merchantName: true,
        description: true,
        isRecurring: true,
        categoryId: true,
      },
    }),
    prisma.category.findMany({ where: { restaurantId }, select: { id: true, name: true } }),
  ]);

  if (txns.length === 0) {
    return {
      windowLabel: "",
      windowDays: 0,
      shortHistory: true,
      vendors: [],
      totalEstMonthly: 0,
      subscriptionCount: 0,
      creepCount: 0,
      hasData: false,
    };
  }

  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const windowStart = txns[0].date;
  const windowEnd = txns[txns.length - 1].date;
  const windowDays = Math.max(1, Math.round((windowEnd.getTime() - windowStart.getTime()) / DAY_MS) + 1);

  interface Group {
    dates: Date[];
    amounts: number[];
    flagged: boolean;
    catCounts: Map<string, number>;
  }
  const groups = new Map<string, Group>();
  for (const t of txns) {
    const sig = signatureOf(t.merchantName, t.description);
    if (!sig) continue;
    const g: Group =
      groups.get(sig) ?? { dates: [], amounts: [], flagged: false, catCounts: new Map() };
    g.dates.push(t.date);
    g.amounts.push(n(t.amount));
    g.flagged = g.flagged || t.isRecurring;
    const cn = t.categoryId ? catName.get(t.categoryId) ?? null : null;
    if (cn) g.catCounts.set(cn, (g.catCounts.get(cn) ?? 0) + 1);
    groups.set(sig, g);
  }

  const vendors: RecurringVendor[] = [];
  for (const [vendor, g] of groups) {
    const count = g.dates.length;

    // Intervals between consecutive occurrences (calendar days).
    let medianInterval: number | null = null;
    if (count >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < g.dates.length; i++) {
        intervals.push((g.dates[i].getTime() - g.dates[i - 1].getTime()) / DAY_MS);
      }
      medianInterval = median(intervals);
    }
    const cadence = cadenceOf(medianInterval);

    // Recurring if cadence is steady across ≥3 hits, or the vendor map says so.
    const dataDriven = count >= 3 && cadence !== "irregular" && cadence !== "unknown";
    if (!dataDriven && !g.flagged) continue;

    const total = g.amounts.reduce((s, a) => s + a, 0);
    const avgAmount = total / count;
    const lastAmount = g.amounts[g.amounts.length - 1];

    // Subscription-like: amounts barely vary (coefficient of variation < 0.10).
    // Looser thresholds badge suppliers with steadily-growing orders as "subs"
    // (e.g. a beer distributor ordering up each week is not price creep).
    const variance = g.amounts.reduce((s, a) => s + (a - avgAmount) ** 2, 0) / count;
    const cv = avgAmount > 0 ? Math.sqrt(variance) / avgAmount : 0;
    const subscriptionLike = count >= 2 && cv < 0.1;

    // Price creep — only meaningful for fixed-price charges with history.
    let creepPct: number | null = null;
    if (subscriptionLike && count >= 3) {
      const priorAvg = (total - lastAmount) / (count - 1);
      if (priorAvg > 0) {
        const pct = ((lastAmount - priorAvg) / priorAvg) * 100;
        if (Math.abs(pct) >= 2) creepPct = pct;
      }
    }

    // Estimated monthly cost. Cadence projection (avg × 30/interval) is only
    // trustworthy for fixed-price charges; for variable vendors (payroll, tax
    // pulls, suppliers — often mixed sizes in one signature) it wildly inflates,
    // so pro-rate their ACTUAL spend in the window instead.
    const estMonthly =
      subscriptionLike && medianInterval && medianInterval > 0 && cadence !== "irregular"
        ? avgAmount * (30 / medianInterval)
        : (total / windowDays) * 30;

    let categoryName: string | null = null;
    let best = 0;
    for (const [name, c] of g.catCounts) {
      if (c > best) {
        best = c;
        categoryName = name;
      }
    }

    vendors.push({
      vendor,
      count,
      total,
      avgAmount,
      lastAmount,
      lastDate: g.dates[g.dates.length - 1].toISOString().slice(0, 10),
      cadence,
      medianIntervalDays: medianInterval,
      subscriptionLike,
      estMonthly,
      creepPct,
      flaggedByVendorMap: g.flagged,
      categoryName,
    });
  }

  vendors.sort((a, b) => b.estMonthly - a.estMonthly);

  return {
    windowLabel: `${fmtDay(windowStart)} – ${fmtDay(windowEnd)}`,
    windowDays,
    shortHistory: windowDays < 60,
    vendors,
    totalEstMonthly: vendors.reduce((s, v) => s + v.estMonthly, 0),
    subscriptionCount: vendors.filter((v) => v.subscriptionLike).length,
    creepCount: vendors.filter((v) => v.creepPct != null && v.creepPct > 0).length,
    hasData: vendors.length > 0,
  };
}
