import { prisma } from "@/lib/prisma";
import { deriveResponseBand, type ResponseBand } from "./response-clock";
import { computeResponseStats, type ResponseStats } from "./lead-metrics";

// Loader for the agent app (Today + Live tabs). Resolves the agent's own leads
// and pending AI drafts, and colors each lead by the response clock. The band is
// computed here (server render time) so the view stays presentational.

export interface AgentLeadRow {
  id: string;
  fullName: string | null;
  phone: string | null;
  origin: string | null;
  status: string;
  touched: boolean;
  band: ResponseBand;
  waitedSec: number; // elapsed-since-arrival (untouched) or response time (touched)
}

export interface AgentDraftRow {
  id: string;
  leadId: string | null;
  leadName: string | null;
  channel: string;
  subject: string | null;
  body: string;
}

export interface AgentAppData {
  agentId: string;
  agentName: string;
  leads: AgentLeadRow[];
  drafts: AgentDraftRow[];
  stats: ResponseStats;
}

export async function loadAgentApp(agentId: string): Promise<AgentAppData | null> {
  const agent = await prisma.brokerageAgent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, restaurantId: true },
  });
  if (!agent) return null;

  const now = Date.now();

  const [leads, drafts] = await Promise.all([
    prisma.lead.findMany({
      where: { restaurantId: agent.restaurantId, agentId: agent.id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        origin: true,
        status: true,
        receivedAt: true,
        firstTouchAt: true,
        responseSeconds: true,
      },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.messageEvent.findMany({
      where: { restaurantId: agent.restaurantId, agentId: agent.id, status: "DRAFT" },
      select: { id: true, leadId: true, channel: true, subject: true, body: true, lead: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: AgentLeadRow[] = leads.map((l) => {
    const touched = l.firstTouchAt != null;
    const waitedSec = touched
      ? l.responseSeconds ?? 0
      : Math.max(0, Math.round((now - l.receivedAt.getTime()) / 1000));
    return {
      id: l.id,
      fullName: l.fullName,
      phone: l.phone,
      origin: l.origin,
      status: l.status,
      touched,
      band: deriveResponseBand(waitedSec),
      waitedSec,
    };
  });

  // Live order: untouched first (most urgent), each group newest-arrival first.
  rows.sort((a, b) => {
    if (a.touched !== b.touched) return a.touched ? 1 : -1;
    return b.waitedSec - a.waitedSec;
  });

  return {
    agentId: agent.id,
    agentName: agent.name,
    leads: rows,
    drafts: drafts.map((d) => ({
      id: d.id,
      leadId: d.leadId,
      leadName: d.lead?.fullName ?? null,
      channel: d.channel,
      subject: d.subject,
      body: d.body,
    })),
    stats: computeResponseStats(
      leads.map((l) => ({
        responseSeconds: l.responseSeconds,
        escalation: "PRIMARY" as const,
      })),
    ),
  };
}
