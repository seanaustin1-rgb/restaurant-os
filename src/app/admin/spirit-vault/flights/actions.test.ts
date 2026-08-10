import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  roleFindFirst: vi.fn(),
  pourFindMany: vi.fn(),
  flightCreate: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: h.authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access/roles", () => ({ SPIRIT_VAULT_STAFF_ROLES: ["OPERATOR", "MANAGER"] }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userRestaurantRole: { findFirst: h.roleFindFirst },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        spiritPour: { findMany: h.pourFindMany },
        spiritFlight: { create: h.flightCreate },
      }),
  },
}));

import { createSpiritFlight, type CreateSpiritFlightInput } from "./actions";

const baseInput: CreateSpiritFlightInput = {
  name: "  Barrel Proof Progression  ",
  description: "  Proof-driven build  ",
  status: "DRAFT",
  items: [
    { venueSpiritId: "venue_1", spiritPourId: "pour_1", itemNote: "  opener  " },
    { venueSpiritId: "venue_2", spiritPourId: "pour_2", itemNote: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ userId: "user_1" });
  h.roleFindFirst.mockResolvedValue({ restaurantId: "rest_1" });
  h.pourFindMany.mockResolvedValue([
    { id: "pour_1", venueSpiritId: "venue_1", priceUsd: 14, pourSizeOz: 2 },
    { id: "pour_2", venueSpiritId: "venue_2", priceUsd: 18, pourSizeOz: 1.5 },
  ]);
  h.flightCreate.mockResolvedValue({ id: "flight_1" });
});

describe("createSpiritFlight", () => {
  it("allows Spirit Vault staff roles and creates reference-only 1 oz flight items", async () => {
    await createSpiritFlight(baseInput);

    expect(h.roleFindFirst).toHaveBeenCalledWith({
      where: {
        clerkUserId: "user_1",
        role: { in: ["OPERATOR", "MANAGER"] },
        restaurant: { businessType: "RESTAURANT" },
      },
      select: { restaurantId: true },
    });

    expect(h.pourFindMany).toHaveBeenCalledWith({
      where: {
        restaurantId: "rest_1",
        id: { in: ["pour_1", "pour_2"] },
        venueSpiritId: { in: ["venue_1", "venue_2"] },
        venueSpirit: { recordStatus: "PUBLISHED", publicationStatus: "PUBLISHED" },
      },
      select: {
        id: true,
        venueSpiritId: true,
        priceUsd: true,
        pourSizeOz: true,
      },
    });

    const data = h.flightCreate.mock.calls[0][0].data;
    expect(data.name).toBe("Barrel Proof Progression");
    expect(data.description).toBe("Proof-driven build");
    expect(data.suggestedPriceUsd.toString()).toBe("19");
    expect(data.pricingFormulaVersion).toBe("component_1oz_sum_v1");
    expect(data.items.create).toEqual([
      {
        restaurantId: "rest_1",
        venueSpiritId: "venue_1",
        spiritPourId: "pour_1",
        pourSizeOz: expect.anything(),
        sortOrder: 0,
        itemNote: "opener",
      },
      {
        restaurantId: "rest_1",
        venueSpiritId: "venue_2",
        spiritPourId: "pour_2",
        pourSizeOz: expect.anything(),
        sortOrder: 1,
        itemNote: null,
      },
    ]);
    expect(JSON.stringify(data.items.create)).not.toMatch(/brand|expression|topNotes|flavor/);
  });

  it("rejects duplicate spirits in the same flight", async () => {
    await expect(
      createSpiritFlight({
        ...baseInput,
        items: [
          { venueSpiritId: "venue_1", spiritPourId: "pour_1" },
          { venueSpiritId: "venue_1", spiritPourId: "pour_2" },
        ],
      }),
    ).rejects.toThrow(/same spirit twice/i);
    expect(h.flightCreate).not.toHaveBeenCalled();
  });

  it("rejects missing or unpublished source pours", async () => {
    h.pourFindMany.mockResolvedValue([{ id: "pour_1", venueSpiritId: "venue_1", priceUsd: 14, pourSizeOz: 2 }]);

    await expect(createSpiritFlight(baseInput)).rejects.toThrow(/published vault spirit/i);
    expect(h.flightCreate).not.toHaveBeenCalled();
  });
});
