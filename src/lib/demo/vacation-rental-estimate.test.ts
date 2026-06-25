import { describe, it, expect } from "vitest";
import { computeVacationRentalEstimate, type VacationRentalEstimateInputs } from "./vacation-rental-estimate";

const base: VacationRentalEstimateInputs = {
  name: "Shoreline Stay Group",
  market: "York, PA",
  pms: "guesty",
  properties: 6,
  adr: 250,
  occupancyPct: 70,
  adrBasis: "gross",
  season: "typical",
  platformFeePct: 3,
  managementFeePct: 20,
  cleaningMonthly: 4000,
  maintenanceMonthly: 1800,
  utilitiesSuppliesMonthly: 1200,
  monthlyFixedBills: 2500,
};

describe("computeVacationRentalEstimate", () => {
  it("drives the revenue engine from occupancy × ADR × doors", () => {
    const r = computeVacationRentalEstimate(base);
    expect(r.revPar).toBeCloseTo(175, 1); // 250 × 0.70
    expect(r.grossBookingRevenue).toBeCloseTo(31962, 0); // 250 × 6 × 30.44 × 0.70
    expect(r.revenueAfterPlatform).toBeCloseTo(31003.14, 1);
  });

  it("computes owner proceeds after the full pass-through stack", () => {
    const r = computeVacationRentalEstimate(base);
    expect(r.managementFee).toBeCloseTo(6200.63, 1);
    expect(r.ownerProceeds).toBeCloseTo(15302.51, 1);
    expect(r.ownerProceedsPct).toBeCloseTo(47.88, 1);
    expect(r.ownerProceedsPerProperty).toBeCloseTo(2550.42, 1);
    expect(r.maintenanceDragPct).toBeCloseTo(5.63, 1);
  });

  it("computes break-even occupancy and margin of safety", () => {
    const r = computeVacationRentalEstimate(base);
    // FC 9,500 / ((1-0.03)(1-0.20)) = 12,242 gross; / 45,660 capacity = 26.8%
    expect(r.breakEvenOccupancyPct).toBeCloseTo(26.81, 1);
    expect(r.marginOfSafetyPct).toBeCloseTo(61.7, 0);
    expect(r.breakEvenHealth).toBe("green");
  });

  it("quantifies the self-managed vs managed gap", () => {
    const r = computeVacationRentalEstimate(base);
    expect(r.managed).toBe(true);
    expect(r.managementFeeMonthlyCost).toBeCloseTo(6200.63, 1);
    // dropping the PM fee lifts owner proceeds ~47.9% → ~67.3%
    expect(r.selfManagedOwnerProceedsPct).toBeCloseTo(67.28, 1);
    expect(r.selfManagedOwnerProceedsPct).toBeGreaterThan(r.ownerProceedsPct);
  });

  it("reconstructs a gross ADR when the operator enters net ADR", () => {
    const net = computeVacationRentalEstimate({ ...base, adr: 242.5, adrBasis: "net" });
    // 242.5 net at a 3% platform fee implies ~250 gross
    expect(net.adrGross).toBeCloseTo(250, 1);
    expect(net.grossBookingRevenue).toBeCloseTo(31962, 0);
  });

  it("flags self-managed portfolios (no PM fee)", () => {
    const r = computeVacationRentalEstimate({ ...base, managementFeePct: 0 });
    expect(r.managed).toBe(false);
    expect(r.managementFee).toBe(0);
    expect(r.ownerProceedsPct).toBeCloseTo(r.selfManagedOwnerProceedsPct, 5);
  });

  it("health bands react to a weak portfolio", () => {
    const weak = computeVacationRentalEstimate({
      ...base,
      occupancyPct: 42,
      managementFeePct: 28,
      maintenanceMonthly: 5200,
    });
    expect(weak.occupancyHealth).toBe("red"); // 42 < 50
    expect(weak.maintenanceHealth).not.toBe("green");
    expect(["yellow", "red"]).toContain(weak.ownerProceedsHealth);
  });
});
