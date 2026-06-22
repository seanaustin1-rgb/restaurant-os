import { describe, expect, it } from "vitest";
import { buildPropertyActionQueue } from "./property-action-queue";
import { computePropertyHeartbeat } from "./property-heartbeat";

describe("property action queue", () => {
  it("prioritizes the red property issues first", () => {
    const healthy = computePropertyHeartbeat({
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
    const pressured = computePropertyHeartbeat({
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

    const queue = buildPropertyActionQueue([healthy, pressured], 3);

    expect(queue).toHaveLength(3);
    expect(queue[0].propertyName).toBe("Downtown Condo");
    expect(queue[0].priority).toBe("red");
    expect(queue.map((item) => item.kind)).toContain("maintenance");
  });

  it("returns no actions when property health is green", () => {
    const healthy = computePropertyHeartbeat({
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
    });

    expect(buildPropertyActionQueue([healthy])).toEqual([]);
  });
});
