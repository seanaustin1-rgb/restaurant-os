/**
 * Triage open clean-ledger sync exceptions by vendor group instead of row-by-row.
 *
 * Run:  npx dotenv -e .env.local -o -- tsx scripts/summarize-sync-exceptions.ts [restaurant-slug]
 *
 * The 06-27 go-live audit left Stone with 373 warning-level exceptions and no
 * summary of what's actually behind them. This script groups every OPEN
 * exception by (issueType, vendor signature) with dollar totals and what the
 * current rules engine would guess — so an operator/consultant can clear the
 * backlog in a handful of batch decisions on /settings/sources/review rather
 * than 373 individual ones. Read-only: writes nothing.
 */
import { prisma } from "../src/lib/prisma";
import { loadRules, applyRules } from "../src/lib/categorization/rules";
import { signatureOf } from "../src/lib/categorization/suggestions";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function main() {
  const slugArg = process.argv[2];

  const restaurants = await prisma.restaurant.findMany({
    where: slugArg ? { slug: slugArg } : undefined,
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });
  if (restaurants.length === 0) {
    console.error(slugArg ? `No business found with slug "${slugArg}".` : "No businesses found.");
    process.exit(1);
  }

  for (const r of restaurants) {
    const open = await prisma.syncException.findMany({
      where: { restaurantId: r.id, resolvedAt: null },
      select: {
        id: true,
        severity: true,
        issueType: true,
        message: true,
        normalizedFinancialEvent: {
          select: {
            eventDate: true,
            eventType: true,
            amount: true,
            counterparty: true,
            description: true,
            mappingStatus: true,
            confidence: true,
          },
        },
      },
    });

    if (open.length === 0) {
      console.log(`\n${r.name} (${r.slug}) — 0 open exceptions. Clean.`);
      continue;
    }

    const [rules, cats] = await Promise.all([
      loadRules(prisma, r.id),
      prisma.category.findMany({
        where: { restaurantId: r.id },
        select: { id: true, name: true, tapBucket: true },
      }),
    ]);
    const catById = new Map(cats.map((c) => [c.id, c]));

    interface Group {
      count: number;
      total: number;
      severities: Set<string>;
      sample: string;
      ruleGuess: string;
      dates: { min: string; max: string };
    }
    const groups = new Map<string, Group>();

    for (const ex of open) {
      const ev = ex.normalizedFinancialEvent;
      const merchant = ev?.counterparty ?? null;
      const description = ev?.description ?? ex.message;
      const sig = signatureOf(merchant, description) ?? "(no vendor signature)";
      const key = `${ex.issueType} :: ${sig}`;
      const amount = ev ? Math.abs(Number(ev.amount)) : 0;
      const date = ev ? ev.eventDate.toISOString().slice(0, 10) : "";

      let g = groups.get(key);
      if (!g) {
        const match = applyRules(rules, merchant, description);
        const guessCat = match ? catById.get(match.categoryId) : undefined;
        g = {
          count: 0,
          total: 0,
          severities: new Set(),
          sample: (merchant ?? description ?? "").slice(0, 60),
          ruleGuess: guessCat ? `${guessCat.name} → ${guessCat.tapBucket}` : "no rule match (Misc)",
          dates: { min: date || "9999", max: date || "0000" },
        };
        groups.set(key, g);
      }
      g.count += 1;
      g.total += amount;
      g.severities.add(ex.severity);
      if (date) {
        if (date < g.dates.min) g.dates.min = date;
        if (date > g.dates.max) g.dates.max = date;
      }
    }

    const sorted = [...groups.entries()].sort((a, b) => b[1].total - a[1].total);
    const totalDollars = sorted.reduce((s, [, g]) => s + g.total, 0);

    console.log(`\n${"═".repeat(78)}`);
    console.log(`${r.name} (${r.slug}) — ${open.length} open exceptions in ${sorted.length} groups, ${money(totalDollars)} gross`);
    console.log("═".repeat(78));
    console.log(
      `${"COUNT".padStart(5)}  ${"GROSS $".padStart(12)}  ${"ISSUE :: VENDOR".padEnd(38)} RULE ENGINE WOULD SAY`,
    );
    for (const [key, g] of sorted) {
      console.log(
        `${String(g.count).padStart(5)}  ${money(g.total).padStart(12)}  ${key.slice(0, 38).padEnd(38)} ${g.ruleGuess}`,
      );
      console.log(`${"".padStart(21)}sample: ${g.sample}   dates: ${g.dates.min} → ${g.dates.max}`);
    }

    console.log(
      `\nTriage guide: groups whose "rule engine would say" line names a real category are one-click approvals on /settings/sources/review; "no rule match" groups need either a new vendor rule (/settings/rules — keyword guardrails now reject generic tokens) or an exclude decision. Clearing the top 5 groups by dollars usually clears most of the gross.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
