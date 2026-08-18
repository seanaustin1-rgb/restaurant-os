import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    venueSpirit: {
      findMany: h.findMany,
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: h.cookieGet }),
}));

function req(url: string): unknown {
  return { url };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("SPIRIT_VAULT_RESTAURANT_ID", "rest_demo");
  vi.stubEnv("SPIRIT_VAULT_DAY_SECRET", ""); // gate disabled by default
  h.findMany.mockResolvedValue([]);
  h.cookieGet.mockReturnValue(undefined);
});

describe("GET /vault", () => {
  it("always queries only guest-visible published listings", async () => {
    const { GET } = await import("./route");

    await (GET as unknown as (r: unknown) => Promise<Response>)(req("https://example.test/vault?review=1"));

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

  it("serves the gate (no DB query) when the day gate is on and no code is presented", async () => {
    vi.stubEnv("SPIRIT_VAULT_DAY_SECRET", "s3cr3t");
    const { GET } = await import("./route");

    const res = await (GET as unknown as (r: unknown) => Promise<Response>)(req("https://example.test/vault"));

    expect(h.findMany).not.toHaveBeenCalled();
    expect(await res.text()).toContain("Unlock today");
  });

  it("unlocks with a valid ?k code even when the gate is on", async () => {
    vi.stubEnv("SPIRIT_VAULT_DAY_SECRET", "s3cr3t");
    const { todayCode } = await import("@/lib/spirit-vault/day-code");
    const { GET } = await import("./route");

    await (GET as unknown as (r: unknown) => Promise<Response>)(
      req(`https://example.test/vault?k=${todayCode()}`),
    );

    expect(h.findMany).toHaveBeenCalled();
  });
});
