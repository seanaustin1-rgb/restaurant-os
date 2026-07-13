import { prisma } from "@/lib/prisma";
import {
  computeAgentRoster,
  computeResponseStats,
  type AgentRosterRow,
  type ResponseStats,
} from "./lead-metrics";

// Loader for the broker speed-to-lead roster. Reads Lead rows for a tenant and
// runs the tested pure aggregations — the deterministic engine owns the numbers.

export interface RosterData {
  rows: AgentRosterRow[];
  overall: ResponseStats;
  totalLeads: number;
}

export async function loadAgentRoster(restaurantId: string): Promise<RosterData> {
  const leads = await prisma.lead.findMany({
    where: { restaurantId },
    select: {
      responseSeconds: true,
      escalation: true,
      agentId: true,
      agent: { select: { name: true } },
    },
  });

  const rosterInput = leads.map((l) => ({
    responseSeconds: l.responseSeconds,
    escalation: l.escalation,
    agentId: l.agentId,
    agentName: l.agent?.name ?? null,
  }));

  return {
    rows: computeAgentRoster(rosterInput),
    overall: computeResponseStats(
      rosterInput.map((l) => ({ responseSeconds: l.responseSeconds, escalation: l.escalation })),
    ),
    totalLeads: leads.length,
  };
}
