import { describe, expect, it } from "vitest";
import { computeMarketAura } from "./market-aura";

describe("market aura", () => {
  it("scores a healthy market when pendings, showings, and intent are strong", () => {
    const result = computeMarketAura({
      market: "York, PA",
      newListings7d: 85,
      pendings7d: 78,
      avgDom: 24,
      domTrendPct: -4,
      priceDrops7d: 8,
      showingAppointments7d: 155,
      showingTrendPct: 12,
      mortgageRatePct: 6.1,
      mortgageRateChangeBps7d: -8,
      googleIntentTrendPct: 16,
    });

    expect(result.listingToPendingRatio).toBeCloseTo(0.9176, 3);
    expect(result.marketAuraHealth).toBe("green");
    expect(result.marketAuraScore).toBeGreaterThan(80);
  });

  it("flags market pressure from slow pendings, DOM, price drops, showings, and rates", () => {
    const result = computeMarketAura({
      market: "Cooling market",
      newListings7d: 120,
      pendings7d: 36,
      avgDom: 84,
      domTrendPct: 28,
      priceDrops7d: 62,
      showingAppointments7d: 22,
      showingTrendPct: -25,
      mortgageRatePct: 7.9,
      mortgageRateChangeBps7d: 48,
      googleIntentTrendPct: -22,
    });

    expect(result.marketAuraHealth).toBe("red");
    expect(result.marketAuraScore).toBeLessThan(25);
    expect(result.note).toContain("Mortgage");
  });
});
