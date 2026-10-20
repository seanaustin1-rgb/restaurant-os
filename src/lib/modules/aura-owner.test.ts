import { describe, expect, it } from "vitest";
import { auraSnapshotTenantWhere, isEnvAuraOwner } from "./aura-owner";

describe("isEnvAuraOwner", () => {
  it("only matches the exact owning tenant", () => {
    expect(isEnvAuraOwner("stone", "stone")).toBe(true);
    expect(isEnvAuraOwner("other", "stone")).toBe(false);
  });

  it("fails closed when either side is missing", () => {
    expect(isEnvAuraOwner(null, "stone")).toBe(false);
    expect(isEnvAuraOwner("stone", null)).toBe(false);
    expect(isEnvAuraOwner(undefined, undefined)).toBe(false);
    expect(isEnvAuraOwner("", "")).toBe(false);
  });
});

describe("auraSnapshotTenantWhere", () => {
  it("non-owners see only their own rows, never legacy NULL rows", () => {
    expect(auraSnapshotTenantWhere("other", false)).toEqual({ restaurantId: "other" });
  });

  it("the owner also sees legacy rows written before tenant scoping", () => {
    expect(auraSnapshotTenantWhere("stone", true)).toEqual({
      OR: [{ restaurantId: "stone" }, { restaurantId: null }],
    });
  });
});
