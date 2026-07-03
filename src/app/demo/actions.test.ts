import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupReputation } from "./actions";

const OLD_ENV = process.env.GOOGLE_PLACES_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (OLD_ENV == null) {
    delete process.env.GOOGLE_PLACES_API_KEY;
  } else {
    process.env.GOOGLE_PLACES_API_KEY = OLD_ENV;
  }
});

function mockPlacesResponse(result: unknown) {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [result],
      }),
    })),
  );
}

describe("lookupReputation", () => {
  it("rejects restaurant matches for a real estate brokerage lookup", async () => {
    mockPlacesResponse({
      name: "Cinnamon Beach Grill",
      rating: 4.6,
      user_ratings_total: 900,
      formatted_address: "Palm Coast, FL",
      types: ["restaurant", "food", "point_of_interest"],
    });

    await expect(lookupReputation("Cinnamon Beach Realty", "Palm Coast, FL", "real_estate")).resolves.toMatchObject({
      found: false,
      matchedName: null,
    });
  });

  it("requires real estate type metadata before showing a brokerage Google match", async () => {
    mockPlacesResponse({
      name: "Cinnamon Beach Realty",
      rating: 4.8,
      user_ratings_total: 120,
      formatted_address: "Palm Coast, FL",
      types: ["point_of_interest", "establishment"],
    });

    await expect(lookupReputation("Cinnamon Beach Realty", "Palm Coast, FL", "real_estate")).resolves.toMatchObject({
      found: false,
      matchedName: null,
    });
  });

  it("accepts a typed real estate agency match", async () => {
    mockPlacesResponse({
      name: "Cinnamon Beach Realty",
      rating: 4.8,
      user_ratings_total: 120,
      formatted_address: "Palm Coast, FL",
      types: ["real_estate_agency", "point_of_interest", "establishment"],
    });

    await expect(lookupReputation("Cinnamon Beach Realty", "Palm Coast, FL", "real_estate")).resolves.toMatchObject({
      found: true,
      rating: 4.8,
      reviewCount: 120,
      matchedName: "Cinnamon Beach Realty",
    });
  });
});
