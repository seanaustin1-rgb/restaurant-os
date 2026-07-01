import type { PrismaClient, SyncExceptionSeverity } from "@prisma/client";

export interface SyncHealthIssue {
  id: string;
  sourceSystem: string;
  severity: SyncExceptionSeverity;
  issueType: string;
  message: string;
  createdAt: Date;
}

export interface FinancialSyncHealth {
  available: boolean;
  rawEventCount: number;
  pendingMappingCount: number;
  approvedEventCount: number;
  ledgerEntryCount: number;
  unresolvedExceptionCount: number;
  blockingExceptionCount: number;
  warningExceptionCount: number;
  sourceSystems: string[];
  recentIssues: SyncHealthIssue[];
}

export const EMPTY_SYNC_HEALTH: FinancialSyncHealth = {
  available: false,
  rawEventCount: 0,
  pendingMappingCount: 0,
  approvedEventCount: 0,
  ledgerEntryCount: 0,
  unresolvedExceptionCount: 0,
  blockingExceptionCount: 0,
  warningExceptionCount: 0,
  sourceSystems: [],
  recentIssues: [],
};

export async function loadFinancialSyncHealth(
  restaurantId: string,
  db: PrismaClient,
): Promise<FinancialSyncHealth> {
  try {
    const [
      rawEventCount,
      pendingMappingCount,
      approvedEventCount,
      ledgerEntryCount,
      unresolvedExceptionCount,
      blockingExceptionCount,
      warningExceptionCount,
      sourceRows,
      recentIssues,
    ] = await Promise.all([
      db.rawSourceEvent.count({ where: { restaurantId } }),
      db.normalizedFinancialEvent.count({
        where: { restaurantId, mappingStatus: "PENDING_REVIEW" },
      }),
      db.normalizedFinancialEvent.count({
        where: { restaurantId, mappingStatus: "APPROVED" },
      }),
      db.ledgerEntry.count({ where: { restaurantId } }),
      db.syncException.count({ where: { restaurantId, resolvedAt: null } }),
      db.syncException.count({ where: { restaurantId, resolvedAt: null, severity: "BLOCKING" } }),
      db.syncException.count({ where: { restaurantId, resolvedAt: null, severity: "WARNING" } }),
      db.rawSourceEvent.findMany({
        where: { restaurantId },
        distinct: ["sourceSystem"],
        select: { sourceSystem: true },
        orderBy: { sourceSystem: "asc" },
      }),
      db.syncException.findMany({
        where: { restaurantId, resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          sourceSystem: true,
          severity: true,
          issueType: true,
          message: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      available: true,
      rawEventCount,
      pendingMappingCount,
      approvedEventCount,
      ledgerEntryCount,
      unresolvedExceptionCount,
      blockingExceptionCount,
      warningExceptionCount,
      sourceSystems: sourceRows.map((row) => row.sourceSystem),
      recentIssues,
    };
  } catch {
    return EMPTY_SYNC_HEALTH;
  }
}

export function financialSyncHealthStatus(health: FinancialSyncHealth): {
  label: string;
  tone: "green" | "yellow" | "red" | "muted";
  detail: string;
} {
  if (!health.available) {
    return {
      label: "Preparing",
      tone: "muted",
      detail: "The clean ledger tables are ready in code and will activate after the database migration runs.",
    };
  }
  if (health.blockingExceptionCount > 0) {
    return {
      label: "Blocked",
      tone: "red",
      detail: `${health.blockingExceptionCount} blocking import issue${health.blockingExceptionCount === 1 ? "" : "s"} need attention.`,
    };
  }
  if (health.unresolvedExceptionCount > 0 || health.pendingMappingCount > 0) {
    const total = health.unresolvedExceptionCount + health.pendingMappingCount;
    return {
      label: "Needs review",
      tone: "yellow",
      detail: `${total} mapping or sync item${total === 1 ? "" : "s"} need review before they become dashboard math.`,
    };
  }
  if (health.ledgerEntryCount > 0) {
    return {
      label: "Clean",
      tone: "green",
      detail: "Approved imports are flowing into the clean ledger layer.",
    };
  }
  return {
    label: "Ready",
    tone: "muted",
    detail: "No ledger imports have been processed yet.",
  };
}
