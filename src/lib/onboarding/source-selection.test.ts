import { describe, expect, it } from "vitest";
import {
  defaultOnboardingSourceSelections,
  onboardingSourceKey,
  plannedSourceConfigsForOnboarding,
} from "./source-selection";

describe("onboarding source selection", () => {
  it("defaults to the minimum sources for the selected industry", () => {
    const selected = defaultOnboardingSourceSelections("REAL_ESTATE_BROKERAGE");
    expect(selected.map((source) => onboardingSourceKey(source.category, source.providerName))).toEqual([
      "cash::Plaid",
      "accounting::QuickBooks Online",
    ]);
  });

  it("persists only valid source-map options as planned setup rows", () => {
    const rows = plannedSourceConfigsForOnboarding({
      businessType: "REAL_ESTATE_BROKERAGE",
      updatedBy: "user_123",
      selectedSources: [
        { category: "cash", providerName: "Plaid" },
        { category: "pipeline", providerName: "BoldTrail CRM / export" },
        { category: "pipeline", providerName: "appFiles transaction export" },
        { category: "sales", providerName: "Escapia API / export" },
      ],
    });

    expect(rows.map((row) => onboardingSourceKey(row.category, row.providerName))).toEqual([
      "cash::Plaid",
      "pipeline::BoldTrail CRM / export",
      "pipeline::appFiles transaction export",
    ]);
    expect(rows.every((row) => row.status === "PLANNED")).toBe(true);
    expect(rows.every((row) => row.updatedBy === "user_123")).toBe(true);
    expect(rows.find((row) => row.providerName === "BoldTrail CRM / export")?.notes).toContain("selected during onboarding");
    expect(rows.find((row) => row.providerName === "BoldTrail CRM / export")?.notes).not.toContain("API setup requested");
  });

  it("keeps vacation-rental Escapia profile selections available from onboarding", () => {
    const rows = plannedSourceConfigsForOnboarding({
      businessType: "VACATION_RENTAL",
      selectedSources: [
        { category: "sales", providerName: "Escapia API / export" },
        { category: "costs", providerName: "Escapia owner statement / QBO export" },
      ],
    });

    expect(rows.map((row) => onboardingSourceKey(row.category, row.providerName))).toEqual([
      "sales::Escapia API / export",
      "costs::Escapia owner statement / QBO export",
    ]);
    expect(rows.map((row) => row.notes).join(" ")).toContain("Escapia");
  });
});
