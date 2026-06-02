// Backfill: move already-imported UNCATEGORIZED payroll checks (number >=
// PAYROLL_CHECK_MIN) to PAYROLL_CHECK. Skips manually-overridden rows so user
// edits are preserved. Only touches rows committed before the bucket existed.
//   Dry run:  npx dotenv -e .env.local -- tsx scripts/recategorize-checks.ts
//   Apply:    npx dotenv -e .env.local -- tsx scripts/recategorize-checks.ts --commit
import { prisma } from "../src/lib/prisma";
import { PAYROLL_CHECK_MIN } from "../src/lib/categorization/vendor-map";

const COMMIT = process.argv.includes("--commit");

async function main() {
  const candidates = await prisma.transaction.findMany({
    where: {
      bucket: "UNCATEGORIZED",
      isManualOverride: false,
      description: { contains: "CHECK", mode: "insensitive" },
    },
    select: { id: true, description: true },
  });

  const toUpdate = candidates.filter((t) => {
    const m = (t.description ?? "").match(/\bcheck\s*#?\s*(\d+)/i);
    return m != null && parseInt(m[1], 10) >= PAYROLL_CHECK_MIN;
  });

  console.log(`UNCATEGORIZED checks scanned: ${candidates.length}`);
  console.log(`Payroll checks (# >= ${PAYROLL_CHECK_MIN}) to move -> PAYROLL_CHECK: ${toUpdate.length}`);

  if (!COMMIT) {
    console.log("\nDRY RUN — nothing changed. Re-run with --commit to apply.");
    return;
  }

  const res = await prisma.transaction.updateMany({
    where: { id: { in: toUpdate.map((t) => t.id) } },
    data: { bucket: "PAYROLL_CHECK", isRecurring: true, confidence: 0.7 },
  });
  console.log(`\nUpdated ${res.count} rows to PAYROLL_CHECK.`);
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
