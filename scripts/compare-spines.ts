/**
 * Cross-spine parity check — the acceptance instrument for Spec A (ledger convergence).
 *
 * Computes each canonical bucket's period total from BOTH financial spines
 * (legacy Transaction → TapBucket, and clean-ledger LedgerEntry) for one tenant
 * and prints the deltas. When the deltas are ~zero across a trailing month, the
 * spines have converged for that tenant and legacy deletion becomes safe to
 * schedule. Read-only: writes nothing. See docs/fable-5/spec-a2-cashflow-spending.md.
 *
 * Run (slug or name; from/to are ISO dates, both optional):
 *   npx dotenv -e .env.local -o -- tsx scripts/compare-spines.ts "Stone Grille" 2026-06-01 2026-07-01
 *   npx dotenv -e .env.local -o -- tsx scripts/compare-spines.ts "Stone Grille"   # defaults to the latest month of data
 */
import type { TapBucket } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  CANONICAL_BUCKETS,
  computeSpineDeltas,
  ledgerSpineTotals,
  legacySpineTotals,
  spinesConverged,
} from "../src/lib/financial-ledger/spine-compare";

const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Exact @unique slug wins; else an unambiguous name substring (matches the
// triage tool). Read-only here, but still refuse to guess the wrong tenant.
async function resolveTenant(query: string) {
  const bySlug = await prisma.restaurant.findUnique({
    where: { slug: query },
    select: { id: true, name: true, slug: true },
  });
  if (bySlug) return bySlug;
  const byName = await prisma.restaurant.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  if (byName.length === 1) return byName[0];
  if (byName.length === 0) console.error(`No business found matching "${query}".`);
  else console.error(`"${query}" is ambiguous: ${byName.map((r) => `${r.name} (${r.slug})`).join(", ")}. Use an exact slug.`);
  process.exit(1);
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const [queryArg, fromArg, toArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!queryArg) {
    console.error('Usage: compare-spines.ts "<name or slug>" [from-ISO] [to-ISO]');
    process.exit(1);
  }
  const tenant = await resolveTenant(queryArg);

  // Period: explicit [from,to); else the calendar month of the latest activity.
  let from = parseDate(fromArg);
  let to = parseDate(toArg);
  if (fromArg && !from) { console.error(`Invalid --from date "${fromArg}" (use YYYY-MM-DD).`); process.exit(1); }
  if (toArg && !to) { console.error(`Invalid --to date "${toArg}" (use YYYY-MM-DD).`); process.exit(1); }
  if (!from) {
    const [latestTxn, latestLedger] = await Promise.all([
      prisma.transaction.findFirst({ where: { restaurantId: tenant.id }, orderBy: { date: "desc" }, select: { date: true } }),
      prisma.ledgerEntry.findFirst({ where: { restaurantId: tenant.id }, orderBy: { ledgerDate: "desc" }, select: { ledgerDate: true } }),
    ]);
    const ref = [latestTxn?.date, latestLedger?.ledgerDate].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? new Date();
    from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  }
  if (!to) to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));

  // ── Legacy spine: Transaction → Category.tapBucket ──────────
  const [txns, cats] = await Promise.all([
    prisma.transaction.findMany({
      where: { restaurantId: tenant.id, date: { gte: from, lt: to } },
      select: { amount: true, categoryId: true },
    }),
    prisma.category.findMany({ where: { restaurantId: tenant.id }, select: { id: true, tapBucket: true } }),
  ]);
  const tapByCat = new Map<string, TapBucket>(cats.map((c) => [c.id, c.tapBucket]));
  const legacy = legacySpineTotals(txns, tapByCat);

  // ── Clean-ledger spine: LedgerEntry by account ─────────────
  const lines = await prisma.ledgerEntry.findMany({
    where: { restaurantId: tenant.id, ledgerDate: { gte: from, lt: to } },
    select: { ledgerAccount: true, debit: true, credit: true },
  });
  const ledger = ledgerSpineTotals(lines);

  const deltas = computeSpineDeltas(legacy, ledger);
  const converged = spinesConverged(deltas);

  console.log(`\n${"═".repeat(76)}`);
  console.log(`${tenant.name} (${tenant.slug}) — spine parity, ${iso(from)} → ${iso(to)}`);
  console.log("═".repeat(76));
  console.log(`${"BUCKET".padEnd(14)}${"LEGACY".padStart(16)}${"LEDGER".padStart(16)}${"Δ".padStart(14)}${"Δ%".padStart(10)}`);
  for (const d of deltas) {
    console.log(
      `${d.bucket.padEnd(14)}${money(d.legacy).padStart(16)}${money(d.ledger).padStart(16)}${money(d.delta).padStart(14)}${(d.pctDelta == null ? "—" : `${d.pctDelta}%`).padStart(10)}`,
    );
  }
  if (deltas.length === 0) console.log("(no activity in either spine for this period)");
  console.log("─".repeat(76));
  console.log(
    converged
      ? "✓ Spines converged (every bucket within 1% / $1). Legacy deletion for this window is safe to schedule."
      : "✗ Spines diverge. Investigate the buckets above — each residual should trace to a named open sync exception before legacy is retired.",
  );
  console.log(`\nCanonical buckets: ${CANONICAL_BUCKETS.join(", ")}. Read-only — nothing written.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
