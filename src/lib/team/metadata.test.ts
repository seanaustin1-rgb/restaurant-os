import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  countRoles: vi.fn(), modules: vi.fn(), countMembers: vi.fn(), teamDb: vi.fn(), updateUserMetadata: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { updateUserMetadata: h.updateUserMetadata } }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  userRestaurantRole: { count: h.countRoles },
  moduleConfig: { findMany: h.modules },
} }));
vi.mock("./db", () => ({ teamDb: h.teamDb }));

import { syncTeamOnlyForCurrentAccess } from "./metadata";

beforeEach(() => {
  vi.clearAllMocks();
  h.countRoles.mockResolvedValue(0);
  h.modules.mockResolvedValue([{ restaurantId: "tenant_a" }, { restaurantId: "tenant_b" }]);
  h.countMembers.mockResolvedValue(0);
  h.teamDb.mockReturnValue({ teamMembership: { count: h.countMembers } });
});

describe("Team-only metadata after removal", () => {
  it("clears the flag when the removed person has no other active Team membership", async () => {
    await syncTeamOnlyForCurrentAccess("staff");
    expect(h.teamDb).toHaveBeenCalledWith("tenant_a");
    expect(h.teamDb).toHaveBeenCalledWith("tenant_b");
    expect(h.updateUserMetadata).toHaveBeenCalledWith("staff", { publicMetadata: { teamOnly: false } });
  });

  it("keeps the flag when another enabled restaurant still has active membership", async () => {
    h.countMembers.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await syncTeamOnlyForCurrentAccess("staff");
    expect(h.updateUserMetadata).toHaveBeenCalledWith("staff", { publicMetadata: { teamOnly: true } });
  });

  it("clears the flag without checking Team rows when the person has a business role", async () => {
    h.countRoles.mockResolvedValue(1);
    await syncTeamOnlyForCurrentAccess("staff");
    expect(h.teamDb).not.toHaveBeenCalled();
    expect(h.updateUserMetadata).toHaveBeenCalledWith("staff", { publicMetadata: { teamOnly: false } });
  });
});
