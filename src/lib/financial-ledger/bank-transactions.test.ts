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
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: "raw_1" })),
        update: vi.fn(async () => ({ id: "raw_1" })),
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

describe("mirrorBankTransactionToLedger — review decisions survive re-sync", () => {
  // Plaid re-sends "modified" transactions on later syncs. A decision made on the
  // review page must not be deleted and reopened by that re-send.
  function fakeDb(
    existing: Array<{ mappingStatus: string; approvedBy: string | null; amount: number; eventDate: Date }>,
    priorPayloadAmount: number | null = 812.4,
  ) {
    return {
      category: { findFirst: vi.fn(async () => ({ name: "Food Purchases", tapBucket: "COGS_FOOD" })) },
      rawSourceEvent: {
        findUnique: vi.fn(async () => (priorPayloadAmount == null ? null : { payload: { amount: priorPayloadAmount } })),
        upsert: vi.fn(async () => ({ id: "raw_1" })),
        update: vi.fn(async () => ({ id: "raw_1" })),
      },
      normalizedFinancialEvent: {
        findMany: vi.fn(async () => existing.map((e, i) => ({ id: `norm_${i}`, ...e }))),
        create: vi.fn(async () => ({ id: "norm_new" })),
        deleteMany: vi.fn(async () => ({ count: existing.length })),
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
  }

  const input = {
    restaurantId: "restaurant_A",
    sourceSystem: "plaid" as const,
    sourceObjectId: "txn_1",
    payload: { name: "SYSCO 1234 (enriched)" },
    date: new Date("2026-06-15"),
    amount: 812.4,
    categoryId: "cat_food",
    bucket: "COGS_FOOD" as const,
    confidence: 0.3,
  };

  it("keeps a human approval when amount and date are unchanged", async () => {
    const db = fakeDb([{ mappingStatus: "APPROVED", approvedBy: "user_sean", amount: 812.4, eventDate: new Date("2026-06-15") }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await mirrorBankTransactionToLedger(db as any, input);
    expect(result).toMatchObject({ normalizedFinancialEventId: "norm_0", mappingStatus: "APPROVED" });
    expect(db.normalizedFinancialEvent.deleteMany).not.toHaveBeenCalled();
    expect(db.ledgerEntry.deleteMany).not.toHaveBeenCalled();
    expect(db.syncException.create).not.toHaveBeenCalled();
    // The raw payload is still refreshed (upsert), and the raw status restored.
    expect(db.rawSourceEvent.upsert).toHaveBeenCalled();
    expect(db.rawSourceEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mappingStatus: "APPROVED" }) }),
    );
  });

  it("keeps an exclusion when amount and date are unchanged", async () => {
    const db = fakeDb([{ mappingStatus: "EXCLUDED", approvedBy: null, amount: 812.4, eventDate: new Date("2026-06-15") }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await mirrorBankTransactionToLedger(db as any, input);
    expect(result.mappingStatus).toBe("EXCLUDED");
    expect(db.normalizedFinancialEvent.deleteMany).not.toHaveBeenCalled();
    expect(db.syncException.create).not.toHaveBeenCalled();
  });

  it("re-maps (and reopens review) when the amount changed — the old decision may not hold", async () => {
    const db = fakeDb([{ mappingStatus: "APPROVED", approvedBy: "user_sean", amount: 800, eventDate: new Date("2026-06-15") }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await mirrorBankTransactionToLedger(db as any, input);
    expect(db.normalizedFinancialEvent.deleteMany).toHaveBeenCalled();
    expect(result.normalizedFinancialEventId).toBe("norm_new");
    expect(result.mappingStatus).toBe("PENDING_REVIEW");
    expect(db.syncException.create).toHaveBeenCalled();
  });

  it("re-maps when the direction flipped (charge became an equal-sized credit)", async () => {
    const db = fakeDb(
      [{ mappingStatus: "APPROVED", approvedBy: "user_sean", amount: 812.4, eventDate: new Date("2026-06-15") }],
      -812.4,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await mirrorBankTransactionToLedger(db as any, input);
    expect(db.normalizedFinancialEvent.deleteMany).toHaveBeenCalled();
  });

  it("re-maps when the prior direction is unknown (no signed amount on file)", async () => {
    const db = fakeDb(
      [{ mappingStatus: "EXCLUDED", approvedBy: null, amount: 812.4, eventDate: new Date("2026-06-15") }],
      null,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await mirrorBankTransactionToLedger(db as any, input);
    expect(db.normalizedFinancialEvent.deleteMany).toHaveBeenCalled();
  });

  it("still rebuilds an auto-approved event (no approvedBy) so new rules can apply", async () => {
    const db = fakeDb([{ mappingStatus: "APPROVED", approvedBy: null, amount: 812.4, eventDate: new Date("2026-06-15") }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await mirrorBankTransactionToLedger(db as any, input);
    expect(db.normalizedFinancialEvent.deleteMany).toHaveBeenCalled();
    expect(db.normalizedFinancialEvent.create).toHaveBeenCalled();
  });
});
