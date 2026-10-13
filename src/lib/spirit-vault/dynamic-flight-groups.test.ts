import { describe, expect, it } from "vitest";
import { generateDynamicGroupings } from "./dynamic-flight-groups";
import type { FlightCandidatePour } from "./flight-template-candidates";
import type { FlightTemplate } from "./flight-templates";

function makePour(overrides: Partial<FlightCandidatePour> = {}): FlightCandidatePour {
  return {
    venueSpiritId: "vs_1",
    spiritPourId: "sp_1",
    name: "Test Spirit",
    category: "Bourbon",
    pourLabel: "2 oz",
    pourSizeOz: 2,
    priceUsd: 12,
    oneOzPriceUsd: 6,
    suggestedBites: [],
    proofN: 90,
    searchText: "test spirit bourbon",
    hasVenueVoice: false,
    toastUnitsSold: 0,
    ...overrides,
  };
}

const staticTemplateWithCategory = (categories: string[]): FlightTemplate => ({
  key: "static-test",
  name: "Static Test",
  description: "Test",
  throughLine: "Test",
  maxPours: 4,
  autoOrder: "slot-order",
  slots: [{ key: "pool", label: "Pool", rules: { categories }, itemNote: "Test" }],
});

describe("generateDynamicGroupings", () => {
  it("returns empty array when no pours", () => {
    expect(generateDynamicGroupings([], [])).toEqual([]);
  });

  it("returns empty array when all categories are covered by static templates", () => {
    const pours = Array.from({ length: 5 }, (_, i) =>
      makePour({ spiritPourId: `sp_${i}`, venueSpiritId: `vs_${i}`, category: "Bourbon" }),
    );
    const statics = [staticTemplateWithCategory(["Bourbon"])];
    expect(generateDynamicGroupings(pours, statics)).toEqual([]);
  });

  it("generates a template for an uncovered category with enough pours", () => {
    const pours = Array.from({ length: 4 }, (_, i) =>
      makePour({ spiritPourId: `sp_${i}`, venueSpiritId: `vs_${i}`, category: "Rum" }),
    );
    const result = generateDynamicGroupings(pours, []);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("dyn-rum");
    expect(result[0].name).toBe("Rum Flight");
    expect(result[0].slots[0].rules.categories).toEqual(["Rum"]);
  });

  it("skips categories with fewer than 3 pours", () => {
    const pours = [
      makePour({ spiritPourId: "sp_1", venueSpiritId: "vs_1", category: "Gin" }),
      makePour({ spiritPourId: "sp_2", venueSpiritId: "vs_2", category: "Gin" }),
    ];
    expect(generateDynamicGroupings(pours, [])).toEqual([]);
  });

  it("generates templates for multiple uncovered categories", () => {
    const pours = [
      ...Array.from({ length: 5 }, (_, i) =>
        makePour({ spiritPourId: `rum_${i}`, venueSpiritId: `vs_rum_${i}`, category: "Rum" }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makePour({ spiritPourId: `vod_${i}`, venueSpiritId: `vs_vod_${i}`, category: "Vodka" }),
      ),
    ];
    const result = generateDynamicGroupings(pours, []);
    expect(result).toHaveLength(2);
    // Sorted by pour count descending
    expect(result[0].key).toBe("dyn-rum");
    expect(result[1].key).toBe("dyn-vodka");
  });

  it("skips covered categories even when they have enough pours", () => {
    const pours = [
      ...Array.from({ length: 4 }, (_, i) =>
        makePour({ spiritPourId: `agave_${i}`, venueSpiritId: `vs_agave_${i}`, category: "Agave" }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makePour({ spiritPourId: `rum_${i}`, venueSpiritId: `vs_rum_${i}`, category: "Rum" }),
      ),
    ];
    const statics = [staticTemplateWithCategory(["Agave", "Tequila", "Mezcal"])];
    const result = generateDynamicGroupings(pours, statics);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("dyn-rum");
  });

  it("coverage check is case-insensitive", () => {
    const pours = Array.from({ length: 4 }, (_, i) =>
      makePour({ spiritPourId: `sp_${i}`, venueSpiritId: `vs_${i}`, category: "rum" }),
    );
    const statics = [staticTemplateWithCategory(["Rum"])];
    expect(generateDynamicGroupings(pours, statics)).toEqual([]);
  });

  it("generated template has correct structure", () => {
    const pours = Array.from({ length: 3 }, (_, i) =>
      makePour({ spiritPourId: `sp_${i}`, venueSpiritId: `vs_${i}`, category: "Rum" }),
    );
    const [template] = generateDynamicGroupings(pours, []);
    expect(template.maxPours).toBe(4);
    expect(template.slots).toHaveLength(1);
    expect(template.autoOrder).toBe("slot-order");
    expect(template.throughLine).toContain("rum");
    expect(template.description).toContain("3");
  });

  it("uses known category metadata for Rum", () => {
    const pours = Array.from({ length: 3 }, (_, i) =>
      makePour({ spiritPourId: `sp_${i}`, venueSpiritId: `vs_${i}`, category: "Rum" }),
    );
    const [template] = generateDynamicGroupings(pours, []);
    expect(template.throughLine).toContain("geography");
    expect(template.slots[0].itemNote).toContain("molasses");
  });

  it("uses fallback metadata for unknown categories", () => {
    const pours = Array.from({ length: 3 }, (_, i) =>
      makePour({ spiritPourId: `sp_${i}`, venueSpiritId: `vs_${i}`, category: "Aquavit" }),
    );
    const [template] = generateDynamicGroupings(pours, []);
    expect(template.key).toBe("dyn-aquavit");
    expect(template.name).toBe("Aquavit Flight");
    expect(template.throughLine).toContain("aquavit");
  });

  it("works with the real static template set", () => {
    // Simulate a vault with Rum and Vodka (not covered) plus Bourbon and Rye (covered)
    const pours = [
      ...Array.from({ length: 25 }, (_, i) =>
        makePour({ spiritPourId: `rum_${i}`, venueSpiritId: `vs_rum_${i}`, category: "Rum" }),
      ),
      ...Array.from({ length: 23 }, (_, i) =>
        makePour({ spiritPourId: `vod_${i}`, venueSpiritId: `vs_vod_${i}`, category: "Vodka" }),
      ),
      ...Array.from({ length: 62 }, (_, i) =>
        makePour({ spiritPourId: `bbn_${i}`, venueSpiritId: `vs_bbn_${i}`, category: "Bourbon" }),
      ),
      ...Array.from({ length: 21 }, (_, i) =>
        makePour({ spiritPourId: `rye_${i}`, venueSpiritId: `vs_rye_${i}`, category: "Rye" }),
      ),
    ];
    // Static templates cover Bourbon (via mash-bill, finished-whiskey) and Rye (via rye-progression)
    const statics = [
      staticTemplateWithCategory(["Bourbon"]),
      staticTemplateWithCategory(["Rye"]),
    ];
    const result = generateDynamicGroupings(pours, statics);
    const keys = result.map((t) => t.key);
    expect(keys).toContain("dyn-rum");
    expect(keys).toContain("dyn-vodka");
    expect(keys).not.toContain("dyn-bourbon");
    expect(keys).not.toContain("dyn-rye");
  });
});
