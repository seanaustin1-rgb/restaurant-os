import { prisma } from "@/lib/prisma";
import { sanitizeModuleOrder } from "./module-order";

// Server-only persistence for the per-user dashboard module order.

/**
 * The user's saved module-key order, or null when they've never reordered.
 * Fail-safe: if the query errors (e.g. the migration hasn't been applied to this
 * database yet), fall back to null so the dashboard still renders the default
 * order instead of breaking.
 */
export async function loadModuleOrder(clerkUserId: string): Promise<string[] | null> {
  try {
    const row = await prisma.dashboardLayout.findUnique({
      where: { clerkUserId },
      select: { moduleOrder: true },
    });
    if (!row || !Array.isArray(row.moduleOrder)) return null;
    return sanitizeModuleOrder(row.moduleOrder as unknown[]);
  } catch (err) {
    console.warn("loadModuleOrder failed; using default order:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Upsert the user's module order (sanitized to known keys). */
export async function saveModuleOrderForUser(clerkUserId: string, order: unknown[]): Promise<void> {
  const clean = sanitizeModuleOrder(order);
  await prisma.dashboardLayout.upsert({
    where: { clerkUserId },
    create: { clerkUserId, moduleOrder: clean },
    update: { moduleOrder: clean },
  });
}
