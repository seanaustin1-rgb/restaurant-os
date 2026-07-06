// Agent notification adapter for the speed-to-lead alert/escalation ladder.
// Gated like the rest of the codebase (cf. llmExtractionAvailable / demoPrisma):
// when OneSignal isn't configured it logs so the ladder is observable end-to-end
// without a live provider, and returns delivered:false. Once the keys are set it
// pushes for real, targeting the agent by external id (= agentId), which the
// agent's device registers via OneSignal.login(agentId) in PushRegistration.
//
// Push has no agent target when agentId is null (unassigned lead) — the alert is
// still logged for the broker's escalation trail. Twilio SMS fallback is a
// separate follow-up gated on the agent's mobile number.

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

// Human-facing push copy per escalation rung.
function alertCopy(level: AlertLevel, leadName: string | null): { title: string; body: string } {
  const who = leadName ?? "A new lead";
  switch (level) {
    case "new":
      return { title: "🔥 New lead — respond now", body: `${who} just came in. First to respond wins.` };
    case "reminder":
      return { title: "⏰ Lead still waiting", body: `${who} hasn't been touched yet. The clock is running.` };
    case "backup":
      return { title: "⚠️ Backup: lead going cold", body: `${who} is past 15 min with no response — cover it.` };
    case "broker":
      return { title: "🚨 Broker: lead leaked", body: `${who} passed 30 min untouched. Leakage logged.` };
  }
}

/**
 * Send the escalation alert. When OneSignal is configured and the alert targets a
 * known agent, this pushes to that agent's devices via the external-id alias;
 * otherwise it logs (unconfigured, or no agent to target) and reports
 * delivered:false so the caller/audit sees the honest outcome.
 */
export async function sendLeadAlert(alert: LeadAlert): Promise<{ delivered: boolean }> {
  const tag = `[lead-alert:${alert.level}]`;
  const who = `restaurant=${alert.restaurantId} lead=${alert.leadId} agent=${alert.agentId ?? "?"}`;

  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    console.log(`${tag} ${who} (${alert.leadName ?? ""}) — notifications not configured; logged only`);
    return { delivered: false };
  }
  if (!alert.agentId) {
    console.log(`${tag} ${who} — no agent to target; logged only`);
    return { delivered: false };
  }

  const { title, body } = alertCopy(alert.level, alert.leadName);
  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_external_user_ids: [alert.agentId],
        channel_for_external_user_ids: "push",
        headings: { en: title },
        contents: { en: body },
        // Deep-link the tap straight into the agent app.
        url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/realestate/agent` : undefined,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`${tag} OneSignal ${res.status} — ${detail.slice(0, 200)}`);
      return { delivered: false };
    }
    console.log(`${tag} pushed → ${who}`);
    return { delivered: true };
  } catch (err) {
    console.error(`${tag} push failed → ${who}: ${(err as Error).message}`);
    return { delivered: false };
  }
}
