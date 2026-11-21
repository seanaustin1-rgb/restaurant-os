import { describe, it, expect } from "vitest";
import {
  GATE_CLEAN_DAYS,
  cleanStreak,
  evaluateCleanDay,
  localDayBounds,
  previousDay,
  type CleanDayInput,
} from "./clean-day";
import type { SpineDelta } from "./spine-compare";

const converged: SpineDelta[] = [
  { bucket: "REVENUE", legacy: 1000, ledger: 1005, delta: 5, pctDelta: 0.5 },
  { bucket: "OWNER_PAY", legacy: 0, ledger: 0.5, delta: 0.5, pctDelta: null },
];
const diverged: SpineDelta[] = [
  { bucket: "LABOR", legacy: 1000, ledger: 1200, delta: 200, pctDelta: 20 },
];

const clean = (over: Partial<CleanDayInput> = {}): CleanDayInput => ({
  newExceptionCount: 0,
  openBlockingCount: 0,
  openBacklogCount: 0,
  plaid: { activeConnections: 1, staleConnections: 0 },
  toast: { applicable: true, syncedToday: true },
  spineDeltas: converged,
  ...over,
});

const failing = (v: ReturnType<typeof evaluateCleanDay>) =>
  v.checks.filter((c) => c.pass === false).map((c) => c.key);

describe("evaluateCleanDay", () => {
  it("is clean when every rule passes", () => {
    const v = evaluateCleanDay(clean());
    expect(v.clean).toBe(true);
    expect(failing(v)).toEqual([]);
  });

  it("any new exception today makes the day dirty, even if already resolved by hand", () => {
    const v = evaluateCleanDay(clean({ newExceptionCount: 1 }));
    expect(v.clean).toBe(false);
    expect(failing(v)).toEqual(["NO_NEW_EXCEPTIONS"]);
  });

  it("an open blocking exception makes the day dirty", () => {
    expect(failing(evaluateCleanDay(clean({ openBlockingCount: 2 })))).toEqual(["NO_OPEN_BLOCKING"]);
  });

  it("the old backlog alone does not gate (only NEW exceptions do) but is reported", () => {
    const v = evaluateCleanDay(clean({ openBacklogCount: 373 }));
    expect(v.clean).toBe(true);
    expect(v.openBacklogCount).toBe(373);
  });

  it("a stale Plaid connection makes the day dirty", () => {
    const v = evaluateCleanDay(clean({ plaid: { activeConnections: 2, staleConnections: 1 } }));
    expect(failing(v)).toEqual(["PLAID_SYNCED"]);
    expect(v.checks.find((c) => c.key === "PLAID_SYNCED")?.detail).toContain("1 of 2");
  });

  it("no active Plaid connection is not a pass", () => {
    expect(failing(evaluateCleanDay(clean({ plaid: { activeConnections: 0, staleConnections: 0 } })))).toEqual([
      "PLAID_SYNCED",
    ]);
  });

  it("Toast not refreshed today is dirty; no Toast at all is not applicable and does not gate", () => {
    expect(failing(evaluateCleanDay(clean({ toast: { applicable: true, syncedToday: false } })))).toEqual([
      "TOAST_SYNCED",
    ]);
    const na = evaluateCleanDay(clean({ toast: { applicable: false, syncedToday: false } }));
    expect(na.clean).toBe(true);
    expect(na.checks.find((c) => c.key === "TOAST_SYNCED")?.pass).toBeNull();
  });

  it("diverging spines make the day dirty and name the bucket", () => {
    const v = evaluateCleanDay(clean({ spineDeltas: diverged }));
    expect(failing(v)).toEqual(["SPINES_CONVERGED"]);
    expect(v.checks.find((c) => c.key === "SPINES_CONVERGED")?.detail).toContain("LABOR");
  });

  it("no activity in either spine is trivially converged", () => {
    expect(evaluateCleanDay(clean({ spineDeltas: [] })).clean).toBe(true);
  });

  it("reports every failing rule at once", () => {
    const v = evaluateCleanDay(
      clean({
        newExceptionCount: 3,
        plaid: { activeConnections: 1, staleConnections: 1 },
        spineDeltas: diverged,
      }),
    );
    expect(failing(v)).toEqual(["NO_NEW_EXCEPTIONS", "PLAID_SYNCED", "SPINES_CONVERGED"]);
  });
});

describe("cleanStreak", () => {
  const days = (spec: Array<[string, boolean]>) => spec.map(([date, clean]) => ({ date, clean }));

  it("gate bar is 7", () => expect(GATE_CLEAN_DAYS).toBe(7));

  it("counts consecutive clean days back from today", () => {
    const s = cleanStreak(days([["2026-11-21", true], ["2026-11-20", true], ["2026-11-19", true]]), "2026-11-21");
    expect(s).toMatchObject({ streak: 3, through: "2026-11-21", gatePassed: false });
  });

  it("falls back to yesterday when today's check hasn't run yet", () => {
    const s = cleanStreak(days([["2026-11-20", true], ["2026-11-19", true]]), "2026-11-21");
    expect(s).toMatchObject({ streak: 2, through: "2026-11-20" });
  });

  it("a dirty day breaks the run", () => {
    const s = cleanStreak(
      days([["2026-11-21", true], ["2026-11-20", true], ["2026-11-19", false], ["2026-11-18", true]]),
      "2026-11-21",
    );
    expect(s.streak).toBe(2);
  });

  it("a missing day breaks the run — a gap is not a pass", () => {
    const s = cleanStreak(days([["2026-11-21", true], ["2026-11-19", true], ["2026-11-18", true]]), "2026-11-21");
    expect(s.streak).toBe(1);
  });

  it("a dirty today means streak 0 (does not skip back to yesterday)", () => {
    const s = cleanStreak(days([["2026-11-21", false], ["2026-11-20", true]]), "2026-11-21");
    expect(s).toMatchObject({ streak: 0, through: "2026-11-21", gatePassed: false });
  });

  it("passes the gate at exactly 7 consecutive clean days, across a month boundary", () => {
    const spec: Array<[string, boolean]> = [
      ["2026-12-03", true], ["2026-12-02", true], ["2026-12-01", true],
      ["2026-11-30", true], ["2026-11-29", true], ["2026-11-28", true], ["2026-11-27", true],
    ];
    expect(cleanStreak(days(spec), "2026-12-03")).toMatchObject({ streak: 7, gatePassed: true });
    expect(cleanStreak(days(spec.slice(0, 6)), "2026-12-03").gatePassed).toBe(false);
  });

  it("no verdicts at all → 0 / not passed", () => {
    expect(cleanStreak([], "2026-11-21")).toMatchObject({ streak: 0, through: null, gatePassed: false });
  });

  it("previousDay handles month and year rollover", () => {
    expect(previousDay("2026-12-01")).toBe("2026-11-30");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });
});

describe("localDayBounds (America/New_York)", () => {
  const ET = "America/New_York";

  it("standard time: day starts at 05:00Z", () => {
    const b = localDayBounds(new Date("2026-11-21T12:30:00Z"), ET);
    expect(b.date).toBe("2026-11-21");
    expect(b.start.toISOString()).toBe("2026-11-21T05:00:00.000Z");
  });

  it("daylight time: day starts at 04:00Z", () => {
    const b = localDayBounds(new Date("2026-07-04T12:30:00Z"), ET);
    expect(b.date).toBe("2026-07-04");
    expect(b.start.toISOString()).toBe("2026-07-04T04:00:00.000Z");
  });

  it("uses the LOCAL date late in the evening, not the UTC date", () => {
    const b = localDayBounds(new Date("2026-11-22T03:30:00Z"), ET); // 10:30pm ET Nov 21
    expect(b.date).toBe("2026-11-21");
    expect(b.start.toISOString()).toBe("2026-11-21T05:00:00.000Z");
  });

  it("fall-back day (Nov 1, 2026): midnight is still EDT; the 7:30am run is after the shift", () => {
    const b = localDayBounds(new Date("2026-11-01T12:30:00Z"), ET); // 7:30am EST
    expect(b.date).toBe("2026-11-01");
    expect(b.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });

  it("spring-forward day (Mar 8, 2026): midnight is still EST", () => {
    const b = localDayBounds(new Date("2026-03-08T12:00:00Z"), ET);
    expect(b.date).toBe("2026-03-08");
    expect(b.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("window end is `now`", () => {
    const now = new Date("2026-11-21T12:30:00Z");
    expect(localDayBounds(now, ET).end).toBe(now);
  });
});
