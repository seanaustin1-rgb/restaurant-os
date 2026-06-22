import { describe, expect, it } from "vitest";
import { computeVacationRentalImportReadiness } from "./vacation-rental-import-readiness";

describe("vacation rental import readiness", () => {
  it("recognizes Escapia as strong operational readiness but incomplete profitability", () => {
    const result = computeVacationRentalImportReadiness({
      unitCount: 1_000,
      annualBookings: 14_000,
      sources: [
        {
          name: "Escapia",
          capabilities: ["propertyManagers", "unitInventory", "rates", "feesTaxes", "bookingRestrictions", "bookingChannels"],
        },
      ],
    });

    expect(result.layers.find((layer) => layer.key === "escapiaReadiness")?.health).toBe("green");
    expect(result.layers.find((layer) => layer.key === "profitability")?.health).toBe("red");
    expect(result.layers.find((layer) => layer.key === "operationsAura")?.health).toBe("red");
    expect(result.nextBestSource).toBe("reservation export or PMS bookings feed");
  });

  it("turns the pilot green when bookings, statements, expenses, operations, and reviews are added", () => {
    const result = computeVacationRentalImportReadiness({
      unitCount: 1_000,
      annualBookings: 14_000,
      sources: [
        {
          name: "Escapia",
          capabilities: ["propertyManagers", "unitInventory", "rates", "feesTaxes", "bookingRestrictions", "bookingChannels"],
        },
        {
          name: "Owner statements CSV",
          capabilities: ["bookings", "ownerStatements", "propertyExpenses"],
        },
        {
          name: "Operations exports",
          capabilities: ["maintenance", "housekeeping", "reviews"],
        },
      ],
    });

    expect(result.overallHealth).toBe("green");
    expect(result.overallCoveragePct).toBe(100);
    expect(result.layers.every((layer) => layer.missing.length === 0)).toBe(true);
  });
});
