import { prisma } from "@/lib/prisma";
import { signatureOf } from "@/lib/categorization/suggestions";

// Vendor Spend module. Groups expense transactions (outflows = positive amount)
// for the period by a derived vendor keyword, largest spend first, with each
// vendor's dominant category and share of total spend.
export interface VendorRow {
  vendor: string;
  total: number;
  count: number;
  share: number; // % of total spend
  categoryName: string | null;
}

export interface VendorSpendData {
  periodLabel: string;
  totalSpend: number;
  vendorCount: number;
  vendors: VendorRow[];
  hasData: boolean;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OTHER = "Other / one-offs";

export async function loadVendorSpend(restaurantId: string): Promise<VendorSpendData> {
  const latest = await prisma.transaction.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

  const [txns, cats] = await Promise.all([
    prisma.transaction.findMany({
      where: { restaurantId, date: { gte: start, lt: end }, amount: { gt: 0 } },
      select: { amount: true, merchantName: true, description: true, categoryId: true },
    }),
    prisma.category.findMany({ where: { restaurantId }, select: { id: true, name: true } }),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  interface Agg { total: number; count: number; catCounts: Map<string, number> }
  const groups = new Map<string, Agg>();
  let totalSpend = 0;
  for (const t of txns) {
    const amt = n(t.amount);
    totalSpend += amt;
    const vendor = signatureOf(t.merchantName, t.description) ?? OTHER;
    const g = groups.get(vendor) ?? { total: 0, count: 0, catCounts: new Map() };
    g.total += amt;
    g.count += 1;
    const cn = t.categoryId ? catName.get(t.categoryId) ?? null : null;
    if (cn) g.catCounts.set(cn, (g.catCounts.get(cn) ?? 0) + 1);
    groups.set(vendor, g);
  }

  const vendors: VendorRow[] = [...groups.entries()]
    .map(([vendor, g]) => {
      // dominant category for this vendor
      let categoryName: string | null = null;
      let best = 0;
      for (const [name, c] of g.catCounts) if (c > best) { best = c; categoryName = name; }
      return {
        vendor,
        total: g.total,
        count: g.count,
        share: totalSpend > 0 ? (g.total / totalSpend) * 100 : 0,
        categoryName,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { periodLabel, totalSpend, vendorCount: vendors.length, vendors, hasData: vendors.length > 0 };
}
