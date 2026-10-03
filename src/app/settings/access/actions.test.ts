import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), updateUserMetadata: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: h.auth,
  clerkClient: async () => ({ users: { updateUserMetadata: h.updateUserMetadata } }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { userRestaurantRole: { findFirst: h.findFirst, upsert: h.upsert } } }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/email/access-invite", () => ({ sendAccessInviteEmail: vi.fn() }));

import { saveAccessRole } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ userId: "owner" });
  h.findFirst.mockResolvedValue({ restaurantId: "tenant_a" });
  h.upsert.mockResolvedValue({ id: "role_1" });
});

describe("business access grants", () => {
  it("clears the grantee's Team-only metadata after saving a business role", async () => {
    await saveAccessRole({ clerkUserId: "staff", role: "MANAGER" });
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { clerkUserId: "staff", restaurantId: "tenant_a", role: "MANAGER" },
    }));
    expect(h.updateUserMetadata).toHaveBeenCalledWith("staff", { publicMetadata: { teamOnly: false } });
    expect(h.upsert.mock.invocationCallOrder[0]).toBeLessThan(h.updateUserMetadata.mock.invocationCallOrder[0]);
  });
});
