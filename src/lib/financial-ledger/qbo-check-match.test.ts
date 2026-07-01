import { describe, expect, it } from "vitest";
import {
  bankCheckNumber,
  bestQboCheckMatch,
  isBankCheckDescription,
  qboCheckCandidateFromRaw,
  scoreQboCheckMatch,
  type BankCheckCandidate,
} from "./qbo-check-match";

const bankCheck: BankCheckCandidate = {
  id: "bank-1",
  date: new Date("2026-06-24T00:00:00.000Z"),
  amount: 1150.1,
  description: "CHECK #10451",
};

describe("QBO check matching", () => {
  it("recognizes bank-side check descriptions and check numbers", () => {
    expect(isBankCheckDescription("CHECK")).toBe(true);
    expect(bankCheckNumber("CHECK #10451")).toBe("10451");
  });

  it("extracts payroll check detail from QuickBooks payloads", () => {
    const qbo = qboCheckCandidateFromRaw({
      id: "qbo-1",
      sourceObjectType: "paycheck",
      sourceObjectId: "10451",
      payload: {
        TxnDate: "2026-06-24",
        TotalAmt: 1150.1,
        DocNumber: "10451",
        EmployeeRef: { name: "Line Cook" },
        PrivateNote: "Payroll check",
      },
    });

    expect(qbo).toEqual(
      expect.objectContaining({
        amount: 1150.1,
        checkNumber: "10451",
        payee: "Line Cook",
        eventType: "LABOR",
        ledgerAccount: "LABOR",
        tapBucket: "LABOR",
      }),
    );
  });

  it("scores amount, date, and check-number matches highly enough to auto-pair", () => {
    const qbo = qboCheckCandidateFromRaw({
      id: "qbo-1",
      sourceObjectType: "paycheck",
      sourceObjectId: "10451",
      payload: { TxnDate: "2026-06-24", TotalAmt: 1150.1, DocNumber: "10451", EmployeeRef: { name: "Line Cook" } },
    })!;

    const match = scoreQboCheckMatch(bankCheck, qbo);
    expect(match?.score).toBeGreaterThanOrEqual(100);
    expect(bestQboCheckMatch(bankCheck, [qbo])?.qbo.id).toBe("qbo-1");
  });

  it("does not auto-match on amount when the clearing date is too far away", () => {
    const qbo = qboCheckCandidateFromRaw({
      id: "qbo-2",
      sourceObjectType: "check",
      sourceObjectId: "other",
      payload: { TxnDate: "2026-05-01", TotalAmt: 1150.1, VendorRef: { name: "Other Vendor" } },
    })!;

    expect(bestQboCheckMatch(bankCheck, [qbo])).toBeNull();
  });
});
