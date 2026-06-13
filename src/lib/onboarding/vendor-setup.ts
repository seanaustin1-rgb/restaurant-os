import { prisma } from "@/lib/prisma";
import { signatureOf } from "@/lib/categorization/suggestions";
import { loadRules, applyRules } from "@/lib/categorization/rules";

// New-tenant setup wizard data — the Pareto list of vendors by total spend, each
// with the system's best-guess category, so a new operator can confirm/reassign
// the few vendors that move the gauges and seed per-tenant rules for the rest.
//
// "Categorization quality IS the product": national vendors get sensible defaults,
// but a tenant's local/regional suppliers land in Misc until named. This surfaces
// the biggest-dollar unnamed vendors first.

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface VendorSetupRow {
  signature: string; // the keyword we'd match a rule on
  label: string; // a representative display string (sample description)
  total: number; // total spend across all history
  count: number;
  /** Best guess category id (dominant assigned category, else what a rule would assign). */
  guessCategoryId: string | null;
  guessCategoryName: string | null;
  /** Where the guess came from, for honest UI. */
  guessSource: "assigned" | "rule" | "none";
  /** True if a rule already maps this keyword (already self-categorizing). */
  hasRule: boolean;
}

export interface CategoryOption {
  id: string;
  name: string;
  tapBucket: string;
}

export interface VendorSetupData {
  rows: VendorSetupRow[];
  categories: CategoryOption[];
  totalSpend: number;
  coveredPct: number; // % of spend already mapped to a non-Misc category
  hasData: boolean;
}

const MISC = "Misc";

export async function loadVendorSetup(restaurantId: string, topN = 20): Promise<VendorSetupData> {
  const [txns, cats, rules] = await Promise.all([
    prisma.transaction.findMany({
      where: { restaurantId, amount: { gt: 0 } }, // outflows only
      select: { amount: true, merchantName: true, description: true, categoryId: true },
    }),
    prisma.category.findMany({
      where: { restaurantId, archivedAt: null },
      select: { id: true, name: true, tapBucket: true },
      orderBy: { sortOrder: "asc" },
    }),
    loadRules(prisma, restaurantId),
  ]);

  const catById = new Map(cats.map((c) => [c.id, c]));

  interface Agg {
    total: number;
    count: number;
    catCounts: Map<string, number>;
    sample: string;
  }
  const groups = new Map<string, Agg>();
  let totalSpend = 0;
  for (const t of txns) {
    const amt = n(t.amount);
    totalSpend += amt;
    const sig = signatureOf(t.merchantName, t.description);
    if (!sig) continue; // one-offs / payee-less checks — not actionable as a vendor rule
    const g = groups.get(sig) ?? { total: 0, count: 0, catCounts: new Map(), sample: "" };
    g.total += amt;
    g.count += 1;
    if (!g.sample) g.sample = (t.merchantName ?? t.description ?? sig).trim();
    if (t.categoryId) g.catCounts.set(t.categoryId, (g.catCounts.get(t.categoryId) ?? 0) + 1);
    groups.set(sig, g);
  }

  let mappedSpend = 0;
  const rows: VendorSetupRow[] = [...groups.entries()].map(([signature, g]) => {
    // Dominant assigned category for this vendor.
    let domId: string | null = null;
    let best = 0;
    for (const [id, c] of g.catCounts) if (c > best) { best = c; domId = id; }
    const domCat = domId ? catById.get(domId) : undefined;

    let guessCategoryId: string | null = null;
    let guessSource: VendorSetupRow["guessSource"] = "none";
    if (domCat && domCat.name !== MISC) {
      guessCategoryId = domCat.id;
      guessSource = "assigned";
      mappedSpend += g.total;
    } else {
      // Nothing meaningful assigned — what would the rules engine guess?
      const match = applyRules(rules, null, signature);
      if (match && catById.has(match.categoryId)) {
        guessCategoryId = match.categoryId;
        guessSource = "rule";
      }
    }
    const guessCat = guessCategoryId ? catById.get(guessCategoryId) : undefined;
    const hasRule = !!applyRules(rules, null, signature);

    return {
      signature,
      label: g.sample || signature,
      total: r2(g.total),
      count: g.count,
      guessCategoryId,
      guessCategoryName: guessCat?.name ?? null,
      guessSource,
      hasRule,
    };
  });

  rows.sort((a, b) => b.total - a.total);

  return {
    rows: rows.slice(0, topN),
    categories: cats.map((c) => ({ id: c.id, name: c.name, tapBucket: c.tapBucket as string })),
    totalSpend: r2(totalSpend),
    coveredPct: totalSpend > 0 ? r2((mappedSpend / totalSpend) * 100) : 0,
    hasData: rows.length > 0,
  };
}
