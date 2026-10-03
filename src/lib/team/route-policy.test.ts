import { describe, expect, it } from "vitest";
import { teamOnlyDestination } from "./route-policy";

describe("Team-only route policy", () => {
  it("redirects a Team-only user from dashboard and financial pages", () => {
    for (const path of ["/dashboard", "/transactions", "/settings/allocation", "/investor", "/modules/brokerage", "/"]) {
      expect(teamOnlyDestination(path, true)).toBe("redirect");
    }
  });

  it("forbids non-Team APIs and allows only Team routes", () => {
    expect(teamOnlyDestination("/api/financial/report", true)).toBe("forbid");
    expect(teamOnlyDestination("/dashboard", true, "POST")).toBe("forbid");
    expect(teamOnlyDestination("/team", true)).toBe("allow");
    expect(teamOnlyDestination("/team/manage", true)).toBe("allow");
    expect(teamOnlyDestination("/api/team/example", true)).toBe("allow");
    expect(teamOnlyDestination("/sign-in", true)).toBe("allow");
    expect(teamOnlyDestination("/sign-out", true)).toBe("allow");
    expect(teamOnlyDestination("/dashboard", false)).toBe("allow");
  });

  it("allows only the business invite page and its accept POST", () => {
    expect(teamOnlyDestination("/access/accept", true, "GET")).toBe("allow");
    expect(teamOnlyDestination("/access/accept", true, "POST")).toBe("allow");
    expect(teamOnlyDestination("/access/accept", true, "DELETE")).toBe("forbid");
    expect(teamOnlyDestination("/access/accept/other", true, "GET")).toBe("redirect");
    expect(teamOnlyDestination("/access", true, "GET")).toBe("redirect");
  });
});
