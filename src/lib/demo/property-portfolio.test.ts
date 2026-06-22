import { describe, expect, it } from "vitest";
import { computePropertyPortfolio } from "./property-portfolio";

describe("property portfolio", () => {
  it("rolls property heartbeats into owner proceeds and operating pressure", () => {
    const result = computePropertyPortfolio([
      {
        name: "Lake House",
        monthlyBookingRevenue: 18_000,
        occupancyPct: 72,
        averageDailyRate: 325,
        cleaningCosts: 2_100,
        maintenanceCosts: 1_400,
        platformFees: 900,
        managementFeePct: 18,
        ownerReserveTarget: 8_000,
        openIssues: 1,
        repeatIssues: 0,
        avgResponseHours: 3,
        reviewRating: 4.8,
        futureBookedNights: 18,
        next30AvailableNights: 28,
      },
      {
        name: "Beach Cottage",
        monthlyBookingRevenue: 21_000,
        occupancyPct: 78,
        averageDailyRate: 410,
        cleaningCosts: 2_400,
        maintenanceCosts: 1_100,
        platformFees: 1_100,
        managementFeePct: 18,
        ownerReserveTarget: 9_500,
        openIssues: 0,
        repeatIssues: 0,
        avgResponseHours: 2,
        reviewRating: 4.9,
        futureBookedNights: 21,
        next30AvailableNights: 27,
      },
    ]);

    expect(result.propertyCount).toBe(2);
    expect(result.monthlyBookingRevenue).toBe(39_000);
    expect(result.ownerProceeds).toBeCloseTo(22_980, 2);
    expect(result.ownerProceedsPct).toBeCloseTo(58.92, 2);
    expect(result.maintenancePressurePct).toBeCloseTo(17.95, 2);
    expect(result.overallHealth).toBe("green");
  });

  it("surfaces the property creating the most pressure", () => {
    const result = computePropertyPortfolio([
      {
        name: "Strong Cabin",
        monthlyBookingRevenue: 16_000,
        occupancyPct: 74,
        averageDailyRate: 280,
        cleaningCosts: 1_500,
        maintenanceCosts: 900,
        platformFees: 800,
        managementFeePct: 18,
        ownerReserveTarget: 7_000,
        openIssues: 1,
        repeatIssues: 0,
        avgResponseHours: 3,
        reviewRating: 4.8,
        futureBookedNights: 18,
        next30AvailableNights: 26,
      },
      {
        name: "Downtown Condo",
        monthlyBookingRevenue: 9_000,
        occupancyPct: 44,
        averageDailyRate: 180,
        cleaningCosts: 1_700,
        maintenanceCosts: 2_600,
        platformFees: 650,
        managementFeePct: 20,
        ownerReserveTarget: 5_000,
        openIssues: 5,
        repeatIssues: 2,
        avgResponseHours: 24,
        reviewRating: 3.9,
        futureBookedNights: 7,
        next30AvailableNights: 25,
      },
    ]);

    expect(result.pressureCount).toBe(1);
    expect(result.overallHealth).toBe("red");
    expect(result.topPressure?.name).toBe("Downtown Condo");
    expect(result.note).toContain("under pressure");
  });
});
