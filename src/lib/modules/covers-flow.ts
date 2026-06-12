import { prisma } from "@/lib/prisma";

// Covers Flow module data. Reads daily covers/orders/sales from DailySales,
// which is populated from the Toast Analytics (era) API by the Toast → DailySales
// sync (src/lib/integrations/toast/sync.ts). The window is anchored to the most
// recent day that has covers data, so it works whether the rows are Toast-synced
// or seeded.
export interface CoversDay {
  date: string; // YYYY-MM-DD
  covers: number;
  orders: number;
  netSales: number;
  avgCheck: number; // netSales / orders
}

export interface CoversFlowData {
  periodLabel: string;
  days: CoversDay[];
  totalCovers: number;
  avgCoversPerDay: number;
  avgCheck: number; // period: netSales / orders
  busiest: { date: string; covers: number } | null;
  /** Distinct DailySales `source` values feeding this window (e.g. "toast"). */
  sources: string[];
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function loadCoversFlow(
  restaurantId: string,
  windowDays = 21,
): Promise<CoversFlowData> {
  const latest = await prisma.dailySales.findFirst({
    where: { restaurantId, covers: { not: null } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!latest) {
    return {
      periodLabel: "",
      days: [],
      totalCovers: 0,
      avgCoversPerDay: 0,
      avgCheck: 0,
      busiest: null,
      sources: [],
      hasData: false,
    };
  }

  const end = latest.date;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  const rows = await prisma.dailySales.findMany({
    where: { restaurantId, covers: { not: null }, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
    select: { date: true, covers: true, checkCount: true, netSales: true, source: true },
  });

  const days: CoversDay[] = rows.map((r) => {
    const covers = n(r.covers);
    const orders = n(r.checkCount);
    const netSales = n(r.netSales);
    return {
      date: r.date.toISOString().slice(0, 10),
      covers,
      orders,
      netSales,
      avgCheck: orders > 0 ? netSales / orders : 0,
    };
  });

  const totalCovers = days.reduce((s, d) => s + d.covers, 0);
  const totalOrders = days.reduce((s, d) => s + d.orders, 0);
  const totalNet = days.reduce((s, d) => s + d.netSales, 0);
  const busiest = days.reduce<{ date: string; covers: number } | null>((best, d) => {
    return !best || d.covers > best.covers ? { date: d.date, covers: d.covers } : best;
  }, null);

  const ref = end;
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;
  const sources = [...new Set(rows.map((r) => r.source).filter((s): s is string => !!s))];

  return {
    periodLabel,
    days,
    totalCovers,
    avgCoversPerDay: days.length > 0 ? totalCovers / days.length : 0,
    avgCheck: totalOrders > 0 ? totalNet / totalOrders : 0,
    busiest,
    sources,
    hasData: days.length > 0,
  };
}
