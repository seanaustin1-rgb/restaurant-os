import type { LeadEscalation } from "@prisma/client";

// Broker-facing speed-to-lead rollups. Deterministic — the numbers the broker
// cockpit shows and the pilot's definition-of-done is measured against (median
// first response < 2 min, % within SLA, lead leakage). No AI; reads only stored
// Lead fields (responseSeconds, escalation) so it needs no "now" clock.

// Pilot definition-of-done target: first response under 2 minutes.
export const SPEED_TO_LEAD_TARGET_SEC = 120;

export interface LeadStat {
  responseSeconds: number | null; // null = not yet touched
  escalation: LeadEscalation;
}

export interface ResponseStats {
  total: number;
  touched: number;
  untouched: number;
  medianResponseSec: number | null; // over touched leads only
  pctWithinTarget: number | null; // % of touched leads answered within targetSec
  escalatedToBackup: number; // climbed to a backup agent
  escalatedToBroker: number; // leakage: climbed all the way to the broker
}

/** Median of a numeric list; null for an empty list. Even length → mean of the two middles. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Roll a set of leads up into the broker's speed-to-lead scorecard.
 * `targetSec` defaults to the pilot DoD (2 minutes).
 */
export function computeResponseStats(
  leads: LeadStat[],
  targetSec: number = SPEED_TO_LEAD_TARGET_SEC,
): ResponseStats {
  const touchedSecs = leads
    .filter((l) => l.responseSeconds != null)
    .map((l) => l.responseSeconds as number);
  const touched = touchedSecs.length;
  const total = leads.length;
  const withinTarget = touchedSecs.filter((s) => s <= targetSec).length;

  return {
    total,
    touched,
    untouched: total - touched,
    medianResponseSec: median(touchedSecs),
    pctWithinTarget: touched === 0 ? null : Math.round((withinTarget / touched) * 100),
    escalatedToBackup: leads.filter((l) => l.escalation === "BACKUP").length,
    escalatedToBroker: leads.filter((l) => l.escalation === "BROKER").length,
  };
}

// ── Broker roster ──────────────────────────────────────────────────────────

export interface RosterLeadStat extends LeadStat {
  agentId: string | null;
  agentName?: string | null;
}

export interface AgentRosterRow {
  agentId: string | null; // null row = unassigned leads
  agentName: string | null;
  stats: ResponseStats;
}

const UNASSIGNED = "__unassigned__";

/**
 * Group leads by agent into per-agent scorecards for the broker cockpit roster,
 * sorted worst-first (most leaked-to-broker, then slowest median) so the agents
 * needing attention surface at the top — matching the cockpit's "red first" rule.
 * Leads with no agent collapse into a single unassigned row (agentId null).
 */
export function computeAgentRoster(
  leads: RosterLeadStat[],
  targetSec: number = SPEED_TO_LEAD_TARGET_SEC,
): AgentRosterRow[] {
  const groups = new Map<string, { name: string | null; leads: LeadStat[] }>();
  for (const l of leads) {
    const key = l.agentId ?? UNASSIGNED;
    const group = groups.get(key) ?? { name: l.agentName ?? null, leads: [] };
    if (group.name == null && l.agentName != null) group.name = l.agentName;
    group.leads.push({ responseSeconds: l.responseSeconds, escalation: l.escalation });
    groups.set(key, group);
  }

  const rows: AgentRosterRow[] = [...groups.entries()].map(([key, g]) => ({
    agentId: key === UNASSIGNED ? null : key,
    agentName: g.name,
    stats: computeResponseStats(g.leads, targetSec),
  }));

  rows.sort((a, b) => {
    if (b.stats.escalatedToBroker !== a.stats.escalatedToBroker) {
      return b.stats.escalatedToBroker - a.stats.escalatedToBroker;
    }
    const am = a.stats.medianResponseSec ?? -1;
    const bm = b.stats.medianResponseSec ?? -1;
    return bm - am;
  });

  return rows;
}
