import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  access: vi.fn(), teamDb: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), logCreate: vi.fn(),
  syncCurrentAccess: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/lib/team/access", () => ({ requireTeamAccess: h.access }));
vi.mock("@/lib/team/db", () => ({ teamDb: h.teamDb }));
vi.mock("@/lib/team/metadata", () => ({ syncTeamOnlyForCurrentAccess: h.syncCurrentAccess }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));

import { removeTeamMember } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  h.access.mockResolvedValue({ membershipId: "manager", clerkUserId: "owner" });
  h.findFirst.mockResolvedValue({ clerkUserId: "staff" });
  h.updateMany.mockResolvedValue({ count: 1 });
  h.teamDb.mockReturnValue({
    teamMembership: { findFirst: h.findFirst, updateMany: h.updateMany },
    teamActionLog: { create: h.logCreate },
  });
});

describe("roster removal", () => {
  it("resyncs the removed person's claim after the membership is removed", async () => {
    await removeTeamMember({ restaurantId: "tenant_a", memberId: "member_a" });
    expect(h.syncCurrentAccess).toHaveBeenCalledWith("staff");
    expect(h.updateMany.mock.invocationCallOrder[0]).toBeLessThan(h.syncCurrentAccess.mock.invocationCallOrder[0]);
  });
});
