import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  roleFindFirst: vi.fn(),
  pourFindMany: vi.fn(),
  flightCreate: vi.fn(),
  flightFindFirst: vi.fn(),
  flightUpdate: vi.fn(),
  itemDeleteMany: vi.fn(),
  flightUpdateMany: vi.fn(),
  flightDeleteMany: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: h.authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access/roles", () => ({ SPIRIT_VAULT_STAFF_ROLES: ["OPERATOR", "MANAGER"] }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userRestaurantRole: { findFirst: h.roleFindFirst },
    spiritFlight: { updateMany: h.flightUpdateMany, deleteMany: h.flightDeleteMany },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        spiritPour: { findMany: h.pourFindMany },
        spiritFlight: { create: h.flightCreate, findFirst: h.flightFindFirst, update: h.flightUpdate },
        spiritFlightItem: { deleteMany: h.itemDeleteMany },
      }),
  },
}));

import {
  createSpiritFlight,
  updateSpiritFlight,
  setSpiritFlightStatus,
  deleteSpiritFlight,
  type CreateSpiritFlightInput,
} from "./actions";

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
  h.flightFindFirst.mockResolvedValue({ id: "flight_1" });
  h.flightUpdate.mockResolvedValue({ id: "flight_1" });
  h.itemDeleteMany.mockResolvedValue({ count: 2 });
  h.flightUpdateMany.mockResolvedValue({ count: 1 });
  h.flightDeleteMany.mockResolvedValue({ count: 1 });
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
        pairingBites: [],
      },
      {
        restaurantId: "rest_1",
        venueSpiritId: "venue_2",
        spiritPourId: "pour_2",
        pourSizeOz: expect.anything(),
        sortOrder: 1,
        itemNote: null,
        pairingBites: [],
      },
    ]);
    expect(JSON.stringify(data.items.create)).not.toMatch(/brand|expression|topNotes|flavor/);
  });

  it("persists per-item bites (trimmed, de-duped, capped at 2)", async () => {
    await createSpiritFlight({
      ...baseInput,
      items: [
        { venueSpiritId: "venue_1", spiritPourId: "pour_1", pairingBites: ["  Salted caramel  ", "Salted caramel", "Pecans", "Extra"] },
        { venueSpiritId: "venue_2", spiritPourId: "pour_2", pairingBites: [] },
      ],
    });
    const create = h.flightCreate.mock.calls[0][0].data.items.create;
    expect(create[0].pairingBites).toEqual(["Salted caramel", "Pecans"]);
    expect(create[1].pairingBites).toEqual([]);
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

describe("updateSpiritFlight", () => {
  const updateInput = { ...baseInput, id: "flight_1" };

  it("replaces the item set (reorder/add/remove) and regenerates the price on the owned flight", async () => {
    await updateSpiritFlight(updateInput);

    expect(h.flightFindFirst).toHaveBeenCalledWith({ where: { id: "flight_1", restaurantId: "rest_1" }, select: { id: true } });
    // Old items are cleared, then recreated fresh in submitted order.
    expect(h.itemDeleteMany).toHaveBeenCalledWith({ where: { flightId: "flight_1", restaurantId: "rest_1" } });
    const data = h.flightUpdate.mock.calls[0][0].data;
    expect(h.flightUpdate.mock.calls[0][0].where).toEqual({ id: "flight_1" });
    expect(data.name).toBe("Barrel Proof Progression");
    expect(data.suggestedPriceUsd.toString()).toBe("19");
    expect(data.items.create.map((i: { sortOrder: number; spiritPourId: string }) => [i.sortOrder, i.spiritPourId])).toEqual([
      [0, "pour_1"],
      [1, "pour_2"],
    ]);
  });

  it("reorders by the incoming array order", async () => {
    await updateSpiritFlight({
      ...updateInput,
      items: [
        { venueSpiritId: "venue_2", spiritPourId: "pour_2", itemNote: null },
        { venueSpiritId: "venue_1", spiritPourId: "pour_1", itemNote: null },
      ],
    });
    const data = h.flightUpdate.mock.calls[0][0].data;
    expect(data.items.create.map((i: { sortOrder: number; spiritPourId: string }) => [i.sortOrder, i.spiritPourId])).toEqual([
      [0, "pour_2"],
      [1, "pour_1"],
    ]);
  });

  it("rejects editing a flight that is not the caller's tenant", async () => {
    h.flightFindFirst.mockResolvedValue(null);
    await expect(updateSpiritFlight(updateInput)).rejects.toThrow(/not found/i);
    expect(h.itemDeleteMany).not.toHaveBeenCalled();
    expect(h.flightUpdate).not.toHaveBeenCalled();
  });
});

describe("setSpiritFlightStatus", () => {
  it("publishes an owned flight (tenant-scoped updateMany)", async () => {
    await setSpiritFlightStatus({ id: "flight_1", status: "PUBLISHED" });
    expect(h.flightUpdateMany).toHaveBeenCalledWith({ where: { id: "flight_1", restaurantId: "rest_1" }, data: { status: "PUBLISHED" } });
  });

  it("throws when the flight is not the caller's", async () => {
    h.flightUpdateMany.mockResolvedValue({ count: 0 });
    await expect(setSpiritFlightStatus({ id: "flight_x", status: "PUBLISHED" })).rejects.toThrow(/not found/i);
  });

  it("rejects an invalid status", async () => {
    await expect(setSpiritFlightStatus({ id: "flight_1", status: "NONSENSE" as never })).rejects.toThrow(/invalid flight status/i);
    expect(h.flightUpdateMany).not.toHaveBeenCalled();
  });
});

describe("deleteSpiritFlight", () => {
  it("deletes an owned flight (tenant-scoped deleteMany)", async () => {
    await deleteSpiritFlight({ id: "flight_1" });
    expect(h.flightDeleteMany).toHaveBeenCalledWith({ where: { id: "flight_1", restaurantId: "rest_1" } });
  });

  it("throws when the flight is not the caller's", async () => {
    h.flightDeleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteSpiritFlight({ id: "flight_x" })).rejects.toThrow(/not found/i);
  });
});
