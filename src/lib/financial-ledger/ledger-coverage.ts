// Reusable ledger-first / legacy-fallback coverage decision.
//
// Every module in Spec A (ledger convergence) reads the clean ledger first and
// falls back to the legacy Transaction spine when the ledger doesn't yet cover
// the period. Cash Oxygen established the pattern, but its fallback predicate
// (`hasFixedBurn` — "does the ledger have FIXED_OPEX/DEBT_SERVICE lines?") is
// module-specific and can't be lifted as-is. This is the general version: a
// module declares the ledger accounts it reads, and this answers "ledger or
// legacy?" plus the trust signals (pending review count) uniformly, so Tax Vault
// (A.1) and Cash Flow / Spending (A.2) inherit one coverage heuristic.
//
// Pure decision (`pickReadSource`) is separated from the DB I/O
// (`assessLedgerCoverage`) so the heuristic is unit-tested without a database.
import type { LedgerAccount, Prisma, PrismaClient } from "@prisma/client";

type CoverageDb = PrismaClient | Prisma.TransactionClient;

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 90;

export type LedgerReadSource = "ledger" | "legacy" | "none";

export interface LedgerCoverage {
  /** Which spine a module should read for this tenant + period. */
  source: LedgerReadSource;
  asOfDate: string | null;
  windowStart: string | null;
  windowDays: number;
  /** LedgerEntry rows on the requested accounts within the window. */
  ledgerEntryCount: number;
  /** Legacy Transaction rows within the window (does fallback have anything?). */
  legacyTransactionCount: number;
  /** NormalizedFinancialEvents in the window still PENDING_REVIEW — the trust
   * caveat a module surfaces even when it reads ledger-first. */
  pendingReviewCount: number;
}

export interface AssessLedgerCoverageInput {
  /** Ledger accounts this module reads. Coverage = the ledger has entries on ANY
   * of these within the window. Omit/empty to mean "any account". */
  accounts?: readonly LedgerAccount[];
  windowDays?: number;
  /** Period end; defaults to the tenant's latest ledger (or transaction) date. */
  asOf?: Date | null;
}

/**
 * The one decision every converging module shares: read the ledger when it has
 * coverage for the requested accounts+window, else fall back to legacy, else
 * neither spine has data. Pure — no clock, no DB — so it's exhaustively testable.
 */
export function pickReadSource(input: { ledgerEntryCount: number; legacyTransactionCount: number }): LedgerReadSource {
  if (input.ledgerEntryCount > 0) return "ledger";
  if (input.legacyTransactionCount > 0) return "legacy";
  return "none";
}

/** Human caption for the source-trust affordance (modules render this verbatim). */
export function describeLedgerSource(source: LedgerReadSource): string {
  switch (source) {
    case "ledger":
      return "Ledger-backed";
    case "legacy":
      return "Estimated from legacy records";
    case "none":
      return "Needs setup";
  }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve which spine to read for one tenant + period, and the trust caveats.
 * `db` is injectable (PrismaClient or a transaction client / test fake) so the
 * assessment can run inside a broader query or against a stub.
 */
export async function assessLedgerCoverage(
  db: CoverageDb,
  restaurantId: string,
  input: AssessLedgerCoverageInput = {},
): Promise<LedgerCoverage> {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const accounts = input.accounts && input.accounts.length > 0 ? [...input.accounts] : null;

  // Anchor the window on the requested asOf, else the tenant's latest activity
  // (ledger first, then legacy) so an empty ledger still yields a sane window.
  let asOf = input.asOf ?? null;
  if (!asOf) {
    const [latestLedger, latestTxn] = await Promise.all([
      db.ledgerEntry.findFirst({ where: { restaurantId }, orderBy: { ledgerDate: "desc" }, select: { ledgerDate: true } }),
      db.transaction.findFirst({ where: { restaurantId }, orderBy: { date: "desc" }, select: { date: true } }),
    ]);
    asOf = latestLedger?.ledgerDate ?? latestTxn?.date ?? null;
  }
  if (!asOf) {
    return {
      source: "none",
      asOfDate: null,
      windowStart: null,
      windowDays,
      ledgerEntryCount: 0,
      legacyTransactionCount: 0,
      pendingReviewCount: 0,
    };
  }

  const windowStart = new Date(asOf.getTime() - (windowDays - 1) * DAY_MS);
  const ledgerWindow = { restaurantId, ledgerDate: { gte: windowStart, lte: asOf } };
  const legacyWindow = { restaurantId, date: { gte: windowStart, lte: asOf } };

  const [ledgerEntryCount, legacyTransactionCount, pendingReviewCount] = await Promise.all([
    db.ledgerEntry.count({ where: accounts ? { ...ledgerWindow, ledgerAccount: { in: accounts } } : ledgerWindow }),
    db.transaction.count({ where: legacyWindow }),
    db.normalizedFinancialEvent.count({
      where: { restaurantId, eventDate: { gte: windowStart, lte: asOf }, mappingStatus: "PENDING_REVIEW" },
    }),
  ]);

  return {
    source: pickReadSource({ ledgerEntryCount, legacyTransactionCount }),
    asOfDate: iso(asOf),
    windowStart: iso(windowStart),
    windowDays,
    ledgerEntryCount,
    legacyTransactionCount,
    pendingReviewCount,
  };
}
