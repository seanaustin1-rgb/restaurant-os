"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { stampFirstTouch } from "@/lib/realestate/response-clock";
import { bridgeCall } from "@/lib/realestate/dial";

// Require the signed-in user to belong to the lead's brokerage tenant (any role).
async function requireTenantMember(restaurantId: string): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId },
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
