import type { PrismaClient } from "@prisma/client";
import { demoPrisma } from "@/lib/demo/demo-prisma";
import { seedDemoData } from "@/lib/dev/seed-demo";

// Shared "Demo Bistro" tenant for the public Mode-1 tour (/demo/tour).
//
// IMPORTANT: the public tour route only ever READS (getDemoBistroId). Seeding —
// the only write — is a deliberate, operator-run action (seedDemoBistro, invoked
// by scripts/seed-demo-tour.ts), never triggered by a page view. This keeps the
// public endpoint from ever writing to the (production) database on its own.

const DEMO_SLUG = "demo-bistro";
const DEMO_NAME = "Demo Bistro";

function currentMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * READ-ONLY. Returns the Demo Bistro's id only when it exists AND has data for
 * the current month (so the dashboard renders a real period). Returns null
 * otherwise — the tour page shows a friendly "being prepared" state. Never writes.
 */
export async function getDemoBistroId(db: PrismaClient): Promise<string | null> {
  const restaurant = await db.restaurant.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });
  if (!restaurant) return null;

  const seededThisMonth = await db.dailySales.count({
    where: { restaurantId: restaurant.id, date: { gte: currentMonthStart() } },
  });
  return seededThisMonth > 0 ? restaurant.id : null;
}

/**
 * WRITE. Find-or-create the Demo Bistro and (re)seed the current month. This is
 * the only path that writes demo data — run it deliberately via
 * scripts/seed-demo-tour.ts, not from a request handler.
 */
export async function seedDemoBistro(): Promise<string> {
  // Writes go ONLY to the separate demo database. Hard-refuse otherwise, so this
  // can never seed the production database.
  const db = demoPrisma;
  if (!db) {
    throw new Error(
      "DEMO_DATABASE_URL is not set — refusing to seed. Point it at the SEPARATE demo database so this never writes to production.",
    );
  }

  let restaurant = await db.restaurant.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });
  if (!restaurant) {
    restaurant = await db.restaurant.create({
      data: { name: DEMO_NAME, slug: DEMO_SLUG, seatCount: 120, tapSettings: { create: {} } },
      select: { id: true },
    });
  }
  await seedDemoData(restaurant.id, db);
  return restaurant.id;
}
