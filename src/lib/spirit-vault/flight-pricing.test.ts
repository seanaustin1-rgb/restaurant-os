import { describe, expect, it } from "vitest";
import { calculateFlightLinePriceCents, calculateFlightPricing, FLIGHT_PRICING_FORMULA_VERSION } from "./flight-pricing";

describe("Spirit Vault flight pricing", () => {
  it("prices each selected spirit as a 1 oz pour from its source pour", () => {
    expect(
      calculateFlightLinePriceCents({
        id: "pour_1",
        venueSpiritId: "venue_1",
        priceUsd: 14,
        pourSizeOz: 2,
      }),
    ).toBe(700);
  });

  it("returns a versioned sum of rounded 1 oz component prices", () => {
    const pricing = calculateFlightPricing([
      { id: "pour_1", venueSpiritId: "venue_1", priceUsd: "14.00", pourSizeOz: "2.0" },
      { id: "pour_2", venueSpiritId: "venue_2", priceUsd: "18.00", pourSizeOz: "1.5" },
    ]);

    expect(pricing).toEqual({
      formulaVersion: FLIGHT_PRICING_FORMULA_VERSION,
      totalPriceUsd: 19,
      lines: [
        { venueSpiritId: "venue_1", spiritPourId: "pour_1", linePriceUsd: 7 },
        { venueSpiritId: "venue_2", spiritPourId: "pour_2", linePriceUsd: 12 },
      ],
    });
  });

  it("rejects unpriced source pours", () => {
    expect(() =>
      calculateFlightLinePriceCents({
        id: "pour_1",
        venueSpiritId: "venue_1",
        priceUsd: null,
        pourSizeOz: 2,
      }),
    ).toThrow(/priced source pour/i);
  });
});
