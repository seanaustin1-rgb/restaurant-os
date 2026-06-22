import { describe, expect, it } from "vitest";
import { computePropertyHeartbeat } from "./property-heartbeat";

describe("property heartbeat", () => {
  it("calculates owner proceeds after property operating costs", () => {
    const result = computePropertyHeartbeat({
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
    });

    expect(result.managementFee).toBeCloseTo(3_240, 2);
    expect(result.ownerProceeds).toBeCloseTo(10_360, 2);
    expect(result.ownerProceedsPct).toBeCloseTo(57.56, 2);
    expect(result.reserveCushion).toBeCloseTo(2_360, 2);
    expect(result.revPar).toBeCloseTo(234, 2);
    expect(result.overallHealth).toBe("green");
  });

  it("flags weak guest aura when issues and response times are high", () => {
    const result = computePropertyHeartbeat({
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
    });

    expect(result.maintenanceHealth).toBe("red");
    expect(result.guestAuraHealth).toBe("red");
    expect(result.bookingMomentumHealth).toBe("red");
    expect(result.overallHealth).toBe("red");
    expect(result.note).toContain("Maintenance");
  });
});
