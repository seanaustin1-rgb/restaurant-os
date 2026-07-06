"use server";

import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { stampFirstTouch } from "@/lib/realestate/response-clock";
import { bridgeCall } from "@/lib/realestate/dial";
import {
  draftMessage,
  toMessageEventDraft,
  realestateDraftingAvailable,
} from "@/lib/realestate/draft-message";
import { ingestBoldTrailLead } from "@/lib/realestate/lead-webhook";

// Require the signed-in user to belong to the lead's brokerage tenant with a
// write-capable role. INVESTOR is read-only per the non-negotiables and must
// never reach a write action, even if attached to the tenant.
async function requireTenantMember(restaurantId: string): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId, role: { not: "INVESTOR" } },
    select: { id: true },
  });
  if (!role) throw new Error("forbidden");
  return userId;
}

// Stricter gate for tenant-administrative actions (e.g. firing a test lead):
// only the listed roles pass.
async function requireTenantRole(restaurantId: string, roles: UserRole[]): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId, role: { in: roles } },
    select: { id: true },
  });
  if (!role) throw new Error("forbidden");
  return userId;
}

/**
 * Agent taps "Call now" on a lead. Creates a CallEvent, kicks off the Twilio
 * cell-bridge (gated — no-ops until configured), and — crucially — stamps the
 * lead's first touch through stampFirstTouch(), stopping the response clock. The
 * touch is the ATTEMPT, so it lands even if the lead doesn't pick up. Idempotent
 * on the clock: firstTouchAt is only set the first time.
 */
export async function initiateCall(
  leadId: string,
): Promise<{ callId: string; firstTouchStamped: boolean }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      restaurantId: true,
      agentId: true,
      phone: true,
      receivedAt: true,
      firstTouchAt: true,
    },
  });
  if (!lead) throw new Error("Lead not found");
  await requireTenantMember(lead.restaurantId);
  if (!lead.phone) throw new Error("Lead has no phone number to dial");

  // Per-agent dedicated numbers aren't modeled yet — fall back to the shared
  // Twilio number until they are.
  const agentNumber = process.env.TWILIO_FROM ?? "+10000000000";
  const now = new Date();

  const bridge = await bridgeCall({ agentNumber, leadNumber: lead.phone });

  const call = await prisma.callEvent.create({
    data: {
      restaurantId: lead.restaurantId,
      leadId: lead.id,
      agentId: lead.agentId,
      direction: "OUTBOUND",
      agentNumber,
      leadNumber: lead.phone,
      status: bridge.status,
      conferenceSid: bridge.conferenceSid,
      agentCallSid: bridge.agentCallSid,
      leadCallSid: bridge.leadCallSid,
      initiatedAt: now,
    },
    select: { id: true },
  });

  let firstTouchStamped = false;
  if (!lead.firstTouchAt) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "CONTACTED",
        ...stampFirstTouch(lead.receivedAt, now, "CALL"),
      },
    });
    firstTouchStamped = true;
  }

  return { callId: call.id, firstTouchStamped };
}

/**
 * Approve an AI-drafted MessageEvent and send it. The actual transmit (agent's
 * connected mailbox / Twilio SMS) is gated — until wired, this marks the message
 * approved + sent and logs. Stamps the lead's first touch when it's the first
 * outreach (send counts as an attempt).
 */
export async function approveMessage(
  messageId: string,
): Promise<{ sent: boolean; firstTouchStamped: boolean }> {
  const msg = await prisma.messageEvent.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      restaurantId: true,
      status: true,
      channel: true,
      leadId: true,
      lead: { select: { receivedAt: true, firstTouchAt: true } },
    },
  });
  if (!msg) throw new Error("Message not found");
  await requireTenantMember(msg.restaurantId);
  if (msg.status !== "DRAFT") throw new Error("Message is not a draft");

  const now = new Date();
  // TODO(pilot): transmit via the agent's connected mailbox (Gmail/Outlook OAuth)
  // or Twilio SMS. Gated until those integrations exist; mark approved + sent.
  await prisma.messageEvent.update({
    where: { id: msg.id },
    data: { status: "SENT", approvedAt: now, sentAt: now },
  });

  let firstTouchStamped = false;
  if (msg.leadId && msg.lead && !msg.lead.firstTouchAt) {
    const channel = msg.channel === "SMS" ? "SMS" : "EMAIL";
    await prisma.lead.update({
      where: { id: msg.leadId },
      data: { status: "CONTACTED", ...stampFirstTouch(msg.lead.receivedAt, now, channel) },
    });
    firstTouchStamped = true;
  }

  return { sent: true, firstTouchStamped };
}

/**
 * Generate an AI first-outreach draft for a lead and persist it as a DRAFT
 * MessageEvent (nothing sends — it lands in the agent's "Drafts to approve").
 * Gated on ANTHROPIC_API_KEY: throws a clear error when drafting isn't
 * configured, so the UI only offers this when the key is present.
 */
export async function draftForLead(
  leadId: string,
  channel: "EMAIL" | "SMS" = "EMAIL",
): Promise<{ draftId: string }> {
  if (!realestateDraftingAvailable()) {
    throw new Error("AI drafting is not configured (ANTHROPIC_API_KEY unset)");
  }
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      restaurantId: true,
      agentId: true,
      fullName: true,
      origin: true,
      agent: { select: { name: true } },
    },
  });
  if (!lead) throw new Error("Lead not found");
  await requireTenantMember(lead.restaurantId);

  const draft = await draftMessage({
    channel,
    style: { agentName: lead.agent?.name ?? "Your agent" },
    lead: { fullName: lead.fullName, origin: lead.origin, note: null },
    intent:
      "First outreach to a new buyer lead — introduce yourself, acknowledge their inquiry, and invite a quick call. Keep it human.",
  });

  const created = await prisma.messageEvent.create({
    data: toMessageEventDraft({
      restaurantId: lead.restaurantId,
      leadId: lead.id,
      agentId: lead.agentId,
      channel,
      draft,
    }),
    select: { id: true },
  });
  return { draftId: created.id };
}

/**
 * Fire a synthetic lead through the real BoldTrail ingest pipeline so the whole
 * speed-to-lead loop (RawSourceEvent → Lead → Inngest alert/escalation ladder →
 * agent app → broker roster) can be exercised without a live BoldTrail webhook.
 * Broker/operator/manager only — it writes data. Assigns the new lead to the
 * tenant's first agent so it surfaces in the agent app.
 */
export async function fireTestLead(
  restaurantId: string,
): Promise<{ leadId: string | null; created: boolean }> {
  await requireTenantRole(restaurantId, ["BROKER", "OPERATOR", "MANAGER"]);

  const tenant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { businessType: true },
  });
  if (!tenant || tenant.businessType !== "REAL_ESTATE_BROKERAGE") {
    throw new Error("Not a brokerage tenant");
  }

  const suffix = randomUUID().slice(0, 8);
  const payload = {
    lead: {
      id: `test-${suffix}`,
      first_name: "Test",
      last_name: `Lead ${suffix}`,
      email: `test+${suffix}@example.com`,
      phone: "+15551234567",
      source: "IDX Website",
      created: new Date().toISOString(),
    },
  };

  const res = await ingestBoldTrailLead(prisma, restaurantId, payload);

  // Route the test lead to an agent so the agent app shows it (real assignment
  // /round-robin isn't modeled yet — this is test-only convenience).
  if (res.created && res.leadId) {
    const firstAgent = await prisma.brokerageAgent.findFirst({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (firstAgent) {
      await prisma.lead.update({
        where: { id: res.leadId },
        data: { agentId: firstAgent.id },
      });
    }
  }

  return { leadId: res.leadId, created: res.created };
}

/**
 * Record that the signed-in agent has enabled push on this device. The client
 * OneSignal SDK associates the subscription with the agent id via
 * OneSignal.login(agentId); this stores that external id on the BrokerageAgent
 * so notify.ts can target it, and so the broker can see push adoption. Only the
 * agent themselves (matching clerkUserId) may enroll their own device.
 */
export async function confirmAgentPush(agentId: string): Promise<{ ok: boolean }> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const agent = await prisma.brokerageAgent.findFirst({
    where: { id: agentId, clerkUserId: userId },
    select: { id: true },
  });
  if (!agent) throw new Error("forbidden");
  await prisma.brokerageAgent.update({
    where: { id: agent.id },
    data: { pushExternalId: agentId },
  });
  return { ok: true };
}
