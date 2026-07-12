import { describe, expect, it } from "vitest";
import { ravenDecisionStorageKey } from "./raven-decision";

describe("ravenDecisionStorageKey", () => {
  it("scopes the browser-local pilot decision by tenant and local day", () => {
    expect(ravenDecisionStorageKey("brokerage-1", "user-1", new Date(2026, 6, 12, 8))).toBe(
      "raven:morning-ritual:brokerage-1:user-1:2026-07-12",
    );
  });
});
