import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(), getUser: vi.fn(), teamDb: vi.fn(), findUnique: vi.fn(),
  updateMany: vi.fn(), logCreate: vi.fn(), requireTeamAccess: vi.fn(), moduleFindUnique: vi.fn(),
  businessRoleCount: vi.fn(), updateUserMetadata: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: h.auth,
  clerkClient: async () => ({ users: { getUser: h.getUser, updateUserMetadata: h.updateUserMetadata } }),
}));
vi.mock("./db", () => ({ teamDb: h.teamDb }));
vi.mock("./access", () => ({ requireTeamAccess: h.requireTeamAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  moduleConfig: { findUnique: h.moduleFindUnique },
  userRestaurantRole: { count: h.businessRoleCount },
} }));

import { claimTeamMembership, TeamClaimDenied } from "./claim";

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ userId: "clerk_1" });
  h.getUser.mockResolvedValue({
    primaryPhoneNumberId: "phone_1",
    phoneNumbers: [{ id: "phone_1", phoneNumber: "+17175551234", verification: { status: "verified" } }],
  });
  h.findUnique.mockResolvedValue({ id: "member_a", status: "INVITED", clerkUserId: null });
  h.moduleFindUnique.mockResolvedValue({ isEnabled: true });
  h.businessRoleCount.mockResolvedValue(0);
  h.updateMany.mockResolvedValue({ count: 1 });
  h.logCreate.mockResolvedValue({ id: "log_1" });
  h.teamDb.mockReturnValue({
    teamMembership: { findUnique: h.findUnique, updateMany: h.updateMany },
    teamActionLog: { create: h.logCreate },
  });
});

describe("phone login claim", () => {
  it("binds only the invited row for the explicitly named restaurant and verified phone", async () => {
    await claimTeamMembership("tenant_a", "member_a");
    expect(h.teamDb).toHaveBeenCalledWith("tenant_a");
    expect(h.findUnique).toHaveBeenCalledWith({
      where: { restaurantId_phoneE164: { restaurantId: "tenant_a", phoneE164: "+17175551234" } },
      select: { id: true, status: true, clerkUserId: true },
    });
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: "member_a", phoneE164: "+17175551234", status: "INVITED", clerkUserId: null },
      data: { clerkUserId: "clerk_1", status: "ACTIVE" },
    });
    expect(h.requireTeamAccess).toHaveBeenCalledWith("tenant_a");
    expect(h.businessRoleCount).toHaveBeenCalledWith({ where: { clerkUserId: "clerk_1" } });
    expect(h.updateUserMetadata).toHaveBeenCalledWith("clerk_1", { publicMetadata: { teamOnly: true } });
  });

  it("does not mark a claimant Team-only when they already have a business role", async () => {
    h.businessRoleCount.mockResolvedValue(1);
    await claimTeamMembership("tenant_a", "member_a");
    expect(h.updateUserMetadata).toHaveBeenCalledWith("clerk_1", { publicMetadata: { teamOnly: false } });
    expect(h.updateUserMetadata).not.toHaveBeenCalledWith("clerk_1", { publicMetadata: { teamOnly: true } });
  });

  it("cannot claim an invitation from another restaurant", async () => {
    h.findUnique.mockResolvedValue(null);
    await expect(claimTeamMembership("tenant_b", "member_a")).rejects.toBeInstanceOf(TeamClaimDenied);
    expect(h.teamDb).toHaveBeenCalledWith("tenant_b");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("does not let a forwarded link claim another invited row in the same restaurant", async () => {
    h.findUnique.mockResolvedValue({ id: "member_b", status: "INVITED", clerkUserId: null });
    await expect(claimTeamMembership("tenant_a", "member_a")).rejects.toBeInstanceOf(TeamClaimDenied);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("does not claim a link missing its roster entry", async () => {
    await expect(claimTeamMembership("tenant_a", "")).rejects.toBeInstanceOf(TeamClaimDenied);
    expect(h.teamDb).not.toHaveBeenCalled();
  });

  it("does not claim while Team Hub is disabled for that restaurant", async () => {
    h.moduleFindUnique.mockResolvedValue({ isEnabled: false });
    await expect(claimTeamMembership("tenant_a", "member_a")).rejects.toBeInstanceOf(TeamClaimDenied);
    expect(h.teamDb).not.toHaveBeenCalled();
  });

  it.each(["ACTIVE", "REMOVED"])("does not bind a %s membership", async (status) => {
    h.findUnique.mockResolvedValue({ id: "member_a", status, clerkUserId: null });
    await expect(claimTeamMembership("tenant_a", "member_a")).rejects.toBeInstanceOf(TeamClaimDenied);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unverified phone and a lost claim race", async () => {
    h.getUser.mockResolvedValueOnce({
      primaryPhoneNumberId: "phone_1",
      phoneNumbers: [{ id: "phone_1", phoneNumber: "+17175551234", verification: { status: "unverified" } }],
    });
    await expect(claimTeamMembership("tenant_a", "member_a")).rejects.toBeInstanceOf(TeamClaimDenied);
    expect(h.teamDb).not.toHaveBeenCalled();
    h.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(claimTeamMembership("tenant_a", "member_a")).rejects.toBeInstanceOf(TeamClaimDenied);
    expect(h.logCreate).not.toHaveBeenCalled();
  });
});
