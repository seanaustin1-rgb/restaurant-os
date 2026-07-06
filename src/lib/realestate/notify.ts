// Agent notification adapter for the speed-to-lead alert/escalation ladder.
// Gated like the rest of the codebase (cf. llmExtractionAvailable / demoPrisma):
// when the providers aren't configured it logs so the ladder is observable
// end-to-end without a live provider, and returns delivered:false.
//
// ⚠ Provider wiring (OneSignal push + Twilio SMS) is intentionally a stub until
// (a) OneSignal/Twilio creds exist and (b) agent push-subscription + mobile
// number are modeled — a BrokerageAgent today has no push id or phone. When
// those land, swap the log below for the provider calls; the ladder is unchanged.

export type AlertLevel = "new" | "reminder" | "backup" | "broker";

export interface LeadAlert {
  restaurantId: string;
  leadId: string;
  agentId: string | null;
  leadName: string | null;
  level: AlertLevel;
}

export function notificationsAvailable(): boolean {
  return !!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY);
}

export async function sendLeadAlert(alert: LeadAlert): Promise<{ delivered: boolean }> {
  const tag = `[lead-alert:${alert.level}]`;
  const who = `restaurant=${alert.restaurantId} lead=${alert.leadId} agent=${alert.agentId ?? "?"}`;

  if (!notificationsAvailable()) {
    console.log(`${tag} ${who} (${alert.leadName ?? ""}) — notifications not configured; logged only`);
    return { delivered: false };
  }

  // TODO(pilot): OneSignal push (external_user_id = agentId) + Twilio SMS to the
  // agent's mobile, once agent contact/subscription is modeled.
  console.log(`${tag} dispatch → ${who}`);
  return { delivered: true };
}
