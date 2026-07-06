import { describe, it, expect } from "vitest";
import type { LeadEscalation } from "@prisma/client";
import { median, computeResponseStats, SPEED_TO_LEAD_TARGET_SEC } from "./lead-metrics";

const lead = (responseSeconds: number | null, escalation: LeadEscalation = "PRIMARY") => ({
  responseSeconds,
  escalation,
});

describe("median", () => {
  it("is null for an empty list", () => {
    expect(median([])).toBeNull();
  });
  it("returns the middle of an odd-length list", () => {
    expect(median([30, 10, 20])).toBe(20);
  });
  it("averages the two middles of an even-length list", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});

describe("computeResponseStats", () => {
  it("splits touched vs untouched and computes median + SLA %", () => {
    const leads = [
      lead(60), // within target
      lead(90), // within target
      lead(300), // breached (5 min)
      lead(null), // untouched
    ];
    const stats = computeResponseStats(leads);
    expect(stats.total).toBe(4);
    expect(stats.touched).toBe(3);
    expect(stats.untouched).toBe(1);
    expect(stats.medianResponseSec).toBe(90);
    expect(stats.pctWithinTarget).toBe(67); // 2 of 3 within 120s → 67%
  });

  it("target boundary is inclusive (<= targetSec counts as within)", () => {
    const stats = computeResponseStats([lead(SPEED_TO_LEAD_TARGET_SEC)]);
    expect(stats.pctWithinTarget).toBe(100);
  });

  it("null median and null SLA when no leads are touched", () => {
    const stats = computeResponseStats([lead(null), lead(null)]);
    expect(stats.touched).toBe(0);
    expect(stats.medianResponseSec).toBeNull();
    expect(stats.pctWithinTarget).toBeNull();
  });

  it("counts escalation leakage (backup vs broker)", () => {
    const leads = [
      lead(45, "PRIMARY"),
      lead(null, "BACKUP"),
      lead(null, "BROKER"),
      lead(null, "BROKER"),
    ];
    const stats = computeResponseStats(leads);
    expect(stats.escalatedToBackup).toBe(1);
    expect(stats.escalatedToBroker).toBe(2);
  });

  it("respects a custom target", () => {
    const stats = computeResponseStats([lead(200), lead(400)], 300);
    expect(stats.pctWithinTarget).toBe(50); // only the 200s lead is within 300s
  });
});
