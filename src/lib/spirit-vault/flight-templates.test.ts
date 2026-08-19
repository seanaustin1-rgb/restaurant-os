import { describe, expect, it } from "vitest";
import { getFlightTemplate, listFlightTemplates, matchesFlightTemplateRules } from "./flight-templates";

describe("flight templates", () => {
  it("registers the MVP flight templates", () => {
    expect(listFlightTemplates().map((template) => template.key)).toEqual([
      "proof-ascender",
      "high-proof",
      "bottled-in-bond",
      "finished-whiskey",
      "rye-progression",
      "agave-compare",
    ]);
  });

  it("matches high-proof candidates by numeric proof", () => {
    const slot = getFlightTemplate("high-proof").slots[0];

    expect(matchesFlightTemplateRules({ name: "Barrel Strength", proofN: 114 }, slot.rules)).toBe(true);
    expect(matchesFlightTemplateRules({ name: "Easy Sipper", proofN: 94 }, slot.rules)).toBe(false);
    expect(matchesFlightTemplateRules({ name: "Mystery Proof", proofN: null }, slot.rules)).toBe(false);
  });

  it("keeps proof ascender slots mutually bounded", () => {
    const template = getFlightTemplate("proof-ascender");
    const candidate = { name: "Bonded Bourbon", proofN: 100 };

    expect(template.slots.map((slot) => matchesFlightTemplateRules(candidate, slot.rules))).toEqual([false, true, false, false]);
  });

  it("requires bonded text and 100 proof for bottled-in-bond", () => {
    const slot = getFlightTemplate("bottled-in-bond").slots[0];

    expect(matchesFlightTemplateRules({ name: "Bottled in Bond Bourbon", proofN: 100 }, slot.rules)).toBe(true);
    expect(matchesFlightTemplateRules({ name: "Bottled in Bond Bourbon", proofN: 112 }, slot.rules)).toBe(false);
    expect(matchesFlightTemplateRules({ name: "Bottled in Bond Bourbon", proofN: null }, slot.rules)).toBe(false);
    expect(matchesFlightTemplateRules({ name: "Straight Bourbon", proofN: 100 }, slot.rules)).toBe(false);
  });
});
