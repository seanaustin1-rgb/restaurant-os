import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  moduleFindUnique: vi.fn(),
  businessRoleFindUnique: vi.fn(),
  membershipFindUnique: vi.fn(),
  teamDb: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    moduleConfig: { findUnique: h.moduleFindUnique },
    userRestaurantRole: { findUnique: h.businessRoleFindUnique },
  },
}));
vi.mock("./db", () => ({ teamDb: h.teamDb }));

import { requireTeamAccess, TeamAccessDenied, visibleLessonFilter } from "./access";

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ userId: "user_1" });
  h.moduleFindUnique.mockResolvedValue({ isEnabled: true });
  h.businessRoleFindUnique.mockResolvedValue(null);
  h.membershipFindUnique.mockResolvedValue({
    id: "member_a", status: "ACTIVE", role: "MEMBER", departments: ["FOH"],
  });
  h.teamDb.mockReturnValue({ teamMembership: { findUnique: h.membershipFindUnique } });
});

describe("requireTeamAccess", () => {
  it("resolves only the explicitly requested tenant", async () => {
    const viewer = await requireTeamAccess("tenant_a");
    expect(viewer).toMatchObject({ restaurantId: "tenant_a", membershipId: "member_a", role: "MEMBER" });
    expect(h.moduleFindUnique).toHaveBeenCalledWith({
      where: { restaurantId_moduleKey: { restaurantId: "tenant_a", moduleKey: "team_hub" } },
      select: { isEnabled: true },
    });
    expect(h.teamDb).toHaveBeenCalledWith("tenant_a");
    expect(h.membershipFindUnique).toHaveBeenCalledWith({
      where: { restaurantId_clerkUserId: { restaurantId: "tenant_a", clerkUserId: "user_1" } },
      select: { id: true, status: true, role: true, departments: true },
    });

    h.membershipFindUnique.mockResolvedValue(null);
    await expect(requireTeamAccess("tenant_b")).rejects.toBeInstanceOf(TeamAccessDenied);
    expect(h.teamDb).toHaveBeenLastCalledWith("tenant_b");
  });

  it("treats only OPERATOR and MANAGER business roles as Team MANAGER", async () => {
    h.businessRoleFindUnique.mockResolvedValue({ role: "OPERATOR" });
    const owner = await requireTeamAccess("tenant_a", "MANAGER");
    expect(owner).toMatchObject({ role: "MANAGER", membershipId: null });
    expect(h.membershipFindUnique).not.toHaveBeenCalled();

    h.businessRoleFindUnique.mockResolvedValue({ role: "INVESTOR" });
    await expect(requireTeamAccess("tenant_a", "MANAGER"))
      .rejects.toBeInstanceOf(TeamAccessDenied);
    h.membershipFindUnique.mockResolvedValue({
      id: "member_a", status: "ACTIVE", role: "CONTRIBUTOR", departments: ["BAR"],
    });
    await expect(requireTeamAccess("tenant_a", "CONTRIBUTOR"))
      .resolves.toMatchObject({ role: "CONTRIBUTOR" });
  });

  it("denies access when the module is disabled or membership is removed", async () => {
    h.moduleFindUnique.mockResolvedValue({ isEnabled: false });
    await expect(requireTeamAccess("tenant_a")).rejects.toBeInstanceOf(TeamAccessDenied);
    expect(h.teamDb).not.toHaveBeenCalled();

    h.moduleFindUnique.mockResolvedValue({ isEnabled: true });
    h.membershipFindUnique.mockResolvedValue({
      id: "member_a", status: "REMOVED", role: "MANAGER", departments: ["MGMT"],
    });
    await expect(requireTeamAccess("tenant_a")).rejects.toBeInstanceOf(TeamAccessDenied);
  });
});

describe("visibleLessonFilter", () => {
  it("keeps managers-only lessons hidden from a MEMBER in MGMT", () => {
    const member = visibleLessonFilter({
      restaurantId: "tenant_a", clerkUserId: "user_1", membershipId: "member_a",
      role: "MEMBER", departments: ["MGMT"],
    });
    expect(member).toMatchObject({ status: "PUBLISHED", managersOnly: false });
    expect(member.OR).toEqual([
      { audience: { isEmpty: true } },
      { audience: { hasSome: ["MGMT"] } },
    ]);

    const manager = visibleLessonFilter({
      restaurantId: "tenant_a", clerkUserId: "owner", membershipId: null,
      role: "MANAGER", departments: [],
    });
    expect(manager).toEqual({ status: "PUBLISHED" });
  });
});
