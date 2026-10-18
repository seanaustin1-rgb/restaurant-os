import { describe, it, expect } from "vitest";
import { classifyDay, currentStreak, datesBetween, type DayFacts } from "./recon-health";

function day(over: Partial<DayFacts>): DayFacts {
  return {
    date: "2026-10-20",
    pendingReview: 0,
    manuallyDecided: 0,
    toastSynced: true,
    legacy: { COGS: 812.4, REVENUE: 4200 },
    ledger: { COGS: 812.4, REVENUE: 4200 },
    ...over,
  };
}

describe("classifyDay", () => {
  it("is clean when nothing is pending, nothing was hand-decided, spines agree and Toast synced", () => {
    const v = classifyDay(day({}));
    expect(v.clean).toBe(true);
    expect(v.issues).toEqual([]);
  });

  it("flags rows still waiting on review", () => {
    expect(classifyDay(day({ pendingReview: 2 })).issues).toContain("pending-review");
  });

  it("counts a hand-approved or excluded row as manual intervention", () => {
    const v = classifyDay(day({ manuallyDecided: 1 }));
    expect(v.clean).toBe(false);
    expect(v.issues).toEqual(["manual-intervention"]);
  });

  it("flags a day whose spines disagree beyond tolerance", () => {
    const v = classifyDay(day({ ledger: { COGS: 700, REVENUE: 4200 } }));
    expect(v.issues).toEqual(["spines-diverge"]);
  });

  it("tolerates sub-dollar rounding when there is no legacy baseline", () => {
    expect(classifyDay(day({ legacy: { REVENUE: 4200 }, ledger: { REVENUE: 4200, OTHER: 0.5 } })).clean).toBe(true);
  });

  it("flags a missing Toast business day", () => {
    expect(classifyDay(day({ toastSynced: false })).issues).toEqual(["toast-missing"]);
  });

  it("treats a quiet day (no bank activity) as clean when Toast synced", () => {
    expect(classifyDay(day({ legacy: {}, ledger: {} })).clean).toBe(true);
  });
});

describe("currentStreak", () => {
  it("counts consecutive clean days back from the latest", () => {
    const verdicts = [
      classifyDay(day({ date: "2026-10-18", pendingReview: 1 })),
      classifyDay(day({ date: "2026-10-19" })),
      classifyDay(day({ date: "2026-10-20" })),
    ];
    expect(currentStreak(verdicts)).toBe(2);
  });

  it("is zero when the latest day is dirty", () => {
    expect(currentStreak([classifyDay(day({ date: "2026-10-19" })), classifyDay(day({ date: "2026-10-20", toastSynced: false }))])).toBe(0);
  });
});

describe("datesBetween", () => {
  it("is inclusive and crosses month boundaries", () => {
    expect(datesBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("is empty when from is after to", () => {
    expect(datesBetween("2026-10-21", "2026-10-20")).toEqual([]);
  });
});
