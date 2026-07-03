import { describe, expect, it, vi } from "vitest";
import { loadSourceConfigSnapshots } from "./source-status";

function db(overrides: {
  saved?: unknown[];
  googleConnection?: unknown | null;
  plaid?: unknown | null;
  pos?: unknown[];
  toastSales?: unknown | null;
}) {
  return {
    dataSourceConfig: {
      findMany: vi.fn(async () => overrides.saved ?? []),
    },
    plaidConnection: {
      findFirst: vi.fn(async () => overrides.plaid ?? null),
    },
    posConnection: {
      findMany: vi.fn(async () => overrides.pos ?? []),
    },
    dailySales: {
      findFirst: vi.fn(async () => overrides.toastSales ?? null),
    },
    integrationConnection: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(overrides.googleConnection ?? null)
        .mockResolvedValueOnce(overrides.googleConnection ?? null),
    },
  };
}

describe("loadSourceConfigSnapshots", () => {
  it("downgrades manually connected Google Business Profile when no authorization exists", async () => {
    const result = await loadSourceConfigSnapshots(
      "r1",
      db({
        saved: [
          {
            category: "aura",
            providerName: "Google Business Profile",
            status: "CONNECTED",
            notes: "Marked connected manually.",
          },
        ],
      }) as never,
    );

    expect(result).toContainEqual(
      expect.objectContaining({
        category: "aura",
        providerName: "Google Business Profile",
        status: "BLOCKED",
      }),
    );
  });

  it("keeps Google Business Profile connected when a selected location authorization exists", async () => {
    const result = await loadSourceConfigSnapshots(
      "r1",
      db({
        saved: [],
        googleConnection: {
          displayName: "Stone Grille and Tap House",
          externalLocationId: "123456789",
        },
      }) as never,
    );

    expect(result).toContainEqual(
      expect.objectContaining({
        category: "aura",
        providerName: "Google Business Profile",
        status: "CONNECTED",
        notes: "Detected Google Business Profile connection: Stone Grille and Tap House.",
      }),
    );
  });

  it("shows authorized Google as blocked when location selection is still pending", async () => {
    const result = await loadSourceConfigSnapshots(
      "r1",
      db({
        saved: [],
        googleConnection: {
          displayName: "Google Business Profile",
          externalLocationId: "pending",
        },
      }) as never,
    );

    expect(result).toContainEqual(
      expect.objectContaining({
        category: "aura",
        providerName: "Google Business Profile",
        status: "BLOCKED",
        notes: "Google is authorized. Choose the correct Business Profile location.",
      }),
    );
  });
});
