import { prisma } from "@/lib/prisma";

// Menu Engineering module data — popularity × revenue quadrants over a recent
// window, from MenuItemSales (Toast era menu report, groupBy MENU_ITEM).
//
// HONESTY NOTE: classic menu engineering (Kasavana–Smith) classifies on
// popularity × CONTRIBUTION MARGIN. Item cost isn't available from the Toast
// Analytics API, so this uses popularity × net revenue instead — useful for
// spotting volume/revenue outliers, not margin decisions. The page says so.
// Thresholds: median quantity and median net sales across qualifying items.
export type Quadrant = "star" | "workhorse" | "puzzle" | "dog";

export interface MenuItemStat {
  menuItemGuid: string;
  name: string;
  quantity: number;
  netSales: number;
  avgPrice: number; // netSales / quantity
  quadrant: Quadrant;
}

export interface MenuEngineeringData {
  windowLabel: string; // e.g. "May 15 – Jun 11"
  items: MenuItemStat[]; // net-sales desc
  medianQuantity: number;
  medianNetSales: number;
  counts: Record<Quadrant, number>;
  totalNet: number;
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function loadMenuEngineering(
  restaurantId: string,
  windowDays = 28,
): Promise<MenuEngineeringData> {
  const latest = await prisma.menuItemSales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!latest) {
    return {
      windowLabel: "",
      items: [],
      medianQuantity: 0,
      medianNetSales: 0,
      counts: { star: 0, workhorse: 0, puzzle: 0, dog: 0 },
      totalNet: 0,
      hasData: false,
    };
  }

  const end = latest.date;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  const rows = await prisma.menuItemSales.findMany({
    where: { restaurantId, date: { gte: start, lte: end } },
    select: { menuItemGuid: true, menuItemName: true, quantitySold: true, netSales: true },
  });

  // Aggregate per item across the window.
  const agg = new Map<string, { name: string; quantity: number; netSales: number }>();
  for (const r of rows) {
    const a = agg.get(r.menuItemGuid) ?? { name: r.menuItemName, quantity: 0, netSales: 0 };
    a.quantity += r.quantitySold;
    a.netSales += n(r.netSales);
    a.name = r.menuItemName; // latest name wins
    agg.set(r.menuItemGuid, a);
  }

  // Qualify: sold at least once with real revenue (drops water, $0 modifiers,
  // event placeholders that would distort the medians).
  const qualified = [...agg.entries()]
    .map(([menuItemGuid, a]) => ({ menuItemGuid, ...a }))
    .filter((a) => a.quantity > 0 && a.netSales > 0);

  const medianQuantity = median(qualified.map((a) => a.quantity).sort((x, y) => x - y));
  const medianNetSales = median(qualified.map((a) => a.netSales).sort((x, y) => x - y));

  const items: MenuItemStat[] = qualified
    .map((a) => {
      const popular = a.quantity >= medianQuantity;
      const lucrative = a.netSales >= medianNetSales;
      const quadrant: Quadrant = popular
        ? lucrative
          ? "star"
          : "workhorse"
        : lucrative
          ? "puzzle"
          : "dog";
      return {
        menuItemGuid: a.menuItemGuid,
        name: a.name,
        quantity: a.quantity,
        netSales: a.netSales,
        avgPrice: a.quantity > 0 ? a.netSales / a.quantity : 0,
        quadrant,
      };
    })
    .sort((x, y) => y.netSales - x.netSales);

  const counts: Record<Quadrant, number> = { star: 0, workhorse: 0, puzzle: 0, dog: 0 };
  for (const i of items) counts[i.quadrant]++;

  return {
    windowLabel: `${fmtDay(start)} – ${fmtDay(end)}`,
    items,
    medianQuantity,
    medianNetSales,
    counts,
    totalNet: items.reduce((s, i) => s + i.netSales, 0),
    hasData: items.length > 0,
  };
}
