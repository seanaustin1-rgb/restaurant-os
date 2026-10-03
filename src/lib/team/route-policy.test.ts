import { describe, expect, it } from "vitest";
import { teamOnlyDestination, trustedTeamGuardUrl } from "./route-policy";

describe("Team-only route policy", () => {
  it("redirects a Team-only user from dashboard and financial pages", () => {
    for (const path of ["/dashboard", "/transactions", "/settings/allocation", "/investor", "/modules/brokerage", "/"]) {
      expect(teamOnlyDestination(path, true)).toBe("redirect");
    }
  });

  it("forbids non-Team APIs and allows only Team routes", () => {
    expect(teamOnlyDestination("/api/financial/report", true)).toBe("forbid");
    expect(teamOnlyDestination("/team", true)).toBe("allow");
    expect(teamOnlyDestination("/team/manage", true)).toBe("allow");
    expect(teamOnlyDestination("/api/team/route-guard", true)).toBe("allow");
    expect(teamOnlyDestination("/dashboard", false)).toBe("allow");
  });
});

describe("Team route guard origin", () => {
  it("uses only the configured app or Vercel host before forwarding a session", () => {
    expect(trustedTeamGuardUrl("https://app.example/dashboard", "https://app.example")?.href)
      .toBe("https://app.example/api/team/route-guard");
    expect(trustedTeamGuardUrl("https://preview.vercel.app/dashboard", "https://app.example", "preview.vercel.app")?.href)
      .toBe("https://preview.vercel.app/api/team/route-guard");
    expect(trustedTeamGuardUrl("https://attacker.example/dashboard", "https://app.example"))
      .toBeNull();
  });
});
