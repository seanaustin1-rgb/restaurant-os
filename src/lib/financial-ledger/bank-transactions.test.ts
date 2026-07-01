import { describe, expect, it, vi } from "vitest";
import { ledgerMappingForTap, mirrorBankTransactionToLedger } from "./bank-transactions";

describe("bank transaction ledger mapping", () => {
  it("keeps generic opex out of the fixed-burn ledger account", () => {
    expect(
      ledgerMappingForTap({
        tapBucket: "OPEX",
        categoryName: "Office supplies",
        bucket: "OPEX_SUPPLIES",
        amount: 125,
      }),
    ).toEqual({ eventType: "OPEX", ledgerAccount: "OPEX" });
  });

  it("maps fixed-looking opex to the Cash Oxygen fixed-burn account", () => {
    expect(
      ledgerMappingForTap({
        tapBucket: "OPEX",
        categoryName: "Rent",
        bucket: "OPEX_RENT",
        amount: 4500,
      }),
    ).toEqual({ eventType: "FIXED_OPEX", ledgerAccount: "FIXED_OPEX" });
  });
});

describe("mirrorBankTransactionToLedger — category lookup tenancy guard", () => {
  // A minimal fake of the Prisma surface the mirror touches. category.findFirst
  // returns null (simulating the tenant guard rejecting a categoryId that belongs
  // to another restaurant) and records the where clause it was queried with.
  function fakeDb() {
    const createdEvents: Array<{ mappingStatus: string }> = [];
    const db = {
      category: {
        findFirst: vi.fn(async () => null),
      },
      rawSourceEvent: {
        upsert: vi.fn(async () => ({ id: "raw_1" })),
      },
      normalizedFinancialEvent: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async ({ data }: { data: { mappingStatus: string } }) => {
          createdEvents.push({ mappingStatus: data.mappingStatus });
          return { id: "norm_1" };
        }),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      ledgerEntry: {
        createMany: vi.fn(async () => ({ count: 0 })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      syncException: {
        create: vi.fn(async () => ({ id: "exc_1" })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    };
    return { db, createdEvents };
  }

  const input = {
    restaurantId: "restaurant_A",
    sourceSystem: "plaid" as const,
    sourceObjectId: "txn_1",
    payload: {},
    date: new Date("2026-06-15"),
    amount: 4500,
    categoryId: "category_owned_by_restaurant_B",
    bucket: "OPEX_RENT" as const,
    confidence: 0.95, // high enough to APPROVE if the (foreign) category were trusted
  };

  it("scopes the category lookup to the event's restaurant", async () => {
    const { db } = fakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await mirrorBankTransactionToLedger(db as any, input);
    expect(db.category.findFirst).toHaveBeenCalledWith({
      where: { id: "category_owned_by_restaurant_B", restaurantId: "restaurant_A" },
      select: { name: true, tapBucket: true },
    });
  });

  it("never maps off a foreign category — a cross-tenant id falls to PENDING_REVIEW with no ledger entries", async () => {
    const { db, createdEvents } = fakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await mirrorBankTransactionToLedger(db as any, input);
    expect(result.mappingStatus).toBe("PENDING_REVIEW");
    expect(createdEvents[0]?.mappingStatus).toBe("PENDING_REVIEW");
    expect(db.ledgerEntry.createMany).not.toHaveBeenCalled();
    expect(db.syncException.create).toHaveBeenCalled();
  });
});
