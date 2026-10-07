import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ access: vi.fn(), db: vi.fn(), lesson: vi.fn(), tenants: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/team/access", async original => ({ ...await original<typeof import("@/lib/team/access")>(), requireTeamAccess: h.access }));
vi.mock("@/lib/team/db", () => ({ teamDb: h.db }));
vi.mock("@/lib/team/tenants", () => ({ listMyTeamTenants: h.tenants }));
vi.mock("next/navigation", () => ({ notFound: h.notFound }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children) }));
vi.mock("@/app/team/player", () => ({ TeamPlayer: () => React.createElement("div", { "data-private-player": true }) }));
import { TeamAccessDenied } from "@/lib/team/access";
import Page from "./page";
const viewer = { restaurantId: "a", clerkUserId: "user", membershipId: "member", role: "MEMBER", departments: ["MGMT"] };
const lesson = { id: "private", title: "Private leadership", takeaway: "Coach with care", category: "Leadership", tags: ["coaching"], managersOnly: true, version: 1, mediaAsset: { hasCaptions: true } };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  h.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
  h.access.mockResolvedValue(viewer);
  h.db.mockReturnValue({ teamLesson: { findFirst: h.lesson } });
  h.lesson.mockImplementation(async ({ where }) => where.managersOnly === false ? null : lesson);
  h.tenants.mockResolvedValue([{ id: "a", viewer }]);
});
afterAll(() => vi.unstubAllGlobals());
describe("R1 stable lesson page", () => {
  it.each(["MEMBER", "CONTRIBUTOR"])("returns the same 404 for %s in MGMT opening hidden or missing lessons", async role => {
    h.access.mockResolvedValue({ ...viewer, role });
    await expect(Page({ params: { lessonId: "private" }, searchParams: { restaurantId: "a" } })).rejects.toThrow("NOT_FOUND");
    h.lesson.mockResolvedValue(null);
    await expect(Page({ params: { lessonId: "missing" }, searchParams: { restaurantId: "a" } })).rejects.toThrow("NOT_FOUND");
  });
  it.each(["manager", "owner"])("renders for %s without exposing public media URLs", async who => {
    h.access.mockResolvedValue({ ...viewer, role: "MANAGER", membershipId: who === "owner" ? null : "member" });
    const html = renderToStaticMarkup(await Page({ params: { lessonId: "private" }, searchParams: { restaurantId: "a" } }));
    expect(html).toContain("Coach with care"); expect(html).toContain("Managers only");
    expect(html).not.toContain("videodelivery.net"); expect(html).not.toContain("providerAssetId");
  });
  it("denies a foreign tenant before a lesson query", async () => {
    h.access.mockRejectedValue(new TeamAccessDenied());
    await expect(Page({ params: { lessonId: "private" }, searchParams: { restaurantId: "b" } })).rejects.toThrow("NOT_FOUND");
    expect(h.db).not.toHaveBeenCalled();
  });
  it("resolves a bare stable URL only within authorized teams", async () => {
    h.access.mockResolvedValue({ ...viewer, role: "MANAGER" });
    const html = renderToStaticMarkup(await Page({ params: { lessonId: "private" }, searchParams: {} }));
    expect(html).toContain("restaurantId=a"); expect(h.access).toHaveBeenCalledWith("a"); expect(h.db).toHaveBeenCalledWith("a");
  });
});
