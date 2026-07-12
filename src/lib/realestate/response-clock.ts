import type { LeadEscalation, TouchChannel } from "@prisma/client";

// The speed-to-lead clock. Deterministic — no AI — and shared by lead ingestion,
// the agent Live tab, the escalation job (Inngest), and the broker roster, so
// every surface agrees on the same numbers. Mirrors the pure-signal pattern of
// dashboard/signals.ts and profit-first/calculator.ts.
//
// Two threshold sets, intentionally DISTINCT (do not merge):
//   • Response BAND (agent-facing color): green <15m, yellow 15–30m, red ≥30m.
//     Mirrors the app's 15/30 response clock in AgentApp.
//   • Escalation LADDER (who gets pinged): PRIMARY <15m, BACKUP 15–30m,
//     BROKER ≥30m. A same-level reminder fires at 5m while still PRIMARY.

export type ResponseBand = "green" | "yellow" | "red";

// Named thresholds (seconds) — not magic numbers.
export const RESPONSE_YELLOW_AT_SEC = 15 * 60; // 15 min → yellow
export const RESPONSE_RED_AT_SEC = 30 * 60; // 30 min → red
export const ESCALATE_REMIND_AT_SEC = 5 * 60; // 5 min → re-ping (still PRIMARY)
export const ESCALATE_BACKUP_AT_SEC = 15 * 60; // 15 min → BACKUP
export const ESCALATE_BROKER_AT_SEC = 30 * 60; // 30 min → BROKER

/** Whole seconds between lead receipt and first touch, clamped ≥ 0 (guards clock skew). */
export function computeResponseSeconds(receivedAt: Date, firstTouchAt: Date): number {
  const sec = Math.round((firstTouchAt.getTime() - receivedAt.getTime()) / 1000);
  return sec > 0 ? sec : 0;
}

/** Agent-facing color for how long a lead has waited (or took to be touched). */
export function deriveResponseBand(elapsedSeconds: number): ResponseBand {
  const s = elapsedSeconds > 0 ? elapsedSeconds : 0;
  if (s < RESPONSE_YELLOW_AT_SEC) return "green";
  if (s < RESPONSE_RED_AT_SEC) return "yellow";
  return "red";
}

/** How far the alert should have climbed for a still-untouched lead. */
export function deriveEscalation(elapsedSeconds: number): LeadEscalation {
  const s = elapsedSeconds > 0 ? elapsedSeconds : 0;
  if (s < ESCALATE_BACKUP_AT_SEC) return "PRIMARY";
  if (s < ESCALATE_BROKER_AT_SEC) return "BACKUP";
  return "BROKER";
}

/** True when an untouched lead is due a same-level reminder (the 5–15 min PRIMARY window). */
export function shouldRemind(elapsedSeconds: number): boolean {
  return elapsedSeconds >= ESCALATE_REMIND_AT_SEC && elapsedSeconds < ESCALATE_BACKUP_AT_SEC;
}

export interface FirstTouchStamp {
  firstTouchAt: Date;
  firstTouchChannel: TouchChannel;
  responseSeconds: number;
}

/**
 * The single chokepoint for recording a lead's first touch. Always returns all
 * three fields together, so `responseSeconds` can never drift from
 * `firstTouchAt − receivedAt`. Spread it straight into a Lead update:
 *
 *   await prisma.lead.update({ where: { id }, data: stampFirstTouch(receivedAt, when, "CALL") })
 *
 * The touch is the ATTEMPT — a call that goes to voicemail still counts.
 */
export function stampFirstTouch(
  receivedAt: Date,
  firstTouchAt: Date,
  channel: TouchChannel,
): FirstTouchStamp {
  return {
    firstTouchAt,
    firstTouchChannel: channel,
    responseSeconds: computeResponseSeconds(receivedAt, firstTouchAt),
  };
}
