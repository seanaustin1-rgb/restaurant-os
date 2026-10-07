import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ load: vi.fn(), seen: vi.fn() }));
vi.mock("@/lib/team/feed", () => ({ loadTeamFeed: h.load, markTeamFeedSeen: h.seen }));
import { TeamAccessDenied } from "@/lib/team/access";
import { GET } from "./route";
import { POST } from "./seen/route";
beforeEach(() => { vi.clearAllMocks(); h.load.mockResolvedValue({ lessons: [], cursor: null }); h.seen.mockResolvedValue(undefined); });
describe("Phase 4 feed routes", () => {
  it("passes explicit tenant, search/filter and cursor to the access-guarded loader", async () => {
    const response = await GET(new Request("https://app.test/api/team/feed?restaurantId=a&q=wine&tag=wine&category=Bar&cursor=next"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(h.load).toHaveBeenCalledWith({ restaurantId: "a", q: "wine", category: "Bar", tag: "wine", cursor: "next", asOf: undefined });
  });
  it("denies foreign tenant or removed member on feed and last-visit write", async () => {
    h.load.mockRejectedValue(new TeamAccessDenied()); h.seen.mockRejectedValue(new TeamAccessDenied());
    expect((await GET(new Request("https://app.test/api/team/feed?restaurantId=b"))).status).toBe(403);
    expect((await POST(new Request("https://app.test/api/team/feed/seen", { method: "POST", body: JSON.stringify({ restaurantId: "b", asOf: "2026-10-07" }) }))).status).toBe(403);
  });
  it("rejects missing tenant, invalid cursor and cross-origin visit writes", async () => {
    expect((await GET(new Request("https://app.test/api/team/feed"))).status).toBe(400);
    h.load.mockRejectedValue(new Error("Invalid feed cursor"));
    expect((await GET(new Request("https://app.test/api/team/feed?restaurantId=a&cursor=broken"))).status).toBe(400);
    expect((await POST(new Request("https://app.test/api/team/feed/seen", { method: "POST", headers: { origin: "https://other.test" }, body: "{}" }))).status).toBe(403);
    expect(h.seen).not.toHaveBeenCalled();
  });
  it("accepts a same-origin JSON beacon and returns 204", async () => {
    const response = await POST(new Request("https://app.test/api/team/feed/seen", { method: "POST", headers: { origin: "https://app.test" }, body: JSON.stringify({ restaurantId: "a", asOf: "2026-10-07" }) }));
    expect(response.status).toBe(204); expect(h.seen).toHaveBeenCalledWith("a", "2026-10-07");
  });
});
