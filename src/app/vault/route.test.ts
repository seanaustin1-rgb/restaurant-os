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

  it("returns a controlled 503 when the database read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.findMany.mockRejectedValueOnce(new Error("db unavailable"));
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Spirit Vault is temporarily unavailable.");
    expect(errorSpy).toHaveBeenCalledWith("Spirit Vault database read failed", expect.any(Error));
    errorSpy.mockRestore();
  });
});
