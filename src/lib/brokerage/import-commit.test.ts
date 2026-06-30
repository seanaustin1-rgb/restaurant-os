import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { commitBrokerageImport } from "./import-commit";

describe("commitBrokerageImport", () => {
  it("does not overwrite same-source lead spend for different agents", async () => {
    const db = {
      brokerageAgent: {
        upsert: vi.fn(async ({ create }) => ({ id: create.externalAgentId === "A-1" ? "agent-1" : "agent-2" })),
        findMany: vi.fn(async () => []),
      },
      brokerageAgentSourceIdentity: { upsert: vi.fn(async () => ({})) },
      brokerageDeal: { upsert: vi.fn() },
      brokerageLeadSpend: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({})),
        update: vi.fn(),
      },
    } as unknown as PrismaClient;

    await commitBrokerageImport(db, {
      restaurantId: "r1",
      payload: {
        agents: [
          { externalAgentId: "A-1", name: "Dana" },
          { externalAgentId: "A-2", name: "Sam" },
        ],
        leadSpend: [
          { source: "Zillow", agentExternalId: "A-1", periodStart: "2026-06-01", periodEnd: "2026-06-30", spend: 1500 },
          { source: "Zillow", agentExternalId: "A-2", periodStart: "2026-06-01", periodEnd: "2026-06-30", spend: 900 },
        ],
      },
    });

    expect(db.brokerageLeadSpend.findFirst).toHaveBeenCalledTimes(2);
    expect(db.brokerageAgentSourceIdentity.upsert).toHaveBeenCalledTimes(2);
    expect(db.brokerageAgentSourceIdentity.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          restaurantId_sourceSystem_externalAgentId: {
            restaurantId: "r1",
            sourceSystem: "CSV",
            externalAgentId: "A-1",
          },
        },
      }),
    );
    expect(db.brokerageLeadSpend.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-1", source: "Zillow" }) }),
    );
    expect(db.brokerageLeadSpend.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-2", source: "Zillow" }) }),
    );
    expect(db.brokerageLeadSpend.create).toHaveBeenCalledTimes(2);
  });
});
