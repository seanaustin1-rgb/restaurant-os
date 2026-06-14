import { describe, it, expect } from "vitest";
import {
  detectProcessor,
  bandFeeRate,
  TARGET_FEE_RATE_PCT,
  FEE_CREEP_PCT,
} from "./processing-fees";

describe("detectProcessor", () => {
  it("matches named processors", () => {
    expect(detectProcessor("TOAST INC", null)).toBe("Toast");
    expect(detectProcessor("SQ *BLUE BOTTLE", null)).toBe("Square");
    expect(detectProcessor(null, "STRIPE PAYMENT")).toBe("Stripe");
    expect(detectProcessor("Clover", null)).toBe("Clover");
    expect(detectProcessor("Heartland Payment Systems", null)).toBe("Heartland");
    expect(detectProcessor("FIRST DATA", null)).toBe("Fiserv / First Data");
  });

  it("excludes Toast Payroll from the Toast card-fee match", () => {
    // Payroll is not a processing fee — the negative lookahead must skip it,
    // and no generic descriptor should catch it either.
    expect(detectProcessor("Toast Payroll", null)).toBeNull();
  });

  it("lets a named processor win over the generic descriptor", () => {
    expect(detectProcessor("Toast merchant fee", null)).toBe("Toast");
  });

  it("falls back to the generic 'Card Processing' label for bare descriptors", () => {
    expect(detectProcessor(null, "MERCHANT SERVICE FEE")).toBe("Card Processing");
    expect(detectProcessor("BANKCARD DISCOUNT", null)).toBe("Card Processing");
    expect(detectProcessor(null, "Interchange charge")).toBe("Card Processing");
  });

  it("returns null when nothing matches or there is no text", () => {
    expect(detectProcessor("Sysco Foods", "produce delivery")).toBeNull();
    expect(detectProcessor(null, null)).toBeNull();
    expect(detectProcessor("", "")).toBeNull();
  });
});

describe("bandFeeRate (cost lens, lower is better)", () => {
  it("is green at or below the target rate", () => {
    expect(bandFeeRate(2.0)).toBe("green");
    expect(bandFeeRate(TARGET_FEE_RATE_PCT)).toBe("green"); // 2.75 → green
  });
  it("is yellow within the creep band above target", () => {
    expect(bandFeeRate(TARGET_FEE_RATE_PCT + 0.01)).toBe("yellow");
    expect(bandFeeRate(TARGET_FEE_RATE_PCT + FEE_CREEP_PCT)).toBe("yellow"); // 3.25 → yellow
  });
  it("is red above the creep band", () => {
    expect(bandFeeRate(TARGET_FEE_RATE_PCT + FEE_CREEP_PCT + 0.01)).toBe("red"); // 3.26 → red
    expect(bandFeeRate(4.0)).toBe("red");
  });
});
