// Twilio cell-bridge dialer adapter. Gated like notify.ts: when Twilio isn't
// configured it no-ops the provider call and logs, so the CallEvent + first-touch
// stamp still happen and the response-clock loop is observable end-to-end.
//
// ⚠ Provider wiring is a stub until (a) Twilio creds exist and (b) per-agent
// dedicated numbers are modeled (BrokerageAgent has no Twilio number today).
// NO recording in v1 — metadata only.

export interface BridgeParams {
  agentNumber: string;
  leadNumber: string;
}

export interface BridgeResult {
  status: "QUEUED" | "RINGING";
  conferenceSid: string | null;
  agentCallSid: string | null;
  leadCallSid: string | null;
}

export function dialingAvailable(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

/**
 * Ring the agent's cell, then bridge the lead into the call. Returns the leg
 * SIDs (null until Twilio is wired). Agents live in their cars, so v1 bridges to
 * the cellular channel rather than a browser softphone.
 */
export async function bridgeCall(params: BridgeParams): Promise<BridgeResult> {
  if (!dialingAvailable()) {
    console.log(`[dial] would bridge agent=${params.agentNumber} ↔ lead=${params.leadNumber} (Twilio not configured)`);
    return { status: "QUEUED", conferenceSid: null, agentCallSid: null, leadCallSid: null };
  }
  // TODO(pilot): Twilio cell-bridge — call the agent's number; on answer, dial
  // the lead into a conference and return the SIDs. Metadata only, no recording.
  console.log(`[dial] bridge agent=${params.agentNumber} ↔ lead=${params.leadNumber}`);
  return { status: "RINGING", conferenceSid: null, agentCallSid: null, leadCallSid: null };
}
