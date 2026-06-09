// Backfill: seed per-restaurant categorization Rules (replaces the global
// VENDOR_PATTERNS + PAYROLL_CHECK_MIN). All restaurants that exist today are
// Customer Zero's, so they get BOTH the national defaults and the operator-local
// rules (incl. the payroll-checkbook CHECK_MIN). New tenants created after this
// get defaults-only at import time via ensureDefaultRules().
//
//   Plan (dry):  npx dotenv -e .env.local -o -- tsx scripts/backfill-rules.ts
//   Apply:       npx dotenv -e .env.local -o -- tsx scripts/backfill-rules.ts --commit
//   Verify:      npx dotenv -e .env.local -o -- tsx scripts/backfill-rules.ts --verify
//
// Idempotent: --commit clears existing system rules per restaurant, then reseeds.
import { prisma } from "../src/lib/prisma";
import { ensureDefaultCategories, categoryTapById } from "../src/lib/categorization/categories";
import {
  seedRules,
  loadRules,
  applyRules,
  ALL_RULE_SEEDS,
  DEFAULT_RULE_SEEDS,
  OPERATOR_RULE_SEEDS,
} from "../src/lib/categorization/rules";

const COMMIT = process.argv.includes("--commit");
const VERIFY = process.argv.includes("--verify");

async function seed() {
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });
  console.log(
    `Seeds available: ${DEFAULT_RULE_SEEDS.length} default + ${OPERATOR_RULE_SEEDS.length} operator = ${ALL_RULE_SEEDS.length} total\n`,
  );

  for (const r of restaurants) {
    console.log(`${r.name} (${r.id}):`);
    if (!COMMIT) {
      console.log(`  would seed ${ALL_RULE_SEEDS.length} system rules (default + operator)\n`);
      continue;
    }
    await ensureDefaultCategories(prisma, r.id);
    const del = await prisma.rule.deleteMany({ where: { restaurantId: r.id, isSystem: true } });
    const n = await seedRules(prisma, r.id, ALL_RULE_SEEDS);
    console.log(`  cleared ${del.count} existing system rules, seeded ${n}\n`);
  }
}

// Re-runs the rules engine over each restaurant's existing transactions and
// reports how the rule-derived TAP compares to the transaction's current
// category TAP — proves the DB rules reproduce prior categorization.
async function verify() {
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });
  for (const r of restaurants) {
    const rules = await loadRules(prisma, r.id);
    if (rules.length === 0) {
      console.log(`${r.name}: no rules seeded — skipping\n`);
      continue;
    }
    const tapById = await categoryTapById(prisma, r.id);
    const txns = await prisma.transaction.findMany({
      where: { restaurantId: r.id },
      select: { merchantName: true, description: true, amount: true, categoryId: true, isManualOverride: true },
    });

    let matched = 0;
    let agree = 0;
    let inflow = 0;
    const disagreements: string[] = [];
    for (const t of txns) {
      if (Number(t.amount) < 0) { inflow++; continue; } // revenue handled by sign, not rules
      const m = applyRules(rules, t.merchantName, t.description);
      if (!m) continue;
      matched++;
      const ruleTap = tapById.get(m.categoryId);
      const curTap = t.categoryId ? tapById.get(t.categoryId) : undefined;
      if (ruleTap === curTap) agree++;
      else if (!t.isManualOverride && disagreements.length < 8) {
        disagreements.push(`    "${(t.description ?? "").slice(0, 48)}" rule=${ruleTap} current=${curTap ?? "—"}`);
      }
    }
    const expense = txns.length - inflow;
    console.log(
      `${r.name}: ${txns.length} txns (${inflow} inflow) · rules matched ${matched}/${expense} expense · TAP agrees on ${agree}/${matched}`,
    );
    if (disagreements.length) console.log(disagreements.join("\n"));
    console.log("");
  }
}

async function main() {
  if (VERIFY) await verify();
  else await seed();
}

main()
  .catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());
