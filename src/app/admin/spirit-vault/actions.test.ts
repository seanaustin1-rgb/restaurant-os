import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared mock fns (hoisted so the vi.mock factories below can close over them).
const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  roleFindFirst: vi.fn(),
  venueFindFirst: vi.fn(),
  venueUpdate: vi.fn(),
  defUpdate: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: h.authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access/roles", () => ({ OPERATOR_ROLES: ["OWNER"] }));
// Isolate the write-target assertion from the publish gate.
vi.mock("@/lib/spirit-vault/validate", () => ({ validatePublishableSpirit: () => [] }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userRestaurantRole: { findFirst: h.roleFindFirst },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        venueSpirit: { findFirst: h.venueFindFirst, update: h.venueUpdate },
        spiritDefinition: { update: h.defUpdate },
      }),
  },
}));

import { updateSpirit, type SpiritEditInput } from "./actions";

const baseInput: SpiritEditInput = {
  id: "venue_1",
  whyWeCarry: null,
  seanShort: null,
  notes: null,
  body: 9,
  finish: 2,
  flavor: { Sweet: 8, Oak: 2, Spice: 1, Fruit: 9, Smoke: 0, Earth: 1, Herbal: 2 },
  topNotes: ["Note A", "Note B", "Note C"],
  pairings: ["Dark chocolate"],
  recordStatus: "DRAFT",
  publicationStatus: "DRAFT",
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  h.authMock.mockResolvedValue({ userId: "user_1" });
  h.roleFindFirst.mockResolvedValue({ restaurantId: "rest_1" });
  h.venueFindFirst.mockResolvedValue({
    id: "venue_1",
    restaurantId: "rest_1",
    spiritDefinitionId: "def_1",
    slug: "sample-rye",
    recordStatus: "DRAFT",
    publicationStatus: "DRAFT",
    definition: { id: "def_1", slug: "sample-rye", brand: "Sample", category: "Rye", body: 5, finish: 5, flavor: {}, topNotes: [] },
    offers: [{ isPrimary: true, pourSizeOz: 1.5, priceUsd: 12 }],
  });
});

describe("updateSpirit — sensory edits are venue-local overrides", () => {
  it("writes body/finish/flavor/topNotes/pairings to VenueSpirit.overrides", async () => {
    await updateSpirit(baseInput);

    expect(h.venueUpdate).toHaveBeenCalledTimes(1);
    const arg = h.venueUpdate.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> };
    expect(arg.where).toEqual({ id: "venue_1" });
    expect(arg.data.overrides).toEqual({
      body: 9,
      finish: 2,
      flavor: { Sweet: 8, Oak: 2, Spice: 1, Fruit: 9, Smoke: 0, Earth: 1, Herbal: 2 },
      topNotes: ["Note A", "Note B", "Note C"],
      pairings: ["Dark chocolate"],
    });
  });

  it("requires operator access on the configured Spirit Vault restaurant", async () => {
    vi.stubEnv("SPIRIT_VAULT_RESTAURANT_ID", "rest_vault");

    await updateSpirit(baseInput);

    expect(h.roleFindFirst).toHaveBeenCalledWith({
      where: {
        clerkUserId: "user_1",
        role: { in: ["OWNER"] },
        restaurant: { businessType: "RESTAURANT", id: "rest_vault" },
      },
      select: { restaurantId: true },
    });
  });

  it("never mutates the shared SpiritDefinition", async () => {
    await updateSpirit(baseInput);
    expect(h.defUpdate).not.toHaveBeenCalled();
  });

  it("still persists venue voice + status (trimmed) on the VenueSpirit row", async () => {
    await updateSpirit({
      ...baseInput,
      whyWeCarry: "  Because Sean loves it  ",
      recordStatus: "REVIEWED",
      publicationStatus: "DRAFT",
    });

    const arg = h.venueUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.whyWeCarry).toBe("Because Sean loves it");
    expect(arg.data.recordStatus).toBe("REVIEWED");
    expect(arg.data.reviewedAt).toBeInstanceOf(Date);
  });

  it("blocks publishing higher than the record status", async () => {
    await expect(
      updateSpirit({ ...baseInput, recordStatus: "DRAFT", publicationStatus: "PUBLISHED" }),
    ).rejects.toThrow(/publication/i);
    expect(h.venueUpdate).not.toHaveBeenCalled();
  });
});
