"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  createPrismaMembershipStore,
  redeemMembershipCode,
  upsertGuestProfile,
  type RedeemFailure,
} from "@/lib/spirit-vault/membership";

// Guest-facing action: a signed-in Clerk user redeems a membership code. Any Clerk
// user may call it (guests have no staff role); it upserts their GuestProfile and
// redeems against the configured venue. Server-verified and fail-closed.

const TENANT = process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();

export type RedeemActionResult =
  | { ok: true; currentPeriodEnd: string; extended: boolean }
  | { ok: false; reason: RedeemFailure | "unauthenticated" | "unconfigured" | "empty" };

export async function redeemMembershipCodeAction(
  plaintextCode: string,
  marketingOptIn = false,
): Promise<RedeemActionResult> {
  if (!TENANT) return { ok: false, reason: "unconfigured" };
  if (!plaintextCode?.trim()) return { ok: false, reason: "empty" };

  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "unauthenticated" };

  // Capture the verified email server-side (never trust a client-passed value).
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;

  const guestId = await upsertGuestProfile(prisma, userId, email);
  // Record marketing consent (transactional email is always stored; only opted-in
  // members are exported for marketing). We only ever set the flag on, never revoke here.
  if (marketingOptIn) {
    await prisma.guestProfile.update({
      where: { id: guestId },
      data: { marketingOptIn: true, marketingOptInAt: new Date() },
    });
  }
  const store = createPrismaMembershipStore(prisma);
  const res = await redeemMembershipCode(store, { restaurantId: TENANT, guestId, plaintextCode });
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, currentPeriodEnd: res.currentPeriodEnd.toISOString(), extended: res.extended };
}

export interface MembershipStatus {
  isMember: boolean;
  currentPeriodEnd: string | null;
}

/** For the guest UI to show a "member through <date>" chip. */
export async function getMembershipStatus(): Promise<MembershipStatus> {
  if (!TENANT) return { isMember: false, currentPeriodEnd: null };
  const { userId } = await auth();
  if (!userId) return { isMember: false, currentPeriodEnd: null };
  const m = await prisma.guestMembership.findFirst({
    where: { guest: { clerkUserId: userId }, restaurantId: TENANT, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    orderBy: { currentPeriodEnd: "desc" },
    select: { currentPeriodEnd: true },
  });
  return { isMember: m != null, currentPeriodEnd: m?.currentPeriodEnd.toISOString() ?? null };
}
