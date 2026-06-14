import { describe, it, expect } from "vitest";
import { orderModules, sanitizeModuleOrder, modulesByKeys } from "./module-order";
import { MODULES } from "@/lib/modules";

const KEYS = MODULES.map((m) => m.key);

describe("orderModules", () => {
  it("returns the default order when nothing is saved", () => {
    expect(orderModules(null).map((m) => m.key)).toEqual(KEYS);
    expect(orderModules(undefined).map((m) => m.key)).toEqual(KEYS);
    expect(orderModules([]).map((m) => m.key)).toEqual(KEYS);
  });

  it("puts saved keys first, then appends the rest in default order", () => {
    const result = orderModules(["aura", "prime-cost"]).map((m) => m.key);
    expect(result.slice(0, 2)).toEqual(["aura", "prime-cost"]);
    // Every module still present, exactly once.
    expect(result).toHaveLength(KEYS.length);
    expect(new Set(result).size).toBe(KEYS.length);
    // The remainder keeps default relative order.
    const rest = result.slice(2);
    expect(rest).toEqual(KEYS.filter((k) => k !== "aura" && k !== "prime-cost"));
  });

  it("never drops or duplicates a module, even with stale/duplicate/garbage saved keys", () => {
    const result = orderModules(["prime-cost", "ghost-module", "prime-cost", 42, null]).map((m) => m.key);
    expect(result).toHaveLength(KEYS.length);
    expect(new Set(result).size).toBe(KEYS.length);
    expect(result[0]).toBe("prime-cost");
  });
});

describe("sanitizeModuleOrder", () => {
  it("keeps only known keys, de-duplicated, in order", () => {
    expect(sanitizeModuleOrder(["aura", "aura", "nope", "break-even"])).toEqual(["aura", "break-even"]);
  });
  it("drops non-string entries", () => {
    expect(sanitizeModuleOrder([1, null, undefined, {}, "labor"])).toEqual(["labor"]);
  });
  it("returns empty for fully invalid input", () => {
    expect(sanitizeModuleOrder(["x", "y", 3])).toEqual([]);
  });
});

describe("modulesByKeys", () => {
  it("returns the modules for the given keys, in order", () => {
    expect(modulesByKeys(["aura", "break-even"]).map((m) => m.key)).toEqual(["aura", "break-even"]);
  });
  it("skips unknown keys and de-duplicates", () => {
    expect(modulesByKeys(["aura", "nope", "aura"]).map((m) => m.key)).toEqual(["aura"]);
  });
  it("returns empty for no keys", () => {
    expect(modulesByKeys([])).toEqual([]);
  });
});
