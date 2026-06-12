import { prisma } from "@/lib/prisma";
import type { RevenueCenterSlice } from "@/lib/integrations/toast/sync";

// Sales Mix module data — revenue-center breakdown (Bar / Dining Room / Patio /
// …) aggregated across a recent window from DailySales.mixByRevenueCenter, which
// the Toast sales-mix sync populates from the era groupBy REVENUE_CENTER report.
// (Dining-option / order-source were degenerate for this operator; category /
// menu-item mix would need the /era/v1/menu endpoint — future work.)
export interface MixCenter {
  revenueCenter: string;
  netSales: number;
  orders: number;
  guests: number;
  share: number; // % of total net sales in the window
}

export interface SalesMixData {
  periodLabel: string;
  windowLabel: string; // e.g. "May 22 – Jun 11"
  centers: MixCenter[]; // net-sales desc, zero-sales centers dropped
  totalNet: number;
  topCenter: MixCenter | null;
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;

function asSlices(value: unknown): RevenueCenterSlice[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      revenueCenter: String(s.revenueCenter ?? "Unknown"),
      netSales: n(s.netSales),
      orders: n(s.orders),
      guests: n(s.guests),
    }));
}

export async function loadSalesMix(
  restaurantId: string,
  windowDays = 21,
): Promise<SalesMixData> {
  // Anchor to the most recent daily row that actually carries a mix breakdown.
  const recent = await prisma.dailySales.findMany({
    where: { restaurantId },
    orderBy: { date: "desc" },
    take: 60,
    select: { date: true, mixByRevenueCenter: true },
  });
  const latest = recent.find((r) => asSlices(r.mixByRevenueCenter).length > 0) ?? null;

  if (!latest) {
    return {
      periodLabel: "",
      windowLabel: "",
      centers: [],
      totalNet: 0,
      topCenter: null,
      hasData: false,
    };
  }

  const end = latest.date;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  const rows = await prisma.dailySales.findMany({
    where: { restaurantId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
    select: { date: true, mixByRevenueCenter: true },
  });

  // Aggregate slices across days by revenue center.
  const agg = new Map<string, { netSales: number; orders: number; guests: number }>();
  let actualStart: Date | null = null;
  for (const r of rows) {
    const slices = asSlices(r.mixByRevenueCenter);
    if (slices.length === 0) continue;
    actualStart = actualStart ?? r.date;
    for (const s of slices) {
      const a = agg.get(s.revenueCenter) ?? { netSales: 0, orders: 0, guests: 0 };
      a.netSales += s.netSales;
      a.orders += s.orders;
      a.guests += s.guests;
      agg.set(s.revenueCenter, a);
    }
  }

  const totalNet = [...agg.values()].reduce((s, a) => s + a.netSales, 0);
  const centers: MixCenter[] = [...agg.entries()]
    .map(([revenueCenter, a]) => ({
      revenueCenter,
      netSales: a.netSales,
      orders: a.orders,
      guests: a.guests,
      share: totalNet > 0 ? (a.netSales / totalNet) * 100 : 0,
    }))
    .filter((c) => c.netSales > 0)
    .sort((a, b) => b.netSales - a.netSales);

  const periodLabel = `${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  const windowLabel = actualStart ? `${fmtDay(actualStart)} – ${fmtDay(end)}` : "";

  return {
    periodLabel,
    windowLabel,
    centers,
    totalNet,
    topCenter: centers[0] ?? null,
    hasData: centers.length > 0,
  };
}
