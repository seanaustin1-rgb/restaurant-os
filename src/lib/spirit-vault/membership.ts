import { Prisma, type PrismaClient } from "@prisma/client";
import { hashMembershipCode } from "./membership-code";

// Redemption engine for Spirit Vault membership codes. Pure decision logic is split
// from persistence behind a store port so it's unit-testable without a database; the
// Prisma-backed store does the real work in one transaction with an atomic guard
// against concurrent redemptions. All lookups are restaurant-scoped by the caller.

export type RedeemFailure = "not_found" | "revoked" | "expired" | "exhausted" | "already_redeemed";

export interface MembershipCodeRow {
  id: string;
  restaurantId: string;
  tier: string;
  grantDays: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  status: "ACTIVE" | "REVOKED";
  expiresAt: Date | null;
}

/** Pure, order-sensitive validation of a loaded code. Returns null when redeemable. */
export function evaluateCode(code: MembershipCodeRow | null, alreadyRedeemed: boolean, now: Date): RedeemFailure | null {
  if (!code) return "not_found";
  if (code.status !== "ACTIVE") return "revoked";
  if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) return "expired";
  if (code.maxRedemptions != null && code.redemptionCount >= code.maxRedemptions) return "exhausted";
  if (alreadyRedeemed) return "already_redeemed";
  return null;
}

/** Extend from the later of now / the guest's existing active end, so re-redeeming adds time. */
export function computePeriodEnd(existingEnd: Date | null, grantDays: number, now: Date): Date {
  const base = existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now;
  return new Date(base.getTime() + grantDays * 86_400_000);
}

export interface CommitInput {
  code: MembershipCodeRow;
  guestId: string;
  restaurantId: string;
  now: Date;
  currentPeriodEnd: Date;
}

export interface RedeemStore {
  loadCode(restaurantId: string, codeHash: string): Promise<MembershipCodeRow | null>;
  hasRedeemed(codeId: string, guestId: string): Promise<boolean>;
  activeMembershipEnd(guestId: string, restaurantId: string, now: Date): Promise<Date | null>;
  commit(input: CommitInput): Promise<{ membershipId: string } | { failed: RedeemFailure }>;
}

export type RedeemResult =
  | { ok: true; membershipId: string; currentPeriodEnd: Date; extended: boolean }
  | { ok: false; reason: RedeemFailure };

/**
 * Redeem a plaintext code for a signed-in guest. Hashes the code, validates, then
 * commits atomically. Fail-closed — any unmet condition returns { ok: false }.
 */
export async function redeemMembershipCode(
  store: RedeemStore,
  args: { restaurantId: string; guestId: string; plaintextCode: string; now?: Date },
): Promise<RedeemResult> {
  const now = args.now ?? new Date();
  const codeHash = hashMembershipCode(args.plaintextCode);
  const code = await store.loadCode(args.restaurantId, codeHash);
  const already = code ? await store.hasRedeemed(code.id, args.guestId) : false;
  const bad = evaluateCode(code, already, now);
  if (bad) return { ok: false, reason: bad };

  const existingEnd = await store.activeMembershipEnd(args.guestId, args.restaurantId, now);
  const currentPeriodEnd = computePeriodEnd(existingEnd, code!.grantDays, now);
  const res = await store.commit({ code: code!, guestId: args.guestId, restaurantId: args.restaurantId, now, currentPeriodEnd });
  if ("failed" in res) return { ok: false, reason: res.failed };
  return { ok: true, membershipId: res.membershipId, currentPeriodEnd, extended: existingEnd != null };
}

class RedeemAbort extends Error {
  constructor(public reason: RedeemFailure) {
    super(reason);
  }
}

/** Prisma-backed store. `commit` runs in one transaction with a concurrency guard. */
export function createPrismaMembershipStore(prisma: PrismaClient): RedeemStore {
  return {
    async loadCode(restaurantId, codeHash) {
      return prisma.membershipCode.findUnique({
        where: { restaurantId_codeHash: { restaurantId, codeHash } },
        select: {
          id: true,
          restaurantId: true,
          tier: true,
          grantDays: true,
          maxRedemptions: true,
          redemptionCount: true,
          status: true,
          expiresAt: true,
        },
      });
    },
    async hasRedeemed(codeId, guestId) {
      const r = await prisma.membershipRedemption.findUnique({
        where: { membershipCodeId_guestId: { membershipCodeId: codeId, guestId } },
        select: { id: true },
      });
      return r != null;
    },
    async activeMembershipEnd(guestId, restaurantId, now) {
      const m = await prisma.guestMembership.findFirst({
        where: { guestId, restaurantId, status: "ACTIVE", currentPeriodEnd: { gt: now } },
        orderBy: { currentPeriodEnd: "desc" },
        select: { currentPeriodEnd: true },
      });
      return m?.currentPeriodEnd ?? null;
    },
    async commit(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          // Atomically claim a redemption slot; guards against concurrent redeems.
          const where: Prisma.MembershipCodeWhereInput = { id: input.code.id, status: "ACTIVE" };
          if (input.code.maxRedemptions != null) where.redemptionCount = { lt: input.code.maxRedemptions };
          const claimed = await tx.membershipCode.updateMany({ where, data: { redemptionCount: { increment: 1 } } });
          if (claimed.count === 0) throw new RedeemAbort("exhausted");

          const existing = await tx.guestMembership.findFirst({
            where: { guestId: input.guestId, restaurantId: input.restaurantId, status: "ACTIVE", currentPeriodEnd: { gt: input.now } },
            orderBy: { currentPeriodEnd: "desc" },
            select: { id: true },
          });
          let membershipId: string;
          if (existing) {
            await tx.guestMembership.update({
              where: { id: existing.id },
              data: { currentPeriodEnd: input.currentPeriodEnd, tier: input.code.tier },
            });
            membershipId = existing.id;
          } else {
            const created = await tx.guestMembership.create({
              data: {
                guestId: input.guestId,
                restaurantId: input.restaurantId,
                tier: input.code.tier,
                status: "ACTIVE",
                source: "code",
                startedAt: input.now,
                currentPeriodEnd: input.currentPeriodEnd,
              },
              select: { id: true },
            });
            membershipId = created.id;
          }

          // Append-only log; the unique (code,guest) turns a same-guest race into P2002.
          await tx.membershipRedemption.create({
            data: {
              membershipCodeId: input.code.id,
              guestId: input.guestId,
              restaurantId: input.restaurantId,
              membershipId,
              redeemedAt: input.now,
            },
          });
          return { membershipId };
        });
      } catch (e) {
        if (e instanceof RedeemAbort) return { failed: e.reason };
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { failed: "already_redeemed" };
        throw e;
      }
    },
  };
}

/** Gate check: does this Clerk user hold an active, unexpired membership at this venue? */
export async function hasActiveMembership(
  prisma: PrismaClient,
  clerkUserId: string,
  restaurantId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const m = await prisma.guestMembership.findFirst({
    where: { guest: { clerkUserId }, restaurantId, status: "ACTIVE", currentPeriodEnd: { gt: now } },
    select: { id: true },
  });
  return m != null;
}

/** Ensure a GuestProfile exists for a signed-in guest (first sign-in). */
export async function upsertGuestProfile(prisma: PrismaClient, clerkUserId: string, email?: string | null): Promise<string> {
  const g = await prisma.guestProfile.upsert({
    where: { clerkUserId },
    update: email ? { email } : {},
    create: { clerkUserId, email: email ?? null },
    select: { id: true },
  });
  return g.id;
}
