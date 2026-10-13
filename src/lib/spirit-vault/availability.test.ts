import { describe, expect, it } from "vitest";
import { pourIsAvailable } from "./availability";

describe("pourIsAvailable", () => {
  it("returns true for null (not tracked)", () => {
    expect(pourIsAvailable(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(pourIsAvailable(undefined)).toBe(true);
  });

  it('returns true for "In stock" (case-insensitive)', () => {
    expect(pourIsAvailable("In stock")).toBe(true);
    expect(pourIsAvailable("in stock")).toBe(true);
    expect(pourIsAvailable("IN STOCK")).toBe(true);
    expect(pourIsAvailable("  In stock  ")).toBe(true);
  });

  it.each(["Out of stock", "Sold out", "Unavailable", "Hidden", "86'd", "Inactive", "DISCONTINUED"])(
    'returns false for "%s"',
    (label) => {
      expect(pourIsAvailable(label)).toBe(false);
    },
  );
});
