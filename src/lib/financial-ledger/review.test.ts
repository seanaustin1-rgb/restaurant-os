import { describe, expect, it } from "vitest";
import { groupPendingFinancialEvents, type PendingFinancialEventRow } from "./review";

let nextId = 1;

function row(input: Partial<PendingFinancialEventRow>): PendingFinancialEventRow {
  return {
    id: input.id ?? `event-${nextId++}`,
    eventDate: input.eventDate ?? new Date("2026-06-15T00:00:00.000Z"),
    eventType: input.eventType ?? "FIXED_OPEX",
    amount: input.amount ?? 100,
    counterparty: input.counterparty ?? "Unknown Vendor",
    description: input.description ?? null,
    confidence: input.confidence ?? 0,
    sourceSystem: input.sourceSystem ?? "plaid",
    sourceObjectType: input.sourceObjectType ?? "bank_transaction",
    sourceObjectId: input.sourceObjectId ?? "txn-1",
    issueMessage: input.issueMessage ?? "Needs mapping review",
  };
}

describe("financial mapping review groups", () => {
  it("groups repeated pending events by source, issue, and visible vendor label", () => {
    const groups = groupPendingFinancialEvents([
      row({ counterparty: "PPL Electric", amount: 120, eventDate: new Date("2026-06-10T00:00:00.000Z") }),
      row({ counterparty: "PPL Electric", amount: 140, eventDate: new Date("2026-06-20T00:00:00.000Z") }),
      row({ counterparty: "York Water", amount: 90 }),
    ]);

    expect(groups[0]).toEqual(
      expect.objectContaining({
        label: "PPL Electric",
        count: 2,
        totalAmount: 260,
        latestEventDate: new Date("2026-06-20T00:00:00.000Z"),
      }),
    );
    expect(groups[1]).toEqual(expect.objectContaining({ label: "York Water", count: 1 }));
  });
});
