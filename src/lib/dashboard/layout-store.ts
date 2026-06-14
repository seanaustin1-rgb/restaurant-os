import { prisma } from "@/lib/prisma";
import { sanitizeModuleOrder } from "./module-order";

// Server-only persistence for the per-user dashboard layout: module grid order
// plus the modules pinned to the top Quick Access strip.

export interface DashboardLayoutData {
  order: string[] | null; // module-grid order, null when never reordered
  pinned: string[]; // pinned module keys (Quick Access), empty when none
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * The user's saved layout. Fail-safe: if the query errors (e.g. the migration
 * hasn't been applied to this database yet), fall back to defaults so the
 * dashboard still renders instead of breaking.
 */
export async function loadDashboardLayout(clerkUserId: string): Promise<DashboardLayoutData> {
  try {
    const row = await prisma.dashboardLayout.findUnique({
      where: { clerkUserId },
      select: { moduleOrder: true, pinnedModules: true },
    });
    if (!row) return { order: null, pinned: [] };
    return {
      order: Array.isArray(row.moduleOrder) ? sanitizeModuleOrder(row.moduleOrder as unknown[]) : null,
      pinned: sanitizeModuleOrder(asArray(row.pinnedModules)),
    };
  } catch (err) {
    console.warn("loadDashboardLayout failed; using defaults:", err instanceof Error ? err.message : err);
    return { order: null, pinned: [] };
  }
}

/** Upsert the user's grid order + pinned modules (both sanitized to known keys). */
export async function saveDashboardLayoutForUser(
  clerkUserId: string,
  order: unknown[],
  pinned: unknown[],
): Promise<void> {
  const cleanOrder = sanitizeModuleOrder(order);
  const cleanPinned = sanitizeModuleOrder(pinned);
  await prisma.dashboardLayout.upsert({
    where: { clerkUserId },
    create: { clerkUserId, moduleOrder: cleanOrder, pinnedModules: cleanPinned },
    update: { moduleOrder: cleanOrder, pinnedModules: cleanPinned },
  });
}
