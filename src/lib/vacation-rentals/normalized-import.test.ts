import { describe, expect, it } from "vitest";
import { normalizeVacationRentalImport } from "./normalized-import";

const context = {
  restaurantId: "tenant_1",
  sourceId: "source_1",
  importBatchId: "batch_1",
  sourceName: "Escapia",
  sourceKind: "ESCAPIA" as const,
};

describe("vacation rental normalized import", () => {
  it("normalizes PMS, statement, expense, maintenance, and review rows", () => {
    const result = normalizeVacationRentalImport(context, {
      properties: [
        {
          externalUnitId: "unit_101",
          name: "Lake House",
          city: "York",
          state: "PA",
          bedrooms: 4,
          bathrooms: 2.5,
          sleeps: 10,
        },
      ],
      bookings: [
        {
          externalBookingId: "booking_500",
          externalUnitId: "unit_101",
          channel: "Airbnb",
          checkIn: "2026-07-01",
          checkOut: "2026-07-05",
          grossRent: 2400.239,
          fees: 180,
          taxes: 144,
          platformFees: 72,
        },
      ],
      ownerStatements: [
        {
          externalUnitId: "unit_101",
          periodStart: "2026-07-01",
          periodEnd: "2026-07-31",
          grossRevenue: 12000,
          ownerPayout: 7600,
          managementFees: 2160,
          expenses: 900,
        },
      ],
      expenses: [
        {
          externalUnitId: "unit_101",
          kind: "CLEANING",
          vendor: "Clean Co",
          date: "2026-07-06",
          amount: 325,
        },
      ],
      maintenanceIssues: [
        {
          externalUnitId: "unit_101",
          title: "HVAC noise",
          openedAt: "2026-07-07T12:00:00.000Z",
          estimatedCost: 450,
        },
      ],
      reviews: [
        {
          externalUnitId: "unit_101",
          platform: "Google",
          rating: 4.8,
          reviewedAt: "2026-07-08",
          responseHours: 3,
        },
      ],
    });

    expect(result.source.providerName).toBe("Escapia");
    expect(result.batch.acceptedCount).toBe(6);
    expect(result.batch.rejectedCount).toBe(0);
    expect(result.properties[0].name).toBe("Lake House");
    expect(result.bookings[0].grossRent).toBe(2400.24);
    expect(result.bookings[0].nights).toBe(4);
    expect(result.ownerStatements[0].externalStatementId).toMatch(/^statement-/);
    expect(result.expenses[0].kind).toBe("CLEANING");
    expect(result.maintenanceIssues[0].status).toBe("OPEN");
    expect(result.reviews[0].platform).toBe("Google");
  });

  it("rejects invalid rows and flags references to missing units", () => {
    const result = normalizeVacationRentalImport(context, {
      properties: [{ externalUnitId: "unit_101", name: "Lake House" }],
      bookings: [
        {
          externalUnitId: "unit_missing",
          checkIn: "2026-07-01",
          checkOut: "2026-07-02",
          grossRent: 500,
        },
        {
          externalUnitId: "",
          checkIn: "not a date",
          checkOut: "2026-07-02",
          grossRent: 0,
        },
      ],
    });

    expect(result.batch.acceptedCount).toBe(2);
    expect(result.batch.rejectedCount).toBe(1);
    expect(result.batch.summary.missingUnitReferences).toEqual(["unit_missing"]);
    expect(result.rejected[0]).toContain("booking missing");
  });
});
