import { describe, it, expect } from "vitest";
import type { RecurringVendor } from "@/lib/modules/recurring";
import {
  estimateSweepOutflow,
  projectForwardCash,
  projectRecurringObligations,
  sweepDatesInWindow,
} from "./forward-cash";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

function vendor(partial: Partial<RecurringVendor>): RecurringVendor {
  return {
    vendor: "V",
    count: 4,
    total: 0,
    avgAmount: 0,
    lastAmount: 0,
    lastDate: "2026-06-01",
    cadence: "biweekly",
    medianIntervalDays: 14,
    subscriptionLike: false,
    estMonthly: 0,
    creepPct: null,
    flaggedByVendorMap: false,
    categoryName: null,
    ...partial,
  };
}

describe("sweepDatesInWindow", () => {
  it("returns the 10th/25th strictly after the start, within the window", () => {
    expect(sweepDatesInWindow(d("2026-06-01"), 30).map(iso)).toEqual(["2026-06-10", "2026-06-25"]);
  });
  it("spans a month boundary and excludes sweeps at/before the start or past the end", () => {
    // start 06-15, end 07-15 → 06-25 and 07-10 (06-10 is before start; 07-25 past end)
    expect(sweepDatesInWindow(d("2026-06-15"), 30).map(iso)).toEqual(["2026-06-25", "2026-07-10"]);
  });
});

describe("projectRecurringObligations", () => {
  it("projects a biweekly payroll vendor's next occurrences into the window", () => {
    const obs = projectRecurringObligations(
      [vendor({ vendor: "Payroll", lastDate: "2026-06-01", lastAmount: 5000, medianIntervalDays: 14, categoryName: "Payroll — Direct Deposit" })],
      d("2026-06-05"),
      30, // window end 2026-07-05
    );
    expect(obs).toEqual([
      { date: "2026-06-15", label: "Payroll", amount: 5000, kind: "payroll" },
      { date: "2026-06-29", label: "Payroll", amount: 5000, kind: "payroll" },
    ]);
  });
  it("labels non-payroll categories as recurring and skips vendors with no cadence or non-positive amount", () => {
    const obs = projectRecurringObligations(
      [
        vendor({ vendor: "Rent", lastDate: "2026-06-02", lastAmount: 3000, medianIntervalDays: 30, categoryName: "Rent" }),
        vendor({ vendor: "NoCadence", medianIntervalDays: null, lastAmount: 100 }),
        vendor({ vendor: "ZeroAmt", medianIntervalDays: 30, lastAmount: 0 }),
      ],
      d("2026-06-05"),
      30,
    );
    expect(obs).toEqual([{ date: "2026-07-02", label: "Rent", amount: 3000, kind: "recurring" }]);
  });
});

describe("projectForwardCash", () => {
  const obligations = [
    { date: "2026-06-10", label: "Rent", amount: 3000, kind: "recurring" as const },
    { date: "2026-06-15", label: "Payroll", amount: 5000, kind: "payroll" as const },
    { date: "2026-06-25", label: "Sweep", amount: 2000, kind: "sweep" as const },
  ];

  it("walks the balance down on obligation dates and finds the low-point", () => {
    const p = projectForwardCash({ startDate: "2026-06-05", startBalance: 10000, windowDays: 30, obligations });
    // 10000 → 7000 (06-10) → 2000 (06-15) → 0 (06-25) and flat after
    expect(p.days.find((x) => x.date === "2026-06-10")?.balance).toBe(7000);
    expect(p.days.find((x) => x.date === "2026-06-15")?.balance).toBe(2000);
    expect(p.lowPoint).toEqual({ date: "2026-06-25", balance: 0 });
    expect(p.endBalance).toBe(0);
    expect(p.totalScheduledOut).toBe(10000);
    expect(p.breachesZero).toBe(false); // 0 is not < 0
  });

  it("flags a zero breach when obligations overrun the balance", () => {
    const p = projectForwardCash({ startDate: "2026-06-05", startBalance: 9500, windowDays: 30, obligations });
    expect(p.lowPoint).toEqual({ date: "2026-06-25", balance: -500 });
    expect(p.breachesZero).toBe(true);
  });

  it("catches a mid-window trough even when the balance recovers via an inflow", () => {
    const p = projectForwardCash({
      startDate: "2026-06-05",
      startBalance: 4000,
      windowDays: 30,
      obligations: [
        { date: "2026-06-10", label: "Payroll", amount: 5000, kind: "payroll" },
        { date: "2026-06-12", label: "Big deposit", amount: -8000, kind: "recurring" }, // inflow
      ],
    });
    expect(p.lowPoint).toEqual({ date: "2026-06-10", balance: -1000 });
    expect(p.endBalance).toBe(7000); // 4000 - 5000 + 8000
    expect(p.totalScheduledOut).toBe(5000); // inflow not counted as scheduled-out
  });
});

describe("estimateSweepOutflow", () => {
  it("sums the mean recent Profit and Owner's Pay sweeps", () => {
    expect(
      estimateSweepOutflow([
        { key: "profit", amount: 1000 },
        { key: "profit", amount: 1200 },
        { key: "owner_pay", amount: 800 },
      ]),
    ).toBe(1900); // mean profit 1100 + mean owner 800
  });
  it("is 0 with no sweep history", () => {
    expect(estimateSweepOutflow([])).toBe(0);
  });
});
