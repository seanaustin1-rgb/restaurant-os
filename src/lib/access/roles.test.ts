import { describe, expect, it } from "vitest";
import { ADJUSTMENT_ROLES, BROKERAGE_LEADERSHIP_ROLES, DASHBOARD_ROLES } from "./roles";

describe("brokerage leadership roles", () => {
  it("lets a broker reach the dashboard and Executive Cockpit without widening generic adjustment access", () => {
    expect(DASHBOARD_ROLES).toContain("BROKER");
    expect(BROKERAGE_LEADERSHIP_ROLES).toContain("BROKER");
    expect(BROKERAGE_LEADERSHIP_ROLES).not.toContain("INVESTOR");
    expect(ADJUSTMENT_ROLES).not.toContain("BROKER");
  });
});
