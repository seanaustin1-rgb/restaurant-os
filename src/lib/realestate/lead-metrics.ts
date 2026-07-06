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
