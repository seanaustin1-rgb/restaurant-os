import { prisma } from "@/lib/prisma";
import { getToastConfig, isToastConfigured } from "@/lib/integrations/toast/config";

// Aura's review sources (Google Places / Yelp / Meta) and its Google Business
// Profile fallback are configured through process-wide env vars. Those vars
// describe ONE business — the original single-tenant install (Stone Grille).
// Before 2026-10-20 every tenant was shown that env-configured data. This module
// pins env-configured Aura data to exactly one owning tenant; every other tenant
// sees only what it connected itself (per-tenant IntegrationConnection).
//
// Resolution uses ONLY values a tenant cannot set from the app:
//   1. AURA_RESTAURANT_ID (explicit env)
//   2. SPIRIT_VAULT_RESTAURANT_ID (env; same single-tenant install)
//   3. the PosConnection whose externalId is the env TOAST_RESTAURANT_GUID
// It deliberately does NOT fall back to matching a restaurant by NAME (as the
// Toast resolver does) — any self-onboarded tenant can pick any name.
// If nothing resolves, NO tenant gets env-configured data (fail closed).

export async function envAuraOwnerRestaurantId(): Promise<string | null> {
  const explicit = process.env.AURA_RESTAURANT_ID?.trim() || process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();
  if (explicit) return explicit;
  try {
    if (!isToastConfigured()) return null;
    const { restaurantGuid } = getToastConfig();
    const conn = await prisma.posConnection.findFirst({
      where: { provider: "TOAST", externalId: restaurantGuid, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { restaurantId: true },
    });
    return conn?.restaurantId ?? null;
  } catch {
    return null;
  }
}

/** Pure check: may `restaurantId` see env-configured Aura data owned by `ownerId`? */
export function isEnvAuraOwner(restaurantId: string | null | undefined, ownerId: string | null | undefined): boolean {
  return Boolean(restaurantId && ownerId && restaurantId === ownerId);
}

/**
 * Prisma `where` fragment for tenant-scoped Aura snapshot rows. Legacy rows
 * (restaurantId NULL, written before scoping) belong to the env owner only.
 */
export function auraSnapshotTenantWhere(restaurantId: string, isOwner: boolean) {
  return isOwner ? { OR: [{ restaurantId }, { restaurantId: null }] } : { restaurantId };
}

/**
 * The env owner can hold BOTH a legacy row (restaurantId NULL) and a new
 * tenant-scoped row for the same logical key (e.g. metric + date). Keep one per
 * key, preferring the tenant-scoped row, so sums never double-count.
 */
export function preferTenantScopedRows<T extends { restaurantId: string | null }>(rows: T[], keyOf: (row: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    const existing = byKey.get(key);
    if (!existing || (existing.restaurantId === null && row.restaurantId !== null)) byKey.set(key, row);
  }
  return [...byKey.values()];
}
