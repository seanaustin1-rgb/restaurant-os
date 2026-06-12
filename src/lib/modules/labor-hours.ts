import { prisma } from "@/lib/prisma";

// Labor Hours module data — ACTUAL hours from Toast era (hourlyJobTotalHours,
// synced into DailySales.laborHours/laborCost). Scheduled-vs-actual variance is
// out of scope until Sling scheduling data is connected; this shows actual hours,
// labor cost, and sales-per-labor-hour with a week-over-week trend. YoY columns
// appear only when a matching prior-year week exists (gated, never invented) —
// see docs/specs/labor-hours-module.md.
export interface LaborWeek {
  weekStart: string; // YYYY-MM-DD (Mon)
  hours: number;
  laborCost: number;
  netSales: number;
  salesPerLaborHour: number; // netSales / hours
  laborPct: number; // laborCost / netSales * 100
  partial: boolean; // fewer than 7 days of data (in-progress / edge week)
}

export interface LaborHoursData {
  periodLabel: string;
  weeks: LaborWeek[]; // oldest → newest, up to 4
  latest: LaborWeek | null;
  wowHoursDelta: number | null; // latest vs prior full week
  hasYoY: boolean; // true only if a prior-year matching week exists
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Monday (UTC) of the week containing `d`. */
function weekStartUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

export async function loadLaborHours(
  restaurantId: string,
  weeks = 4,
): Promise<LaborHoursData> {
  const latestRow = await prisma.dailySales.findFirst({
    where: { restaurantId, laborHours: { not: null } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!latestRow) {
    return {
      periodLabel: "",
      weeks: [],
      latest: null,
      wowHoursDelta: null,
      hasYoY: false,
      hasData: false,
    };
  }

  // Window: the last `weeks` full weeks up to and including the latest day's week.
  const end = latestRow.date;
  const currentWeekStart = weekStartUTC(end);
  const windowStart = new Date(currentWeekStart);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7 * (weeks - 1));

  const rows = await prisma.dailySales.findMany({
    where: {
      restaurantId,
      laborHours: { not: null },
      date: { gte: windowStart, lte: end },
    },
    orderBy: { date: "asc" },
    select: { date: true, laborHours: true, laborCost: true, netSales: true },
  });

  // Bucket rows into weeks.
  const buckets = new Map<string, { hours: number; laborCost: number; netSales: number; days: number }>();
  for (const r of rows) {
    const key = weekStartUTC(r.date).toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { hours: 0, laborCost: 0, netSales: 0, days: 0 };
    b.hours += n(r.laborHours);
    b.laborCost += n(r.laborCost);
    b.netSales += n(r.netSales);
    b.days += 1;
    buckets.set(key, b);
  }

  const weekList: LaborWeek[] = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, b]) => ({
      weekStart,
      hours: b.hours,
      laborCost: b.laborCost,
      netSales: b.netSales,
      salesPerLaborHour: b.hours > 0 ? b.netSales / b.hours : 0,
      laborPct: b.netSales > 0 ? (b.laborCost / b.netSales) * 100 : 0,
      partial: b.days < 7,
    }));

  const latest = weekList.length ? weekList[weekList.length - 1] : null;
  // WoW compares the two most recent FULL weeks only — a partial/in-progress
  // week must never read as a labor drop (per the spec's partial-week rule).
  const fullWeeks = weekList.filter((w) => !w.partial);
  const wowHoursDelta =
    fullWeeks.length >= 2
      ? fullWeeks[fullWeeks.length - 1].hours - fullWeeks[fullWeeks.length - 2].hours
      : null;

  // YoY: only if a matching week one year before the latest week has data.
  const latestWeekStart = latest ? new Date(latest.weekStart + "T00:00:00Z") : null;
  let hasYoY = false;
  if (latestWeekStart) {
    const yoyStart = new Date(latestWeekStart);
    yoyStart.setUTCFullYear(yoyStart.getUTCFullYear() - 1);
    const yoyEnd = new Date(yoyStart);
    yoyEnd.setUTCDate(yoyEnd.getUTCDate() + 6);
    const yoyCount = await prisma.dailySales.count({
      where: { restaurantId, laborHours: { not: null }, date: { gte: yoyStart, lte: yoyEnd } },
    });
    hasYoY = yoyCount > 0;
  }

  const periodLabel = `${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;

  return {
    periodLabel,
    weeks: weekList,
    latest,
    wowHoursDelta,
    hasYoY,
    hasData: weekList.length > 0,
  };
}
