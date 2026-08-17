import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    venueSpirit: {
      findMany: h.findMany,
    },
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("SPIRIT_VAULT_RESTAURANT_ID", "rest_demo");
  h.findMany.mockResolvedValue([]);
});

describe("GET /vault", () => {
  it("always queries only guest-visible published listings", async () => {
    const { GET } = await import("./route");

    await (GET as unknown as (request: unknown) => Promise<Response>)({
      nextUrl: new URL("https://example.test/vault?review=1"),
    });

    expect(h.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          restaurantId: "rest_demo",
          recordStatus: "PUBLISHED",
          publicationStatus: "PUBLISHED",
        }),
      }),
    );
  });
});
