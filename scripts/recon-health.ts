/**
 * V1 gate check — per-day reconciliation verdict and the current clean streak
 * for one tenant, counted from a cutover date. Bar: 7 consecutive clean days
 * with no manual intervention. Read-only: writes nothing.
 *
 * Run (cutover = first day that counts; to = last day checked, default yesterday UTC):
 *   npx dotenv -e .env.local -o -- tsx scripts/recon-health.ts --tenant <slug> --since 2026-10-19
 *   npx dotenv -e .env.local -o -- tsx scripts/recon-health.ts --tenant <slug> --since 2026-10-19 --to 2026-10-31
 *
 * Bank activity dated before --since is ignored entirely (pre-cutover backlog
 * doesn't count against the gate). Day rules: src/lib/financial-ledger/recon-health.ts.
 */
import type { TapBucket } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { classifyDay, currentStreak, datesBetween, V1_STREAK_TARGET, type DayFacts } from "../src/lib/financial-ledger/recon-health";
import { ledgerSpineTotals, legacySpineTotals } from "../src/lib/financial-ledger/spine-compare";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

// Exact @unique slug wins; else a name substring that matches exactly one business.
async function resolveTenant(query: string) {
  const bySlug = await prisma.restaurant.findUnique({ where: { slug: query }, select: { id: true, name: true, slug: true } });
  if (bySlug) return bySlug;
  const byName = await prisma.restaurant.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  if (byName.length === 1) return byName[0];
  if (byName.length === 0) console.error(`No business found matching "${query}" (tried exact slug and name).`);
  else console.error(`"${query}" is ambiguous — matched ${byName.map((r) => `${r.name} (${r.slug})`).join(", ")}. Use an exact --tenant <slug>.`);
  process.exit(1);
}

async function main() {
  const tenantArg = arg("--tenant");
  const since = arg("--since");
  const yesterday = iso(new Date(Date.now() - 86_400_000));
  const to = arg("--to") ?? yesterday;
  if (!tenantArg || !since || !ISO.test(since) || !ISO.test(to)) {
    console.error("Usage: recon-health.ts --tenant <slug> --since YYYY-MM-DD [--to YYYY-MM-DD]");
    process.exit(1);
  }
  const tenant = await resolveTenant(tenantArg);
  const days = datesBetween(since, to);
  if (days.length === 0) {
    console.log(`Nothing to check yet: --since ${since} is after ${to}.`);
    return;
  }
  const from = new Date(`${since}T00:00:00Z`);
  const until = new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000);
  const range = { gte: from, lt: until };

  const [events, txns, cats, lines, sales, plaid] = await Promise.all([
    prisma.normalizedFinancialEvent.findMany({
      where: { restaurantId: tenant.id, eventDate: range },
      select: { eventDate: true, mappingStatus: true, approvedBy: true },
    }),
    prisma.transaction.findMany({
      where: { restaurantId: tenant.id, date: range },
      select: { date: true, amount: true, categoryId: true },
    }),
    prisma.category.findMany({ where: { restaurantId: tenant.id }, select: { id: true, tapBucket: true } }),
    prisma.ledgerEntry.findMany({
      where: { restaurantId: tenant.id, ledgerDate: range },
      select: { ledgerDate: true, ledgerAccount: true, debit: true, credit: true },
    }),
    prisma.dailySales.findMany({ where: { restaurantId: tenant.id, date: range }, select: { date: true } }),
    prisma.plaidConnection.findMany({
      where: { restaurantId: tenant.id, isActive: true },
      select: { institution: true, lastSyncedAt: true },
    }),
  ]);
  const tapByCat = new Map<string, TapBucket>(cats.map((c) => [c.id, c.tapBucket]));
  const toastDays = new Set(sales.map((s) => iso(s.date)));

  const verdicts = days.map((date) => {
    const dayEvents = events.filter((e) => iso(e.eventDate) === date);
    const facts: DayFacts = {
      date,
      pendingReview: dayEvents.filter((e) => e.mappingStatus === "PENDING_REVIEW").length,
      manuallyDecided: dayEvents.filter((e) => e.approvedBy != null || e.mappingStatus === "EXCLUDED").length,
      toastSynced: toastDays.has(date),
      legacy: legacySpineTotals(txns.filter((t) => iso(t.date) === date), tapByCat),
      ledger: ledgerSpineTotals(lines.filter((l) => iso(l.ledgerDate) === date)),
    };
    return classifyDay(facts);
  });

  console.log(`\n${tenant.name} (${tenant.slug}) — reconciliation health ${since} → ${to}`);
  console.log("─".repeat(76));
  for (const v of verdicts) {
    const detail = v.clean
      ? ""
      : v.issues
          .map((i) =>
            i === "pending-review" ? `${v.pendingReview} pending review`
            : i === "manual-intervention" ? `${v.manuallyDecided} hand-decided`
            : i === "spines-diverge" ? `spines Δ ${v.deltas.filter((d) => Math.abs(d.delta) > 1).map((d) => `${d.bucket} ${d.delta}`).join(", ")}`
            : "no Toast sales row",
          )
          .join("; ");
    console.log(`${v.date}  ${v.clean ? "CLEAN" : "DIRTY"}  ${detail}`);
  }
  const streak = currentStreak(verdicts);
  console.log("─".repeat(76));
  console.log(`Current clean streak: ${streak} day${streak === 1 ? "" : "s"} (V1 target: ${V1_STREAK_TARGET}).`);
  console.log(streak >= V1_STREAK_TARGET ? "✓ V1 reconciliation bar met for this window." : "✗ V1 bar not met yet.");
  for (const p of plaid) {
    const age = p.lastSyncedAt ? Math.round((Date.now() - p.lastSyncedAt.getTime()) / 3_600_000) : null;
    console.log(`Plaid ${p.institution ?? "connection"}: last synced ${age == null ? "never" : `${age}h ago`}${age != null && age > 36 ? "  ⚠ stale" : ""}`);
  }
  if (plaid.length === 0) console.log("⚠ No active Plaid connection — bank days can't be checked.");
  console.log("\nRead-only — nothing written.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
