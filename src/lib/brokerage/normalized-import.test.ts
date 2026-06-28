import { describe, expect, it } from "vitest";
import { normalizeBrokerageImport, type BrokerageImportPayload } from "./normalized-import";

const ctx = { restaurantId: "r1" };

describe("normalizeBrokerageImport", () => {
  it("derives Company Dollar from GCI minus split, franchise and referral when not provided", () => {
    const payload: BrokerageImportPayload = {
      deals: [
        { externalDealId: "D1", label: "1 Oak St", gci: 10000, agentSplitPct: 70, franchiseFee: 600, referralFee: 0 },
      ],
    };
    const { deals } = normalizeBrokerageImport(ctx, payload);
    expect(deals).toHaveLength(1);
    expect(deals[0].agentPayout).toBeCloseTo(7000, 2); // 70% of 10000
    expect(deals[0].companyDollar).toBeCloseTo(2400, 2); // 10000 - 7000 - 600 - 0
  });

  it("trusts explicit agentPayout / companyDollar over derivation", () => {
    const { deals } = normalizeBrokerageImport(ctx, {
      deals: [{ externalDealId: "D1", label: "x", gci: 10000, agentSplitPct: 70, agentPayout: 6000, companyDollar: 3500 }],
    });
    expect(deals[0].agentPayout).toBeCloseTo(6000, 2);
    expect(deals[0].companyDollar).toBeCloseTo(3500, 2);
  });

  it("never lets Company Dollar go negative", () => {
    const { deals } = normalizeBrokerageImport(ctx, {
      deals: [{ externalDealId: "D1", label: "x", gci: 5000, agentPayout: 4800, franchiseFee: 600 }],
    });
    expect(deals[0].companyDollar).toBe(0);
  });

  it("infers stage from dates when not given, and validates an explicit stage", () => {
    const { deals } = normalizeBrokerageImport(ctx, {
      deals: [
        { externalDealId: "C", label: "closed", gci: 1000, closedDate: "2026-05-01" },
        { externalDealId: "P", label: "pending", gci: 1000, expectedCloseDate: "2026-07-01" },
        { externalDealId: "A", label: "active", gci: 1000 },
        { externalDealId: "L", label: "lead", gci: 1000, stage: "lead" },
        { externalDealId: "X", label: "bad-stage", gci: 1000, stage: "NONSENSE" },
      ],
    });
    const byId = Object.fromEntries(deals.map((d) => [d.externalDealId, d.stage]));
    expect(byId.C).toBe("CLOSED");
    expect(byId.P).toBe("PENDING");
    expect(byId.A).toBe("ACTIVE");
    expect(byId.L).toBe("LEAD");
    expect(byId.X).toBe("ACTIVE"); // unknown stage falls back to inference
  });

  it("rejects agents without id/name, deals without label/value, and bad lead spend", () => {
    const { rejected, summary } = normalizeBrokerageImport(ctx, {
      agents: [{ externalAgentId: "", name: "No Id" }],
      deals: [{ externalDealId: "D", label: "", gci: 1000 }, { externalDealId: "E", label: "no value", gci: 0 }],
      leadSpend: [{ source: "", periodStart: "2026-05-01", periodEnd: "2026-05-31", spend: 100 }],
    });
    expect(summary.accepted).toBe(0);
    expect(rejected).toHaveLength(4); // 1 agent + 2 deals + 1 lead-spend
  });

  it("flags deals/lead-spend that reference an agent not in the import", () => {
    const { summary } = normalizeBrokerageImport(ctx, {
      agents: [{ externalAgentId: "A-1", name: "Known" }],
      deals: [{ externalDealId: "D", label: "x", gci: 1000, agentExternalId: "A-9" }],
    });
    expect(summary.missingAgentReferences).toEqual(["A-9"]);
  });

  it("generates a stable external id when a deal has none", () => {
    const a = normalizeBrokerageImport(ctx, { deals: [{ label: "1 Oak", gci: 1000, closedDate: "2026-05-01" }] });
    const b = normalizeBrokerageImport(ctx, { deals: [{ label: "1 Oak", gci: 1000, closedDate: "2026-05-01" }] });
    expect(a.deals[0].externalDealId).toBe(b.deals[0].externalDealId);
    expect(a.deals[0].externalDealId).toMatch(/^deal-/);
  });
});
