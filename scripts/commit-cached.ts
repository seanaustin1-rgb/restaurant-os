// Commit the cached extracted statement transactions directly to the DB,
// replicating /api/import (credit -> negative) + /api/import/commit
// (categorize + synthetic plaidTxnId dedup) without the browser/Clerk.
//
//   Dry run:  npx dotenv -e .env.local -- tsx scripts/commit-cached.ts
//   Commit:   npx dotenv -e .env.local -- tsx scripts/commit-cached.ts --commit
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { categorizeTransaction } from "../src/lib/categorization/vendor-map";

interface LlmTxn { date: string; description: string; amount: number; direction: "debit" | "credit"; }

const COMMIT = process.argv.includes("--commit");
const cache = JSON.parse(readFileSync("scripts/.cache-txns.json", "utf8")) as LlmTxn[];

async function main() {
  // Show every operator/manager role so we can confirm the target restaurant.
  const roles = await prisma.userRestaurantRole.findMany({ include: { restaurant: true } });
  console.log(`Found ${roles.length} user-restaurant role(s):`);
  for (const r of roles) {
    const txns = await prisma.transaction.count({ where: { restaurantId: r.restaurantId } });
    console.log(`  ${r.role.padEnd(10)} restaurant="${r.restaurant?.name}" (${r.restaurantId})  existingTxns=${txns}  clerkUser=${r.clerkUserId}`);
  }

  const role = await prisma.userRestaurantRole.findFirst({
    where: { role: { in: ["OPERATOR", "MANAGER"] } },
    include: { restaurant: true },
  });
  if (!role) {
    console.log("\nNo OPERATOR/MANAGER role found — sign in + onboard a restaurant first.");
    return;
  }
  console.log(`\n>>> TARGET: "${role.restaurant?.name}" (${role.restaurantId})`);

  // /api/import mapping: credits/deposits -> negative.
  const candidates = cache.map((t) => ({
    date: t.date,
    description: t.description,
    amount: t.direction === "credit" ? -Math.abs(t.amount) : Math.abs(t.amount),
  }));

  // /api/import/commit: REVENUE for inflows, else vendor rules; dedup hash.
  const data = candidates.map((t) => {
    const cat =
      t.amount < 0
        ? { bucket: "REVENUE" as const, isRecurring: false, confidence: 0.9 }
        : categorizeTransaction(null, t.description);
    const hash = createHash("sha1").update(`${t.date}|${t.amount}|${t.description}`).digest("hex").slice(0, 16);
    return {
      restaurantId: role.restaurantId,
      plaidTxnId: `stmt-${role.restaurantId}-${hash}`,
      date: new Date(t.date),
      amount: t.amount,
      merchantName: null,
      description: t.description,
      bucket: cat.bucket,
      isRecurring: cat.isRecurring,
      confidence: cat.confidence,
      isManualOverride: false,
    };
  });

  const byBucket: Record<string, { n: number; sum: number }> = {};
  for (const d of data) {
    const b = byBucket[d.bucket] ?? { n: 0, sum: 0 };
    b.n++; b.sum += d.amount; byBucket[d.bucket] = b;
  }
  console.log(`\n${data.length} rows would be written, by bucket:`);
  for (const [b, v] of Object.entries(byBucket).sort((a, c) => c[1].sum - a[1].sum)) {
    console.log(`  ${b.padEnd(16)} ${String(v.n).padStart(4)} rows   $${v.sum.toFixed(2)}`);
  }

  if (!COMMIT) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to insert.");
    return;
  }

  const result = await prisma.transaction.createMany({ data, skipDuplicates: true });
  console.log(`\nINSERTED ${result.count} of ${data.length} transactions (skipDuplicates dropped ${data.length - result.count}).`);
}

main()
  .catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());
