import { resolveToastRestaurantId } from "@/lib/integrations/toast/sync";

// Aura's review sources (Google Places / Yelp / Meta) and its Google Business
// Profile fallback are configured through process-wide env vars. Those vars
// describe ONE business — the original single-tenant install (Stone Grille).
// Before 2026-10-20 every tenant was shown that env-configured data. This module
// pins env-configured Aura data to exactly one owning tenant; every other tenant
// sees only what it connected itself (per-tenant IntegrationConnection).
//
// Resolution order: AURA_RESTAURANT_ID (explicit) → the Toast "Customer Zero"
// resolver (same single-tenant env assumption). If neither resolves, NO tenant
// gets env-configured data (fail closed).

export async function envAuraOwnerRestaurantId(): Promise<string | null> {
  const explicit = process.env.AURA_RESTAURANT_ID?.trim();
  if (explicit) return explicit;
  try {
    return await resolveToastRestaurantId();
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
