import { describe, expect, it } from "vitest";
import { auraSnapshotTenantWhere, isEnvAuraOwner, preferTenantScopedRows } from "./aura-owner";

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

describe("preferTenantScopedRows", () => {
  const key = (r: { metric: string; date: string }) => `${r.metric}|${r.date}`;

  it("keeps one row per key, preferring the tenant-scoped row over legacy NULL", () => {
    const rows = [
      { restaurantId: null, metric: "CALL_CLICKS", date: "2026-10-01", value: 5 },
      { restaurantId: "stone", metric: "CALL_CLICKS", date: "2026-10-01", value: 5 },
      { restaurantId: null, metric: "CALL_CLICKS", date: "2026-10-02", value: 3 },
    ];
    const out = preferTenantScopedRows(rows, key);
    expect(out).toHaveLength(2);
    expect(out.reduce((sum, r) => sum + r.value, 0)).toBe(8); // not 13
    expect(out.find((r) => r.date === "2026-10-01")?.restaurantId).toBe("stone");
  });

  it("order doesn't matter", () => {
    const rows = [
      { restaurantId: "stone", metric: "M", date: "d", value: 1 },
      { restaurantId: null, metric: "M", date: "d", value: 1 },
    ];
    expect(preferTenantScopedRows(rows, key)).toEqual([rows[0]]);
  });
});
