"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { stampFirstTouch } from "@/lib/realestate/response-clock";
import { bridgeCall } from "@/lib/realestate/dial";

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
