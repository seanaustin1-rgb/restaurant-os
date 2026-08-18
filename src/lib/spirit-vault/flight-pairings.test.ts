import { describe, expect, it } from "vitest";
import { suggestBites } from "./flight-pairings";

describe("suggestBites", () => {
  it("leads with the dominant flavor axis", () => {
    const bites = suggestBites({ Sweet: 8, Oak: 2, Spice: 1, Fruit: 1, Smoke: 0, Earth: 0, Herbal: 0 });
    expect(bites[0]).toBe("Salted caramel");
  });

  it("adds a second bite only when the next axis is meaningfully present (>= 4)", () => {
    expect(suggestBites({ Sweet: 8, Oak: 6, Spice: 1, Fruit: 0, Smoke: 0, Earth: 0, Herbal: 0 })).toEqual([
      "Salted caramel",
      "Aged cheddar",
    ]);
    // Second axis too faint → single bite.
    expect(suggestBites({ Sweet: 8, Oak: 2, Spice: 1, Fruit: 0, Smoke: 0, Earth: 0, Herbal: 0 })).toEqual([
      "Salted caramel",
    ]);
  });

  it("respects the max and is deterministic", () => {
    const f = { Sweet: 7, Oak: 7, Spice: 7, Fruit: 7, Smoke: 7, Earth: 7, Herbal: 7 };
    expect(suggestBites(f, 1)).toEqual(["Salted caramel"]);
    expect(suggestBites(f)).toEqual(suggestBites(f)); // stable
    expect(suggestBites(f)).toHaveLength(2);
  });

  it("maps smoke and oak to their bar-recognizable bites", () => {
    expect(suggestBites({ Smoke: 9, Oak: 5, Sweet: 1, Spice: 1, Fruit: 1, Earth: 1, Herbal: 1 })).toEqual([
      "Smoked almonds",
      "Aged cheddar",
    ]);
  });

  it("always returns at least one bite, even with no/empty flavor", () => {
    expect(suggestBites(null)).toHaveLength(1);
    expect(suggestBites({})).toHaveLength(1);
  });
});
