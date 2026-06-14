import { describe, it, expect } from "vitest";
import { bandLower, bandHigher } from "./benchmarks";

// The benchmark zone edges are the established industry references encoded in
// loadBenchmarks (Prime ≤60/65, COGS 32/35, Labor 34/36, Net Margin ≥6/3).

describe("bandLower (cost ratios — lower is better)", () => {
  it("greens at or below the green edge", () => {
    expect(bandLower(58, 60, 65)).toBe("green");
    expect(bandLower(60, 60, 65)).toBe("green"); // exactly on the edge
  });
  it("yellows between the edges", () => {
    expect(bandLower(60.01, 60, 65)).toBe("yellow");
    expect(bandLower(65, 60, 65)).toBe("yellow"); // exactly on the yellow edge
  });
  it("reds above the yellow edge", () => {
    expect(bandLower(65.01, 60, 65)).toBe("red");
    expect(bandLower(72, 60, 65)).toBe("red");
  });
});

describe("bandHigher (net margin — higher is better)", () => {
  it("greens at or above the green edge", () => {
    expect(bandHigher(8, 6, 3)).toBe("green");
    expect(bandHigher(6, 6, 3)).toBe("green"); // exactly on the edge
  });
  it("yellows in the thin band", () => {
    expect(bandHigher(5.99, 6, 3)).toBe("yellow");
    expect(bandHigher(3, 6, 3)).toBe("yellow"); // exactly on the yellow edge
  });
  it("reds below the yellow edge, including operating at a loss", () => {
    expect(bandHigher(2.99, 6, 3)).toBe("red");
    expect(bandHigher(-4, 6, 3)).toBe("red");
  });
});
