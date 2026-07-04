import { describe, expect, it } from "vitest";
import {
  groupPendingFinancialEvents,
  groupPendingBySignature,
  classificationForCategory,
  NO_SIGNATURE_LABEL,
  type PendingFinancialEventRow,
} from "./review";

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

describe("groupPendingBySignature", () => {
  it("buckets by vendor signature + issue and carries member eventIds for bulk actions", () => {
    const groups = groupPendingBySignature([
      row({ id: "a", counterparty: "PPL Electric", amount: 120 }),
      row({ id: "b", counterparty: "PPL Electric Co", amount: 140, eventDate: new Date("2026-06-20T00:00:00.000Z") }),
      row({ id: "c", counterparty: "York Water", amount: 90 }),
    ]);

    expect(groups[0]).toEqual(
      expect.objectContaining({ signature: "PPL", count: 2, totalAmount: 260, eventIds: ["a", "b"] }),
    );
    expect(groups[0].latestEventDate).toEqual(new Date("2026-06-20T00:00:00.000Z"));
    expect(groups[1]).toEqual(expect.objectContaining({ signature: "YORK", count: 1, eventIds: ["c"] }));
  });

  it("separates groups by issue even for the same vendor, and labels signatureless rows", () => {
    const groups = groupPendingBySignature([
      row({ id: "a", counterparty: "PPL Electric", issueMessage: "Needs mapping review" }),
      row({ id: "b", counterparty: "PPL Electric", issueMessage: "Low confidence" }),
      row({ id: "c", counterparty: "ACH", description: "PMT 1043" }), // only stopwords + digits → no keyword
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.some((g) => g.signature === NO_SIGNATURE_LABEL)).toBe(true);
  });
});

describe("classificationForCategory", () => {
  it("maps a COGS category to the COGS event type + ledger account, keeping the tap bucket", () => {
    expect(classificationForCategory({ name: "Food — Produce", tapBucket: "COGS_FOOD" }, 250)).toEqual({
      eventType: "COGS",
      ledgerAccount: "COGS",
      tapBucket: "COGS_FOOD",
    });
  });

  it("reaches REVENUE only via an explicit REVENUE-tap category, regardless of stored sign", () => {
    expect(classificationForCategory({ name: "Sales", tapBucket: "REVENUE" }, 500)).toEqual({
      eventType: "REVENUE",
      ledgerAccount: "REVENUE",
      tapBucket: "REVENUE",
    });
    // A negative (already-abs'd) magnitude must NOT flip an expense category to revenue.
    expect(classificationForCategory({ name: "Rent", tapBucket: "OPEX" }, -3000).eventType).toBe("FIXED_OPEX");
  });

  it("routes an EXCLUDED category to the suspense account", () => {
    expect(classificationForCategory({ name: "Owner Transfer", tapBucket: "EXCLUDED" }, 100)).toEqual({
      eventType: "EXCLUDED",
      ledgerAccount: "SUSPENSE",
      tapBucket: "EXCLUDED",
    });
  });
});
