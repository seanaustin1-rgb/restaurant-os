import { PrismaClient } from "@prisma/client";

// A SECOND Prisma client pointed at a SEPARATE database (DEMO_DATABASE_URL) for
// the public Mode-1 tour, so demo data never lives in the production database.
//
// Null when DEMO_DATABASE_URL isn't set — the tour then shows its "being
// prepared" state, and the app's own (production) client is never used for demo
// data. Mirrors the singleton pattern in lib/prisma.ts to survive dev hot-reload.

const globalForDemoPrisma = globalThis as unknown as {
  demoPrisma: PrismaClient | null | undefined;
};

function createDemoPrisma(): PrismaClient | null {
  const url = process.env.DEMO_DATABASE_URL?.trim();
  if (!url) return null;
  return new PrismaClient({
    datasourceUrl: url,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const demoPrisma: PrismaClient | null =
  globalForDemoPrisma.demoPrisma ?? createDemoPrisma();

if (process.env.NODE_ENV !== "production") globalForDemoPrisma.demoPrisma = demoPrisma;
