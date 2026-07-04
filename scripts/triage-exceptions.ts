/**
 * Bulk-triage open clean-ledger sync exceptions for one tenant.
 * --tenant accepts a name substring or an exact slug (e.g. "Stone Grille" or stone).
 *
 * Dry run (default — writes nothing):
 *   npx dotenv -e .env.local -o -- tsx scripts/triage-exceptions.ts --tenant "Stone Grille" --dry-run --report out/stone-triage-dryrun.json
 *
 * Snapshots (read-only):
 *   npx dotenv -e .env.local -o -- tsx scripts/triage-exceptions.ts --tenant "Stone Grille" --count-only
 *   npx dotenv -e .env.local -o -- tsx scripts/triage-exceptions.ts --tenant "Stone Grille" --ledger-count
 *
 * Live run (mutates — review the dry-run report first):
 *   npx dotenv -e .env.local -o -- tsx scripts/triage-exceptions.ts --tenant "Stone Grille" --execute --report out/stone-triage-live.json
 *
 * Policy lives in src/lib/financial-ledger/triage.ts (pure, unit-tested). Only a
 * *positive* current-rules match is auto-actionable; everything else stays
 * PENDING_REVIEW for a human. Excludes are reported but only *applied* with
 * --apply-excludes. Revenue re-classifications are never auto-applied. Approvals
 * and exclusions go through the same review.ts functions the per-row UI uses, so
 * a bulk clear can't diverge from a single-row review. See the runbook:
 * docs/fable-5/RUNBOOK-stone-triage.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { loadRules } from "../src/lib/categorization/rules";
import { approveFinancialEvent, excludeFinancialEvent } from "../src/lib/financial-ledger/review";
import { classifyException, tallyDecisions, type TriageCategory, type TriageDecision } from "../src/lib/financial-ledger/triage";

interface Args {
  tenant: string | null;
  execute: boolean;
  applyExcludes: boolean;
  countOnly: boolean;
  ledgerCount: boolean;
  report: string | null;
  limit: number | null;
  actor: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    tenant: null,
    execute: false,
    applyExcludes: false,
    countOnly: false,
    ledgerCount: false,
    report: null,
    limit: null,
    actor: process.env.SYNC_TRIAGE_ACTOR ?? "triage-script",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant" || a === "--slug") args.tenant = argv[++i] ?? null;
    else if (a === "--execute") args.execute = true;
    else if (a === "--dry-run") args.execute = false;
    else if (a === "--apply-excludes") args.applyExcludes = true;
    else if (a === "--count-only") args.countOnly = true;
    else if (a === "--ledger-count") args.ledgerCount = true;
    else if (a === "--report") args.report = argv[++i] ?? null;
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--actor") args.actor = argv[++i] ?? args.actor;
    else if (!a.startsWith("--") && !args.tenant) args.tenant = a; // positional slug
  }
  return args;
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface TriageRow {
  exceptionId: string;
  eventId: string | null;
  decision: TriageDecision;
  amount: number;
  date: string;
  vendor: string;
  applied: boolean;
}

// Accept either an exact slug or a name substring (so an operator can pass a
// human name — e.g. --tenant "Stone Grille" — without hunting for the slug).
// The resolved tenant scopes every read AND every --execute mutation, so this
// must never silently pick the wrong business: an exact (unique) slug wins
// outright, and a name search refuses to guess when it's ambiguous.
async function resolveTenant(query: string) {
  // slug is @unique — an exact match is unambiguous, so it always wins.
  const bySlug = await prisma.restaurant.findUnique({
    where: { slug: query },
    select: { id: true, name: true, slug: true },
  });
  if (bySlug) return bySlug;

  const byName = await prisma.restaurant.findMany({
    where: { name: { contains: query } },
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  if (byName.length === 1) return byName[0];
  if (byName.length === 0) {
    console.error(`No business found matching "${query}" (tried exact slug and name).`);
  } else {
    console.error(
      `"${query}" is ambiguous — matched ${byName.length} businesses: ` +
        `${byName.map((r) => `${r.name} (${r.slug})`).join(", ")}. Re-run with an exact --tenant <slug>.`,
    );
  }
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.tenant) {
    console.error('A tenant is required. Pass --tenant "<name or slug>" (never run --execute across all tenants).');
    process.exit(1);
  }
  const tenant = await resolveTenant(args.tenant);

  const openWhere = { restaurantId: tenant.id, resolvedAt: null } as const;

  if (args.countOnly) {
    const open = await prisma.syncException.count({ where: openWhere });
    console.log(`${tenant.name} (${tenant.slug}) — open: ${open}`);
    return;
  }
  if (args.ledgerCount) {
    const entries = await prisma.ledgerEntry.count({ where: { restaurantId: tenant.id } });
    console.log(`${tenant.name} (${tenant.slug}) — ledger entries: ${entries}`);
    return;
  }

  const ledgerCountBefore = await prisma.ledgerEntry.count({ where: { restaurantId: tenant.id } });

  const [rules, cats] = await Promise.all([
    loadRules(prisma, tenant.id),
    prisma.category.findMany({
      where: { restaurantId: tenant.id },
      select: { id: true, name: true, tapBucket: true },
    }),
  ]);
  const categoriesById = new Map<string, TriageCategory>(cats.map((c) => [c.id, c]));

  const open = await prisma.syncException.findMany({
    where: openWhere,
    orderBy: { createdAt: "asc" },
    ...(args.limit && args.limit > 0 ? { take: args.limit } : {}),
    select: {
      id: true,
      message: true,
      normalizedFinancialEvent: {
        select: {
          id: true,
          eventType: true,
          amount: true,
          counterparty: true,
          description: true,
          mappingStatus: true,
          metadata: true,
          eventDate: true,
        },
      },
    },
  });

  let noEvent = 0;
  const rows: TriageRow[] = [];
  for (const ex of open) {
    const ev = ex.normalizedFinancialEvent;
    // An exception with no linked (still-pending) normalized event can't be
    // resolved through the review path — leave it for a human. This is the
    // expected Sandbox-Diner shape (exceptions with no ledger events behind them).
    if (!ev || ev.mappingStatus !== "PENDING_REVIEW") {
      noEvent += 1;
      continue;
    }
    const decision = classifyException(
      {
        eventType: ev.eventType,
        amount: Number(ev.amount),
        counterparty: ev.counterparty,
        description: ev.description ?? ex.message,
      },
      rules,
      categoriesById,
    );
    rows.push({
      exceptionId: ex.id,
      eventId: ev.id,
      decision,
      amount: Math.abs(Number(ev.amount)),
      date: ev.eventDate.toISOString().slice(0, 10),
      vendor: (ev.counterparty ?? ev.description ?? "").slice(0, 48),
      applied: false,
    });
  }

  const tally = tallyDecisions(rows.map((r) => r.decision));

  // ── Execute ────────────────────────────────────────────────
  let approved = 0;
  let excluded = 0;
  if (args.execute) {
    for (const row of rows) {
      const d = row.decision;
      if (!row.eventId) continue;
      try {
        if (d.action === "approve" && d.eventType) {
          const eventId = row.eventId;
          // Re-map to the current-rules classification, then post through the same
          // approve path the per-row UI uses. Run sequentially (not an interactive
          // $transaction) to match this repo's Supabase-pooler convention — see the
          // "never interactive" note on reorderRules in settings/rules/actions.ts.
          // Both steps are idempotent (approve deletes+recreates its ledger lines),
          // so a re-run after a mid-way failure self-heals.
          const current = await prisma.normalizedFinancialEvent.findUnique({
            where: { id: eventId },
            select: { metadata: true },
          });
          const metadata =
            current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
              ? (current.metadata as Prisma.JsonObject)
              : {};
          await prisma.normalizedFinancialEvent.update({
            where: { id: eventId },
            data: {
              eventType: d.eventType,
              metadata: { ...metadata, tapBucket: d.tapBucket ?? null } as Prisma.InputJsonValue,
            },
          });
          await approveFinancialEvent(prisma, {
            restaurantId: tenant.id,
            normalizedFinancialEventId: eventId,
            approvedBy: args.actor,
          });
          row.applied = true;
          approved += 1;
        } else if (d.action === "exclude" && args.applyExcludes) {
          await excludeFinancialEvent(prisma, {
            restaurantId: tenant.id,
            normalizedFinancialEventId: row.eventId,
            resolvedBy: args.actor,
          });
          row.applied = true;
          excluded += 1;
        }
      } catch (err) {
        console.error(`  ! failed on exception ${row.exceptionId}: ${(err as Error).message}`);
      }
    }
  }

  // ── Report ─────────────────────────────────────────────────
  const grossByAction = (action: TriageDecision["action"]) =>
    rows.filter((r) => r.decision.action === action).reduce((s, r) => s + r.amount, 0);

  console.log(`\n${"═".repeat(78)}`);
  console.log(`${tenant.name} (${tenant.slug}) — ${args.execute ? "EXECUTE" : "DRY RUN"}`);
  console.log("═".repeat(78));
  console.log(`open exceptions considered : ${rows.length + noEvent} (${noEvent} without a pending event, skipped)`);
  console.log(`  approve (rule match)     : ${tally.approve}\t${money(grossByAction("approve"))}`);
  console.log(`  exclude (excluded bucket): ${tally.exclude}\t${money(grossByAction("exclude"))}${args.applyExcludes ? "" : "  (reported only — pass --apply-excludes to apply)"}`);
  console.log(`  ambiguous (leave for human): ${tally.ambiguous}\t${money(grossByAction("ambiguous"))}`);
  console.log(`  ledger entries before      : ${ledgerCountBefore}`);
  if (args.execute) {
    const ledgerCountAfter = await prisma.ledgerEntry.count({ where: { restaurantId: tenant.id } });
    console.log(`\napplied: ${approved} approved, ${excluded} excluded. ledger entries after: ${ledgerCountAfter} (Δ ${ledgerCountAfter - ledgerCountBefore})`);
    const residual = await prisma.syncException.count({ where: openWhere });
    console.log(`open exceptions remaining: ${residual} (should equal ambiguous${args.applyExcludes ? "" : " + exclude"} + skipped)`);
  } else {
    console.log(`\nDry run — nothing written. Spot-check the report, then re-run with --execute.`);
  }

  if (args.report) {
    const payload = {
      generatedAt: new Date().toISOString(),
      mode: args.execute ? "execute" : "dry-run",
      applyExcludes: args.applyExcludes,
      tenant,
      ledgerCountBefore,
      skippedNoEvent: noEvent,
      distribution: tally,
      rows: rows.map((r) => ({
        exceptionId: r.exceptionId,
        eventId: r.eventId,
        action: r.decision.action,
        reason: r.decision.reason,
        category: r.decision.matchedCategoryName,
        eventType: r.decision.eventType,
        vendor: r.vendor,
        amount: r.amount,
        date: r.date,
        applied: r.applied,
      })),
    };
    mkdirSync(dirname(args.report), { recursive: true });
    writeFileSync(args.report, JSON.stringify(payload, null, 2));
    console.log(`\nreport written: ${args.report}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
