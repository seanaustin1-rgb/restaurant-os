import { describe, expect, it } from "vitest";
import { businessTypeFromOnboardingParam } from "./business-type-param";

describe("businessTypeFromOnboardingParam", () => {
  it("maps supported onboarding type aliases to industry templates", () => {
    expect(businessTypeFromOnboardingParam("real-estate")).toBe("REAL_ESTATE_BROKERAGE");
    expect(businessTypeFromOnboardingParam("brokerage")).toBe("REAL_ESTATE_BROKERAGE");
    expect(businessTypeFromOnboardingParam("vacation-rental")).toBe("VACATION_RENTAL");
    expect(businessTypeFromOnboardingParam("property-management")).toBe("VACATION_RENTAL");
    expect(businessTypeFromOnboardingParam("retail")).toBe("RETAIL");
    expect(businessTypeFromOnboardingParam("contractor")).toBe("CONTRACTOR");
    expect(businessTypeFromOnboardingParam("service")).toBe("SERVICE");
  });

  it("defaults unknown or missing values to restaurant onboarding", () => {
    expect(businessTypeFromOnboardingParam(undefined)).toBe("RESTAURANT");
    expect(businessTypeFromOnboardingParam("")).toBe("RESTAURANT");
    expect(businessTypeFromOnboardingParam("unknown")).toBe("RESTAURANT");
  });
});
