import { describe, expect, it } from "vitest";
import { isFlightPourUnavailable, pourIsAvailable } from "./availability";

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

  it('returns true for "Available"', () => {
    expect(pourIsAvailable("Available")).toBe(true);
  });

  it.each(["Out of stock", "Sold out", "Unavailable", "Hidden", "86'd", "Inactive", "DISCONTINUED"])(
    'returns false for "%s"',
    (label) => {
      expect(pourIsAvailable(label)).toBe(false);
    },
  );
});

describe("isFlightPourUnavailable", () => {
  it("matches the shared unavailable policy", () => {
    expect(isFlightPourUnavailable(null)).toBe(false);
    expect(isFlightPourUnavailable("In stock")).toBe(false);
    expect(isFlightPourUnavailable("Available")).toBe(false);
    expect(isFlightPourUnavailable("Out of stock")).toBe(true);
    expect(isFlightPourUnavailable("Sold out")).toBe(true);
    expect(isFlightPourUnavailable("Temporarily unavailable")).toBe(true);
    expect(isFlightPourUnavailable("Hidden from menu")).toBe(true);
    expect(isFlightPourUnavailable("86'd")).toBe(true);
  });
});
