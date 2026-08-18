import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateMembershipCode, hashMembershipCode, normalizeMembershipCode } from "./membership-code";
import {
  computePeriodEnd,
  evaluateCode,
  redeemMembershipCode,
  type MembershipCodeRow,
  type RedeemStore,
} from "./membership";

const ORIG = { ...process.env };
beforeEach(() => {
  process.env.SPIRIT_VAULT_MEMBERSHIP_PEPPER = "test-pepper";
});
afterEach(() => {
  process.env = { ...ORIG };
});

// ── membership-code (hashing) ────────────────────────────────────────────────
describe("membership-code", () => {
  it("generates a grouped RSRV code and a matching hash", () => {
    const g = generateMembershipCode();
    expect(g.plaintext).toMatch(/^RSRV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(g.codeHash).toBe(hashMembershipCode(g.plaintext));
    expect(g.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hint reveals no usable code material", () => {
    const g = generateMembershipCode();
    expect(g.hint).toContain("••••");
    expect(g.hint).not.toBe(g.plaintext);
  });

  it("normalizes case/separators so redemption is forgiving", () => {
    expect(normalizeMembershipCode(" rsrv-7k2q-9m4x ")).toBe("RSRV7K2Q9M4X");
    expect(hashMembershipCode("RSRV-7K2Q-9M4X")).toBe(hashMembershipCode("rsrv 7k2q 9m4x"));
  });

  it("hash depends on the pepper", () => {
    const a = hashMembershipCode("RSRV-7K2Q-9M4X");
    process.env.SPIRIT_VAULT_MEMBERSHIP_PEPPER = "different";
    expect(hashMembershipCode("RSRV-7K2Q-9M4X")).not.toBe(a);
  });
});

// ── pure validation ──────────────────────────────────────────────────────────
const base: MembershipCodeRow = {
  id: "c1",
  restaurantId: "r1",
  tier: "echo_reserve",
  grantDays: 365,
  maxRedemptions: null,
  redemptionCount: 0,
  status: "ACTIVE",
  expiresAt: null,
};
const NOW = new Date("2026-08-18T12:00:00Z");

describe("evaluateCode", () => {
  it("passes a fresh active code", () => expect(evaluateCode(base, false, NOW)).toBeNull());
  it("not_found for missing", () => expect(evaluateCode(null, false, NOW)).toBe("not_found"));
  it("revoked", () => expect(evaluateCode({ ...base, status: "REVOKED" }, false, NOW)).toBe("revoked"));
  it("expired", () => expect(evaluateCode({ ...base, expiresAt: new Date("2026-08-17T12:00:00Z") }, false, NOW)).toBe("expired"));
  it("exhausted at the cap", () => expect(evaluateCode({ ...base, maxRedemptions: 1, redemptionCount: 1 }, false, NOW)).toBe("exhausted"));
  it("already_redeemed", () => expect(evaluateCode(base, true, NOW)).toBe("already_redeemed"));
});

describe("computePeriodEnd", () => {
  it("grants from now when no active membership", () => {
    expect(computePeriodEnd(null, 365, NOW).getTime()).toBe(NOW.getTime() + 365 * 86_400_000);
  });
  it("extends from an existing later end", () => {
    const end = new Date(NOW.getTime() + 100 * 86_400_000);
    expect(computePeriodEnd(end, 365, NOW).getTime()).toBe(end.getTime() + 365 * 86_400_000);
  });
});

// ── in-memory store + redeem orchestration ───────────────────────────────────
interface Seed {
  id: string;
  plaintext: string;
  grantDays?: number;
  maxRedemptions?: number | null;
  status?: "ACTIVE" | "REVOKED";
  expiresAt?: Date | null;
}
function makeStore(seeds: Seed[]) {
  const byHash = new Map<string, MembershipCodeRow>();
  const byId = new Map<string, MembershipCodeRow>();
  for (const s of seeds) {
    const row: MembershipCodeRow = {
      id: s.id,
      restaurantId: "r1",
      tier: "echo_reserve",
      grantDays: s.grantDays ?? 365,
      maxRedemptions: s.maxRedemptions ?? null,
      redemptionCount: 0,
      status: s.status ?? "ACTIVE",
      expiresAt: s.expiresAt ?? null,
    };
    byHash.set(`r1:${hashMembershipCode(s.plaintext)}`, row);
    byId.set(row.id, row);
  }
  const redemptions = new Set<string>();
  const memberships: { id: string; guestId: string; end: Date }[] = [];
  let seq = 0;
  const store: RedeemStore = {
    async loadCode(rid, ch) {
      return byHash.get(`${rid}:${ch}`) ?? null;
    },
    async hasRedeemed(cid, gid) {
      return redemptions.has(`${cid}:${gid}`);
    },
    async activeMembershipEnd(gid, _rid, now) {
      const m = memberships
        .filter((x) => x.guestId === gid && x.end.getTime() > now.getTime())
        .sort((a, b) => b.end.getTime() - a.end.getTime())[0];
      return m?.end ?? null;
    },
    async commit(input) {
      const live = byId.get(input.code.id)!;
      if (live.status !== "ACTIVE") return { failed: "revoked" };
      if (live.maxRedemptions != null && live.redemptionCount >= live.maxRedemptions) return { failed: "exhausted" };
      if (redemptions.has(`${input.code.id}:${input.guestId}`)) return { failed: "already_redeemed" };
      live.redemptionCount += 1;
      redemptions.add(`${input.code.id}:${input.guestId}`);
      const existing = memberships.find((x) => x.guestId === input.guestId && x.end.getTime() > input.now.getTime());
      if (existing) {
        existing.end = input.currentPeriodEnd;
        return { membershipId: existing.id };
      }
      const id = `m${++seq}`;
      memberships.push({ id, guestId: input.guestId, end: input.currentPeriodEnd });
      return { membershipId: id };
    },
  };
  return { store, memberships, byId };
}

describe("redeemMembershipCode", () => {
  it("redeems a valid code into a 1-year membership", async () => {
    const { store } = makeStore([{ id: "c1", plaintext: "RSRV-AAAA-BBBB" }]);
    const res = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "rsrv-aaaa-bbbb", now: NOW });
    expect(res).toEqual({ ok: true, membershipId: "m1", currentPeriodEnd: new Date(NOW.getTime() + 365 * 86_400_000), extended: false });
  });

  it("rejects a wrong code as not_found", async () => {
    const { store } = makeStore([{ id: "c1", plaintext: "RSRV-AAAA-BBBB" }]);
    const res = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-ZZZZ-ZZZZ", now: NOW });
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  it("blocks the same guest redeeming a code twice", async () => {
    const { store } = makeStore([{ id: "c1", plaintext: "RSRV-AAAA-BBBB" }]);
    await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
    const again = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
    expect(again).toEqual({ ok: false, reason: "already_redeemed" });
  });

  it("single-use code: second guest is exhausted", async () => {
    const { store } = makeStore([{ id: "c1", plaintext: "RSRV-AAAA-BBBB", maxRedemptions: 1 }]);
    const first = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
    expect(first.ok).toBe(true);
    const second = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g2", plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
    expect(second).toEqual({ ok: false, reason: "exhausted" });
  });

  it("unlimited code: many guests can redeem", async () => {
    const { store } = makeStore([{ id: "c1", plaintext: "RSRV-AAAA-BBBB", maxRedemptions: null }]);
    for (const g of ["g1", "g2", "g3"]) {
      const r = await redeemMembershipCode(store, { restaurantId: "r1", guestId: g, plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
      expect(r.ok).toBe(true);
    }
  });

  it("rejects a revoked code", async () => {
    const { store } = makeStore([{ id: "c1", plaintext: "RSRV-AAAA-BBBB", status: "REVOKED" }]);
    const res = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
    expect(res).toEqual({ ok: false, reason: "revoked" });
  });

  it("rejects an expired code", async () => {
    const { store } = makeStore([{ id: "c1", plaintext: "RSRV-AAAA-BBBB", expiresAt: new Date(NOW.getTime() - 1000) }]);
    const res = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
    expect(res).toEqual({ ok: false, reason: "expired" });
  });

  it("extends from the current end when a member redeems a second code", async () => {
    const { store } = makeStore([
      { id: "c1", plaintext: "RSRV-AAAA-BBBB" },
      { id: "c2", plaintext: "RSRV-CCCC-DDDD" },
    ]);
    const first = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-AAAA-BBBB", now: NOW });
    expect(first.ok && first.extended).toBe(false);
    const second = await redeemMembershipCode(store, { restaurantId: "r1", guestId: "g1", plaintextCode: "RSRV-CCCC-DDDD", now: NOW });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.extended).toBe(true);
      expect(second.currentPeriodEnd.getTime()).toBe(NOW.getTime() + 2 * 365 * 86_400_000);
    }
  });
});
