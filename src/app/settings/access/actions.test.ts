import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), updateUserMetadata: vi.fn(), revalidatePath: vi.fn(),
  findInvite: vi.fn(), updateInvite: vi.fn(), getUser: vi.fn(), transaction: vi.fn(),
  findRole: vi.fn(), countRoles: vi.fn(), getUserList: vi.fn(), findRestaurant: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: h.auth,
  clerkClient: async () => ({ users: { getUser: h.getUser, updateUserMetadata: h.updateUserMetadata, getUserList: h.getUserList } }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  userRestaurantRole: { findFirst: h.findFirst, upsert: h.upsert, findUnique: h.findRole, count: h.countRoles },
  businessAccessInvite: { findUnique: h.findInvite, update: h.updateInvite },
  restaurant: { findUnique: h.findRestaurant },
  $transaction: h.transaction,
} }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/email/access-invite", () => ({ sendAccessInviteEmail: vi.fn() }));

import { acceptAccessInvite, inviteAccessByEmail, saveAccessRole } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ userId: "owner" });
  h.findFirst.mockResolvedValue({ restaurantId: "tenant_a" });
  h.upsert.mockResolvedValue({ id: "role_1" });
  h.findInvite.mockResolvedValue({
    id: "invite_1", restaurantId: "tenant_a", email: "staff@example.com", role: "MANAGER", status: "PENDING",
  });
  h.getUser.mockResolvedValue({
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: "staff@example.com" }],
  });
  h.updateInvite.mockResolvedValue({ id: "invite_1" });
  h.transaction.mockResolvedValue([]);
  h.findRole.mockResolvedValue(null);
  h.countRoles.mockResolvedValue(1);
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

  it("refuses to demote the last operator (S-3)", async () => {
    h.findRole.mockResolvedValue({ role: "OPERATOR" });
    h.countRoles.mockResolvedValue(1);
    await expect(saveAccessRole({ clerkUserId: "owner", role: "MANAGER" })).rejects.toThrow(
      "A business must keep at least one operator.",
    );
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("refuses to demote the last operator via an email grant to their own account (S-3)", async () => {
    h.getUserList.mockResolvedValue({ data: [{ id: "owner" }] });
    h.findRestaurant.mockResolvedValue({ name: "Tenant A" });
    h.findRole.mockResolvedValue({ role: "OPERATOR" });
    h.countRoles.mockResolvedValue(1);
    await expect(inviteAccessByEmail({ email: "owner@example.com", role: "MANAGER" })).rejects.toThrow(
      "A business must keep at least one operator.",
    );
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("refuses an accepted invite that would demote the last operator (S-3)", async () => {
    h.auth.mockResolvedValue({ userId: "staff" });
    h.findRole.mockResolvedValue({ role: "OPERATOR" });
    h.countRoles.mockResolvedValue(1);
    await expect(acceptAccessInvite("token_1")).rejects.toThrow("A business must keep at least one operator.");
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("allows demoting an operator when another operator remains", async () => {
    h.findRole.mockResolvedValue({ role: "OPERATOR" });
    h.countRoles.mockResolvedValue(2);
    await saveAccessRole({ clerkUserId: "co_owner", role: "MANAGER" });
    expect(h.upsert).toHaveBeenCalled();
  });

  it("rejects an invite addressed to a different email without granting access", async () => {
    h.auth.mockResolvedValue({ userId: "staff" });
    h.getUser.mockResolvedValue({
      primaryEmailAddressId: "email_1",
      emailAddresses: [{ id: "email_1", emailAddress: "other@example.com" }],
    });
    await expect(acceptAccessInvite("token_1")).rejects.toThrow("This invite is for staff@example.com");
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.updateUserMetadata).not.toHaveBeenCalled();
  });

  it("accepts a matching email invite and clears Team-only after the role is granted", async () => {
    h.auth.mockResolvedValue({ userId: "staff" });
    await expect(acceptAccessInvite("token_1")).resolves.toBe("/onboarding");
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { clerkUserId: "staff", restaurantId: "tenant_a", role: "MANAGER" },
    }));
    expect(h.transaction).toHaveBeenCalledOnce();
    expect(h.updateUserMetadata).toHaveBeenCalledWith("staff", { publicMetadata: { teamOnly: false } });
    expect(h.transaction.mock.invocationCallOrder[0]).toBeLessThan(h.updateUserMetadata.mock.invocationCallOrder[0]);
  });
});
