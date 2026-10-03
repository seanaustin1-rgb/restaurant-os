import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ auth: vi.fn(), count: vi.fn(), modules: vi.fn(), requireTeamAccess: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  userRestaurantRole: { count: h.count },
  moduleConfig: { findMany: h.modules },
} }));
vi.mock("./access", () => ({
  TeamAccessDenied: class TeamAccessDenied extends Error {},
  requireTeamAccess: h.requireTeamAccess,
}));

import { TeamAccessDenied } from "./access";
import { isTeamOnlyUser } from "./tenants";

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ userId: "staff" });
  h.count.mockResolvedValue(0);
  h.modules.mockResolvedValue([{ restaurantId: "tenant_a", restaurant: { name: "A" } }]);
  h.requireTeamAccess.mockResolvedValue({ restaurantId: "tenant_a", role: "MEMBER" });
});

describe("Team-only detection", () => {
  it("requires an active Team access check and no business role", async () => {
    expect(await isTeamOnlyUser()).toBe(true);
    expect(h.requireTeamAccess).toHaveBeenCalledWith("tenant_a");
    h.count.mockResolvedValue(1);
    expect(await isTeamOnlyUser()).toBe(false);
  });

  it("does not classify an unclaimed user as Team-only", async () => {
    h.requireTeamAccess.mockRejectedValue(new TeamAccessDenied());
    expect(await isTeamOnlyUser()).toBe(false);
  });
});
